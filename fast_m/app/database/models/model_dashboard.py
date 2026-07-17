from sqlalchemy import String, Integer, Float, Text, DateTime, Numeric, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.base import Base


class DrainWaterQuality(Base):
    __tablename__ = "dashboard_drainwaterquality"

    location: Mapped[str] = mapped_column(String(150), nullable=False)
    ph: Mapped[float] = mapped_column(Float, nullable=False)
    temp: Mapped[float] = mapped_column(Float, nullable=False)
    ec_us_cm: Mapped[float] = mapped_column(Float, nullable=False)
    tds_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    do_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    turbidity: Mapped[float] = mapped_column(Float, nullable=False)
    tss_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    cod: Mapped[float] = mapped_column(Float, nullable=False)
    bod_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    ts_mg_l: Mapped[float] = mapped_column(Float, nullable=False)
    chloride: Mapped[float] = mapped_column(Float, nullable=False)
    nitrate: Mapped[float | None] = mapped_column(Float, nullable=True)
    faecal_col: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_col: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    stream: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    sampling_time: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, index=True)


class StoryMapStation(Base):
    __tablename__ = "dashboard_mapstory"

    id = None
    created_at = None
    modified_at = None

    station_id: Mapped[str] = mapped_column(String(50), primary_key=True, unique=True)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    other: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardDepth(Base):
    __tablename__ = "dashboard_depth"

    district: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    season: Mapped[str] = mapped_column(String(30), nullable=False)
    depth_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardRainfall(Base):
    __tablename__ = "dashboard_rainfall"

    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False, index=True)
    annual_rainfall: Mapped[float] = mapped_column(Numeric(15, 10), nullable=False)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardDistribution(Base):
    __tablename__ = "dashboard_distribution"

    year: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    percentage: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)


class DashboardIndustrialPollution(Base):
    __tablename__ = "dashboard_industrial_pollution"

    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    pollution_index: Mapped[str | None] = mapped_column(String(50), nullable=True)
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
