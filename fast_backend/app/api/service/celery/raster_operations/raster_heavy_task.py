import subprocess
from pathlib import Path
import tempfile
import asyncio
import re
import zipfile
from requests import Session
from app.conf.logging import logger
import json
from typing import Any, Dict, Optional,List
from uuid import uuid4
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from pyproj import CRS as ProjCRS
from app.api.schema.raster_operation import RasterReclassify,ReclassRule, rasterMetaSchame, useroperSchema
from whitebox.whitebox_tools import WhiteboxTools
import math
import os
from app.conf.celery import app
from app.conf.settings import Settings
from app.conf.redis.redis_conf import sync_redis_client
from app.database.config.dependency import celery_session
from app.database.crud.raster_operations import rasterMetacrud, rasterOperCrud, userstorecrud
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.utils.name import Unique_name
import jenkspy

import numpy as np
ALGORITHMS = {
    "nearest": "nearest:radius1=0:radius2=0:angle=0.0:nodata=0.0",
    "invdist": "invdist:power=2.0:smoothing=0.0:radius1=0:radius2=0:angle=0.0:max_points=0:min_points=0:nodata=0.0",
    "invdistnn": "invdistnn:power=2.0:smoothing=0.0:radius=999999999:max_points=12:min_points=0:nodata=0.0", 
    "average": "average:radius1=0:radius2=0:angle=0.0:min_points=0:nodata=0.0",
    "linear": "linear:radius=-1:nodata=0.0",
}



wbt = WhiteboxTools()
wbt.set_whitebox_dir(os.environ["WBT_PATH"])
wbt.set_working_dir("/tmp")

raster_workspace="raster_work"

work_state=["started","in_progress","completed","failed"]

class RasterMetaData:
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
        file_path = Path(file_path)
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
    
    def celery_output(self,db:Session,file_id: str,file_name: str = None, layer_name: str = None, file_path: str = None,compute_stats: bool = True):
        useroperSchemaObj=useroperSchema(
            file_id=file_id,
            layer_name=layer_name,
            file_path=str(file_path),
            file_name=file_name,
            parent_id=None,
            storage_type="operated"
        )
        userstorecrud(db).create_details(useroperSchemaObj)
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

def update_raster_info(file_id: str,file_name: str = None, layer_name: str = None, file_path: str = None,compute_stats: bool = True):
    Rmo=RasterMetaData()
    with celery_session() as session:
        Rmo.celery_output(session,file_id,file_name,layer_name,file_path,compute_stats)
        
        

def celery_task_update(task_id: str, status: str, progress: int=0,layer_name:str = None,result_path:str=None):
    if status =="started":
        with celery_session() as session:
            rasterOperCrud(session).start_task(task_id,task_id)
    else:
        with celery_session() as session:
            rasterOperCrud(session).update_task(task_id,status,layer_name,result_path)
    
    data = {
        "task_id": task_id,
        "status": status,
        "progress": progress,

    }
    payload = json.dumps(data)
    channel = f"opr_updates:{task_id}" 
    sync_redis_client.setex(f"opr_status:{task_id}", 3600, payload)
    sync_redis_client.publish(channel, payload)



def _run_cmd(cmd):
    """Run shell command safely"""
    if isinstance(cmd, list):
        cmd = " ".join(cmd)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Command failed:\n{cmd}\n{result.stderr}")
    return result.stdout

def _get_utm_epsg(lon, lat):
    """Compute UTM EPSG code with input normalization"""
    lon = ((lon + 180) % 360) - 180
    lat = max(-90, min(90, lat))

    zone = int((lon + 180) / 6) + 1
    zone = max(1, min(60, zone))  

    epsg = (32600 + zone) if lat >= 0 else (32700 + zone)
    return epsg
    
def _get_centroid(shp_path):
    
    """Extract centroid (lon, lat) from ogrinfo"""
    cmd = f'ogrinfo -ro -so -al "{shp_path}"'
    output = _run_cmd(cmd)

    match = re.search(r'Extent: \((.*?),(.*?)\) - \((.*?),(.*?)\)', output)
    if not match:
        raise Exception("Could not extract extent")

    xmin, ymin, xmax, ymax = map(float, match.groups())
    lon = (xmin + xmax) / 2
    lat = (ymin + ymax) / 2

    return lon, lat

