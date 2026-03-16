from datetime import datetime

from pydantic import BaseModel,model_validator, Field
from typing import Literal,Optional,List,Dict
import numpy as np
DTYPE_MAP: dict = {
    "byte":    (int,   np.uint8),
    "int16":   (int,   np.int16),
    "uint16":  (int,   np.uint16),
    "int32":   (int,   np.int32),
    "uint32":  (int,   np.uint32),
    "float32": (float, np.float32),
    "float64": (float, np.float64),
}
RasterType = Literal["byte", "int16", "uint16", "int32", "uint32", "float32", "float64"]
SlopeUnits = Literal["degrees", "radians", "percent"]
TpiNeighbourhood = Literal["circle", "rectangle"]
FlowAlgorithm = Literal["d8", "dinf", "mfd"]
OutputType = Literal["cells", "catchment area", "specific contributing area"]
cell_resize_algorithms = Literal["near","bilinear","cubic","cubicspline","lanczos","average","mode"]

class RasterReproject(BaseModel):
    file_id: str
    src_nodata: str
    target_epsg: str
    resampling: Literal["near", "bilinear", "cubic"]

def cast_to_dtype(value: str, dtype: str):
    """Convert string → correct numpy scalar for the given dtype."""
    py_type, np_type = DTYPE_MAP[dtype]

    try:
        parsed = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"Cannot parse '{value}' as a number")

    if py_type is int:
        if not parsed.is_integer():
            raise ValueError(
                f"dtype '{dtype}' is integer but got non-integer value '{value}'"
            )
        parsed = int(parsed)

    info = np.iinfo(np_type) if py_type is int else np.finfo(np_type)
    if not (info.min <= parsed <= info.max):
        raise ValueError(
            f"Value {parsed} out of range for '{dtype}' ({info.min} to {info.max})"
        )

    return np_type(parsed)

class ReclassRule(BaseModel):
    min:       Optional[str] = None
    max:       Optional[str] = None
    value:     Optional[str] = None
    new_value: str

    # Populated after casting — these are what your service actually uses
    min_cast:       Optional[float | int] = None
    max_cast:       Optional[float | int] = None
    value_cast:     Optional[float | int] = None
    new_value_cast: Optional[float | int] = None

    @model_validator(mode="after")
    def check_rule_structure(self):
        has_range = self.min is not None or self.max is not None
        has_exact = self.value is not None

        if has_exact and has_range:
            raise ValueError("Use 'value' (exact match) OR 'min'/'max' (range), not both")
        if not has_exact and not has_range:
            raise ValueError("Each rule needs 'value' or at least one of 'min'/'max'")
        return self

    def apply_dtype(self, dtype: str, rule_index: int):
        """Cast all string fields to the correct numpy type. Called by the parent model."""
        prefix = f"Rule #{rule_index}"
        try:
            self.min_cast       = cast_to_dtype(self.min,       dtype) if self.min       is not None else None
            self.max_cast       = cast_to_dtype(self.max,       dtype) if self.max       is not None else None
            self.value_cast     = cast_to_dtype(self.value,     dtype) if self.value     is not None else None
            self.new_value_cast = cast_to_dtype(self.new_value, dtype)
        except ValueError as e:
            raise ValueError(f"{prefix}: {e}") from e


class RasterReclassify(BaseModel):
    file_id:      str
    raster_type:  RasterType
    rules:        List[ReclassRule]
    nodata_value: Optional[str] = None

    # Populated after casting
    nodata_cast: Optional[float | int] = None

    @model_validator(mode="after")
    def cast_all(self):
        if not self.rules:
            raise ValueError("At least one rule is required")

        dtype = self.raster_type

        # Cast every rule in-place
        for i, rule in enumerate(self.rules, start=1):
            rule.apply_dtype(dtype, i)

        # Cast nodata
        if self.nodata_value is not None:
            try:
                self.nodata_cast = cast_to_dtype(self.nodata_value, dtype)
            except ValueError as e:
                raise ValueError(f"nodata_value: {e}") from e

        return self
    
class Edliudian(BaseModel):
    file_id: str
    distance_units: str = "GEO"
    target_values: Optional[List[int]] = None
    max_distance: Optional[float] = None
    src_nodata: str
    


