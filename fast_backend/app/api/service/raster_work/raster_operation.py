import uuid
import shutil
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from pyproj import CRS as ProjCRS
from fastapi import UploadFile
import numpy as np
from pathlib import Path
from typing import Dict, Any
from fastapi import UploadFile,HTTPException
from app.conf.settings import Settings
from sqlalchemy.orm import Session
import math
import os
import time
from app.conf.logging import logger
from app.api.service.celery.raster_operations.raster_heavy_task import (
    celery_reprojection,
    celery_euclidean_distance,
    reclassify_raster,
    compute_flow_direction_task,
    compute_flow_accumulation_task,
    compute_slope_task,
    compute_tpi_task,
    compute_twi_task,
    resample_raster_task)

from app.api.schema.raster_operation import( 
    RasterReclassify,
    Edliudian,
    FlowDirectionParams,
    FlowAccumulationParams,
    RasterReproject,
    SlopeParams,
    TpiParams,
    TwiParams,
    CellResize,
    rasterMetaSchame,
    rasteroperSchema)
from app.utils.name import Unique_name
from app.api.exception.exceptions import CustomException

from .raster_resize_test import dry_run_resample
from app.api.service.geoserver import Geoserver
from app.database.crud.raster_operations import rasterstorecrud,rasterMetacrud
from enum import Enum
from app.conf.redis import redis_client

class EPSG(Enum):
    WGS84 = 4326
    WGS84_Web_Mercator = 3857
    NAD83 = 4269
    ETRS89 = 4258
    UTM_Zone_33N = 32633
    UTM_Zone_43N = 32643
    UTM_Zone_44N = 32644
    UTM_Zone_45N = 32645
    UTM_Zone_46N = 32646

