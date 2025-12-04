from fastapi import APIRouter,status
from typing import List
from app.database.config.dependency import db_dependency
from app.api.schema.wqi import Well_input,Well_response,WQIOperation
from app.api.service.wqi.water_quality import WQ_Index
from app.database.crud.gwpz_crud import WQI_threshold
from app.conf.ws_config import ConnectionManager,safe_send
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.conf.settings import Settings
redis_client = Settings().redis_client
router=APIRouter()
connection_manager=ConnectionManager()
from app.conf.logging import logger

@router.get('/year',status_code=status.HTTP_201_CREATED)
async def make_interpolation():
    return [2018,2019,2020,2021,2022,2023,2024]

@router.post('/wells',status_code=status.HTTP_201_CREATED,response_model=List[Well_response])
async def get_well(db:db_dependency,payload:Well_input):
    return WQ_Index().get_well(db,payload)

@router.post('/well_interpolation',status_code=status.HTTP_201_CREATED)
async def make_interpolation(db:db_dependency,payload:WQIOperation):
    return WQ_Index().calculate_GWQI(db,payload)

@router.websocket("/ws/{task_id}")
async def groundwater_interpolation(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await connection_manager.connect(websocket, task_id)
    last_state = None
    try:
        await asyncio.sleep(2)
        await safe_send(websocket, {"state": "STARTED"})
        while True:
            data = redis_client.get(task_id)
            if data is None:
                if last_state != "NOT_FOUND":
                    await safe_send(websocket, {"state": "NOT_FOUND"})
                    last_state = "NOT_FOUND"
            else:
                if data != last_state:
                    if data == "Done":
                        result = redis_client.hgetall(task_id + "_Result")
                        await safe_send(websocket, {
                            "state": "completed",
                            "result": result
                        })
                        last_state = "Done"
                        break

                    else:
                        await safe_send(websocket, {"state": data})
                        last_state = data

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await safe_send(websocket, {"state": "ERROR", "description": str(e)})
    finally:
        await connection_manager.disconnect(websocket, task_id)
