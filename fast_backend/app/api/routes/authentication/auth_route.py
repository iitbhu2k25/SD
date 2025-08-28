from fastapi import APIRouter,Response,status,BackgroundTasks
from app.api.schema.auth_schema import signup_input,login_input,OTPVerify, UserOut
from app.api.service.authentication_svc.auth_service import AuthService
from app.database.config.dependency import db_dependency
from fastapi import Depends
from typing import Annotated
from app.api.schema.auth_schema import Token,Useroutput
from app.dependency.token_dependency import get_current_user,get_current_user_cookie
app = APIRouter()

@app.get("/me",response_model=Useroutput)
def get_me(user: Annotated[str, Depends(get_current_user)]):
    return user

@app.get("/authentic",status_code=201)
def user_verification(user: Annotated[str, Depends(get_current_user_cookie)]):
    return {
        "fullname":user.fullname,
        "email":user.email,
        "is_valid":True,
    }

@app.post("/login",status_code=status.HTTP_201_CREATED,response_model=UserOut)
def login(response:Response,db:db_dependency,payload:login_input):
    return AuthService().login(db,payload,response)

@app.post("/signup",status_code=status.HTTP_201_CREATED)
def signup(db:db_dependency,payload:signup_input)->bool:
   return AuthService().registration(db,payload)



@app.post("/logout",status_code=status.HTTP_201_CREATED)
def logout(response:Response,user: Annotated[str, Depends(get_current_user)]):
    return AuthService().logout(response)

@app.post("/email_otp",status_code=status.HTTP_201_CREATED)
def generate_email_opt(backgroud:BackgroundTasks,user: Annotated[str, Depends(get_current_user)])->bool:
    return AuthService().send_email_otp(backgroud=backgroud,email=user.email)

@app.post("/email_verify",status_code=status.HTTP_201_CREATED)
def verify_email_opt(db:db_dependency,user: Annotated[str, Depends(get_current_user)],otp:OTPVerify):
    return AuthService().verify_otp(db,user,otp.otp)
   
@app.delete("/delete_account",status_code=status.HTTP_201_CREATED)
def delete_account(db:db_dependency,user: Annotated[str, Depends(get_current_user)])->bool:
    return AuthService().delete_account(db,user.email)