from fastapi import Depends,Cookie
from typing import Annotated
from fastapi.security import OAuth2PasswordBearer
from app.api.service.authentication_svc.auth_service import AuthService
from app.database.config.dependency import db_dependency
from app.api.exception.exceptions import Invalid_Token
from app.api.schema.auth_schema import UserOut
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# this is the dependency
def get_current_user(db:db_dependency,token: str = Depends(oauth2_scheme)):
    return AuthService().get_user(db,token)


def get_current_user_cookie(db:db_dependency,access_token: Annotated[str, Cookie()] = None)->UserOut:
    if not access_token:
        raise Invalid_Token(CustomExceptionDetail="access token not found")
    return AuthService().get_user(db,token=access_token)