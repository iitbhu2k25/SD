
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
