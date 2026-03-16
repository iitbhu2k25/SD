from fastapi import APIRouter, HTTPException, status
from app.api.schema.water_schema import StretchesOutput, DrainOutput, DrainInput, StretchesInput, WaterDrainLocationInput
import logging

from app.api.schema.water_schema import (
    WaterAdminLocationInput,
    WaterAdminLocationOutput,
    Stp_response,
    Stp_Area,
    Stp_town_respons,
    Town_request,
    Village_request,
    District_request,
    Sub_district_request,
)
from app.api.service.water.water_service import StretchLocation, WaterAvailabilityMapper, Stp_location
from app.database.config.dependency import db_dependency
router = APIRouter()
logger = logging.getLogger(__name__)



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
    

@router.get("/get_states",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_states(db:db_dependency,user: bool = False,all_data: bool = False):
    return Stp_location.get_state(db,all_data)

@router.get("/all_districts",status_code=status.HTTP_201_CREATED)

async def get_districtss(db:db_dependency):
    return Stp_location.get_district_all(db)

@router.get("/all_sub_districts",status_code=status.HTTP_201_CREATED)

async def get_sub_districtss(db:db_dependency):
    return Stp_location.get_sub_district_all(db)

@router.get("/get_all_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)

async def get_towns(db:db_dependency):
    return Stp_location.get_all_town(db)

@router.post("/get_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_districts(db:db_dependency,payload:District_request,user: bool = False):
    return Stp_location.get_district(db,payload)


@router.post("/get_sub_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_sub_districts(db:db_dependency,payload:Sub_district_request,user: bool = False):
    return Stp_location.get_sub_district(db,payload)


@router.post("/get_villages",status_code=status.HTTP_201_CREATED)

async def get_villages(db:db_dependency,payload:Village_request,user: bool = False):
    return Stp_location.get_villages(db,payload)


@router.post("/get_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)

async def get_towns(db:db_dependency,payload:Town_request,user: bool = False):
    return Stp_location.get_town(db,payload)
