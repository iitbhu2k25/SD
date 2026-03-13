from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional

class WaterAdminLocationInput(BaseModel):
    """
    Input schema for water availability processing.
    
    For seasonal requests: season is required
    For yearly requests: season must be None or empty
    """
    subdistrict_codes: List[int] = Field(..., min_length=1)
    year: List[int] = Field(..., description="List of years to process")
    season: Optional[str] = Field(None, description="Season name (required for seasonal, null for yearly)")
    product_type: str = Field(..., description="Water Budget, Surplus, Deficit, or Index")
    time_scale: str = Field(..., description="seasonal or yearly")
    
    @field_validator('product_type')
    @classmethod
    def validate_product_type(cls, v):
        allowed = ['Water Budget', 'Surplus', 'Deficit', 'Index']
        if v not in allowed:
            raise ValueError(f'product_type must be one of: {", ".join(allowed)}')
        return v
    
    @field_validator('time_scale')
    @classmethod
    def validate_time_scale(cls, v):
        if v not in ['seasonal', 'yearly']:
            raise ValueError('time_scale must be "seasonal" or "yearly"')
        return v
    
    @model_validator(mode='after')
    def validate_season_based_on_time_scale(self):
        """Ensure season is provided for seasonal, convert 'Yearly' to None for yearly"""
        if self.time_scale == 'seasonal':
            if not self.season or self.season.strip() == '':
                raise ValueError('season is required when time_scale is "seasonal"')
            allowed_seasons = ['Monsoon', 'Post-Monsoon', 'Pre-Monsoon', 'Winter']
            if self.season not in allowed_seasons:
                raise ValueError(f'season must be one of: {", ".join(allowed_seasons)}')
        
        elif self.time_scale == 'yearly':
            # ✅ Accept "Yearly" string and convert to None
            if self.season and self.season.strip().lower() == 'yearly':
                self.season = None
            elif self.season is not None and self.season.strip() != '':
                raise ValueError('season must be null, empty, or "Yearly" when time_scale is "yearly"')
        
        return self
    
    class Config:
        from_attributes = True


class WaterAdminLocationOutput(BaseModel):
    """Output schema for processed water layers"""
    status: str
    study_area_vector: dict
    clipped_rasters: List[dict]
    metadata: dict
    
    class Config:
        from_attributes = True
        
        
class StretchesOutput(BaseModel):
    stretch_ids: List[int]

class DrainOutput(BaseModel):
    drains: List[int]   
    
class StretchesInput(BaseModel):
    river_code: int

class DrainInput(BaseModel):
    stretch_id: int
    
    
class WaterDrainLocationInput(BaseModel):
    drain_no: int  # or List[str] if Drain_No is alphanumeric
    time_scale: str
    year: List[int]
    season: Optional[str] = None
    product_type: str