def _resolve_centroid(shp_path, xmin=None, ymin=None, xmax=None, ymax=None):
    """
    If all extent values are provided, compute centroid from them.
    Otherwise, fall back to extracting centroid from the shapefile.
    """
    if all(v is not None for v in [xmin, ymin, xmax, ymax]):
        lon = (xmin + xmax) / 2
        lat = (ymin + ymax) / 2
        return lon, lat
    return _get_centroid(shp_path)

def _reproject_extent(xmin, ymin, xmax, ymax, src_epsg=4326, dst_epsg=None):
    """Reproject extent corners from src_epsg to dst_epsg using gdaltransform"""
    def transform_point(x, y):
        cmd = f'echo "{x} {y}" | gdaltransform -s_srs EPSG:{src_epsg} -t_srs EPSG:{dst_epsg}'
        result = _run_cmd(cmd)
        parts = result.strip().split()
        return float(parts[0]), float(parts[1])

    x1, y1 = transform_point(xmin, ymin)
    x2, y2 = transform_point(xmax, ymax)

    return min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)

@app.task(bind=True,name='celery_ecluidian_tools',queue='heavy_task')
def celery_euclidean_distance(
    self,
    input_path: str,
    output_path: str,
    xmin: float = None,
    ymin: float = None,
    xmax: float = None,
    ymax: float = None,
):
    celery_task_update(
        task_id=self.request.id,
        status="started",
    )
    try:
        with tempfile.TemporaryDirectory(prefix="ecluidian_") as tmp_dir:
            with zipfile.ZipFile(input_path, 'r') as z:
                z.extractall(tmp_dir)
            shp_path = None

            for root, dirs, files in os.walk(tmp_dir):
                for file in files:
                    if file.lower().endswith(".shp"):
                        shp_path = os.path.join(root, file)
                        break
                if shp_path:
                    break
            lon, lat = _resolve_centroid(shp_path, xmin=xmin, ymin=ymin, xmax=xmax, ymax=ymax)

            epsg = _get_utm_epsg(lon, lat)
            celery_task_update(
                task_id=self.request.id,
                status="running",
                progress=40,
            )
            PROJECTED_SHP = os.path.join(tmp_dir, "projected.shp")
            RASTER_POINTS = os.path.join(tmp_dir, "points.tif")
            PROXIMITY_UTM = os.path.join(tmp_dir, "proximity_utm.tif")

            extent_flag = ""
            if all(v is not None for v in [xmin, ymin, xmax, ymax]):
    
                te_xmin, te_ymin, te_xmax, te_ymax = _reproject_extent(
                    xmin, ymin, xmax, ymax,
                    src_epsg=4326,
                    dst_epsg=epsg        
                )
                extent_flag = f'-te {te_xmin} {te_ymin} {te_xmax} {te_ymax}'
            _run_cmd(f'ogr2ogr -t_srs EPSG:{epsg} "{PROJECTED_SHP}" "{shp_path}"')
            layer_name = os.path.splitext(os.path.basename(PROJECTED_SHP))[0]
            _run_cmd(
                f'gdal_rasterize '
                f'-burn 1 '
                f'-tr 30 30 '
                f'-ot Byte '
                f'-of GTiff '
                f'{extent_flag} '    
                f'-l {layer_name} '
                f'"{PROJECTED_SHP}" "{RASTER_POINTS}"'
            )

            celery_task_update(
                task_id=self.request.id,
                status="running",
                progress=80,
            )
            _run_cmd(
                f'gdal_proximity.py '
                f'"{RASTER_POINTS}" "{PROXIMITY_UTM}" '
                f'-values 1 '
                f'-distunits GEO '
                f'-ot Float32 '
                f'-nodata -9999 '
                f'--config GDAL_CACHEMAX 512'
            )
            _run_cmd(
                f'gdalwarp '
                f'-t_srs EPSG:4326 '
                f'-r bilinear '
                f'-of GTiff '
                f'-dstnodata -9999 '
                f'-overwrite '
                f'"{PROXIMITY_UTM}" "{output_path}"'
            )
            unique_store_name =Unique_name.unique_name("raster_store")
            _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
            file_name=output_path.split("/")[-1].split(".")[0]
            update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
            celery_task_update(
                task_id=self.request.id,
                status="completed",
                progress=100,
                layer_name=layer_name,
                result_path=output_path
            )
    except subprocess.CalledProcessError as e:
        logger.error("GDAL proximity failed")
        logger.error(e.stderr)
        raise RuntimeError(f"GDAL error: {e.stderr}")

    except subprocess.TimeoutExpired:
        logger.error("GDAL proximity timed out")
        raise RuntimeError("Euclidean distance computation timed out")


 
def _get_extent(shp_file: str) -> tuple[float, float, float, float]:
    result = subprocess.run(
        ["ogrinfo", "-ro", "-so", "-al", shp_file],  # added -ro and -al
        capture_output=True, text=True, check=True
    )
    match = re.search(
        r"Extent:\s*\(\s*([\d\.\-]+),\s*([\d\.\-]+)\s*\)"
        r"\s*-\s*\(\s*([\d\.\-]+),\s*([\d\.\-]+)\s*\)",
        result.stdout
    )
    if not match:
        raise ValueError(
            f"Could not extract extent from ogrinfo output.\n{result.stdout}"
        )
    xmin, ymin, xmax, ymax = map(float, match.groups())
    return xmin, ymin, xmax, ymax

@app.task(bind=True,name='celery_interpolation_tools',queue='heavy_task')
def celery_interpolation(
        self,
        input_path: str,
        output_path: str,
        z_field: str,
        algorithm: str,
        xmin: float = None,
        ymin: float = None,
        xmax: float = None,
        ymax: float = None):
    celery_task_update(
        task_id=self.request.id,
        status="started",
    )
    try:
        with tempfile.TemporaryDirectory(prefix="interpolation_") as tmp_dir:
            with zipfile.ZipFile(input_path, 'r') as z:
                z.extractall(tmp_dir)
            shp_path = None
            for root, dirs, files in os.walk(tmp_dir):
                for file in files:
                    if file.lower().endswith(".shp"):
                        shp_path = os.path.join(root, file)
                        break
                if shp_path:
                    break

            algo_str = ALGORITHMS[algorithm]
            lon, lat = _resolve_centroid(shp_path, xmin, ymin, xmax, ymax)
            epsg = _get_utm_epsg(lon, lat)
            PROJECTED_SHP = os.path.join(tmp_dir, "projected.shp")
            _run_cmd(f'ogr2ogr -t_srs EPSG:{epsg} "{PROJECTED_SHP}" "{shp_path}"')

     
            if all(v is not None for v in [xmin, ymin, xmax, ymax]):
                te_xmin, te_ymin, te_xmax, te_ymax = _reproject_extent(
                    xmin, ymin, xmax, ymax, src_epsg=4326, dst_epsg=epsg
                )
            else:
                te_xmin, te_ymin, te_xmax, te_ymax = _get_extent(PROJECTED_SHP)

            celery_task_update(
                task_id=self.request.id,
                status="running",
                progress=40,
            )

            cmd = [
                "gdal_grid",
                "-zfield", z_field,
                "-a", algo_str,
                "-txe", str(te_xmin), str(te_xmax),
                "-tye", str(te_ymin), str(te_ymax),
                "-tr", "30", "30",
                "-a_srs", f"EPSG:{epsg}",   # fix 2: UTM epsg not 4326
                "-of", "GTiff",
                "-ot", "Float32",
                "--config", "GDAL_NUM_THREADS", "ALL_CPUS",
                PROJECTED_SHP,              # fix 3: projected shapefile
                output_path,
            ]
            _run_cmd(" ".join(cmd))

            unique_store_name = Unique_name.unique_name("raster_store")
            _, layer_name = asyncio.run(Geoserver().upload_raster(raster_workspace, store_name=unique_store_name, raster_path=output_path))
            file_name = output_path.split("/")[-1].split(".")[0]
            update_raster_info(file_id=self.request.id, file_name=file_name, layer_name=layer_name, file_path=output_path)
            celery_task_update(
                task_id=self.request.id,
                status="completed",
                progress=100,
                layer_name=layer_name,
                result_path=output_path
            )
    except subprocess.CalledProcessError as e:
        logger.error("GDAL interpolation failed")
        logger.error(e.stderr)
        raise RuntimeError(f"GDAL error: {e.stderr}")

    except subprocess.TimeoutExpired:
        logger.error("GDAL interpolation timed out")
        raise RuntimeError("Interpolation computation timed out")



