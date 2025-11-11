from fastapi import APIRouter,status
from typing import List
from app.database.config.dependency import db_dependency
from app.api.schema.wqi import Well_input,Well_response
from app.api.service.wqi.water_quality import WQ_Index
router=APIRouter()

@router.post('/wells',status_code=status.HTTP_201_CREATED,response_model=List[Well_response])
async def get_well(db:db_dependency,payload:Well_input):
    return WQ_Index().get_well(db,payload)

@router.post('/well_interpolation',status_code=status.HTTP_201_CREATED)
async def make_interpolation(payload:List[Well_response]):
    return WQ_Index().calculate_GWQI(payload)
    
