import rasterio
import numpy as np
from dataclasses import dataclass
from typing import Optional

@dataclass
class ResampleDryRun:
    # Input info
    input_cell_size:  float
    input_width:      int
    input_height:     int
    input_size_gb:    float

    # Output info
    target_cell_size: float
    output_width:     int
    output_height:    int
    output_size_gb:   float

    # Operation info
    scale_factor:     float
    operation:        str          # "upsample" | "downsample"
    algorithm:        str
    estimated_time_min: float

    # Warnings
    warnings:         list[str]
    is_safe:          bool         # False = block operation
    recommendation:   str


MAX_SAFE_GB      = 2.0   # hard block  # soft warning
MAX_SCALE_FACTOR = 10.0  


# ─────────────────────────────────────────────
# Core dry run
# ─────────────────────────────────────────────

def dry_run_resample(
    input_path:   str,
    target_cell:  float,
    algorithm:    str,
    dtype_override: Optional[str] = None,
) -> ResampleDryRun:
    """
    Estimate output size, scale factor, time and safety
    without performing any actual resampling.
    """

    with rasterio.open(input_path) as ds:
        src_cell_x  = abs(ds.transform.a)
        src_cell_y  = abs(ds.transform.e)
        src_width   = ds.width
        src_height  = ds.height
        dtype       = dtype_override or ds.dtypes[0]
        bands       = ds.count

    # Bytes per pixel
    dtype_bytes = {
        "uint8":   1, "int8":    1,
        "uint16":  2, "int16":   2,
        "uint32":  4, "int32":   4,
        "float32": 4, "float64": 8,
    }
    bytes_per_px = dtype_bytes.get(dtype, 2)

    # Input size
    input_pixels   = src_width * src_height * bands
    input_size_gb  = (input_pixels * bytes_per_px) / (1024 ** 3)

    # Output dimensions
    scale_factor   = src_cell_x / target_cell
    out_width      = int(np.ceil(src_width  * scale_factor))
    out_height     = int(np.ceil(src_height * scale_factor))

    # Output size
    output_pixels  = out_width * out_height * bands
    output_size_gb = (output_pixels * bytes_per_px) / (1024 ** 3)

    # With LZW compression estimate (classified ~60% reduction, continuous ~30%)
    is_classified  = algorithm in ("near", "mode")
    compress_ratio = 0.4 if is_classified else 0.7
    compressed_gb  = output_size_gb * compress_ratio

    # Operation type
    operation = "upsample" if scale_factor > 1 else "downsample"

    # Time estimate (rough: ~1GB/min for gdalwarp with LZW on modern hardware)
    estimated_time_min = compressed_gb / 1.0

    # ── Warnings ──
    warnings     = []
    is_safe      = True
    recommendation = "OK to proceed"

    if output_size_gb > MAX_SAFE_GB:
        is_safe = False
        warnings.append(
            f"Output too large: {output_size_gb:.1f} GB uncompressed "
            f"(limit {MAX_SAFE_GB} GB) — operation blocked"
        )
        recommendation = (
            f"Use an intermediate resolution first. "
            f"e.g. {src_cell_x:.0f}m → {src_cell_x / 3:.0f}m → {target_cell:.0f}m"
        )

    if scale_factor > MAX_SCALE_FACTOR:
        is_safe = False
        warnings.append(
            f"Scale factor too aggressive: {scale_factor:.1f}x "
            f"({src_cell_x:.0f}m → {target_cell:.0f}m) — "
            f"upsampled data will be low quality"
        )
        recommendation = (
            f"Max recommended scale is {MAX_SCALE_FACTOR:.0f}x. "
            f"Consider {src_cell_x / MAX_SCALE_FACTOR:.0f}m as target."
        )

    if operation == "upsample" and algorithm not in ("near", "bilinear", "cubic", "cubicspline"):
        warnings.append(
            f"Algorithm '{algorithm}' is not recommended for upsampling"
        )

    if not warnings:
        recommendation = (
            f"Safe to proceed. "
            f"Estimated output: ~{compressed_gb:.2f} GB compressed, "
            f"~{estimated_time_min:.1f} min"
        )

    return ResampleDryRun(
        input_cell_size   = src_cell_x,
        input_width       = src_width,
        input_height      = src_height,
        input_size_gb     = input_size_gb,
        target_cell_size  = target_cell,
        output_width      = out_width,
        output_height     = out_height,
        output_size_gb    = output_size_gb,
        scale_factor      = scale_factor,
        operation         = operation,
        algorithm         = algorithm,
        estimated_time_min = estimated_time_min,
        warnings          = warnings,
        is_safe           = is_safe,
        recommendation    = recommendation,
    )