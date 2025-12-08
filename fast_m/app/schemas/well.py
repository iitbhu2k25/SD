from pydantic import BaseModel
from typing import Optional

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

    # Time-series fields: 2011–2020
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


class Well(WellBase):
    id: int
    village_code: int

    class Config:
        orm_mode = True
