from pydantic import BaseModel
from typing import Optional


class BlocksByDistrictRequest(BaseModel):
    districtcodes: list[int]


class VillagesByBlockRequest(BaseModel):
    blockcodes: list[int]


class QuantificationRequest(BaseModel):
    year: str          # e.g. "2022 - 23"
    vlcodes: list[int]


# --- Response schemas ---

class BlockResponse(BaseModel):
    block: str
    blockcode: int
    district: str

    model_config = {"from_attributes": True}


class VillageResponse(BaseModel):
    vlcode: int
    village: str

    model_config = {"from_attributes": True}


class GroundWaterDataSchema(BaseModel):
    id: int
    village_co: int
    block_code: int
    district_code: Optional[float] = None
    subdistrict_code: Optional[float] = None
    year: str
    factor: Optional[float] = None
    village_area: Optional[float] = None
    block_area: Optional[float] = None
    total_geographical_area: Optional[float] = None
    recharge_worthy_area: Optional[float] = None
    recharge_rainfall_mon: Optional[float] = None
    recharge_other_mon: Optional[float] = None
    recharge_rainfall_nm: Optional[float] = None
    recharge_other_nm: Optional[float] = None
    total_annual_recharge: Optional[float] = None
    total_natural_discharge: Optional[float] = None
    extractable_resource: Optional[float] = None
    irrigation_use: Optional[float] = None
    industrial_use: Optional[float] = None
    domestic_use: Optional[float] = None
    total_extraction: Optional[float] = None
    annual_gw_allocation_domestic: Optional[float] = None
    net_future_availability: Optional[float] = None
    bo_aquifer: Optional[float] = None
    stage_of_extraction: Optional[str] = None
    category: Optional[str] = None

    model_config = {"from_attributes": True}
