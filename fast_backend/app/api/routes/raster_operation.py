import json

from fastapi import APIRouter,status,UploadFile,File,Header
from fastapi.responses import FileResponse
from app.conf.logging import logger
from pathlib import Path
from app.conf.celery import app 
from app.conf.ws_config import connection_manager
from fastapi import  WebSocket, WebSocketDisconnect
from celery.result import AsyncResult
from app.database.config.dependency import db_dependency
from app.utils.exception import validate
from app.api.schema.raster_operation import (
    RasterInfoResponse,
    RasterReproject,
    RasterReclassify,
    Edliudian,
    SLDUpdate,
    FlowDirectionParams,
    FlowAccumulationParams,
    SlopeParams,
    TpiParams,
    TwiParams,
    Chunkcomplete,
    CellResize,
    RasterOperOutput,
    RasterUploadResponse)
from app.api.service.raster_work.raster_operation import RasterOperation
router=APIRouter()

from app.conf.redis.redis_manager import redis_manager

@router.post("/post_raster",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency,file: UploadFile = File(...)):
    """ return the raster temp id"""
    return await RasterOperation().save_upload(db,file)


@router.post("/upload_raster_chunk",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(file: UploadFile = File(...),
    upload_id: str = Header(...),
    chunk_index: int = Header(...),
):
    return await RasterOperation().chunk_upload(file,upload_id,chunk_index)   


@router.post("/upload/complete",status_code=status.HTTP_201_CREATED)
async def complete_upload(db:db_dependency,payload:Chunkcomplete):
    """   Merge all chunks into final file.  """
    return await RasterOperation().merge_chunks(db,payload.upload_id,payload.filename,payload.total_chunks)


@router.post("/sldupdate",status_code=status.HTTP_201_CREATED)
async def sldupdate(payload:SLDUpdate):
    """ Merge all chunks into final file. """
    return await RasterOperation().updatesld(payload)


@router.get("/raster/{file_id}/details",status_code=status.HTTP_201_CREATED,response_model=RasterInfoResponse)
@validate
async def get_raster(db:db_dependency,file_id: str):
    """ return the raster details"""
    return await RasterOperation().get_info(db,file_id)


@router.get("/raster/{task_id}/output",status_code=status.HTTP_201_CREATED,response_model=RasterOperOutput)
@validate
async def get_raster(db:db_dependency,task_id: str):
    """ return the output layer details"""
    return await RasterOperation().get_result(db,task_id)


@router.get("/get_avaliable_epsg",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reproject(db:db_dependency):
    return await RasterOperation().available_epsg()


@router.post("/reprojection",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reproject(db:db_dependency,payload:RasterReproject):
    """ return the reprojected raster """
    resp = await RasterOperation().reprojection(db,payload)
    return resp.id


@router.post("/slope",status_code=status.HTTP_201_CREATED)
@validate
async def slope(db:db_dependency,payload:SlopeParams):
    """return the slope raster"""
    resp = await RasterOperation().slope(db,payload)
    return resp.id


@router.post("/tpi",status_code=status.HTTP_201_CREATED)
@validate
async def tpi(db:db_dependency,payload:TpiParams):
    """return the tpi raster"""
    resp = await RasterOperation().tpi(db,payload)
    return resp.id


@router.post("/twi",status_code=status.HTTP_201_CREATED)
@validate
async def twi(db:db_dependency,payload:TwiParams):
    """ return the twi raster"""
    resp = await RasterOperation().twi(db,payload)
    return resp.id

@router.post("/flow_direction",status_code=status.HTTP_201_CREATED)
@validate
async def flow_direction(db:db_dependency,payload:FlowDirectionParams):
    """return the flow direction raster"""
    resp = await RasterOperation().flow_direction(db,payload)
    return resp.id

@router.post("/flow_accumulation",status_code=status.HTTP_201_CREATED)
@validate
async def flow_acumulation(db:db_dependency,payload:FlowAccumulationParams):
    """return the flow accumulation raster"""
    resp = await RasterOperation().flow_accumulation(db,payload)
    return resp.id


# @router.post("/reclassify",status_code=status.HTTP_201_CREATED)
# @validate
# async def raster_reclassify(db:db_dependency,payload:RasterReclassify):
#     """ return the  reclassified raster """
#     return RasterOperation().reclassify(db,payload)


# @router.post("/ecludian",status_code=status.HTTP_201_CREATED)
# @validate
# async def raster_ecludian(db:db_dependency,payload:Edliudian):
#     """return the edliudian raster"""
#     return RasterOperation().edludian(db,payload)

# @router.post("/interpolations",status_code=status.HTTP_201_CREATED)
# @validate
# async def raster_ecludian(db:db_dependency,payload:Edliudian):
#     """return the edliudian raster"""
#     return RasterOperation().edludian(db,payload)


@router.post("/raster_resolution",status_code=status.HTTP_201_CREATED)
@validate
async def raster_resolution(db:db_dependency,payload:CellResize):
    """ return the raster resolution dry run"""
    return await  RasterOperation().test_resolution(db,payload)


@router.post("/raster_resolution_execute",status_code=status.HTTP_201_CREATED)
@validate
async def raster_resolution(db:db_dependency,payload:CellResize):
    """ return the raster resolution """
    resp= await  RasterOperation().execute_resolution(db,payload)
    return resp.id


@router.get("/raster/download/{fileId}",status_code=status.HTTP_200_OK,response_class=FileResponse)
@validate
async def get_report(db:db_dependency,fileId:str):
    return await RasterOperation().raster_download(db,fileId)



@router.websocket("/ws/operation/{task_id}")
async def task_websocket(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await connection_manager.connect(websocket, task_id)   
    last = await redis_manager.get(f"opr_status:{task_id}")
    if last:
        last_data = json.loads(last)
        await websocket.send_json(last_data)

        if last_data.get("status") in ("completed", "failed"):
            await websocket.close()
            await connection_manager.disconnect(websocket, task_id)
            return
    pubsub = redis_manager.pubsub()
    await pubsub.subscribe(f"opr_updates:{task_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])

                try:
                    await websocket.send_json(data)
                except WebSocketDisconnect:
                    logger.info(f"[WebSocket] Client disconnected: task_id={task_id}")
                    break
                
                if data.get("status") in ("completed", "failed"):
                    await websocket.close(code=1000)
                    break

    except WebSocketDisconnect:
        logger.info(f"[WebSocket] Client disconnected: task_id={task_id}")

    finally:
        await pubsub.unsubscribe(f"opr_updates:{task_id}")
        await pubsub.aclose()
        await connection_manager.disconnect(websocket, task_id)

