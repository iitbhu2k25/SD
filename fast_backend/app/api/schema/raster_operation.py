from pydantic import BaseModel,model_validator
from typing import Literal,Optional,List
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

class RasterReproject(BaseModel):
    file_id: str
    target_epsg: Literal["EPSG:32644", "EPSG:4326", "EPSG:3857"]
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
    