from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Annotated,List,Optional,Text


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




class Stp_response(BaseModel):
    id:int
    name:str
    
    
    class Config:
        from_attributes = True

class Stp_town_respons(Stp_response):
    population:int
    subdistrict_code:int


class District_request(BaseModel):
    state:int
    all_data: bool = True
    
    class Config:
        from_attributes = True
    
class Sub_district_request(BaseModel):
    districts:Annotated[List[int],None]
    all_data: bool = True
    
    class Config:
        from_attributes = True




    
class STPRasterInputt(BaseModel):
    id: int
    weight: float

class STPClassification(BaseModel):
    workspace:str
    store:str
    layer_name:str
    
    class Config:
        from_attributes = True

class STP_suitability_Area(BaseModel):
    TREATMENT_TECHNOLOGY:int
    MLD_CAPACITY:float
    CUSTOM_LAND_PER_MLD: float = Field(2.0, le=2) 
    layer_name:str
    
class Raster_operation_input(BaseModel):
    id :int
    file_name: str
    Influence: str
    weight: float  

    class Config:
        from_attributes = True

class GWPL_Table_input(BaseModel):
    location:list
    raster_name:str
    village_list:list
    class Config:
        from_attributes = True

class GWPL_Table_output(BaseModel):
    well_id: str = Field(..., alias="Well_id")
    groundwater_table: float = Field(..., alias="Groundwater table")
    groundwater_trends: float = Field(..., alias="Groundwater trends")
    slope: float = Field(..., alias="Slope")
    specific_yield: float = Field(..., alias="Specific yield")
    slope_per_year: float = Field(..., alias="slope per year")
    rank: int = Field(..., alias="Rank")
    name:str = Field(..., alias="Name")

    class Config:
        from_attributes = True
        populate_by_name = True

class GWPL_output(BaseModel):
    table : List[GWPL_Table_output]
    well_points : list

class STPsuitabilityInput(BaseModel):
    data: List[Raster_operation_input] = None
    clip: List[int] = None
    all_data: bool = True
    place: str = None
    drain_clip:Optional[List[int]]=None
    class Config:
        from_attributes = True



class STPCategory(BaseModel):
    data: List[Raster_operation_input] = None
    clip: List[int] = None
    all_data: bool = True
    place: str = None
    class Config:
        from_attributes = True


class STPPriorityOutput(BaseModel):
    weight: float
    file_name: str
    id: int 
    details:Text

    class Config:
        from_attributes = True

class Stp_Area(BaseModel):
    id: int
    tech_name:str
    tech_value:float

class STPsuitabilityOutput(STPPriorityOutput):
    raster_category: str  

    class Config:
        from_attributes = True
    
class MARsuitabilityOutput(STPsuitabilityOutput):
    needed:str 

    class Config:
        from_attributes = True

class category_raster(BaseModel):
    clip:List[int]=None
    place:str=None

class STPRiverOutput(BaseModel):
    River_Name: str
    River_Code:int

class STPStretchesOutput(BaseModel):
    Stretch_ID: int
    id:int
    river_Code:int

class STPDrainOutput(BaseModel):
    Drain_No: int
    stretch_id:int
    id:int
    River_code:int

class STPDrainNewOutput(BaseModel):
    Drain_No: int
    stretch_id:int
    id:int
    River_code:int
    Name:str
class cachement_village(BaseModel):
    id:int
    village_name:str
    area:float

class STPCatchmentOutput(BaseModel):
    catchments:list[cachement_village]=None
    layer_name:str



class STPStretchesInput(BaseModel):
    river_code: int=None
    all_data: bool = False

class STPDrainInput(BaseModel):
    stretch_ids: Annotated[List[int],None] = None
    all_data: bool = False

class STPCatchmentInput(BaseModel):
    drain_nos: Annotated[List[int],None] = None

class Town_request(BaseModel):
    subdis_code:Annotated[List[int],None] = None
    all_data : bool  = False

class Village_request(BaseModel):
    subdis_code:Annotated[List[int],None] = None
    all_data : bool  = False
    

#----------------------------------------------------------------------------------------
# stp report schema

class celery_id(BaseModel):
    task_id:str

class weight_insight(BaseModel):
        file_name: str
        weight: float

class CsvData(BaseModel):
        High: float
        Low: float
        Medium: float
        Very_High:float
        Very_Low: float
        Village_Name: str

class DataItem(BaseModel):
    file_name: str
    layer_name: str
class StpPriorityAdminReport(BaseModel):

    class LocationData(BaseModel):
        state:str
        districts:list
        subDistricts: list
    table:List[CsvData]
    place: str
    clip: List[int] = None
    raster: List[DataItem] = None
    location: LocationData
    weight_data: List[weight_insight]

class StpPriorityDrainReport(BaseModel):
    
    class LocationData(BaseModel):
        River:str
        Drain: list
        Stretch: list
        Catchment: list
    table:List[CsvData]
    place: str
    clip: List[int] = None
    raster: List[DataItem] = None
    location: LocationData
    weight_data: List[weight_insight]

class StpsuitabilityAdminReport(BaseModel):

    class LocationData(BaseModel):
        state:str
        districts:list
        subDistricts: list
        towns:list
        population:int
        
    table:List[CsvData]
    place: str
    clip: List[int] = None
    raster: List[DataItem] = None
    location: LocationData
    weight_data: List[weight_insight]
    non_weight_data: List[weight_insight]
    
class StpsuitabilityDrainReport(BaseModel):

    class LocationData(BaseModel):
        River:str
        Drain: list
        Stretch: list
        Catchment: list
    table:List[CsvData]
    place: str
    clip: List[int] = None
    raster: List[DataItem] = None
    location: LocationData
    weight_data: List[weight_insight]
    non_weight_data: List[weight_insight]


class Mardetails(BaseModel):
    lat:float
    lon:float

class RasterVisual(BaseModel):
    moduleName:str
    rasterName:str
    fileName:Optional[str]=None    