# app/api/v1/recharge_api.py
from typing import List, Optional, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.recharge_service import RechargeService

router = APIRouter()




class RechargeRequest(BaseModel):
    csvFilename: str
    selectedVillages: Optional[List[Union[str, int]]] = None
    selectedSubDistricts: Optional[List[int]] = None



# ==============================
# POST /recharge
# ==============================
@router.post("/recharge2")
async def groundwater_recharge_analysis(payload: RechargeRequest):
    service = RechargeService(media_root="media")
    try:
        selected_villages = None
        if payload.selectedVillages:
            selected_villages = [str(v) for v in payload.selectedVillages]

        result = service.analyze(
            csv_filename=payload.csvFilename,
            selected_villages=selected_villages,
            selected_subdistricts=payload.selectedSubDistricts
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
