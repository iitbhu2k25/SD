from sqlalchemy.orm import Session

from app.database.models.rsq.rsq import GroundWaterData, RsqBlock, RsqVillage


class RsqCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_blocks_by_district(self, districtcodes: list[int]) -> list[RsqBlock]:
        return (
            self.db.query(RsqBlock)
            .filter(RsqBlock.districtcode.in_(districtcodes))
            .all()
        )

    def get_villages_by_block(self, blockcodes: list[int]) -> list[RsqVillage]:
        return (
            self.db.query(RsqVillage)
            .filter(RsqVillage.blockcode.in_(blockcodes))
            .all()
        )

    def get_groundwater_data(
        self, year: str, village_codes: list[int]
    ) -> list[GroundWaterData]:
        return (
            self.db.query(GroundWaterData)
            .filter(
                GroundWaterData.year == year,
                GroundWaterData.village_co.in_(village_codes),
            )
            .all()
        )
