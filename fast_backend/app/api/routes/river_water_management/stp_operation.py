from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import  STP_suitability_Area,Stp_Area,STPCategory,StpsuitabilityAdminReport,StpsuitabilityDrainReport,STPsuitabilityOutput,STPPriorityOutput,STPsuitabilityInput,category_raster,StpPriorityDrainReport,StpPriorityAdminReport,celery_id
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper,STP_Area
from app.api.service.celery.stp_priority_admin_document import document_gen
from app.api.service.celery.stp_priority_drain_document import document_gen1
from app.api.service.celery.stp_suitability_admin_report import document_gen2
from app.api.service.celery.stp_suitability_drain_report import document_gen3
from app.conf.ws_config import ConnectionManager
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.conf.celery import app 
from app.utils.exception import validate
from pathlib import Path

connection_manager=ConnectionManager()
router=APIRouter()

@router.get("/get_priority_category",status_code=status.HTTP_201_CREATED,response_model=list[STPPriorityOutput])
@validate
async def get_priority_category(db:db_dependency,all_data: bool = False):
    return Stp_service.get_priority_category(db,all_data)

@router.post("/stp_priority_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority_visual_display(db:db_dependency,payload:category_raster):
    return STPPriorityMapper().visual_priority_map(db,payload.clip,payload.place)

@router.post("/stp_priority",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority(db:db_dependency,payload: STPCategory):
    raster_path,raster_weights=Stp_service.get_raster(db,payload)
    return STPPriorityMapper().create_priority_map(raster_path,raster_weights,payload.clip,payload.place)
   
@router.post("/stp_priority_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_admin_report(payload:StpPriorityAdminReport):
    task_id= document_gen.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_priority_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_drain_report(payload:StpPriorityDrainReport):
    task_id= document_gen1.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)
 
 
 
 
 
# stp suitability
@router.get("/get_suitability_by_category",status_code=status.HTTP_201_CREATED,response_model=list[STPsuitabilityOutput])
@validate
async def get_raster_suitability(db:db_dependency,category:str,all_data: bool = False):
    return Stp_service.get_raster_suitability(db,category,all_data)


@router.post("/stp_suitability_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    return STPsuitabilityMapper().visual_sutabilty_map(db,payload.clip,payload.place)

    
@router.post("/stp_suitability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPsuitabilityInput):
    return STPsuitabilityMapper().create_suitability_map(db,payload)


@router.post("/stp_suitability_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_admin_report(payload:StpsuitabilityAdminReport):
    task_id= document_gen2.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_suitability_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_drain_report(payload:StpsuitabilityDrainReport):
    task_id= document_gen3.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)


@router.get("/get_stp_suitability_area",response_model=list[Stp_Area],status_code=status.HTTP_201_CREATED)
@validate
async def stp_suitability_area(db:db_dependency):
    return  Stp_service.get_suitability_area(db)


@router.post("/stp_suitability_area",status_code=status.HTTP_201_CREATED)
@validate
async def stp_suitability_area(db:db_dependency,payload:STP_suitability_Area):
    return STP_Area().stp_area_finding(db,payload)

@router.get("/get_report",status_code=status.HTTP_200_OK,response_class=FileResponse)
@validate
async def get_report(chord_id:str):
    file_path = AsyncResult(chord_id).get()      
    file_path = Path(file_path)
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type="application/pdf"  
    )

@router.websocket("/ws/{task_id}")
async def report_download(websocket: WebSocket, task_id: str):
    await connection_manager.connect(websocket)
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
                await websocket.send_json(progress_data)
                break
            
            elif result.state == 'SUCCESS':
                progress_data = {
                    'state': 'SUCCESS',
                    'progress': 100,
                    'total': 100,
                    'description': 'Complete',
                    'result': result.result['chord_id']
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

                    progress_data = {
                        'state': result.state,
                        'progress': 50,
                        'total': 100,
                        'description': f'State: {result.state}'
                    }
            
            await websocket.send_json(progress_data)
            await asyncio.sleep(0.5)
    
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    
    except Exception as e:
        try:
            await websocket.send_json({
                'state': 'ERROR',
                'progress': 0,
                'total': 100,
                'description': f'Error: {str(e)}'
            })
        except:
            pass
        connection_manager.disconnect(websocket)