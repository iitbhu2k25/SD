from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.ground_water_management.gwpz_operation import GWAPriorityMapper,GWPumpingMapper,MARSuitabilityMapper
from app.api.service.ground_water_management.gwpz_svc import MARSuitability_svc,Gwzp_service,GWPL_service
from app.utils.exception import validate
from app.api.service.celery.gwz_admin_document import document_gen4
from app.api.service.celery.gwz_drain_document import document_gen5
from app.api.schema.stp_schema import  STPCategory,STPsuitabilityOutput,STPPriorityOutput,StpPriorityDrainReport,STPsuitabilityInput,category_raster,StpPriorityAdminReport,celery_id,GWPL_Table_input
router=APIRouter()
@router.get("/get_gwz_category",response_model=list[STPPriorityOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_raster_gwz(db:db_dependency,all_data: bool = False):
    return Gwzp_service.get_raster_GWZ(db,all_data)

@router.post("/gwz_visual_display", status_code=status.HTTP_201_CREATED)
@validate
async def gwz_raster_dislay(db:db_dependency,payload:category_raster):
    return GWAPriorityMapper().get_visual_raster(db,payload.clip,payload.place)

@router.post("/gwz_operation", status_code=status.HTTP_201_CREATED)
@validate
async def gwz_raster_operation(db:db_dependency,payload: STPCategory):
    raster_path,raster_weights=Gwzp_service.get_raster(db,payload)
    return GWAPriorityMapper().create_gwpz_map(raster_path,raster_weights,payload.clip,payload.place)

@router.post("/gwz_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def gwz_admin_report(payload:StpPriorityAdminReport):
    task_id= document_gen4.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/gwz_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def gwz_drain_report(payload:StpPriorityDrainReport):
    task_id= document_gen5.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)
 
 

# groud water pumping locations
@router.get("/get_gwli_category",response_model=list[STPsuitabilityOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_raster_gwli(db:db_dependency,category:str,all_data: bool = False):
    return GWPL_service.get_raster_GWPL(db,category,all_data)

@router.post("/gwli_visual_display", status_code=status.HTTP_201_CREATED)
@validate
async def gwli_raster_dislay(db:db_dependency,payload:category_raster):
    return GWPumpingMapper().get_visual_raster(db,payload.clip)

@router.post("/gwli_operation", status_code=status.HTTP_201_CREATED)
@validate
async def gwli_raster_operation(db:db_dependency,payload: STPsuitabilityInput):
    return GWPumpingMapper().create_gwpz_map(db,payload)

@router.post("/gwli_find_score", status_code=status.HTTP_201_CREATED)
@validate
async def gwli_find_score(db:db_dependency,payload:GWPL_Table_input):
    return GWPumpingMapper().gwpl_table(db,payload.raster_name,payload.location)


# MAR suitability 
@router.get("/get_mar_suitability_category",status_code=status.HTTP_201_CREATED,response_model=list[STPsuitabilityOutput])
@validate
async def get_raster_mar_suitability(db:db_dependency,category:str,all_data: bool = False):
    return MARSuitability_svc.get_raster_MAR(db,category,all_data)


@router.post("/mar_suitability_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def gwz_raster_dislay(db:db_dependency,payload:category_raster):
    return MARsuitabilityMapper().get_visual_raster(db,payload.clip)

    
@router.post("/mar_suitability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPsuitabilityInput):
    return MARsuitabilityMapper().create_suitability_map(db,payload)