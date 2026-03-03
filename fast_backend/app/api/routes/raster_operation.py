from fastapi import APIRouter,status,UploadFile,File
from app.database.config.dependency import db_dependency
from app.utils.exception import validate
from app.api.schema.raster_operation import RasterReproject,RasterReclassify,Edliudian
from app.api.service.raster_work.raster_operation import RasterOperation
router=APIRouter()


@router.post("/post_raster",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency,file: UploadFile = File(...)):
    """ return the raster temp id"""
    return RasterOperation().save_upload(file)

@router.get("/get_raster_detail",status_code=status.HTTP_201_CREATED)
@validate
async def get_raster(db:db_dependency,file_id: str):
    """ return the raster details"""
    return RasterOperation().get_raster_info(file_id)

@router.post("/reprojection",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reproject(db:db_dependency,payload:RasterReproject):
    """ return the reprojected raster """
    return RasterOperation().reprojection(db,payload.file_id,payload.target_epsg,payload.resampling)

@router.post("/reclassify",status_code=status.HTTP_201_CREATED)
@validate
async def raster_reclassify(db:db_dependency,payload:RasterReclassify):
    """ return the  reclassified raster """
    return RasterOperation().reclassify(db,payload)


@router.post("/ecludian",status_code=status.HTTP_201_CREATED)
@validate
async def raster_ecludian(db:db_dependency,payload:Edliudian):
    """return the edliudian raster"""
    return RasterOperation().edludian(db,payload)

@router.post("/flow_direction",status_code=status.HTTP_201_CREATED)
@validate
async def flow_direction(db:db_dependency):
    pass


@router.post("/flow_acumulation",status_code=status.HTTP_201_CREATED)
@validate
async def flow_acumulation(db:db_dependency):
    pass

@router.post("/tpi",status_code=status.HTTP_201_CREATED)
@validate
async def tpi(db:db_dependency):
    pass

@router.post("/twi",status_code=status.HTTP_201_CREATED)
@validate
async def twi(db:db_dependency):
    pass

@router.post("/slope",status_code=status.HTTP_201_CREATED)
@validate
async def slope(db:db_dependency):
    pass

@router.post("/raster_resolution",status_code=status.HTTP_201_CREATED)
@validate
async def raster_resolution(db:db_dependency):
    pass
