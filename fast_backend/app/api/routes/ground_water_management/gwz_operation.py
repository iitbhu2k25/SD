from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.schema.stp_schema import category_raster,STPPriorityOutput, STPSutabilityOutput,STPSutabilityInput
from app.api.service.ground_water_management.gwpz_operation import GWAPriorityMapper,GWPumpingMapper,MARSutabilityMapper
from app.api.service.ground_water_management.gwpz_svc import MARSutability_svc,Gwzp_service,GWLI_service
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

@router.get("/get_gwli_category",response_model=list[STPSutabilityOutput])
@validate
async def get_raster_gwli(db:db_dependency,category:str,all_data: bool = False):
    return GWLI_service.get_raster_GWLI(db,category,all_data)

@router.post("/gwli_visual_display", status_code=status.HTTP_200_OK)
@validate
async def gwli_raster_dislay(db:db_dependency,payload:category_raster):
    return GWPumpingMapper().get_visual_raster(db,payload.clip)

# @router.post("/gwli_operation", status_code=status.HTTP_200_OK)
# @validate
# async def gwli_raster_operation(db:db_dependency,payload: STPCategory):
#     pass

@router.get("/get_mar_sutability_category",status_code=status.HTTP_200_OK,response_model=list[STPSutabilityOutput])
@validate
async def get_raster_mar_sutability(db:db_dependency,category:str,all_data: bool = False):
    return MARSutability_svc.get_raster_MAR(db,category,all_data)


@router.post("/mar_sutability_visual_display",status_code=status.HTTP_200_OK,)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    return MARSutabilityMapper().get_visual_raster(db,payload.clip)

    
@router.post("/mar_sutability",status_code=status.HTTP_200_OK,)
@validate
async def stp_classify(db:db_dependency,payload:STPSutabilityInput):
    return MARSutabilityMapper().create_sutability_map(db,payload)