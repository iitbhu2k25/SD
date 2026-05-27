import csv
import os
from typing import Dict, List, Optional
from fastapi import HTTPException
import re
from typing import List, Dict, Any, Tuple
import pandas as pd
import geopandas as gpd
from sqlalchemy.orm import Session
from app.database.models import Crop
from datetime import datetime
import numpy as np
import uuid
import json
from typing import List, Dict, Any, Optional, Tuple
from io import BytesIO
import base64
import gzip
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
import matplotlib.patches as mpatches
from typing import List, Dict, Any, Optional
from app.database.models import Village
from scipy.interpolate import Rbf, griddata
from scipy.spatial.distance import cdist
import rasterio
from rasterio.transform import from_origin
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from pathlib import Path
from shapely.geometry import mapping, shape, Point, LineString, Polygon
from shapely.ops import unary_union
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.colors as mcolors
from scipy.spatial import cKDTree
import contextily as ctx
from PIL import Image
from skimage import measure
import pyproj
from typing import Optional, Tuple, Dict, List, Any
import requests
import matplotlib.patches as patches
from shapely.geometry import Point
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from app.database.models import Village, Population2011
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from rasterio.crs import CRS
from rasterstats import zonal_stats
import warnings
import math
from collections import namedtuple
from typing import List, Optional, Tuple, Dict, Any
from shapely.geometry import shape
from scipy import stats
import seaborn as sns
from app.api.schema.gwm.gwm_schema import TrendRequest
from fastapi import HTTPException, UploadFile, status
from app.conf.settings import Settings
from app.database.crud.gwa.well import WellCrud
from app.api.schema.gwm.gwm_schema import WellRequest
from typing import Any
# ===== BEGIN admin_unit_service.py =====


GEOSERVER_URL = Settings().GEOSERVER_URL
GEOSERVER_USER = Settings().GEOSERVER_USERNAME
GEOSERVER_PASSWORD = Settings().GEOSERVER_PASSWORD
WORKSPACE = Settings().GEOSERVER_WORKSPACE

# Use project-local paths
BASE_DIR = Settings().BASE_DIR
MEDIA_ROOT = BASE_DIR+"/media"
TEMP_DIR = Settings().TEMP_DIR
VILLAGES_PATH=Path(MEDIA_ROOT) / "gwa_data" / "gwa_shp" / "Final_Village" / "Village.shp"


class AdminUnitService:
    def __init__(self, media_root: str = "media"):
        self.media_root = media_root
        self.csv_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_csv",
            "s_d_subd_v.csv",
        )

    def fetch_admin_units_from_villages(self, village_codes: List[int]) -> Dict:
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"CSV not found at {self.csv_path}")

        state_code: Optional[int] = None
        district_codes = set()
        subdistrict_codes = set()
        village_code_set = {int(code) for code in village_codes}

        with open(self.csv_path, newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    village_code = int(row["village_code"])
                except Exception:
                    continue

                if village_code in village_code_set:
                    state_code = int(row["state_code"])
                    district_codes.add(int(row["district_code"]))
                    subdistrict_codes.add(int(row["subdistrict_code"]))

        return {
            "state_code": state_code,
            "district_codes": sorted(district_codes),
            "subdistrict_codes": sorted(subdistrict_codes),
        }

    def get_admin_units(self, body: Dict) -> Dict:
        village_codes = body.get("village_codes")

        if not village_codes:
            raise HTTPException(status_code=400, detail="village_codes is required")

        try:
            result = self.fetch_admin_units_from_villages(village_codes)
            if result["state_code"] is None:
                raise HTTPException(status_code=404, detail="No admin units found for given villages")
            return result
        except FileNotFoundError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}") from exc

# ===== END admin_unit_service.py =====


# ===== BEGIN agri_demand_service.py =====


MEDIA_ROOT = "media"

# Constants
MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
PET_PREFIX = 'pet_'
PE_PREFIX = 'pe_'
CROPLAND_COL = 'CROPLAND'


def load_villages_gdf() -> gpd.GeoDataFrame:
    village_path = os.path.join(
        MEDIA_ROOT,
        "gwa_data",
        "gwa_shp",
        "Final_Village",
        "Village_PET_PE_SY_Crop.shp"
    )
    if not os.path.exists(village_path):
        raise FileNotFoundError(f"Shapefile not found at: {village_path}")
    return gpd.read_file(village_path)


def get_column_mapping(gdf: gpd.GeoDataFrame) -> Dict[str, str]:
    columns = gdf.columns.tolist()
    column_lower = [col.lower() for col in columns]

    mapping = {}
    for pattern in ['village_co', 'village_code', 'vill_code', 'village_cd', 'vcode']:
        if pattern in column_lower:
            mapping['village_code'] = columns[column_lower.index(pattern)]
            break
    for pattern in ['subdis_cod', 'subdistrict_code', 'subdist_code', 'sub_dist_code', 'sdcode']:
        if pattern in column_lower:
            mapping['subdistrict_code'] = columns[column_lower.index(pattern)]
            break
    for pattern in ['cropland', 'crop_land', 'croparea', 'crop_area']:
        if pattern in column_lower:
            mapping['cropland'] = columns[column_lower.index(pattern)]
            break
    return mapping


def safe_string_compare(series_value, target_value) -> bool:
    if pd.isna(series_value) or pd.isna(target_value):
        return False
    return str(series_value).strip().lower() == str(target_value).strip().lower()


def strict_filter(
    gdf: gpd.GeoDataFrame,
    village_code=None,
    subdistrict_code=None
) -> Tuple[gpd.GeoDataFrame, Dict[str, Any]]:
    debug_info = {
        'original_count': len(gdf),
        'available_columns': gdf.columns.tolist(),
        'column_mapping': {},
        'filter_applied': [],
        'matched_count': 0
    }

    col_mapping = get_column_mapping(gdf)
    debug_info['column_mapping'] = col_mapping

    filtered = gdf

    if village_code:
        if 'village_code' not in col_mapping:
            debug_info['error'] = "Village code column not found"
            return gdf.iloc[0:0], debug_info
        col = col_mapping['village_code']
        if not isinstance(village_code, list):
            village_code = [village_code]
        mask = gdf[col].apply(lambda x: any(safe_string_compare(x, vc) for vc in village_code))
        filtered = filtered[mask]
        debug_info['filter_applied'].append(f"village_code in {village_code}")

    if subdistrict_code:
        if 'subdistrict_code' not in col_mapping:
            debug_info['error'] = "Subdistrict code column not found"
            return gdf.iloc[0:0], debug_info
        col = col_mapping['subdistrict_code']
        if not isinstance(subdistrict_code, list):
            subdistrict_code = [subdistrict_code]
        mask = filtered[col].apply(lambda x: any(safe_string_compare(x, sc) for sc in subdistrict_code))
        filtered = filtered[mask]
        debug_info['filter_applied'].append(f"subdistrict_code in {subdistrict_code}")

    debug_info['matched_count'] = len(filtered)
    return filtered, debug_info


def parse_to_list(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [s.strip() for s in re.split(r'[,|]+', str(value)) if s.strip()]


def parse_period_to_months(period_str: str) -> List[str]:
    s = (period_str or '').strip().lower()
    tokens = re.split(r'[\s,/;-]+', s)
    tokens = [t[:3] for t in tokens if t[:3] in MONTHS]
    if not tokens:
        return []
    if len(tokens) == 2:
        a, b = tokens[0], tokens[1]
        ai, bi = MONTHS.index(a), MONTHS.index(b)
        if ai <= bi:
            return MONTHS[ai:bi+1]
        return MONTHS[ai:] + MONTHS[:bi+1]
    seen, out = set(), []
    for t in tokens:
        if t in MONTHS and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def batch_get_crop_data(db: Session, seasons: List[str], crops: List[str]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    """Batch fetch all crop data from SQLAlchemy Crop model"""

    filters = []
    seasons = [s.strip() for s in seasons if s and str(s).strip()]
    crops = [c.strip() for c in crops if c and str(c).strip()]

    if not seasons or not crops:
        return {}

    query = db.query(Crop)

    query = query.filter(Crop.season.in_(seasons), Crop.crop.in_(crops))
    rows = query.all()

    grouped: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for r in rows:
        key = (str(r.season).lower(), str(r.crop).lower())
        grouped.setdefault(key, []).append({
            "season": r.season,
            "crop": r.crop,
            "stage": r.stage,
            "period": r.period,
            "crop_factor": r.crop_factor
        })
    return grouped


def average_stage_deficit_for_row(row: pd.Series, months: List[str], kc: float) -> float:
    if not months:
        return 0.0
    terms = []
    for m in months:
        pet_col, pe_col = f"{PET_PREFIX}{m}", f"{PE_PREFIX}{m}"
        pet = float(row.get(pet_col, 0) or 0)
        pe = float(row.get(pe_col, 0) or 0)
        terms.append(max(pet * kc - pe, 0))
    return sum(terms) / len(terms) if terms else 0.0


def compute_for_village_row_optimized(
    row: pd.Series,
    seasons: List[str],
    crops: List[str],
    irrigation_intensity: float,
    crop_data_cache: Dict[Tuple[str, str], List[Dict[str, Any]]]
) -> Tuple[float, Dict[str, Any]]:
    details: Dict[str, Any] = {}
    total_index = 0.0

    for season in seasons:
        season_sum = 0.0
        details[season] = {}
        for crop in crops:
            key = (season.lower(), crop.lower())
            stage_rows = crop_data_cache.get(key, [])
            if not stage_rows:
                details[season][crop] = {"skipped": True, "reason": "No crop rows"}
                continue

            stages_info, crop_sum = [], 0.0
            for r in stage_rows:
                months = parse_period_to_months(r['period'])
                kc = float(r['crop_factor'])
                stage_avg_def = average_stage_deficit_for_row(row, months, kc)
                stages_info.append({
                    "stage": r['stage'],
                    "period": r['period'],
                    "crop_factor": kc,
                    "months": months,
                    "stage_avg_deficit": round(stage_avg_def, 3)
                })
                crop_sum += stage_avg_def

            crop_norm = crop_sum / irrigation_intensity if irrigation_intensity else 0.0
            season_sum += crop_norm
            details[season][crop] = {
                "stages": stages_info,
                "crop_stage_sum": round(crop_sum, 3),
                "crop_normalized": round(crop_norm, 3)
            }
        details[season]['season_sum'] = round(season_sum, 3)
        total_index += season_sum

    return total_index, details


def generate_crop_month_data(results: List[Dict], crops: List[str]) -> Dict[str, Any]:
    crop_monthly_data = {crop: [0]*12 for crop in crops}
    village_count = len(results) if results else 1

    for result in results:
        for season_name, season_data in result['seasons'].items():
            for crop in crops:
                if crop in season_data and isinstance(season_data[crop], dict):
                    crop_data = season_data[crop]
                    if 'stages' in crop_data:
                        for stage_info in crop_data['stages']:
                            months = stage_info.get('months', [])
                            deficit_value = stage_info.get('stage_avg_deficit', 0)
                            for month in months:
                                if month in MONTHS:
                                    month_idx = MONTHS.index(month)
                                    crop_monthly_data[crop][month_idx] += deficit_value

    for crop in crops:
        crop_monthly_data[crop] = [round(value / village_count, 3) for value in crop_monthly_data[crop]]

    months_display = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    return {
        "type": "scatter",
        "title": "Monthly Crop Water Demand by Crop (Discrete Points)",
        "x_label": "Month",
        "y_label": "Average Water Demand (mm)",
        "months": months_display,
        "crops_data": crop_monthly_data
    }


def generate_cumulative_data(results: List[Dict], crops: List[str]) -> Dict[str, Any]:
    cumulative_monthly_data = [0] * 12
    village_count = len(results) if results else 1
    for result in results:
        for season_name, season_data in result['seasons'].items():
            for crop in crops:
                if crop in season_data and isinstance(season_data[crop], dict):
                    crop_data = season_data[crop]
                    if 'stages' in crop_data:
                        for stage_info in crop_data['stages']:
                            months = stage_info.get('months', [])
                            deficit_value = stage_info.get('stage_avg_deficit', 0)
                            for month in months:
                                if month in MONTHS:
                                    month_idx = MONTHS.index(month)
                                    cumulative_monthly_data[month_idx] += deficit_value
    cumulative_monthly_data = [round(value / village_count, 3) for value in cumulative_monthly_data]

    months_display = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    return {
        "type": "line_area",
        "title": "Total Cumulative Water Demand (All Crops Combined)",
        "x_label": "Month",
        "y_label": "Total Water Demand (mm)",
        "months": months_display,
        "values": cumulative_monthly_data
    }


def generate_crop_water_demand_charts(
    results: List[Dict],
    gdf: gpd.GeoDataFrame,
    seasons: List[str],
    crops: List[str],
    irrigation_intensity: float
) -> Dict[str, Any]:
    individual_crops_data = generate_crop_month_data(results, crops)
    cumulative_data = generate_cumulative_data(results, crops)
    total_villages = len(results)
    total_demand = sum([result['village_demand'] for result in results])

    return {
        'individual_crops': individual_crops_data,
        'cumulative_demand': cumulative_data,
        'summary_stats': {
            'total_villages': total_villages,
            'total_demand_cubic_meters': round(total_demand, 2),
            'average_demand_per_village': round(total_demand / total_villages, 2) if total_villages > 0 else 0,
        }
    }


class AgriDemandService:
    def agri_demand_post(self, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        village_code = parse_to_list(payload.get("village_code"))
        subdistrict_code = parse_to_list(payload.get("subdistrict_code"))
        if not village_code and not subdistrict_code:
            raise HTTPException(status_code=400, detail="Either village_code or subdistrict_code is required")

        seasons = []
        seasons_data = payload.get("seasons") or {}
        if seasons_data.get("kharif"):
            seasons.append("Kharif")
        if seasons_data.get("rabi"):
            seasons.append("Rabi")
        if seasons_data.get("zaid"):
            seasons.append("Zaid")

        crops = []
        selected_crops = payload.get("selectedCrops", {})
        for _, crop_list in selected_crops.items():
            if isinstance(crop_list, list):
                crops.extend(crop_list)
        crops = list(dict.fromkeys(crops))

        if not seasons:
            seasons = parse_to_list(payload.get("season"))
        if not crops:
            crops = parse_to_list(payload.get("crop"))
        if not seasons:
            raise HTTPException(status_code=400, detail="At least one season must be selected")
        if not crops:
            raise HTTPException(status_code=400, detail="At least one crop must be selected")

        try:
            irrigation_intensity = float(payload.get("irrigationIntensity") or payload.get("irrigation_intensity") or 0.8)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="irrigationIntensity must be numeric") from exc
        if irrigation_intensity <= 0:
            raise HTTPException(status_code=400, detail="irrigationIntensity must be > 0")

        try:
            groundwater_factor = float(payload.get("groundwaterFactor") or payload.get("groundwater_factor") or 0.8)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="groundwaterFactor must be numeric") from exc

        include_charts = bool(payload.get("include_charts", False))
        gdf = load_villages_gdf()
        filtered, debug_info = strict_filter(gdf, village_code=village_code, subdistrict_code=subdistrict_code)
        if "error" in debug_info:
            raise HTTPException(status_code=400, detail=debug_info)
        if filtered.empty:
            raise HTTPException(status_code=404, detail={"error": "No villages matched", "debug_info": debug_info})

        col_mapping = get_column_mapping(gdf)
        crop_data_cache = batch_get_crop_data(db, seasons, crops)
        results = []
        for _, row in filtered.iterrows():
            total_index, details = compute_for_village_row_optimized(row, seasons, crops, irrigation_intensity, crop_data_cache)
            cropland_col = col_mapping.get("cropland", CROPLAND_COL)
            cropland = float(row.get(cropland_col, 0) or 0)
            village_demand = (total_index * cropland * groundwater_factor) / 100
            results.append(
                {
                    "village": row.get("village", "N/A"),
                    "village_code": row.get(col_mapping.get("village_code", "village_co")),
                    "subdistrict_code": row.get(col_mapping.get("subdistrict_code", "SUBDIS_COD")),
                    "cropland": cropland,
                    "seasons": details,
                    "index_sum_across_seasons_crops": total_index,
                    "groundwater_factor": groundwater_factor,
                    "village_demand": abs(village_demand) / 1000,
                }
            )

        response = {
            "success": True,
            "data": results,
            "seasons": seasons,
            "crops": crops,
            "villages_count": len(results),
            "debug_info": debug_info,
        }
        if include_charts:
            response["charts"] = generate_crop_water_demand_charts(results, gdf, seasons, crops, irrigation_intensity)
        return response

    def agri_demand_get(self, village_code: List[str], subdistrict_code: List[str]) -> Dict[str, Any]:
        gdf = load_villages_gdf()
        filtered, debug_info = strict_filter(gdf, village_code=village_code, subdistrict_code=subdistrict_code)
        col_mapping = get_column_mapping(gdf)
        sample_cols = ["village"]
        for key in ["village_code", "subdistrict_code", "cropland"]:
            if key in col_mapping:
                sample_cols.append(col_mapping[key])
        return {
            "villages_count": int(len(filtered)),
            "debug_info": debug_info,
            "column_mapping": col_mapping,
            "sample": filtered[sample_cols].head(20).to_dict(orient="records") if sample_cols else [],
        }

# ===== END agri_demand_service.py =====


# ===== BEGIN crop_service.py =====


class CropService:

    valid_seasons = ["Kharif", "Rabi", "Zaid"]

    @staticmethod
    def validate_season(season: str):
        """Validate season name."""
        if season not in CropService.valid_seasons:
            return False, f"Season must be one of: {', '.join(CropService.valid_seasons)}"
        return True, None

    @staticmethod
    def get_crops_by_season(db: Session, season: str):
        """Fetch crop list for a given season."""
        crops_query = db.query(Crop).filter(Crop.season.ilike(season))

        if crops_query.count() == 0:
            return {
                "success": True,
                "message": f"No crops found for season: {season}",
                "data": {
                    "season": season,
                    "crops": [],
                    "total_crops": 0,
                    "queried_at": datetime.now().isoformat()
                }
            }
        crop_names = [c.crop for c in crops_query.distinct(Crop.crop).all()]

        return {
            "success": True,
            "message": f"Crops retrieved successfully for season: {season}",
            "data": {
                "season": season,
                "crops": crop_names,
                "total_crops": len(crop_names),
                "queried_at": datetime.now().isoformat()
            }
        }

    @staticmethod
    def get_crops_by_season_endpoint(db: Session, payload):
        is_valid, error_msg = CropService.validate_season(payload.season)
        if not is_valid:
            raise HTTPException(status_code=400, detail={"error": "Invalid season", "message": error_msg})
        try:
            return CropService.get_crops_by_season(db, payload.season)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail={"error": "Query failed", "message": str(exc)}) from exc

# ===== END crop_service.py =====


