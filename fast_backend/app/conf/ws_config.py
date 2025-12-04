import asyncio
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from typing import Dict, Set
from app.conf.logging import logger


async def safe_send(ws: WebSocket, message: dict):
    if ws.application_state != WebSocketState.CONNECTED:
        return
    try:
        await ws.send_json(message)
    except (RuntimeError, WebSocketDisconnect) as e:
        logger.error("WebSocket closed during send: %s", e)

    except Exception:
        logger.exception("Unexpected error while sending websocket message")

async def safe_send_raw(ws: WebSocket, payload: str):
    if ws.application_state != WebSocketState.CONNECTED:
        return
    try:
        await ws.send_text(payload)
    except (RuntimeError, WebSocketDisconnect):
        logger.debug("WebSocket closed during raw send.")
    except Exception:
        logger.exception("Unexpected error while sending raw websocket message")


class ConnectionManager:
    def __init__(self):
        self._task_clients: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, task_id: str):
        async with self._lock:
            self._task_clients.setdefault(task_id, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket,task_id: str):
        async with self._lock:
            clients = self._task_clients.get(task_id)
            if not clients:
                return
            clients.discard(websocket)
            if not clients:
                self._task_clients.pop(task_id, None)

    async def clients_for(self, task_id: str):
        async with self._lock:
            return set(self._task_clients.get(task_id, set()))
