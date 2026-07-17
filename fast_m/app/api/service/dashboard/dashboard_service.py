import json
import logging
import os
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

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
from app.conf.settings import Settings
from app.database.crud.dashboard_crud import DashboardCrud

logger = logging.getLogger(__name__)

# BASE_DIR = /home/app  → media is at /home/app/media
_BASE_DIR = Path(Settings().BASE_DIR)
_MEDIA_BASE = _BASE_DIR / "media"

SHAPEFILE_DASHBOARD_BASE = _MEDIA_BASE / "shapefile" / "dashboard"
SHAPEFILE_RIVERS_BASE = _MEDIA_BASE / "shapefile" / "Rivers"

SHAPEFILE_CONFIG: dict[str, dict] = {
    "partial_tapped_drain": {
        "path": "partial_tapped_drain",
        "display_name": "Partial Tapped Drain",
        "color": "#FFA500",
    },
    "tapped": {
        "path": "tapped",
        "display_name": "Tapped Drain",
        "color": "#00FF00",
    },
    "untapped_drain": {
        "path": "untapped_drain",
        "display_name": "Untapped Drain",
        "color": "#FF0000",
    },
    "STP": {
        "path": "STP",
        "display_name": "STP (Sewage Treatment Plant)",
        "color": "#0000FF",
    },
    "Basin": {
        "path": "Basin",
        "display_name": "Basin",
        "color": "#8B4513",
    },
}

RIVER_COLORS: dict[str, str] = {
    "varuna": "#0066CC",
    "basuhi": "#00AA44",
    "morwa": "#FF6600",
    "basin": "#8B4513",
}


def _get_shapefile_path(layer_name: str) -> Path | None:
    if layer_name not in SHAPEFILE_CONFIG:
        return None
    folder = SHAPEFILE_DASHBOARD_BASE / SHAPEFILE_CONFIG[layer_name]["path"]
    if not folder.exists():
        return None
    shp_files = list(folder.glob("*.shp"))
    return shp_files[0] if shp_files else None


