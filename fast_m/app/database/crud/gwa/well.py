from sqlalchemy.orm import Session
from app.database.models.gwa.well import Well

class WellCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_filtered_wells(self, village_codes: list[int], subdis_codes: list[int]):
        query = self.db.query(Well)

        if village_codes:
            query = query.filter(Well.village_code.in_(village_codes))

        if subdis_codes:
            query = query.filter(Well.SUBDIS_COD.in_(subdis_codes))

        return query.all()
