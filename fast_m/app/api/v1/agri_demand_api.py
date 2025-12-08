# app/api/v1/agri_demand_api.py
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.services.agri_demand_service import (
    load_villages_gdf, strict_filter, get_column_mapping,
    parse_to_list, compute_for_village_row_optimized,
    batch_get_crop_data, generate_crop_water_demand_charts, CROPLAND_COL
)
from app.core.database import get_db

router = APIRouter()


@router.post("/agricultural")
def agri_demand_post(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """POST API without schema"""

    village_code = parse_to_list(payload.get("village_code"))
    subdistrict_code = parse_to_list(payload.get("subdistrict_code"))

    if not village_code and not subdistrict_code:
        raise HTTPException(status_code=400, detail="Either village_code or subdistrict_code is required")

    # Seasons
    seasons = []
    seasons_data = payload.get("seasons") or {}

    if seasons_data.get("kharif"): seasons.append("Kharif")
    if seasons_data.get("rabi"): seasons.append("Rabi")
    if seasons_data.get("zaid"): seasons.append("Zaid")

    # Crops
    crops = []
    selectedCrops = payload.get("selectedCrops", {})
    for _, crop_list in selectedCrops.items():
        if isinstance(crop_list, list):
            crops.extend(crop_list)

    crops = list(dict.fromkeys(crops))

    # fallback fields if needed
    if not seasons:
        seasons = parse_to_list(payload.get("season"))

    if not crops:
        crops = parse_to_list(payload.get("crop"))

    if not seasons:
        raise HTTPException(status_code=400, detail="At least one season must be selected")
    if not crops:
        raise HTTPException(status_code=400, detail="At least one crop must be selected")

    # irrigation intensity
    try:
        irrigation_intensity = float(
            payload.get("irrigationIntensity")
            or payload.get("irrigation_intensity")
            or 0.8
        )
    except:
        raise HTTPException(status_code=400, detail="irrigationIntensity must be numeric")

    if irrigation_intensity <= 0:
        raise HTTPException(status_code=400, detail="irrigationIntensity must be > 0")

    # groundwater factor
    try:
        groundwater_factor = float(
            payload.get("groundwaterFactor")
            or payload.get("groundwater_factor")
            or 0.8
        )
    except:
        raise HTTPException(status_code=400, detail="groundwaterFactor must be numeric")

    include_charts = bool(payload.get("include_charts", False))

    # Load Shapefile
    gdf = load_villages_gdf()

    # Strict filter
    filtered, debug_info = strict_filter(
        gdf, village_code=village_code, subdistrict_code=subdistrict_code
    )

    if 'error' in debug_info:
        raise HTTPException(status_code=400, detail=debug_info)

    if filtered.empty:
        raise HTTPException(status_code=404, detail={"error": "No villages matched", "debug_info": debug_info})

    col_mapping = get_column_mapping(gdf)

    # Load crop DB rows only once
    crop_data_cache = batch_get_crop_data(db, seasons, crops)

    results = []

    for _, row in filtered.iterrows():
        total_index, details = compute_for_village_row_optimized(
            row, seasons, crops, irrigation_intensity, crop_data_cache
        )

        cropland_col = col_mapping.get("cropland", CROPLAND_COL)
        cropland = float(row.get(cropland_col, 0) or 0)

        village_demand = (total_index * cropland * groundwater_factor) / 100

        results.append({
            "village": row.get("village", "N/A"),
            "village_code": row.get(col_mapping.get("village_code", "village_co")),
            "subdistrict_code": row.get(col_mapping.get("subdistrict_code", "SUBDIS_COD")),
            "cropland": cropland,
            "seasons": details,
            "index_sum_across_seasons_crops": total_index,
            "groundwater_factor": groundwater_factor,
            "village_demand": abs(village_demand) / 1000
        })

    response = {
        "success": True,
        "data": results,
        "seasons": seasons,
        "crops": crops,
        "villages_count": len(results),
        "debug_info": debug_info
    }

    if include_charts:
        response["charts"] = generate_crop_water_demand_charts(
            results, gdf, seasons, crops, irrigation_intensity
        )

    return response


@router.get("/agricultural")
def agri_demand_get(
    village_code: List[str] = Query(default=[]),
    subdistrict_code: List[str] = Query(default=[])
):
    """GET API without schema"""

    gdf = load_villages_gdf()

    filtered, debug_info = strict_filter(
        gdf, village_code=village_code, subdistrict_code=subdistrict_code
    )

    col_mapping = get_column_mapping(gdf)

    pet_cols = [c for c in filtered.columns if c.startswith("pet_")]
    pe_cols = [c for c in filtered.columns if c.startswith("pe_")]

    sample_cols = ["village"]
    for key in ["village_code", "subdistrict_code", "cropland"]:
        if key in col_mapping:
            sample_cols.append(col_mapping[key])

    return {
        "villages_count": int(len(filtered)),
        "debug_info": debug_info,
        "column_mapping": col_mapping,
        "sample": filtered[sample_cols].head(20).to_dict(orient="records")
        if sample_cols else []
    }
