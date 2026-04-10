
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

class celery_id(BaseModel):
    task_id:str



class WellMeta(BaseModel):
    location:  str
    latitude:  float
    longitude: float


class IonPct(BaseModel):
    Ca_pct:   float
    Mg_pct:   float
    Na_pct:   float
    K_pct:    float
    HCO3_pct: float
    CO3_pct:  float
    Cl_pct:   float
    SO4_pct:  float


class XY(BaseModel):
    x: float
    y: float



class PiperPoint(WellMeta):
    cation:  XY
    anion:   XY
    diamond: XY
    ion_pct: IonPct


class PiperResponse(BaseModel):
    chart:   str = "piper"
    gap_D:   float
    points:  List[PiperPoint]




class DurovPoint(WellMeta):
    cation_tri: XY
    anion_tri:  XY
    square:     XY
    ion_pct:    IonPct


class DurovResponse(BaseModel):
    chart:  str = "durov"
    points: List[DurovPoint]



class GibbsPoint(WellMeta):
    tds:               float
    cation_ratio:      float
    anion_ratio:       float
    mechanism_cation:  str     # "Precipitation dominance" | "Rock-water interaction" | "Evaporation dominance"
    mechanism_anion:   str


class GibbsResponse(BaseModel):
    chart:  str = "gibbs"
    points: List[GibbsPoint]



class PCAScore(WellMeta):
    PC1: float
    PC2: float


class PCALoading(BaseModel):
    feature: str 
    PC1:     float
    PC2:     float


class PCAResponse(BaseModel):
    chart:                   str = "pca"
    n_components:            int
    explained_variance_pct:  List[float]   # [PC1_var%, PC2_var%]
    cumulative_variance_pct: List[float]
    eigenvalues:             List[float]
    loadings:                List[PCALoading]   # biplot arrows
    scores:                  List[PCAScore]     # scatter points



class RDASiteScore(WellMeta):
    RDA1: float
    RDA2: float


class RDAResponseLoading(BaseModel):
    ion:  str    # "Ca", "Mg", "Na" …
    RDA1: float
    RDA2: float


class RDAExplanatoryLoading(BaseModel):
    variable: str   # "pH", "EC", "Hardness"
    RDA1:     float
    RDA2:     float


class RDAResponse(BaseModel):
    chart:                  str = "rda"
    n_components:           int
    explained_variance_pct: List[float]
    response_loadings:      List[RDAResponseLoading]     # ion arrows
    explanatory_loadings:   List[RDAExplanatoryLoading]  # env arrows
    site_scores:            List[RDASiteScore]            # sample points



class AllChartsResponse(BaseModel):
    piper: PiperResponse
    durov: DurovResponse
    gibbs: GibbsResponse
    pca:   PCAResponse
    rda:   RDAResponse