# rwm/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from celery.result import AsyncResult
from django.core.cache import cache

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

        # Join task group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection',
            'status': 'connected',
            'task_id': self.task_id,
            'message': 'WebSocket connected'
        }))
    
    async def disconnect(self, close_code):
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
