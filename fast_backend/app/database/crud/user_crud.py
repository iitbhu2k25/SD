from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.api.schema.auth_schema import signup_input
from app.database.models.auth_model import User

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
        
    def get_user(self,id:int):
        return self.db.query(self.Model).filter(
            self.Model.id == id).first()
    