from sqlalchemy import Column, Integer, Float, String, BigInteger, Index
from app.database.models.base import Base


class SubbasinFlow(Base):
    __tablename__ = "subbasin_flow"

    sub = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    area_km2 = Column(Float, nullable=False)
    flow_in_cms = Column(Float, nullable=False)
    flow_out_cms = Column(Float, nullable=False)
    yyyyddd = Column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_subbasin_flow_sub", "sub"),
        Index("ix_subbasin_flow_year_month", "year", "month"),
    )

    def __repr__(self):
        return f"Sub {self.sub} - {self.year}-{self.month}"


class ClimateDrain(Base):
    __tablename__ = "climate_drain"

    sub = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    mon = Column(Integer, nullable=False)
    areakm2 = Column(Float, nullable=False)
    flow_incms = Column(Float, nullable=False)
    flow_outcms = Column(Float, nullable=False)
    yyyymm = Column(Integer, nullable=False)
    rch = Column(Integer, nullable=False)

    __table_args__ = (
        Index("ix_climate_drain_sub", "sub"),
        Index("ix_climate_drain_year_mon", "year", "mon"),
        Index("ix_climate_drain_yyyymm", "yyyymm"),
        Index("ix_climate_drain_rch", "rch"),
    )

    def __repr__(self):
        return f"Sub {self.sub} - {self.year}-{self.mon}"


class AdminFlow(Base):
    __tablename__ = "adminflow"

    vlcode = Column(BigInteger, nullable=False)
    village = Column(String(255), nullable=False)
    year = Column(Integer, nullable=False)
    mon = Column(Integer, nullable=False)
    surq_cnt_m3 = Column(Float, nullable=False)
    subdistrict_code_id = Column(Integer, nullable=True)

    def __repr__(self):
        return f"{self.village} ({self.vlcode}) - {self.year}-{self.mon}"


class ClimateAdmin(Base):
    __tablename__ = "climate_admin"

    vlcode = Column(BigInteger, nullable=False)
    village = Column(String(255), nullable=False)
    year = Column("YEAR", Integer, nullable=False)
    mon = Column("MON", Integer, nullable=False)
    surq_cnt_m3 = Column("SURQ_CNT_m3", Float, nullable=False)
    source_id = Column(Integer, nullable=False)
    subdistrict_code_id = Column(Integer, nullable=True)

    def __repr__(self):
        return f"{self.village} ({self.vlcode}) - {self.year}-{self.mon}"