# ===== BEGIN forecast_service.py =====


try:
    from statsmodels.tsa.arima.model import ARIMA
    STATSMODELS_AVAILABLE = True
    IMPORT_ERROR = None
except ImportError as e:
    STATSMODELS_AVAILABLE = False
    IMPORT_ERROR = str(e)


class ForecastService:

    def detect_year_columns(self, df):
        year_columns = []
        available_years = []
        year_pattern = re.compile(r'^\d{4}$')

        for col in df.columns:
            col_str = str(col).strip()
            if year_pattern.match(col_str):
                year = int(col_str)
                if 1900 <= year <= 2099:
                    year_columns.append(col)
                    available_years.append(year)

        if available_years:
            sorted_pairs = sorted(zip(available_years, year_columns))
            available_years = [p[0] for p in sorted_pairs]
            year_columns = [p[1] for p in sorted_pairs]

        return year_columns, available_years

    def extract_time_series(self, row, year_columns, available_years):
        values = [row.get(col, np.nan) for col in year_columns]
        ts = pd.Series(values, index=pd.to_datetime(available_years, format='%Y'))
        return ts.dropna()

    def linear_forecast(self, ts_data, target_years):
        try:
            x = np.arange(len(ts_data))
            y = ts_data.values

            slope, intercept = np.polyfit(x, y, 1)

            last_data_year = ts_data.index[-1].year
            filtered_years, filtered_values = [], []

            for target_year in target_years:
                if target_year > last_data_year:
                    years_ahead = target_year - last_data_year
                    future_x = len(ts_data) - 1 + years_ahead
                    predicted_value = slope * future_x + intercept
                    filtered_years.append(target_year)
                    filtered_values.append(float(predicted_value))

            forecast_data = {
                "years": filtered_years,
                "values": filtered_values,
                "confidence_interval": None
            }

            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

            model_summary = {
                "method": "Linear Regression",
                "slope": float(slope),
                "intercept": float(intercept),
                "r_squared": float(r_squared),
                "historical_data_points": len(ts_data)
            }

            return {"forecast_data": forecast_data, "model_summary": model_summary}

        except Exception:
            return None

    def arima_forecast(self, ts_data, target_years):
        try:
            max_year = max(target_years)
            last_data_year = ts_data.index[-1].year
            steps_needed = max_year - last_data_year

            if steps_needed <= 0:
                return None

            arima_orders = [
                (1, 1, 1), (0, 1, 1), (1, 0, 1),
                (0, 1, 0), (1, 1, 0), (2, 1, 1), (1, 1, 2)
            ]

            model_fit = None
            best_order = None

            for order in arima_orders:
                try:
                    model = ARIMA(ts_data, order=order)
                    model_fit = model.fit()
                    best_order = order
                    break
                except:
                    continue

            if model_fit is None:
                return None

            forecast = model_fit.forecast(steps=steps_needed)
            conf_int = model_fit.get_forecast(steps=steps_needed).conf_int()
            forecast_years = list(range(last_data_year + 1, last_data_year + steps_needed + 1))

            filtered_years = []
            filtered_values = []
            lower = []
            upper = []

            for y in target_years:
                if y in forecast_years:
                    idx = forecast_years.index(y)
                    filtered_years.append(y)
                    filtered_values.append(float(forecast.iloc[idx]))
                    lower.append(float(conf_int.iloc[idx, 0]))
                    upper.append(float(conf_int.iloc[idx, 1]))

            forecast_data = {
                "years": filtered_years,
                "values": filtered_values,
                "confidence_interval": {"lower": lower, "upper": upper}
            }

            model_summary = {
                "method": f"ARIMA{best_order}",
                "aic": float(model_fit.aic),
                "bic": float(model_fit.bic),
                "log_likelihood": float(model_fit.llf),
                "total_forecast_steps": steps_needed,
                "historical_data_points": len(ts_data)
            }

            return {"forecast_data": forecast_data, "model_summary": model_summary}

        except Exception:
            return None

    def process_forecast(self, method, forecast_type, target_years, csv_filename):
        csv_path = os.path.join(TEMP_DIR, csv_filename)

        if not os.path.exists(csv_path):
            return {"success": False, "message": f"CSV not found at {csv_path}"}

        df = pd.read_csv(csv_path)
        if df.empty:
            return {"success": False, "message": "CSV empty"}

        year_columns, available_years = self.detect_year_columns(df)
        if not year_columns:
            return {"success": False, "message": "No valid year columns found"}

        max_available_year = max(available_years)
        invalid_targets = [y for y in target_years if y <= max_available_year]

        if invalid_targets:
            return {"success": False,
                    "message": f"Target years must be > {max_available_year}. Invalid: {invalid_targets}"}

        results = []
        use_arima = (method == "arima" and STATSMODELS_AVAILABLE)

        for _, row in df.iterrows():
            ts = self.extract_time_series(row, year_columns, available_years)
            if ts.empty or len(ts) < 3:
                continue

            forecast = (
                self.arima_forecast(ts, target_years)
                if use_arima else self.linear_forecast(ts, target_years)
            )
            if not forecast:
                continue

            results.append({
                "village_info": {
                    "village": str(row.get("village")),
                },
                "historical_data": {
                    "years": ts.index.year.tolist(),
                    "values": ts.values.tolist(),
                },
                "forecast_data": forecast["forecast_data"],
                "model_summary": forecast["model_summary"]
            })

        return {
            "success": True,
            "method": method,
            "available_years": available_years,
            "villages": results
        }

    def generate_forecast(self, payload):
        try:
            result = self.process_forecast(
                method=payload.method,
                forecast_type=payload.forecast_type,
                target_years=payload.target_years,
                csv_filename=payload.timeseries_yearly_csv_filename,
            )
            if not result.get("success"):
                raise HTTPException(status_code=400, detail=result["message"])
            return result
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

# ===== END forecast_service.py =====


# ===== BEGIN gsr_service.py =====

matplotlib.use("Agg")

BASE_MEDIA = "media"   


def parse_to_list(value) -> List[str]:
    """Parses a string, list, or None into a list of strings"""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [s.strip() for s in re.split(r"[,\|]+", str(value)) if s.strip()]

def safe_string_compare(val1, val2) -> bool:
    """Safely compare two values as strings"""
    if pd.isna(val1) or pd.isna(val2):
        return False
    return str(val1).strip().lower() == str(val2).strip().lower()

def load_trend_data(trend_csv_filename: str) -> Dict[str, str]:
    """
    Load trend data from CSV file and return a mapping of Village_ID to trend_status
    """
    trend_map = {}
    
    if not trend_csv_filename:
        return trend_map
    
    try:
        csv_path = os.path.join(TEMP_DIR, trend_csv_filename)
        
        if not os.path.exists(csv_path):
            print(f"âš ï¸ Trend CSV file not found: {csv_path}")
            return trend_map
        
        trend_df = pd.read_csv(csv_path)
        print(f"ðŸ“„ Loaded trend CSV with {len(trend_df)} records from: {csv_path}")
        
        for _, row in trend_df.iterrows():
            village_id = str(row.get('Village_ID', '')).strip()
            trend_status = str(row.get('Trend_Status', 'Unknown')).strip()
            
            if village_id:
                trend_map[village_id] = trend_status
        
        print(f"ðŸŽ¯ Created trend mapping for {len(trend_map)} villages using Village_ID")
        
    except Exception as e:
        print(f"âŒ Error loading trend data: {str(e)}")
    
    return trend_map

def load_village_shapefile() -> Optional[gpd.GeoDataFrame]:
    """
    Load village shapefile from the specified path
    """
    try:
        shapefile_path = os.path.join(
            BASE_MEDIA, 
            'gwa_data', 
            'gwa_shp', 
            'Final_Village', 
            'Village.shp'
        )
        
        if not os.path.exists(shapefile_path):
            print(f"âš ï¸ Village shapefile not found: {shapefile_path}")
            return None
        
        village_gdf = gpd.read_file(shapefile_path)
        print(f"ðŸ—ºï¸ Loaded village shapefile with {len(village_gdf)} villages from: {shapefile_path}")
        print(f"ðŸ“‹ Shapefile columns: {list(village_gdf.columns)}")
        

        if 'village_co' in village_gdf.columns:
            village_gdf['village_co'] = village_gdf['village_co'].astype(str).str.strip()
            print(f"âœ… Found village_co column with {len(village_gdf['village_co'].unique())} unique values")
        else:
            print("âŒ village_co column not found in shapefile")
            return None
        
        return village_gdf
        
    except Exception as e:
        print(f"âŒ Error loading village shapefile: {str(e)}")
        return None

def merge_gsr_with_shapefile(gsr_results: List[Dict[str, Any]], village_gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
    """
    Merge GSR results with village shapefile and return GeoJSON
    Only includes villages that have GSR data (inner join)
    """
    try:
        
        gsr_df = pd.DataFrame(gsr_results)
        

        merged_gdf = village_gdf.merge(
            gsr_df, 
            left_on='village_co', 
            right_on='village_code', 
            how='inner'  
        )
        
        print(f"ðŸ”— Merged {len(merged_gdf)} villages with GSR data (inner join)")
        print(f"ðŸ“Š Original GSR data villages: {len(gsr_df)}")
        print(f"ðŸ“Š Shapefile villages: {len(village_gdf)}")
        print(f"ðŸ“Š Final merged villages: {len(merged_gdf)}")
        

        merged_gdf = merged_gdf.to_crs('EPSG:4326')
        
      
        geojson = merged_gdf.to_json()
        geojson_dict = json.loads(geojson)
        
        
        merge_stats = {
            'total_shapefile_villages': len(village_gdf),
            'total_gsr_villages': len(gsr_df),
            'villages_with_geospatial_data': len(merged_gdf),
            'villages_without_geospatial_data': len(gsr_df) - len(merged_gdf),
            'match_success_rate': round(len(merged_gdf) / len(gsr_df) * 100, 2) if len(gsr_df) > 0 else 0
        }
        
        return {
            'geojson': geojson_dict,
            'merge_statistics': merge_stats,
            'merged_gdf': merged_gdf  
        }
        
    except Exception as e:
        print(f"âŒ Error merging GSR data with shapefile: {str(e)}")
        return {
            'geojson': None,
            'merge_statistics': {
                'error': str(e),
                'total_shapefile_villages': len(village_gdf) if village_gdf is not None else 0,
                'total_gsr_villages': len(gsr_results),
                'villages_with_geospatial_data': 0,
                'villages_without_geospatial_data': len(gsr_results),
                'match_success_rate': 0
            },
            'merged_gdf': None
        }

def generate_gsr_map_image(merged_gdf: gpd.GeoDataFrame) -> Optional[str]:
    """
    Generate GSR classification map with performance optimizations.
    """
    try:
        import contextlib
        with contextlib.suppress(ImportError):
            import contextily as ctx
            
        if merged_gdf is None or len(merged_gdf) == 0:
            print("âš ï¸ No merged GeoDataFrame available for map generation")
            return None
        merged_gdf_simplified = merged_gdf.copy()
        merged_gdf_simplified['geometry'] = merged_gdf_simplified['geometry'].simplify(
            tolerance=0.0001,
            preserve_topology=True
        )

        merged_gdf_web = merged_gdf_simplified.to_crs(epsg=4326)

        fig, ax = plt.subplots(1, 1, figsize=(15, 12))

        classification_labels = merged_gdf_web['gsr_classification'].unique()
        classification_labels = [cl for cl in classification_labels if cl]

        colors = merged_gdf_web['gsr_classification'].map(get_classification_color).fillna('gray')

        merged_gdf_web.plot(
            ax=ax,
            color=colors,
            edgecolor='black',
            linewidth=0.75,
            alpha=1,
            rasterized=True  
        )

        try:
            if 'ctx' in locals():
                ctx.add_basemap(
                    ax,
                    crs=merged_gdf_web.crs,  
                    source=ctx.providers.CartoDB.Voyager,  
                    alpha=1,
                    zoom=10
                )
        except Exception as e:
            print(f"âš ï¸ Basemap loading failed: {e}")

        ax.set_title('GSR Classification Map\n(Groundwater Supply-Requirement Analysis)',
                     fontsize=16, fontweight='bold', pad=20)
        ax.set_xlabel('LONGITUDE', fontsize=12)
        ax.set_ylabel('LATITUDE', fontsize=12)

        classification_counts = merged_gdf_web['gsr_classification'].value_counts()
        
        legend_handles = []
        for cl in classification_labels:
            color = get_classification_color(cl)
            count = classification_counts.get(cl, 0)
            patch = mpatches.Patch(color=color, label=f"{cl} ({count})")
            legend_handles.append(patch)

        ax.legend(
            handles=legend_handles,
            title='GSR Classifications',
            title_fontsize=12,
            fontsize=10,
            loc='upper left',
            bbox_to_anchor=(1.02, 1),
            frameon=True,
            fancybox=True,
            shadow=True
        )

        ax.tick_params(axis='both', which='major', labelsize=10)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"gsr_map_{timestamp}_{unique_id}.png"
       
        filepath = os.path.join(TEMP_DIR, filename)

        buffer = BytesIO()
        
        plt.savefig(
            buffer,
            format='png',
            dpi=150,
            bbox_inches='tight',
            facecolor='white',
            edgecolor='none'
        )

        buffer.seek(0)
        with open(filepath, 'wb') as f:
            f.write(buffer.read())
        
        buffer.close()
        plt.close(fig)

        print(f"ðŸ—ºï¸ GSR map image saved successfully: {filepath}")
        print(f"ðŸ“Š Map contains {len(merged_gdf)} villages with GSR data")
        return filename

    except Exception as e:
        print(f"âŒ Error generating GSR map image: {str(e)}")
        plt.close('all')
        return None

def calculate_gsr_classification(gsr_value: float, trend_status: str) -> str:
    """
    Calculate GSR classification based on GSR ratio and trend status
    According to the classification table provided
    """
    if gsr_value is None:
        return "No Data"

    if trend_status == "No Trend Data":
        trend_status = "No Trend"
    

    trend_status = trend_status.strip().lower()
    
    if trend_status == "increasing":
        if gsr_value < 0.95:
            return "Critical"
        elif 0.95 <= gsr_value <= 1.05:
            return "Safe"
        else:  
            return "Very Safe"
    
    elif trend_status == "decreasing":
        if gsr_value < 0.95:
            return "Over Exploited"
        elif 0.95 <= gsr_value <= 1.05:
            return "Critical"
        else:  
            return "Very Semi-Critical"
    
    else:  
        if gsr_value < 0.95:
            return "Over Exploited"
        elif 0.95 <= gsr_value <= 1.05:
            return "Safe"
        else:  
            return "Very Safe"

def get_classification_color(classification: str) -> str:
    """
    Return CSS color name for each of the 6 classifications
    """
    color_map = {
        'Critical': 'red',
        'Safe': 'green',
        'Very Safe': 'teal',
        'Over Exploited': 'darkred',
        'Very Semi-Critical': 'orange',
        'No Data': 'transparent',
    }
    return color_map.get(classification, 'gray')

def match_village_data_combined(
    recharge_data: List[Dict[str, Any]],
    combined_demand_data: List[Dict[str, Any]],
    trend_csv_filename: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Match village data between recharge and combined demand datasets, and trend data
    Combined demand data already has domestic, agricultural, and industrial demand aggregated
    """

    trend_map = load_trend_data(trend_csv_filename) if trend_csv_filename else {}
    
    recharge_map = {}
    demand_map = {}
    
    for item in recharge_data:
        village_code = str(item.get('village_co', '')).strip()
        if village_code:
            recharge_map[village_code] = {
                'recharge': float(item.get('recharge', 0) or 0),
                'village_name': item.get('village_name', 'N/A'),
                'subdistrict_code': item.get('subdis_cod', item.get('subdistrict_code', 'N/A')),
                'raw_data': item
            }
    

    for item in combined_demand_data:
        village_code = str(item.get('village_code', '')).strip()
        if village_code:
            demand_map[village_code] = {
                'village_name': item.get('village_name', 'N/A'),
                'domestic_demand': float(item.get('domestic_demand', 0) or 0),
                'agricultural_demand': float(item.get('agricultural_demand', 0) or 0),
                'industrial_demand': float(item.get('industrial_demand', 0) or 0),
                'total_demand': float(item.get('total_demand', 0) or 0),  
                'raw_data': item
            }
    
    all_village_codes = set(recharge_map.keys()) | set(demand_map.keys())
    
    results = []
    
    for village_code in all_village_codes:

        recharge_info = recharge_map.get(village_code, {})
        demand_info = demand_map.get(village_code, {})
        
  
        recharge = recharge_info.get('recharge', 0)
        domestic_demand = demand_info.get('domestic_demand', 0)
        agricultural_demand = demand_info.get('agricultural_demand', 0)
        industrial_demand = demand_info.get('industrial_demand', 0)
        total_demand = demand_info.get('total_demand', 0)  
        
       
        village_name = demand_info.get('village_name') or recharge_info.get('village_name', 'N/A')
        subdistrict_code = recharge_info.get('subdistrict_code', 'N/A')

        if village_name == 'N/A':
            print(f"âš ï¸ No village name found for code {village_code}")
            print(f"   Recharge info: {recharge_info.get('village_name', 'missing')}")
            print(f"   Demand info: {demand_info.get('village_name', 'missing')}")
        
        if total_demand > 0:
            gsr = recharge / total_demand
            gsr_status = "Sustainable" if gsr >= 1.0 else "Stressed"
        else:
            gsr = None
            gsr_status = "No Demand"

        trend_status = trend_map.get(village_code, "No Trend Data")
        gsr_classification = calculate_gsr_classification(gsr, trend_status)
        classification_color = get_classification_color(gsr_classification)
        result = {
            'village_code': village_code,
            'village_name': village_name,
            'subdistrict_code': subdistrict_code,
            'recharge': round(recharge, 4),
            'domestic_demand': round(domestic_demand, 4),
            'agricultural_demand': round(agricultural_demand, 4),
            'industrial_demand': round(industrial_demand, 4),
            'total_demand': round(total_demand, 4),
            'gsr': round(gsr, 4) if gsr is not None else None,
            'gsr_status': gsr_status,
            'trend_status': trend_status,                  
            'gsr_classification': gsr_classification,       
            'classification_color': classification_color,    
            'has_recharge_data': village_code in recharge_map,
            'has_demand_data': village_code in demand_map,
            'has_trend_data': village_code in trend_map
        }
        
        results.append(result)
    
    return results

def calculate_gsr_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate summary statistics for GSR analysis including classification distribution"""
    
    if not results:
        return {}
    
    total_villages = len(results)
    total_recharge = sum(r['recharge'] for r in results)
    total_domestic = sum(r['domestic_demand'] for r in results)
    total_agricultural = sum(r['agricultural_demand'] for r in results)
    total_industrial = sum(r['industrial_demand'] for r in results)
    total_demand = sum(r['total_demand'] for r in results)
    

    sustainable_count = sum(1 for r in results if r['gsr_status'] == 'Sustainable')
    stressed_count = sum(1 for r in results if r['gsr_status'] == 'Stressed')
    no_demand_count = sum(1 for r in results if r['gsr_status'] == 'No Demand')
    

    trend_counts = {}
    villages_with_trend_data = sum(1 for r in results if r['has_trend_data'])
    
    for result in results:
        trend_status = result['trend_status']
        trend_counts[trend_status] = trend_counts.get(trend_status, 0) + 1
    

    classification_counts = {}
    for result in results:
        classification = result['gsr_classification']
        classification_counts[classification] = classification_counts.get(classification, 0) + 1
    

    overall_gsr = total_recharge / total_demand if total_demand > 0 else None
    

    valid_gsr_values = [r['gsr'] for r in results if r['gsr'] is not None]
    avg_gsr = sum(valid_gsr_values) / len(valid_gsr_values) if valid_gsr_values else 0
    
    return {
        'total_villages': total_villages,
        'total_recharge': round(total_recharge, 4),
        'total_domestic_demand': round(total_domestic, 4),
        'total_agricultural_demand': round(total_agricultural, 4),
        'total_industrial_demand': round(total_industrial, 4),
        'total_demand': round(total_demand, 4),
        'overall_gsr': round(overall_gsr, 4) if overall_gsr is not None else None,
        'average_gsr': round(avg_gsr, 4),
        'sustainable_villages': sustainable_count,
        'stressed_villages': stressed_count,
        'no_demand_villages': no_demand_count,
        'sustainability_percentage': round((sustainable_count / total_villages) * 100, 2) if total_villages > 0 else 0,
        'villages_with_trend_data': villages_with_trend_data,
        'trend_distribution': trend_counts,
        'classification_distribution': classification_counts  
    }


class GSRService:
    def decode_request_data(self, content_type: str, body: Dict[str, Any], form_data: Optional[Dict[str, Any]] = None):
        if "application/json" in content_type:
            if "zipped_data" in body:
                compressed_bytes = base64.b64decode(body["zipped_data"])
                with gzip.GzipFile(fileobj=BytesIO(compressed_bytes)) as gz:
                    return json.loads(gz.read().decode("utf-8"))
            return body
        if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            return form_data or {}
        return body

    async def compute_gsr_from_request(self, request):
        content_type = request.headers.get("content-type", "")
        try:
            body = await request.json()
        except Exception:
            body = {}

        form_data = None
        if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            form_data = dict(await request.form())

        data = self.decode_request_data(content_type, body, form_data)
        return self.compute_gsr(data)

    def compute_gsr(self, data: Dict[str, Any]) -> Dict[str, Any]:
        for key in ["rechargeData", "combinedDemandData", "selectedSubDistricts"]:
            if key in data and isinstance(data.get(key), str):
                try:
                    data[key] = json.loads(data[key])
                except json.JSONDecodeError:
                    data[key] = []

        recharge_data = data.get("rechargeData", [])
        combined_demand_data = data.get("combinedDemandData", [])
        selected_subdistricts = data.get("selectedSubDistricts", [])
        trend_csv_filename = data.get("trendCsvFilename")

        if not recharge_data:
            return {"success": False, "error": "Recharge data is required for GSR analysis"}
        if not combined_demand_data:
            return {"success": False, "error": "Combined demand data is required for GSR analysis"}

        matched_results = match_village_data_combined(recharge_data, combined_demand_data, trend_csv_filename)
        if not matched_results:
            return {"success": False, "error": "No villages could be matched across the provided datasets"}

        classification_priority = {
            "Over Exploited": 1,
            "Critical": 2,
            "Very Semi-Critical": 3,
            "Safe": 4,
            "Very Safe": 5,
            "Unknown Status": 6,
            "No Data": 7,
        }
        matched_results.sort(key=lambda x: (classification_priority.get(x["gsr_classification"], 999), -(x["gsr"] or 0)))

        summary = calculate_gsr_summary(matched_results)
        village_gdf = load_village_shapefile()
        geospatial_result = None
        map_image_filename = None
        map_image_base64 = None

        if village_gdf is not None:
            geospatial_result = merge_gsr_with_shapefile(matched_results, village_gdf)
            if geospatial_result.get("merged_gdf") is not None:
                map_image_filename = generate_gsr_map_image(geospatial_result["merged_gdf"])
                if map_image_filename:
                    map_image_path = os.path.join(TEMP_DIR, map_image_filename)
                    try:
                        with open(map_image_path, "rb") as img_file:
                            map_image_base64 = base64.b64encode(img_file.read()).decode("utf-8")
                    except Exception:
                        map_image_base64 = None
        else:
            geospatial_result = {
                "geojson": None,
                "merge_statistics": {
                    "error": "Village shapefile not found or could not be loaded",
                    "total_shapefile_villages": 0,
                    "total_gsr_villages": len(matched_results),
                    "villages_with_geospatial_data": 0,
                    "villages_without_geospatial_data": len(matched_results),
                    "match_success_rate": 0,
                },
            }

        return {
            "success": True,
            "message": f"GSR analysis completed successfully for {len(matched_results)} villages (using combined demand data)",
            "data": matched_results,
            "summary": summary,
            "metadata": {
                "selected_subdistricts": selected_subdistricts,
                "trend_csv_filename": trend_csv_filename,
                "map_image_filename": map_image_filename,
            },
            "villages_count": len(matched_results),
            "geospatial_data": geospatial_result["geojson"],
            "merge_statistics": geospatial_result["merge_statistics"],
            "map_image_filename": map_image_filename,
            "map_image_base64": f"data:image/png;base64,{map_image_base64}" if map_image_base64 else None,
        }

    def health_check(self):
        return {
            "service": "GSR Computation API with Combined Demand Data",
            "version": "3.0",
            "description": "Computes GSR analysis using pre-aggregated combined demand data from frontend",
        }

# ===== END gsr_service.py =====


# ===== BEGIN industrial_service.py =====




class IndustrialForecastService:

    def __init__(self, db: Session):
        self.db = db
        self.population_service = PopulationService(db)

    def compute_industrial_demand(
        self,
        csv_filename: str,
        groundwater_industrial_demand: float,
        village_codes: Optional[List[int]] = None,
        subdistrict_codes: Optional[List[int]] = None
    ) -> Dict[str, Any]:

        # --- Get villages ---
        if village_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.village_code.in_(village_codes))
                .all()
            )
        elif subdistrict_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.subdistrict_code.in_(subdistrict_codes))
                .all()
            )
        else:
            return {"status": "error", "message": "Provide village_codes or subdistrict_codes"}

        if not villages:
            return {"status": "error", "message": "No villages found"}

        forecasts_result = self.population_service.forecast(
            csv_filename=csv_filename,
            village_codes=village_codes,
            subdistrict_codes=subdistrict_codes
        )

        forecasts = forecasts_result.get("forecasts", [])
        if not forecasts:
            return {"status": "error", "message": "Population forecast returned no results"}

        forecast_map = {f["village_code"]: f["forecast_population"] for f in forecasts}

        total_forecast = sum(forecast_map.values())
        if total_forecast <= 0:
            return {"status": "error", "message": "Total forecast is zero"}

        final_output = []

        for f in forecasts:
            village_code = f["village_code"]
            village_name = f["village_name"]
            forecast_population = f["forecast_population"]

            ratio = forecast_population / total_forecast
            demand = (ratio * groundwater_industrial_demand)/1000


            final_output.append({
                "village_code": village_code,
                "Village_name": village_name,
                # "Forecast_Population": forecast_population,
                # "Ratio": round(ratio, 6),
                "Industrial_demand_(Million litres/Year)": round(demand, 3)
            })
 
        return {
            "status": "success",
            "total_forecast": total_forecast,
            "groundwater_industrial_demand": groundwater_industrial_demand,
            "data": final_output
        }

    def industrial_forecast(self, payload):
        result = self.compute_industrial_demand(
            csv_filename=payload.csv_filename,
            groundwater_industrial_demand=payload.groundwater_industrial_demand,
            village_codes=payload.village_codes,
            subdistrict_codes=payload.subdistrict_codes,
        )
        if result.get("status") == "error":
            raise HTTPException(status_code=400, detail=result.get("message"))
        return result

