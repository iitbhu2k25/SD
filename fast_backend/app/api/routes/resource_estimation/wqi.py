from fastapi import APIRouter,status
from typing import List
from app.database.config.dependency import db_dependency
from app.api.schema.wqi import Well_input,Well_response,WQIOperation
from app.api.service.wqi.water_quality import WQ_Index
from app.database.crud.gwpz_crud import WQI_threshold
from app.conf.ws_config import ConnectionManager
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.conf.settings import Settings
redis_client = Settings().redis_client
router=APIRouter()
connection_manager=ConnectionManager()

@router.get('/year',status_code=status.HTTP_201_CREATED)
async def make_interpolation():
    return [2015,2016,2017,2018,2019,2020,2021,2023,2024]

@router.post('/wells',status_code=status.HTTP_201_CREATED,response_model=List[Well_response])
async def get_well(db:db_dependency,payload:Well_input):
    return WQ_Index().get_well(db,payload)

@router.post('/well_interpolation',status_code=status.HTTP_201_CREATED)
async def make_interpolation(db:db_dependency,payload:WQIOperation):
    return WQ_Index().calculate_GWQI(db,payload)

import asyncio

@router.websocket("/ws/{task_id}")
async def groudwater_Interpolation(websocket: WebSocket, task_id: str):
    await connection_manager.connect(websocket)  
    try:
        while True:
            data= redis_client.get(task_id)
            if data == "null" or data is None:
                await websocket.send_json({"state": "NOT_FOUND"})
                connection_manager.disconnect(websocket)
            elif data == "Done":
                result = redis_client.hgetall(task_id + "_Result")
                await websocket.send_json({"state": "DONE", "result": result})
                connection_manager.disconnect(websocket)
            else:
                await websocket.send_json({"state": data})
            await asyncio.sleep(1)

    except Exception as e:
        await websocket.send_json({
            "state": "ERROR",
            "description": str(e)
        })
        connection_manager.disconnect(websocket)
