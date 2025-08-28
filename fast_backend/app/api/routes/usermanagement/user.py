from fastapi import APIRouter,Depends,status
from typing import Annotated
from app.database.config.dependency import db_dependency
from app.api.service.usermanagement.user_svc import UserManagement
from app.dependency.token_dependency import get_current_user
from app.api.schema.auth_schema import UserDetailsOut,UserEditable
app = APIRouter()

@app.get("/userprofile",status_code=status.HTTP_201_CREATED,response_model=UserDetailsOut)
def user_details(db:db_dependency,user: Annotated[str, Depends(get_current_user)]):
    return user


@app.post("/userdetails",status_code=status.HTTP_201_CREATED)
def user_updates(db:db_dependency,user: Annotated[str, Depends(get_current_user)],payload:UserEditable):
    UserManagement().update_details(db=db,user_id=user.id,payload=payload.model_dump())
