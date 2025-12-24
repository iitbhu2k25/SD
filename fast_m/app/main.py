# app/main.py
from fastapi import FastAPI
from app.api.router import router as api_router
from app.core.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Decision support system", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://slcrdss.in"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables if they don't exist
#Base.metadata.create_all(bind=engine)

# Include routers AFTER defining middleware
app.include_router(api_router)
