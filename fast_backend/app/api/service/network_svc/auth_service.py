from app.api.schema.auth_schema import signup_input,login_input,UserOut
from app.database.crud.user_crud import UserCrud
from sqlalchemy.orm import Session
import bcrypt
from app.conf.settings import Settings
from fastapi import Response
from app.api.schema.auth_schema import Token
from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from app.api.service.network_svc.token_service import TokenManager
from app.api.exception.exceptions import EmailAlreadyExistsException,InvalidOtp,InternalServerError,UserNotRegistered,SessionServerError,PasswordFail
from datetime import datetime,timedelta
from jwt.exceptions import ExpiredSignatureError
from app.api.service.network_svc.email_otp import EmailService

class UserService:
    def __init__(self):
        self.email=EmailService()
    def _generate_password(self,password :str)->str:
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        return hashed.decode('utf-8')

    def _verify_password(self,password:str,hashed_password:str)->bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    def _authenticate_user(self,db:Session,payload:login_input):
        obj=UserCrud(db).validate_email(payload.email)
        if obj is None:
            raise UserNotRegistered()
        elif not self._verify_password(payload.password,obj.password):
            raise PasswordFail()
        else:
            return {"username":obj.username,"email":obj.email,"user_id":obj.id,"is_verified":obj.is_verified}
    
    def _get_user(self,db:Session,id:int):
        return UserCrud(db).get_user(id)
        
    
    def get_user(self,db:Session,token:str):
        try:
            payload=TokenManager.validate_token(token)
            unique_id=UserCrud(db).validate_email(payload.get('email')).id
            return self._get_user(db,unique_id)
        except ExpiredSignatureError as e:
            raise SessionServerError("Session has expired. Please login again.")
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def registration(self,db:Session,payload:signup_input):
        try:
            # make the password more validation like small lenght and some unique featue
            password=self._generate_password(payload.password)
            payload.password=password
            UserCrud(db).user_signup(payload)
            return {"content":"Successful"}
        except IntegrityError as e:
            if isinstance(e.orig, UniqueViolation):
                raise EmailAlreadyExistsException()
            else:
                raise InternalServerError()
    
    def login(self,db:Session,payload:login_input,response:Response):
        try:
            objects= self._authenticate_user(db,payload) 
            access_token=TokenManager.generate_access_token(objects,timedelta(minutes=Settings().ACCESS_TOKEN_EXPIRE_MINUTES))
            refresh_token=TokenManager.generate_refresh_token(objects["user_id"]) 
            response.set_cookie(key="refresh_token",value=refresh_token,max_age=Settings().REFRESH_TOKEN_EXPIRE_DAYS*86400,httponly=True)
            response.set_cookie(key="access_token",value=access_token,max_age=Settings().ACCESS_TOKEN_EXPIRE_MINUTES*60,httponly=True)
            return {"is_verified":objects["is_verified"]  }
        except (UserNotRegistered,PasswordFail) as Know_exception:
            raise Know_exception
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def swagger_login(self,db:Session,payload:login_input,response:Response):
        try:
            objects= self._authenticate_user(db,payload) 
            access_token=TokenManager.generate_access_token(objects,timedelta(minutes=15))
            refresh_token=TokenManager.generate_refresh_token(objects["user_id"]) 
            response.set_cookie(key="refresh_token",value=refresh_token,max_age=Settings().REFRESH_TOKEN_EXPIRE_DAYS*86400,httponly=True)
            response.set_cookie(key="access_token",value=access_token,max_age=Settings().ACCESS_TOKEN_EXPIRE_MINUTES*60,httponly=True)
            return {"access_token":access_token,
                    "refresh_token":refresh_token,
                    "token_type":"Bearer"}

        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
        
    async def email_opt(self,user):
        try:
            return await self.email._send_email(user.email)
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def verify_opt(self,db:Session,user:UserOut,otp:str):
        try:
            
            if self.email.verify_otp(otp):
                new_data={
                    "is_verified":True,
                    "id":user.id
                }
                UserCrud(db).update(new_data)
                return {"content":"Successful verified"}
            else:
                raise InvalidOtp
        except InvalidOtp:
            raise InvalidOtp
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))