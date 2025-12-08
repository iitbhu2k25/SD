# app/api/v1/population_api.py
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.population_service import PopulationService
from app.core.database import get_db

router = APIRouter()


class PopulationRequest(BaseModel):
    csv_filename: str = Field(..., description="CSV file in media/temp/")

    villages: Optional[List[int]] = Field(None, alias="village_code")
    subdistricts: Optional[List[int]] = Field(None, alias="subdistrict_code")

    lpcd: Optional[float] = Field(60)

    model_config = {
        "populate_by_name": True,
        "extra": "ignore"
    }

    @property
    def has_village(self):
        return self.villages is not None

    @property
    def has_subdistrict(self):
        return self.subdistricts is not None


@router.post("/forecast-population")
async def population_forecast(
    payload: PopulationRequest,
    db: Session = Depends(get_db)
):
    if not payload.has_village and not payload.has_subdistrict:
        raise HTTPException(400, "Provide villages or subdistricts")

    service = PopulationService(db=db)

    try:
        result = service.forecast(
            csv_filename=payload.csv_filename,
            village_codes=payload.villages,
            subdistrict_codes=payload.subdistricts,
            lpcd=payload.lpcd
        )
        return result
    except Exception as e:
        raise HTTPException(500, str(e))
