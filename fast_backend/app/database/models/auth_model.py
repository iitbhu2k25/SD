from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy import String,Integer,ForeignKey,DateTime
from  app.database.models.base import Base
from typing import List
from datetime import datetime


class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(default=False,nullable=False)
    report: Mapped[List["Report"]] = relationship(back_populates="User")

class Report(Base):
    __tablename__='email_reports'
    user_id:Mapped[int]=mapped_column(ForeignKey("user.id"),nullable=False)
    User:Mapped["User"]=relationship(back_populates="report")
    file_name:Mapped[str]=mapped_column(String,nullable=False)
    file_path:Mapped[str]=mapped_column(String,nullable=False)
    send_time:Mapped[datetime]=mapped_column(DateTime,nullable=True)