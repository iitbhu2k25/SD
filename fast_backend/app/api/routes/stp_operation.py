from fastapi import APIRouter,status,Depends
from typing import Annotated
from app.dependency.token_dependency import validate_user
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import  STP_suitability_Area,Stp_Area,STPCategory,STPCatchmentInput,STPCatchmentOutput,StpsuitabilityAdminReport,StpsuitabilityDrainReport,STPsuitabilityOutput,STPPriorityOutput,STPsuitabilityInput,category_raster,StpPriorityDrainReport,StpPriorityAdminReport,celery_id
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper,STP_Area
from app.api.service.celery.pdf_generations.stp_priority_admin_document import document_gen
from app.api.service.celery.pdf_generations.stp_priority_drain_document import document_gen1
from app.api.service.celery.pdf_generations.stp_suitability_admin_report import document_gen2
from app.api.service.celery.pdf_generations.stp_suitability_drain_report import document_gen3
from app.conf.ws_config import ConnectionManager,safe_send
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.conf.celery import app 
from app.utils.exception import validate
from pathlib import Path
from app.conf.logging import logger


connection_manager=ConnectionManager()
router=APIRouter()

# stp priority
@router.get("/get_priority_category",status_code=status.HTTP_201_CREATED,response_model=list[STPPriorityOutput])
@validate
async def get_priority_category(db:db_dependency,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    return Stp_service.get_priority_category(db,all_data)

@router.post("/stp_priority_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority_visual_display(db:db_dependency,payload:category_raster,user: Annotated[bool, Depends(validate_user)]):
    return await STPPriorityMapper().visual_priority_map(db,payload.clip,payload.place)

@router.post("/stp_priority",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority(db:db_dependency,payload: STPCategory,user: Annotated[bool, Depends(validate_user)]):
    raster_path,raster_weights=Stp_service.get_raster(db,payload)
    return  await STPPriorityMapper().create_priority_map(raster_path,raster_weights,payload.clip,payload.place)

@router.post("/get_priority_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_priority_cachement(db:db_dependency,payload:STPCatchmentInput,user: Annotated[bool, Depends(validate_user)]):
    ans=STPPriorityMapper().cachement_villages(payload.drain_nos)
    return STPCatchmentOutput(catchments=ans[0],layer_name=ans[1])

@router.post("/stp_priority_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_admin_report(payload:StpPriorityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    task_id= document_gen.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_priority_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_drain_report(payload:StpPriorityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    task_id= document_gen1.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id) 
 
# stp suitability
@router.get("/get_suitability_by_category",status_code=status.HTTP_201_CREATED,response_model=list[STPsuitabilityOutput])
@validate
async def get_raster_suitability(db:db_dependency,category:str,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    return Stp_service.get_raster_suitability(db,category,all_data)


@router.post("/stp_suitability_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster,user: Annotated[bool, Depends(validate_user)]):
    return await STPsuitabilityMapper().visual_sutabilty_map(db,payload.clip,payload.place)

    
@router.post("/stp_suitability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPsuitabilityInput,user: Annotated[bool, Depends(validate_user)]):
    return await STPsuitabilityMapper().create_suitability_map(db,payload)


@router.post("/stp_suitability_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_admin_report(payload:StpsuitabilityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    task_id= document_gen2.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_suitability_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_drain_report(payload:StpsuitabilityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    task_id= document_gen3.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/get_suitability_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_suitability_cachement(db:db_dependency,payload:STPCatchmentInput,user: Annotated[bool, Depends(validate_user)]):
    ans=STPsuitabilityMapper().cachement_villages(db,payload.drain_nos)
    return STPCatchmentOutput(catchments=ans[0],layer_name=ans[1])

# stp area
@router.get("/get_stp_suitability_area",response_model=list[Stp_Area],status_code=status.HTTP_201_CREATED)
@validate
async def stp_suitability_area(db:db_dependency,user: Annotated[bool, Depends(validate_user)]):
    return  Stp_service.get_suitability_area(db)


@router.post("/stp_suitability_area")
@validate
async def stp_suitability_area(db:db_dependency,payload:STP_suitability_Area,user: Annotated[bool, Depends(validate_user)]):
    return await STP_Area().stp_area_finding(db,payload)
        
   

@router.get("/get_report",status_code=status.HTTP_200_OK,response_class=FileResponse)
@validate
async def get_report(chord_id:str,user: Annotated[bool, Depends(validate_user)]):
    file_path = AsyncResult(chord_id).get()      
    file_path = Path(file_path)
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")


@router.websocket("/ws/{task_id}")
async def report_download(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await connection_manager.connect(websocket, task_id)
    try:
        while True:
            result = AsyncResult(task_id)
            if result.state == 'PENDING':
                progress_data = {
                    'state': 'PENDING',
                    'progress': 0,
                    'total': 100,
                    'description': 'Task pending...'
                }
            
            elif result.state == 'FAILURE':
                error_msg = str(result.info) if result.info else 'Unknown error'
                progress_data = {
                    'state': 'FAILURE',
                    'progress': 100,
                    'total': 100,
                    'description': f'Failed: {error_msg}'
                }
                await safe_send(websocket, progress_data)
 
                break
            
            elif result.state == 'SUCCESS':
                result_id = task_id
                if isinstance(result.result, dict):
                    result_id = result.result.get('chord_id', task_id)
                progress_data = {
                    'state': 'SUCCESS',
                    'progress': 100,
                    'total': 100,
                    'description': 'Complete',
                    'result': result_id
                }
                await websocket.send_json(progress_data)
                break
            
            else:
                if result.info and isinstance(result.info, dict):
                    progress_data = {
                        'state': result.state,
                        'progress': result.info.get('current', 0),
                        'total': result.info.get('total', 100),
                        'description': result.info.get('description', 'Processing...')
                    }
                else:
                    logger.info(f"Unknown result info: {result.info}")
                    progress_data = {
                        'state': result.state,
                        'progress': 50,
                        'total': 100,
                        'description': f'State: {result.state}'
                    }
            
            await safe_send(websocket,progress_data)
            await asyncio.sleep(0.5)
    
    except WebSocketDisconnect:
        pass
    
    except Exception as e:
        await safe_send(websocket, {"state": "ERROR", "description": str(e)})
    finally:
        await connection_manager.disconnect(websocket, task_id)