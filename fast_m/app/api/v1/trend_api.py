# app/api/v1/trend_api.py
import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from datetime import datetime

from app.services.trend_service import TrendService

router = APIRouter()


class TrendRequest(BaseModel):
    wells_csv_filename: str = Field(..., description="File name inside media/temp/")
    subdis_codes: Optional[List[int]] = Field(None)
    village_codes: Optional[List[int]] = Field(None)
    trend_years: Optional[List[int]] = Field(None)
    return_type: Optional[str] = Field(
    "all",
    pattern="^(all|stats|charts|village_data|tables)$"
)


@router.post("/trends")
async def groundwater_trend_analysis(
    payload: TrendRequest,
    media_root: str = os.getenv("MEDIA_ROOT", "media"),  # adjust as needed
):
    """
    Exact replica of the Django view.
    Returns the same JSON structure (including base64 map, CSVs, GeoJSON…).
    """
    service = TrendService(media_root)

    # ------------------------------------------------------------------
    # 1. validation
    # ------------------------------------------------------------------
    if not payload.wells_csv_filename:
        raise HTTPException(status_code=400, detail="wells_csv_filename is required")

    has_subdis = payload.subdis_codes and len(payload.subdis_codes) > 0
    has_village = payload.village_codes and len(payload.village_codes) > 0

    if has_subdis and has_village:
        raise HTTPException(status_code=400, detail="Provide exactly one of subdis_codes or village_codes")
    if not has_subdis and not has_village:
        raise HTTPException(status_code=400, detail="Provide exactly one of subdis_codes or village_codes")

    wells_path = os.path.join(service.temp_media_dir, payload.wells_csv_filename)
    if not os.path.exists(wells_path):
        raise HTTPException(status_code=404, detail=f"Wells CSV not found: {payload.wells_csv_filename}")

    # ------------------------------------------------------------------
    # 2. filter shapefiles
    # ------------------------------------------------------------------
    if has_subdis:
        centroids, villages = service._filter_by_subdis(payload.subdis_codes)
    else:
        centroids, villages = service._filter_by_village(payload.village_codes)

    # ------------------------------------------------------------------
    # 3. time-series
    # ------------------------------------------------------------------
    villages_y, villages_s, all_years, ts_stats = service.create_village_time_series(
        wells_path, centroids, villages
    )
    ts_stats["wells_csv_filename"] = payload.wells_csv_filename

    # ------------------------------------------------------------------
    # 4. years for MK
    # ------------------------------------------------------------------
    years_for_trend = [str(y) for y in (payload.trend_years or [int(y) for y in all_years])]

    # ------------------------------------------------------------------
    # 5. Mann-Kendall
    # ------------------------------------------------------------------
    trend_df = service.perform_mann_kendall_analysis(villages_y, years_for_trend, all_years)

    # ---- save MK CSV (same naming convention) ----
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = (
        "subdis_" + "_".join(map(str, payload.subdis_codes[:3])) + ("_etc" if len(payload.subdis_codes) > 3 else "")
        if has_subdis
        else "vill_" + "_".join(map(str, payload.village_codes[:3])) + ("_etc" if len(payload.village_codes) > 3 else "")
    )
    mk_csv = f"mann_kendall_results_{tag}_{min(years_for_trend)}_{max(years_for_trend)}_{ts}.csv"
    mk_path = os.path.join(service.temp_media_dir, mk_csv)
    numeric = ["Mann_Kendall_Tau", "P_Value", "Sen_Slope", "Mean_Depth", "Std_Depth", "Min_Depth", "Max_Depth"]
    trend_df[numeric] = trend_df[numeric].round(4)
    trend_df.to_csv(mk_path, index=False)
    ts_stats["trend_csv_filename"] = mk_csv

    # ------------------------------------------------------------------
    # 6. full response
    # ------------------------------------------------------------------
    full = service.build_response(
        villages_y,
        trend_df,
        all_years,
        years_for_trend,
        ts,
        subdis_codes=payload.subdis_codes if has_subdis else None,
        village_codes=payload.village_codes if has_village else None,
        timeseries_stats=ts_stats,
    )

    # ------------------------------------------------------------------
    # 7. return_type handling (identical to Django)
    # ------------------------------------------------------------------
    rt = payload.return_type
    if rt == "stats":
        return {"success": True, "summary_stats": full["summary_stats"]}
    if rt == "charts":
        return {"success": True, "summary_stats": full["summary_stats"], "charts": full["charts"]}
    if rt == "village_data":
        return {"success": True, "village_geojson": full["village_geojson"], "villages": full["villages"]}
    if rt == "tables":
        return {"success": True, "summary_stats": full["summary_stats"], "summary_tables": full["summary_tables"]}

    return full