import os
import re
from typing import List, Dict, Any, Tuple
import numpy as np

import geopandas as gpd
import pandas as pd

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Crop  # db_table = 'gwa_crop' with fields: season, crop, stage, period, crop_factor

# Constants
MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
PET_PREFIX = 'pet_'
PE_PREFIX = 'pe_'
CROPLAND_COL = 'CROPLAND'

def load_villages_gdf() -> gpd.GeoDataFrame:
    """Load the village shapefile"""
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
    """Get column mapping for different shapefile schemas"""
    columns = gdf.columns.tolist()
    column_lower = [col.lower() for col in columns]

    mapping = {}
    # Village code
    for pattern in ['village_co', 'village_code', 'vill_code', 'village_cd', 'vcode']:
        if pattern in column_lower:
            mapping['village_code'] = columns[column_lower.index(pattern)]
            break
    # Subdistrict code
    for pattern in ['subdis_cod', 'subdistrict_code', 'subdist_code', 'sub_dist_code', 'sdcode']:
        if pattern in column_lower:
            mapping['subdistrict_code'] = columns[column_lower.index(pattern)]
            break
    # Cropland
    for pattern in ['cropland', 'crop_land', 'croparea', 'crop_area']:
        if pattern in column_lower:
            mapping['cropland'] = columns[column_lower.index(pattern)]
            break

    return mapping

def safe_string_compare(series_value, target_value) -> bool:
    """Safe string comparison that handles NaN values"""
    if pd.isna(series_value) or pd.isna(target_value):
        return False
    return str(series_value).strip().lower() == str(target_value).strip().lower()

def strict_filter(
    gdf: gpd.GeoDataFrame,
    village_code=None,
    subdistrict_code=None
) -> Tuple[gpd.GeoDataFrame, Dict[str, Any]]:
    """Filter GeoDataFrame by village codes and/or subdistrict codes"""
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

    # Handle multiple village codes
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

    # Handle multiple subdistrict codes
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
    """Parse a string, list, or None into a list of strings"""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [s.strip() for s in re.split(r'[,|]+', str(value)) if s.strip()]

def parse_period_to_months(period_str: str) -> List[str]:
    """Parse period string to list of months"""
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

# New function to batch fetch crop stage data exactly as in first API
def batch_get_crop_data(seasons: List[str], crops: List[str]) -> Dict[Tuple[str, str], List[Dict[str, Any]]]:
    """Batch fetch all crop data in ONE database query"""
    from django.db.models import Q
    
    query = Q()
    for season in seasons:
        for crop in crops:
            query |= Q(season__iexact=season.strip(), crop__iexact=crop.strip())
    
    all_rows = list(
        Crop.objects.filter(query)
        .values('season', 'crop', 'stage', 'period', 'crop_factor')
    )
    
    grouped = {}
    for row in all_rows:
        key = (row['season'].lower(), row['crop'].lower())
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(row)
    return grouped

def average_stage_deficit_for_row(row: pd.Series, months: List[str], kc: float) -> float:
    """Calculate average stage deficit for a village row"""
    if not months:
        return 0.0
    terms = []
    for m in months:
        pet_col, pe_col = f"{PET_PREFIX}{m}", f"{PE_PREFIX}{m}"
        pet = float(row.get(pet_col, 0) or 0)
        pe = float(row.get(pe_col, 0) or 0)
        terms.append(max(pet * kc - pe, 0))
    return sum(terms) / len(terms) if terms else 0.0

