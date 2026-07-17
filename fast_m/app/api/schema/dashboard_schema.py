from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class DrainWaterQualityOut(BaseModel):
    id: int
    location: str
    ph: float
    temp: float
    ec_us_cm: float
    tds_ppm: float
    do_mg_l: float
    turbidity: float
    tss_mg_l: float
    cod: float
    bod_mg_l: float
    ts_mg_l: float
    chloride: float
    nitrate: Optional[float] = None
    faecal_col: Optional[str] = None
    total_col: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    stream: Optional[str] = None
    observation: Optional[str] = None
    remarks: Optional[str] = None
    sampling_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class StoryMapStationOut(BaseModel):
    id: str
    location: str
    image: str
    lat: float
    lon: float
    description: str
    remarks: Optional[str] = None
    other: Optional[str] = None

    class Config:
        from_attributes = True


class StoryMapStationsResponse(BaseModel):
    status: str
    count: int
    stations: list[StoryMapStationOut]


class StoryMapStatisticsResponse(BaseModel):
    status: str
    statistics: dict[str, Any]


class DashboardDepthOut(BaseModel):
    id: int
    district: str
    year: int
    season: str
    depth_m: float
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DashboardRainfallOut(BaseModel):
    id: int
    district: str
    year: int
    annual_rainfall: float
    observation: Optional[str] = None

    class Config:
        from_attributes = True


class DashboardDistributionOut(BaseModel):
    id: int
    year: str
    category: str
    percentage: float
    observation: Optional[str] = None

    class Config:
        from_attributes = True


class DashboardIndustrialPollutionOut(BaseModel):
    id: int
    district: str
    category: str
    pollution_index: Optional[str] = None
    observation: Optional[str] = None

    class Config:
        from_attributes = True


class SewageLayerInfo(BaseModel):
    id: str
    name: str
    display_name: str
    color: str
    available: bool
    path: Optional[str] = None


class SewageLayersResponse(BaseModel):
    layers: list[SewageLayerInfo]
    base_path: str


class SewageLayerStatEntry(BaseModel):
    display_name: str
    feature_count: Optional[int] = None
    color: Optional[str] = None
    error: Optional[str] = None


class SewageStatisticsResponse(BaseModel):
    statistics: dict[str, Any]


class RiverInfo(BaseModel):
    id: str
    display_name: str
    folder_path: str
    shapefile_path: str
    color: str
    feature_count: Optional[int] = None
    crs: Optional[str] = None
    error: Optional[str] = None


class RiversScanResponse(BaseModel):
    status: str
    rivers: dict[str, Any]
    count: int
    message: str


class RiverStyleEntry(BaseModel):
    color: str
    width: int


class RiverStylesResponse(BaseModel):
    status: str
    styles: dict[str, RiverStyleEntry]
