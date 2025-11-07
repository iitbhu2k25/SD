
from app.database.models.base import Base
from sqlalchemy.orm import Mapped,mapped_column, relationship
from sqlalchemy import Integer, String, Float,ForeignKey
from typing import List

class Groundwater_Zone_Visual_raster(Base):
    __tablename__='groundwater_zone_visual_raster'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    sld_path:Mapped[str]=mapped_column(String,nullable=False)

class Groundwater_Zone_raster(Base):
    __tablename__='groundwater_zone_raster'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    weight:Mapped[float]=mapped_column(Float,nullable=False)

class Groundwater_Identification(Base):
    __tablename__='groundwater_identification_raster'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    weight:Mapped[float]=mapped_column(Float,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    raster_category:Mapped[str]=mapped_column(String,nullable=False)

class Groundwater_Identification_visual_raster(Base):
    __tablename__='groundwater_Identification_visual'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    sld_path:Mapped[str]=mapped_column(String,nullable=False)
    raster_category:Mapped[str]=mapped_column(String,nullable=False)

class MAR_suitability_raster(Base):
    __tablename__='mar_suitability_raster'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    weight:Mapped[float]=mapped_column(Float,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    raster_category:Mapped[str]=mapped_column(String,nullable=False)


class MAR_suitability_visual_raster(Base):
    __tablename__='mar_suitability_visual_raster'
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    sld_path:Mapped[str]=mapped_column(String,nullable=False)
    raster_category:Mapped[str]=mapped_column(String,nullable=False)

class WaterQualityAssessment(Base):
    __tablename__='water_quality_assessment'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    Location:Mapped[str]=mapped_column(String,nullable=False)
    Longitude:Mapped[float]=mapped_column(Float,nullable=False)
    Latitude:Mapped[float]=mapped_column(Float,nullable=False)
    ph_level:Mapped[float]=mapped_column(Float,nullable=False)
    electrical_conductivity:Mapped[float]=mapped_column(Float,nullable=False)
    carbonate:Mapped[float]=mapped_column( Float,nullable=False)
    bicarbonate:Mapped[float]=mapped_column(Float,nullable=False)
    chloride:Mapped[float]=mapped_column(Float,nullable=False)
    fluoride:Mapped[float]=mapped_column(Float,nullable=False)
    sulfate:Mapped[float]=mapped_column(Float,nullable=False)
    nitrate:Mapped[float]=mapped_column(Float,nullable=False)
    phosphate:Mapped[float]=mapped_column(Float,nullable=False)
    Hardness:Mapped[float]=mapped_column(Float,nullable=False)
    calcium:Mapped[float]=mapped_column(Float,nullable=False)
    magnesium:Mapped[float]=mapped_column(Float,nullable=False)
    sodium:Mapped[float]=mapped_column(Float,nullable=False)
    potassium:Mapped[float]=mapped_column(Float,nullable=False)
    iron:Mapped[float]=mapped_column(Float,nullable=False)
    arsenic:Mapped[float]=mapped_column(Float,nullable=False)
    uranium:Mapped[float]=mapped_column(Float,nullable=False)
    village_code:Mapped[Integer]=mapped_column(Integer,nullable=False)
    subdis_code:Mapped[Integer]=mapped_column(Integer,nullable=False)
    year:Mapped[Integer]=mapped_column(Integer,nullable=False)