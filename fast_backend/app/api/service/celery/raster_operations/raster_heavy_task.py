import subprocess
from pathlib import Path
import tempfile
import asyncio
from app.conf.logging import logger
import json
from typing import Optional,List
from uuid import uuid4
import numpy as np
import rasterio
from app.api.schema.raster_operation import RasterReclassify,ReclassRule
from whitebox.whitebox_tools import WhiteboxTools
import time
import os
from app.conf.celery import app
from app.conf.settings import Settings
from app.conf.redis.redis_conf import sync_redis_client
from app.database.config.dependency import celery_session
from app.database.crud.raster_operations import rasterOperCrud
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.utils.name import Unique_name

wbt = WhiteboxTools()
wbt.set_whitebox_dir(os.environ["WBT_PATH"])
wbt.set_working_dir("/tmp")

raster_workspace="raster_work"
raster_default_sld="/home/app/media/Rajat_data/default_sld.xml"

work_state=["started","in_progress","completed","failed"]


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


def _detect_raster_type(input_path: str, sample_size: int = 500000) -> str:
    input_path = Path(input_path)
    result = subprocess.run(
        ["gdalinfo", "-json", str(input_path)],
        capture_output=True,
        text=True,
        check=True,
    )

    metadata = json.loads(result.stdout)
    band = metadata["bands"][0]

    representation = band.get("metadata", {}).get("", {}).get("RepresentationType")
    dtype = band.get("type")
    if representation:
        if "THEMATIC" in representation.upper():
            return "classified"
        if "ATHEMATIC" in representation.upper():
            return "continuous"

    if dtype in ("Float32", "Float64"):
        return "continuous"

    
    with rasterio.open(input_path) as src:
        band1 = src.read(1, masked=True)

   
        values = band1.compressed()

        if len(values) > sample_size:
            values = np.random.choice(values, sample_size, replace=False)

        unique_count = len(np.unique(values))


    if unique_count < 50:
        return "classified"

    return "continuous"


def _normalize_nodata(input_path: str):
    input_path = Path(input_path)
    output_path = input_path.parent / f"{uuid4()}.tif"

    if not input_path.exists():
        raise FileNotFoundError(f"Input raster not found: {input_path}")

    result = subprocess.run(
        ["gdalinfo", "-json", str(input_path)],
        capture_output=True,
        text=True,
        check=True
    )

    metadata = json.loads(result.stdout)
    band = metadata["bands"][0]

    current_nodata = band.get("noDataValue", None)
    dtype = band.get("type")

    logger.info(f"Detected dtype: {dtype}")
    logger.info(f"Detected nodata: {current_nodata}")

    if dtype in ("Float32", "Float64"):
        standard_nodata = -9999.0
        extreme_threshold = -1e30  # catch float32 min
    elif dtype in ("Int16", "Int32"):
        standard_nodata = -9999
        extreme_threshold = None
    elif dtype in ("Byte", "UInt16"):
        standard_nodata = 0
        extreme_threshold = None
    else:
        standard_nodata = -9999
        extreme_threshold = None

    if current_nodata is None:
        logger.info("NoData not defined. Assigning standard nodata.")
        command = [
            "gdal_translate",
            "-a_nodata", str(standard_nodata),
            "-co", "COMPRESS=LZW",
            "-co", "TILED=YES",
            "-co", "BIGTIFF=YES",
            str(input_path),
            str(output_path),
        ]
        subprocess.run(command, check=True)
        return str(output_path),str(standard_nodata)


    if current_nodata == standard_nodata:
        logger.info("NoData already standardized.")
        return str(input_path),str(standard_nodata)

    logger.info(
        f"Replacing NoData values: {current_nodata} → {standard_nodata}"
    )

    if dtype in ("Float32", "Float64"):
        # Catch both exact nodata and extreme float contamination
        calc_expr = (
            f"where((A=={current_nodata}) | (A<{extreme_threshold}), "
            f"{standard_nodata}, A)"
        )
    else:
        calc_expr = f"where(A=={current_nodata}, {standard_nodata}, A)"

    command = [
        "gdal_calc.py",
        "-A", str(input_path),
        "--outfile", str(output_path),
        "--calc", calc_expr,
        "--NoDataValue", str(standard_nodata),
        "--type", dtype,
        "--co", "COMPRESS=LZW",
        "--co", "TILED=YES",
        "--co", "BIGTIFF=YES",
    ]

    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        logger.info("NoData normalization completed successfully")
        return str(output_path),str(standard_nodata)

    except subprocess.CalledProcessError as e:
        logger.error("Failed to normalize NoData")
        logger.error(e.stderr)
        raise RuntimeError(f"GDAL error: {e.stderr}")



# -------------------------------------

def _get_best_crs_for_india(input_path: str) -> str:
    """Determine best CRS (UTM or EPSG:7755) based on raster extent."""

    result = subprocess.run(
        ["gdalinfo", "-json", input_path],
        capture_output=True,
        text=True,
        check=True,
    )

    metadata = json.loads(result.stdout)

    if "wgs84Extent" not in metadata:
        raise ValueError("Unable to detect raster geographic extent.")

    coords = metadata["wgs84Extent"]["coordinates"][0]
    longitudes = [pt[0] for pt in coords]

    min_lon = min(longitudes)
    max_lon = max(longitudes)
    lon_span = max_lon - min_lon

    # Multi-zone India coverage
    if lon_span > 6:
        return "EPSG:7755"

    centroid_lon = (min_lon + max_lon) / 2
    zone = int((centroid_lon + 180) / 6) + 1
    return f"EPSG:326{zone}"

