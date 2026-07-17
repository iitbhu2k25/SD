# Dashboard FastAPI — Complete Handover

All code needed to migrate the dashboard from Django to FastAPI (fast_m).
Copy each file to the exact path shown.

---

## STEP 1 — Comment out Django dashboard route

**File:** `backend/main/urls.py`

```python
# path("django/drain-water-quality/", include("dashboard.urls")),
```

---

## STEP 2 — Fix frontend fetch URLs

**File:** `frontend/app/dss/dashboard/page.tsx`

Change these 2 lines:

```js
// BEFORE
fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/drain-water-quality/sewage-infrastructure/statistics`)
fetch(`${process.env.NEXT_PUBLIC_DJANGO_URL}/drain-water-quality/main`)

// AFTER
fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/drain-water-quality/sewage-infrastructure/statistics`)
fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/drain-water-quality/main`)
```

---

## STEP 3 — Copy shapefiles

Copy these folders into your `fast_m/media/` directory:

```
fast_m/media/shapefile/dashboard/
    ├── partial_tapped_drain/   (5 features)
    ├── tapped/                 (110 features)
    ├── untapped_drain/         (32 features)
    ├── STP/                    (18 features)
    └── Basin/

fast_m/media/shapefile/Rivers/
    ├── varuna/
    ├── basuhi/
    ├── morwa/
    └── basin/
```

---

## STEP 4 — Python Files

---

### `fast_m/app/database/models/model_dashboard.py`

```python
from sqlalchemy import String, Integer, Float, Text, DateTime, Numeric, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.base import Base


class DrainWaterQuality(Base):
    __tablename__ = "dashboard_drainwaterquality"

    location: Mapped[str] = mapped_column(String(150), nullable=False)
    ph: Mapped[float] = mapped_column(Float, nullable=False)
    temp: Mapped[float] = mapped_column(Float, nullable=False)
    ec_us_cm: Mapped[float] = mapped_column(Float, nullable=False)
    tds_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    do_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    turbidity: Mapped[float] = mapped_column(Float, nullable=False)
    tss_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    cod: Mapped[float] = mapped_column(Float, nullable=False)
    bod_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    ts_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    chloride: Mapped[float] = mapped_column(Float, nullable=False)
    nitrate: Mapped[float | None] = mapped_column(Float, nullable=True)
    faecal_col: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_col: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    stream: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    sampling_time: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, index=True)


class StoryMapStation(Base):
    __tablename__ = "dashboard_mapstory"

    id = None
    created_at = None
    modified_at = None

    station_id: Mapped[str] = mapped_column(String(50), primary_key=True, unique=True)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    other: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardDepth(Base):
    __tablename__ = "dashboard_depth"

    district: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    season: Mapped[str] = mapped_column(String(30), nullable=False)
    depth_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardRainfall(Base):
    __tablename__ = "dashboard_rainfall"

    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False, index=True)
    annual_rainfall: Mapped[float] = mapped_column(Numeric(15, 10), nullable=False)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardDistribution(Base):
    __tablename__ = "dashboard_distribution"

    year: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    percentage: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardIndustrialPollution(Base):
    __tablename__ = "dashboard_industrial_pollution"

    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    pollution_index: Mapped[str | None] = mapped_column(String(50), nullable=True)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
```

---

### `fast_m/app/database/models/__init__.py`

Add these lines to your existing `__init__.py`:

```python
from app.database.models.model_dashboard import (
    DrainWaterQuality,
    StoryMapStation,
    DashboardDepth,
    DashboardRainfall,
    DashboardDistribution,
    DashboardIndustrialPollution,
)
```

---

### `fast_m/app/database/crud/dashboard_crud.py`

```python
from sqlalchemy.orm import Session
from app.database.models.model_dashboard import (
    DrainWaterQuality,
    StoryMapStation,
    DashboardDepth,
    DashboardRainfall,
    DashboardDistribution,
    DashboardIndustrialPollution,
)


class DashboardCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_drain_water_quality(self):
        return self.db.query(DrainWaterQuality).order_by(DrainWaterQuality.sampling_time.desc()).all()

    def get_depth(self):
        return (
            self.db.query(DashboardDepth)
            .order_by(DashboardDepth.year, DashboardDepth.district, DashboardDepth.season)
            .all()
        )

    def get_rainfall(self):
        return (
            self.db.query(DashboardRainfall)
            .order_by(DashboardRainfall.year, DashboardRainfall.district)
            .all()
        )

    def get_distribution(self):
        return (
            self.db.query(DashboardDistribution)
            .order_by(DashboardDistribution.year, DashboardDistribution.category)
            .all()
        )

    def get_industrial_pollution(self):
        return (
            self.db.query(DashboardIndustrialPollution)
            .order_by(
                DashboardIndustrialPollution.district,
                DashboardIndustrialPollution.category,
                DashboardIndustrialPollution.id,
            )
            .all()
        )

    def get_story_map_stations(self):
        return self.db.query(StoryMapStation).order_by(StoryMapStation.location).all()

    def get_story_map_station(self, station_id: str):
        return self.db.query(StoryMapStation).filter(StoryMapStation.station_id == station_id).first()

    def count_story_map_stations(self) -> int:
        return self.db.query(StoryMapStation).count()
```

---

### `fast_m/app/api/schema/dashboard_schema.py`

```python
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
```

---

### `fast_m/app/api/service/dashboard/dashboard_service.py`

```python
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

# BASE_DIR = /home/app  -> media is at /home/app/media
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

    # -- water quality --

    def get_drain_water_quality(self) -> list[DrainWaterQualityOut]:
        rows = self.crud.get_drain_water_quality()
        return [DrainWaterQualityOut.model_validate(r) for r in rows]

    # -- trend-analysis data --

    def get_depth(self) -> list[DashboardDepthOut]:
        return [DashboardDepthOut.model_validate(r) for r in self.crud.get_depth()]

    def get_rainfall(self) -> list[DashboardRainfallOut]:
        return [DashboardRainfallOut.model_validate(r) for r in self.crud.get_rainfall()]

    def get_distribution(self) -> list[DashboardDistributionOut]:
        return [DashboardDistributionOut.model_validate(r) for r in self.crud.get_distribution()]

    def get_industrial_pollution(self) -> list[DashboardIndustrialPollutionOut]:
        return [DashboardIndustrialPollutionOut.model_validate(r) for r in self.crud.get_industrial_pollution()]

    # -- story map --

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

    # -- sewage infrastructure --

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
        statistics: dict[str, Any] = {}
        for layer_id, cfg in SHAPEFILE_CONFIG.items():
            shp_path = _get_shapefile_path(layer_id)
            if shp_path:
                try:
                    gdf = gpd.read_file(str(shp_path))
                    statistics[layer_id] = {
                        "display_name": cfg["display_name"],
                        "feature_count": len(gdf),
                        "color": cfg["color"],
                    }
                except Exception as e:
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

    # -- rivers --

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
```

---

### `fast_m/app/api/routes/dashboard/dashboard.py`

```python
from fastapi import APIRouter

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


# -- drain water quality --

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


# -- story map --

@router.get("/story-map/stations", response_model=StoryMapStationsResponse)
def get_story_map_stations(db: db_dependency):
    return DashboardService(db).get_story_map_stations()


@router.get("/story-map/stations/{station_id}", response_model=StoryMapStationOut)
def get_story_map_station(station_id: str, db: db_dependency):
    return DashboardService(db).get_story_map_station(station_id)


@router.get("/story-map/statistics", response_model=StoryMapStatisticsResponse)
def get_story_map_statistics(db: db_dependency):
    return DashboardService(db).get_story_map_statistics()


# -- sewage infrastructure --

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


# -- rivers --

@router.get("/rivers/scan")
def scan_rivers(db: db_dependency):
    return DashboardService(db).scan_rivers()


@router.get("/rivers/geojson/{river_name}")
def get_river_geojson(river_name: str, db: db_dependency):
    return DashboardService(db).get_river_geojson(river_name)


@router.get("/rivers/styles")
def get_river_styles(db: db_dependency):
    return DashboardService(db).get_river_styles()
```

---

### `fast_m/app/api/routes/__init__.py`

Add these lines to your existing `__init__.py`:

```python
from app.api.routes.dashboard.dashboard import router as dashboard_router

