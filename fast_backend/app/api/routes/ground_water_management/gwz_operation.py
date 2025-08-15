from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import category_raster,StpPriorityDrainReport,StpPriorityAdminReport,celery_id
from app.api.service.river_water_management.stp_operation import GWAPriorityMapper
from app.utils.exception import validate
router=APIRouter()
@router.post("/gwz_visual_display", status_code=status.HTTP_200_OK)
@validate
async def gwz_raster_dislay(db:db_dependency,payload:category_raster):
    return GWAPriorityMapper().get_visual_raster(db,payload.clip,payload.place)

@router.post("/gwz_visual_operation", status_code=status.HTTP_200_OK)
@validate
async def gwz_raster_operation(db:db_dependency):
    pass


@router.post("/mar_visual_display", status_code=status.HTTP_200_OK)
@validate
async def mar_raster_dislay(db:db_dependency,payload:category_raster):
    pass

@router.post("/mar_visual_operation", status_code=status.HTTP_200_OK)
@validate
async def mar_raster_operation(db:db_dependency):
    pass


    