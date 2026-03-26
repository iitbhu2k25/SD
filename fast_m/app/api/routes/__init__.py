import logging
from importlib import import_module

from fastapi import APIRouter

from app.api.routes.basic.basic import router as basic_router
from app.api.routes.extract.extract import router as extract_router
from app.api.routes.gwm.gwm import router as gwm_router
from app.api.routes.mapplot.mapplot import router as mapplot_router
from app.api.routes.swa.swa import router as swa_router
from app.api.routes.water.water_router import router as water_router
from app.api.routes.rainwater import rainwater

app_router = APIRouter()

app_router.include_router(gwm_router, prefix="/gwa", tags=["GWM"])
app_router.include_router(swa_router, prefix="/swa", tags=["SWA"])
app_router.include_router(basic_router, prefix="/basic", tags=["Basic"])
app_router.include_router(mapplot_router, prefix="/mapplot", tags=["Mapplot"])
app_router.include_router(extract_router, prefix="/extract", tags=["Extract"])
app_router.include_router(water_router, prefix="/water", tags=["Water "])
app_router.include_router(
    rainwater.router,
    prefix='/rainwater',
    tags=["Rainwater"]
)