def _update_stats(nodata_out:float,output_path: str):
    with rasterio.open(output_path, "r+") as ds:
        band = ds.read(1)

        # Mask nodata pixels
        valid = band[band != nodata_out]

        # Compute stats manually
        stats = {
            "STATISTICS_MINIMUM": str(float(valid.min())),
            "STATISTICS_MAXIMUM": str(float(valid.max())),
            "STATISTICS_MEAN":    str(float(valid.mean())),
            "STATISTICS_STDDEV":  str(float(valid.std())),
        }

        ds.update_tags(1, **stats)  
        ds.nodata = nodata_out  

def _reclass_break(method, data, num_classes):
    if method == "quantile":
        return  np.percentile(data, np.linspace(0, 100, num_classes + 1))
    elif method == "equal":
        return np.linspace(data.min(), data.max(), num_classes + 1)
    elif method == "jenks":
        return jenkspy.jenks_breaks(data, n_classes=num_classes)
    

@app.task(bind=True,name='celery_reclassify_tools',queue='heavy_task')
def reclassify_raster(
    self, 
    input_path: str,
    output_path: str,
    method: str,
    classes:int,
    src_nodata: str
):
    celery_task_update(
        task_id=self.request.id,
        status="started",
    )
    with rasterio.open(input_path) as src:
        arr = src.read(1)
        profile = src.profile
        nodata = src.nodata
    if nodata is not None:
        mask = arr != nodata
        data = arr[mask]
    else:
        mask = np.ones_like(arr, dtype=bool)
        data = arr.flatten()
    

    breaks = _reclass_break(method, data, classes)
    nodata_out = -9999
    classified = np.zeros_like(arr, dtype=np.int32)
    celery_task_update(
        task_id=self.request.id,
        status="running",
        progress=40,
    )

    for i in range(classes):
        lower = breaks[i]
        upper = breaks[i + 1]

        if i == classes - 1:
            cond = (arr >= lower) & (arr <= upper)
        else:
            cond = (arr >= lower) & (arr < upper)

        classified[cond] = i + 1

    

    classified[~mask] = nodata_out
    profile.update(dtype=rasterio.int32, count=1, nodata=nodata_out)

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(classified, 1)

    unique_store_name =Unique_name.unique_name("raster_store")
    _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
    file_name=output_path.split("/")[-1].split(".")[0]
    update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
    celery_task_update(
        task_id=self.request.id,
        status="completed",
        progress=100,
        layer_name=layer_name,
        result_path=output_path
    )    


@app.task(bind=True,name='celery_projection_tools',queue='heavy_task')
def celery_reprojection(
    self,
    input_path: str,
    output_path: str,
    target_epsg: str,
    src_nodata: str,
    resampling: str = "near",
):  

    celery_task_update(
        task_id=self.request.id,
        status="started",
    )
    command = [
        "gdalwarp",
        "-t_srs", target_epsg,
        "-r", resampling,

        "-multi",
        "-wo", "NUM_THREADS=2",
        "-wm", "2048",
        "-srcnodata", str(src_nodata),
        "-dstnodata", str(src_nodata),
        "-overwrite",
        str(input_path),
        str(output_path),
    ]
    logger.info(f"Running GDAL command: {' '.join(command)}")
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True
        )

        logger.info("Reprojection completed successfully")
        _update_stats(float(src_nodata), output_path)
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except subprocess.CalledProcessError as e:
        logger.error("GDAL reprojection failed")
        logger.error(e.stderr)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise RuntimeError(f"GDAL error: {e.stderr}")


#-------------------------------------------------------------------------------
# whitebox operations

# class WhiteboxTask(Task):
#     abstract = True
#     _wbt: whitebox.WhiteboxTools | None = None

#     @property
#     def wbt(self) -> whitebox.WhiteboxTools:
#         if self._wbt is None:
#             self._wbt = whitebox.WhiteboxTools()
#             self._wbt.set_verbose_mode(False)
#             self._wbt.set_compress_rasters(True)
#             logger.info("WhiteboxTools initialized [worker pid=%s]", os.getpid())
#         return self._wbt


