from pydantic import BaseModel,EmailStr
from typing import Optional,List
from datetime import datetime


class login_input(BaseModel):
    email: EmailStr
    password: str = "rajat@123"
    

class signup_input(BaseModel):
    fullname: str = "rajat"
    email: EmailStr
    password: str = "rajat@123"
    

class OTPVerify(BaseModel):
    otp: str
    
class Token(BaseModel):
    access_token: str
    refresh_token:str
    token_type: str
    
class Useroutput(BaseModel):
    fullname: str
    email: EmailStr
    created_at: datetime

class EmailSchema(BaseModel):
    email: List[EmailStr]
    
class UserOut(BaseModel):
    user_id: int
    fullname: str
    email: str
    is_verified: bool
    access_token: str
    class Config:
        from_attributes = True


class UserDetails(BaseModel):      
    contact_no:str
    organisation:str

    
class UserDetailsOut(BaseModel):
    fullname: str
    email: str
    is_verified: bool
    details:UserDetails
    class Config:
        from_attributes = True
        
class UserEditable(BaseModel):
    fullname: Optional[str]
    contact_no: Optional[str]
    organisation: Optional[str]