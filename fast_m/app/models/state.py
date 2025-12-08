# app/models/state.py

from sqlalchemy import Column, Integer, String
from app.core.database import Base

class State(Base):
    __tablename__ = "gwa_state"

    state_code = Column(Integer, primary_key=True, index=True)
    state_name = Column(String(40), nullable=False)
