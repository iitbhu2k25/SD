"""
varuna_scenario_store.py — database-backed persistence for saved Varuna
scenarios (table: sewage_simulation).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.database.models.model_varuna_simulation import SewageSimulation


def create_scenario(db: Session, name: str, strategies: list[str], params: dict[str, Any],
                     rows: list[dict[str, Any]], treatment_pct: float,
                     untreated: float, capacity_deficit: float) -> SewageSimulation:
    existing = db.query(SewageSimulation).filter(SewageSimulation.name == name).first()
    if existing:
        existing.strategies = strategies
        existing.params = params
        existing.rows = rows
        existing.treatment_pct = treatment_pct
        existing.untreated = untreated
        existing.capacity_deficit = capacity_deficit
        db.commit()
        db.refresh(existing)
        return existing

    entry = SewageSimulation(
        name=name,
        strategies=strategies,
        params=params,
        rows=rows,
        treatment_pct=treatment_pct,
        untreated=untreated,
        capacity_deficit=capacity_deficit,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def list_scenarios(db: Session) -> list[SewageSimulation]:
    return db.query(SewageSimulation).order_by(SewageSimulation.created_at.desc()).all()


def get_scenario(db: Session, scenario_id: int) -> SewageSimulation | None:
    return db.query(SewageSimulation).filter(SewageSimulation.id == scenario_id).first()


def get_scenario_by_name(db: Session, name: str) -> SewageSimulation | None:
    return db.query(SewageSimulation).filter(SewageSimulation.name == name).first()


def delete_scenario(db: Session, scenario_id: int) -> bool:
    entry = db.query(SewageSimulation).filter(SewageSimulation.id == scenario_id).first()
    if entry is None:
        return False
    db.delete(entry)
    db.commit()
    return True


def count_scenarios(db: Session) -> int:
    return db.query(SewageSimulation).count()
