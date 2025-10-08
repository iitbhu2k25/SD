from app.database.crud.user_crud import UserDetailCrud,UserCrud
from sqlalchemy.orm import Session
from sqlalchemy import event
from app.database.models import User,UserDetails
class UserManagement:
    
    @event.listens_for(Session, "before_flush")
    def default_user_details(session, flush_context, instances):
        for obj in session.new:
            if isinstance(obj, User) and obj.details is None:
                obj.details = UserDetails()
        

    def update_details(self,db:Session,user_id:int,payload:dict):
        obj=UserDetailCrud(db).get_user_details(user_id)
        payload['id']=obj.id
        UserDetailCrud(db).updates(payload=payload)
        payload['id']=user_id
        return UserCrud(db).updates(payload=payload)
    
       