from fastapi import APIRouter
from app.api.routes.river_water_management import stp_operation
from app.api.routes.river_water_management import stp_location
from app.api.routes.ground_water_management import gwz_operation
from app.api.routes.usermanagement import user
from app.api.routes.authentication import auth_route
app_router = APIRouter()

app_router.include_router(
    auth_route.app,
    prefix="/authentication",
    tags=["Authentication"]
)
app_router.include_router(
    user.app,
    prefix="/users",
    tags=["User Management"]
)


app_router.include_router(
    stp_location.router,
    prefix="/location",
    tags=["Admin and Drain location"]
)

app_router.include_router(
    stp_operation.router,
    prefix="/stp_operation",
    tags=["Stp operations"]
)

app_router.include_router(
    gwz_operation.router,
    prefix="/gwz_operation",
    tags=["Ground water recharge"]
)
