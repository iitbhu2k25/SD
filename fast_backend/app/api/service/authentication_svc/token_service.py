from datetime import datetime,timedelta,timezone
import jwt
from app.conf.settings import Settings
from app.api.exception.exceptions import TokenNone,InternalServerError,Invalid_Token
from app.database.crud.user_crud import UserCrud
from sqlalchemy.orm import Session 
redis_client=Settings().redis_client

class TokenManager:
    
    @staticmethod
    def validate_token(token:str):
        payload=jwt.decode(token, Settings().SECRET_KEY, algorithms=[Settings().ALGORITHM])
        return payload
    
    @staticmethod
    def generate_access_token(data:dict,expire_time:timedelta|None=None):
        to_encode=data.copy()
        if expire_time:
            expire=datetime.now(timezone.utc)+expire_time
        else:
            expire=datetime.now(timezone.utc)+timedelta(minutes=15)
        to_encode.update({"exp": expire,"type":"access","secret_id":Settings().SECRET_KEY})
        encoded_jwt = jwt.encode(to_encode, Settings().SECRET_KEY, algorithm=Settings().ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def generate_refresh_token(user_id:int):
        expire = datetime.now(timezone.utc) + timedelta(days=Settings().REFRESH_TOKEN_EXPIRE_DAYS)
        refresh_token = jwt.encode(
            {"sub@x": str(user_id), "exp": expire, "type":"refresh"},
            Settings().SECRET_KEY,
            algorithm=Settings().ALGORITHM
        )
        redis_client.set(f"refresh:{user_id}", refresh_token, ex=Settings().REFRESH_TOKEN_EXPIRE_DAYS*86400)
        return refresh_token
    @staticmethod
    def regenerate_access_token(db:Session,token:str,expire_time:timedelta|None=None):
        try:
            if token is None:
                raise TokenNone(CustomExceptionDetail="Refresh token is missing")
            payload=TokenManager.validate_token(token)
            if payload.get('sub@x') is None:
                raise Invalid_Token(CustomExceptionDetail="refresh token failed")
            stored_token = redis_client.get(f"refresh:{payload.get('sub@x')}") == token
            if not stored_token:
                raise Invalid_Token(CustomExceptionDetail="refresh token is invalid")
            obj =UserCrud(db).get_user(id=payload.get('sub@x'))
            dict={"fullname":obj.fullname,"email":obj.email,"user_id":obj.id}
            return TokenManager.generate_access_token(dict,expire_time=timedelta(minutes=15))
        except (Invalid_Token,TokenNone) as e:
            raise e
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=e)
    

