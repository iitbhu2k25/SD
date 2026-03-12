import redis.asyncio as redis
from app.conf.settings import Settings
sett=Settings()

redis_client = redis.Redis(
    host=sett.REDIS_HOST,
    port=sett.REDIS_PORT,
    username=sett.REDIS_USERNAME,
    password=sett.REDIS_PASSWORD,
    decode_responses=True
)