class RasterOperation:

    def __init__(self):
        self.redis_client=redis_client
        self.temp_dir = Path(Settings().TEMP_DIR+"/raster_tools")
        self.chunk_dir=Path(Settings().TEMP_DIR+"/chunk_dir")
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(self.chunk_dir, exist_ok=True)
        self.MAX_SIZE_BYTES = 500 * 1024 * 1024
        self.geo=Geoserver()
        self.workspace="raster_work"
        self.default_sld="/home/app/media/Rajat_data/default_sld.xml"
    def _get_file_path(self, file_id: str) -> Path:
        file_path = self.redis_client.get(f"raster:{file_id}")
        if not file_path:
            raise ValueError("Invalid or expired file_id")
        file_path = Path(file_path)
        if file_path.exists():
            return file_path
        raise FileNotFoundError("Temporary file missing")

    def _get_Nodata(self):
        pass

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
            "dtypes": src.dtypes[0],
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

    
    async def _upload_geoserver(self,file_path:str):
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=await Geoserver().upload_raster(self.workspace,store_name=unique_store_name,raster_path=file_path)
        return layer_name
    
    async def _make_raster_info(self,db:Session, file_id: str, file_name: str = None, compute_stats: bool = True) -> Dict[str, Any]:
        file_path = self._get_file_path(file_id)
        layer_name=await self._upload_geoserver(file_path)
        rasteroperSchemaObj=rasteroperSchema(
            file_id=file_id,
            layer_name=layer_name,
            file_path=str(file_path),
            file_name=file_name,
            parent_id=None,
            raster_type="uploaded"
        )
        rasterstorecrud(db).create_details(rasteroperSchemaObj)
        with rasterio.open(file_path) as src:
            rasterMetaSchameObj=rasterMetaSchame(
                **self._basic_info(src, file_path),
                **self._spatial_info(src),
                **self._advanced_info(src),
                bands= self._band_info(src, compute_stats),
                tags= src.tags(),
                file_id= file_id, 
            )
        rasterMetacrud(db).create_details(rasterMetaSchameObj)

    async def available_epsg(self):
        return {epsg.name :epsg.value for epsg in EPSG}
        
    async def save_upload(self, db:Session,file: UploadFile) -> str:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > 500 * 1024 * 1024:
            raise ValueError("File size exceeds 500 MB limit")
        file_name = file.filename

        file_ext = Path(file_name).suffix.lower()
        if file_ext not in (".tif", ".tiff"):
            raise ValueError("Invalid file format — only .tif / .tiff accepted")

        file_id = str(uuid.uuid4())
        file_path = self.temp_dir / f"{file_id}{file_ext}"

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Store path in Redis for 3 hours
        self.redis_client.setex(f"raster:{file_id}", 10800, str(file_path))
        await self._make_raster_info(db,file_id,file_name.split(".")[0])
        return file_id

    async def chunk_upload(self, file: UploadFile,upload_id:str,chunk_index: int) -> str:
        
        chunk_dir = self.chunk_dir / upload_id
        chunk_dir.mkdir(parents=True, exist_ok=True)
        chunk_path = chunk_dir / f"{chunk_index}.part"
        try:
            current_size = sum(
                f.stat().st_size for f in chunk_dir.glob("*.part")
            )

            with chunk_path.open("wb") as buffer:
                while True:
                    chunk = await file.read(1024 * 1024)  # 1MB
                    if not chunk:
                        break
                    current_size += len(chunk)

                   
                    if current_size > self.MAX_SIZE_BYTES:
                        buffer.close()
                        shutil.rmtree(chunk_dir, ignore_errors=True)
                        raise HTTPException(
                            status_code=400,
                            detail="File exceeds 500MB limit"
                        )
                    buffer.write(chunk)

        except HTTPException:
            raise
        except Exception:
            shutil.rmtree(chunk_dir, ignore_errors=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to write chunk"
            )

        return "Chunk uploaded successfully"
    
    async def merge_chunks(self, upload_id: str,filename: str,total_chunks: int) -> str:
        file_ext = Path(filename).suffix.lower()
        if file_ext not in (".tif", ".tiff"):
            raise HTTPException(status_code=404, detail="Invalid file format — only .tif / .tiff accepted")
        file_id = str(uuid.uuid4())
        chunk_dir = self.chunk_dir / upload_id
        if not chunk_dir.exists():
            raise HTTPException(status_code=404, detail="Upload ID not found")

        output_path = self.temp_dir / f"{file_id}{file_ext}"

        with output_path.open("wb") as output_file:
            for i in range(total_chunks):
                chunk_file = chunk_dir / f"{i}.part"
                if not chunk_file.exists():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing chunk {i}"
                    )

                with chunk_file.open("rb") as cf:
                    shutil.copyfileobj(cf, output_file)


        shutil.rmtree(chunk_dir)
        self.redis_client.setex(f"raster:{file_id}", 10800, str(output_path)) 
        layer_name=await self._upload_geoserver(output_path)
        return {"file_id": file_id,"layer_name":layer_name,"filename":filename.split(".")[0]}

    async def get_info(self,db:Session,file_id:str):
        resp1=rasterstorecrud(db).get_details(file_id)
        resp2=rasterMetacrud(db).get_details(file_id)
        if resp1 is None or resp2 is None:
            raise CustomException(status_code=404,detail="File not found")
        return {"raster_info":resp1,"raster_meta":resp2}

    def reprojection(self,db:Session,payload:RasterReproject):
        try:
            epsg_code = EPSG[crs].value
            crs="EPSG:"+str(epsg_code)
            file_path=self._get_file_path(payload.file_id)
            output_path = self.temp_dir / f"reprojected_{crs}_{time.time()}.tif"
            return celery_reprojection.delay(str(file_path),str(output_path),crs,payload.src_nodata,payload.resampling)
        except KeyError:
            raise ValueError("Invalid EPSG")

           

    def reclassify(self,db:Session,payload:RasterReclassify):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"reclassified_{time.time()}.tif"
        return reclassify_raster(payload,str(file_path),str(output_path))

    def edludian(self,db:Session,payload:Edliudian):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"ecludian_{time.time()}.tif"
        return celery_euclidean_distance(str(file_path),str(output_path),payload.target_values,payload.max_distance,payload.distance_units)
    
    def flow_direction(self,db:Session,payload:FlowDirectionParams):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"flow_direction_{time.time()}.tif"
        return compute_flow_direction_task.delay(str(file_path),str(output_path),payload.algorithm,payload.fill_depressions,payload.src_nodata,payload.max_slope)
    
    def flow_accumulation(self,db:Session,payload:FlowAccumulationParams):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"flow_accumulation_{time.time()}.tif"
        return compute_flow_accumulation_task.delay(payload.fill_depressions,payload.algorithm,payload.output_type,payload.log_transform,str(file_path),str(output_path),payload.src_nodata)

    def slope(self,db:Session,payload:SlopeParams):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"slope_{time.time()}.tif"
        return compute_slope_task.delay(str(file_path),str(output_path),payload.units,payload.src_nodata)

    def tpi(self,db:Session,payload:TpiParams):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"tpi_{time.time()}.tif"
        return compute_tpi_task.delay(str(file_path),str(output_path),payload.neighbourhood,payload.radius,payload.src_nodata)

    def twi(self,db:Session,payload:TwiParams):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"twi_{time.time()}.tif"
        return compute_twi_task.delay(str(file_path),str(output_path),payload.algorithm,payload.fill_depressions,payload.src_nodata)

    def test_resolution(self,db:Session,payload:CellResize):
        file_path=self._get_file_path(payload.file_id)
        return dry_run_resample(file_path,payload.target_cell,payload.algorithm)
    
    def execute_resolution(self,db:Session,payload:CellResize):
        file_path=self._get_file_path(payload.file_id)
        output_path = self.temp_dir / f"resolution_{time.time()}.tif"
        return resample_raster_task(str(file_path),str(output_path),payload.target_cell,payload.algorithm)
       

    