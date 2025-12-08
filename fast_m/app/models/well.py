# app/models/well.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Well(Base):
    __tablename__ = "gwa_well"

    id = Column(Integer, primary_key=True, index=True)
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

    # Time-series data: Pre/Post for 2011 to 2020
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
