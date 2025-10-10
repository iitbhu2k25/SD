import os
from pydantic_settings import BaseSettings
from decouple import config
from sqlalchemy import URL
from pydantic import AnyHttpUrl,Field,computed_field
import redis
from fastapi_mail import ConnectionConfig
def get_db_url(drivername,username,password,host,database,port)->str:
    return URL.create(
        drivername=drivername,
        username=username,
        password=password,
        host=host,
        database=database,
        port=port,
    )

class Settings(BaseSettings):
    # geoserver
    GEOSERVER_URL:str
    GEOSERVER_USERNAME:str
    GEOSERVER_PASSWORD:str
    GEOSERVER_EX_URL:str    
    # postgres
    
    POSTGRES_DB:str
    POSTGRES_HOST:str
    POSTGRES_USER:str
    POSTGRES_PASSWORD:str
    POSTGRES_PORT:int
    BASE_DIR : str="/home/app"
    SECRET_KEY :str
    ALGORITHM :str
    ACCESS_TOKEN_EXPIRE_MINUTES :int
    REFRESH_TOKEN_EXPIRE_DAYS:int
    REDIS_PASSWORD:str
    REDIS_USERNAME:str
    REDIS_PORT:int
    REDIS_HOST:str
    MAIL_USERNAME :str
    MAIL_PASSWORD:str
    MAIL_FROM:str
    MAIL_FROM_NAME:str
    CELERY_BROKER_URL:str
    #media path
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TEMP_DIR:str = os.path.dirname(BASE_DIR)+'/temp'
    subdistrict_path:str
    villages_path :str
    
    DATABSE_URL:AnyHttpUrl = Field(get_db_url(
        drivername="postgresql+psycopg2",
        username=config("POSTGRES_USER"),
        password=config("POSTGRES_PASSWORD"),
        host=config("POSTGRES_HOST"),
        database=config("POSTGRES_DB"),
        port=config("POSTGRES_PORT"),
    ),validate_default=False)

    @computed_field
    @property
    def redis_client(self) -> redis.Redis:
        return redis.Redis(
            host=self.REDIS_HOST,
            port=self.REDIS_PORT,
            password=self.REDIS_PASSWORD,
            username=self.REDIS_USERNAME,  
            decode_responses=True
        )
    @computed_field
    @property
    def email_conf(self)->ConnectionConfig:
        return ConnectionConfig(
            MAIL_USERNAME = self.MAIL_USERNAME,
            MAIL_PASSWORD = self.MAIL_PASSWORD,
            MAIL_FROM = self.MAIL_FROM,
            MAIL_PORT = 587,
            MAIL_SERVER = "smtp.gmail.com",
            MAIL_FROM_NAME=self.MAIL_FROM_NAME,
            MAIL_STARTTLS = True,
            MAIL_SSL_TLS = False,
            USE_CREDENTIALS = True,
            VALIDATE_CERTS = True
        )
    class config:
        env_file = ".env"

