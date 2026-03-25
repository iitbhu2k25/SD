import logging
from importlib import import_module

from fastapi import APIRouter

logger = logging.getLogger(__name__)


def _include_router(app: APIRouter, module_path: str, prefix: str, tags: list[str]) -> None:
    try:
        module = import_module(module_path)
        router = getattr(module, "router")
    except Exception as exc:
        logger.warning("Skipping router import for %s: %s", module_path, exc)
        return

    app.include_router(router, prefix=prefix, tags=tags)


app_router = APIRouter()

_include_router(app_router, "app.api.routes.gwm.gwm", prefix="/gwa", tags=["GWM"])
_include_router(app_router, "app.api.routes.swa.swa", prefix="/swa", tags=["SWA"])
_include_router(app_router, "app.api.routes.basic.basic", prefix="/basic", tags=["Basic"])
_include_router(app_router, "app.api.routes.mapplot.mapplot", prefix="/mapplot", tags=["Mapplot"])
_include_router(app_router, "app.api.routes.extract.extract", prefix="/extract", tags=["Extract"])
_include_router(app_router, "app.api.routes.water.water_router", prefix="/water", tags=["Water "])

