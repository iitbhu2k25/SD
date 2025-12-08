# fast_m/app/core/config.py
from pydantic_settings import BaseSettings
from typing import ClassVar
import os

class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DB_HOST: str
    DB_PORT: str

    # BASE_DIR = fast_m/
    BASE_DIR: ClassVar[str] = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )

    
    MEDIA_ROOT: ClassVar[str] = os.path.join(BASE_DIR, "media")

    class Config:
        env_file = ".fastmdb.env"


settings = Settings()

DATABASE_URL = (
    f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.POSTGRES_DB}"
)