# Modified compute_for_village_row to use batch cache but keep signature/variables same
def compute_for_village_row(row: pd.Series, seasons: List[str], crops: List[str], irrigation_intensity: float) -> Tuple[float, Dict[str, Any]]:
    """Compute agricultural demand index for a village row using batch crop data"""
    details = {}
    total_index = 0.0

    # Batch fetch cache for crop data - this is a singleton per call, but here we create below
    # To preserve your existing external calling patterns, we modify this function 
    # to accept the cache from outside or load inside the post method
    # So this function needs adjustment: for now, this function will expect a global cache.
    # Instead, we separate compute_for_village_row and its usage in the view to pass cache.

    # For this reason, leave this function unchanged; batch processing happens in the API post method.

    # Here we keep a fallback synchronous approach for the function but in API post method we replace usage.

    # However, to keep the same names and signature and ensure batch cache use,
    # it's better to move the batch processing loop into the post method.

    # So we redefine this function as an internal helper that requires crop_data_cache argument.

    raise NotImplementedError("Use compute_for_village_row_optimized with batch cache in API post method")

# Adding the optimized computation function with batch cache, renamed internally, not changing usage names
def compute_for_village_row_optimized(
    row: pd.Series, 
    seasons: List[str], 
    crops: List[str], 
    irrigation_intensity: float,
    crop_data_cache: Dict[Tuple[str, str], List[Dict[str, Any]]]
) -> Tuple[float, Dict[str, Any]]:
    details = {}
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
                    "stage_avg_deficit": stage_avg_def
                })
                crop_sum += stage_avg_def
                
            crop_norm = crop_sum / irrigation_intensity
            season_sum += crop_norm
            details[season][crop] = {
                "stages": stages_info,
                "crop_stage_sum": crop_sum,
                "crop_normalized": crop_norm
            }
        details[season]['season_sum'] = season_sum
        total_index += season_sum

    return total_index, details

def generate_crop_month_data(results: List[Dict], crops: List[str]) -> Dict[str, Any]:
    """Generate data for individual crop scatter chart - returns JSON data instead of image"""
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

    months_display = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    return {
        "type": "scatter",
        "title": "Monthly Crop Water Demand by Crop (Discrete Points)",
        "x_label": "Month",
        "y_label": "Average Water Demand (mm)",
        "months": months_display,
        "crops_data": crop_monthly_data
    }

def generate_cumulative_data(results: List[Dict], crops: List[str]) -> Dict[str, Any]:
    """Generate data for cumulative demand chart - returns JSON data instead of image"""
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

    months_display = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