# @celery_app.task(
#     bind=True,
#     base=WhiteboxTask,
#     name="tasks.compute_flow_direction",
#     max_retries=3,
#     default_retry_delay=5,
# )
# def compute_flow_direction_task(
#     self,
#     params_dict:  dict,
#     input_path:   str,
#     output_path:  str,
# ) -> str:
#     try:
#         params = FlowDirectionParams(**params_dict)

#         input_path, src_nodata = _normalize_nodata(input_path)

#         with tempfile.TemporaryDirectory(prefix="flow_dir_") as tmp_dir:

#             # Fill depressions
#             dem_path = input_path
#             if params.fill_depressions:
#                 dem_path = _fill_depressions(self.wbt, input_path, tmp_dir)

#             # Flow direction
#             _run_flow_direction(
#                 wbt=self.wbt,
#                 dem_path=dem_path,
#                 output_path=output_path,
#                 algorithm=params.algorithm,
#                 max_slope=params.max_slope,
#             )

#         # Fix metadata
#         nodata_val = params.nodata_value if params.nodata_value is not None else FLOW_NODATA
#         _update_stats(nodata_out, output_path)

#         logger.info("Flow direction complete [pid=%s]: %s", os.getpid(), output_path)
#         return output_path

#     except (FileNotFoundError, PermissionError, ValueError) as e:
#         # Non-retryable — bad input
#         logger.error("Flow direction failed (non-retryable): %s", e)
#         raise

#     except RuntimeError as e:
#         # Retryable — WBT process failure
#         logger.warning("Flow direction failed (retryable): %s", e)
#         raise self.retry(exc=e)



def _fill_depressions(input_path: str, tmp_dir: str) -> str:

    filled_path = os.path.join(tmp_dir, "filled_dem.tif")

    logger.info("Filling depressions: %s → %s", input_path, filled_path)

    ret = wbt.fill_depressions(
        dem=input_path,
        output=filled_path,
        fix_flats=True,          # ensures flat areas drain correctly
        flat_increment=None,     # auto
        max_depth=None,          # fill all depressions
    )

    if ret != 0:
        raise RuntimeError(
            f"WhiteboxTools fill_depressions failed (exit {ret}). "
            f"Check logs: {wbt.get_working_directory()}"
        )

    if not os.path.exists(filled_path):
        raise RuntimeError(f"fill_depressions did not produce output: {filled_path}")

    logger.info("Depression filling complete")
    return filled_path

def _run_flow_direction(
    dem_path:   str,
    output_path: str,
    algorithm:  str,
) -> None:
    """Dispatch to correct WhiteboxTools flow direction algorithm."""

    logger.info("Running flow direction [%s]: %s → %s", algorithm, dem_path, output_path)

    if algorithm == "d8":
        ret = wbt.d8_pointer(
            dem=dem_path,
            output=output_path,
        )

    elif algorithm == "dinf":
        ret = wbt.d_inf_pointer(
            dem=dem_path,
            output=output_path,
        )

    elif algorithm == "mfd":
        ret = wbt.quinn_flow_accumulation(   # WBT uses Quinn for MFD
            dem=dem_path,
            output=output_path,
            out_type="catchment area",
        )

    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")

    if ret != 0:
        raise RuntimeError(
            f"WhiteboxTools {algorithm} failed (exit {ret})"
        )

    logger.info("Flow direction complete [%s]", algorithm)


def _run_flow_accumulation(
    dem_path: str,
    output_path: str,
    algorithm: str,
    output_type: str,
    log_transform: bool,
) -> None:

    algorithm = algorithm.lower()

    logger.info(
        "Running flow accumulation [%s]: %s → %s",
        algorithm,
        dem_path,
        output_path,
    )

    if algorithm == "d8":

        ret = wbt.d8_flow_accumulation(
            i=dem_path,
            output=output_path,
            out_type=output_type,
            log=log_transform,
            clip=False,
        )

    elif algorithm == "dinf":

        ret = wbt.d_inf_flow_accumulation(
            i=dem_path,
            output=output_path,
            out_type=output_type,
            log=log_transform,
            clip=False,
        )

    elif algorithm in ("mfd", "quinn"):

        ret = wbt.quinn_flow_accumulation(
            dem=dem_path,
            output=output_path,
            out_type=output_type,
            log=log_transform,
            clip=False,
        )

    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")

    if ret != 0:
        raise RuntimeError(
            f"WhiteboxTools {algorithm} flow accumulation failed (exit {ret})"
        )

    if not os.path.exists(output_path):
        raise RuntimeError(
            f"Flow accumulation did not produce output: {output_path}"
        )

    logger.info("Flow accumulation complete [%s]", algorithm)

