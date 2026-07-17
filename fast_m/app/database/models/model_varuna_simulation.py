from sqlalchemy import JSON, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.base import Base


class SewageSimulation(Base):
    __tablename__ = "sewage_simulation"

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    strategies: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    params: Mapped[dict] = mapped_column(JSON, nullable=False)
    rows: Mapped[list] = mapped_column(JSON, nullable=False)
    treatment_pct: Mapped[float] = mapped_column(Float, nullable=False)
    untreated: Mapped[float] = mapped_column(Float, nullable=False)
    capacity_deficit: Mapped[float] = mapped_column(Float, nullable=False)
