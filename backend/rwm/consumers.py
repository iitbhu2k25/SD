# rwm/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache
import asyncio
import logging
logger = logging.getLogger("rwm")


class TaskProgressConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time Celery task progress
    """
    async def connect(self):
        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.group_name = f'task_{self.task_id}'
        
        print("\n\n================ WS CONNECT DEBUG ================")
        print(f"Client connected to task_id: {self.task_id}")
        print(f"Group name: {self.group_name}")
        print("=================================================\n\n")
        
        cache.set(f"user_active_{self.task_id}", True, timeout=60 * 60)
        
        logger.info(
        "[WS] Connect request | task_id=%s",
        self.task_id
    )

        # Join task group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        
        logger.info(
        "[WS] Connected & joined group | group=%s",
        self.group_name
    )
        self.keepalive = asyncio.create_task(self._keepalive())
        
        cache_key = f"task:{self.task_id}:state"
        last_state = cache.get(cache_key)

        if last_state:
            logger.info(
                "[WS] Replaying cached state | task_id=%s | progress=%s",
                self.task_id,
                last_state.get("progress"),
            )
            await self.send(text_data=json.dumps(last_state))
        else:
            logger.info(
                "[WS] No cached state found | task_id=%s",
                self.task_id
            )
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'task_id': self.task_id,
            'message': 'WebSocket connected'
        }))
    
    async def disconnect(self, close_code):
        if hasattr(self, "keepalive"):
            self.keepalive.cancel()
        print(f"🔴 WS disconnect: {self.group_name} | code={close_code}")
        
        cache.set(f"user_active_{self.task_id}", False, timeout=60 * 60)
        
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        print(f"📥 WS RECEIVED FROM FRONTEND → {text_data}")
        """Handle messages from WebSocket client (optional)"""
        pass
    
    async def task_progress(self, event):
        logger.info(
            "[WS] Sending progress | task_id=%s | progress=%s",
            self.task_id,
            event["data"].get("progress"),
        )

        print("\n📤 WS OUTGOING EVENT (from CELERY):")
        print(event["data"])
        print("--------------------------------------------------\n")
        """Receive progress updates from Celery tasks"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def task_complete(self, event):
        """Receive completion notification"""
        await self.send(text_data=json.dumps(event['data']))
    
    async def task_error(self, event):
        """Receive error notification"""
        await self.send(text_data=json.dumps(event['data']))


    async def _keepalive(self):
        while True:
            try:
                await self.send(text_data=json.dumps({"type": "ping"}))
                await asyncio.sleep(20)
            except asyncio.CancelledError:
                logger.info("[WS] Keepalive cancelled | task_id=%s", self.task_id)
                break
            except Exception as e:
                logger.exception("[WS] Keepalive error | task_id=%s", self.task_id)
                break

