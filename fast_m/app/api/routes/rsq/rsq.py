from fastapi import APIRouter

from app.api.schema.rsq.rsq_schema import (
    BlocksByDistrictRequest,
    VillagesByBlockRequest,
    QuantificationRequest,
)
from app.api.service.rsq.rsq_service import RsqService
from app.database.config.dependency import db_dependency

router = APIRouter()


@router.post("/getblocks")
def get_blocks(payload: BlocksByDistrictRequest, db: db_dependency):
    return RsqService(db).get_blocks_by_district(payload.districtcodes)


@router.post("/getvillages")
def get_villages(payload: VillagesByBlockRequest, db: db_dependency):
    return RsqService(db).get_villages_by_block(payload.blockcodes)


@router.post("/quantification")
def quantification(payload: QuantificationRequest, db: db_dependency):
    return RsqService(db).get_quantification_geojson(payload.year, payload.vlcodes)