# ===== END industrial_service.py =====


# ===== BEGIN interpolation_service.py =====


# Configuration



class InterpolationService:
    """Service for raster interpolation and GeoServer publishing"""
    
    def __init__(self):
        self.temp_dir = Path(TEMP_DIR)
        
        if not VILLAGES_PATH.exists():
            print(f"[WARNING] Villages shapefile not found at: {VILLAGES_PATH}")
        else:
            print(f"[âœ“] Villages shapefile found: {VILLAGES_PATH}")
    
    def create_png_visualization(
        self, 
        raster_path: Path, 
        contour_geojson: Optional[Dict] = None, 
        output_path: Optional[Path] = None,
        parameter: str = '', 
        colors: Optional[List[str]] = None, 
        classification_breaks: Optional[List[float]] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """Create PNG image with raster overlay on basemap and optional contours."""
        print(f"[DEBUG] Creating PNG visualization for {parameter}")
        
        try:
            from rasterio.warp import reproject, calculate_default_transform
            import rasterio.enums
            
            with rasterio.open(raster_path) as src:
                raster_data = src.read(1)
                bounds = src.bounds
                original_crs = src.crs
                
                target_crs = 'EPSG:4326'
                
                transform, width, height = calculate_default_transform(
                    original_crs, target_crs, src.width, src.height, *bounds
                )
                
                dst_array = np.empty((height, width), dtype=src.dtypes[0])
                
                reproject(
                    source=raster_data,
                    destination=dst_array,
                    src_transform=src.transform,
                    src_crs=original_crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=rasterio.enums.Resampling.nearest
                )
                
                left = transform.c
                bottom = transform.f + transform.e * height
                right = transform.c + transform.a * width
                top = transform.f
                
                fig, ax = plt.subplots(figsize=(12, 10))
                
                if colors is not None and classification_breaks is not None:
                    cmap = ListedColormap(colors)
                    norm = BoundaryNorm(classification_breaks, len(colors))
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap=cmap, norm=norm, alpha=0.7, zorder=2, interpolation='nearest')
                else:
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap='viridis', alpha=0.7, zorder=2, interpolation='nearest')
                
                try:
                    ax.set_xlim(left, right)
                    ax.set_ylim(bottom, top)
                    ctx.add_basemap(
                        ax,
                        crs=target_crs,
                        source=ctx.providers.CartoDB.Voyager,
                        alpha=1,
                        zoom=10
                    )
                    print("[DEBUG] Basemap added successfully")
                except Exception as e:
                    print(f"[WARNING] Could not add basemap: {e}")
                
                if contour_geojson is not None and contour_geojson.get('features'):
                    print(f"[DEBUG] Adding {len(contour_geojson['features'])} contours to visualization")
                    transformer = pyproj.Transformer.from_crs(original_crs, target_crs, always_xy=True)
                    
                    for idx, feature in enumerate(contour_geojson['features']):
                        coords = np.array(feature['geometry']['coordinates'])
                        x_t, y_t = transformer.transform(coords[:, 0], coords[:, 1])
                        level = feature['properties']['level']
                        
                        ax.plot(x_t, y_t, color='black', linewidth=0.5, alpha=1, zorder=3)
                        
                        if len(contour_geojson['features']) < 20 or idx % 5 == 0:
                            mid_idx = len(x_t) // 2
                            ax.text(x_t[mid_idx], y_t[mid_idx], f'{level:.1f}', fontsize=8,
                                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=1),
                                   zorder=4)
                
                cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
                cbar.set_label(parameter, rotation=270, labelpad=20)
                
                ax.set_xlabel('LONGITUDE', fontsize=12)
                ax.set_ylabel('LATITUDE', fontsize=12)
                ax.set_title(f'{parameter} Interpolation with Contours', fontsize=14, fontweight='bold')
                ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
                plt.tight_layout()
                
                if output_path is None:
                    output_path = self.temp_dir / f"visualization_{parameter}_{uuid.uuid4().hex[:8]}.png"
                    output_path = self.temp_dir / f"visualization_{parameter}_{uuid.uuid4().hex[:8]}.png"
                
                plt.savefig(output_path, dpi=150, bbox_inches='tight',
                           facecolor='white', edgecolor='none',
                           pil_kwargs={'compress_level': 1})
                
                print(f"[DEBUG] PNG saved to: {output_path}")
                
                with open(output_path, 'rb') as f:
                    image_base64 = base64.b64encode(f.read()).decode('utf-8')
                
                plt.close(fig)
                return str(output_path), image_base64
                
        except Exception as e:
            print(f"[ERROR] PNG visualization error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None, None

    def generate_contours_as_geojson(
        self, 
        raster_path: Path, 
        contour_interval: Optional[float] = None, 
        smooth: bool = True, 
        quality: str = 'balanced'
    ) -> Optional[Dict]:
        """Generate contours from raster as GeoJSON."""
        print(f"[DEBUG] Generating contours (quality={quality}) from raster: {raster_path}")
        
        quality_settings = {
            'fast': {
                'upscale_factor': 1,
                'gaussian_sigma': 0.5,
                'smooth_method': 'simple',
                'simplify_tolerance': 2.0,
                'max_points_per_contour': 500
            },
            'balanced': {
                'upscale_factor': 2,
                'gaussian_sigma': 1.0,
                'smooth_method': 'savgol',
                'simplify_tolerance': 1.0,
                'max_points_per_contour': 1000
            },
            'high': {
                'upscale_factor': 3,
                'gaussian_sigma': 1.5,
                'smooth_method': 'bspline',
                'simplify_tolerance': 0.5,
                'max_points_per_contour': 2000
            }
        }
        
        settings_dict = quality_settings.get(quality, quality_settings['balanced'])
        
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1)
                transform = src.transform
                crs = src.crs
                
                valid_mask = ~np.isnan(data)
                if np.sum(valid_mask) == 0:
                    print("[ERROR] No valid data in raster for contour generation")
                    return None
                    
                data_min, data_max = np.nanmin(data), np.nanmax(data)
                print(f"[DEBUG] Raster data range: {data_min:.3f} to {data_max:.3f}")
                
                upscale_factor = settings_dict['upscale_factor']
                if upscale_factor > 1:
                    from scipy.ndimage import zoom
                    upsampled_data = zoom(data, upscale_factor, order=1, mode='nearest', prefilter=False)
                    upsampled_transform = rasterio.Affine(
                        transform.a / upscale_factor, transform.b, transform.c,
                        transform.d, transform.e / upscale_factor, transform.f
                    )
                else:
                    upsampled_data = data.copy()
                    upsampled_transform = transform
                
                from scipy.ndimage import gaussian_filter
                valid_upsampled = ~np.isnan(upsampled_data)
                if np.sum(valid_upsampled) > 0:
                    smoothed_data = gaussian_filter(
                        upsampled_data,
                        sigma=settings_dict['gaussian_sigma'],
                        mode='nearest',
                        truncate=3.0
                    )
                    smoothed_data[~valid_upsampled] = np.nan
                else:
                    smoothed_data = upsampled_data
                
                if contour_interval is None or contour_interval <= 0:
                    max_contours = 15 if quality == 'fast' else 20
                    contour_levels = np.linspace(data_min, data_max, min(11, max_contours))[1:-1]
                else:
                    start_level = np.ceil(data_min / contour_interval) * contour_interval
                    end_level = np.floor(data_max / contour_interval) * contour_interval
                    if start_level <= end_level:
                        contour_levels = np.arange(start_level, end_level + contour_interval, contour_interval)
                        if len(contour_levels) > 50:
                            contour_levels = contour_levels[::2]
                    else:
                        contour_levels = np.array([np.nanmean(data)])
                
                data_for_contour = smoothed_data.copy()
                nan_mask = np.isnan(data_for_contour)
                
                if np.sum(nan_mask) > 0:
                    data_for_contour[nan_mask] = data_min - abs(data_max - data_min)
                
                geojson_features = []
                contour_statistics = {
                    'total_contours': 0,
                    'contour_levels': [],
                    'elevation_range': {'min': float(data_min), 'max': float(data_max)},
                    'contour_interval': contour_interval,
                    'quality_setting': quality
                }
                
                for level in contour_levels:
                    try:
                        contours = measure.find_contours(data_for_contour, level)
                        
                        for contour_idx, contour in enumerate(contours):
                            if len(contour) < 6:
                                continue
                            
                            if len(contour) > settings_dict['max_points_per_contour']:
                                step = len(contour) // settings_dict['max_points_per_contour']
                                contour = contour[::step]
                            
                            contour_coords = []
                            for point in contour:
                                row, col = float(point[0]), float(point[1])
                                x, y = rasterio.transform.xy(upsampled_transform, row, col)
                                contour_coords.append([float(x), float(y)])
                            
                            if len(contour_coords) < 3:
                                continue
                            
                            if smooth:
                                if settings_dict['smooth_method'] == 'simple':
                                    contour_coords = self.fast_simple_smooth(contour_coords)
                                elif settings_dict['smooth_method'] == 'savgol':
                                    contour_coords = self.fast_savgol_smooth(contour_coords)
                                else:
                                    contour_coords = self.fast_bspline_smooth(contour_coords)
                            
                            if len(contour_coords) >= 3:
                                feature = {
                                    "type": "Feature",
                                    "geometry": {
                                        "type": "LineString",
                                        "coordinates": contour_coords
                                    },
                                    "properties": {
                                        "level": float(level),
                                        "elevation": float(level),
                                        "contour_id": f"contour_{level}_{contour_idx}",
                                        "interval": contour_interval if contour_interval else "auto"
                                    }
                                }
                                geojson_features.append(feature)
                                contour_statistics['total_contours'] += 1
                                
                    except Exception as level_error:
                        print(f"[WARNING] Failed at level {level}: {str(level_error)}")
                        continue
                
                if geojson_features:
                    levels = [f['properties']['level'] for f in geojson_features]
                    contour_statistics['contour_levels'] = sorted(list(set(levels)))
                
                if not geojson_features:
                    print("[WARNING] No contours generated")
                    return None
                
                return {
                    "type": "FeatureCollection",
                    "crs": {"type": "name", "properties": {"name": str(crs)}},
                    "features": geojson_features,
                    "properties": {
                        "statistics": contour_statistics,
                        "generated_from": str(raster_path.name),
                        "generation_method": f"optimized_{quality}_contours"
                    }
                }
                
        except Exception as e:
            print(f"[ERROR] Contour generation error: {str(e)}")
            return None

    def fast_simple_smooth(self, coords: List, window: int = 3) -> List:
        """Ultra-fast simple smoothing."""
        if len(coords) < window:
            return coords
        
        coords = np.array(coords)
        smoothed = coords.copy()
        
        for i in range(1, len(coords) - 1):
            smoothed[i] = (coords[i-1] + 2*coords[i] + coords[i+1]) / 4.0
        
        return smoothed.tolist()

    def fast_savgol_smooth(self, coords: List, window: int = 5) -> List:
        """Fast Savitzky-Golay smoothing."""
        try:
            from scipy.signal import savgol_filter
            
            if len(coords) < window:
                return coords
            
            coords = np.array(coords)
            window = min(window, len(coords) if len(coords) % 2 == 1 else len(coords) - 1)
            
            if window < 3:
                return coords.tolist()
            
            smooth_x = savgol_filter(coords[:, 0], window, 2, mode='nearest')
            smooth_y = savgol_filter(coords[:, 1], window, 2, mode='nearest')
            
            return list(zip(smooth_x, smooth_y))
        except:
            return self.fast_simple_smooth(coords)

    def fast_bspline_smooth(self, coords: List, max_points: int = 200) -> List:
        """Fast B-spline smoothing with point limiting."""
        try:
            from scipy import interpolate
            
            if len(coords) < 6:
                return coords
            
            if len(coords) > max_points:
                step = len(coords) // max_points
                coords = coords[::step]
            
            coords = np.array(coords)
            x, y = coords[:, 0], coords[:, 1]
            
            tck, _ = interpolate.splprep([x, y], s=len(coords)*0.2, k=3)
            u_new = np.linspace(0, 1, len(coords))
            smooth_coords = interpolate.splev(u_new, tck)
            
            return list(zip(smooth_coords[0], smooth_coords[1]))
        except:
            return self.fast_savgol_smooth(coords)

    def get_arcmap_colors(self, parameter: str, data_type: Optional[str] = None) -> Tuple[List[str], List[str]]:
        """Get ArcMap-style colors for parameter."""
        if parameter == 'gwl' or (parameter == 'RL' and data_type in ['PRE', 'POST']):
            colors = ['#08306b','#2171b5','#6baed6','#c6dbef','#fee0d2','#fc9272','#de2d26','#a50f15']
            labels = ['Very High','High','Moderately High','Moderate','Moderately Low','Low','Very Low','Extremely Low']
        elif parameter == 'RL':
            colors = ['#00441b','#238b45','#74c476','#bae4b3','#edf8e9','#fee6ce','#fd8d3c','#d94701','#8c2d04']
            labels = ['Very Low','Low','Moderately Low','Moderate','Moderately High','High','Very High','Extremely High','Peak']
        else:
            colors = ['#313695','#4575b4','#74add1','#abd9e9','#e0f3f8','#fee090','#fdae61','#f46d43','#d73027']
            labels = ['Level 1','Level 2','Level 3','Level 4','Level 5','Level 6','Level 7','Level 8','Level 9']
        return colors, labels

    def create_colored_raster(self, data: np.ndarray, colors: List[str], num_classes: int = 8) -> Tuple[np.ndarray, np.ndarray]:
        """Create colored raster with classification."""
        print(f"[DEBUG] Creating colored raster with {num_classes} classes")
        valid_data = data[~np.isnan(data)]
        
        if len(valid_data) == 0:
            print("[ERROR] No valid data for classification")
            return np.zeros((*data.shape, 3), dtype=np.uint8), np.array([])
        
        percentiles = np.linspace(0, 100, num_classes + 1)
        breaks = np.percentile(valid_data, percentiles)
        breaks = np.unique(breaks)
        
        if len(breaks) < 2:
            data_min, data_max = np.min(valid_data), np.max(valid_data)
            if data_min == data_max:
                breaks = np.array([data_min - 0.1, data_max + 0.1])
            else:
                breaks = np.linspace(data_min, data_max, num_classes + 1)
        
        if len(colors) > len(breaks) - 1:
            colors = colors[:len(breaks) - 1]
        elif len(colors) < len(breaks) - 1:
            from matplotlib.colors import LinearSegmentedColormap
            cmap = LinearSegmentedColormap.from_list("custom", colors, N=len(breaks) - 1)
            colors = [mcolors.to_hex(cmap(i / (len(breaks) - 2))) for i in range(len(breaks) - 1)]
        
        colored_image = np.zeros((*data.shape, 3), dtype=np.uint8)
        
        for i in range(len(breaks) - 1):
            if i == len(breaks) - 2:
                mask_sel = (data >= breaks[i]) & (data <= breaks[i + 1])
            else:
                mask_sel = (data >= breaks[i]) & (data < breaks[i + 1])
            
            hex_color = colors[i].lstrip('#')
            rgb = tuple(int(hex_color[j:j+2], 16) for j in (0, 2, 4))
            colored_image[mask_sel] = rgb
        
        nan_mask = np.isnan(data)
        colored_image[nan_mask] = [0, 0, 0]
        
        return colored_image, breaks

    def create_workspace(self) -> bool:
        """Create GeoServer workspace if not exists."""
        rest_base = GEOSERVER_URL.rstrip("/")
        if not rest_base.endswith("/rest"):
            rest_base = f"{rest_base}/rest"
        url = f"{rest_base}/workspaces"
        rest_base = GEOSERVER_URL.rstrip("/")
        if not rest_base.endswith("/rest"):
            rest_base = f"{rest_base}/rest"
        url = f"{rest_base}/workspaces"
        headers = {"Content-Type": "text/xml"}
        data = f"<workspace><name>{WORKSPACE}</name></workspace>"
        
        try:
            check_url = f"{rest_base}/workspaces/{WORKSPACE}"
            check_url = f"{rest_base}/workspaces/{WORKSPACE}"
            check_response = requests.get(
                check_url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                timeout=10
            )
            
            if check_response.status_code == 200:
                print(f"[âœ“] Workspace '{WORKSPACE}' already exists.")
                return True
            
            response = requests.post(
                url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                headers=headers,
                data=data,
                timeout=10
            )
            
            if response.status_code in [201, 409]:
                print(f"[âœ“] Workspace '{WORKSPACE}' created or already exists.")
                return True
            
            print(f"[ERROR] Workspace create failed [{response.status_code}]: {response.text[:300]}")
            print(f"[ERROR] Workspace create failed [{response.status_code}]: {response.text[:300]}")
            return False
        except Exception as e:
            print(f"[ERROR] Workspace creation error: {str(e)}")
            return False

    def publish_geotiff(self, tiff_path: Path, store_name: str) -> bool:
        """Publish GeoTIFF to GeoServer."""
        rest_base = GEOSERVER_URL.rstrip("/")
        if not rest_base.endswith("/rest"):
            rest_base = f"{rest_base}/rest"
        upload_url = f"{rest_base}/workspaces/{WORKSPACE}/coveragestores/{store_name}/file.geotiff"
        rest_base = GEOSERVER_URL.rstrip("/")
        if not rest_base.endswith("/rest"):
            rest_base = f"{rest_base}/rest"
        upload_url = f"{rest_base}/workspaces/{WORKSPACE}/coveragestores/{store_name}/file.geotiff"
        headers = {"Content-type": "image/tiff"}
        
        try:
            with open(tiff_path, 'rb') as f:
                upload_response = requests.put(
                    upload_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers=headers,
                    data=f,
                    timeout=30
                )
            
            if upload_response.status_code not in [200, 201, 202]:
                print(f"[ERROR] GeoTIFF publish failed [{upload_response.status_code}]: {upload_response.text[:300]}")
                print(f"[ERROR] GeoTIFF publish failed [{upload_response.status_code}]: {upload_response.text[:300]}")
                return False
            
            return True
        except Exception as e:
            print(f"[ERROR] GeoTIFF publish error: {str(e)}")
            return False

    def arcgis_style_idw_ckdtree(
        self,
        coords_xy: np.ndarray,
        values: np.ndarray,
        grid_transform: rasterio.Affine,
        grid_shape: Tuple[int, int],
        power: float = 2.0,
        search_mode: str = "variable",
        n_neighbors: int = 12,
        radius: Optional[float] = None
    ) -> np.ndarray:
        """ArcGIS-style IDW interpolation using cKDTree."""
        print(f"[DEBUG] cKDTree IDW | mode={search_mode}, k={n_neighbors}, power={power}")
        
        rows, cols = int(grid_shape[0]), int(grid_shape[1])
        
        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
        
        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        k = min(max(1, int(n_neighbors)), coords_xy.shape[0])
        
        tree = cKDTree(coords_xy)
        
        if search_mode == "variable":
            dists, idxs = tree.query(xi, k=k)
            if k == 1:
                dists = dists[:, np.newaxis]
                idxs = idxs[:, np.newaxis]
            dists[dists == 0] = 1e-10
            weights = 1.0 / (dists ** float(power))
            numer = np.sum(weights * values[idxs], axis=1)
            denom = np.sum(weights, axis=1)
            vals = numer / denom
        elif search_mode == "fixed":
            if radius is None or float(radius) <= 0:
                raise ValueError("Fixed search requires positive radius")
            r = float(radius)
            neighbor_lists = tree.query_ball_point(xi, r=r)
            vals = np.empty(len(xi), dtype=np.float64)
            for i, neighbors in enumerate(neighbor_lists):
                if not neighbors:
                    vals[i] = np.nan
                    continue
                d = np.linalg.norm(coords_xy[neighbors] - xi[i], axis=1)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                vals[i] = np.sum(w * values[neighbors]) / np.sum(w)
        else:
            N = len(xi)
            chunk = 200000
            out = np.empty(N, dtype=np.float64)
            for s in range(0, N, chunk):
                e = min(s + chunk, N)
                xchunk = xi[s:e]
                d = np.linalg.norm(coords_xy[None, :, :] - xchunk[:, None, :], axis=2)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                numer = w.dot(values)
                denom = np.sum(w, axis=1)
                out[s:e] = numer / denom
            vals = out
        
        grid = vals.reshape(rows, cols).astype(np.float32)
        return grid

    def kriging_interpolation(self, points: np.ndarray, values: np.ndarray, grid_x: np.ndarray, grid_y: np.ndarray) -> np.ndarray:
        """Kriging-like interpolation using RBF."""
        data_std = np.std(values)
        epsilon = data_std / 10 if data_std > 0 else 1
        
        try:
            rbf = Rbf(points[:, 0], points[:, 1], values,
                      function='multiquadric', epsilon=epsilon, smooth=0.1)
            xi, yi = np.meshgrid(grid_x, grid_y)
            zi = rbf(xi, yi)
            return zi
        except:
            try:
                rbf = Rbf(points[:, 0], points[:, 1], values,
                          function='gaussian', epsilon=epsilon, smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                return zi
            except:
                rbf = Rbf(points[:, 0], points[:, 1], values,
                          function='linear', smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                return zi

    def spline_interpolation(self, points: np.ndarray, values: np.ndarray, grid_x: np.ndarray, grid_y: np.ndarray) -> np.ndarray:
        """Spline interpolation using griddata."""
        xi, yi = np.meshgrid(grid_x, grid_y)
        try:
            zi = griddata(points, values, (xi, yi), method='cubic', fill_value=np.nan)
            nan_percentage = np.sum(np.isnan(zi)) / zi.size * 100
            if nan_percentage > 50:
                zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        except:
            zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        return zi

    def process_interpolation(
        self,
        csv_path: Path,
        parameter: str,
        method: str,
        village_ids: List,
        place: str,
        create_colored: bool = True,
        contour_interval: Optional[float] = None,
        generate_contours: bool = False,
        search_mode: str = 'variable',
        n_neighbors: int = 12,
        radius: Optional[float] = None,
        power: float = 2.0,
        cell_size: float = 30.0
    ) -> Dict[str, Any]:
        """Main interpolation processing pipeline."""
        
        df = pd.read_csv(csv_path)
        required_columns = ['LONGITUDE', 'LATITUDE', parameter]
        df = df.dropna(subset=required_columns)
        
        if df.empty:
            raise ValueError('No valid data in CSV')
        
        x = df['LONGITUDE'].values
        y = df['LATITUDE'].values
        z = df[parameter].astype(float).values

        if method == 'idw' and len(x) < 3:
            raise ValueError(
                f"IDW interpolation requires minimum 3 data points. "
                f"Found only {len(x)} points. Please choose at least three points."
            )

        
        # Generate store name
        csv_name = Path(csv_path).stem
        store_name = f"interpolated_raster_{csv_name}_{parameter.replace(' ', '_')}"
        
        # Load and filter villages
        villages_vector = gpd.read_file(VILLAGES_PATH)
        
        if villages_vector.crs is None:
            villages_vector.set_crs("EPSG:4326", inplace=True)
        if villages_vector.crs != "EPSG:4326":
            villages_vector = villages_vector.to_crs("EPSG:4326")
        
        if place == "village":
            village_ids = [float(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['village_co'].isin(village_ids)]
        elif place == "subdistrict":
            village_ids = [int(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids)]
        else:
            raise ValueError("Invalid place parameter")
        
        if selected_area.empty:
            raise ValueError(f"No {place}s found for provided IDs")
        
        selected_area_utm = selected_area.to_crs("EPSG:32644")
        
        # Prepare points in UTM
        points_gdf = gpd.GeoDataFrame(
            {'val': z},
            geometry=gpd.points_from_xy(x, y, crs="EPSG:4326")
        ).to_crs("EPSG:32644")
        
        coords_xy = np.array([(geom.x, geom.y) for geom in points_gdf.geometry], dtype=np.float64)
        values = points_gdf['val'].astype(float).values
        
        # Calculate grid extent
        sel_minx, sel_miny, sel_maxx, sel_maxy = selected_area_utm.total_bounds
        pts_minx, pts_miny = coords_xy[:,0].min(), coords_xy[:,1].min()
        pts_maxx, pts_maxy = coords_xy[:,0].max(), coords_xy[:,1].max()
        
        minx = min(sel_minx, pts_minx) - cell_size
        miny = min(sel_miny, pts_miny) - cell_size
        maxx = max(sel_maxx, pts_maxx) + cell_size
        maxy = max(sel_maxy, pts_maxy) + cell_size
        
        cols = int(np.ceil((maxx - minx) / cell_size))
        rows = int(np.ceil((maxy - miny) / cell_size))
        proj_transform = from_origin(minx, maxy, cell_size, cell_size)
        
        print(f"[DEBUG] Grid: rows={rows}, cols={cols}, cell_size={cell_size}m")
        
        if method == 'idw':
            Z_proj = self.arcgis_style_idw_ckdtree(
                coords_xy=coords_xy,
                values=values,
                grid_transform=proj_transform,
                grid_shape=(rows, cols),
                power=power,
                search_mode=search_mode,
                n_neighbors=n_neighbors,
                radius=radius
            )
        elif method == 'kriging':
            xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
            ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
            Z_proj = self.kriging_interpolation(coords_xy, values, xs, ys)
        elif method == 'spline':
            xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
            ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
            Z_proj = self.spline_interpolation(coords_xy, values, xs, ys)
        else:
            raise ValueError("Invalid interpolation method")
        
        # Statistics
        z_min, z_max = np.nanmin(Z_proj), np.nanmax(Z_proj)
        z_mean, z_std = np.nanmean(Z_proj), np.nanstd(Z_proj)
        nan_percentage = np.sum(np.isnan(Z_proj)) / Z_proj.size * 100.0
        
        print(f"[DEBUG] Data range: min={z_min:.3f}, max={z_max:.3f}, mean={z_mean:.3f}")
        
        # Create initial raster
        initial_tiff_path = self.temp_dir / f"{store_name}_initial_utm.tif"
        initial_tiff_path = self.temp_dir / f"{store_name}_initial_utm.tif"
        height, width = Z_proj.shape
        
        with rasterio.open(
            initial_tiff_path,
            'w',
            driver='GTiff',
            height=int(height),
            width=int(width),
            count=1,
            dtype=rasterio.float32,
            crs='EPSG:32644',
            transform=proj_transform,
            nodata=np.nan
        ) as dst:
            dst.write(Z_proj.astype(rasterio.float32), 1)
        
        # Create colored raster if requested
        colored_tiff_path = None
        classification_breaks = None
        colors = None
        
        if create_colored:
            colors, labels = self.get_arcmap_colors(parameter)
            colored_grid, classification_breaks = self.create_colored_raster(Z_proj, colors, num_classes=len(colors))
            colored_tiff_path = self.temp_dir / f"{store_name}_colored_utm.tif"
            colored_tiff_path = self.temp_dir / f"{store_name}_colored_utm.tif"
            
            height_c, width_c, bands = colored_grid.shape
            
            with rasterio.open(
                colored_tiff_path,
                'w',
                driver='GTiff',
                height=int(height_c),
                width=int(width_c),
                count=3,
                dtype=rasterio.uint8,
                crs='EPSG:32644',
                transform=proj_transform,
                nodata=0
            ) as dst:
                for i in range(3):
                    dst.write(colored_grid[:, :, i], i + 1)
        
        # Mask to village boundaries
        masked_tiff_path = self.temp_dir / f"{store_name}_masked_utm.tif"
        masked_tiff_path = self.temp_dir / f"{store_name}_masked_utm.tif"
        masked_colored_path = None
        
        with rasterio.open(initial_tiff_path) as src:
            valid_geometries = [geom if geom.is_valid else geom.buffer(0) 
                            for geom in selected_area_utm.geometry if geom.is_valid or geom.buffer(0).is_valid]
            
            try:
                unified_geometry = unary_union(valid_geometries)
                mask_geometries = [unified_geometry] if unified_geometry.is_valid else valid_geometries
            except:
                mask_geometries = valid_geometries
            
            out_image, out_transform = mask(
                dataset=src,
                shapes=mask_geometries,
                crop=True,
                nodata=np.nan,
                all_touched=True,
                invert=False,
                filled=True
            )
            
            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform,
                "nodata": np.nan
            })
            
            with rasterio.open(masked_tiff_path, "w", **out_meta) as dest:
                dest.write(out_image)
        
        if create_colored and colored_tiff_path:
            masked_colored_path = self.temp_dir / f"{store_name}_colored_masked_utm.tif"
            masked_colored_path = self.temp_dir / f"{store_name}_colored_masked_utm.tif"
            with rasterio.open(colored_tiff_path) as src_colored:
                out_image_colored, out_transform_colored = mask(
                    dataset=src_colored,
                    shapes=mask_geometries,
                    crop=True,
                    nodata=0,
                    all_touched=True,
                    invert=False,
                    filled=True
                )
                
                out_meta_colored = src_colored.meta.copy()
                out_meta_colored.update({
                    "driver": "GTiff",
                    "height": out_image_colored.shape[1],
                    "width": out_image_colored.shape[2],
                    "transform": out_transform_colored,
                    "nodata": 0
                })
                
                with rasterio.open(masked_colored_path, "w", **out_meta_colored) as dest_colored:
                    dest_colored.write(out_image_colored)
        
        # Final UTM reprojection
        final_tiff_path = self.temp_dir / f"{store_name}_final_utm.tif"
        final_tiff_path = self.temp_dir / f"{store_name}_final_utm.tif"
        final_colored_path = None
        
        with rasterio.open(masked_tiff_path) as src:
            dst_crs = 'EPSG:32644'
            transform_out, width_out, height_out = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=30
            )
            
            kwargs = src.meta.copy()
            kwargs.update({'crs': dst_crs, 'transform': transform_out, 'width': width_out, 'height': height_out})
            
            with rasterio.open(final_tiff_path, 'w', **kwargs) as dst:
                reproject(
                    source=rasterio.band(src, 1),
                    destination=rasterio.band(dst, 1),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform_out,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear,
                    dst_nodata=np.nan
                )
        
        if create_colored and masked_colored_path:
            final_colored_path = self.temp_dir / f"{store_name}_colored_final_utm.tif"
            final_colored_path = self.temp_dir / f"{store_name}_colored_final_utm.tif"
            with rasterio.open(masked_colored_path) as src_colored:
                dst_crs = 'EPSG:32644'
                transform_c, width_c, height_c = calculate_default_transform(
                    src_colored.crs, dst_crs, src_colored.width, src_colored.height, 
                    *src_colored.bounds, resolution=30
                )
                
                kwargs_c = src_colored.meta.copy()
                kwargs_c.update({'crs': dst_crs, 'transform': transform_c, 'width': width_c, 'height': height_c})
                
                with rasterio.open(final_colored_path, 'w', **kwargs_c) as dst_colored:
                    for i in range(3):
                        reproject(
                            source=rasterio.band(src_colored, i + 1),
                            destination=rasterio.band(dst_colored, i + 1),
                            src_transform=src_colored.transform,
                            src_crs=src_colored.crs,
                            dst_transform=transform_c,
                            dst_crs=dst_crs,
                            resampling=Resampling.nearest,
                            dst_nodata=0
                        )
        
        # Cleanup intermediate files
        for temp_file in [initial_tiff_path, masked_tiff_path, colored_tiff_path, masked_colored_path]:
            if temp_file and temp_file.exists():
                os.remove(temp_file)
        
        # Generate contours
        contour_geojson = None
        if generate_contours and final_tiff_path.exists():
            contour_geojson = self.generate_contours_as_geojson(final_tiff_path, contour_interval)
        
        # Generate PNG visualization
        png_path = None
        png_base64 = None
        if final_tiff_path.exists():
            png_output_path = self.temp_dir / f"{store_name}_visualization.png"
            png_output_path = self.temp_dir / f"{store_name}_visualization.png"
            viz_colors = colors if create_colored else None
            viz_breaks = classification_breaks if create_colored else None
            
            png_path, png_base64 = self.create_png_visualization(
                raster_path=final_tiff_path,
                contour_geojson=contour_geojson,
                output_path=png_output_path,
                parameter=parameter,
                colors=viz_colors,
                classification_breaks=viz_breaks
            )
        
        # Publish to GeoServer
        if not self.create_workspace():
            raise Exception("Failed to create GeoServer workspace")
        
        if not self.publish_geotiff(final_tiff_path, store_name):
            raise Exception("Failed to publish GeoTIFF to GeoServer")
        
        published_layers = [store_name]
        
        if create_colored and final_colored_path and final_colored_path.exists():
            colored_store_name = f"{store_name}_colored"
            if self.publish_geotiff(final_colored_path, colored_store_name):
                published_layers.append(colored_store_name)
        
        # Cleanup final files
        if final_tiff_path.exists():
            os.remove(final_tiff_path)
        if final_colored_path and final_colored_path.exists():
            os.remove(final_colored_path)
        
        # Prepare response
        response_data = {
            'layer_name': store_name,
            'message': 'Improved interpolation with ArcMap-style coloring completed successfully',
            'data_points_used': len(x),
            'villages_selected': len(selected_area),
            'crs': 'EPSG:32644',
            'resolution': '30m',
            'interpolation_method': method,
            'data_statistics': {
                'min_value': float(z_min),
                'max_value': float(z_max),
                'mean_value': float(z_mean),
                'std_deviation': float(z_std),
                'nan_percentage': float(nan_percentage)
            },
            'geoserver_url': f"/geoserver/{WORKSPACE}/wms",
            'published_layers': published_layers
        }
        
        if png_path and png_base64:
            response_data['visualization'] = {
                'png_path': str(png_path),
                'png_filename': os.path.basename(png_path),
                'png_base64': png_base64,
                'download_url': f"{TEMP_DIR}/{os.path.basename(png_path)}"
            }
        
        if generate_contours:
            if contour_geojson is not None:
                response_data['contour_generation'] = {
                    'requested': True,
                    'success': True,
                    'interval': contour_interval,
                    'statistics': contour_geojson['properties']['statistics']
                }
                response_data['contours'] = contour_geojson
            else:
                response_data['contour_generation'] = {
                    'requested': True,
                    'success': False,
                    'interval': contour_interval,
                    'error': 'Failed to generate contours'
                }
        else:
            response_data['contour_generation'] = {'requested': False}
        
        if create_colored and classification_breaks is not None:
            numeric_labels = []
            for i in range(len(classification_breaks) - 1):
                numeric_labels.append(f"{classification_breaks[i]:.1f}-{classification_breaks[i+1]:.1f}")
            response_data['color_scheme'] = {
                'type': 'ArcMap_style',
                'parameter': parameter,
                'colors': colors,
                'labels': numeric_labels,
                'classes': len(colors)
            }
        
        return response_data

    async def interpolate_from_request(self, request):
        data = await request.json()

        method = data.get('method')
        parameter = data.get('parameter')
        village_ids = data.get('village_ids')
        place = data.get('place')
        csv_file = data.get('csv_file')
        create_colored = data.get('create_colored', True)
        contour_interval = data.get('contour_interval', None)
        generate_contours = data.get('generate_contours', False)
        search_mode = data.get('search_mode', 'variable')
        n_neighbors = int(data.get('n_neighbors', 12))
        radius = data.get('radius', None)
        power = float(data.get('power', 2.0))
        cell_size = float(data.get('cell_size', 30.0))

        if radius is not None:
            radius = float(radius)

        if not all([method, parameter, csv_file]):
            raise ValueError("Missing required fields: method, parameter, csv_file")

        if method not in ['idw', 'kriging', 'spline']:
            raise ValueError("Invalid interpolation method. Must be idw, kriging, or spline")

        if not village_ids or not place:
            raise ValueError("village_ids and place parameters are required")

        if place not in ['village', 'subdistrict']:
            raise ValueError("Invalid place parameter. Must be village or subdistrict")

        if not isinstance(village_ids, list):
            raise ValueError("village_ids parameter must be a list of IDs")

        if method == 'idw':
            if search_mode not in ['variable', 'fixed']:
                raise ValueError("IDW search_mode must be 'variable' or 'fixed'")
            if search_mode == 'fixed' and (radius is None or radius <= 0):
                raise ValueError("Fixed search mode requires a positive radius value")

        csv_path = self.temp_dir / csv_file
        csv_path = self.temp_dir / csv_file
        if not csv_path.exists():
            raise ValueError(f"CSV file not found: {csv_path}")

        return self.process_interpolation(
            csv_path=Path(csv_path),
            parameter=parameter,
            method=method,
            village_ids=village_ids,
            place=place,
            create_colored=create_colored,
            contour_interval=contour_interval,
            generate_contours=generate_contours,
            search_mode=search_mode,
            n_neighbors=n_neighbors,
            radius=radius,
            power=power,
            cell_size=cell_size
        )

