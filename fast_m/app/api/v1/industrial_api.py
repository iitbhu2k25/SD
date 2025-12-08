from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.industrial_service import IndustrialForecastService

router = APIRouter()


class IndustrialRequest(BaseModel):
    csv_filename: str
    groundwater_industrial_demand: float
    village_codes: Optional[List[int]] = None
    subdistrict_codes: Optional[List[int]] = None


@router.post("/industrial")
def industrial_forecast(
    payload: IndustrialRequest,
    db: Session = Depends(get_db)
):
    service = IndustrialForecastService(db)

    result = service.compute_industrial_demand(
        csv_filename=payload.csv_filename,
        groundwater_industrial_demand=payload.groundwater_industrial_demand,
        village_codes=payload.village_codes,
        subdistrict_codes=payload.subdistrict_codes
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    return result