class FlowDirectionParams(BaseModel):
    file_id:        str
    algorithm:      FlowAlgorithm = "d8"
    fill_depressions: bool        = True
    src_nodata: str

    # @model_validator(mode="after")
    # def validate_params(self):
    #     if self.max_slope is not None and self.algorithm == "d8":
    #         raise ValueError("max_slope is only valid for 'dinf' or 'mfd' algorithms")
    #     return self
    

FLOW_ACC_NODATA = -1.0


class FlowAccumulationParams(BaseModel):
    file_id:          str
    algorithm:         FlowAlgorithm = "d8"
    output_type:      OutputType                = "cells"
    fill_depressions: bool                      = True
    log_transform:    bool                      = False  
    src_nodata: str
    @model_validator(mode="after")
    def validate_params(self):
        if self.output_type == "specific contributing area" and self.algorithm == "d8":
            raise ValueError(
                "'specific contributing area' is only valid for 'dinf' or 'mfd'"
            )
        return self


class SLDUpdate(BaseModel):
    sld: str
    layername: str



class SlopeParams(BaseModel):
    file_id:     str
    units:       SlopeUnits    = "degrees"
    src_nodata: str


class TpiParams(BaseModel):
    file_id:          str
    radius:           int              = 3      
    src_nodata: str
    @model_validator(mode="after")
    def validate_radius(self):
        if self.radius < 1:
            raise ValueError("radius must be >= 1")
        if self.radius >500:
            raise ValueError("radius must be <= 500")
        return self


class TwiParams(BaseModel):
    file_id:          str
    fill_depressions: bool           = True
    algorithm:        FlowAlgorithm = "d8"
    src_nodata: str



class CellResize(BaseModel):
    file_id:      str
    target_cell:  int
    algorithm:    cell_resize_algorithms="near"
    dtype_override: Optional[RasterType] = "float32"
    src_nodata: str

    @model_validator(mode="after")
    def validate_params(self):
        if self.target_cell < 1 :
            raise ValueError("target_cell must be >= 1")
        return self


class FileSize(BaseModel):
    value: float = Field(..., description="File size numeric value")
    unit: str = Field(..., description="Unit of file size (e.g., MB, GB)")


class Bounds(BaseModel):
    west: float
    south: float
    east: float
    north: float
    unit: str = Field(..., description="Unit of bounds (metre or degree)")


class ResolutionValue(BaseModel):
    value: float
    unit: str


class Resolution(BaseModel):
    x: ResolutionValue
    y: ResolutionValue


class BandStatistics(BaseModel):
    band_number: int
    dtype: str
    color_interpretation: str
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    std: Optional[float] = None


# raster data info schema 
class RasterdataResponse(BaseModel):
    file_name: str
    file_id: str
    layer_name: str
    raster_type: str #uploaded or operated
    modified_at: datetime
    id: int
    parent_id: int|None


class RasterMetadataResponse(BaseModel):
    file_size: FileSize
    driver: str
    width: int
    height: int
    band_count: int
    dtypes: str
    nodata: Optional[float] = None
    crs: str
    crs_unit: str

    bounds: Bounds
    bounds_wgs84: Bounds

    resolution: Resolution

    compression: Optional[str] = None
    is_tiled: bool
    block_shapes: List[List[int]]
    is_cog_like: bool
    bands: List[BandStatistics]
    tags: Dict[str, str]


class RasterInfoResponse(BaseModel):
    raster_info:RasterdataResponse 
    raster_meta:RasterMetadataResponse 
    
class RasterOperOutput(BaseModel):
    file_id: str
    task_name: str
    task_status: str
    layer_name: str

class RasterUploadResponse(BaseModel):
    file_id:str
    layer_name: str
    file_name:str

    

class Chunkcomplete(BaseModel):
    upload_id: str
    total_chunks: int
    filename: str

class rasteroperSchema(BaseModel):
    file_id:str
    file_name:str
    file_path:str
    layer_name: str
    parent_id: int | None
    raster_type: str  # uploaded or operated

class rasterMetaSchame(BaseModel):
    file_id:str
    driver: str
    width: int
    height: int
    band_count: int

    dtypes: str
    nodata: float|None = None
    crs: str
    crs_unit: str

    compression: str | None = None
    is_tiled: bool
    block_shapes: list
    is_cog_like: bool
    file_size: dict
    bounds: dict
    bounds_wgs84: dict
    resolution: dict
    bands: list
    tags: dict