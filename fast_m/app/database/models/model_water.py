from sqlalchemy.orm import Mapped,mapped_column, relationship
from app.database.models.base import Base
from sqlalchemy import Integer, String, Float,ForeignKey,Text
from typing import List
####






class WaterState(Base):
    __tablename__ = "stp_state"

    state_code: Mapped[int] = mapped_column(Integer, primary_key=True,unique=True, nullable=False)
    state_name: Mapped[str] = mapped_column(String, nullable=False)
    districts: Mapped[List["WaterDistrict"]] = relationship(back_populates="state")

class WaterDistrict(Base):
    __tablename__ = "stp_district"

    district_code: Mapped[int] = mapped_column(Integer, primary_key=True,unique=True,  nullable=False)
    district_name: Mapped[str] = mapped_column(String, nullable=False)
    state_code: Mapped[int] = mapped_column(ForeignKey("stp_state.state_code"), nullable=False)
    state: Mapped["WaterState"] = relationship(back_populates="districts")
    subdistricts: Mapped[List["WaterSubDistrict"]] = relationship(back_populates="district")

class WaterSubDistrict(Base):
    __tablename__ = "stp_subdistrict"

    subdistrict_code: Mapped[int] = mapped_column(Integer, primary_key=True,unique=True,  nullable=False)
    subdistrict_name: Mapped[str] = mapped_column(String, nullable=False)
    district_code: Mapped[int] = mapped_column(ForeignKey("stp_district.district_code"), nullable=False)
    district: Mapped["WaterDistrict"] = relationship(back_populates="subdistricts")
    towns:Mapped[List["WaterTowns"]]= relationship(back_populates='subdistrict')
    villages:Mapped[List["WaterSTP_villages"]]= relationship(back_populates='Subdistrict_Vill')

class WaterSTP_villages(Base):
    __tablename__="stp_villages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, unique=True, nullable=False)
    village_name:Mapped[str] = mapped_column(String, nullable=False)
    subdistrict_code: Mapped[int] = mapped_column(ForeignKey("stp_subdistrict.subdistrict_code"), nullable=False)
    Subdistrict_Vill: Mapped["WaterSubDistrict"] = relationship(back_populates="villages")

class WaterTowns(Base):
    __tablename__ = "stp_towns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    classs : Mapped[int] = mapped_column(Integer,  nullable=False)
    population: Mapped[int] = mapped_column(Integer, nullable=False)
    elevation: Mapped[float] = mapped_column(Float, nullable=False)
    subdistrict_code: Mapped[int] = mapped_column(ForeignKey("stp_subdistrict.subdistrict_code"), nullable=False)
    subdistrict: Mapped["WaterSubDistrict"] = relationship(back_populates="towns")


class Stretches(Base):
    __tablename__ = "WA_stretches"    
    
    # 1. Override 'id' to None so SQLAlchemy ignores the inherited column
    id = None 
    
    # 2. Mark Stretch_ID as the primary key for SQLAlchemy mapping
    Stretch_ID: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    River_Code: Mapped[int] = mapped_column(Integer, nullable=False)
    GRID_CODE: Mapped[int] = mapped_column(Integer, nullable=False)

class Drain(Base):
    __tablename__ = "WA_drain"

    # 1. Override 'id' to prevent SQLAlchemy from looking for a non-existent column
    id = None
    
    # 2. Map the actual columns
    River_Code: Mapped[int] = mapped_column(Integer, nullable=False)
    Drain_No: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    Stretch_ID: Mapped[int] = mapped_column(ForeignKey("WA_stretches.Stretch_ID"),primary_key=True, nullable=False)