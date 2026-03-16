# import json

# from app.conf.redis.redis_manager import redis_manager
# from app.conf.ws_config import connection_manager
# from app.conf.logging import logger

# async def redis_listener():
#     pubsub = redis_manager.pubsub()
#     await pubsub.psubscribe("opr_id:*")

#     async for message in pubsub.listen():
       
        
#         if message["type"] != "pmessage":
#             continue

#         try:
#             raw = message["data"]
#             if isinstance(raw, bytes):
#                 raw = raw.decode("utf-8")
#             data = json.loads(raw)  
#             task_id = data.get("task_id")
        
            
#             await connection_manager.broadcast(task_id, data)
            
#         except Exception as e:
#             print(f"LISTENER ERROR: {e}", flush=True)
#             import traceback
#             traceback.print_exc()