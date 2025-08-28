from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.api.schema.auth_schema import signup_input
from app.database.models.auth_model import User,UserDetails
from app.api.exception.exceptions import UserNotRegistered

class UserCrud(CrudBase):
    def __init__(self,db:Session,Model=User):
        self.db=db
        self.Model=Model
        self.obj=None

    def user_signup(self,payload:signup_input):
        return self.create(payload.model_dump())
    
    def validate_email(self,email:str):
        return self.db.query(self.Model).filter(
            self.Model.email == email).first()
    
    def delete_email(self,email:str):
        obj=self.validate_email(email)
        if obj is None:
            raise UserNotRegistered
        return self.delete(obj.id)
        
    def get_user(self,id:int):
        return self.db.query(self.Model).filter(
            self.Model.id == id).first()
    def updates(self,payload:dict):
        return self.update(payload)
    
class UserDetailCrud(CrudBase):
    def __init__(self,db:Session,Model=UserDetails):
        self.db=db
        self.Model=Model
        self.obj=None
    def get_user_details(self,id:int):
        return self.db.query(self.Model).filter(
            self.Model.user_id == id).first()
    
    def updates(self,payload:dict):
        return self.update(payload)