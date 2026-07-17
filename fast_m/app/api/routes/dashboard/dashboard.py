from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.api.schema.dashboard_schema import (
    DrainWaterQualityOut,
    DashboardDepthOut,
    DashboardRainfallOut,
    DashboardDistributionOut,
    DashboardIndustrialPollutionOut,
    StoryMapStationOut,
    StoryMapStationsResponse,
    StoryMapStatisticsResponse,
)
from app.api.service.dashboard.dashboard_service import DashboardService
from app.database.config.dependency import db_dependency

router = APIRouter()


# ── drain water quality ──────────────────────────────────────────────────────

@router.get("/main", response_model=list[DrainWaterQualityOut])
def get_drain_water_quality(db: db_dependency):
    return DashboardService(db).get_drain_water_quality()


@router.get("/depth", response_model=list[DashboardDepthOut])
def get_depth(db: db_dependency):
    return DashboardService(db).get_depth()


@router.get("/rainfall/", response_model=list[DashboardRainfallOut])
def get_rainfall(db: db_dependency):
    return DashboardService(db).get_rainfall()


@router.get("/distribution/", response_model=list[DashboardDistributionOut])
def get_distribution(db: db_dependency):
    return DashboardService(db).get_distribution()


@router.get("/industrial/", response_model=list[DashboardIndustrialPollutionOut])
def get_industrial_pollution(db: db_dependency):
    return DashboardService(db).get_industrial_pollution()


# ── story map ────────────────────────────────────────────────────────────────

@router.get("/story-map/stations", response_model=StoryMapStationsResponse)
def get_story_map_stations(db: db_dependency):
    return DashboardService(db).get_story_map_stations()


@router.get("/story-map/stations/{station_id}", response_model=StoryMapStationOut)
def get_story_map_station(station_id: str, db: db_dependency):
    return DashboardService(db).get_story_map_station(station_id)


@router.get("/story-map/statistics", response_model=StoryMapStatisticsResponse)
def get_story_map_statistics(db: db_dependency):
    return DashboardService(db).get_story_map_statistics()


# ── sewage infrastructure ────────────────────────────────────────────────────

@router.get("/sewage-infrastructure/geojson/{layer_name}")
def get_sewage_geojson(layer_name: str, db: db_dependency):
    return DashboardService(db).get_sewage_geojson(layer_name)


@router.get("/sewage-infrastructure/layers")
def get_sewage_layers(db: db_dependency):
    return DashboardService(db).get_sewage_layers()


@router.get("/sewage-infrastructure/statistics")
def get_sewage_statistics(db: db_dependency):
    return DashboardService(db).get_sewage_statistics()


@router.get("/sewage-infrastructure/details/{layer_name}")
def get_layer_details(layer_name: str, db: db_dependency):
    return DashboardService(db).get_layer_details(layer_name)


# ── rivers ───────────────────────────────────────────────────────────────────

@router.get("/rivers/scan")
def scan_rivers(db: db_dependency):
    return DashboardService(db).scan_rivers()


@router.get("/rivers/geojson/{river_name}")
def get_river_geojson(river_name: str, db: db_dependency):
    return DashboardService(db).get_river_geojson(river_name)


@router.get("/rivers/styles")
def get_river_styles(db: db_dependency):
    return DashboardService(db).get_river_styles()
