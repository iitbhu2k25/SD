from pydantic import BaseModel,Field
class Well_input(BaseModel):
    subdis_cod:list
    year:int

class Well_response(BaseModel):
    carbonate:float
    calcium: float
    bicarbonate: float
    magnesium: float
    Location: str
    chloride: float
    sodium: float
    year: int
    Longitude: float
    fluoride: float
    potassium: float
    sulfate: float
    iron: float
    Latitude: float
    nitrate: float
    arsenic: float
    ph_level: float
    phosphate: float
    uranium: float
    electrical_conductivity: float
    Hardness: float