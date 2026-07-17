from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.api.schema.varuna_simulation_schema import (
    # ChatRequest,  # chatbot disabled for now
    # ChatResponse,  # chatbot disabled for now
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioOut,
    SimulateRequest,
    SimulateResponse,
    SnapshotRequest,
    SnapshotResponse,
)
# from app.api.service.varuna_simulation.varuna_chat_service import VarunaChatService  # chatbot disabled for now
from app.api.service.varuna_simulation.varuna_simulation_service import VarunaSimulationService
from app.database.config.dependency import db_dependency

router = APIRouter()


# ── Simulation (stateless) ────────────────────────────────────────────────────

@router.post("/snapshot", response_model=SnapshotResponse)
def compute_snapshot(payload: SnapshotRequest):
    return VarunaSimulationService().compute_snapshot(payload.params)


@router.post("/simulate", response_model=SimulateResponse)
def run_simulation(payload: SimulateRequest):
    return VarunaSimulationService().run_simulation(payload.params, payload.strategies, payload.years)


# ── Scenarios (persisted to the sewage_simulation table) ─────────────────────

@router.post("/scenarios", response_model=ScenarioOut)
def save_scenario(payload: ScenarioCreate, db: db_dependency):
    return VarunaSimulationService().save_scenario(db, payload)


@router.get("/scenarios", response_model=ScenarioListResponse)
def list_scenarios(db: db_dependency):
    return VarunaSimulationService().list_scenarios(db)


@router.get("/scenarios/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: int, db: db_dependency):
    return VarunaSimulationService().get_scenario(db, scenario_id)


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int, db: db_dependency):
    return VarunaSimulationService().delete_scenario(db, scenario_id)


@router.get("/scenarios/{scenario_id}/report")
def get_scenario_report(scenario_id: int, db: db_dependency):
    pdf_bytes = VarunaSimulationService().generate_report(db, scenario_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="varuna_scenario_{scenario_id}_report.pdf"'},
    )


# ── Chatbot (disabled for now) ────────────────────────────────────────────────

# @router.post("/chat", response_model=ChatResponse)
# def chat(payload: ChatRequest, db: db_dependency):
#     baseline_name = "Default Baseline"
#     if payload.scenario_context and payload.scenario_context.get("baseline_name"):
#         baseline_name = payload.scenario_context["baseline_name"]
#     return VarunaChatService().ask(db, payload.question, baseline_name=baseline_name)


# @router.post("/chat/upload")
# async def upload_document(db: db_dependency, file: UploadFile = File(...)):
#     content = await file.read()
#     if not content:
#         raise HTTPException(status_code=422, detail="Uploaded file is empty.")
#     chunks_added = VarunaChatService().upload_document(db, file.filename, content)
#     return {"filename": file.filename, "chunks_added": chunks_added}
