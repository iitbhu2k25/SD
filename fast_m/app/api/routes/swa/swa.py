import os

from fastapi import APIRouter, HTTPException, status

from app.api.schema.swa.swa_schema import (
    AdminClimateImageRequest,
    AdminClimateRequest,
    AdminEflowImageRequest,
    AdminEflowRequest,
    AdminFdcImageRequest,
    AdminFdcRequest,
    AdminSurfaceWaterImageRequest,
    AdminSurfaceWaterRequest,
    ClimateComparisonRequest,
    ClimateRequest,
    EflowRequest,
    FlowDurationRequest,
    SubbasinMapRequest,
    SurfaceWaterRequest,
)
from app.api.service.swa.admin_service import SwaAdminService
from app.api.service.swa.analytics_service import SubbasinService, SurfaceWaterAnalyticsService
from app.database.config.dependency import db_dependency

router = APIRouter()


@router.get("/subbasin")
def get_subbasins(db: db_dependency):
    subbasins = SubbasinService(db).get_subbasins()
    if not subbasins:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No subbasins found")
    return subbasins


@router.post("/generate-subbasin-map")
def generate_subbasin_map(payload: SubbasinMapRequest, db: db_dependency):
    if not payload.subbasin_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No subbasin_ids provided")

    media_root = os.getenv("MEDIA_ROOT", "media")
    try:
        return SubbasinService(db).generate_subbasin_map(payload.subbasin_ids, media_root)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/fdc")
def flow_duration_curve(payload: FlowDurationRequest, db: db_dependency):
    if not payload.subs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subs (list of subbasin IDs) is required")
    return SurfaceWaterAnalyticsService(db).fdc_for_subbasins(payload.subs)


@router.post("/surfacewater")
def surface_water(payload: SurfaceWaterRequest, db: db_dependency):
    if payload.subbasins is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subbasins parameter is required")
    return SurfaceWaterAnalyticsService(db).surplus_runoff(payload.subbasins)


@router.post("/eflow")
def eflow(payload: EflowRequest, db: db_dependency):
    if not payload.sub_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sub_ids is required")
    return SurfaceWaterAnalyticsService(db).eflow(payload.sub_ids)


@router.post("/climate")
def climate(payload: ClimateRequest, db: db_dependency):
    if not payload.sub_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No subbasin IDs provided")
    if payload.scenario not in [126, 245, 370, 585]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scenario. Must be one of: 126, 245, 370, 585")

    start = payload.start_year
    end = payload.end_year
    year = payload.year
    if start is not None and end is not None and end < start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_year must be >= start_year")

    return SurfaceWaterAnalyticsService(db).climate(payload.sub_ids, payload.scenario, year, start, end)


@router.post("/climate/comparison")
def climate_comparison(payload: ClimateComparisonRequest, db: db_dependency):
    end_year = payload.end_year if payload.end_year is not None else payload.start_year
    if end_year < payload.start_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_year must be >= start_year")
    if not payload.sub_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No subbasin IDs provided")

    return SurfaceWaterAnalyticsService(db).climate_comparison(
        payload.sub_ids,
        payload.scenarios,
        payload.start_year,
        end_year,
    )


@router.post("/adminfdc")
def admin_fdc(payload: AdminFdcRequest, db: db_dependency):
    if payload.subdistrict_codes is None and payload.vlcode is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either subdistrict_codes or vlcode is required")
    if payload.subdistrict_codes is not None and payload.vlcode is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide only one of subdistrict_codes or vlcode, not both",
        )
    return SwaAdminService(db).village_fdc(payload.subdistrict_codes, payload.vlcode)


@router.post("/adminfdcimage")
def admin_fdc_image(payload: AdminFdcImageRequest, db: db_dependency):
    try:
        return SwaAdminService(db).village_fdc_image(int(payload.vlcode))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/adminsurfacewater")
def admin_surfacewater(payload: AdminSurfaceWaterRequest, db: db_dependency):
    if payload.subdistrict_codes is None and payload.vlcode is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either subdistrict_codes or vlcode is required")
    if payload.subdistrict_codes is not None and payload.vlcode is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide only one of subdistrict_codes or vlcode, not both",
        )
    return SwaAdminService(db).village_surplus(payload.subdistrict_codes, payload.vlcode)


@router.post("/adminsurfacewaterimage")
def admin_surfacewater_image(payload: AdminSurfaceWaterImageRequest, db: db_dependency):
    if payload.vlcode is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="vlcode is required")
    if payload.subdistrict_codes is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide only vlcode, not both parameters")

    try:
        return SwaAdminService(db).village_surplus_image(int(payload.vlcode))
    except ValueError as exc:
        status_code = status.HTTP_404_NOT_FOUND if "No data" in str(exc) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.post("/eflowadmin")
def admin_eflow(payload: AdminEflowRequest, db: db_dependency):
    if payload.subdistrict_codes and payload.vlcodes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Send either subdistrict_codes or vlcodes, not both.")
    if not payload.subdistrict_codes and not payload.vlcodes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either subdistrict_codes or vlcodes is required.")
    return SwaAdminService(db).admin_eflow(payload.subdistrict_codes, payload.vlcodes)


@router.post("/eflowadminimage")
def admin_eflow_image(payload: AdminEflowImageRequest, db: db_dependency):
    try:
        return SwaAdminService(db).admin_eflow_image(payload.vlcode, payload.method_key)
    except ValueError as exc:
        msg = str(exc)
        if msg == "Invalid method_key":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from exc
        if msg == "No data found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from exc


@router.post("/adminclimate")
def admin_climate(payload: AdminClimateRequest, db: db_dependency):
    end_year = payload.end_year if payload.end_year is not None else payload.start_year
    if payload.subdistrict_codes and payload.vlcodes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide either subdistrict_codes or vlcodes, not both.")
    if not payload.subdistrict_codes and not payload.vlcodes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either subdistrict_codes or vlcodes must be provided.")
    if end_year < payload.start_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_year must be >= start_year")

    return SwaAdminService(db).admin_climate(
        payload.subdistrict_codes,
        payload.vlcodes,
        payload.source_id,
        payload.start_year,
        end_year,
    )


@router.post("/adminclimateimage")
def admin_climate_image(payload: AdminClimateImageRequest, db: db_dependency):
    end_year = payload.end_year if payload.end_year is not None else payload.start_year
    if end_year < payload.start_year:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_year must be >= start_year")
    try:
        return SwaAdminService(db).admin_climate_image(payload.vlcode, payload.source_id, payload.start_year, end_year)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
