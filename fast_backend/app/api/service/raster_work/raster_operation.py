import uuid
import shutil
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from pyproj import CRS as ProjCRS
from fastapi import UploadFile
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional,List
from fastapi import UploadFile
from app.conf.settings import Settings
from sqlalchemy.orm import Session
import math
import os
import time
from app.conf.logging import logger
from app.api.service.celery.raster_heavy_task import celery_reprojection,celery_euclidean_distance,reclassify_raster
from app.api.schema.raster_operation import Edliudian,RasterReclassify



class RasterOperation:

    def __init__(self):
        self.redis_client = Settings().redis_client
        self.temp_dir = Path(Settings().TEMP_DIR+"/raster_tools")
        os.makedirs(self.temp_dir, exist_ok=True)

    def _get_file_path(self, file_id: str) -> Path:
        file_path = self.redis_client.get(f"raster:{file_id}")
        if not file_path:
            raise ValueError("Invalid or expired file_id")
        file_path = Path(file_path)
        if file_path.exists():
            return file_path
        raise FileNotFoundError("Temporary file missing")

    def _safe_float(self, value):
        if value is None:
            return None
        if isinstance(value, np.ma.core.MaskedConstant) or (
            hasattr(value, "_mask") and np.ma.is_masked(value)
        ):
            return None
        if isinstance(value, (float, np.floating)):
            if math.isnan(value) or math.isinf(value):
                return None
        return float(value)

    def _crs_units(self, src) -> str:
        """Return the linear unit name of the CRS (e.g. 'metre', 'foot', 'degree')."""
        if not src.crs:
            return "unknown"
        try:
            proj_crs = ProjCRS.from_user_input(src.crs)
            if proj_crs.is_geographic:
                return "degree"
            axis_info = proj_crs.axis_info
            if axis_info:
                return axis_info[0].unit_name  # e.g. 'metre', 'US survey foot'
        except Exception:
            pass
        return getattr(src.crs, "linear_units", "unknown") or "unknown"

    def _format_resolution(self, res_x: float, res_y: float, unit: str) -> Dict[str, Any]:
        """Return resolution with human-readable values and unit label."""

        def _humanize(value: float, unit: str):
            if unit == "degree":
                approx_m = value * 111_320
                return {
                    "value": round(value, 8),
                    "unit": "degree",
                    "approx_metres": round(approx_m, 2),
                }
            if unit in ("metre", "meter", "meters", "metres"):
                if value < 1:
                    return {"value": round(value * 100, 4), "unit": "cm"}
                if value >= 1000:
                    return {"value": round(value / 1000, 4), "unit": "km"}
                return {"value": round(value, 4), "unit": "m"}
            if "foot" in unit or "feet" in unit:
                metres = value * 0.3048
                return {
                    "value": round(metres, 4),
                    "unit": "m",
                    "original_value": round(value, 4),
                    "original_unit": unit,
                }
            return {"value": round(value, 6), "unit": unit}

        return {
            "x": _humanize(abs(res_x), unit),
            "y": _humanize(abs(res_y), unit),
        }

    def _format_file_size(self, size_bytes: int) -> Dict[str, Any]:
        if size_bytes < 1024:
            return {"value": size_bytes, "unit": "B"}
        if size_bytes < 1024**2:
            return {"value": round(size_bytes / 1024, 2), "unit": "KB"}
        if size_bytes < 1024**3:
            return {"value": round(size_bytes / 1024**2, 2), "unit": "MB"}
        return {"value": round(size_bytes / 1024**3, 2), "unit": "GB"}

   

    def _basic_info(self, src, file_path: Path) -> Dict[str, Any]:
        size_bytes = file_path.stat().st_size
        return {
            "file_name": file_path.name,
            "file_size": self._format_file_size(size_bytes),
            "driver": src.driver,
            "width": src.width,
            "height": src.height,
            "band_count": src.count,
            "dtypes": list(src.dtypes),
            "nodata": self._safe_float(src.nodata),
        }

    def _spatial_info(self, src) -> Dict[str, Any]:
        unit = self._crs_units(src)

        bounds_wgs84 = None
        if src.crs:
            raw = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
            bounds_wgs84 = {
                "west": self._safe_float(raw[0]),
                "south": self._safe_float(raw[1]),
                "east": self._safe_float(raw[2]),
                "north": self._safe_float(raw[3]),
                "unit": "degree",
            }

        b = src.bounds
        return {
            "crs": src.crs.to_string() if src.crs else None,
            "crs_unit": unit,
            "bounds": {
                "west": self._safe_float(b.left),
                "south": self._safe_float(b.bottom),
                "east": self._safe_float(b.right),
                "north": self._safe_float(b.top),
                "unit": unit,
            },
            "bounds_wgs84": bounds_wgs84,
            "resolution": self._format_resolution(src.res[0], src.res[1], unit),
        }

    def _advanced_info(self, src) -> Dict[str, Any]:
        return {
            "compression": src.compression.value if src.compression else None,
            "is_tiled": src.is_tiled,
            "block_shapes": src.block_shapes,
            "overviews": {i + 1: src.overviews(i + 1) for i in range(src.count)},
            "is_cog_like": (
                src.driver == "GTiff"
                and src.is_tiled
                and bool(src.overviews(1))
            ),
        }

    def _band_info(self, src, compute_stats: bool):
        bands = []
        for i in range(1, src.count + 1):
            band_meta = {
                "band_number": i,
                "dtype": src.dtypes[i - 1],
                "color_interpretation": (
                    src.colorinterp[i - 1].name if src.colorinterp else None
                ),
            }
            if compute_stats:
                band_meta.update(self._sampled_stats(src, i))
            bands.append(band_meta)
        return bands

    def _sampled_stats(self, src, band_index: int, target_pixels: int = 1024 * 1024):
        """
        Returns sampled stats for a single band of a raster.
        """
        total_pixels = src.width * src.height

        if total_pixels <= target_pixels:
            # Small raster — read the whole thing at full resolution
            out_height, out_width = src.height, src.width
        else:
            scale = math.sqrt(target_pixels / total_pixels)
            out_height = max(1, int(src.height * scale))
            out_width = max(1, int(src.width * scale))

        data = src.read(
            band_index,
            out_shape=(out_height, out_width),
            resampling=Resampling.nearest,  # preserve original values
            masked=True,                    # auto-applies nodata mask
        )

        valid = data.compressed() if np.ma.is_masked(data) else data.flatten()

        if valid.size == 0:
            return {
                "min": None,
                "max": None,
                "mean": None,
                "std": None,
                "sample_note": "no valid pixels found across entire raster",
            }

        return {
            "min": self._safe_float(valid.min()),
            "max": self._safe_float(valid.max()),
            "mean": self._safe_float(valid.mean()),
            "std": self._safe_float(valid.std()),
            "sample_note": (
                f"decimated full raster to {out_width}×{out_height} "
                f"({valid.size:,} valid pixels out of {out_width * out_height:,} sampled)"
            ),
        }
    def _remove_duplicate(file_path: str):
        path = Path(file_path)
        if path.exists() and path.is_file():
            path.unlink()
            logger.info(f"Removed existing file: {file_path}")
    
    def save_upload(self, file: UploadFile) -> str:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > 500 * 1024 * 1024:
            raise ValueError("File size exceeds 500 MB limit")

        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in (".tif", ".tiff"):
            raise ValueError("Invalid file format — only .tif / .tiff accepted")

        file_id = str(uuid.uuid4())
        file_path = self.temp_dir / f"{file_id}{file_ext}"

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Store path in Redis for 3 hours
        self.redis_client.setex(f"raster:{file_id}", 10800, str(file_path))
        return file_id

    def get_raster_info(self, file_id: str, compute_stats: bool = True) -> Dict[str, Any]:
        file_path = self._get_file_path(file_id)

        with rasterio.open(file_path) as src:
            return {
                **self._basic_info(src, file_path),
                **self._spatial_info(src),
                **self._advanced_info(src),
                "bands": self._band_info(src, compute_stats),
                "tags": src.tags(),
            }

    def reprojection(self,db:Session,file_id:str,crs:str,resampling:str):
        file_path=self._get_file_path(file_id)
        output_path = self.temp_dir / f"reprojected_{crs}_{time.time()}.tif"
        return celery_reprojection(file_path,output_path,crs,resampling)   

    def reclassify(self,db:Session,payload:RasterReclassify):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"reclassified_{time.time()}.tif"
        return reclassify_raster(payload,file_path,output_path)

    def edludian(self,db:Session,payload:Edliudian):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"ecludian_{time.time()}.tif"
        return celery_euclidean_distance(file_path,output_path,payload.target_values,payload.max_distance,payload.distance_units)