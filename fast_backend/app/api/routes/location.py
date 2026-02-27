from fastapi import APIRouter,status,Depends
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_location
from app.api.schema.stp_schema import Stp_response,Village_request,Stp_town_respons,STPDrainNewOutput,celery_id,RasterVisual,District_request,Sub_district_request,STPRiverOutput,STPCatchmentOutput,STPDrainOutput,STPStretchesOutput,STPStretchesInput,STPDrainInput,STPCatchmentInput,Town_request
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper
from app.utils.exception import validate
from app.api.service.ground_water_management.gwpz_svc import Raster_visual
from fastapi.responses import FileResponse
from typing import Annotated,Optional
from app.dependency.token_dependency import validate_user
from app.api.service.celery.raster_visual_celery import raster_visual
router=APIRouter()



# Admin location api
@router.get("/get_states",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_states(db:db_dependency,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    return Stp_location.get_state(db,all_data)

@router.get("/all_districts",status_code=status.HTTP_201_CREATED)
@validate
async def get_districtss(db:db_dependency):
    return Stp_location.get_district_all(db)

@router.get("/all_sub_districts",status_code=status.HTTP_201_CREATED)
@validate
async def get_sub_districtss(db:db_dependency):
    return Stp_location.get_sub_district_all(db)

@router.get("/get_all_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)
@validate
async def get_towns(db:db_dependency):
    return Stp_location.get_all_town(db)

@router.post("/get_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_districts(db:db_dependency,payload:District_request,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_district(db,payload)


@router.post("/get_sub_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_sub_districts(db:db_dependency,payload:Sub_district_request,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_sub_district(db,payload)


@router.post("/get_villages",status_code=status.HTTP_201_CREATED)
@validate
async def get_villages(db:db_dependency,payload:Village_request,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_villages(db,payload)


@router.post("/get_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)
@validate
async def get_towns(db:db_dependency,payload:Town_request,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_town(db,payload)


# Drain model api
@router.get("/get_river",response_model=list[STPRiverOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_river(db:db_dependency,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_river(db)

@router.get("/all_stretch",status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency):
    return Stp_location.get_stretch_all(db)

@router.get("/all_drain",status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency):
    return Stp_location.get_drain_all(db)

@router.post("/get_stretch",response_model=list[STPStretchesOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPStretchesInput,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_stretch(db,payload.river_code)

@router.post("/get_drain",response_model=list[STPDrainOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_drain(db,payload.stretch_ids)

@router.post("/get_suitability_drain",response_model=list[STPDrainNewOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput,user: Annotated[bool, Depends(validate_user)]):
    return Stp_location.get_drain_new(db,payload.stretch_ids)


@router.post("/get_priority_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput,user: Annotated[bool, Depends(validate_user)]):
    ans=STPPriorityMapper().cachement_villages(payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

@router.post("/get_suitability_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput,user: Annotated[bool, Depends(validate_user)]):
    ans=STPsuitabilityMapper().cachement_villages(db,payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

@router.get("/get_raster_visual",status_code=status.HTTP_201_CREATED)
@validate
async def get_visual(db:db_dependency,user: Annotated[bool, Depends(validate_user)]):
    return Raster_visual.visual_raster(db)

@router.get("/raster_download",status_code=status.HTTP_201_CREATED,response_class=FileResponse)
@validate
async def get_raster(db:db_dependency, moduleName:str,rasterName:str):
    return Raster_visual.raster_down(db,RasterVisual(moduleName=moduleName,rasterName=rasterName))

@router.get("/celery_pdf",status_code=status.HTTP_201_CREATED)
@validate
async def celery_visual(db:db_dependency, moduleName:str,rasterName:str,fileName:str):
    payload=RasterVisual(moduleName=moduleName,rasterName=rasterName,fileName=fileName)
    task_id= raster_visual.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)




