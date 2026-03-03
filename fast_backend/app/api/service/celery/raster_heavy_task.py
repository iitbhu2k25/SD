import subprocess
from pathlib import Path
from app.conf.logging import logger
import json
from typing import Optional,List
from uuid import uuid4
import numpy as np
import rasterio
from app.api.schema.raster_operation import RasterReclassify,ReclassRule

def _remove_duplicate(file_path: str):
    path = Path(file_path)
    if path.exists() and path.is_file():
        path.unlink()
        logger.info(f"Removed existing file: {file_path}")

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


def _normalize_nodata(input_path: str) -> str:
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

def celery_reprojection(
    input_path: str,
    output_path: str,
    target_epsg: str,
    resampling: str = "near",
):
   
    input_path,src_nodata= _normalize_nodata(input_path)
    input_path = Path(input_path)
    output_path = Path(output_path)

    
    command = [
        "gdalwarp",
        "-t_srs", target_epsg,
        "-r", resampling,

        "-multi",
        "-wo", "NUM_THREADS=2",
        "-wm", "2048",

        "-srcnodata", str(src_nodata),
        "-dstnodata", str(src_nodata),

        "-co", "COMPRESS=LZW",
        "-co", "TILED=YES",
        "-co", "BIGTIFF=YES",

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

        return str(output_path)

    except subprocess.CalledProcessError as e:
        logger.error("GDAL reprojection failed")
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
    input_path,nodata_value = _normalize_nodata(input_path)
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
        "-nodata", str(nodata_value),
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

def _update_stats(nodata_out,output_path: str, ):
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

        ds.update_tags(1, **stats)  # write to band metadata
        ds.nodata = nodata_out      # ensure nodata is set


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