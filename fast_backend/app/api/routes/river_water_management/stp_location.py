from fastapi import APIRouter
from app.database.config.dependency import db_dependency
from app.api.service.stp_svc.spt_service import Stp_service
from fastapi import HTTPException,status
from app.api.schema.stp_schema import Stp_response,Stp_town_respons,STPDrainNewOutput,District_request,Sub_district_request,STPRiverOutput,STPCatchmentOutput,STPDrainOutput,STPStretchesOutput,STPStretchesInput,STPDrainInput,STPCatchmentInput,Town_request
from app.api.service.stp_svc.stp_operation import STPPriorityMapper,STPSutabilityMapper
from app.utils.exception import validate
router=APIRouter()
# return all the state polygon


@router.get("/get_states",response_model=list[Stp_response])
@validate
async def get_states(db:db_dependency,all_data: bool = False):
    return Stp_service.get_state(db,all_data)

    

@router.post("/get_districts",response_model=list[Stp_response])
@validate
async def get_districts(db:db_dependency,payload:District_request):
    return Stp_service.get_district(db,payload)


@router.post("/get_sub_districts",response_model=list[Stp_response])
@validate
async def get_sub_districts(db:db_dependency,payload:Sub_district_request):
    return Stp_service.get_sub_district(db,payload)


@router.post("/get_towns",response_model=list[Stp_town_respons])
@validate
async def get_towns(db:db_dependency,payload:Town_request):
    return Stp_service.get_town(db,payload)

@router.get("/get_river",response_model=list[STPRiverOutput])
@validate
async def get_river(db:db_dependency):
    return Stp_service.get_river(db)

@router.post("/get_stretch",response_model=list[STPStretchesOutput])
@validate
async def get_stretch(db:db_dependency,payload:STPStretchesInput):
    return Stp_service.get_stretch(db,payload.river_code)

@router.post("/get_drain",response_model=list[STPDrainOutput])
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    return Stp_service.get_drain(db,payload.stretch_ids)

@router.post("/get_sutability_drain",response_model=list[STPDrainNewOutput])
@validate
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    return Stp_service.get_drain_new(db,payload.stretch_ids)


@router.post("/get_cachement",response_model=STPCatchmentOutput)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    ans=STPPriorityMapper().cachement_villages(payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

@router.post("/get_new_cachement",response_model=STPCatchmentOutput)
@validate
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    ans=STPSutabilityMapper().cachement_villages(db,payload.drain_nos)
    return STPCatchmentOutput(data=ans[0],layer_name=ans[1])

