from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from app.services.forecast_service import ForecastService

router = APIRouter()

service = ForecastService()


class ForecastRequest(BaseModel):
    method: str                 # "arima" or "linear_regression"
    forecast_type: str          # "single" or "range"
    target_years: List[int]
    timeseries_yearly_csv_filename: str


@router.post("/forecast")
def generate_forecast(payload: ForecastRequest):
    try:
        result = service.process_forecast(
            method=payload.method,
            forecast_type=payload.forecast_type,
            target_years=payload.target_years,
            csv_filename=payload.timeseries_yearly_csv_filename
        )

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
