from fastapi import APIRouter,status
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import  STP_sutability_Area,Stp_Area,STPCategory,STPSutabilityOutput,STPPriorityOutput,STPSutabilityInput,category_raster,StpPriorityDrainReport,StpPriorityAdminReport,celery_id
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPSutabilityMapper,STP_Area
from app.api.service.celery.stp_priority_admin_document import document_gen
from app.api.service.celery.stp_priority_drain_document import document_gen1
from app.conf.ws_config import ConnectionManager
from fastapi import  WebSocket, WebSocketDisconnect,WebSocketException
from celery.result import AsyncResult
import asyncio
from app.conf.celery import app 
from app.utils.exception import validate

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
    
@router.get("/get_sutability_by_category",status_code=status.HTTP_201_CREATED,response_model=list[STPSutabilityOutput])
@validate
async def get_raster_sutability(db:db_dependency,category:str,all_data: bool = False):
    return Stp_service.get_raster_sutability(db,category,all_data)


@router.post("/stp_sutability_visual_display",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    return STPSutabilityMapper().visual_sutabilty_map(db,payload.clip,payload.place)

    
@router.post("/stp_sutability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPSutabilityInput):
    return STPSutabilityMapper().create_sutability_map(db,payload)


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


@router.get("/get_stp_sutability_area",response_model=list[Stp_Area])
@validate
async def stp_sutability_area(db:db_dependency):
    return  Stp_service.get_sutability_area(db)


@router.post("/stp_sutability_area")
@validate
async def stp_sutability_area(db:db_dependency,payload:STP_sutability_Area):
    return STP_Area().stp_area_finding(db,payload)

@router.websocket("/ws/{task_id}")
async def report_download(websocket: WebSocket, task_id: str):
    await connection_manager.connect(websocket)
    try:
        # Wait for task result
        while True:
            parent_result = AsyncResult(task_id, app=app)
            if not parent_result.ready():
                await asyncio.sleep(2)
                continue
            try:
                result_data = parent_result.get(timeout=5)
                chord_id = result_data['chord_id']
            except Exception as e:
                print("xxx",str(e))
                await websocket.send_json({
                    "status": "ERROR",
                    "message": f"Failed to get chord_id: {str(e)}"
                })
                break

            chord_result = AsyncResult(chord_id, app=app)
            while not chord_result.ready():
                await asyncio.sleep(2)

            if chord_result.successful():
                file_path = chord_result.get()
                await websocket.send_json({
                    "status": "SUCCESS",
                    "message": "Report is ready. Send 'SEND_FILE' to receive it."
                })

                # Wait for client to say "SEND_FILE"
                data = await websocket.receive_text()
                if data == "SEND_FILE":
                    try:
                        with open(file_path, "rb") as f:
                            await websocket.send_bytes(f.read())
                    except FileNotFoundError:
                        await websocket.send_json({
                            "status": "ERROR",
                            "message": "File not found"
                        })
                connection_manager.disconnect(websocket)
            else:
                await websocket.send_json({
                    "status": "FAILURE",
                    "error": str(chord_result.result)
                })

            break

    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)

    except Exception as e:
        await websocket.send_json({
            "status": "ERROR",
            "message": str(e)
        })
        connection_manager.disconnect(websocket)
