from pydantic import BaseModel


class WaterLevelRequest(BaseModel):
    station_code: str


class HGStationDataRequest(BaseModel):
    stationCode: str
    startDate: str
    endDate: str
