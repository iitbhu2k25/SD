import json

from fastapi import APIRouter,status,Depends
from app.dependency.token_dependency import validate_user
from typing import List
from app.database.config.dependency import db_dependency
from app.api.schema.wqi import AllChartsResponse, Well_input,Well_response,WQIOperation, celery_id
from app.api.service.celery.wqi.water_quality import HydroChartService, WQ_Index
from app.conf.redis.redis_async_manager import async_redis_manager
from typing import Annotated
from app.utils.exception import validate
router=APIRouter()


@router.get('/year',status_code=status.HTTP_201_CREATED)
@validate
async def make_interpolation(user: Annotated[bool, Depends(validate_user)]):
    return [2018,2019,2020,2021,2022,2023,2024]

@router.post('/wells',status_code=status.HTTP_201_CREATED,response_model=List[Well_response])
@validate
async def get_well(db:db_dependency,payload:Well_input,user: Annotated[bool, Depends(validate_user)]):
    return WQ_Index().get_well(db,payload)

@router.post('/well_interpolation',status_code=status.HTTP_201_CREATED)
@validate
async def make_interpolation(db:db_dependency,payload:WQIOperation,user: Annotated[bool, Depends(validate_user)]):
    return WQ_Index().calculate_GWQI(db,payload)

@router.post('/well_interpolation_result',status_code=status.HTTP_201_CREATED)
@validate
async def make_interpolation(db:db_dependency,payload:celery_id,user: Annotated[bool, Depends(validate_user)]):
    return await async_redis_manager.hgetall(f"opr_result:{payload.task_id}")

@router.post('/well_interpolation_analysis',status_code=status.HTTP_201_CREATED,response_model=AllChartsResponse)
@validate
async def chart_analysis(db:db_dependency,payload:WQIOperation,user: Annotated[bool, Depends(validate_user)]):
    return HydroChartService().calculate_all_charts(db,payload)