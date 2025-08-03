from fastapi import APIRouter
from app.database.config.dependency import db_dependency
from app.api.service.stp_svc.spt_service import Stp_service
from fastapi import HTTPException,status
from app.api.schema.stp_schema import  STPCategory,STPSutabilityInput,category_raster,StpReportInput,celery_id
from app.api.service.stp_svc.stp_operation import STPPriorityMapper,STPSutabilityMapper,GWAPriorityMapper
from app.api.service.celery.stp_Priority_document import document_gen
from app.conf.ws_config import ConnectionManager
from fastapi import  WebSocket, WebSocketDisconnect,WebSocketException
from celery.result import AsyncResult
import json
import asyncio
from app.conf.celery import app 
connection_manager=ConnectionManager()
router=APIRouter()
@router.post("/stp_visual_display")
def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    try:
        return STPPriorityMapper().category_priority_map(db,payload.clip,payload.place)
    except Exception as e:
        print("exception",e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/stp_priority")
def stp_raster(db:db_dependency,payload: STPCategory):
    try:
        if len(payload.data)==0:
            raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No data found"
        )
        raster_path,raster_weights=Stp_service.get_raster(db,payload)
        return STPPriorityMapper().create_priority_map(raster_path,raster_weights,payload.clip,payload.place)
    except Exception as e:
        print("exception is ",e)
    


@router.post("/stp_sutability_visual_display")
def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    try:
        return STPPriorityMapper().category_priority_map_villages(db,payload.clip,payload.place)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


    
@router.post("/stp_sutability")
def stp_classify(db:db_dependency,payload:STPSutabilityInput):
    try:
        return STPSutabilityMapper().create_sutability_map(db,payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/stp_priority_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
def stp_priority_report(payload:StpReportInput):
    try:  
        task_id= document_gen.delay(payload=payload.model_dump())
        return celery_id(task_id=task_id.id)
    except Exception as e:
        print("exception",e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.websocket("/ws/{task_id}")
async def report_download(websocket: WebSocket, task_id: str):
    await connection_manager.connect(websocket)
    await connection_manager.send_personal_message("connection established", websocket)

    try:
        while True:
            parent_result = AsyncResult(task_id, app=app)

            if not parent_result.ready():
                await asyncio.sleep(2)
                continue

            try:
                result_data = parent_result.get(timeout=5)
                chord_id = result_data['chord_id']
            except Exception as e:
                await connection_manager.send_personal_message(json.dumps({
                    "status": "ERROR",
                    "message": f"Failed to get chord_id: {str(e)}"
                }), websocket)
                break

            chord_result = AsyncResult(chord_id, app=app)

            # Wait for chord result to be ready
            while not chord_result.ready():
                await asyncio.sleep(2)

            if chord_result.successful():
                await connection_manager.send_personal_message(json.dumps({
                    "status": "SUCCESS",
                    "result": chord_result.get()
                }), websocket)
            elif chord_result.failed():
                await connection_manager.send_personal_message(json.dumps({
                    "status": "FAILURE",
                    "error": str(chord_result.result)
                }), websocket)

            break  # Exit outer loop after final result

    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)

    except Exception as e:
        await connection_manager.send_personal_message(json.dumps({
            "status": "ERROR",
            "message": str(e)
        }), websocket)
        connection_manager.disconnect(websocket)
