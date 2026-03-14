from sqlalchemy.orm import Mapped,mapped_column
from app.database.models.base import Base
from sqlalchemy import Integer, ForeignKey


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