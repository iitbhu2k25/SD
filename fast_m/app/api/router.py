# app/api/router.py
from fastapi import APIRouter

# Import the actual router objects (not modules)
from app.api.v1.well_api import router as well_router
from app.api.v1.upload_temp import router as upload_router
from app.api.v1.trend_api import router as trend_router
from app.api.v1.recharge_api import router as recharge_router
from app.api.v1.population_api import router as population_router
from app.api.v1.agri_demand_api import router as agri_demand_router
from app.api.v1.crops import router as crops_router
from app.api.v1.gsr import router as gsr_router
from app.api.v1.stress import router as stress_router
from app.api.v1.forecast import router as forecast_router
from app.api.v1.interpolation import router as interpolation_router
from app.api.v1.industrial_api import router as industrial_router
from app.api.v1.pdf_api import router as pdf_router

router = APIRouter()

# Include all versioned routes under /gwa
router.include_router(pdf_router, prefix="/gwa", tags=["PDF"])
router.include_router(gsr_router, prefix="/gwa", tags=["GSR"])
router.include_router(crops_router, prefix="/gwa", tags=["Crops"])
router.include_router(agri_demand_router, prefix="/gwa", tags=["Agricultural Demand"])
router.include_router(population_router, prefix="/gwa", tags=["Population Forecast"])
router.include_router(well_router, prefix="/gwa", tags=["Wells"])
router.include_router(upload_router, prefix="/gwa", tags=["Upload CSV"])
router.include_router(trend_router, prefix="/gwa", tags=["Trends"])
router.include_router(recharge_router, prefix="/gwa", tags=["Recharge"])
router.include_router(stress_router, prefix="/gwa", tags=["Stress Identification"])
router.include_router(forecast_router, prefix="/gwa", tags=["Forecast"])
router.include_router(interpolation_router, prefix="/gwa", tags=["Interpolation"])
router.include_router(industrial_router, prefix="/gwa", tags=["Industrial"])


