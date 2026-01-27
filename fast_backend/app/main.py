from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.conf.rate_limiting import RateLimiterMiddleware,AsyncSlidingWindowCounter
from app.api.routes import app_router
from app.api.routes.authentication.token import app as token_router
from prometheus_fastapi_instrumentator import Instrumentator
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield 
   

app = FastAPI(
    title="Decision support system", 
    version="1.0.0",
    lifespan=lifespan
)


instrumentator = Instrumentator().instrument(app)
instrumentator.expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","slcrdss.in","http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(app_router, prefix="/api")
app.include_router(token_router, tags=["Token"], prefix="")
