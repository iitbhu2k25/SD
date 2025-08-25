from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import app_router
from app.api.routes.authentication.token import app as token_router

app = FastAPI(title="Decision support system", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","slcrdss.in","http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include your API routes
app.include_router(
    app_router,
    prefix="/api",
)

app.include_router(
    token_router,
    tags=["Token"],
    prefix="",)
