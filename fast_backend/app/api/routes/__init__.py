from fastapi import APIRouter
from app.api.routes import stp_operation
from app.api.routes import stp_location
from app.api.routes import stp_categories
from app.api.routes import auth_route
app_router = APIRouter()

app_router.include_router(
    auth_route.app,
    prefix="/authentication",
    tags=["user authentication"]
)
app_router.include_router(
    stp_location.router,
    prefix="/stp",
    tags=["STP Admin and Drain"]
)

app_router.include_router(
    stp_categories.router,
    prefix="/stp_sutability",
    tags=["STP SUTABILITY AND PRIORITY"]
)
app_router.include_router(
    stp_operation.router,
    prefix="/stp_operation",
    tags=["STP OPERATIONS"]
)
