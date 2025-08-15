from fastapi import APIRouter,Cookie,Response
from app.api.schema.auth_schema import Token
from app.api.service.authentication_svc.auth_service import AuthService
from app.api.service.authentication_svc.token_service import TokenManager
from app.database.config.dependency import db_dependency
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Annotated
from app.api.schema.auth_schema import login_input

app = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token",response_model=Token)
async def login_for_access_token(response:Response,db:db_dependency,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):  
    return AuthService().swagger_login(db,payload=login_input(email=form_data.username,password=form_data.password),response=response)

@app.post('/access_token')
async def regenerate_access_token(
    db:db_dependency,refresh_token: Annotated[str, Cookie()] = None,
):  
    return TokenManager.regenerate_access_token(db,token=refresh_token)