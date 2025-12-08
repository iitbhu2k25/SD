from sqlalchemy.orm import Session
from app.models.well import Well

def get_filtered_wells(db: Session, village_codes=None, subdis_codes=None):
    query = db.query(Well)

    # Handle both single and list values
    if village_codes:
        if isinstance(village_codes, int):
            village_codes = [village_codes]
        query = query.filter(Well.village_code.in_(village_codes))

    if subdis_codes:
        if isinstance(subdis_codes, int):
            subdis_codes = [subdis_codes]
        query = query.filter(Well.SUBDIS_COD.in_(subdis_codes))

    wells = query.all()

    # Sort by HYDROGRAPH (same as Django)
    wells.sort(key=lambda x: x.HYDROGRAPH or "")
    return wells
