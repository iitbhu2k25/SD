from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import category_raster,STPPriorityOutput
from app.api.service.ground_water_management.gwpz_operation import GWAPriorityMapper
from app.api.service.ground_water_management.gwpz_svc import Gwzp_service
from app.utils.exception import validate
from app.api.schema.stp_schema import STPCategory
router=APIRouter()
@router.get("/get_gwz_category",response_model=list[STPPriorityOutput])
@validate
async def get_raster_gwz(db:db_dependency,all_data: bool = False):
    return Gwzp_service.get_raster_GWZ(db,all_data)

@router.post("/gwz_visual_display", status_code=status.HTTP_200_OK)
@validate
async def gwz_raster_dislay(db:db_dependency,payload:category_raster):
    return GWAPriorityMapper().get_visual_raster(db,payload.clip,payload.place)

@router.post("/gwz_operation", status_code=status.HTTP_200_OK)
@validate
async def gwz_raster_operation(db:db_dependency,payload: STPCategory):
    raster_path,raster_weights=Gwzp_service.get_raster(db,payload)
    return GWAPriorityMapper().create_gwpz_map(raster_path,raster_weights,payload.clip,payload.place)


@router.post("/mar_visual_display", status_code=status.HTTP_200_OK)
@validate
async def mar_raster_dislay(db:db_dependency,payload:category_raster):
    pass

@router.post("/mar_visual_operation", status_code=status.HTTP_200_OK)
@validate
async def mar_raster_operation(db:db_dependency):
    pass


    