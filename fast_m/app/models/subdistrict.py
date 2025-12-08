# app/models/subdistrict.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Subdistrict(Base):
    __tablename__ = "gwa_subdistrict"

    subdistrict_code = Column(Integer, primary_key=True, index=True)
    subdistrict_name = Column(String(40), nullable=False)
    district_code = Column(Integer, ForeignKey("gwa_district.district_code", ondelete="CASCADE"))

    district = relationship("District", backref="subdistricts")
