from pydantic import BaseModel, Field
from typing import Annotated, List, Optional, Tuple


class DrainPointInput(BaseModel):
    Drain_No: int
    latitude: float
    longitude: float


class DrainPointSimple(BaseModel):
    Drain_No: int
    latitude: float
    longitude: float


class RasterVisualOutput(BaseModel):
    workspace: str
    layer_name: str
    file_name: str


class ClusterDrainDistance(BaseModel):
    Drain_No: int
    distance_m: float


class ClusterInfo(BaseModel):
    cluster_rank: int
    area_ha: float
    dist_to_polygon_m: float
    drains: List[ClusterDrainDistance]
    path_layer: Optional[str] = None  # GeoServer layer for road path, pre-computed at Find Suitable Area time


class category_raster(BaseModel):
    clip: List[int] = None
    place: str = None
    layer_name: str = None


# ── Single area manual schemas ──────────────────────────────────────────────

class STPManualAreaConfirmOutput(BaseModel):
    raster_layer: Annotated[List[RasterVisualOutput], None]
    vector_layer: str
    polygon_layer: Optional[str] = None
    centroid_lat: float
    centroid_lon: float
    buffer_bbox: List[float]
    area_ha: float = 0.0


class STPManualFindPathInput(BaseModel):
    polygon_geojson: Optional[dict] = None
    polygon_layer: Optional[str] = None
    cluster_layer: Optional[str] = None
    cluster_rank: Optional[int] = None   # when set, filter cluster_layer to this specific rank
    location: List[Tuple[float, float]]
    drain_points: Optional[List[DrainPointInput]] = None
    buffer_bbox: Optional[List[float]] = None  # [minx, miny, maxx, maxy] in WGS84


class STPManualFindPathOutput(BaseModel):
    suitable_path: Optional[str] = None
    cluster_distances: Optional[List[ClusterInfo]] = None


class STPManualCheckConstraintsInput(BaseModel):
    polygon_geojson: dict


class STPManualCheckConstraintsOutput(BaseModel):
    constraint_violations: List[str]
    can_proceed: bool


# ── Multi-polygon schemas ────────────────────────────────────────────────────

class STPMultiAreaConfirmSingleResult(BaseModel):
    vector_layer: str
    polygon_layer: Optional[str] = None
    centroid_lat: float
    centroid_lon: float
    buffer_bbox: List[float]
    area_ha: float = 0.0


class STPMultiAreaConfirmOutput(BaseModel):
    results: List[STPMultiAreaConfirmSingleResult]


class STPMultiFindPathSingleInput(BaseModel):
    polygon_geojson: Optional[dict] = None
    polygon_layer: Optional[str] = None
    location: List[Tuple[float, float]]
    drain_points: Optional[List[DrainPointInput]] = None
    buffer_bbox: Optional[List[float]] = None


class STPMultiFindPathInput(BaseModel):
    polygons: List[STPMultiFindPathSingleInput]


class STPMultiFindPathSingleResult(BaseModel):
    suitable_path: Optional[str] = None
    cluster_distances: Optional[List[ClusterInfo]] = None


class STPMultiFindPathOutput(BaseModel):
    results: List[STPMultiFindPathSingleResult]


class STPMultiAreaSinglePayload(BaseModel):
    treatment_technology: float
    mld_capacity: float
    custom_land_per_mld: float = Field(2.0, le=2)
    layer_name: str
    location: List[Tuple[float, float]]
    drain_points: Optional[List[DrainPointSimple]] = None
    num_clusters: int = 10


class STPMultiAreaPayload(BaseModel):
    polygons: List[STPMultiAreaSinglePayload]


class STPMultiAreaSingleResult(BaseModel):
    cluster_layer: Optional[str] = None
    cluster_distances: Optional[List[ClusterInfo]] = None


class STPMultiAreaOutput(BaseModel):
    results: List[STPMultiAreaSingleResult]
