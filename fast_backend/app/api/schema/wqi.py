
from typing import List
from pydantic import BaseModel, field_validator, model_validator
class Well_input(BaseModel):
    location:list
    year:int
    place:str

class Well_response(BaseModel):
    Carbonate:float
    Calcium: float
    Bicarbonate: float
    Magnesium: float
    Location: str
    Chloride: float
    Sodium: float
    Year: int
    Longitude: float
    Fluoride: float
    Potassium: float
    Sulfate: float
    Iron: float
    Latitude: float
    Nitrate: float
    Arsenic: float
    pH_Level: float
    Uranium: float
    Electrical_Conductivity: float
    Hardness: float

class WQIOperation(BaseModel):
    data:List[Well_response]
    params:List[str]
    location:list
    place:str
    @model_validator(mode="after")
    def inserting(self):
        self.params.extend(["Longitude", "Latitude"])
        return self
