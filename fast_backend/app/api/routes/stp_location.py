from fastapi import APIRouter
from app.database.config.dependency import db_dependency
from app.api.service.stp_svc.spt_service import Stp_service
from fastapi import HTTPException,status
from app.api.schema.stp_schema import Stp_response,Stp_town_respons,STPDrainNewOutput,District_request,Sub_district_request,STPRiverOutput,STPCatchmentOutput,STPDrainOutput,STPStretchesOutput,STPStretchesInput,STPDrainInput,STPCatchmentInput,Town_request
from app.api.service.stp_svc.stp_operation import STPPriorityMapper,STPSutabilityMapper

router=APIRouter()
# return all the state polygon


@router.get("/get_states",response_model=list[Stp_response])
async def get_states(db:db_dependency,all_data: bool = False):
    try:
        return Stp_service.get_state(db,all_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    

@router.post("/get_districts",response_model=list[Stp_response])
async def get_districts(db:db_dependency,payload:District_request):
    try:
        return Stp_service.get_district(db,payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get_sub_districts",response_model=list[Stp_response])
async def get_sub_districts(db:db_dependency,payload:Sub_district_request):
    try:
        return Stp_service.get_sub_district(db,payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get_towns",response_model=list[Stp_town_respons])
async def get_towns(db:db_dependency,payload:Town_request):
    print("town request",payload)
    try:
        return Stp_service.get_town(db,payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/get_river",response_model=list[STPRiverOutput])
async def get_river(db:db_dependency):
    try:
        return Stp_service.get_river(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/get_stretch",response_model=list[STPStretchesOutput])
async def get_stretch(db:db_dependency,payload:STPStretchesInput):
    try:
        return Stp_service.get_stretch(db,payload.river_code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/get_drain",response_model=list[STPDrainOutput])
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    try:
        return Stp_service.get_drain(db,payload.stretch_ids)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/get_sutability_drain",response_model=list[STPDrainNewOutput])
async def get_stretch(db:db_dependency,payload:STPDrainInput):
    try:
        return Stp_service.get_drain_new(db,payload.stretch_ids)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get_cachement",response_model=STPCatchmentOutput)
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    try:
        ans=STPPriorityMapper().cachement_villages(payload.drain_nos)
        return STPCatchmentOutput(data=ans[0],layer_name=ans[1])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/get_new_cachement",response_model=STPCatchmentOutput)
async def get_stretch(db:db_dependency,payload:STPCatchmentInput):
    try:
        ans=STPSutabilityMapper().cachement_villages(db,payload.drain_nos)
        return STPCatchmentOutput(data=ans[0],layer_name=ans[1])
    except Exception as e:
        print("error",e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

