from fastapi import APIRouter
from app.database.config.dependency import db_dependency
from app.api.service.stp_svc.spt_service import Stp_service
from fastapi import HTTPException,status
from app.api.schema.stp_schema import STPSutabilityOutput,STPPriorityOutput
router=APIRouter()

@router.get("/get_sutability_by_category",response_model=list[STPSutabilityOutput])
async def get_raster_sutability(db:db_dependency,category:str,all_data: bool = False):
    try:
        return Stp_service.get_raster_sutability(db,category,all_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
@router.get("/get_priority_category",response_model=list[STPPriorityOutput])
async def get_raster_sutability(db:db_dependency,all_data: bool = False):
    try:
       return Stp_service.get_raster_priority(db,all_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )