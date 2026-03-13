from typing import List, Optional, Union

from pydantic import BaseModel


class SubbasinMapRequest(BaseModel):
    subbasin_ids: List[int]


class FlowDurationRequest(BaseModel):
    subs: List[int]


class SurfaceWaterRequest(BaseModel):
    subbasins: Union[List[int], int, str]


class EflowRequest(BaseModel):
    sub_ids: List[int]


class ClimateRequest(BaseModel):
    sub_ids: List[int]
    scenario: int = 585
    year: Optional[int] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class ClimateComparisonRequest(BaseModel):
    sub_ids: List[int]
    scenarios: List[int] = [126, 245, 370, 585]
    start_year: int = 2021
    end_year: Optional[int] = None


class AdminFdcRequest(BaseModel):
    subdistrict_codes: Optional[Union[List[int], str]] = None
    vlcode: Optional[Union[List[int], int, str]] = None


class AdminFdcImageRequest(BaseModel):
    vlcode: Union[int, str]


class AdminSurfaceWaterRequest(BaseModel):
    subdistrict_codes: Optional[Union[List[int], str]] = None
    vlcode: Optional[Union[List[int], int, str]] = None


class AdminSurfaceWaterImageRequest(BaseModel):
    subdistrict_codes: Optional[Union[List[int], str]] = None
    vlcode: Optional[Union[int, str]] = None


class AdminEflowRequest(BaseModel):
    subdistrict_codes: Optional[List[int]] = None
    vlcodes: Optional[List[int]] = None


class AdminEflowImageRequest(BaseModel):
    vlcode: int
    method_key: str


class AdminClimateRequest(BaseModel):
    subdistrict_codes: Optional[List[int]] = None
    vlcodes: Optional[List[int]] = None
    source_id: int
    start_year: int = 2021
    end_year: Optional[int] = None


class AdminClimateImageRequest(BaseModel):
    vlcode: int
    source_id: int
    start_year: int = 2021
    end_year: Optional[int] = None
