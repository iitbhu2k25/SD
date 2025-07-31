from fastapi import APIRouter,Response,status
from app.api.schema.auth_schema import signup_input,login_input,OTPVerify, UserOut
from app.api.service.network_svc.auth_service import UserService
from app.database.config.dependency import db_dependency
from fastapi import Depends
from typing import Annotated
from app.api.schema.auth_schema import Token,Useroutput
from app.dependency.token_dependency import get_current_user,get_current_user_cookie
from app.conf.settings import Settings
app = APIRouter()

@app.get("/me",response_model=Useroutput)
def get_me(user: Annotated[str, Depends(get_current_user)]):
    return user

@app.get("/authentic",status_code=201)
def user_verification(user: Annotated[str, Depends(get_current_user_cookie)]):
    return {
        "username":user.username,
        "email":user.email,
        "is_valid":True,
    }

@app.post("/login",status_code=status.HTTP_201_CREATED)
def login(response:Response,db:db_dependency,payload:login_input):
    return UserService().login(db,payload,response)

@app.post("/signup",status_code=status.HTTP_201_CREATED)
def signup(db:db_dependency,payload:signup_input):
   return UserService().registration(db,payload)

@app.post("/logout",status_code=status.HTTP_201_CREATED)
def logout(response:Response):
    response.delete_cookie(key="refresh_token")
    response.delete_cookie(key="access_token")
    return {"message":"Successfully logged out"}

@app.post("/email_otp",status_code=status.HTTP_201_CREATED)
async def generate_email_opt(db:db_dependency,user: Annotated[str, Depends(get_current_user_cookie)]):
    return await UserService().email_opt(user)

@app.post("/email_verify",status_code=status.HTTP_201_CREATED)
def verify_email_opt(db:db_dependency,user: Annotated[UserOut, Depends(get_current_user_cookie)],otp:OTPVerify):
    try:
        return UserService().verify_opt(db,user,otp.otp)
    except Exception as e:
        print(e)
   
