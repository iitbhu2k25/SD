# app/database/crud/basic/basic.py
from typing import Any, overload
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models.basic.basic import (
    Basic_district,
    Basic_state,
    Basic_subdistrict,
    Basic_village,
    BasicRunoffCoefficient,
    Population_2011,
    PopulationCohort,
)


class BasicCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_states(self):
        return self.db.query(Basic_state).order_by(Basic_state.state_name).all()

    def get_districts(self, state_code: int):
        return (
            self.db.query(Basic_district)
            .filter(Basic_district.state_code == state_code)
            .order_by(Basic_district.district_name)
            .all()
        )

    def get_subdistricts(self, district_codes: list[int]):
        return (
            self.db.query(Basic_subdistrict)
            .filter(Basic_subdistrict.district_code.in_(district_codes))
            .order_by(Basic_subdistrict.subdistrict_name)
            .all()
        )

    def get_villages(self, subdistrict_codes: list[int]):
        return (
            self.db.query(Basic_village)
            .filter(Basic_village.subdistrict_code.in_(subdistrict_codes))
            .order_by(Basic_village.village_name)
            .all()
        )

    def get_village_subdistrict_map(self, village_codes: list[int]) -> dict[int, int]:
        rows = (
            self.db.query(Basic_village.village_code, Basic_village.subdistrict_code)
            .filter(Basic_village.village_code.in_(village_codes))
            .all()
        )
        return {int(row[0]): int(row[1]) for row in rows}

    def get_population_2011_by_subdistricts(self, subdistrict_codes: list[int]):
        if not subdistrict_codes:
            return []
        return (
            self.db.query(Population_2011)
            .filter(Population_2011.subdistrict_code.in_(subdistrict_codes))
            .all()
        )

    def get_cohort_by_filters(
        self,
        year: int,
        state_code: int | None,
        district_codes: list[int] | None,
        subdistrict_codes: list[int] | None,
        village_codes: list[int] | None,
    ):
        query = self.db.query(PopulationCohort).filter(PopulationCohort.year == year)
        if state_code is not None:
            query = query.filter(PopulationCohort.state_code == state_code)
        if district_codes:
            query = query.filter(PopulationCohort.district_code.in_(district_codes))
        if subdistrict_codes:
            query = query.filter(PopulationCohort.subdistrict_code.in_(subdistrict_codes))
        if village_codes:
            query = query.filter(PopulationCohort.village_code.in_(village_codes))
        return query.all()

    def get_village_with_hierarchy(self, village_code: int):
        return (
            self.db.query(
                Basic_village.village_code,
                Basic_village.subdistrict_code,
                Basic_subdistrict.district_code,
                Basic_district.state_code,
                Basic_village.population_2011,
            )
            .join(Basic_subdistrict, Basic_subdistrict.subdistrict_code == Basic_village.subdistrict_code)
            .join(Basic_district, Basic_district.district_code == Basic_subdistrict.district_code)
            .filter(Basic_village.village_code == village_code)
            .first()
        )

    def get_runoff_coefficient_by_duration(self, duration_minutes: int):
        return (
            self.db.query(BasicRunoffCoefficient)
            .filter(BasicRunoffCoefficient.duration_t_minutes == duration_minutes)
            .first()
        )

    def get_runoff_durations(self) -> list[int]:
        rows = (
            self.db.query(BasicRunoffCoefficient.duration_t_minutes)
            .distinct()
            .order_by(BasicRunoffCoefficient.duration_t_minutes)
            .all()
        )
        return [int(row[0]) for row in rows]

    def get_shape_attributes(self, shape_type: str) -> list[str]:
        table = BasicRunoffCoefficient.__table__
        names = [col.name for col in table.columns if col.name not in {"id", "created_at", "modified_at", "duration_t_minutes"}]
        prefix = "sector_" if shape_type.lower() == "sector" else "rectangle_"
        return [name for name in names if name.startswith(prefix)]

    def get_total_population_for_villages(self, village_codes: list[int]) -> dict[int, int]:
        if not village_codes:
            return {}
        rows = (
            self.db.query(Basic_village.village_code, Basic_village.population_2011)
            .filter(Basic_village.village_code.in_(village_codes))
            .all()
        )
        return {int(row[0]): int(row[1]) for row in rows}

    def count_population_cohort_year(self, year: int) -> int:
        return int(
            self.db.query(func.count(PopulationCohort.id))
            .filter(PopulationCohort.year == year)
            .scalar()
            or 0
        )