def _get_current_epsg(input_path: str) -> Optional[str]:
    with rasterio.open(input_path) as src:
        if src.crs and src.crs.to_epsg():
            return f"EPSG:{src.crs.to_epsg()}"
    return None

def celery_euclidean_distance(
    input_path: str,
    output_path: str,
    target_values: Optional[List[int]] = None,
    max_distance: Optional[float] = None,
    distance_units: str = "GEO",
    timeout: int = 3600,
):
    
    input_path = Path(input_path)
    output_path = Path(output_path)

    if distance_units not in ("GEO", "PIXEL"):
        raise ValueError("distance_units must be 'GEO' or 'PIXEL'")
    best_crs = _get_best_crs_for_india(str(input_path))
    current_epsg = _get_current_epsg(str(input_path))

    working_input = input_path
    if distance_units == "GEO":
        if current_epsg != best_crs.replace("EPSG:", ""):
            reprojected_path = input_path.parent / f"{uuid4()}ecludian_proj.tif"
            celery_reprojection(input_path,reprojected_path,best_crs)
            working_input = reprojected_path

    command = [
        "gdal_proximity.py",
        str(working_input),
        str(output_path),
        "-distunits", distance_units,
        "-ot", "Float32",
        "-co", "COMPRESS=LZW",
        "-co", "TILED=YES",
        "-co", "BIGTIFF=YES",
        "-nodata", str("nodata_value"),
    ]

    if target_values:
        values_str = ",".join(map(str, target_values))
        command += ["-values", values_str]

    if max_distance and max_distance > 0:
        command += ["-maxdist", str(max_distance)]

    logger.info(f"Running GDAL proximity: {' '.join(command)}")

    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        logger.info("Euclidean distance completed successfully")

        # Cleanup temporary reprojection
        if working_input != input_path:
            working_input.unlink(missing_ok=True)

        return str(output_path)

    except subprocess.CalledProcessError as e:
        logger.error("GDAL proximity failed")
        logger.error(e.stderr)
        raise RuntimeError(f"GDAL error: {e.stderr}")

    except subprocess.TimeoutExpired:
        logger.error("GDAL proximity timed out")
        raise RuntimeError("Euclidean distance computation timed out")

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


def _infer_output_type(rules: List[ReclassRule], nodata_out: float) -> str:
    all_values = [r.new_value_cast for r in rules if r.new_value_cast is not None]

    if not all_values:
        return "Int16"

    if any(isinstance(v, float) and not float(v).is_integer() for v in all_values):
        return "Float32"

    # Include nodata in range check so output type can always represent it
    all_values_with_nodata = all_values + [nodata_out]

    max_val = max(abs(v) for v in all_values_with_nodata)
    all_non_negative = all(v >= 0 for v in all_values_with_nodata)

    if max_val <= 255 and all_non_negative:
        return "Byte"

    if max_val <= 32767:
        return "Int16"

    return "Int32"

def _build_calc_expression(rules: List[ReclassRule], nodata_val: float) -> str:
    expr = str(nodata_val)

    for rule in reversed(rules):

        # Base condition: always exclude NoData pixels first
        nodata_guard = f"(A!={nodata_val})"

        if rule.value is not None:
            condition = f"({nodata_guard}&(A=={rule.value}))"

        else:
            parts = [nodata_guard]
            if rule.min is not None:
                parts.append(f"(A>={rule.min})")
            if rule.max is not None:
                parts.append(f"(A<{rule.max})")
            # No min/max = catch-all, but still guarded by nodata
            condition = "&".join(parts)

        expr = f"where({condition}, {rule.new_value}, {expr})"

    return expr

def reclassify_raster(params: RasterReclassify, input_path: str, output_path: str):

    input_path, src_nodata = _normalize_nodata(input_path)

    nodata_out = (
    params.nodata_cast if params.nodata_value is not None
    else (src_nodata   if src_nodata          is not None
    else -9999.0)
    )

    out_type = _infer_output_type(params.rules, nodata_out)
    expression = _build_calc_expression(params.rules, nodata_out)


    cmd = [
        "gdal_calc.py",
        "-A", input_path,
        "--outfile",     output_path,
        "--calc",        expression,
        "--NoDataValue", str(nodata_out),
        "--type",        out_type,
        "--format",      "GTiff",
        "--co",          "COMPRESS=LZW",
        "--co",          "TILED=YES",
        "--overwrite",
        "--quiet",
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"gdal_calc.py failed (exit {result.returncode}):\n{result.stderr}"
        )

    _update_stats(nodata_out, output_path)
    return output_path


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
        logger.debug(result.stdout)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

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

    logger.info("TPI calculation finished")

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

        _update_stats(float(src_nodata),output_path)

        logger.info("Flow accumulation complete [pid=%s]: %s", os.getpid(), output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

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
        _update_stats(float(src_nodata),output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

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
        _update_stats(float(src_nodata),output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

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
        _update_stats(float(src_nodata), output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

        
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

        _update_stats(float(src_nodata),output_path)
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

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
        celery_task_update(
            task_id=self.request.id,
            status="completed",
            progress=100,
            layer_name=self.request.id,
            result_path=output_path
        )
        unique_store_name =Unique_name.unique_name("raster_store")
        _,layer_name=asyncio.run(Geoserver().upload_raster(raster_workspace,store_name=unique_store_name,raster_path=output_path))
        asyncio.run(Geoserver().apply_sld_to_layer(raster_workspace,layer_name,raster_default_sld))

    except (FileNotFoundError, PermissionError, ValueError) as e:
        logger.error("Resample failed (non-retryable): %s", e)
        celery_task_update(
            task_id=self.request.id,
            status="failed",
        )
        raise

