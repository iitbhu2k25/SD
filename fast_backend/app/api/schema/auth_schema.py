from pydantic import BaseModel,EmailStr
from typing import Optional,List
from datetime import datetime


class login_input(BaseModel):
    email: EmailStr
    password: str = "rajat@123"
    

class signup_input(BaseModel):
    username: str = "rajat"
    email: EmailStr
    password: str = "rajat@123"
    

class OTPVerify(BaseModel):
    otp: str
    
class Token(BaseModel):
    access_token: str
    refresh_token:str
    token_type: str
    
class Useroutput(BaseModel):
    username: str
    email: EmailStr
    created_at: datetime

class EmailSchema(BaseModel):
    email: List[EmailStr]
    
class UserOut(BaseModel):
    user_id: int
    username: str
    email: str
    is_verified: bool

    class Config:
        orm_mode = True