# ===== END interpolation_service.py =====


# ===== BEGIN pdf_service.py =====


MEDIA_ROOT = "media"   # <-- update if needed


class PDFMapService:

    @staticmethod
    def generate_map(selected_sub_districts, selected_villages, csv_filename):
        df_wells = pd.DataFrame()
        gdf_wells = None

        # -----------------------------
        # STEP 1: Load CSV if provided
        # -----------------------------
        if csv_filename:
            csv_path = os.path.join(TEMP_DIR, csv_filename)
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"CSV file '{csv_filename}' not found")

            df_wells = pd.read_csv(csv_path)

            required_columns = ['LATITUDE', 'LONGITUDE']
            missing = [c for c in required_columns if c not in df_wells.columns]
            if missing:
                raise ValueError(f"CSV missing required columns: {missing}")

            df_wells_clean = df_wells.dropna(subset=['LATITUDE', 'LONGITUDE'])

            if len(df_wells_clean) > 0:
                geometry = [Point(xy) for xy in zip(df_wells_clean['LONGITUDE'], df_wells_clean['LATITUDE'])]
                gdf_wells = gpd.GeoDataFrame(df_wells_clean, geometry=geometry, crs="EPSG:4326")

        # -----------------------------
        # STEP 2: Load villages shapefile
        # -----------------------------
        shp_path = os.path.join(MEDIA_ROOT, "gwa_data", "gwa_shp", "Final_Village", "Village_New.shp")

        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village shapefile not found")

        gdf_villages = gpd.read_file(shp_path)

        required_shp_cols = ["SUBDIS_COD", "village_co"]
        missing = [c for c in required_shp_cols if c not in gdf_villages.columns]
        if missing:
            raise ValueError(f"Shapefile missing required columns: {missing}")

        # -----------------------------
        # STEP 3: Filtering villages
        # -----------------------------
        if selected_villages:
            gdf_villages["village_co"] = gdf_villages["village_co"].astype(str)
            selected_villages = [str(v) for v in selected_villages]
            filtered = gdf_villages[gdf_villages["village_co"].isin(selected_villages)]
        else:
            gdf_villages["SUBDIS_COD"] = gdf_villages["SUBDIS_COD"].astype(str)
            selected_sub_districts = [str(v) for v in selected_sub_districts]
            filtered = gdf_villages[gdf_villages["SUBDIS_COD"].isin(selected_sub_districts)]

        if len(filtered) == 0:
            raise ValueError("No villages found for selected inputs")

        # -----------------------------
        # STEP 4: CRS alignment
        # -----------------------------
        if gdf_wells is not None and filtered.crs != gdf_wells.crs:
            filtered = filtered.to_crs(gdf_wells.crs)

        # -----------------------------
        # STEP 5: Plotting
        # -----------------------------
        fig, ax = plt.subplots(figsize=(15, 12))

        filtered.plot(ax=ax, color="lightblue", edgecolor="blue", alpha=0.6, linewidth=1.5)

        if gdf_wells is not None:
            gdf_wells.plot(ax=ax, color='red', markersize=50, marker="o")

        # Bounds
        bounds = filtered.total_bounds
        min_x, min_y, max_x, max_y = bounds
        padding = 0.01
        ax.set_xlim(min_x - padding, max_x + padding)
        ax.set_ylim(min_y - padding, max_y + padding)

        # Basemap
        try:
            ctx.add_basemap(ax, crs=filtered.crs, source=ctx.providers.CartoDB.Voyager, zoom=10)
        except:
            pass

        # Labels
        ax.set_title("Groundwater Assessment Study Area Map", fontsize=16, fontweight="bold", pad=20)
        ax.set_xlabel("LONGITUDE")
        ax.set_ylabel("LATITUDE")

        # Legend
        from matplotlib.lines import Line2D
        legend_items = [
            patches.Patch(facecolor="lightblue", edgecolor="blue", label="Villages")
        ]
        if gdf_wells is not None:
            legend_items.append(Line2D([0], [0], marker='o', color='w', markerfacecolor='red',
                                       markersize=10, label='Wells'))
        ax.legend(handles=legend_items)

        plt.tight_layout()

        # -----------------------------
        # STEP 6: Save PNG
        # -----------------------------
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"gwa_map_{timestamp}_{unique_id}.png"
        path = os.path.join(TEMP_DIR, filename)

        plt.savefig(path, dpi=300, bbox_inches="tight")
        plt.close()

        # -----------------------------
        # STEP 7: Encode Base64
        # -----------------------------
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "pdfId": unique_id,
            "filename": filename,
            "generatedAt": datetime.now().isoformat(),
            "imageBase64": f"data:image/png;base64,{b64}",
            "statistics": {
                "villages_count": len(filtered),
                "wells_count": len(gdf_wells) if gdf_wells is not None else 0,
                "selected_villages": selected_villages,
                "selected_subdistricts": selected_sub_districts
            }
        }

    @staticmethod
    async def generate_pdf_from_request(request):
        body = await request.json()
        selected_sub_districts = body.get("selectedSubDistricts") or body.get("selected_sub_districts") or []
        selected_villages = body.get("village_codes") or []
        csv_filename = body.get("csv_filename") or body.get("csvFilename")

        if not selected_sub_districts and not selected_villages:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Either selectedSubDistricts or village_codes is required"},
            )

        try:
            result = PDFMapService.generate_map(
                selected_sub_districts=selected_sub_districts,
                selected_villages=selected_villages,
                csv_filename=csv_filename,
            )
            return JSONResponse(status_code=200, content={"success": True, "message": "Map generated successfully", "data": result})
        except FileNotFoundError as exc:
            return JSONResponse(status_code=404, content={"success": False, "error": str(exc)})
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"success": False, "error": str(exc)})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"success": False, "error": f"Internal server error: {str(exc)}"})

