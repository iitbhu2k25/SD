# app/api/schema/basic_schema.py
from typing import Any, Literal

from pydantic import BaseModel, Field


class DistrictRequest(BaseModel):
    state_code: int


class SubdistrictRequest(BaseModel):
    district_code: int | list[int]


class VillageRequest(BaseModel):
    subdistrict_code: int | list[int]


class TimeSeriesRequest(BaseModel):
    year: int | None = None
    start_year: int | None = None
    end_year: int | None = None
    villages_props: list[dict[str, Any]] = Field(default_factory=list)
    subdistrict_props: list[dict[str, Any]] = Field(default_factory=list)
    totalPopulation_props: int | float | dict[str, Any] | None = None


class DemographicRequest(TimeSeriesRequest):
    demographic: dict[str, int | float | str | None] = Field(default_factory=dict)


class SewageRequest(BaseModel):
    method: Literal["water_supply", "domestic_sewage"]
    load_method: Literal["manual", "modeled"] | None = None
    total_supply: float | None = None
    domestic_supply: float | None = None
    computed_population: dict[str, float] | None = None
    unmetered_supply: float | None = 0


class DrainDemandInput(BaseModel):
    drain_no: str | int
    drain_id: str | int
    drain_recharge: float


class SewageDemandRequest(BaseModel):
    load_method: Literal["manual", "modeled"]
    # manual: user-supplied {year: population} pairs
    population_data: dict[str, float] | None = None
    # modeled: forecasted {year: population} from store
    computed_population: dict[str, float] | None = None
    water_supply: float | None = None
    drains: list[DrainDemandInput] = Field(default_factory=list)
    population_2025: float | None = None
    unmetered_supply: float = 15


class PeakSewageFlowRequest(BaseModel):
   
    population_data: dict[str, float]
    methods: list[Literal["cpheeo", "harmon", "babbitt"]]
    sewage_data: dict[str, float] | None = None
    base_sewage: float | None = None


class RawSewageItem(BaseModel):
    name: str
    per_capita: float
    design_characteristic: float | None = None


class RawSewageCharacteristicsRequest(BaseModel):
    population_2011: float
    unmetered_supply: float = 0
    custom_items: list[RawSewageItem] | None = None


class WaterSupplyRequest(BaseModel):
    surface_water: float | None = 0
    direct_groundwater: float | None = None
    num_tubewells: float | None = 0
    discharge_rate: float | None = 0
    operating_hours: float | None = 0
    direct_alternate: float | None = None
    rooftop_tank: float | None = 0
    aquifer_recharge: float | None = 0
    surface_runoff: float | None = 0
    reuse_water: float | None = 0


class DomesticWaterDemandRequest(BaseModel):
    forecast_data: dict[str, float]
    per_capita_consumption: float
    seasonal_multipliers: dict[str, float] = Field(default_factory=dict)


class FloatingWaterDemandRequest(BaseModel):
    floating_population_percentage: float = 15
    facility_type: Literal["provided", "notprovided", "onlypublic"]
    domestic_forecast: dict[str, float]
    seasonal_multipliers: dict[str, float] = Field(default_factory=dict)


class InstitutionalWaterDemandRequest(BaseModel):
    institutional_fields: dict[str, float]
    domestic_forecast: dict[str, float]


class FirefightingWaterDemandRequest(BaseModel):
    firefighting_methods: dict[str, bool]
    domestic_forecast: dict[str, float]


class WaterSupplyThematicRequest(BaseModel):
    year: int | None = None
    start_year: int | None = None
    end_year: int | None = None
    villages_props: list[dict[str, Any]] = Field(default_factory=list)
    subdistrict_props: list[dict[str, Any]] = Field(default_factory=list)
    total_supply: float = 0.0
    demand_by_year: dict[str, float] = Field(default_factory=dict)


class WaterDemandThematicRequest(BaseModel):
    year: int | None = None
    start_year: int | None = None
    end_year: int | None = None
    villages_props: list[dict[str, Any]] = Field(default_factory=list)
    subdistrict_props: list[dict[str, Any]] = Field(default_factory=list)
    per_capita_consumption: float = 135.0
    floating_percentage: float = 0.0
    facility_lpcd: float = 0.0
    inst_demand: dict[str, float] | None = None
    ff_demand: dict[str, float] | None = None
    total_population_2011: float = 0.0


class CohortRequest(BaseModel):
    year: int | None = None
    start_year: int | None = None
    end_year: int | None = None
    villages_props: list[dict[str, Any]] = Field(default_factory=list)
    subdistrict_props: list[dict[str, Any]] | dict[str, Any] | None = None
    district_props: list[dict[str, Any]] | dict[str, Any] | None = None
    state_props: dict[str, Any] | None = None


class IdListRequest(BaseModel):
    shapeID: list[int | str]


class StormwaterRunoffRequest(BaseModel):
    area: float
    selected_time: int
    shape: str
    selected_land_use_type: str
    rainfall_intensity: float


class RiverCodeRequest(BaseModel):
    River_Code: str | int | None = None


class StretchIdRequest(BaseModel):
    Stretch_ID: int | str | list[int | str] | None = None


class DrainNoRequest(BaseModel):
    Drain_No: int | str | list[int | str] | None = None


class VillageCodesRequest(BaseModel):
    village_code: int | str | list[int | str] | None = None
    village_codes: int | str | list[int | str] | None = None


class StudyAreaMapRequest(BaseModel):
    village_codes: list[int | str]
