from sqlalchemy import Column, String, Float, Integer
from app.core.database import Base


class Crop(Base):
    __tablename__ = "gwa_crop"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    season = Column(String(100), nullable=False)
    crop = Column(String(100), nullable=False)
    stage = Column(String(100), nullable=False)
    period = Column(String(100), nullable=False)
    crop_factor = Column(Float, nullable=False)

    def __repr__(self):
        return f"<Crop(crop='{self.crop}')>"
