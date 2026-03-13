from sqlalchemy import String, Integer, BigInteger, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.base import Base


class Basic_state(Base):
    __tablename__ = "basic_basic_state"

    id = None
    created_at = None
    modified_at = None

    state_code: Mapped[int] = mapped_column(Integer, primary_key=True)
    state_name: Mapped[str] = mapped_column(String(40), nullable=False)


class Basic_district(Base):
    __tablename__ = "basic_basic_district"

    id = None
    created_at = None
    modified_at = None

    district_code: Mapped[int] = mapped_column(Integer, primary_key=True)
    district_name: Mapped[str] = mapped_column(String(40), nullable=False)

    state_code: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("basic_basic_state.state_code", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


class Basic_subdistrict(Base):
    __tablename__ = "basic_basic_subdistrict"

    id = None
    created_at = None
    modified_at = None

    subdistrict_code: Mapped[int] = mapped_column(Integer, primary_key=True)
    subdistrict_name: Mapped[str] = mapped_column(String(40), nullable=False)

    district_code: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("basic_basic_district.district_code", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


class Basic_village(Base):
    __tablename__ = "basic_basic_village"

    id = None
    created_at = None
    modified_at = None

    village_code: Mapped[int] = mapped_column(Integer, primary_key=True)
    village_name: Mapped[str] = mapped_column(String(100), nullable=False)
    population_2011: Mapped[int] = mapped_column(Integer, nullable=False)

    subdistrict_code: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("basic_basic_subdistrict.subdistrict_code", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


class Population_2011(Base):
    __tablename__ = "basic_population_2011"

    id = None
    created_at = None
    modified_at = None

    subdistrict_code: Mapped[int] = mapped_column(Integer, primary_key=True)
    region_name: Mapped[str] = mapped_column(String(40), nullable=False)

    population_1951: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_1961: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_1971: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_1981: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_1991: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_2001: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_2011: Mapped[int] = mapped_column(BigInteger, nullable=False)


# ---- DJANGO AUTO ID TABLES ----
# DO NOT REMOVE id here because Django created it automatically

class PopulationCohort(Base):
    __tablename__ = "basic_populationcohort"

    created_at = None
    modified_at = None

    state_code: Mapped[int] = mapped_column(BigInteger, nullable=False)
    district_code: Mapped[int] = mapped_column(BigInteger, nullable=False)
    subdistrict_code: Mapped[int] = mapped_column(BigInteger, nullable=False)
    village_code: Mapped[int] = mapped_column(BigInteger, nullable=False)

    region_name: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    age_group: Mapped[str] = mapped_column(String(20), nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    population: Mapped[int] = mapped_column(BigInteger, nullable=False)


class BasicRunoffCoefficient(Base):
    __tablename__ = "basic_runoffcoefficient"

    created_at = None
    modified_at = None

    duration_t_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    sector_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    sector_60percent_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    sector_40percent_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    sector_pervious: Mapped[float] = mapped_column(Float, nullable=False)

    rectangle_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    rectangle_50percent_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    rectangle_30percent_impervious: Mapped[float] = mapped_column(Float, nullable=False)
    rectangle_pervious: Mapped[float] = mapped_column(Float, nullable=False)