# ===== END pdf_service.py =====


# ===== BEGIN population_service.py =====




class PopulationService:
    def __init__(self, db: Session, media_root: str = None):
        self.db = db
        self.media_root = media_root or "media"

    def forecast(
        self,
        csv_filename: str,
        village_codes: Optional[List[str]] = None,
        subdistrict_codes: Optional[List[int]] = None,
        lpcd: float = 60.0
    ) -> Dict[str, Any]:

        # === Load CSV ===
        csv_path = os.path.join(TEMP_DIR, csv_filename)
        if not os.path.exists(csv_path):
            raise ValueError(f"CSV file not found: {csv_filename}")

        df = pd.read_csv(csv_path)
        year_cols = [col for col in df.columns if col.upper().startswith(("PRE_", "POST_"))]
        if not year_cols:
            raise ValueError("No PRE_/POST_ year columns found")

        years = [int(col.split("_")[1]) for col in year_cols if "_" in col]
        if not years:
            raise ValueError("No valid year in column names")

        target_year = max(years)
        lpcd = float(lpcd)

        # === Filter villages ===
        if village_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.village_code.in_(village_codes))
                .all()
            )
        elif subdistrict_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.subdistrict_code.in_(subdistrict_codes))
                .all()
            )
        else:
            raise ValueError("Provide village_code or subdistrict_code")

        if not villages:
            raise ValueError("No villages found")

        # === Forecast ===
        results = []
        base_year = 2011

        for village in villages:

            # ðŸ”¥ FIX: Correct field name
            sub = (
                self.db.query(Population2011)
                .filter(Population2011.subdistrict_code == village.subdistrict_code)
                .first()
            )

            if not sub:
                results.append({
                    "village_code": village.village_code,
                    "error": "Subdistrict data not found"
                })
                continue

            # Historical populations
            p1, p2, p3, p4, p5, p6, p7 = (
                sub.population_1951, sub.population_1961, sub.population_1971,
                sub.population_1981, sub.population_1991, sub.population_2001,
                sub.population_2011
            )

            # Decadal differences
            d1, d2, d3, d4, d5, d6 = (
                p2 - p1, p3 - p2, p4 - p3,
                p5 - p4, p6 - p5, p7 - p6
            )

            d_mean = (d1 + d2 + d3 + d4 + d5 + d6) / 6
            m_mean = ((d2 - d1) + (d3 - d2) + (d4 - d3) + (d5 - d4) + (d6 - d5)) / 5

            k = village.population_2011 / p7 if p7 else 0
            n = (target_year - base_year) / 10

            forecast = int(
                village.population_2011 +
                (k * n * d_mean) +
                (k * (n * (n + 1)) * m_mean / 2)
            )

            demand = round(((forecast * lpcd) / 1000) * 365, 3) / 1000
            demand = round(demand, 2)

            results.append({
                "village_code": village.village_code,
                "village_name": village.village_name,
                "subdistrict_code": village.subdistrict_code,  # âœ” FIXED
                "base_year": base_year,
                "target_year": target_year,
                "population_2011": village.population_2011,
                "forecast_population": forecast,
                "lpcd": lpcd,
                "demand_mld": demand
            })

        return {"forecasts": results}

    def population_forecast(self, payload) -> Dict[str, Any]:
        if not payload.has_village and not payload.has_subdistrict:
            raise HTTPException(400, "Provide villages or subdistricts")
        try:
            return self.forecast(
                csv_filename=payload.csv_filename,
                village_codes=payload.villages,
                subdistrict_codes=payload.subdistricts,
                lpcd=payload.lpcd,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(500, str(exc)) from exc

# ===== END population_service.py =====


# ===== BEGIN recharge_service.py =====




def fast_zonal_stats(
    geometries: List,
    raster_path: str,
    stats_list: List[str],
    nodata: float = -9999,
    chunk_size: int = 100,
) -> List[Dict]:
    def process_chunk(start_idx: int):
        end_idx = min(start_idx + chunk_size, len(geometries))
        chunk_geoms = geometries[start_idx:end_idx]
        return zonal_stats(
            chunk_geoms,
            raster_path,
            stats=stats_list,
            nodata=nodata,
            all_touched=True,
        )

    max_workers = min(multiprocessing.cpu_count(), 8)
    results: List[Dict] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_chunk, i)
            for i in range(0, len(geometries), chunk_size)
        ]
        for future in futures:
            results.extend(future.result())

    return results


def interpolate_for_villages(
    points_gdf: gpd.GeoDataFrame,
    filtered_gdf: gpd.GeoDataFrame,
    cell_size: int = 30,
    power: int = 2,
    search_mode: str = "variable",
    n_neighbors: int = 3,
    radius: Optional[float] = None,
    nodata_val: float = -9999,
) -> Tuple[np.ndarray, Tuple[float, float, float, float], int, int, rasterio.Affine, None]:
    minx, miny, maxx, maxy = filtered_gdf.total_bounds
    x_coords = np.arange(minx, maxx, cell_size)
    y_coords = np.arange(miny, maxy, cell_size)
    grid_x, grid_y = np.meshgrid(x_coords, y_coords[::-1])
    width, height = len(x_coords), len(y_coords)

    coords = np.array([(g.x, g.y) for g in points_gdf.geometry])
    values = points_gdf["water_fluctuation"].to_numpy(dtype=np.float32)
    valid = ~np.isnan(values)
    coords, values = coords[valid], values[valid]

    if len(coords) < 3:
        raise ValueError(f"Need >=3 valid points for IDW, got {len(coords)}")

    tree = cKDTree(coords)
    xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
    n_points = xi.shape[0]
    out = np.empty(n_points, dtype=np.float32)
    chunk = 10000

    if search_mode == "variable":
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            chunk_pts = xi[s:e]
            dists, idxs = tree.query(chunk_pts, k=n_neighbors)
            dists[dists == 0] = 1e-10
            w = 1.0 / (dists**power)
            out[s:e] = np.sum(w * values[idxs], axis=1) / np.sum(w, axis=1)
    elif search_mode == "fixed":
        if radius is None:
            raise ValueError("radius required")
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            for i, pt in enumerate(xi[s:e]):
                neigh = tree.query_ball_point(pt, r=radius)
                if not neigh:
                    out[s + i] = np.nan
                else:
                    d = np.linalg.norm(coords[neigh] - pt, axis=1)
                    d[d == 0] = 1e-10
                    w = 1.0 / (d**power)
                    out[s + i] = np.sum(w * values[neigh]) / np.sum(w)
    else:
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            chunk_pts = xi[s:e]
            d = np.linalg.norm(coords[:, None, :] - chunk_pts[None, :, :], axis=2)
            d[d == 0] = 1e-10
            w = 1.0 / (d.T**power)
            out[s:e] = np.sum(w * values, axis=1) / np.sum(w, axis=1)

    grid = out.reshape(grid_x.shape).astype(np.float32)
    transform = from_origin(minx, maxy, cell_size, cell_size)
    bounds = (minx, miny, maxx, maxy)
    return grid, bounds, width, height, transform, None


