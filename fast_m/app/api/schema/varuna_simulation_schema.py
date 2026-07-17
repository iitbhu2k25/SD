# app/api/schema/varuna_simulation_schema.py
from typing import Any, Optional

from pydantic import BaseModel, Field


class VarunaScenarioParams(BaseModel):
    """Every tunable input for one scenario run — mirrors defaults.DEFAULTS."""

    # Population & sewage generation
    population: float = 2_644_440
    per_capita_sewage: float = 135.0

    # Discharge mode percentages (must sum to 100)
    pct_untapped_drains: float = 31.0
    pct_tapped_non_gravity: float = 32.0
    pct_tapped_gravity: float = 0.0
    pct_stp_gravity_sewer: float = 22.0
    pct_stp_non_gravity_sewer: float = 15.0
    pct_non_stp_sewer: float = 0.0
    pct_in_situ: float = 0.0

    # Annual growth rates (%) per discharge mode
    growth_untapped: float = 2.0
    growth_tapped_non_gravity: float = 2.0
    growth_tapped_gravity: float = 2.0
    growth_stp_gravity: float = 2.0
    growth_stp_non_gravity: float = 2.0
    growth_non_stp_sewer: float = 2.0
    growth_in_situ: float = 2.0

    # Infrastructure capacities (MLD)
    stp_capacity: float = 260.0
    pump_capacity: float = 140.0

    # Maintenance labels: "low (0.40)" | "medium (0.60)" | "high (>0.90)"
    # (kept for backward compatibility; superseded by the 3-factor fields below
    # when those are provided)
    maint_tapped: str = "low (0.40)"
    maint_stp: str = "high (>0.90)"
    maint_pump: str = "high (>0.90)"

    # Contextual maintenance — 3-factor breakdown (0/45/70/95), per infra category.
    # Each category = adequacy of monitoring, coordination between agencies,
    # availability of appropriate skill.
    maint_tapped_gravity_monitoring: float = 45.0
    maint_tapped_gravity_coordination: float = 45.0
    maint_tapped_gravity_skill: float = 70.0
    maint_tapped_nongravity_monitoring: float = 45.0
    maint_tapped_nongravity_coordination: float = 45.0
    maint_tapped_nongravity_skill: float = 70.0
    maint_stp_monitoring: float = 95.0
    maint_stp_coordination: float = 95.0
    maint_stp_skill: float = 70.0
    maint_pump_monitoring: float = 95.0
    maint_pump_coordination: float = 95.0
    maint_pump_skill: float = 70.0
    maint_sewer_gravity_monitoring: float = 95.0
    maint_sewer_gravity_coordination: float = 95.0
    maint_sewer_gravity_skill: float = 95.0
    maint_sewer_nongravity_monitoring: float = 95.0
    maint_sewer_nongravity_coordination: float = 95.0
    maint_sewer_nongravity_skill: float = 95.0

    # O&M costs (INR Crores / year) for current infrastructure
    om_tapped: float = 4.0
    om_stp: float = 28.47
    om_pump: float = 1.4
    om_sewer_network: float = 10.0

    # Strategy 1 — Treatment Capacity Augmentation
    planning_choice: int = 1  # 1 = Centralised, 2 = Decentralised
    num_stp_required: int = 0
    unit_stp_size: float = 0.0
    technology_choice: int = 5  # 1-11, see TECHNOLOGY_CHOICE_LABELS
    proposal_approval_time: float = 1.0
    approval_construction_time: float = 1.0
    underconstruction_time: float = 1.0
    budget_allocation_delay: float = 0.5
    land_acquisition_delay: float = 0.5
    operational_clearance_time: float = 0.5

    # Strategy 2 — Conveyance Augmentation
    drain_tap_gravity: float = 0.0
    drain_tap_gravity_time: float = 0.0
    drain_tap_nongravity: float = 0.0
    drain_tap_nongravity_time: float = 0.0
    additional_pumping: float = 0.0
    pumping_station_time: float = 0.0

    # Strategy 3 — Change Quality of Maintenance: per-category selection
    # (which infra categories the user has opted to change maintenance for)
    change_maint_stp: bool = False
    change_maint_pump: bool = False
    change_maint_tapped_nongravity: bool = False
    change_maint_tapped_gravity: bool = False
    change_maint_sewer_nongravity: bool = False
    change_maint_sewer_gravity: bool = False

    # Strategy 3 — Change Quality of Maintenance (targets)
    # Legacy combined labels (kept for backward compatibility)
    new_maint_tapped_ng: str = "low (0.4)"
    maint_time_tapped_ng: float = 0.0
    new_maint_tapped_g: str = "low (0.4)"
    maint_time_tapped_g: float = 0.0
    new_maint_pump: str = "high (>0.9)"
    maint_time_pump: float = 0.0
    new_maint_stp_dec: str = "high (>0.9)"
    maint_time_stp: float = 0.0

    # 3-factor target breakdown per infra category (0/45/70/95)
    new_maint_tapped_ng_monitoring: float = 45.0
    new_maint_tapped_ng_coordination: float = 45.0
    new_maint_tapped_ng_skill: float = 70.0
    new_maint_tapped_g_monitoring: float = 45.0
    new_maint_tapped_g_coordination: float = 45.0
    new_maint_tapped_g_skill: float = 70.0
    new_maint_pump_monitoring: float = 95.0
    new_maint_pump_coordination: float = 95.0
    new_maint_pump_skill: float = 70.0
    new_maint_stp_monitoring: float = 95.0
    new_maint_stp_coordination: float = 95.0
    new_maint_stp_skill: float = 70.0
    new_maint_sewer_gravity_monitoring: float = 95.0
    new_maint_sewer_gravity_coordination: float = 95.0
    new_maint_sewer_gravity_skill: float = 95.0
    maint_time_sewer_gravity: float = 0.0
    new_maint_sewer_nongravity_monitoring: float = 95.0
    new_maint_sewer_nongravity_coordination: float = 95.0
    new_maint_sewer_nongravity_skill: float = 95.0
    maint_time_sewer_nongravity: float = 0.0

    # Strategy 2 (cont'd) — Sewer Network conveyance (gravity + non-gravity)
    sewer_flow_untapped_gravity: float = 0.0
    sewer_flow_tapped_nongravity_gravity: float = 0.0
    sewer_flow_tapped_gravity_gravity: float = 0.0
    sewer_flow_insitu_gravity: float = 0.0
    sewer_flow_nonstp_gravity: float = 0.0
    sewer_time_gravity: float = 0.0

    sewer_flow_untapped_nongravity: float = 0.0
    sewer_flow_tapped_nongravity_nongravity: float = 0.0
    sewer_flow_tapped_gravity_nongravity: float = 0.0
    sewer_flow_insitu_nongravity: float = 0.0
    sewer_flow_nonstp_nongravity: float = 0.0
    sewer_time_nongravity: float = 0.0

    user_input_sewer_network_length: float = 0.0

    # Implementation costs (INR Cr. per unit MLD)
    stp_construction: float = 0.0
    stp_om_cost: float = 0.0
    tap_construction: float = 0.0
    tap_om_cost: float = 0.0
    pump_construction: float = 0.0
    pump_om_cost: float = 0.0
    sewer_network_construction_per_km: float = 0.4
    sewer_network_om_per_km: float = 0.0

    projection_years: int = 10
    strategies: list[str] = Field(default_factory=list)


