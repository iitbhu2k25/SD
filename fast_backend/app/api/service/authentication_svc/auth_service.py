from fastapi.responses import HTMLResponse

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
    async def _generate_token(self,user:UserOut)->Tuple[str, str]:
        access_token=TokenManager.generate_access_token(user,timedelta(minutes=Settings().ACCESS_TOKEN_EXPIRE_MINUTES))
        refresh_token=await TokenManager.generate_refresh_token(user["user_id"]) 
        return access_token,refresh_token
    
    async def _generate_token_response(self,user:UserOut,response:Response):
        access_token,refresh_token=await self._generate_token(user=user)
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
    
    async def login(self,db:Session,payload:login_input,response:Response)->UserOut:
        try:
            objects= self._authenticate_user(db,payload) 
            access_token= await self._generate_token_response(user=objects,response=response)
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
           
            response.delete_cookie(key="refresh_token")
            response.delete_cookie(key="access_token")
            response.delete_cookie(key="verified_token")
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
        if status=="approved":
            icon_bg      = "#d1fae5"
            title_color  = "#15803d"
            badge_color  = "#16a34a"
            title_text   = "Account Approved"
            desc_text    = f"<strong>{email}</strong> has been approved and can now log in."
            badge_label  = "Approval email sent to user"
            svg_icon     = """<path class="ap" d="M13 25 L22 34 L37 16"
                            stroke="#15803d" stroke-width="4"
                            stroke-linecap="round" stroke-linejoin="round" fill="none"/>"""
        else:
            icon_bg      = "#fee2e2"
            title_color  = "#b91c1c"
            badge_color  = "#dc2626"
            title_text   = "Account Rejected"
            desc_text    = f"<strong>{email}</strong>'s request was rejected. They have been notified."
            badge_label  = "Rejection email sent to user"
            svg_icon     = """<path class="ap" d="M15 15 L35 35"
                            stroke="#b91c1c" stroke-width="4" stroke-linecap="round" fill="none"/>
                            <path class="ap" d="M35 15 L15 35"
                            stroke="#b91c1c" stroke-width="4" stroke-linecap="round" fill="none"/>"""
    
        html = f"""<!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>{title_text}</title>
        <style>
            *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
            body{{
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            background:#f0f0ed;min-height:100vh;
            display:flex;align-items:center;justify-content:center;padding:24px;
            }}
            .card{{
            background:#fff;border:1px solid #e3e1da;border-radius:18px;
            padding:48px 44px;width:100%;max-width:440px;text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,0.07);
            }}
            .icon-wrap{{
            width:96px;height:96px;border-radius:50%;background:{icon_bg};
            margin:0 auto 24px;display:flex;align-items:center;justify-content:center;
            animation:pop .55s cubic-bezier(.34,1.56,.64,1);
            }}
            @keyframes pop{{from{{transform:scale(0);opacity:0}}to{{transform:scale(1);opacity:1}}}}
            .ap{{stroke-dasharray:80;stroke-dashoffset:80;animation:draw .55s ease .3s forwards}}
            @keyframes draw{{to{{stroke-dashoffset:0}}}}
            .title{{font-size:24px;font-weight:700;color:{title_color};margin-bottom:10px;animation:up .4s ease .2s both}}
            .desc{{font-size:14px;color:#777;line-height:1.7;margin-bottom:24px;animation:up .4s ease .3s both}}
            .chip{{
            display:inline-flex;align-items:center;gap:10px;
            background:#f5f4f1;border:1px solid #e3e1da;border-radius:40px;
            padding:8px 16px 8px 8px;margin-bottom:20px;animation:up .4s ease .4s both;
            }}
            .av{{
            width:32px;height:32px;border-radius:50%;background:{icon_bg};
            color:{title_color};font-size:13px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
            }}
            .em{{font-size:13px;color:#555}}
            .badge{{
            display:inline-flex;align-items:center;gap:8px;
            background:#f5f4f1;border:1px solid #e3e1da;border-radius:30px;
            padding:8px 18px;font-size:12px;color:#777;animation:up .4s ease .5s both;
            }}
            .dot{{width:7px;height:7px;border-radius:50%;background:{badge_color};flex-shrink:0}}
            @keyframes up{{from{{opacity:0;transform:translateY(8px)}}to{{opacity:1;transform:translateY(0)}}}}
        </style>
        </head>
        <body>
        <div class="card">
        <div class="icon-wrap">
            <svg width="50" height="50" viewBox="0 0 50 50">{svg_icon}</svg>
        </div>
        <div class="title">{title_text}</div>
        <p class="desc">{desc_text}</p>
        <div class="chip">
            <div class="av">{email[0].upper()}</div>
            <span class="em">{email}</span>
        </div><br/>
        <div class="badge"><span class="dot"></span>{badge_label}</div>
        </div>
        </body>
        </html>"""
        
        return HTMLResponse(content=html)
        