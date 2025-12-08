from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.stress_identification_service import StressIdentificationService


router = APIRouter()
service = StressIdentificationService()


class StressRequest(BaseModel):
    gsrData: List[Dict[str, Any]]
    years_count: int
    selectedSubDistricts: List[Any] = []
    timestamp: str | None = None


@router.post("/stress")
def compute_stress(request: StressRequest):
    try:
        response = service.compute_stress(
            gsr_data=request.gsrData,
            years_count=request.years_count,
        )
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stress")
def health_check():
    return {
        "success": True,
        "service": "Stress Identification API",
        "version": "1.0",
        "description": "Computes stress values using GSR and injection shapefile",
    }