app_router.include_router(dashboard_router, prefix="/drain-water-quality", tags=["Dashboard"])
```

---

### `fast_m/alembic/versions/a1b2c3d4e5f6_dashboard_tables_added.py`

```python
"""dashboard tables added

Revision ID: a1b2c3d4e5f6
Revises: 64a64c5b42e7
Create Date: 2026-07-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "64a64c5b42e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboard_drainwaterquality",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("location", sa.String(length=150), nullable=False),
        sa.Column("ph", sa.Float(), nullable=False),
        sa.Column("temp", sa.Float(), nullable=False),
        sa.Column("ec_us_cm", sa.Float(), nullable=False),
        sa.Column("tds_ppm", sa.Float(), nullable=False),
        sa.Column("do_mg_l", sa.Float(), nullable=False),
        sa.Column("turbidity", sa.Float(), nullable=False),
        sa.Column("tss_mg_l", sa.Float(), nullable=False),
        sa.Column("cod", sa.Float(), nullable=False),
        sa.Column("bod_mg_l", sa.Float(), nullable=False),
        sa.Column("ts_mg_l", sa.Float(), nullable=False),
        sa.Column("chloride", sa.Float(), nullable=False),
        sa.Column("nitrate", sa.Float(), nullable=True),
        sa.Column("faecal_col", sa.String(length=100), nullable=True),
        sa.Column("total_col", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("stream", sa.String(length=255), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("sampling_time", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_drainwaterquality_id", "dashboard_drainwaterquality", ["id"], unique=True)
    op.create_index("ix_dashboard_drainwaterquality_sampling_time", "dashboard_drainwaterquality", ["sampling_time"], unique=False)

    op.create_table(
        "dashboard_mapstory",
        sa.Column("station_id", sa.String(length=50), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("other", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("station_id"),
        sa.UniqueConstraint("station_id"),
    )
    op.create_index("ix_dashboard_mapstory_location", "dashboard_mapstory", ["location"], unique=False)

    op.create_table(
        "dashboard_depth",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("season", sa.String(length=30), nullable=False),
        sa.Column("depth_m", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_depth_id", "dashboard_depth", ["id"], unique=True)

    op.create_table(
        "dashboard_rainfall",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("annual_rainfall", sa.Numeric(precision=15, scale=10), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_rainfall_id", "dashboard_rainfall", ["id"], unique=True)
    op.create_index("ix_dashboard_rainfall_district", "dashboard_rainfall", ["district"], unique=False)
    op.create_index("ix_dashboard_rainfall_year", "dashboard_rainfall", ["year"], unique=False)

    op.create_table(
        "dashboard_distribution",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("year", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("percentage", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_distribution_id", "dashboard_distribution", ["id"], unique=True)
    op.create_index("ix_dashboard_distribution_year", "dashboard_distribution", ["year"], unique=False)
    op.create_index("ix_dashboard_distribution_category", "dashboard_distribution", ["category"], unique=False)

    op.create_table(
        "dashboard_industrial_pollution",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("pollution_index", sa.String(length=50), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dashboard_industrial_pollution_id", "dashboard_industrial_pollution", ["id"], unique=True)
    op.create_index("ix_dashboard_industrial_pollution_district", "dashboard_industrial_pollution", ["district"], unique=False)
    op.create_index("ix_dashboard_industrial_pollution_category", "dashboard_industrial_pollution", ["category"], unique=False)


def downgrade() -> None:
    op.drop_table("dashboard_industrial_pollution")
    op.drop_table("dashboard_distribution")
    op.drop_table("dashboard_rainfall")
    op.drop_table("dashboard_depth")
    op.drop_table("dashboard_mapstory")
    op.drop_table("dashboard_drainwaterquality")
```

---

## STEP 5 — Run Migration

```bash
cd fast_m
alembic upgrade head
```

---

## Summary of All URLs Exposed

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/drain-water-quality/main` | Drain water quality data |
| GET | `/drain-water-quality/depth` | Groundwater depth data |
| GET | `/drain-water-quality/rainfall/` | Rainfall data |
| GET | `/drain-water-quality/distribution/` | Distribution data |
| GET | `/drain-water-quality/industrial/` | Industrial pollution data |
| GET | `/drain-water-quality/story-map/stations` | All story map stations |
| GET | `/drain-water-quality/story-map/stations/{id}` | Single station |
| GET | `/drain-water-quality/story-map/statistics` | Station count |
| GET | `/drain-water-quality/sewage-infrastructure/geojson/{layer}` | Sewage GeoJSON |
| GET | `/drain-water-quality/sewage-infrastructure/layers` | Available layers |
| GET | `/drain-water-quality/sewage-infrastructure/statistics` | Feature counts |
| GET | `/drain-water-quality/sewage-infrastructure/details/{layer}` | Layer schema |
| GET | `/drain-water-quality/rivers/scan` | Scan river shapefiles |
| GET | `/drain-water-quality/rivers/geojson/{river}` | River GeoJSON |
| GET | `/drain-water-quality/rivers/styles` | River colors & widths |