def _run_slope(
    dem_path:    str,
    output_path: str,
    units:       str,
) -> None:

    ret = wbt.slope(
        dem=dem_path,
        output=output_path,
        units=units,
        zfactor=None,
    )

    if ret != 0:
        raise RuntimeError(f"WhiteboxTools slope failed (exit {ret})")
    if not os.path.exists(output_path):
        raise RuntimeError(f"Slope did not produce output: {output_path}")

    logger.info("Slope complete")

def _run_tpi(
    dem_path: str,
    output_path: str,
    radius: int,
) -> None:

    filter_size = radius * 2 + 1

    ret = wbt.relative_topographic_position(
        dem=dem_path,
        output=output_path,
        filterx=filter_size,
        filtery=filter_size
    )

    if ret != 0:
        raise RuntimeError(f"TPI failed (exit code {ret})")

    if not os.path.exists(output_path):
        raise RuntimeError("WhiteboxTools produced no output")

    logger.info("TPI calculation completed")

def _run_twi(
    dem_path:    str,
    output_path: str,
    tmp_dir:     str,
    algorithm:   str,
) -> None:
    flow_acc_path = os.path.join(tmp_dir, "flow_acc.tif")
    slope_path    = os.path.join(tmp_dir, "slope_rad.tif")

    # Step 1 — Flow accumulation (catchment area for TWI)
    if algorithm == "d8":
        ret = wbt.d8_flow_accumulation(
            i=dem_path,
            output=flow_acc_path,
            out_type="specific contributing area",
            log=False,
            clip=False,
        )
    elif algorithm == "dinf":
        ret = wbt.d_inf_flow_accumulation(
            i=dem_path,
            output=flow_acc_path,
            out_type="specific contributing area",
            log=False,
            clip=False,
        )
    elif algorithm == "mfd":
        ret = wbt.quinn_flow_accumulation(
            dem=dem_path,
            output=flow_acc_path,
            out_type="specific contributing area",
            log=False,
            clip=False,
        )

    if ret != 0:
        raise RuntimeError(f"Flow accumulation for TWI failed (exit {ret})")

    # Step 2 — Slope in radians
    ret = wbt.slope(
        dem=dem_path,
        output=slope_path,
        units="radians",
        zfactor=None,
    )

    if ret != 0:
        raise RuntimeError(f"Slope for TWI failed (exit {ret})")

    # Step 3 — TWI = ln(sca / tan(slope))
    ret = wbt.wetness_index(
        sca=flow_acc_path,
        slope=slope_path,
        output=output_path,
    )

    if ret != 0:
        raise RuntimeError(f"WhiteboxTools wetness_index failed (exit {ret})")
    if not os.path.exists(output_path):
        raise RuntimeError(f"TWI did not produce output: {output_path}")

    logger.info("TWI complete")

