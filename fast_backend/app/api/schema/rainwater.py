from pydantic import BaseModel
from typing import Annotated,List,Optional


class Rainwater(BaseModel):
    layer_class:str
    district_id:int
    subdistrict_id:List[int]
    month: Optional[str] = None

class GeoJSONInput(BaseModel):
    coordinates: List[List[float]]
    layer_class: str
    # layer_month: str
    month: Optional[str] = None