class SnapshotRequest(BaseModel):
    params: VarunaScenarioParams


class SnapshotResponse(BaseModel):
    total_sewage: float
    capacity_deficit: float
    treatment_deficit: float
    untreated_untapped: float
    overflow_tapped: float
    flow_to_stp: float
    eff_stp: float
    actual_treated: float
    pumping_shortfall: float
    stp_overflow: float
    non_stp_sewer_flow: Optional[float] = None
    stp_installed_capacity: float = 0.0
    stp_unutilised_capacity: float = 0.0


class SimulateRequest(BaseModel):
    params: VarunaScenarioParams
    strategies: list[str] = Field(default_factory=list)
    years: int = 10


class SimulateResponse(BaseModel):
    rows: list[dict[str, Any]]


class ScenarioCreate(BaseModel):
    name: str
    params: VarunaScenarioParams
    strategies: list[str] = Field(default_factory=list)


class ScenarioOut(BaseModel):
    id: int
    name: str
    strategies: list[str]
    params: dict[str, Any]
    rows: list[dict[str, Any]]
    treatment_pct: float
    untreated: float
    capacity_deficit: float

    class Config:
        from_attributes = True


class ScenarioSummary(BaseModel):
    id: int
    name: str
    strategies: list[str]
    treatment_pct: float
    untreated: float
    capacity_deficit: float
    created_at: str


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioSummary]


# chatbot disabled for now
# class ChatRequest(BaseModel):
#     question: str
#     scenario_id: Optional[int] = None
#     scenario_context: Optional[dict[str, Any]] = None


# class ChatSource(BaseModel):
#     source: str
#     snippet: str


# class ChatResponse(BaseModel):
#     answer: str
#     sources: list[ChatSource] = Field(default_factory=list)
