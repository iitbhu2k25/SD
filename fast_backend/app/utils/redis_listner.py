import json

from app.conf.redis.redis_manager import redis_manager
from app.conf.ws_config import connection_manager
from app.conf.logging import logger

# redis_listener.py
async def redis_listener():
    pubsub = redis_manager.pubsub()
    await pubsub.psubscribe("opr_id:*")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue

        print("RAW MESSAGE FROM REDIS:", message)  # ← add this
        
        data = json.loads(message["data"])
        task_id = data["task_id"]
        
        print(f"Broadcasting to task_id: '{task_id}'")  # ← and this
        print(f"Connected clients: {await connection_manager.clients_for(task_id)}")  # ← and this
        
        await connection_manager.broadcast(task_id, data)