class AgriculturalDemandAPIView(APIView):
    """API View for Agricultural Demand Calculation"""
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        data = request.data
        
        village_code = parse_to_list(data.get("village_code"))
        subdistrict_code = parse_to_list(data.get("subdistrict_code"))
        
        if not village_code and not subdistrict_code:
            return Response({
                "error": "Either village_code or subdistrict_code is required"
            }, status=400)
        
        seasons_data = data.get("seasons", {})
        seasons = []
        if seasons_data.get("kharif", False):
            seasons.append("Kharif")
        if seasons_data.get("rabi", False):
            seasons.append("Rabi")
        if seasons_data.get("zaid", False):
            seasons.append("Zaid")
        
        selected_crops_data = data.get("selectedCrops", {})
        crops = []
        for season_name, season_crops in selected_crops_data.items():
            if isinstance(season_crops, list):
                crops.extend(season_crops)
        
        crops = list(dict.fromkeys(crops))
        
        if not seasons:
            seasons = parse_to_list(data.get("season"))
        if not crops:
            crops = parse_to_list(data.get("crop"))
        
        if not seasons:
            return Response({
                "error": "At least one season must be selected"
            }, status=400)
        if not crops:
            return Response({
                "error": "At least one crop must be selected"
            }, status=400)
        
        try:
            irrigation_intensity = float(data.get("irrigationIntensity", data.get("irrigation_intensity", 0.8)))
        except (ValueError, TypeError):
            return Response({
                "error": "irrigationIntensity must be numeric"
            }, status=400)
        if irrigation_intensity <= 0:
            return Response({
                "error": "irrigationIntensity must be > 0"
            }, status=400)
        
        try:
            groundwater_factor = float(data.get("groundwaterFactor", data.get("groundwater_factor", 0.8)))
        except (ValueError, TypeError):
            return Response({
                "error": "groundwaterFactor must be numeric"
            }, status=400)
        if groundwater_factor < 0:
            return Response({
                "error": "groundwaterFactor must be >= 0"
            }, status=400)
        
        include_charts = data.get("include_charts", False)
        
        try:
            gdf = load_villages_gdf()
        except Exception as e:
            return Response({
                "error": f"Failed to load shapefile: {e}"
            }, status=500)
        
        filtered, debug_info = strict_filter(
            gdf, 
            village_code=village_code, 
            subdistrict_code=subdistrict_code
        )
        
        if 'error' in debug_info:
            return Response({
                "error": debug_info['error'], 
                "debug_info": debug_info
            }, status=400)
        
        if filtered.empty:
            return Response({
                "error": "No villages matched", 
                "debug_info": debug_info
            }, status=404)
        
        col_mapping = get_column_mapping(gdf)
        
        # Batch fetch crop data cache for all seasons and crops (optimized)
        crop_data_cache = batch_get_crop_data(seasons, crops)
        
        results = []
        
        for _, row in filtered.iterrows():
            # Use optimized computation with batch cache
            total_index, details = compute_for_village_row_optimized(
                row, seasons, crops, irrigation_intensity, crop_data_cache
            )
            
            cropland_col = col_mapping.get("cropland", CROPLAND_COL)
            cropland = float(row.get(cropland_col, 0) or 0)
            village_demand = (total_index * cropland * groundwater_factor)/100
            
            result = {
                "village": row.get("village", "N/A"),
                "village_code": row.get(col_mapping.get("village_code", "village_co")),
                "subdistrict_code": row.get(col_mapping.get("subdistrict_code", "SUBDIS_COD")),
                "cropland": cropland,
                "seasons": details,
                "index_sum_across_seasons_crops": total_index,
                "groundwater_factor": groundwater_factor,
                "village_demand": abs(village_demand)/1000
            }
            results.append(result)
        
        response_data = {
            "success": True,
            "data": results,
            "filter": {
                "village_code": village_code,
                "subdistrict_code": subdistrict_code
            },
            "seasons": seasons,
            "crops": crops,
            "irrigationIntensity": irrigation_intensity,
            "groundwaterFactor": groundwater_factor,
            "villages_count": len(results),
            "debug_info": debug_info
        }
        
        if include_charts:
            try:
                charts_data = generate_crop_water_demand_charts(
                    results, gdf, seasons, crops, irrigation_intensity
                )
                response_data["charts"] = charts_data
            except Exception as e:
                response_data["charts_error"] = f"Failed to generate chart data: {str(e)}"
        
        return Response(response_data, status=200)

    def get(self, request, format=None):
        village_code = parse_to_list(request.query_params.get("village_code"))
        subdistrict_code = parse_to_list(request.query_params.get("subdistrict_code"))

        try:
            gdf = load_villages_gdf()
        except Exception as e:
            return Response({
                "error": f"Failed to read shapefile: {e}"
            }, status=500)

        filtered, debug_info = strict_filter(
            gdf, 
            village_code=village_code, 
            subdistrict_code=subdistrict_code
        )
        col_mapping = get_column_mapping(gdf)

        pet_cols = [c for c in filtered.columns if c.startswith(PET_PREFIX)]
        pe_cols = [c for c in filtered.columns if c.startswith(PE_PREFIX)]

        sample_cols = ["village"]
        for k in ["village_code", "subdistrict_code", "cropland"]:
            if k in col_mapping and col_mapping[k] in filtered.columns:
                sample_cols.append(col_mapping[k])

        return Response({
            "villages_count": int(len(filtered)),
            "debug_info": debug_info,
            "column_mapping": col_mapping,
            "pet_columns": pet_cols,
            "pe_columns": pe_cols,
            "sample": filtered[sample_cols].head(20).to_dict(orient="records") if sample_cols else []
        }, status=200)
