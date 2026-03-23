from sqlalchemy.orm import Mapped,mapped_column
from sqlalchemy import Integer, String
from app.database.models.base import Base


class Rainwater_raster(Base):
    __tablename__='rainwater_raster'
    layer_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    layer_month:Mapped[int]=mapped_column(Integer,nullable=False)
    layer_class:Mapped[str]=mapped_column(String,nullable=False)
    sld_path:Mapped[str]=mapped_column(String,nullable=False)