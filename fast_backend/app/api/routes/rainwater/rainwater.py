from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.database.config.dependency import db_dependency
from fastapi import HTTPException,status
from app.api.schema.rainwater import GeoJSONInput, Rainwater 
from app.database.crud.rainwater_crud import rainwater_crud
from app.api.service.rainwater.rainwater_service import RainwaterMapper
from app.api.service.rainwater.modeled_water import ModelWater
router=APIRouter()

@router.get("/modeled_water",status_code=201)
def getModelWater():
    data=ModelWater.get_data()
    return JSONResponse(content={"data":data},status_code=201)

@router.post("/rainwater_raster",status_code=status.HTTP_200_OK)
def rainwater_raster(db:db_dependency,data:Rainwater):
    obj=rainwater_crud(db).get_raster(user_data=data)
    if not obj:
        raise HTTPException(status_code=404, detail="No raster data found for the specified criteria")
    
    raster_path = obj[0].file_path
    
    response= RainwaterMapper().rasterclip_tif(db,data.district_id,data.subdistrict_id,raster_path,output_dir="temp")
    return response

@router.post("/polygon_rainfall", status_code=status.HTTP_200_OK)
def polygon_rainfall(db: db_dependency, payload: GeoJSONInput):
    
    if not hasattr(payload, 'layer_class'):
        raise HTTPException(status_code=400, detail="layer_class is required")
    
    month_int = None
    if payload.month is not None:
        try:
            month_int = int(payload.month)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="month must be an integer string (1-12)")
        
  
    rainwater_data = Rainwater(
        layer_class=payload.layer_class,
        district_id=0,  # Not used for polygon, set to default
        subdistrict_id=[0],  # Not used for polygon, set to default
        month=str(month_int) if month_int is not None else "0" 
    )
    
 
    obj = rainwater_crud(db).get_raster(user_data=rainwater_data)
    if not obj:
        raise HTTPException(status_code=404, detail="Raster file not found for given layer_class and layer_month")
    
    raster_path = obj[0].file_path
    
  
    response = RainwaterMapper().calculate_manual_rainfall(
        coordinates=payload.coordinates,
        db=db,
        raster_path=raster_path,
        layer_class=payload.layer_class,
        month=month_int
    )
    return response