@app.task(bind=True,name='celery_flow_accumulation_tools',queue='heavy_task')
def compute_flow_accumulation_task(
    self,
    fill_depressions: bool,
    algorithm:str,
    output_type: str,
    log_transform: bool,
    input_path:   str,
    output_path:  str,
    src_nodata: str,
) -> str:
    try:
        celery_task_update(
        task_id=self.request.id,
        status="started",
        )

        with tempfile.TemporaryDirectory(prefix="flow_acc_") as tmp_dir:

            # Step 1 — Fill depressions
            dem_path = input_path
            if fill_depressions:
                dem_path = _fill_depressions( input_path, tmp_dir)

            celery_task_update(
            task_id=self.request.id,
            status="running",
            progress=50,
            
            )
            _run_flow_accumulation(
                dem_path=dem_path,
                output_path=output_path,
                algorithm=algorithm,
                output_type=output_type,
                log_transform=log_transform,
            )


        logger.info("Flow accumulation complete [pid=%s]: %s", os.getpid(), output_path)
        
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("Flow accumulation failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise


@app.task(bind=True,name='celery_flow_direction_tools',queue='heavy_task')
def compute_flow_direction_task(
    self,
    input_path:   str,
    output_path:  str,
    algorithm:str,
    fill_depressions: bool,
    src_nodata: str,
    
) -> str:
    celery_task_update(
        task_id=self.request.id,
        status="started",
    )
    try:
        with tempfile.TemporaryDirectory(prefix="flow_dir_") as tmp_dir:
            # Fill depressions
            dem_path = input_path
            if fill_depressions:
                dem_path = _fill_depressions(input_path, tmp_dir)

            celery_task_update(
            task_id=self.request.id,
            status="running",
            progress=40,
            )
            _run_flow_direction(
                dem_path=dem_path,
                output_path=output_path,
                algorithm=algorithm
            )
        celery_task_update(
            task_id=self.request.id,
            status="running",
            progress=70,
           
        )        
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except (FileNotFoundError, PermissionError, ValueError) as e:
        # Non-retryable — bad input
        logger.error("Flow direction failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise

    except RuntimeError as e:
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        logger.warning("Flow direction failed (retryable): %s", e)


@app.task(bind=True,name='celery_slope_task_tools',queue='heavy_task')
def compute_slope_task(
    self,
    input_path:   str,
    output_path:  str,
    units:        str,
    src_nodata: str,
) -> str:
    try:
        celery_task_update(
        task_id=self.request.id,
        status="started",
        )
        _run_slope(
            dem_path=input_path,
            output_path=output_path,
            units=units,
        )
        
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("Slope failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise


@app.task(bind=True,name='celery_tpi_task_tools',queue='heavy_task')
def compute_tpi_task(
        self,
        input_path:   str,
        output_path:  str,
        radius:       int,
        src_nodata: str
) -> str:
    try:
        celery_task_update(
        task_id=self.request.id,
        status="started",
        )
        _run_tpi(
            dem_path=input_path,
            output_path=output_path,
            radius=radius,
        )
       
        
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

        
    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("TPI failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise


@app.task(bind=True,name='celery_twi_task_tools',queue='heavy_task')
def compute_twi_task(
    self,
    input_path:   str,
    output_path:  str,
    algorithm:    str,
    fill_depressions: bool,
    src_nodata: str
) -> str:
    try:
        celery_task_update(
        task_id=self.request.id,
        status="started",
        )
        with tempfile.TemporaryDirectory(prefix="twi_") as tmp_dir:
            dem_path = input_path
            if fill_depressions:
                dem_path = _fill_depressions(input_path, tmp_dir)
            celery_task_update(
            task_id=self.request.id,
            status="running",
            progress=40,
            )
            _run_twi(
                dem_path=dem_path,
                output_path=output_path,
                tmp_dir=tmp_dir,
                algorithm=algorithm,
            )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("TWI failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise


def _run_resample(
    input_path:  str,
    output_path: str,
    cell_size:   float,
    algorithm:   str,
    nodata:      str = None,
) -> None:
    cmd = [
        "gdalwarp",
        "-tr",         str(cell_size), str(cell_size), 
        "-r",          algorithm,                
        "-of",         "GTiff",
        "-overwrite",
    ]

    if nodata is not None:
        cmd += ["-dstnodata", str(nodata)]
        cmd += ["-srcnodata", str(nodata)]
    cmd += [input_path, output_path]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"gdalwarp failed (exit {result.returncode}):\n{result.stderr}"
        )

@app.task(bind=True,name='celery_resample_tools',queue='heavy_task')
def resample_raster_task(
    self,
    input_path:   str,
    output_path:  str,
    cell_size:int,
    algorithm:    str,
    src_nodata: str

) -> str:
    try:
        celery_task_update(
        task_id=self.request.id,
        status="started",
        )
        _run_resample(
            input_path=input_path,
            output_path=output_path,
            cell_size=cell_size,
            algorithm=algorithm,
            nodata=src_nodata,
        )
        
        _update_stats(float(src_nodata),output_path)
        
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        file_name=output_path.split("/")[-1].split(".")[0]
        update_raster_info(file_id=self.request.id,file_name=file_name,layer_name=layer_name,file_path=output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=layer_name,
            result_path=output_path
        )
        

    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("Resample failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise

