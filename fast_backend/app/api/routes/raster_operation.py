import json

from fastapi import APIRouter,status,UploadFile,File,Header
from fastapi.responses import FileResponse
import asyncio
from pathlib import Path
from app.conf.celery import app 
from app.conf.ws_config import ConnectionManager,safe_send
from fastapi import  WebSocket, WebSocketDisconnect
from celery.result import AsyncResult
from app.database.config.dependency import db_dependency
from app.utils.exception import validate
from app.api.schema.raster_operation import (
    RasterInfoResponse,
    RasterReproject,
    RasterReclassify,
    Edliudian,
    FlowDirectionParams,
    FlowAccumulationParams,
    SlopeParams,
    TpiParams,
    TwiParams,
    Chunkcomplete,
    CellResize,
    RasterUploadResponse)
from app.api.service.raster_work.raster_operation import RasterOperation
router=APIRouter()
connection_manager=ConnectionManager()
from app.conf.redis import redis_client

@router.post("/post_raster",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency,file: UploadFile = File(...)):
    """ return the raster temp id"""
    return await RasterOperation().save_upload(db,file)

@router.post("/upload_raster_chunk",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency, file: UploadFile = File(...),
    upload_id: str = Header(...),
    chunk_index: int = Header(...),
):
    return await RasterOperation().chunk_upload(file,upload_id,chunk_index)   


@router.post("/upload/complete",status_code=status.HTTP_201_CREATED)
async def complete_upload(db:db_dependency,payload:Chunkcomplete):
    """
    Merge all chunks into final file.
    """
    return await RasterOperation().merge_chunks(payload.upload_id,payload.filename,payload.total_chunks)



@router.get("/raster/{file_id}/details",status_code=status.HTTP_201_CREATED)
@validate
async def get_raster(db:db_dependency,file_id: str):
    """ return the raster details"""
    return await RasterOperation().get_info(db,file_id)


@router.get("/get_avaliable_epsg",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reproject(db:db_dependency):
    return await RasterOperation().available_epsg()

@router.post("/reprojection",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reproject(db:db_dependency,payload:RasterReproject):
    """ return the reprojected raster """
    resp = RasterOperation().reprojection(db,payload)
    return resp.id


# @router.post("/slope",status_code=status.HTTP_201_CREATED)
# @validate
# async def slope(db:db_dependency,payload:SlopeParams):
#     """return the slope raster"""
#     resp=RasterOperation().slope(db,payload)
#     return resp.id

# @router.post("/tpi",status_code=status.HTTP_201_CREATED)
# @validate
# async def tpi(db:db_dependency,payload:TpiParams):
#     """return the tpi raster"""
#     resp= RasterOperation().tpi(db,payload)
#     return resp.id

# @router.post("/twi",status_code=status.HTTP_201_CREATED)
# @validate
# async def twi(db:db_dependency,payload:TwiParams):
#     """ return the twi raster"""
#     resp= RasterOperation().twi(db,payload)
#     return resp.id

# @router.post("/flow_direction",status_code=status.HTTP_201_CREATED)
# @validate
# async def flow_direction(db:db_dependency,payload:FlowDirectionParams):
#     """return the flow direction raster"""
#     resp= RasterOperation().flow_direction(db,payload)
#     return resp.id

# @router.post("/flow_acumulation",status_code=status.HTTP_201_CREATED)
# @validate
# async def flow_acumulation(db:db_dependency,payload:FlowAccumulationParams):
#     """return the flow accumulation raster"""
#     resp= RasterOperation().flow_accumulation(db,payload)
#     return resp.id


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




# @router.post("/raster_resolution",status_code=status.HTTP_201_CREATED)
# @validate
# async def raster_resolution(db:db_dependency,payload:CellResize):
#     """ return the raster resolution dry run"""
#     return RasterOperation().check_resolution(db,payload)

# @router.post("/raster_resolution_execute",status_code=status.HTTP_201_CREATED)
# @validate
# async def raster_resolution(db:db_dependency,payload:CellResize):
#     """ return the raster resolution """
#     return RasterOperation().execute_resolution(db,payload)


@router.get("/download_output",status_code=status.HTTP_200_OK,response_class=FileResponse)
@validate
async def get_report(chord_id:str):
    file_path = AsyncResult(chord_id).get()      
    file_path = Path(file_path)
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(path=file_path, filename=file_path.name, media_type="image/tiff")


@router.websocket("/ws/operation/{task_id}")
async def operation_progress(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await connection_manager.connect(websocket, task_id)
    pubsub = redis_client.pubsub()
    channel = f"opr_id:{task_id}"
    pubsub.subscribe(channel)
    
    try:
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                data = json.loads(message["data"])
                await websocket.send_json(data)
                if data["status"] in ["completed", "failed"]:
                    break
            await asyncio.sleep(0.5)
    
    except WebSocketDisconnect:
        pass
    
    
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()
        await connection_manager.disconnect(websocket, task_id)