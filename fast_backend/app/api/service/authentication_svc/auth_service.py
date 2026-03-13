from app.api.schema.auth_schema import signup_input,login_input,UserOut
from app.database.crud.user_crud import UserCrud
from sqlalchemy.orm import Session
import bcrypt
from app.conf.settings import Settings
from fastapi import Response,BackgroundTasks,Request
from app.api.schema.auth_schema import Token
from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from app.api.service.authentication_svc.token_service import TokenManager
from app.api.exception.exceptions import EmailAlreadyExistsException,InvalidOtp,InternalServerError,UserNotRegistered,SessionServerError,PasswordFail
from datetime import datetime,timedelta
from jwt.exceptions import ExpiredSignatureError
from app.api.service.authentication_svc.email_otp import EmailService
from abc import ABC, abstractmethod
from typing import Tuple

from app.conf.redis import get_redis


class AuthServiceInterface(ABC):
    @abstractmethod
    def registration(self, db: Session, payload: signup_input)->bool:
        pass
    
    @abstractmethod
    def login(self,db: Session, payload: login_input, response: Response)->None:
        pass
    
    @abstractmethod
    def get_user(self,db:Session,token:str):
        pass
    
    @abstractmethod
    def logout(self,response:Response)->bool:
        pass
    
    @abstractmethod
    def send_email_otp(self, user: any)->None:
        pass
    
    @abstractmethod
    def verify_otp(self,db:Session,user:UserOut,otp:str):
        pass
    
    @abstractmethod
    def delete_account(self,db:Session,email:str)->bool:
        pass
    
    # @abstractmethod
    # def reset_password(self, db: Session, email: str, password: str) -> bool:
    #     pass

class AuthService(AuthServiceInterface):
    def __init__(self):
        self.email=EmailService()
    def _generate_password(self,password :str)->str:
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        return hashed.decode('utf-8')
    
    def _verify_password(self,password:str,hashed_password:str)->bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    def _authenticate_user(self,db:Session,payload:login_input)-> UserOut:
        obj=UserCrud(db).validate_email(payload.email)
        if obj is None:
            raise UserNotRegistered()
        elif not self._verify_password(payload.password,obj.password):
            raise PasswordFail()
        else:
            return {"fullname":obj.fullname,"email":obj.email,"user_id":obj.id,"is_verified":obj.is_verified}
    def _generate_token(self,user:UserOut)->Tuple[str, str]:
        access_token=TokenManager.generate_access_token(user,timedelta(minutes=Settings().ACCESS_TOKEN_EXPIRE_MINUTES))
        refresh_token=TokenManager.generate_refresh_token(user["user_id"]) 
        return access_token,refresh_token
    
    def _generate_token_response(self,user:UserOut,response:Response):
        access_token,refresh_token=self._generate_token(user=user)
        if user["is_verified"]:
            response.set_cookie(key="verified_token",value=Settings().VERIFY_KEY,max_age=Settings().REFRESH_TOKEN_EXPIRE_DAYS*86400,httponly=True)
        response.set_cookie(key="refresh_token",value=refresh_token,max_age=Settings().REFRESH_TOKEN_EXPIRE_DAYS*86400,httponly=True)
        return access_token
    
    def get_user(self,db:Session,token:str):
        try:
            payload=TokenManager.validate_token(token)
            return UserCrud(db).validate_email(payload.get('email'))
        except ExpiredSignatureError as e:
            print(e)    
            raise SessionServerError("Session has expired. Please login again.")
        except Exception as e:
            print(e)
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def get_validation_user(self,db:Session,token:str):
        try:
            payload=TokenManager.validate_token(token)
            return True
        except ExpiredSignatureError as e:
            raise SessionServerError("Session has expired. Please login again.")
        except Exception as e:
            print(e)
            raise InternalServerError(CustomExceptionDetail=str(e))
        
    def registration(self,db:Session,bg:BackgroundTasks,payload:signup_input)->bool:
        try:
            payload.password=self._generate_password(payload.password)
            if UserCrud(db).user_signup(payload):
                self.email.approval(bg,payload)
                # make the admin verficatrion
                return True
            return False
        except IntegrityError as e:
            if isinstance(e.orig, UniqueViolation):
                raise EmailAlreadyExistsException()
            else:
                raise InternalServerError()
    
    def login(self,db:Session,payload:login_input,response:Response)->UserOut:
        try:
            objects= self._authenticate_user(db,payload) 
            access_token= self._generate_token_response(user=objects,response=response)
            return{
                "access_token":access_token,
                "token_type":"Bearer",
                "fullname":objects["fullname"],
                "email":objects["email"],
                "user_id":objects["user_id"],
                "is_verified":objects["is_verified"]
            }

        except (UserNotRegistered,PasswordFail) as Know_exception:
            raise Know_exception
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def logout(self, db:Session,request:Request,response:Response):
        try:
            token = request.headers.get('Authorization').replace("Bearer ", "")
            payload = None
            try:
                payload = TokenManager.validate_token(token)
            except ExpiredSignatureError:
                print("force sesison expired")
                pass
            except Exception as e:
                print(f"Token validation error: {e}")
            if payload and payload.get("user_id"):
                user = UserCrud(db).get_user(id=payload.get("user_id"))
                # await get_redis.delete(f"refresh:dss_{user.id}")
            
            # Delete cookies anyway
            response.delete_cookie(key="refresh_token")
            response.delete_cookie(key="access_token")
            return True
        except Exception as e:
            print(e)
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def swagger_login(self,db:Session,payload:login_input,response:Response):
        try:
            objects= self._authenticate_user(db,payload) 
            access_token,refresh_token=self._generate_token(user=objects)
            return {"access_token":access_token,
                    "refresh_token":refresh_token,
                    "token_type":"Bearer"}
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    
    def delete_account(self, db:Session, email:str)->bool:
        return UserCrud(db).delete_email(email)
    
    def send_email_otp(self,backgroud:BackgroundTasks, email:str):
        try:
            if self.email._send_email(backgroud=backgroud,email=email):
                return True
            return False
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))
    def verify_by_admin(self,db:Session,bg:BackgroundTasks,email:str,status:str):
        if status=="approved":
            new_data={
                "is_verified":True,
                "email":email,
                "status":"approved"
                }
        else:
            new_data={
                "is_verified":False,
                "email":email,
                "status":"rejected"
                }
        self.email.approval_status(background=bg,email=email,status=status)
        UserCrud(db).update_email(new_data)
        return f"""
            <html>
                <head>
                    <title>{status}</title>
                </head>
                <body style="font-family: Arial; text-align: center; margin-top: 80px;">
                    <h2>✅ User Approved</h2>
                    <p>User with email <strong>{email}</strong> has been {status}.</p>
                </body>
            </html>
            """
       
    def verify_otp(self,db:Session,user:UserOut,otp:str)->UserOut:
        try:
            if self.email.verify_otp(otp):
                new_data={
                    "is_verified":True,
                    "id":user.id
                }
                return UserCrud(db).update(new_data)
            else:
                raise InvalidOtp
        except InvalidOtp:
            raise InvalidOtp
        except Exception as e:
            raise InternalServerError(CustomExceptionDetail=str(e))