from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.crop import SeasonRequest
from app.services.crop_service import CropService
from app.core.database import get_db

router = APIRouter()


@router.post("/crops")
def get_crops_by_season(payload: SeasonRequest, db: Session = Depends(get_db)):

    # Validate season
    is_valid, error_msg = CropService.validate_season(payload.season)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid season",
                "message": error_msg
            }
        )

    try:
        return CropService.get_crops_by_season(db, payload.season)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Query failed",
                "message": str(e)
            }
        )
