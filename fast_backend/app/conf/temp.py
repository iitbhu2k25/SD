import os
from pydantic_settings import BaseSettings
from decouple import config
from sqlalchemy import URL
from pydantic import AnyHttpUrl, Field,computed_field
import redis

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
    

    class config:
        env_file = ".env"
    
   
    @computed_field
    @property
    def database_url(self) -> str:
        return str(URL.create(
            drivername="postgresql+psycopg2",
            username="rajat",
            password="rajat",
            host="db",
            port="5432",
            database="authentication",
        ))

    @computed_field
    @property
    def redis_client(self) -> redis.Redis:
        return redis.Redis(
            host=self.REDIS_HOST,
            port=self.REDIS_PORT,
            username=self.REDIS_USERNAME,
            password=self.REDIS_PASSWORD,
            decode_responses=True
        )
    def debug_connection(self):
        """Debug database connection settings"""
        print("=== DATABASE CONNECTION DEBUG ===")
        print(f"Host: {self.POSTGRES_HOST}")
        print(f"Port: {self.POSTGRES_PORT}")
        print(f"Database: {self.POSTGRES_DB}")
        print(f"User: {self.POSTGRES_USER}")
        print(f"Password: {(self.POSTGRES_PASSWORD)} (length: {len(self.POSTGRES_PASSWORD)})")
        print(f"URL: {self.database_url}")
        print("=====================================")