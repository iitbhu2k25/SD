from fastapi import APIRouter,status,Depends,UploadFile,File,Form
from typing import Annotated, Optional
from app.dependency.token_dependency import validate_user
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import  STP_suitability_Area, STPPriorityVisualOutput, STPSuitabilityVisualOutput, STPCategory, STPCatchmentInput, STPCatchmentOutput, StpsuitabilityAdminReport, StpsuitabilityDrainReport, STPsuitabilityOutput, STPPriorityOutput, STPsuitabilityInput, category_raster, StpPriorityDrainReport, StpPriorityAdminReport, celery_id, stp_area_resp
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper
from app.api.service.celery.stp_area.stp_area import find_suitable_area
from app.api.service.celery.pdf_generations.stp_priority_admin_document import document_gen
from app.api.service.celery.pdf_generations.stp_priority_drain_document import document_gen1
from app.api.service.celery.pdf_generations.stp_suitability_admin_report import document_gen2
from app.api.service.celery.pdf_generations.stp_suitability_drain_report import document_gen3
from app.conf.ws_config import ConnectionManager,safe_send
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.utils.exception import validate
from pathlib import Path
from app.conf.logging import logger
from app.api.service.raster_work.raster_operation import RasterOperation


connection_manager=ConnectionManager()
router=APIRouter()


@router.get("/get_priority_category",status_code=status.HTTP_201_CREATED,response_model=list[STPPriorityOutput])
@validate
async def get_priority_category(db:db_dependency,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    """ It return the priority raster information"""
    return Stp_service.get_priority_category(db,all_data)

@router.post("/stp_priority_visual_display",status_code=status.HTTP_201_CREATED,response_model=STPPriorityVisualOutput)
@validate
async def stp_priority_visual_display(db:db_dependency,payload:category_raster):
    """ It make the stp priority visual raster for displaying"""
    return await STPPriorityMapper().visual_priority_map(db,payload.clip,payload.place,payload.layer_name)

@router.post("/stp_priority",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority(db:db_dependency,payload: STPCategory):
    """ It calculater the stp priority """
    return  await STPPriorityMapper().create_priority_map(db,payload)

@router.post("/get_priority_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_priority_cachement(db:db_dependency,payload:STPCatchmentInput):
    """It make the stp priority cachement """
    return await STPPriorityMapper().cachement_villages(payload.drain_nos)


@router.post("/stp_priority_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_admin_report(payload:StpPriorityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp priority admin report """
    task_id= document_gen.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_priority_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_drain_report(payload:StpPriorityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp priority drain report """
    task_id= document_gen1.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id) 
 
# stp suitability
@router.get("/get_suitability_by_category",status_code=status.HTTP_201_CREATED,response_model=list[STPsuitabilityOutput])
@validate
async def get_raster_suitability(db:db_dependency,category:str,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    """ It return the suitability raster information"""
    return Stp_service.get_raster_suitability(db,category,all_data)


@router.post("/stp_suitability_visual_display",status_code=status.HTTP_201_CREATED,response_model=STPSuitabilityVisualOutput)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    """ It make the stp suitability visual raster for displaying"""
    return await STPsuitabilityMapper().visual_sutabilty_map(db,payload.clip,payload.place,payload.layer_name)

@router.post("/get_suitability_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_suitability_cachement(db:db_dependency,payload:STPCatchmentInput):
    """It make the stp suitability cachement """
    return await STPsuitabilityMapper().cachement_villages(db,payload.drain_nos)

    
@router.post("/stp_suitability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPsuitabilityInput,):
    """ It calculater the stp suitability """
    return await STPsuitabilityMapper().create_suitability_map(db,payload)


@router.post("/stp_suitability_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_admin_report(payload:StpsuitabilityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp suitability admin report """
    task_id= document_gen2.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_suitability_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_drain_report(payload:StpsuitabilityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp suitability drain report """
    task_id= document_gen3.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)


    

@router.post("/stp_suitability_area",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_area(db:db_dependency,payload:STP_suitability_Area):
    drain_points_raw = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude} for d in (payload.drain_points or [])]
    task_id=find_suitable_area.delay(
        treatment_technology=payload.treatment_technology,
        mld_capacity=payload.mld_capacity,
        custom_land_per_mld=payload.custom_land_per_mld,
        layer_name=payload.layer_name,
        location=payload.location,
        drain_points=drain_points_raw,
        num_clusters=payload.num_clusters,
    )
    return celery_id(task_id=task_id.id)

@router.get("/stp_area/{task_id}",status_code=status.HTTP_200_OK,response_model=stp_area_resp)
@validate
async def stp_area(db:db_dependency,task_id:str):
    import json as _json
    resp=await RasterOperation().get_result(db,task_id)
    cluster_distances = None
    if resp.file_path:
        try:
            cluster_distances = _json.loads(resp.file_path)
        except Exception:
            cluster_distances = None
    return stp_area_resp(cluster_layer=resp.layer_name, suitable_path=None, cluster_distances=cluster_distances, task_status=resp.task_status)

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