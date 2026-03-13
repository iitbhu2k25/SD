from fastapi import APIRouter, HTTPException, status
from app.api.schema.water_schema import StretchesOutput, DrainOutput, DrainInput, StretchesInput, WaterDrainLocationInput

from app.api.schema.water_schema import (
    WaterAdminLocationInput,
    WaterAdminLocationOutput,
)
from app.api.service.water.water_service import StretchLocation, WaterAvailabilityMapper
from app.database.config.dependency import db_dependency
router = APIRouter()



@router.post(
    "/process_water_raster",
    status_code=status.HTTP_201_CREATED,
    response_model=WaterAdminLocationOutput,
)
def process_water_raster(payload: WaterAdminLocationInput):
    try:

        mapper = WaterAvailabilityMapper()
        result = mapper.process_water_budget_map(
            subdistrict_codes=payload.subdistrict_codes,
            year=payload.year,
            product_type=payload.product_type,
            time_scale=payload.time_scale,
            season=payload.season,
        )

        return result

    except ValueError as e:
       
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    except Exception as e:
       
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process water raster: {str(e)}",
        )



@router.post("/get_stretch",response_model=StretchesOutput,status_code=status.HTTP_201_CREATED)
async def get_stretch(db:db_dependency,payload:StretchesInput):
    return StretchLocation.get_stretch(db,payload.river_code)

@router.post("/get_drain",response_model=DrainOutput,status_code=status.HTTP_201_CREATED)
async def get_drain(db:db_dependency,payload:DrainInput):
    return StretchLocation.get_drain(db,payload.stretch_id)




@router.post(
    "/process_drain_raster",
    status_code=status.HTTP_201_CREATED,
    response_model=WaterAdminLocationOutput, # Reuse output model if structure is same
)
def process_drain_raster(payload: WaterDrainLocationInput):
    try:
        mapper = WaterAvailabilityMapper()
        
        # Call the new Drain-specific method
        result = mapper.process_drain_budget_map(
            drain_no=payload.drain_no,
            year=payload.year,
            product_type=payload.product_type,
            time_scale=payload.time_scale,
            season=payload.season,
        )

        return result

    except ValueError as e:
        logger.error(f"Validation error in drain process: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    except Exception as e:
        logger.error(f"Processing error in drain process: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process drain raster: {str(e)}",
        )