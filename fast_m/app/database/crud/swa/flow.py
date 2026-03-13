from sqlalchemy.orm import Session

from app.database.models.swa.flow import AdminFlow, ClimateAdmin, ClimateDrain, SubbasinFlow


class SwaCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_distinct_subbasins(self) -> list[int]:
        rows = self.db.query(SubbasinFlow.sub).distinct().order_by(SubbasinFlow.sub).all()
        return [int(row[0]) for row in rows]

    def get_subbasin_flows(self, sub: int) -> list[float]:
        rows = self.db.query(SubbasinFlow.flow_out_cms).filter(SubbasinFlow.sub == sub).all()
        return [float(row[0]) for row in rows if row[0] is not None]

    def get_subbasin_timeseries(self, sub: int) -> list[SubbasinFlow]:
        return (
            self.db.query(SubbasinFlow)
            .filter(SubbasinFlow.sub == sub)
            .order_by(SubbasinFlow.year, SubbasinFlow.yyyyddd)
            .all()
        )

    def get_subbasin_monthly(self, sub: int) -> list[SubbasinFlow]:
        return (
            self.db.query(SubbasinFlow)
            .filter(SubbasinFlow.sub == sub)
            .order_by(SubbasinFlow.month)
            .all()
        )

    def get_climate_drain(self, sub: int, scenario: int, start_year: int, end_year: int) -> list[ClimateDrain]:
        return (
            self.db.query(ClimateDrain)
            .filter(
                ClimateDrain.sub == sub,
                ClimateDrain.rch == scenario,
                ClimateDrain.year >= start_year,
                ClimateDrain.year <= end_year,
            )
            .order_by(ClimateDrain.year, ClimateDrain.mon)
            .all()
        )

    def get_adminflow_by_subdistrict(self, subdistrict_code: int) -> list[AdminFlow]:
        return (
            self.db.query(AdminFlow)
            .filter(AdminFlow.subdistrict_code_id == subdistrict_code)
            .order_by(AdminFlow.year, AdminFlow.mon)
            .all()
        )

    def get_adminflow_by_vlcode(self, vlcode: int) -> list[AdminFlow]:
        return (
            self.db.query(AdminFlow)
            .filter(AdminFlow.vlcode == vlcode)
            .order_by(AdminFlow.year, AdminFlow.mon)
            .all()
        )

    def get_adminflow_by_subdistrict_codes(self, subdistrict_codes: list[int]) -> list[AdminFlow]:
        return (
            self.db.query(AdminFlow)
            .filter(AdminFlow.subdistrict_code_id.in_(subdistrict_codes))
            .all()
        )

    def get_adminflow_by_vlcodes(self, vlcodes: list[int]) -> list[AdminFlow]:
        return self.db.query(AdminFlow).filter(AdminFlow.vlcode.in_(vlcodes)).all()

    def get_climate_admin_by_subdistrict(
        self,
        subdistrict_code: int,
        source_id: int,
        start_year: int,
        end_year: int,
    ) -> list[ClimateAdmin]:
        return (
            self.db.query(ClimateAdmin)
            .filter(
                ClimateAdmin.subdistrict_code_id == subdistrict_code,
                ClimateAdmin.source_id == source_id,
                ClimateAdmin.year >= start_year,
                ClimateAdmin.year <= end_year,
            )
            .order_by(ClimateAdmin.vlcode, ClimateAdmin.year, ClimateAdmin.mon)
            .all()
        )

    def get_climate_admin_by_vlcode(
        self,
        vlcode: int,
        source_id: int,
        start_year: int,
        end_year: int,
    ) -> list[ClimateAdmin]:
        return (
            self.db.query(ClimateAdmin)
            .filter(
                ClimateAdmin.vlcode == vlcode,
                ClimateAdmin.source_id == source_id,
                ClimateAdmin.year >= start_year,
                ClimateAdmin.year <= end_year,
            )
            .order_by(ClimateAdmin.year, ClimateAdmin.mon)
            .all()
        )
