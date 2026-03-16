import json
import os
from typing import Dict, List

from fastapi import APIRouter, Body, File, HTTPException, Query, Request, UploadFile, status

from app.api.schema.gwm.gwm_schema import CSVUploadResponse, ForecastRequest, IndustrialRequest, PopulationRequest, RechargeRequest, SeasonRequest, StressRequest, TrendRequest, VillagesCatchmentMetaResponse, VillagesCatchmentRequest, VillagesCatchmentResponse, WellResponse
from app.api.service.gwm.gwm_service import AgriDemandService, AdminUnitService, CropService, ForecastService, GSRService, IndustrialForecastService, InterpolationService, PDFMapService, PopulationService, RechargeService, StressIdentificationService, TrendService, CSVUploadService, VillagesCatchmentService, WellLocation
from app.database.config.dependency import db_dependency


router = APIRouter()
agri_service = AgriDemandService()
gsr_service = GSRService()
stress_service = StressIdentificationService()
forecast_service = ForecastService()
interpolation_service = InterpolationService()
villages_catchment_service = VillagesCatchmentService()


@router.post("/wells", response_model=list[WellResponse])
async def get_wells(request: Request, db: db_dependency):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        payload = {}
    return WellLocation().get_wells(db, payload)


@router.post("/upload-csv", response_model=CSVUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_csv(csv_file: UploadFile = File(...)):
    return await CSVUploadService().upload_csv(csv_file)


@router.post("/trends")
async def groundwater_trend_analysis(payload: TrendRequest, media_root: str = os.getenv("MEDIA_ROOT", "media")):
    return TrendService(media_root).groundwater_trend_analysis(payload)


@router.post("/recharge2")
async def groundwater_recharge_analysis(payload: RechargeRequest):
    return RechargeService(media_root="media").groundwater_recharge_analysis(payload)


@router.post("/adminunit")
async def get_admin_units(request: Request, media_root: str = os.getenv("MEDIA_ROOT", "media")):
    try:
        body = await request.json()
    except json.JSONDecodeError:
        body = {}
    return AdminUnitService(media_root).get_admin_units(body)


@router.post("/forecast-population")
async def population_forecast(payload: PopulationRequest, db: db_dependency):
    return PopulationService(db=db).population_forecast(payload)


@router.post("/agricultural")
def agri_demand_post(db: db_dependency, payload: Dict = Body(...)):
    return agri_service.agri_demand_post(db, payload)


@router.post("/crops")
def get_crops_by_season(payload: SeasonRequest, db: db_dependency):
    return CropService.get_crops_by_season_endpoint(db, payload)


@router.post("/gsr")
async def compute_gsr(request: Request):
    return await gsr_service.compute_gsr_from_request(request)


@router.post("/stress")
def compute_stress(payload: StressRequest):
    try:
        return stress_service.compute_stress(gsr_data=payload.gsrData, years_count=payload.years_count)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/forecast")
def generate_forecast(payload: ForecastRequest):
    return forecast_service.generate_forecast(payload)


@router.post("/interpolation", status_code=status.HTTP_200_OK)
async def interpolate_raster(request: Request):
    try:
        return await interpolation_service.interpolate_from_request(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Required file not found: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating or publishing raster: {str(exc)}") from exc


@router.post("/industrial")
def industrial_forecast(payload: IndustrialRequest, db: db_dependency):
    return IndustrialForecastService(db).industrial_forecast(payload)


@router.post("/pdf")
async def generate_pdf(request: Request):
    return await PDFMapService.generate_pdf_from_request(request)


@router.post("/villagescatchment", response_model=VillagesCatchmentResponse)
async def villages_by_catchment(payload: VillagesCatchmentRequest):
    try:
        return villages_catchment_service.villages_by_catchment(payload.drain_no)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/villagescatchment", response_model=VillagesCatchmentMetaResponse)
async def villages_by_catchment_meta():
    try:
        return villages_catchment_service.available_drain_numbers()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