class RechargeService:
    def __init__(self, media_root: str = "media"):
        self.media_root = media_root
        self.temp_dir = Settings().TEMP_DIR

    def _fallback_to_csv_recharge(
        self,
        filtered: gpd.GeoDataFrame,
        filter_type: str,
        filter_vals: List,
        csv_filename: str,
        ts: str,
    ) -> Dict[str, Any]:
        recharge_csv_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_csv",
            "recharge.csv",
        )
        if not os.path.exists(recharge_csv_path):
            raise ValueError(f"Recharge CSV not found: {recharge_csv_path}")

        recharge_df = pd.read_csv(recharge_csv_path)
        recharge_df.columns = recharge_df.columns.str.strip()
        recharge_df["village_co"] = recharge_df["village_co"].astype(str)
        filtered["village_co"] = filtered["village_co"].astype(str)

        if filter_type == "villages":
            recharge_filtered = recharge_df[
                recharge_df["village_co"].isin([str(v) for v in filter_vals])
            ]
        else:
            recharge_df["SUBDIS_COD"] = pd.to_numeric(
                recharge_df["SUBDIS_COD"],
                errors="coerce",
            )
            recharge_filtered = recharge_df[
                recharge_df["SUBDIS_COD"].isin(filter_vals)
            ]

        if recharge_filtered.empty:
            raise ValueError(f"No matching data in recharge.csv for {filter_type}: {filter_vals}")

        results = []
        no_data = []
        for _, row in recharge_filtered.iterrows():
            village_code = str(row["village_co"])
            recharge_val = row.get("recharge", np.nan)
            if pd.isna(recharge_val):
                no_data.append(village_code)

            results.append(
                {
                    "village_co": village_code,
                    "village": row.get("village"),
                    "SY": row.get("SY"),
                    "Shape_Area": row.get("Shape_Area"),
                    "mean_water_fluctuation": row.get("mean_water_fluctuation"),
                    "median_water_fluctuation": row.get("median_water_fluctuation"),
                    "min_water_fluctuation": row.get("min_water_fluctuation"),
                    "max_water_fluctuation": row.get("max_water_fluctuation"),
                    "std_water_fluctuation": row.get("std_water Villages"),
                    "pixel_count": row.get("pixel_count"),
                    "recharge": recharge_val,
                }
            )

        results_df = pd.DataFrame(results)
        csv_out = f"village_wise_groundwater_recharge_{ts}.csv"
        csv_path = os.path.join(self.temp_dir, csv_out)
        results_df.to_csv(csv_path, index=False)

        valid = results_df[results_df["recharge"].notna()]
        total_recharge_m3 = valid["recharge"].sum() if not valid.empty else 0
        total_recharge_mcm = total_recharge_m3 / 1_000_000

        summary = {
            "total_villages": len(results_df),
            "villages_with_interpolated_data": len(valid),
            "villages_with_valid_recharge": int(valid["recharge"].notna().sum()),
            "villages_without_data": len(no_data),
            "data_coverage_percentage": round((len(valid) / len(results_df)) * 100, 1)
            if len(results_df) > 0
            else 0,
            "total_points_used": 0,
            "region_area_km2": round(valid["Shape_Area"].sum() / 1_000_000, 2)
            if not valid.empty
            else 0,
            "mean_recharge_m3": safe_float(valid["recharge"].mean()),
            "total_recharge_mcm": round(total_recharge_mcm, 4),
        }

        return {
            "success": True,
            "message": f"Insufficient data points (<3). Used pre-calculated recharge from CSV. {len(valid)}/{len(results_df)} villages have data.",
            "metadata": {
                "processing_timestamp": datetime.now().isoformat(),
                "input_csv": csv_filename,
                "filter_type": filter_type,
                "filter_values": filter_vals,
                "interpolation_method": "CSV_FALLBACK (Insufficient points for IDW)",
                "recharge_calculation": "Pre-calculated values from recharge.csv",
                "data_source": recharge_csv_path,
            },
            "output_files": {
                "interpolated_raster_full": None,
                "interpolated_raster_clipped": None,
                "village_results_csv": {
                    "filename": csv_out,
                    "path": csv_path,
                    "size_bytes": os.path.getsize(csv_path),
                },
            },
            "summary_statistics": summary,
            "village_wise_results": [safe_dict(r) for r in results_df.to_dict("records")],
        }

    def analyze(
        self,
        csv_filename: str,
        selected_villages: Optional[List[str]] = None,
        selected_subdistricts: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        csv_path = os.path.join(self.temp_dir, csv_filename)
        if not os.path.exists(csv_path):
            raise ValueError(f"CSV not found: {csv_path}")

        df = pd.read_csv(csv_path, dtype={"LATITUDE": "float32", "LONGITUDE": "float32"})
        df.columns = df.columns.str.strip()

        if "LATITUDE" not in df.columns or "LONGITUDE" not in df.columns:
            raise ValueError("Missing LATITUDE/LONGITUDE")

        pre_cols = [c for c in df.columns if "pre" in c.lower()]
        post_cols = [c for c in df.columns if "post" in c.lower()]
        if not pre_cols or not post_cols:
            raise ValueError(f"Pre/Post columns missing. Pre: {pre_cols}, Post: {post_cols}")

        for c in pre_cols + post_cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")

        df["pre_mean"] = df[pre_cols].mean(axis=1, skipna=True)
        df["post_mean"] = df[post_cols].mean(axis=1, skipna=True)
        df["water_fluctuation"] = df["pre_mean"] - df["post_mean"]
        df = df.dropna(subset=["LATITUDE", "LONGITUDE", "water_fluctuation"])
        if df.empty:
            raise ValueError("No valid points after cleaning")

        shp_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_shp",
            "Final_Village",
            "Village_PET_PE_SY_Crop.shp",
        )
        if not os.path.exists(shp_path):
            raise ValueError(f"Shapefile missing: {shp_path}")

        gdf = gpd.read_file(shp_path)
        required = ["village_co", "SUBDIS_COD", "village", "SY", "Shape_Area"]
        missing = [c for c in required if c not in gdf.columns]
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        if selected_villages:
            gdf["village_co"] = gdf["village_co"].astype(str)
            filtered = gdf[gdf["village_co"].isin(selected_villages)].copy()
            filter_type, filter_vals = "villages", selected_villages
        else:
            gdf["SUBDIS_COD"] = pd.to_numeric(gdf["SUBDIS_COD"], errors="coerce")
            filtered = gdf[gdf["SUBDIS_COD"].isin(selected_subdistricts)].copy()
            filter_type, filter_vals = "subdistricts", selected_subdistricts

        if filtered.empty:
            raise ValueError(f"No villages for {filter_type}: {filter_vals}")

        if filtered.crs != "EPSG:32644":
            filtered = filtered.to_crs("EPSG:32644")

        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=[Point(xy) for xy in zip(df["LONGITUDE"], df["LATITUDE"])],
            crs="EPSG:4326",
        ).to_crs("EPSG:32644")

        buffered = unary_union(filtered.geometry).buffer(5000)
        pts_in = points_gdf[points_gdf.geometry.within(buffered)]
        if len(pts_in) < 5:
            pts_in = points_gdf

        valid_points = pts_in[~pts_in["water_fluctuation"].isna()]
        if len(valid_points) < 3:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            return self._fallback_to_csv_recharge(
                filtered=filtered,
                filter_type=filter_type,
                filter_vals=filter_vals,
                csv_filename=csv_filename,
                ts=ts,
            )

        grid, bounds, w, h, transform, _ = interpolate_for_villages(
            pts_in,
            filtered,
            cell_size=30,
            power=2,
            search_mode="variable",
            n_neighbors=3,
        )
        _ = bounds, w, h

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        full_raster = f"water_fluctuation_idw_full_{ts}.tif"
        full_path = os.path.join(self.temp_dir, full_raster)
        with rasterio.open(
            full_path,
            "w",
            driver="GTiff",
            height=grid.shape[0],
            width=grid.shape[1],
            count=1,
            dtype=rasterio.float32,
            crs=CRS.from_epsg(32644),
            transform=transform,
            nodata=-9999,
            compress="lzw",
            tiled=True,
            blockxsize=256,
            blockysize=256,
        ) as dst:
            dst.write(grid, 1)

        clipped_raster = f"water_fluctuation_idw_clipped_{ts}.tif"
        clipped_path = os.path.join(self.temp_dir, clipped_raster)
        with rasterio.open(full_path) as src:
            img, tr = mask(src, filtered.geometry, crop=True, filled=True, nodata=-9999)
            meta = src.meta.copy()
            meta.update({"height": img.shape[1], "width": img.shape[2], "transform": tr})
        with rasterio.open(clipped_path, "w", **meta) as dst:
            dst.write(img)

        geoms = [r.geometry for _, r in filtered.iterrows()]
        codes = [r["village_co"] for _, r in filtered.iterrows()]
        chunk = max(10, min(len(geoms) // (multiprocessing.cpu_count() * 2), 200))
        stats = fast_zonal_stats(
            geoms,
            clipped_path,
            ["mean", "count", "min", "max", "std", "median"],
            chunk_size=chunk,
        )

        attr_map = {
            str(r["village_co"]): {
                "village_name": r["village"],
                "sy_value": r["SY"],
                "shape_area": r["Shape_Area"],
            }
            for _, r in filtered.iterrows()
        }

        results = []
        no_data = []
        for code, stat in zip(codes, stats):
            code_str = str(code)
            mean_f = stat["mean"] if stat["mean"] is not None else np.nan
            count = stat["count"]
            attrs = attr_map.get(code_str, {})
            recharge = (
                (attrs.get("shape_area", np.nan) * attrs.get("sy_value", np.nan) * mean_f) / 1000
                if count > 0 and not pd.isna(mean_f)
                else np.nan
            )

            if count == 0 or pd.isna(mean_f):
                no_data.append(code_str)

            results.append(
                {
                    "village_co": code,
                    "village": attrs.get("village_name"),
                    "SY": attrs.get("sy_value"),
                    "Shape_Area": attrs.get("shape_area"),
                    "mean_water_fluctuation": mean_f,
                    "median_water_fluctuation": stat["median"],
                    "min_water_fluctuation": stat["min"],
                    "max_water_fluctuation": stat["max"],
                    "std_water_fluctuation": stat["std"],
                    "pixel_count": count,
                    "recharge": recharge,
                }
            )

        results_df = pd.DataFrame(results)
        csv_out = f"village_wise_groundwater_recharge_{ts}.csv"
        csv_path = os.path.join(self.temp_dir, csv_out)
        results_df.to_csv(csv_path, index=False)

        valid = results_df[results_df["pixel_count"] > 0]
        total_recharge_m3 = valid["recharge"].sum() if not valid.empty else 0
        total_recharge_mcm = total_recharge_m3 / 1_000_000

        summary = {
            "total_villages": len(results_df),
            "villages_with_interpolated_data": len(valid),
            "villages_with_valid_recharge": int(valid["recharge"].notna().sum()),
            "villages_without_data": len(no_data),
            "data_coverage_percentage": round((len(valid) / len(results_df)) * 100, 1)
            if len(results_df) > 0
            else 0,
            "total_points_used": len(pts_in),
            "region_area_km2": round((np.sum(~np.isnan(grid)) * 900) / 1_000_000, 2),
            "mean_recharge_m3": safe_float(valid["recharge"].mean()),
            "total_recharge_mcm": round(total_recharge_mcm, 4),
        }

        return {
            "success": True,
            "message": f"Analysis complete. {len(valid)}/{len(results_df)} villages have data.",
            "metadata": {
                "processing_timestamp": datetime.now().isoformat(),
                "input_csv": csv_filename,
                "filter_type": filter_type,
                "filter_values": filter_vals,
                "interpolation_method": "ULTRA-OPTIMIZED IDW + Parallel Zonal Stats",
                "recharge_calculation": "recharge = (Shape_Area x SY x mean_water_fluctuation)/1000",
            },
            "output_files": {
                "interpolated_raster_full": {
                    "filename": full_raster,
                    "path": full_path,
                    "size_bytes": os.path.getsize(full_path),
                },
                "interpolated_raster_clipped": {
                    "filename": clipped_raster,
                    "path": clipped_path,
                    "size_bytes": os.path.getsize(clipped_path),
                },
                "village_results_csv": {
                    "filename": csv_out,
                    "path": csv_path,
                    "size_bytes": os.path.getsize(csv_path),
                },
            },
            "summary_statistics": summary,
            "village_wise_results": [safe_dict(r) for r in results_df.to_dict("records")],
        }

    def groundwater_recharge_analysis(self, payload) -> Dict[str, Any]:
        selected_villages = [str(v) for v in payload.selectedVillages] if payload.selectedVillages else None
        return self.analyze(
            csv_filename=payload.csvFilename,
            selected_villages=selected_villages,
            selected_subdistricts=payload.selectedSubDistricts,
        )


def safe_float(x):
    return None if pd.isna(x) or np.isinf(x) or np.isnan(x) else float(x)


def safe_dict(row):
    return {
        k: safe_float(v)
        if isinstance(v, (np.floating, float)) and (np.isnan(v) or np.isinf(v))
        else (None if pd.isna(v) else v)
        for k, v in row.items()
    }

# ===== END recharge_service.py =====


# ===== BEGIN stress_identification_service.py =====



MEDIA_ROOT = "media"



class StressIdentificationService:
    

    shapefile_path: Optional[str] = None
    shapefile_map: Dict[str, float] = {}

    def load_shapefile(self) -> None:
        """Load shapefile once and store mapping {village_co: injection}."""
        try:
            if not self.shapefile_path:
                media_dir = MEDIA_ROOT
                self.shapefile_path = os.path.join(
                    media_dir,
                    "gwa_data",
                    "gwa_shp",
                    "Final_Village",
                    "Injection_Water_Need.shp",
                )

            if not os.path.exists(self.shapefile_path):
                raise HTTPException(
                    status_code=400,
                    detail=f"Shapefile not found at {self.shapefile_path}",
                )

            gdf = gpd.read_file(self.shapefile_path)

            if "village_co" not in gdf.columns or "Injection_" not in gdf.columns:
                raise HTTPException(
                    status_code=400,
                    detail="Shapefile missing required fields: village_co / Injection_",
                )

            gdf["village_co"] = gdf["village_co"].astype(str).str.strip()

            mapping = {}
            for _, row in gdf.iterrows():
                key = row["village_co"]
                try:
                    val = float(row.get("Injection_", 0) or 0)
                except:
                    val = 0.0
                mapping[key] = val

            self.shapefile_map = mapping
            print(f"Loaded shapefile â€” {len(mapping)} villages")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading shapefile: {str(e)}")

    def compute_stress(
        self,
        gsr_data: List[Dict[str, Any]],
        years_count: int,
    ) -> Dict[str, Any]:

        if years_count <= 0:
            raise HTTPException(status_code=400, detail="years_count must be > 0")

        if not self.shapefile_map:
            self.load_shapefile()

        stress_results = []
        villages_processed = 0
        villages_with_injection = 0

        for row in gsr_data:
            village_code = str(row.get("village_code", "")).strip()

            if not village_code:
                continue
            if village_code not in self.shapefile_map:
                continue

            recharge = float(row.get("recharge", 0) or 0)
            demand = float(row.get("total_demand", 0) or 0)
            village_name = row.get("village_name", "Unknown")

            injection = self.shapefile_map.get(village_code, 0)
            if injection > 0:
                villages_with_injection += 1

            stress = (max(recharge - demand, 0) + (injection / years_count)) / 1000

            stress_results.append(
                {
                    "village_code": village_code,
                    "village_name": village_name,
                    "recharge": round(recharge, 4),
                    "total_demand": round(demand, 4),
                    "injection": round(injection, 4) / 1000,
                    "years_count": years_count,
                    "stress_value": round(stress, 2),
                }
            )

            villages_processed += 1

        summary = {
            "total_villages_processed": villages_processed,
            "villages_with_injection_data": villages_with_injection,
            "villages_without_injection_data": villages_processed - villages_with_injection,
            "years_count_used": years_count,
            "shapefile_villages_available": len(self.shapefile_map),
            "gsr_input_villages": len(gsr_data),
        }

        return {
            "success": True,
            "data": stress_results,
            "message": f"Stress values computed for {len(stress_results)} villages",
            "years_count": years_count,
            "total_villages": len(stress_results),
            "summary_stats": summary,
            "computed_at": datetime.now().isoformat(),
        }

    def health_check(self) -> Dict[str, Any]:
        return {
            "success": True,
            "service": "Stress Identification API",
            "version": "1.0",
            "description": "Computes stress values using GSR and injection shapefile",
        }

# ===== END stress_identification_service.py =====


# ===== BEGIN trend_service.py =====




warnings.filterwarnings("ignore")

MKResult = namedtuple("MKResult", ["tau", "p_value", "trend", "slope"])


class TrendService:
    def __init__(self, media_root: str):
        self.media_root = media_root
        self.temp_media_dir = TEMP_DIR
        self.gwa_data_dir = os.path.join(media_root, "gwa_data", "gwa_shp")
        self.village_shp_path = os.path.join(self.gwa_data_dir, "Final_Village", "Village.shp")
        self.centroid_shp_path = os.path.join(self.gwa_data_dir, "Centroid", "Centroid1.shp")
        self.VILLAGE_CODE_COL = "village_co"

        

    def _make_json_safe(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {k: self._make_json_safe(v) for k, v in value.items()}

        if isinstance(value, (list, tuple, set)):
            return [self._make_json_safe(v) for v in value]

        if isinstance(value, np.generic):
            return self._make_json_safe(value.item())

        if isinstance(value, float):
            return value if math.isfinite(value) else None

        return value

    def groundwater_trend_analysis(self, payload: TrendRequest) -> Dict[str, Any]:
        if not payload.wells_csv_filename:
            raise HTTPException(status_code=400, detail="wells_csv_filename is required")

        has_subdis = bool(payload.subdis_codes and len(payload.subdis_codes) > 0)
        has_village = bool(payload.village_codes and len(payload.village_codes) > 0)

        if has_subdis and has_village:
            raise HTTPException(status_code=400, detail="Provide exactly one of subdis_codes or village_codes")
        if not has_subdis and not has_village:
            raise HTTPException(status_code=400, detail="Provide exactly one of subdis_codes or village_codes")

        wells_path = os.path.join(self.temp_media_dir, payload.wells_csv_filename)
        if not os.path.exists(wells_path):
            raise HTTPException(status_code=404, detail=f"Wells CSV not found: {payload.wells_csv_filename}")

        try:
            if has_subdis:
                centroids, villages = self._filter_by_subdis(payload.subdis_codes)
            else:
                centroids, villages = self._filter_by_village(payload.village_codes)

            villages_y, villages_s, all_years, ts_stats = self.create_village_time_series(
                wells_path,
                centroids,
                villages,
            )
            _ = villages_s
            ts_stats["wells_csv_filename"] = payload.wells_csv_filename

            years_for_trend = [str(y) for y in (payload.trend_years or [int(y) for y in all_years])]
            trend_df = self.perform_mann_kendall_analysis(villages_y, years_for_trend, all_years)

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            tag = (
                "subdis_" + "_".join(map(str, payload.subdis_codes[:3])) + ("_etc" if len(payload.subdis_codes) > 3 else "")
                if has_subdis
                else "vill_" + "_".join(map(str, payload.village_codes[:3])) + ("_etc" if len(payload.village_codes) > 3 else "")
            )
            mk_csv = f"mann_kendall_results_{tag}_{min(years_for_trend)}_{max(years_for_trend)}_{ts}.csv"
            mk_path = os.path.join(self.temp_media_dir, mk_csv)

            numeric = ["Mann_Kendall_Tau", "P_Value", "Sen_Slope", "Mean_Depth", "Std_Depth", "Min_Depth", "Max_Depth"]
            trend_df[numeric] = trend_df[numeric].round(4)
            trend_df.to_csv(mk_path, index=False)
            ts_stats["trend_csv_filename"] = mk_csv

            full = self.build_response(
                villages_y,
                trend_df,
                all_years,
                years_for_trend,
                ts,
                subdis_codes=payload.subdis_codes if has_subdis else None,
                village_codes=payload.village_codes if has_village else None,
                timeseries_stats=ts_stats,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        rt = payload.return_type
        if rt == "stats":
            return self._make_json_safe({"success": True, "summary_stats": full["summary_stats"]})
        if rt == "charts":
            return self._make_json_safe({"success": True, "summary_stats": full["summary_stats"], "charts": full["charts"]})
        if rt == "village_data":
            return self._make_json_safe({"success": True, "village_geojson": full["village_geojson"], "villages": full["villages"]})
        if rt == "tables":
            return self._make_json_safe({"success": True, "summary_stats": full["summary_stats"], "summary_tables": full["summary_tables"]})

        return self._make_json_safe(full)

    def _filter_by_subdis(self, subdis_codes: List) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        centroids = gpd.read_file(self.centroid_shp_path)
        villages = gpd.read_file(self.village_shp_path)

        if "SUBDIS_COD" not in centroids.columns:
            raise ValueError(f"SUBDIS_COD column missing in centroids. Columns: {list(centroids.columns)}")
        if "SUBDIS_COD" not in villages.columns:
            raise ValueError(f"SUBDIS_COD column missing in villages. Columns: {list(villages.columns)}")

        subdis_codes = [int(c) for c in subdis_codes]
        filtered_c = centroids[centroids["SUBDIS_COD"].isin(subdis_codes)]
        filtered_v = villages[villages["SUBDIS_COD"].isin(subdis_codes)]

        if filtered_c.empty or filtered_v.empty:
            raise ValueError(f"No data for SUBDIS_COD {subdis_codes}")
        return filtered_c, filtered_v

    def _filter_by_village(self, village_codes: List) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        centroids = gpd.read_file(self.centroid_shp_path)
        villages = gpd.read_file(self.village_shp_path)

        if self.VILLAGE_CODE_COL not in centroids.columns:
            raise ValueError(f"{self.VILLAGE_CODE_COL} missing in centroids")
        if self.VILLAGE_CODE_COL not in villages.columns:
            raise ValueError(f"{self.VILLAGE_CODE_COL} missing in villages")

        norm = [int(v) for v in village_codes]
        filtered_c = centroids[centroids[self.VILLAGE_CODE_COL].isin(norm)]
        filtered_v = villages[villages[self.VILLAGE_CODE_COL].isin(norm)]

        if filtered_c.empty or filtered_v.empty:
            raise ValueError(f"No data for village codes {village_codes}")
        return filtered_c, filtered_v

    def mann_kendall_test(self, series: pd.Series) -> MKResult:
        data = series.dropna()
        if len(data) < 3:
            return MKResult(np.nan, np.nan, "Insufficient Data", np.nan)

        n = len(data)
        s_score = sum(np.sign(data.values[j] - data.values[i]) for i in range(n - 1) for j in range(i + 1, n))
        var_s = n * (n - 1) * (2 * n + 5) / 18
        z_score = (s_score - 1) / np.sqrt(var_s) if s_score > 0 else (s_score + 1) / np.sqrt(var_s) if s_score < 0 else 0
        p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))
        tau = s_score / (0.5 * n * (n - 1))

        trend = (
            "Increasing"
            if p_value < 0.05 and tau > 0
            else "Decreasing"
            if p_value < 0.05 and tau < 0
            else "No-Trend"
        )

        slopes = [(data.values[j] - data.values[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
        sen_slope = np.median(slopes) if slopes else 0

        return MKResult(tau, p_value, trend, sen_slope)

    def create_village_time_series(
        self,
        wells_csv_path: str,
        centroids: gpd.GeoDataFrame,
        villages: gpd.GeoDataFrame,
    ) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, List[str], Dict[str, Any]]:
        wells_df = pd.read_csv(wells_csv_path)
        wells_gdf = gpd.GeoDataFrame(
            wells_df,
            geometry=gpd.points_from_xy(wells_df["LONGITUDE"], wells_df["LATITUDE"]),
            crs="EPSG:4326",
        )

        common_crs = centroids.crs
        wells_gdf = wells_gdf.to_crs(common_crs)
        villages = villages.to_crs(common_crs)

        depth_cols = [c for c in wells_gdf.columns if any(s in c for s in ("PRE", "POST"))]
        years = sorted({re.search(r"(\d{4})", c).group(1) for c in depth_cols if re.search(r"(\d{4})", c)})
        if not years:
            raise ValueError("No year columns found in wells CSV")

        cent_coords = np.array([(g.x, g.y) for g in centroids.geometry])
        well_coords = np.array([(g.x, g.y) for g in wells_gdf.geometry])
        tree = cKDTree(well_coords)
        distances, indices = tree.query(cent_coords, k=min(3, len(well_coords)))
        if len(well_coords) == 1:
            distances = distances.reshape(-1, 1)
            indices = indices.reshape(-1, 1)
        elif len(well_coords) == 2:
            distances = distances.reshape(-1, 2)
            indices = indices.reshape(-1, 2)

        yearly_records = []
        seasonal_records = []

        for dist_row, idx_row in zip(distances, indices):
            dist_row = dist_row[:3] if len(dist_row) > 3 else dist_row
            idx_row = idx_row[:3] if len(idx_row) > 3 else idx_row

            eps = 1e-10
            weights = 1.0 / (np.array(dist_row) + eps)
            weights = weights / weights.sum()

            yearly = {}
            seasonal = {}

            for yr in years:
                pre_col = next((c for c in depth_cols if yr in c and "PRE" in c.upper()), None)
                post_col = next((c for c in depth_cols if yr in c and "POST" in c.upper()), None)

                year_vals, year_w = [], []
                pre_vals, pre_w = [], []
                post_vals, post_w = [], []

                for j, w_idx in enumerate(idx_row):
                    well = wells_gdf.iloc[w_idx]
                    pre_v = well[pre_col] if pre_col and pd.notna(well[pre_col]) else None
                    post_v = well[post_col] if post_col and pd.notna(well[post_col]) else None

                    vals = [v for v in (pre_v, post_v) if v is not None]
                    if vals:
                        year_vals.append(np.mean(vals))
                        year_w.append(weights[j])

                    if pre_v is not None:
                        pre_vals.append(pre_v)
                        pre_w.append(weights[j])
                    if post_v is not None:
                        post_vals.append(post_v)
                        post_w.append(weights[j])

                if year_vals:
                    yw = np.array(year_w)
                    yw = yw / yw.sum()
                    yearly[yr] = float(np.sum(np.array(year_vals) * yw))
                else:
                    yearly[yr] = np.nan

                if pre_vals:
                    pw = np.array(pre_w)
                    pw = pw / pw.sum()
                    seasonal[f"{yr}_PRE"] = float(np.sum(np.array(pre_vals) * pw))
                else:
                    seasonal[f"{yr}_PRE"] = np.nan

                if post_vals:
                    pw = np.array(post_w)
                    pw = pw / pw.sum()
                    seasonal[f"{yr}_POST"] = float(np.sum(np.array(post_vals) * pw))
                else:
                    seasonal[f"{yr}_POST"] = np.nan

            for j, w_idx in enumerate(idx_row):
                meta = {
                    f"nearest_well_{j + 1}_id": wells_gdf.iloc[w_idx].get("id", f"well_{w_idx}"),
                    f"distance_{j + 1}": float(dist_row[j]),
                    f"weight_{j + 1}": float(weights[j]) if j < len(weights) else 0.0,
                }
                yearly.update(meta)
                seasonal.update(meta)

            yearly_records.append(yearly)
            seasonal_records.append(seasonal)

        yearly_df = pd.DataFrame(yearly_records)
        seasonal_df = pd.DataFrame(seasonal_records)

        yearly_df[self.VILLAGE_CODE_COL] = centroids[self.VILLAGE_CODE_COL].values
        seasonal_df[self.VILLAGE_CODE_COL] = centroids[self.VILLAGE_CODE_COL].values

        villages_y = villages.merge(yearly_df, on=self.VILLAGE_CODE_COL, how="left")
        villages_s = villages.merge(seasonal_df, on=self.VILLAGE_CODE_COL, how="left")

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        yearly_csv = f"village_timeseries_yearly_filtered_all_years_{ts}.csv"
        seasonal_csv = f"village_timeseries_seasonal_filtered_all_years_{ts}.csv"

        yearly_path = os.path.join(self.temp_media_dir, yearly_csv)
        seasonal_path = os.path.join(self.temp_media_dir, seasonal_csv)

        villages_y.drop(columns=["geometry"], errors="ignore").to_csv(yearly_path, index=False)
        villages_s.drop(columns=["geometry"], errors="ignore").to_csv(seasonal_path, index=False)

        summary = {
            "total_villages": len(villages_y),
            "total_years_available": len(years),
            "all_years_analyzed": years,
            "village_timeseries_yearly_csv": yearly_csv,
            "village_timeseries_seasonal_csv": seasonal_csv,
        }

        return villages_y, villages_s, years, summary

    def perform_mann_kendall_analysis(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_years: List[str],
        all_years: List[str],
    ) -> pd.DataFrame:
        missing = [y for y in trend_years if y not in all_years]
        if missing:
            trend_years = [y for y in trend_years if y in all_years]

        if len(trend_years) < 3:
            raise ValueError(f"Need >=3 years for MK, got {len(trend_years)}")

        results = []
        for _, row in villages_y.iterrows():
            ts = row[trend_years]
            ts.index = [int(y) for y in trend_years]
            mk = self.mann_kendall_test(ts)

            results.append(
                {
                    "Village_ID": row.get(self.VILLAGE_CODE_COL, "Unknown"),
                    "Village_Name": row.get("village", row.get("VILLAGE", "Unknown")),
                    "Block": row.get("block", row.get("BLOCK", "Unknown")),
                    "District": row.get("district", row.get("DISTRICT", "Unknown")),
                    "SUBDIS_COD": row.get("SUBDIS_COD", "Unknown"),
                    "Mann_Kendall_Tau": mk.tau,
                    "P_Value": mk.p_value,
                    "Trend_Status": mk.trend,
                    "Sen_Slope": mk.slope,
                    "Data_Points": ts.count(),
                    "Years_Analyzed": ", ".join(trend_years),
                    "Start_Year": min([int(y) for y in trend_years]),
                    "End_Year": max([int(y) for y in trend_years]),
                    "Mean_Depth": float(ts.mean()) if ts.count() > 0 else None,
                    "Std_Depth": float(ts.std()) if ts.count() > 1 else None,
                    "Min_Depth": float(ts.min()) if ts.count() > 0 else None,
                    "Max_Depth": float(ts.max()) if ts.count() > 0 else None,
                    "Total_Years_Available": len(all_years),
                    "All_Years_Available": ", ".join(all_years),
                }
            )

        df = pd.DataFrame(results)
        color_map = {
            "Increasing": "#FA4646",
            "Decreasing": "#62D9D1",
            "No-Trend": "#95A5A6",
            "Insufficient Data": "#F39C12",
        }
        df["Color"] = df["Trend_Status"].map(color_map)
        return df

    def generate_trend_map_from_geojson(
        self,
        geojson: Dict,
        years_for_trend: List[str],
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        try:
            polygons, colors, names = [], [], []
            for feature in geojson["features"]:
                geom = shape(feature["geometry"])
                if geom.geom_type == "MultiPolygon":
                    geom = list(geom.geoms)[0]
                polygons.append(geom)
                colors.append(feature["properties"].get("Color", "#95A5A6"))
                names.append(feature["properties"].get("Village_Name", "Unknown"))

            gdf = gpd.GeoDataFrame({"geometry": polygons, "color": colors, "village_name": names}, crs="EPSG:4326")
            gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.0001, preserve_topology=True)

            fig, ax = plt.subplots(1, 1, figsize=(15, 12))
            gdf.plot(ax=ax, color=gdf["color"], edgecolor="blue", alpha=0.6, linewidth=1.5)

            bounds = gdf.total_bounds
            pad = 0.01
            ax.set_xlim(bounds[0] - pad, bounds[2] + pad)
            ax.set_ylim(bounds[1] - pad, bounds[3] + pad)

            try:
                import contextily as ctx

                ctx.add_basemap(ax, crs=gdf.crs, source=ctx.providers.CartoDB.Voyager, alpha=1, zoom=10)
            except Exception:
                pass

            year_range = f"{min([int(y) for y in years_for_trend])}-{max([int(y) for y in years_for_trend])}"
            info = []
            if subdis_codes:
                info.append(
                    f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}"
                    f"{'...' if len(subdis_codes) > 3 else ''}"
                )
            if village_codes:
                info.append(
                    f"Villages: {', '.join(map(str, village_codes[:3]))}"
                    f"{'...' if len(village_codes) > 3 else ''}"
                )
            subtitle = f" ({' | '.join(info)})" if info else ""

            ax.set_title(
                f"Groundwater Trend Analysis Map ({year_range}){subtitle}",
                fontsize=14,
                fontweight="bold",
                pad=20,
            )

            legend = [
                mpatches.Patch(color="#FF6B6B", label="Increasing (Worsening)"),
                mpatches.Patch(color="#4ECDC4", label="Decreasing (Improving)"),
                mpatches.Patch(color="#95A5A6", label="No Significant Trend"),
                mpatches.Patch(color="#F39C12", label="Insufficient Data"),
            ]
            ax.legend(handles=legend, loc="upper right", fontsize=10)

            ax.set_xlabel("LONGITUDE", fontsize=12)
            ax.set_ylabel("LATITUDE", fontsize=12)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()

            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            uid = str(uuid.uuid4())[:8]
            if subdis_codes:
                tag = "_".join(map(str, subdis_codes[:3])) + ("_etc" if len(subdis_codes) > 3 else "")
                fname = f"trend_map_subdis_{tag}_{year_range}_{ts}_{uid}.png"
            elif village_codes:
                tag = "_".join(map(str, village_codes[:3])) + ("_etc" if len(village_codes) > 3 else "")
                fname = f"trend_map_villages_{tag}_{year_range}_{ts}_{uid}.png"
            else:
                fname = f"trend_map_{year_range}_{ts}_{uid}.png"

            buffer = BytesIO()
            plt.savefig(buffer, format="png", dpi=150, bbox_inches="tight", facecolor="white")
            buffer.seek(0)
            b64 = base64.b64encode(buffer.read()).decode()
            base64_str = f"data:image/png;base64,{b64}"

            path = os.path.join(self.temp_media_dir, fname)
            buffer.seek(0)
            with open(path, "wb") as file_obj:
                file_obj.write(buffer.read())

            plt.close(fig)
            buffer.close()
            return fname, base64_str
        except Exception as exc:
            print(f"Map error: {exc}")
            return None, None

    def generate_trend_charts(
        self,
        trend_df: pd.DataFrame,
        year_range: str,
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
    ) -> Dict[str, str]:
        charts = {}
        try:
            plt.style.use("default")
            sns.set_palette("husl")

            info = []
            if subdis_codes:
                info.append(
                    f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}"
                    f"{'...' if len(subdis_codes) > 3 else ''}"
                )
            if village_codes:
                info.append(
                    f"Villages: {', '.join(map(str, village_codes[:3]))}"
                    f"{'...' if len(village_codes) > 3 else ''}"
                )
            ctx = f" ({' | '.join(info)})" if info else ""

            fig, ax = plt.subplots(figsize=(10, 8))
            counts = trend_df["Trend_Status"].value_counts()
            colors = ["#2ecc71", "#e74c3c", "#f39c12", "#95a5a6"]
            ax.pie(counts.values, labels=counts.index, autopct="%1.1f%%", colors=colors, startangle=90)
            ax.set_title(
                f"Groundwater Trend Distribution ({year_range}){ctx}",
                fontsize=14,
                fontweight="bold",
            )

            buf = BytesIO()
            plt.savefig(buf, format="png", dpi=300, bbox_inches="tight")
            buf.seek(0)
            charts["trend_distribution"] = base64.b64encode(buf.getvalue()).decode()
            plt.close()
        except Exception as exc:
            charts["error"] = str(exc)
        return charts

    def extract_village_timeseries_data(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_df: pd.DataFrame,
        all_years: List[str],
    ) -> List[Dict]:
        merged = villages_y.merge(
            trend_df[["Village_ID", "Trend_Status", "Color", "Mann_Kendall_Tau", "Sen_Slope"]],
            left_on=self.VILLAGE_CODE_COL,
            right_on="Village_ID",
            how="left",
        )

        output = []
        for _, row in merged.iterrows():
            years = []
            depths = []
            for y in all_years:
                years.append(y)
                val = row.get(y)
                depths.append(float(val) if pd.notna(val) else None)

            smoothed = pd.Series(depths).rolling(window=3, min_periods=1, center=True).mean().round(2).tolist()

            valid = [(i, d) for i, d in enumerate(depths) if d is not None]
            if len(valid) >= 2:
                xs = np.array([int(years[i]) for i, _ in valid])
                ys = np.array([d for _, d in valid])
                slope, intercept = np.polyfit(xs, ys, 1)
                line = [round(intercept + slope * int(y), 2) for y in years]
            else:
                line = [None] * len(years)

            output.append(
                {
                    "village_id": str(row.get("Village_ID", row.get(self.VILLAGE_CODE_COL, "Unknown"))),
                    "village_name": str(row.get("village", row.get("VILLAGE", "Unknown"))),
                    "block": str(row.get("block", row.get("BLOCK", "Unknown"))),
                    "district": str(row.get("district", row.get("DISTRICT", "Unknown"))),
                    "subdis_cod": str(row.get("SUBDIS_COD", "Unknown")),
                    "trend_status": str(row.get("Trend_Status", "No Data")),
                    "color": str(row.get("Color", "#95A5A6")),
                    "mann_kendall_tau": (
                        float(row["Mann_Kendall_Tau"]) if pd.notna(row.get("Mann_Kendall_Tau")) else None
                    ),
                    "sen_slope": float(row["Sen_Slope"]) if pd.notna(row.get("Sen_Slope")) else None,
                    "years": years,
                    "depths": smoothed,
                    "trend_line": line,
                }
            )
        return output

    def create_village_json_for_map(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_df: pd.DataFrame,
        all_years: List[str],
    ) -> Dict:
        merged = villages_y.merge(trend_df, left_on=self.VILLAGE_CODE_COL, right_on="Village_ID", how="left")
        if merged.crs != "EPSG:4326":
            merged = merged.to_crs("EPSG:4326")

        features = []
        for _, row in merged.iterrows():
            try:
                geom = row.geometry
                if geom is None or geom.is_empty:
                    continue
                if not geom.is_valid:
                    from shapely.validation import make_valid

                    geom = make_valid(geom)
                    if not geom.is_valid:
                        continue

                if geom.geom_type == "Polygon":
                    coords = [[[float(x), float(y)] for x, y in geom.exterior.coords]]
                    for interior in geom.interiors:
                        coords.append([[float(x), float(y)] for x, y in interior.coords])
                elif geom.geom_type == "MultiPolygon":
                    coords = []
                    for g in geom.geoms:
                        if g.is_valid and not g.is_empty:
                            outer = [[float(x), float(y)] for x, y in g.exterior.coords]
                            poly = [outer]
                            for interior in g.interiors:
                                poly.append([[float(x), float(y)] for x, y in interior.coords])
                            coords.append(poly)
                else:
                    continue

                ts_values = {}
                for y in all_years:
                    v = row.get(y)
                    ts_values[y] = float(v) if pd.notna(v) else None

                feature = {
                    "type": "Feature",
                    "geometry": {"type": geom.geom_type, "coordinates": coords},
                    "properties": {
                        "Village_ID": str(row.get("Village_ID", row.get(self.VILLAGE_CODE_COL, "Unknown"))),
                        "Village_Name": str(
                            row.get("Village_Name", row.get("village", row.get("VILLAGE", "Unknown")))
                        ),
                        "Block": str(row.get("Block", row.get("block", row.get("BLOCK", "Unknown")))),
                        "District": str(row.get("District", row.get("district", row.get("DISTRICT", "Unknown")))),
                        "SUBDIS_COD": str(row.get("SUBDIS_COD", "Unknown")),
                        "Mann_Kendall_Tau": (
                            float(row["Mann_Kendall_Tau"]) if pd.notna(row.get("Mann_Kendall_Tau")) else None
                        ),
                        "P_Value": float(row["P_Value"]) if pd.notna(row.get("P_Value")) else None,
                        "Trend_Status": str(row.get("Trend_Status", "No Data")),
                        "Sen_Slope": float(row["Sen_Slope"]) if pd.notna(row.get("Sen_Slope")) else None,
                        "Data_Points": int(row["Data_Points"]) if pd.notna(row.get("Data_Points")) else 0,
                        "Years_Analyzed": str(row.get("Years_Analyzed", "")),
                        "Mean_Depth": float(row["Mean_Depth"]) if pd.notna(row.get("Mean_Depth")) else None,
                        "Color": str(row.get("Color", "#95A5A6")),
                        "time_series": ts_values,
                        "bounds": {
                            "minLng": float(geom.bounds[0]),
                            "minLat": float(geom.bounds[1]),
                            "maxLng": float(geom.bounds[2]),
                            "maxLat": float(geom.bounds[3]),
                        },
                    },
                }
                features.append(feature)
            except Exception:
                continue

        return {
            "type": "FeatureCollection",
            "features": features,
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        }

    def create_summary_tables(self, trend_df: pd.DataFrame) -> Dict:
        tr = trend_df["Trend_Status"].value_counts().reset_index()
        tr.columns = ["Trend_Status", "Count"]
        tr["Percentage"] = (tr["Count"] / len(trend_df) * 100).round(2)
        return {"trend_summary": tr.to_dict("records")}

    def build_response(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_df: pd.DataFrame,
        all_years: List[str],
        years_for_trend: List[str],
        timestamp: str,
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
        timeseries_stats: Optional[Dict] = None,
    ) -> Dict:
        year_range = f"{min(years_for_trend)}-{max(years_for_trend)}"
        charts = self.generate_trend_charts(trend_df, year_range, subdis_codes, village_codes)
        geojson = self.create_village_json_for_map(villages_y, trend_df, all_years)
        tables = self.create_summary_tables(trend_df)
        timeseries_data = self.extract_village_timeseries_data(villages_y, trend_df, all_years)

        map_file, map_b64 = self.generate_trend_map_from_geojson(
            geojson,
            years_for_trend,
            subdis_codes,
            village_codes,
        )

        counts = trend_df["Trend_Status"].value_counts()
        timeseries_stats = timeseries_stats or {}
        summary_stats = {
            "file_info": {
                "total_villages": len(trend_df),
                "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "analysis_timestamp": timestamp,
                "filtered_by_subdis_cod": subdis_codes or [],
                "filtered_by_village_codes": village_codes or [],
                "trend_map_filename": map_file,
                "trend_map_base64": map_b64,
                "wells_csv_filename": timeseries_stats.get("wells_csv_filename", ""),
                "trend_csv_filename": timeseries_stats.get("trend_csv_filename", ""),
                "timeseries_yearly_csv_filename": timeseries_stats.get("village_timeseries_yearly_csv", ""),
                "timeseries_seasonal_csv_filename": timeseries_stats.get("village_timeseries_seasonal_csv", ""),
            },
            "trend_distribution": {
                "increasing": int(counts.get("Increasing", 0)),
                "decreasing": int(counts.get("Decreasing", 0)),
                "no_trend": int(counts.get("No-Trend", 0)),
                "insufficient_data": int(counts.get("Insufficient Data", 0)),
                "total": len(trend_df),
            },
        }

        color_mapping = {
            "Increasing": {"color": "#FF6B6B", "description": "Groundwater level decreasing (depth increasing)"},
            "Decreasing": {"color": "#4ECDC4", "description": "Groundwater level rising (depth decreasing)"},
            "No-Trend": {"color": "#95A5A6", "description": "No significant trend detected"},
            "Insufficient Data": {"color": "#F39C12", "description": "Insufficient data for analysis"},
        }

        villages = [
            {
                "Village_ID": r["Village_ID"],
                "Village_Name": r["Village_Name"],
                "Block": r["Block"],
                "District": r["District"],
                "SUBDIS_COD": r["SUBDIS_COD"],
                "Trend_Status": r["Trend_Status"],
                "Color": r["Color"],
                "Mann_Kendall_Tau": float(r["Mann_Kendall_Tau"]) if pd.notna(r["Mann_Kendall_Tau"]) else None,
                "P_Value": float(r["P_Value"]) if pd.notna(r["P_Value"]) else None,
                "Sen_Slope": float(r["Sen_Slope"]) if pd.notna(r["Sen_Slope"]) else None,
                "Data_Points": int(r["Data_Points"]),
                "Years_Analyzed": r["Years_Analyzed"],
                "Mean_Depth": float(r["Mean_Depth"]) if pd.notna(r["Mean_Depth"]) else None,
            }
            for _, r in trend_df.iterrows()
        ]

        return {
            "success": True,
            "summary_stats": summary_stats,
            "village_geojson": geojson,
            "villages": villages,
            "charts": charts,
            "summary_tables": tables,
            "color_mapping": color_mapping,
            "total_villages": len(villages),
            "analysis_timestamp": timestamp,
            "filtered_by_subdis_cod": subdis_codes or [],
            "filtered_by_village_codes": village_codes or [],
            "trend_map_filename": map_file,
            "trend_map_base64": map_b64,
            "village_timeseries_data": timeseries_data,
            "all_years": all_years,
        }


# ===== END trend_service.py =====


# ===== BEGIN villages_catchment_service.py =====


class VillagesCatchmentService:
    def __init__(self):
        self.media_root = MEDIA_ROOT
        self.catchment_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_shp",
            "Catchments",
            "Catchment.shp",
        )
        self.village_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_shp",
            "Final_Village",
            "Village.shp",
        )

    def villages_by_catchment(self, drain_no: Any) -> Dict[str, Any]:
        if drain_no is None:
            raise ValueError("Drain_No is required")

        if not os.path.exists(self.catchment_path):
            raise FileNotFoundError(f"Catchment.shp not found at: {self.catchment_path}")
        if not os.path.exists(self.village_path):
            raise FileNotFoundError(f"Village.shp not found at: {self.village_path}")

        try:
            catchment_gdf = gpd.read_file(self.catchment_path).to_crs("EPSG:4326")
            village_gdf = gpd.read_file(self.village_path).to_crs("EPSG:4326")
        except Exception as exc:
            raise RuntimeError(f"Failed to read shapefiles: {str(exc)}") from exc

        if "Drain_No" not in catchment_gdf.columns:
            raise ValueError(
                f"Column 'Drain_No' not found in catchment shapefile. "
                f"Available columns: {list(catchment_gdf.columns)}"
            )

        selected_catchment = catchment_gdf[catchment_gdf["Drain_No"].astype(str) == str(drain_no)]
        if selected_catchment.empty:
            raise FileNotFoundError(f"Catchment with Drain_No {drain_no} not found")

        try:
            villages_intersecting = gpd.sjoin(
                village_gdf,
                selected_catchment,
                predicate="intersects",
                how="inner",
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to compute villages intersecting with catchment: {str(exc)}") from exc

        village_key = "village_co" if "village_co" in villages_intersecting.columns else None
        if village_key:
            villages_intersecting = villages_intersecting.drop_duplicates(subset=[village_key])
        else:
            villages_intersecting = villages_intersecting.drop_duplicates()

        catchment_geom = unary_union(selected_catchment.geometry)
        results = []

        for _, row in villages_intersecting.iterrows():
            village_code = row.get("village_co", "Unknown")
            village_name = row.get("shapeName", f"Village_{village_code}")

            overlap_percentage = None
            try:
                village_geom = row.geometry
                intersection_area = village_geom.intersection(catchment_geom).area
                village_total_area = village_geom.area
                if village_total_area > 0:
                    overlap_percentage = round((intersection_area / village_total_area) * 100, 2)
            except Exception:
                overlap_percentage = None

            item = {
                "village_code": village_code,
                "name": village_name,
            }
            if overlap_percentage is not None:
                item["overlap_percentage"] = overlap_percentage
            results.append(item)

        return {
            "drain_no": drain_no,
            "total_villages": len(results),
            "villages": results,
            "note": "Includes all villages that have any intersection with the catchment boundary",
        }

    def available_drain_numbers(self) -> Dict[str, Any]:
        if not os.path.exists(self.catchment_path):
            raise FileNotFoundError(f"Catchment.shp not found at: {self.catchment_path}")

        try:
            catchment_gdf = gpd.read_file(self.catchment_path)
        except Exception as exc:
            raise RuntimeError(f"Failed to check available drain numbers: {str(exc)}") from exc

        if "Drain_No" in catchment_gdf.columns:
            drain_numbers = sorted(catchment_gdf["Drain_No"].dropna().unique().tolist())
            return {
                "message": "API is working",
                "available_drain_numbers": drain_numbers,
                "total_catchments": len(drain_numbers),
            }

        return {
            "message": "API is working",
            "error": "Drain_No column not found",
            "available_columns": list(catchment_gdf.columns),
        }


# ===== END villages_catchment_service.py =====


# ===== BEGIN villages_catchment_service.py =====


class VillagesCatchmentService:
    def __init__(self):
        self.media_root = MEDIA_ROOT
        self.catchment_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_shp",
            "Catchments",
            "Catchment.shp",
        )
        self.village_path = os.path.join(
            self.media_root,
            "gwa_data",
            "gwa_shp",
            "Final_Village",
            "Village.shp",
        )

    def villages_by_catchment(self, drain_no: Any) -> Dict[str, Any]:
        if drain_no is None:
            raise ValueError("Drain_No is required")

        if not os.path.exists(self.catchment_path):
            raise FileNotFoundError(f"Catchment.shp not found at: {self.catchment_path}")
        if not os.path.exists(self.village_path):
            raise FileNotFoundError(f"Village.shp not found at: {self.village_path}")

        try:
            catchment_gdf = gpd.read_file(self.catchment_path).to_crs("EPSG:4326")
            village_gdf = gpd.read_file(self.village_path).to_crs("EPSG:4326")
        except Exception as exc:
            raise RuntimeError(f"Failed to read shapefiles: {str(exc)}") from exc

        if "Drain_No" not in catchment_gdf.columns:
            raise ValueError(
                f"Column 'Drain_No' not found in catchment shapefile. "
                f"Available columns: {list(catchment_gdf.columns)}"
            )

        selected_catchment = catchment_gdf[catchment_gdf["Drain_No"].astype(str) == str(drain_no)]
        if selected_catchment.empty:
            raise FileNotFoundError(f"Catchment with Drain_No {drain_no} not found")

        try:
            villages_intersecting = gpd.sjoin(
                village_gdf,
                selected_catchment,
                predicate="intersects",
                how="inner",
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to compute villages intersecting with catchment: {str(exc)}") from exc

        village_key = "village_co" if "village_co" in villages_intersecting.columns else None
        if village_key:
            villages_intersecting = villages_intersecting.drop_duplicates(subset=[village_key])
        else:
            villages_intersecting = villages_intersecting.drop_duplicates()

        catchment_geom = unary_union(selected_catchment.geometry)
        results = []

        for _, row in villages_intersecting.iterrows():
            village_code = row.get("village_co", "Unknown")
            village_name = row.get("shapeName", f"Village_{village_code}")

            overlap_percentage = None
            try:
                village_geom = row.geometry
                intersection_area = village_geom.intersection(catchment_geom).area
                village_total_area = village_geom.area
                if village_total_area > 0:
                    overlap_percentage = round((intersection_area / village_total_area) * 100, 2)
            except Exception:
                overlap_percentage = None

            item = {
                "village_code": village_code,
                "name": village_name,
            }
            if overlap_percentage is not None:
                item["overlap_percentage"] = overlap_percentage
            results.append(item)

        return {
            "drain_no": drain_no,
            "total_villages": len(results),
            "villages": results,
            "note": "Includes all villages that have any intersection with the catchment boundary",
        }

    def available_drain_numbers(self) -> Dict[str, Any]:
        if not os.path.exists(self.catchment_path):
            raise FileNotFoundError(f"Catchment.shp not found at: {self.catchment_path}")

        try:
            catchment_gdf = gpd.read_file(self.catchment_path)
        except Exception as exc:
            raise RuntimeError(f"Failed to check available drain numbers: {str(exc)}") from exc

        if "Drain_No" in catchment_gdf.columns:
            drain_numbers = sorted(catchment_gdf["Drain_No"].dropna().unique().tolist())
            return {
                "message": "API is working",
                "available_drain_numbers": drain_numbers,
                "total_catchments": len(drain_numbers),
            }

        return {
            "message": "API is working",
            "error": "Drain_No column not found",
            "available_columns": list(catchment_gdf.columns),
        }


# ===== END villages_catchment_service.py =====


# ===== BEGIN upload_service.py =====





class CSVUploadService:
    async def upload_csv(self, csv_file: UploadFile) -> dict:
        if not csv_file or not csv_file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please upload a CSV file with key 'csv_file'",
            )

        if not csv_file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files are allowed",
            )

        try:
            settings = Settings()
            temp_dir = settings.TEMP_DIR
            print(temp_dir)
            os.makedirs(temp_dir, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            filename = f"csv_{timestamp}_{unique_id}.csv"
            file_path = os.path.join(temp_dir, filename)

            content = await csv_file.read()
            with open(file_path, "wb") as file_obj:
                file_obj.write(content)

            if not os.path.exists(file_path):
                raise RuntimeError("File not saved correctly to disk")

            file_size = os.path.getsize(file_path)

            return {
                "success": True,
                "message": "CSV file uploaded successfully",
                "data": {
                    "filename": filename,
                    "original_name": csv_file.filename,
                    "file_path": file_path,
                    "file_size": f"{file_size} bytes",
                    "uploaded_at": datetime.now().isoformat(),
                    "temp_directory": str(temp_dir),
                    "temp_directory": str(temp_dir),
                },
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc

# ===== END upload_service.py =====


# ===== BEGIN well_service.py =====


class WellLocation:

    def __init__(self):
        self.crud = None

    def _normalize_codes(self, codes) -> list[int]:
        if codes is None:
            return []
        if isinstance(codes, list):
            normalized = []
            for code in codes:
                if code is None or str(code).strip() == "":
                    continue
                normalized.append(int(code))
            return normalized
        return [int(codes)] if str(codes).strip() != "" else []

    def get_wells(self, db: Session, payload: Any):
        if isinstance(payload, list):
            village_codes = self._normalize_codes(payload)
            subdis_codes = []
        else:
            if isinstance(payload, WellRequest):
                data = payload.model_dump()
            elif isinstance(payload, dict):
                data = payload
            else:
                raise HTTPException(status_code=400, detail="Invalid request payload")

            village_codes = self._normalize_codes(data.get("village_code") or data.get("village_codes"))
            subdis_codes = self._normalize_codes(data.get("subdis_cod") or data.get("subdis_codes"))

        if not village_codes and not subdis_codes:
            raise HTTPException(status_code=400, detail="village_code/subdis_cod (or village_codes/subdis_codes) is required")

        self.crud = WellCrud(db)
        return self.crud.get_filtered_wells(village_codes, subdis_codes)


# ===== END well_service.py =====
