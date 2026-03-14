from fastapi import APIRouter, Request,Response,status,BackgroundTasks
from app.api.schema.auth_schema import signup_input,login_input,OTPVerify, UserOut
from app.api.service.authentication_svc.auth_service import AuthService
from app.database.config.dependency import db_dependency
from fastapi import Depends
from fastapi.responses import HTMLResponse
from typing import Annotated
from app.api.schema.auth_schema import Token,Useroutput
from app.dependency.token_dependency import get_current_user,get_current_user_cookie,validate_user
from app.utils.exception import validate
from app.api.service.authentication_svc.email_otp import EmailService
from app.utils.exception import CustomException
from fastapi.responses import JSONResponse
router = APIRouter()

@router.get("/me",response_model=Useroutput)
@validate
async def get_me(user: Annotated[str, Depends(get_current_user)]):
    return user

@router.get("/authentic",status_code=201)
@validate
async  def user_verification(user: Annotated[str, Depends(get_current_user_cookie)]):
    return {
        "fullname":user.fullname,
        "email":user.email,
        "is_valid":True,
    }

@router.post("/login",status_code=status.HTTP_201_CREATED,response_model=UserOut)
@validate
async def login(response:Response,db:db_dependency,payload:login_input):
    return await AuthService().login(db,payload,response)

@router.post("/signup",status_code=status.HTTP_201_CREATED)
@validate
async def signup(db:db_dependency,bg:BackgroundTasks,payload:signup_input)->bool:
   return AuthService().registration(db,bg,payload)


@router.post("/logout",status_code=status.HTTP_201_CREATED)
@validate
async def logout(db:db_dependency,request:Request,response:Response):            
    return AuthService().logout(db,request,response)


# @router.post("/email_otp",status_code=status.HTTP_201_CREATED)
# @validate
# async def generate_email_opt(backgroud:BackgroundTasks,user: Annotated[str, Depends(get_current_user)])->bool:
#     return AuthService().send_email_otp(backgroud=backgroud,email=user.email)

# @router.post("/email_verify",status_code=status.HTTP_201_CREATED)
# @validate
# async def verify_email_opt(db:db_dependency,user: Annotated[str, Depends(get_current_user)],otp:OTPVerify):
#     return AuthService().verify_otp(db,user,otp.otp)
   
@router.delete("/delete_account",status_code=status.HTTP_201_CREATED)
@validate
async  def delete_account(db:db_dependency,user: Annotated[str, Depends(get_current_user)])->bool:
    return AuthService().delete_account(db,user.email)

@router.get("/admin/approve",  response_class=HTMLResponse)
@validate
async def approve_user(db:db_dependency,bg:BackgroundTasks,token: str):
    email_service = EmailService()
    data = email_service.verify_approval_token(token)

    if data == "expired":
        raise CustomException(400, "Approval link expired")

    if data == "invalid":
        raise CustomException(400, "Invalid approval link")

    if data["action"] != "approve":
        raise CustomException(403, "Invalid action")

    email = data["email"]
    return AuthService().verify_by_admin(db,bg,email=email,status="approved")


@router.get("/admin/reject",response_class=HTMLResponse)  
@validate
async def reject_user(db:db_dependency,bg:BackgroundTasks,token: str):
    email_service = EmailService()
    data = email_service.verify_approval_token(token)

    if data == "expired":
        raise CustomException(400, "Rejection link expired")

    if data == "invalid":
        raise CustomException(400, "Invalid rejection link")

    if data["action"] != "reject":
        raise CustomException(403, "Invalid action")

    email = data["email"]
    return AuthService().verify_by_admin(db,bg,email=email,status="rejected")