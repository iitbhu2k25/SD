from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Any
from app.core.database import get_db
from app.crud import well as crud_well
from app.schemas.well import Well as WellSchema

router = APIRouter()

@router.post("/wells", response_model=List[WellSchema])
async def get_wells(request: Request, db: Session = Depends(get_db)):
    
    data = await request.json()

    # Accept both raw list and object payloads for backward compatibility
    if isinstance(data, list):
        village_codes = data
        subdis_codes = []
    else:
        village_codes = data.get("village_code", [])
        subdis_codes = data.get("subdis_cod", [])

    # Validate input
    if not village_codes and not subdis_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="village_code or subdis_cod is required",
        )

    # Fetch wells
    wells = crud_well.get_filtered_wells(db, village_codes, subdis_codes)

    # Return same way as Django serializer (all columns)
    return wells
