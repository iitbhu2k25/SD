# app/database/models/well.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from app.database.models.base import Base

class Well(Base):
    __tablename__ = "gwa_well"

    village_code = Column(Integer, ForeignKey("gwa_village.village_code", ondelete="CASCADE"), nullable=False)

    FID_clip = Column(Integer, unique=True)
    OBJECTID = Column(Integer)
    shapeName = Column(String(100))
    SUB_DISTRI = Column(String(100))
    DISTRICT_C = Column(Integer)
    DISTRICT = Column(String(100))
    STATE_CODE = Column(Integer)
    STATE = Column(String(100))
    population = Column(Integer)
    SUBDIS_COD = Column(Integer)
    Area = Column(Float)
    DISTRICT_1 = Column(String(100))
    BLOCK = Column(String(100))
    HYDROGRAPH = Column(String(100))
    LONGITUDE = Column(Float)
    LATITUDE = Column(Float)
    RL = Column(Float)

    PRE_2011 = Column(Float)
    POST_2011 = Column(Float)
    PRE_2012 = Column(Float)
    POST_2012 = Column(Float)
    PRE_2013 = Column(Float)
    POST_2013 = Column(Float)
    PRE_2014 = Column(Float)
    POST_2014 = Column(Float)
    PRE_2015 = Column(Float)
    POST_2015 = Column(Float)
    PRE_2016 = Column(Float)
    POST_2016 = Column(Float)
    PRE_2017 = Column(Float)
    POST_2017 = Column(Float)
    PRE_2018 = Column(Float)
    POST_2018 = Column(Float)
    PRE_2019 = Column(Float)
    POST_2019 = Column(Float)
    PRE_2020 = Column(Float)
    POST_2020 = Column(Float)

    village = relationship("Village", backref="wells")




class Village(Base):
    __tablename__ = "gwa_village"
    id = None
    village_code = Column(Integer, primary_key=True, index=True)
    village_name = Column(String(100), nullable=False)
    population_2011 = Column(Integer, nullable=False)
    subdistrict_code = Column(Integer, ForeignKey("gwa_subdistrict.subdistrict_code", ondelete="CASCADE"))

    subdistrict = relationship("Subdistrict", backref="villages")


class Subdistrict(Base):
    __tablename__ = "gwa_subdistrict"
    id = None
    subdistrict_code = Column(Integer, primary_key=True, index=True)
    subdistrict_name = Column(String(40), nullable=False)
    district_code = Column(Integer, ForeignKey("gwa_district.district_code", ondelete="CASCADE"))

    district = relationship("District", backref="subdistricts")


class District(Base):
    __tablename__ = "gwa_district"
    id =  None
    district_code = Column(Integer, primary_key=True, index=True)
    district_name = Column(String(40), nullable=False)
    state_code = Column(Integer, ForeignKey("gwa_state.state_code", ondelete="CASCADE"))

    state = relationship("State", backref="districts")


class State(Base):
    __tablename__ = "gwa_state"
    id = None
    state_code = Column(Integer, primary_key=True, index=True)
    state_name = Column(String(40), nullable=False)


class Population2011(Base):
    __tablename__ = "gwa_population_2011"
    id = None
    # SAME AS DJANGO (no foreign key, only integer primary key)
    subdistrict_code = Column(Integer, primary_key=True, index=True)

    region_name = Column(String(40), nullable=False)
    population_1951 = Column(BigInteger, nullable=False)
    population_1961 = Column(BigInteger, nullable=False)
    population_1971 = Column(BigInteger, nullable=False)
    population_1981 = Column(BigInteger, nullable=False)
    population_1991 = Column(BigInteger, nullable=False)
    population_2001 = Column(BigInteger, nullable=False)
    population_2011 = Column(BigInteger, nullable=False)

    def __repr__(self):
        return (
            f"<Population2011(subdistrict_code={self.subdistrict_code}, "
            f"region_name='{self.region_name}', "
            f"population_1951={self.population_1951}, population_1961={self.population_1961}, "
            f"population_1971={self.population_1971}, population_1981={self.population_1981}, "
            f"population_1991={self.population_1991}, population_2001={self.population_2001}, "
            f"population_2011={self.population_2011})>"
        )


class Crop(Base):
    __tablename__ = "gwa_crop"
    


    season = Column(String(100), nullable=False)
    crop = Column(String(100), nullable=False)
    stage = Column(String(100), nullable=False)
    period = Column(String(100), nullable=False)
    crop_factor = Column(Float, nullable=False)

    def __repr__(self):
        return f"<Crop(crop='{self.crop}')>"