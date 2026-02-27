from fastapi import APIRouter
from app.api.routes.stp_operation import router as  stp_operation
from app.api.routes.location import router as location
from app.api.routes.gwz_operation import router as  gwz_operation
from app.api.routes.rainwater import router as rainwater
from app.api.routes.wqi import router as  wqi
from app.api.routes.usermanagement import router as usermanagement
from app.api.routes.authentication import router as  auth_route
from app.api.routes.raster_operation import router as  raster_operation
app_router = APIRouter()

app_router.include_router(
    auth_route,
    prefix="/authentication",
    tags=["Authentication"]
)
app_router.include_router(
    usermanagement,
    prefix="/users",
    tags=["User Management"]
)

app_router.include_router(
    raster_operation,
    prefix='/tools',
    tags=["Tools application"]
)
app_router.include_router(
    location,
    prefix="/location",
    tags=["Admin and Drain location"]
)

app_router.include_router(
    stp_operation,
    prefix="/stp_operation",
    tags=["Stp operations"]
)

app_router.include_router(
    gwz_operation,
    prefix="/gwz_operation",
    tags=["Ground water recharge"]
)
app_router.include_router(
    wqi,
    prefix='/wqi',
    tags=["water quality index"]
)

app_router.include_router(
    rainwater,
    prefix='/rainwater',
    tags=["Rainwater"]
)