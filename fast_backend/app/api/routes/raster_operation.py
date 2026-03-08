from fastapi import APIRouter,status,UploadFile,File,Header
from app.database.config.dependency import db_dependency
from app.utils.exception import validate
from app.api.schema.raster_operation import (
    RasterMetadataResponse,
    RasterReproject,
    RasterReclassify,
    Edliudian,
    FlowDirectionParams,
    FlowAccumulationParams,
    SlopeParams,
    TpiParams,
    TwiParams,
    Chunkcomplete,
    CellResize,
    RasterUploadResponse)
from app.api.service.raster_work.raster_operation import RasterOperation
router=APIRouter()


@router.post("/post_raster",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency,file: UploadFile = File(...)):
    """ return the raster temp id"""
    return await RasterOperation().save_upload(db,file)

@router.post("/upload_raster_chunk",status_code=status.HTTP_201_CREATED)
@validate
async def post_raster(db:db_dependency, file: UploadFile = File(...),
    upload_id: str = Header(...),
    chunk_index: int = Header(...),
):
    return await RasterOperation().chunk_upload(file,upload_id,chunk_index)   


@router.post("/upload/complete",status_code=status.HTTP_201_CREATED)
async def complete_upload(db:db_dependency,payload:Chunkcomplete):
    """
    Merge all chunks into final file.
    """
    return await RasterOperation().merge_chunks(payload.upload_id,payload.filename,payload.total_chunks)



@router.get("/raster/{file_id}/details",status_code=status.HTTP_201_CREATED,response_model=RasterMetadataResponse)
@validate
async def get_raster(db:db_dependency,file_id: str):
    """ return the raster details"""
    return await RasterOperation().make_raster_info(db,file_id)


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
async def flow_direction(db:db_dependency,payload:FlowDirectionParams):
    """return the flow direction raster"""
    return RasterOperation().flow_direction(db,payload)

@router.post("/flow_acumulation",status_code=status.HTTP_201_CREATED)
@validate
async def flow_acumulation(db:db_dependency,payload:FlowAccumulationParams):
    """return the flow accumulation raster"""
    return RasterOperation().flow_accumulation(db,payload)


@router.post("/tpi",status_code=status.HTTP_201_CREATED)
@validate
async def tpi(db:db_dependency,payload:TpiParams):
    """return the tpi raster"""
    return RasterOperation().tpi(db,payload)

@router.post("/twi",status_code=status.HTTP_201_CREATED)
@validate
async def twi(db:db_dependency,payload:TwiParams):
    """ return the twi raster"""
    return RasterOperation().twi(db,payload)

@router.post("/slope",status_code=status.HTTP_201_CREATED)
@validate
async def slope(db:db_dependency,payload:SlopeParams):
    """return the slope raster"""
    return RasterOperation().slope(db,payload)

@router.post("/raster_resolution",status_code=status.HTTP_201_CREATED)
@validate
async def raster_resolution(db:db_dependency,payload:CellResize):
    """ return the raster resolution dry run"""
    return RasterOperation().check_resolution(db,payload)

@router.post("/raster_resolution_execute",status_code=status.HTTP_201_CREATED)
@validate
async def raster_resolution(db:db_dependency,payload:CellResize):
    """ return the raster resolution """
    return RasterOperation().execute_resolution(db,payload)