from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_location
from app.api.schema.stp_schema import Stp_response,Village_request,Stp_town_respons,STPDrainNewOutput,District_request,Sub_district_request,STPRiverOutput,STPCatchmentOutput,STPDrainOutput,STPStretchesOutput,STPStretchesInput,STPDrainInput,STPCatchmentInput,Town_request
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper
from app.utils.exception import validate
from app.api.service.ground_water_management.gwpz_svc import Raster_visual
router=APIRouter()
# return all the state polygon


@router.get("/get_states",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_states(db:db_dependency,all_data: bool = False):
    return Stp_location.get_state(db,all_data)

    

@router.post("/get_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_districts(db:db_dependency,payload:District_request):
    return Stp_location.get_district(db,payload)


@router.post("/get_sub_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)
@validate
async def get_sub_districts(db:db_dependency,payload:Sub_district_request):
    return Stp_location.get_sub_district(db,payload)

@router.post("/get_villages",status_code=status.HTTP_201_CREATED)
@validate
async def get_villages(db:db_dependency,payload:Village_request):
    return Stp_location.get_villages(db,payload)

@router.post("/get_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)
@validate
async def get_towns(db:db_dependency,payload:Town_request):
    return Stp_location.get_town(db,payload)

@router.get("/get_river",response_model=list[STPRiverOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_river(db:db_dependency):
    return Stp_location.get_river(db)

@router.post("/get_stretch",response_model=list[STPStretchesOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPStretchesInput):
    return Stp_location.get_stretch(db,payload.river_code)

@router.post("/get_drain",response_model=list[STPDrainOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    return Stp_location.get_drain(db,payload.stretch_ids)

@router.post("/get_suitability_drain",response_model=list[STPDrainNewOutput],status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    return Stp_location.get_drain_new(db,payload.stretch_ids)


@router.post("/get_priority_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    ans=STPPriorityMapper().cachement_villages(payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

@router.post("/get_suitability_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    ans=STPsuitabilityMapper().cachement_villages(db,payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

@router.get("/get_raster_visual",status_code=status.HTTP_201_CREATED)
@validate
async def get_visual(db:db_dependency):
    return Raster_visual.visual_raster(db)
