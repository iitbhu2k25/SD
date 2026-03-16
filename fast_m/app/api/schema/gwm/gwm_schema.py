from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class SeasonRequest(BaseModel):
    season: str


class ForecastRequest(BaseModel):
    method: str
    forecast_type: str
    target_years: List[int]
    timeseries_yearly_csv_filename: str


class IndustrialRequest(BaseModel):
    csv_filename: str
    groundwater_industrial_demand: float
    village_codes: Optional[List[int]] = None
    subdistrict_codes: Optional[List[int]] = None


class PopulationRequest(BaseModel):
    csv_filename: str = Field(..., description="CSV file in media/temp/")
    villages: Optional[List[int]] = Field(None, alias="village_code")
    subdistricts: Optional[List[int]] = Field(None, alias="subdistrict_code")
    lpcd: Optional[float] = Field(60)

    model_config = {"populate_by_name": True, "extra": "ignore"}

    @property
    def has_village(self):
        return self.villages is not None

    @property
    def has_subdistrict(self):
        return self.subdistricts is not None


class RechargeRequest(BaseModel):
    csvFilename: str
    selectedVillages: Optional[List[Union[str, int]]] = None
    selectedSubDistricts: Optional[List[int]] = None


class StressRequest(BaseModel):
    gsrData: List[Dict[str, Any]]
    years_count: int
    selectedSubDistricts: List[Any] = []
    timestamp: str | None = None


class GSRVillage(BaseModel):
    village_code: str
    village_name: Optional[str] = "Unknown"
    recharge: float
    total_demand: float


class TrendRequest(BaseModel):
    wells_csv_filename: str = Field(..., description="File name inside media/temp/")
    subdis_codes: Optional[List[int]] = Field(None)
    village_codes: Optional[List[int]] = Field(None)
    trend_years: Optional[List[int]] = Field(None)
    return_type: Optional[str] = Field(
        "all",
        pattern="^(all|stats|charts|village_data|tables)$",
    )


class CSVUploadData(BaseModel):
    filename: str
    original_name: str
    file_path: str
    file_size: str
    uploaded_at: str
    temp_directory: str


class CSVUploadResponse(BaseModel):
    success: bool
    message: str
    data: CSVUploadData


class VillagesCatchmentRequest(BaseModel):
    drain_no: Union[str, int] = Field(..., alias="Drain_No")

    model_config = {"populate_by_name": True, "extra": "ignore"}


class VillagesCatchmentVillage(BaseModel):
    village_code: Union[str, int]
    name: str
    overlap_percentage: Optional[float] = None


class VillagesCatchmentResponse(BaseModel):
    drain_no: Union[str, int]
    total_villages: int
    villages: List[VillagesCatchmentVillage]
    note: str


class VillagesCatchmentMetaResponse(BaseModel):
    message: str
    available_drain_numbers: Optional[List[Union[str, int]]] = None
    total_catchments: Optional[int] = None
    error: Optional[str] = None
    available_columns: Optional[List[str]] = None


class WellRequest(BaseModel):
    village_code: Optional[Union[List[Union[str, int]], str, int]] = None
    subdis_cod: Optional[Union[List[Union[str, int]], str, int]] = None
    village_codes: Optional[Union[List[Union[str, int]], str, int]] = None
    subdis_codes: Optional[Union[List[Union[str, int]], str, int]] = None


class WellBase(BaseModel):
    FID_clip: Optional[int] = None
    OBJECTID: Optional[int] = None
    shapeName: Optional[str] = None
    SUB_DISTRI: Optional[str] = None
    DISTRICT_C: Optional[int] = None
    DISTRICT: Optional[str] = None
    STATE_CODE: Optional[int] = None
    STATE: Optional[str] = None
    population: Optional[int] = None
    SUBDIS_COD: Optional[int] = None
    Area: Optional[float] = None
    DISTRICT_1: Optional[str] = None
    BLOCK: Optional[str] = None
    HYDROGRAPH: Optional[str] = None
    LONGITUDE: Optional[float] = None
    LATITUDE: Optional[float] = None
    RL: Optional[float] = None

    PRE_2011: Optional[float] = None
    POST_2011: Optional[float] = None
    PRE_2012: Optional[float] = None
    POST_2012: Optional[float] = None
    PRE_2013: Optional[float] = None
    POST_2013: Optional[float] = None
    PRE_2014: Optional[float] = None
    POST_2014: Optional[float] = None
    PRE_2015: Optional[float] = None
    POST_2015: Optional[float] = None
    PRE_2016: Optional[float] = None
    POST_2016: Optional[float] = None
    PRE_2017: Optional[float] = None
    POST_2017: Optional[float] = None
    PRE_2018: Optional[float] = None
    POST_2018: Optional[float] = None
    PRE_2019: Optional[float] = None
    POST_2019: Optional[float] = None
    PRE_2020: Optional[float] = None
    POST_2020: Optional[float] = None


class WellResponse(WellBase):
    id: int
    village_code: int

    model_config = ConfigDict(from_attributes=True)
