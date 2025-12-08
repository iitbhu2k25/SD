# app/models/population2011.py
from sqlalchemy import Column, Integer, String, BigInteger
from app.core.database import Base

class Population2011(Base):
    __tablename__ = "gwa_population_2011"

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
