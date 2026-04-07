from sqlalchemy import BigInteger, Float, String, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.base import Base


class GroundWaterData(Base):
    __tablename__ = "village_groundwater"

    created_at = None
    modified_at = None

    # Location Codes
    village_co: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    block_code: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    district_code: Mapped[float] = mapped_column(Float, nullable=True)
    subdistrict_code: Mapped[float] = mapped_column(Float, nullable=True)

    # Time
    year: Mapped[str] = mapped_column(String(10), nullable=False, index=True)

    # Area & Factor
    factor: Mapped[float] = mapped_column(Float, nullable=True)
    village_area: Mapped[float] = mapped_column(Float, nullable=True)
    block_area: Mapped[float] = mapped_column(Float, nullable=True)
    total_geographical_area: Mapped[float] = mapped_column(Float, nullable=True)
    recharge_worthy_area: Mapped[float] = mapped_column(Float, nullable=True)

    # Recharge (MON / NM)
    recharge_rainfall_mon: Mapped[float] = mapped_column(Float, nullable=True)
    recharge_other_mon: Mapped[float] = mapped_column(Float, nullable=True)
    recharge_rainfall_nm: Mapped[float] = mapped_column(Float, nullable=True)
    recharge_other_nm: Mapped[float] = mapped_column(Float, nullable=True)

    # Groundwater Balance
    total_annual_recharge: Mapped[float] = mapped_column(Float, nullable=True)
    total_natural_discharge: Mapped[float] = mapped_column(Float, nullable=True)
    extractable_resource: Mapped[float] = mapped_column(Float, nullable=True)

    # Usage
    irrigation_use: Mapped[float] = mapped_column(Float, nullable=True)
    industrial_use: Mapped[float] = mapped_column(Float, nullable=True)
    domestic_use: Mapped[float] = mapped_column(Float, nullable=True)
    total_extraction: Mapped[float] = mapped_column(Float, nullable=True)

    # Future Availability
    annual_gw_allocation_domestic: Mapped[float] = mapped_column(Float, nullable=True)
    net_future_availability: Mapped[float] = mapped_column(Float, nullable=True)

    # Status
    bo_aquifer: Mapped[float] = mapped_column(Float, nullable=True)
    stage_of_extraction: Mapped[str] = mapped_column(String(50), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_village_co_year", "village_co", "year"),
        Index("ix_block_code", "block_code"),
    )


class RsqVillage(Base):
    __tablename__ = "rsq_village"

    created_at = None
    modified_at = None

    blockcode: Mapped[int] = mapped_column(Integer, nullable=False)
    vlcode: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    village: Mapped[str] = mapped_column(String(255), nullable=False)


class RsqBlock(Base):
    __tablename__ = "rsq_block"

    created_at = None
    modified_at = None

    block: Mapped[str] = mapped_column(String(255), nullable=False)
    blockcode: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    district: Mapped[str] = mapped_column(String(255), nullable=False)
    districtcode: Mapped[int] = mapped_column(Integer, nullable=False)
