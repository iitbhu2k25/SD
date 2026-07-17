import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.schema.varuna_simulation_schema import (
    ScenarioCreate,
    ScenarioOut,
    ScenarioSummary,
    ScenarioListResponse,
    SnapshotResponse,
    SimulateResponse,
    VarunaScenarioParams,
)
from app.api.service.varuna_simulation import varuna_engine, varuna_scenario_store as store
from app.api.service.varuna_simulation import varuna_report_generator

logger = logging.getLogger(__name__)


class VarunaSimulationService:
    # ── Snapshot & simulation (stateless compute, no persistence) ────────────

    def compute_snapshot(self, params: VarunaScenarioParams) -> SnapshotResponse:
        state = params.model_dump()
        snapshot = varuna_engine.compute_snapshot(state)
        return SnapshotResponse(**snapshot)

    def run_simulation(
        self, params: VarunaScenarioParams, strategies: list[str], years: int
    ) -> SimulateResponse:
        state = params.model_dump()
        state["strategies"] = strategies
        df = varuna_engine.run_simulation(state, strategies, years=years)
        return SimulateResponse(rows=df.to_dict(orient="records"))

    # ── Scenario persistence (sewage_simulation table) ────────────────────────

    def save_scenario(self, db: Session, payload: ScenarioCreate) -> ScenarioOut:
        state = payload.params.model_dump()
        state["strategies"] = payload.strategies
        df = varuna_engine.run_simulation(state, payload.strategies, years=payload.params.projection_years)
        snapshot = varuna_engine.compute_snapshot(state)

        if df.empty:
            raise HTTPException(status_code=422, detail="Simulation produced no rows for the given parameters.")

        last_row = df.iloc[-1]
        entry = store.create_scenario(
            db,
            name=payload.name,
            strategies=payload.strategies,
            params=state,
            rows=df.to_dict(orient="records"),
            treatment_pct=float(last_row.get("Treatment %", 0.0)),
            untreated=float(last_row.get("Untreated Load (MLD)", 0.0)),
            capacity_deficit=float(snapshot.get("capacity_deficit", 0.0)),
        )
        return ScenarioOut.model_validate(entry)

    def list_scenarios(self, db: Session) -> ScenarioListResponse:
        entries = store.list_scenarios(db)
        return ScenarioListResponse(
            scenarios=[
                ScenarioSummary(
                    id=e.id,
                    name=e.name,
                    strategies=e.strategies,
                    treatment_pct=e.treatment_pct,
                    untreated=e.untreated,
                    capacity_deficit=e.capacity_deficit,
                    created_at=e.created_at.isoformat(),
                )
                for e in entries
            ]
        )

    def get_scenario(self, db: Session, scenario_id: int) -> ScenarioOut:
        entry = store.get_scenario(db, scenario_id)
        if entry is None:
            raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
        return ScenarioOut.model_validate(entry)

    def delete_scenario(self, db: Session, scenario_id: int) -> dict:
        deleted = store.delete_scenario(db, scenario_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
        return {"status": "deleted", "id": scenario_id}

    def generate_report(self, db: Session, scenario_id: int) -> bytes:
        entry = store.get_scenario(db, scenario_id)
        if entry is None:
            raise HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")
        all_scenarios = store.list_scenarios(db)
        return varuna_report_generator.generate_pdf_report(entry, all_scenarios)
