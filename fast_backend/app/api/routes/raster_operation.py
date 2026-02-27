from fastapi import APIRouter,status,Depends,UploadFile,File
from app.database.config.dependency import db_dependency
from app.utils.exception import validate
from fastapi.responses import FileResponse
from typing import Annotated,Optional
from app.dependency.token_dependency import validate_user
from app.api.service.raster_work.raster_operation import RasterOperation
router=APIRouter()


@router.post("/post_raster",status_code=status.HTTP_201_CREATED)
@validate
async def get_raster(db:db_dependency,file: UploadFile = File(...)):
    """ return the raster temp id"""
    return RasterOperation().save_upload(file)

@router.get("/get_raster_detail",status_code=status.HTTP_201_CREATED)
async def get_raster(db:db_dependency,file_id: str):
    """ return the raster details"""
    return RasterOperation().get_raster_info(file_id)
