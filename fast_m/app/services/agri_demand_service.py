# app/services/agri_demand_service.py
import os
import re
from typing import List, Dict, Any, Tuple
import pandas as pd
import geopandas as gpd

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.crop import Crop  # your SQLAlchemy model

# Constants
MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
PET_PREFIX = 'pet_'
PE_PREFIX = 'pe_'
CROPLAND_COL = 'CROPLAND'


def load_villages_gdf() -> gpd.GeoDataFrame:
    village_path = os.path.join(
        settings.MEDIA_ROOT,
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
    # build case-insensitive matches
    filters = []
    seasons = [s.strip() for s in seasons if s and str(s).strip()]
    crops = [c.strip() for c in crops if c and str(c).strip()]

    if not seasons or not crops:
        return {}

    query = db.query(Crop)
    # filter by season and crop (case-insensitive)
    # simplest portable approach: fetch where season in seasons and crop in crops (exact values)
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
