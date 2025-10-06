from pydantic import BaseModel,Field
from typing import Annotated,List,Optional


class Stp_response(BaseModel):
    id:int
    name:str
    
    class Config:
        from_attributes = True

class Stp_town_respons(Stp_response):
    population:int
    classs :int

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
    class Config:
        from_attributes = True
    
class STPsuitabilityInput(BaseModel):
    data: List[Raster_operation_input] = None
    clip: List[int] = None
    all_data: bool = True
    place: str = None
    drain_clip:Optional[List[int]]=None
    class Config:
        from_attributes = True

class STPPriorityInput(BaseModel):
    file_name: str
    weight: float


class STPCategory(BaseModel):
    data: List[STPPriorityInput] = None
    clip: List[int] = None
    all_data: bool = True
    place: str = None
    class Config:
        from_attributes = True


class STPPriorityOutput(BaseModel):
    weight: float
    file_name: str
    id: int 

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
    data:list[cachement_village]=None
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