def _shapefile_to_geojson(shp_path: Path) -> dict:
    gdf = gpd.read_file(str(shp_path))
    for col in gdf.columns:
        if "datetime" in str(gdf[col].dtype):
            gdf[col] = gdf[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")
    return json.loads(gdf.to_json())


def _get_river_color(river_id: str) -> str:
    for name, color in RIVER_COLORS.items():
        if name in river_id.lower():
            return color
    return "#0ea5e9"


class DashboardService:
    def __init__(self, db: Session):
        self.crud = DashboardCrud(db)

    # ── water quality ────────────────────────────────────────────────────────

    def get_drain_water_quality(self) -> list[DrainWaterQualityOut]:
        rows = self.crud.get_drain_water_quality()
        return [DrainWaterQualityOut.model_validate(r) for r in rows]

    # ── trend-analysis data ──────────────────────────────────────────────────

    def get_depth(self) -> list[DashboardDepthOut]:
        return [DashboardDepthOut.model_validate(r) for r in self.crud.get_depth()]

    def get_rainfall(self) -> list[DashboardRainfallOut]:
        return [DashboardRainfallOut.model_validate(r) for r in self.crud.get_rainfall()]

    def get_distribution(self) -> list[DashboardDistributionOut]:
        return [DashboardDistributionOut.model_validate(r) for r in self.crud.get_distribution()]

    def get_industrial_pollution(self) -> list[DashboardIndustrialPollutionOut]:
        return [DashboardIndustrialPollutionOut.model_validate(r) for r in self.crud.get_industrial_pollution()]

    # ── story map ────────────────────────────────────────────────────────────

    def get_story_map_stations(self) -> StoryMapStationsResponse:
        rows = self.crud.get_story_map_stations()
        stations = [
            StoryMapStationOut(
                id=r.station_id,
                location=r.location,
                image=r.image_path,
                lat=r.lat,
                lon=r.lon,
                description=r.description,
                remarks=r.remarks,
                other=r.other,
            )
            for r in rows
        ]
        return StoryMapStationsResponse(status="success", count=len(stations), stations=stations)

    def get_story_map_station(self, station_id: str) -> StoryMapStationOut:
        row = self.crud.get_story_map_station(station_id)
        if not row:
            raise HTTPException(status_code=404, detail=f'Station "{station_id}" not found')
        return StoryMapStationOut(
            id=row.station_id,
            location=row.location,
            image=row.image_path,
            lat=row.lat,
            lon=row.lon,
            description=row.description,
            remarks=row.remarks,
            other=row.other,
        )

    def get_story_map_statistics(self) -> StoryMapStatisticsResponse:
        total = self.crud.count_story_map_stations()
        return StoryMapStatisticsResponse(
            status="success",
            statistics={"total_stations": total},
        )

    # ── sewage infrastructure ────────────────────────────────────────────────

    def get_sewage_geojson(self, layer_name: str) -> dict:
        shp_path = _get_shapefile_path(layer_name)
        if not shp_path:
            raise HTTPException(
                status_code=404,
                detail=f'Layer "{layer_name}" shapefile not found',
            )
        try:
            return _shapefile_to_geojson(shp_path)
        except Exception as e:
            logger.error(f"Error converting {layer_name}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_sewage_layers(self) -> dict[str, Any]:
        layers = []
        for layer_id, cfg in SHAPEFILE_CONFIG.items():
            shp_path = _get_shapefile_path(layer_id)
            exists = shp_path is not None
            layers.append(
                {
                    "id": layer_id,
                    "name": cfg["path"],
                    "display_name": cfg["display_name"],
                    "color": cfg["color"],
                    "available": exists,
                    "path": str(shp_path) if exists else None,
                }
            )
        return {"layers": layers, "base_path": str(SHAPEFILE_DASHBOARD_BASE)}

    def get_sewage_statistics(self) -> dict[str, Any]:
        import urllib.request
        settings = Settings()
        gs_url = settings.GEOSERVER_URL.rstrip("/")
        workspace = settings.GEOSERVER_WORKSPACE

        geoserver_layer_map = {
            "partial_tapped_drain": "partial_tapped_drain",
            "tapped": "tapped",
            "untapped_drain": "untapped_drain",
            "STP": "Export_Output_5",
        }

        statistics: dict[str, Any] = {}
        for layer_id, cfg in SHAPEFILE_CONFIG.items():
            gs_layer = geoserver_layer_map.get(layer_id)
            if not gs_layer:
                continue
            try:
                wfs_url = (
                    f"{gs_url}/wfs"
                    f"?service=WFS&version=1.0.0&request=GetFeature"
                    f"&typeName={workspace}:{gs_layer}"
                    f"&outputFormat=application/json"
                )
                with urllib.request.urlopen(wfs_url, timeout=15) as resp:
                    data = json.loads(resp.read())
                count = len(data.get("features", []))
                statistics[layer_id] = {
                    "display_name": cfg["display_name"],
                    "feature_count": count,
                    "color": cfg["color"],
                }
            except Exception as e:
                logger.warning(f"GeoServer count failed for {layer_id}: {e}")
                statistics[layer_id] = {"display_name": cfg["display_name"], "error": str(e)}
        return {"statistics": statistics}

    def get_layer_details(self, layer_name: str) -> dict[str, Any]:
        shp_path = _get_shapefile_path(layer_name)
        if not shp_path:
            raise HTTPException(status_code=404, detail=f'Layer "{layer_name}" not found')
        gdf = gpd.read_file(str(shp_path))
        for col in gdf.columns:
            if "datetime" in str(gdf[col].dtype):
                gdf[col] = gdf[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
        schema = {
            "properties": {c: str(d) for c, d in gdf.dtypes.items() if c != "geometry"},
            "geometry": gdf.geom_type.unique()[0] if len(gdf.geom_type.unique()) == 1 else "Mixed",
        }
        sample = []
        for _, row in gdf.head(5).iterrows():
            props = {k: v for k, v in row.to_dict().items() if k != "geometry"}
            sample.append({"properties": props, "geometry_type": row.geometry.geom_type})
        return {
            "layer_name": layer_name,
            "display_name": SHAPEFILE_CONFIG[layer_name]["display_name"],
            "feature_count": len(gdf),
            "schema": schema,
            "crs": str(gdf.crs),
            "bounds": list(gdf.total_bounds),
            "sample_features": sample,
        }

    # ── rivers ───────────────────────────────────────────────────────────────

    def scan_rivers(self) -> dict[str, Any]:
        rivers: dict[str, Any] = {}
        if not SHAPEFILE_RIVERS_BASE.exists():
            return {"status": "success", "rivers": {}, "count": 0, "message": "Rivers directory not found"}

        for item in SHAPEFILE_RIVERS_BASE.iterdir():
            if not item.is_dir():
                continue
            shp_files = list(item.glob("*.shp"))
            if not shp_files:
                continue
            river_id = item.name.lower()
            try:
                gdf = gpd.read_file(str(shp_files[0]))
                rivers[river_id] = {
                    "id": river_id,
                    "display_name": item.name,
                    "folder_path": str(item),
                    "shapefile_path": str(shp_files[0]),
                    "color": _get_river_color(river_id),
                    "feature_count": len(gdf),
                    "crs": str(gdf.crs) if gdf.crs else "Unknown",
                }
            except Exception as e:
                rivers[river_id] = {
                    "id": river_id,
                    "display_name": item.name,
                    "folder_path": str(item),
                    "shapefile_path": str(shp_files[0]),
                    "color": _get_river_color(river_id),
                    "error": str(e),
                }

        return {
            "status": "success",
            "rivers": rivers,
            "count": len(rivers),
            "message": f"Found {len(rivers)} rivers",
        }

    def get_river_geojson(self, river_name: str) -> dict:
        if not SHAPEFILE_RIVERS_BASE.exists():
            raise HTTPException(status_code=404, detail="Rivers directory not found")

        river_folder = None
        for item in SHAPEFILE_RIVERS_BASE.iterdir():
            if item.is_dir() and item.name.lower() == river_name.lower():
                river_folder = item
                break

        if not river_folder:
            raise HTTPException(status_code=404, detail=f'River "{river_name}" not found')

        shp_files = list(river_folder.glob("*.shp"))
        if not shp_files:
            raise HTTPException(status_code=404, detail=f"No shapefile in {river_folder.name}")

        try:
            return _shapefile_to_geojson(shp_files[0])
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    def get_river_styles(self) -> dict[str, Any]:
        return {
            "status": "success",
            "styles": {
                "varuna": {"color": "#0066CC", "width": 4},
                "basuhi": {"color": "#00AA44", "width": 3},
                "morwa": {"color": "#FF6600", "width": 3},
                "basin": {"color": "#8B4513", "width": 2},
            },
        }
