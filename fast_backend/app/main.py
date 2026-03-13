from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.conf.rate_limiting import RateLimiterMiddleware,AsyncSlidingWindowCounter
from app.api.routes import app_router
from app.api.routes.token import app as token_router
from prometheus_fastapi_instrumentator import Instrumentator
from contextlib import asynccontextmanager
from app.conf.redis import get_redis,close_redis,_singleton
from app.conf.logging import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application...")

    await get_redis()
    if not await _singleton.health_check():
        raise RuntimeError("Redis connection failed")

    logger.info("Redis ready")
    yield

    logger.info("Shutting down application...")
    await close_redis() 

app = FastAPI(
    title="Decision support system", 
    version="1.0.0",
    lifespan=lifespan
)




instrumentator = Instrumentator().instrument(app)
instrumentator.expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","slcrdss.in"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(app_router, prefix="/api")
app.include_router(token_router, tags=["Token"], prefix="")
