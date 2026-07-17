"""
varuna_engine.py — Calculation engine bridging scenario inputs into the
System Dynamics differential simulation core (ported from the Varuna
River Simulation Streamlit app's model.py).
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd

try:
    import pysd
    from app.api.service.varuna_simulation import component as sd_engine
except ModuleNotFoundError:
    pysd = None
    sd_engine = None

class _ModelTime:
    """Minimal time adapter expected by the generated PySD model."""

    def __init__(self, current: float = 0.0):
        self.current = float(current)

    def __call__(self) -> float:
        return self.current

    def initial_time(self) -> float:
        return 0.0

    def final_time(self) -> float:
        return 3650.0

    def time_step(self) -> float:
        return 1.0

    def saveper(self) -> float:
        return self.time_step()


_DISCHARGE_KEY_INDEX = {
    "pct_untapped_drains": 0,
    "pct_tapped_non_gravity": 1,
    "pct_tapped_gravity": 2,
    "pct_stp_gravity_sewer": 3,
    "pct_stp_non_gravity_sewer": 4,
    "pct_non_stp_sewer": 5,
    "pct_in_situ": 6,
}

_COMPONENT_PATH = Path(__file__).with_name("component.py")
_PYSD_MODEL = None


def _get_state_value(state: dict, primary_key: str, default: float, aliases: tuple[str, ...] = ()) -> float:
    """Return a numeric value from the current state, supporting legacy key names."""
    for key in (primary_key, *aliases):
        if key in state:
            return float(state[key])
    return float(default)


def _get_discharge_value(state: dict, key: str, default: float) -> float:
    """Prefer the UI's discharge_pct array, then fall back to named keys."""
    index = _DISCHARGE_KEY_INDEX[key]
    discharge_pct = state.get("discharge_pct")
    if isinstance(discharge_pct, (list, tuple)) and len(discharge_pct) > index:
        return float(discharge_pct[index])
    return float(state.get(key, default))


def _get_pysd_model():
    """Lazy-load the translated PySD model so scenario runs use the real SD equations."""
    if pysd is None:
        raise RuntimeError("PySD is not installed; using the formula fallback.")

    global _PYSD_MODEL
    if _PYSD_MODEL is None:
        _PYSD_MODEL = pysd.load(str(_COMPONENT_PATH))
    return _PYSD_MODEL


def _get_maint_factor(value: object, default: float = 0.90) -> float:
    """Normalize UI maintenance labels and numeric values to model factors."""
    if isinstance(value, (int, float)):
        return float(value)

    mapping = {
        "low (0.40)": 0.40,
        "low (0.4)": 0.40,
        "low": 0.40,
        "medium (0.60)": 0.60,
        "medium (0.6)": 0.60,
        "medium": 0.60,
        "high (>0.90)": 0.90,
        "high (>0.9)": 0.90,
        "high": 0.90,
    }
    return mapping.get(str(value).strip().lower(), default)


def _get_tapped_screen_factor(value: object) -> float:
    """
    Map the UI's tapped-network maintenance setting to the baseline screen condition
    used by the generated system dynamics model.
    """
    if isinstance(value, (int, float)):
        numeric = float(value)
        if abs(numeric - 0.40) < 0.01:
            return 0.45
        return numeric

    mapping = {
        "low (0.40)": 0.45,
        "low (0.4)": 0.45,
        "low": 0.45,
        "medium (0.60)": 0.60,
        "medium (0.6)": 0.60,
        "medium": 0.60,
        "high (>0.90)": 0.90,
        "high (>0.9)": 0.90,
        "high": 0.90,
    }
    return mapping.get(str(value).strip().lower(), 0.45)


def _maintenance_triplet(value: object) -> tuple[float, float, float]:
    """Map UI maintenance labels to the SD model's oversight/coordination/skill inputs."""
    key = str(value).strip().lower()
    mapping = {
        "low (0.40)": (45.0, 45.0, 70.0),
        "low (0.4)": (45.0, 45.0, 70.0),
        "low": (45.0, 45.0, 70.0),
        "medium (0.60)": (70.0, 70.0, 70.0),
        "medium (0.6)": (70.0, 70.0, 70.0),
        "medium": (70.0, 70.0, 70.0),
        "high (>0.90)": (95.0, 95.0, 70.0),
        "high (>0.9)": (95.0, 95.0, 70.0),
        "high": (95.0, 95.0, 70.0),
    }
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric <= 0.45:
            return (45.0, 45.0, 70.0)
        if numeric <= 0.7:
            return (70.0, 70.0, 70.0)
        return (95.0, 95.0, 70.0)
    return mapping.get(key, (95.0, 95.0, 70.0))


def _compute_flow_snapshot(total_sewage: float, params: dict, stp_capacity: float | None = None) -> dict:
    """Shared baseline flow balance for cards and fallback simulation outputs."""
    untapped_flow = total_sewage * _get_discharge_value(params, "pct_untapped_drains", 31.0) / 100
    tapped_ng = total_sewage * _get_discharge_value(params, "pct_tapped_non_gravity", 32.0) / 100
    tapped_g = total_sewage * _get_discharge_value(params, "pct_tapped_gravity", 0.0) / 100
    stp_g = total_sewage * _get_discharge_value(params, "pct_stp_gravity_sewer", 22.0) / 100
    stp_ng = total_sewage * _get_discharge_value(params, "pct_stp_non_gravity_sewer", 15.0) / 100
    non_stp_sewer = total_sewage * _get_discharge_value(params, "pct_non_stp_sewer", 0.0) / 100

    tapped_ng_condition = _get_tapped_screen_factor(params.get("maint_tapped", 0.40))
    tapped_g_condition = 1.0

    installed_stp = _get_state_value(params, "stp_capacity", 260.0) if stp_capacity is None else float(stp_capacity)
    eff_stp = installed_stp
    eff_pump = _get_state_value(params, "pump_capacity", 140.0, aliases=("pumping_capacity",))

    tapped_ng_after_screen = tapped_ng * tapped_ng_condition
    tapped_g_after_screen = tapped_g * tapped_g_condition
    drain_overflow = (tapped_ng - tapped_ng_after_screen) + (tapped_g - tapped_g_after_screen)

    pump_demand = tapped_ng_after_screen + stp_ng
    pump_overflow = max(0.0, pump_demand - eff_pump)
    pumped_to_stp = min(pump_demand, eff_pump)

    stp_inflow = stp_g + tapped_g_after_screen + pumped_to_stp
    actual_treated = min(eff_stp, stp_inflow)
    stp_overflow = max(0.0, stp_inflow - eff_stp)

    treatment_deficit = untapped_flow + drain_overflow + pump_overflow + non_stp_sewer + stp_overflow
    cap_deficit = max(0.0, total_sewage - installed_stp)

    return {
        "capacity_deficit": round(cap_deficit, 2),
        "treatment_deficit": round(treatment_deficit, 2),
        "untreated_untapped": round(untapped_flow, 2),
        "overflow_tapped": round(drain_overflow, 2),
        "flow_to_stp": round(stp_inflow, 2),
        "eff_stp": round(eff_stp, 2),
        "actual_treated": round(actual_treated, 2),
        "pumping_shortfall": round(pump_overflow, 2),
        "stp_overflow": round(stp_overflow, 2),
        "non_stp_sewer_flow": round(non_stp_sewer, 2),
    }


def _initialize_statefuls() -> None:
    """Reset every PySD stateful object so repeated scenario runs are deterministic."""
    if sd_engine is None:
        return

    for name in dir(sd_engine):
        obj = getattr(sd_engine, name)
        if hasattr(obj, "initialize") and type(obj).__name__ in {"Integ", "DelayFixed", "Initial"}:
            obj.initialize()


def _fallback_run_simulation(state: dict, strategies: list[str], years: int = 10) -> pd.DataFrame:
    """Graceful non-PySD fallback used when the generated model cannot initialize."""
    time_points = np.arange(0, (years * 365) + 1, 30)
    records = []

    base_om = (
        _get_state_value(state, "om_tapped", 0.0)
        + _get_state_value(state, "om_stp", 0.0)
        + _get_state_value(state, "om_pump", 0.0, aliases=("om_pumps",))
    )

    for d in time_points:
        year_offset = d / 365
        population_t = float(state.get("population", 2644440)) * (1 + 0.02) ** year_offset
        sewage_mld = population_t * float(state.get("per_capita_sewage", 135.0)) / 1_000_000

        extra_stp = 0.0
        if "Treatment Capacity Augmentation" in strategies and year_offset >= 2:
            extra_stp = min(year_offset * 20, 200)

        snap = _compute_flow_snapshot(
            sewage_mld,
            state,
            stp_capacity=_get_state_value(state, "stp_capacity", 260.0) + extra_stp,
        )
        treated_mld = snap["actual_treated"]
        untreated_mld = snap["treatment_deficit"]

        capital_cost = extra_stp * _get_state_value(state, "stp_construction", 0.0, aliases=("cost_stp_construction",))
        om_cost = base_om * year_offset

        records.append({
            "Year": int(2025 + (d // 365)),
            "Day": int(d),
            "Total Sewage (MLD)": round(sewage_mld, 2),
            "Treated (MLD)": round(treated_mld, 2),
            "Untreated Load (MLD)": round(untreated_mld, 2),
            "Treatment %": round((treated_mld / max(1.0, sewage_mld)) * 100, 1),
            "Treated Sewage Discharge to River (MLD)": round(treated_mld, 2),
            "Untreated From Untapped Drains (MLD)": snap["untreated_untapped"],
            "Tapped Drain Overflow (Non-Gravity) (MLD)": snap["overflow_tapped"],
            "Tapped Drain Overflow (Gravity) (MLD)": 0.0,
            "Tapped Drain Overflow Total (MLD)": snap["overflow_tapped"],
            "STP Overflow (MLD)": snap["stp_overflow"],
            "Pumping Station Overflow (MLD)": snap["pumping_shortfall"],
            "PS to STP (MLD)": round(max(0.0, snap["flow_to_stp"] - sewage_mld * _get_discharge_value(state, "pct_stp_gravity_sewer", 22.0) / 100), 2),
            "Conveyance to Drains (MLD)": round(
                sewage_mld
                * (
                    _get_discharge_value(state, "pct_untapped_drains", 31.0)
                    + _get_discharge_value(state, "pct_tapped_non_gravity", 32.0)
                    + _get_discharge_value(state, "pct_tapped_gravity", 0.0)
                )
                / 100,
                2,
            ),
            "Conveyance Through Tapped Drain (MLD)": round(
                sewage_mld
                * (
                    _get_discharge_value(state, "pct_tapped_non_gravity", 32.0)
                    + _get_discharge_value(state, "pct_tapped_gravity", 0.0)
                )
                / 100,
                2,
            ),
            "Conveyance to Sewer Network (MLD)": round(
                sewage_mld
                * (
                    _get_discharge_value(state, "pct_stp_gravity_sewer", 22.0)
                    + _get_discharge_value(state, "pct_stp_non_gravity_sewer", 15.0)
                )
                / 100,
                2,
            ),
            "Sewer Network to PS (MLD)": round(sewage_mld * _get_discharge_value(state, "pct_stp_non_gravity_sewer", 15.0) / 100, 2),
            "Leakages from Sewer Network to GW (MLD)": 0.0,
            "Non-STP Sewer Discharge to River (MLD)": snap["non_stp_sewer_flow"],
            "Untreated Sewage From GW to River (MLD)": 0.0,
            "STP Effective Capacity (MLD)": snap["eff_stp"],
            "STP Installed Capacity (MLD)": round(_get_state_value(state, "stp_capacity", 260.0) + extra_stp, 2),
            "Condition of Tapped Drain (%)": round(_get_tapped_screen_factor(state.get("maint_tapped", 0.40)) * 100, 2),
            "Condition of Sewer Network (%)": 100.0,
            "Ratio Tapped Drain to STP": round((sewage_mld - untreated_mld) / max(1.0, sewage_mld), 4),
            "BOD in Untreated Sewage": 45.0,
            "BOD in Treated Sewage": 12.88,
            "BOD of River": round((45.0 * untreated_mld + 12.88 * treated_mld) / max(1.0, sewage_mld), 2),
            "Maintenance Cost of Tapped Drains (Cr)": round(_get_state_value(state, "om_tapped", 0.0) * year_offset, 2),
            "Maintenance Cost of Pumps (Cr)": round(_get_state_value(state, "om_pump", 0.0, aliases=("om_pumps",)) * year_offset, 2),
            "Maintenance Cost of STP (Cr)": round(_get_state_value(state, "om_stp", 0.0) * year_offset, 2),
            "Capital Cost (Cr)": round(capital_cost, 2),
            "OM Cost (Cr)": round(om_cost, 2),
        })

    return pd.DataFrame(records)


def _bind_sd_state(state: dict) -> None:
    """Bind the current UI state into the PySD runtime before sampling outputs."""
    if sd_engine is None:
        raise RuntimeError("PySD component module is unavailable.")

    sd_engine._init_outer_references({"time": _ModelTime(0.0)})

    sd_engine.total_population_at_tzero = lambda: _get_state_value(state, "population", 2644440)
    sd_engine.per_capita_sewage_generationlpcd = lambda: _get_state_value(state, "per_capita_sewage", 135.0)

    sd_engine.percentage_population_in_untapped_drains_area_at_t_zero = lambda: _get_discharge_value(state, "pct_untapped_drains", 31.0)
    sd_engine.percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero = lambda: _get_discharge_value(state, "pct_tapped_non_gravity", 32.0)
    sd_engine.percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero = lambda: _get_discharge_value(state, "pct_tapped_gravity", 0.0)
    sd_engine.percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero = lambda: _get_discharge_value(state, "pct_stp_gravity_sewer", 22.0)
    sd_engine.percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero = lambda: _get_discharge_value(state, "pct_stp_non_gravity_sewer", 15.0)
    sd_engine.percentage_population_in_nonstp_sewer_network_area_at_t_zero = lambda: _get_discharge_value(state, "pct_non_stp_sewer", 0.0)
    sd_engine.percentage_population_in_insitu_area_at_t_zero = lambda: _get_discharge_value(state, "pct_in_situ", 0.0)

    sd_engine.stp_installed_capacity_at_t_zero = lambda: _get_state_value(state, "stp_capacity", 260.0)
    sd_engine.pumping_capacity_at_t_zero = lambda: _get_state_value(state, "pump_capacity", 140.0, aliases=("pumping_capacity",))
    _initialize_statefuls()


def _compute_snapshot_from_pysd(state: dict) -> dict:
    """Sample the translated SD model at t=0 so snapshot cards match the .mdl logic."""
    model = _get_pysd_model()
    raw = model.run(
        params=_build_pysd_params(state),
        return_timestamps=[0],
        return_columns=[
            "total_sewerage_generation",
            "treatment",
            "total_untreated_sewage_water_discharge_into_river",
            "untreated_sewage_discharge_from_untapped_drains_to_river",
            "overflows_from_tapped_drains_nongravity_to_river",
            "overflows_from_tapped_draingravity_to_river",
            "overflow_from_ps_to_river",
            "discharge_from_non_stp_sewer_network_to_river",
            "untreated_wastewater_discharge_from_stp_to_varuna",
        ],
        reload=True,
        progress=False,
    )
    row = raw.iloc[0]
    overflow_tapped = (
        float(row["overflows_from_tapped_drains_nongravity_to_river"])
        + float(row["overflows_from_tapped_draingravity_to_river"])
    )
    actual_treated = float(row["treatment"])
    stp_overflow = float(row["untreated_wastewater_discharge_from_stp_to_varuna"])

    return {
        "total_sewage": round(float(row["total_sewerage_generation"]), 2),
        "treatment_deficit": round(float(row["total_untreated_sewage_water_discharge_into_river"]), 2),
        "untreated_untapped": round(float(row["untreated_sewage_discharge_from_untapped_drains_to_river"]), 2),
        "overflow_tapped": round(overflow_tapped, 2),
        "pumping_shortfall": round(float(row["overflow_from_ps_to_river"]), 2),
        "non_stp_sewer_flow": round(float(row["discharge_from_non_stp_sewer_network_to_river"]), 2),
        "stp_overflow": round(stp_overflow, 2),
        "actual_treated": round(actual_treated, 2),
        "flow_to_stp": round(actual_treated + stp_overflow, 2),
    }


def compute_snapshot(params: dict) -> dict:
    """
    Computes a baseline snapshot for the initial metrics display.
    """
    pop = params.get("population", 2644440)
    pcs = params.get("per_capita_sewage", 135.0)
    total_sewage = pop * pcs / 1_000_000
    snapshot = _compute_flow_snapshot(total_sewage, params)
    snapshot["total_sewage"] = round(total_sewage, 2)

    try:
        snapshot.update(_compute_snapshot_from_pysd(params))
    except Exception:
        pass

    installed_stp = _get_state_value(params, "stp_capacity", 260.0)
    snapshot["stp_installed_capacity"] = round(installed_stp, 2)
    snapshot["stp_unutilised_capacity"] = round(max(0.0, installed_stp - snapshot.get("actual_treated", 0.0)), 2)

    return snapshot


def _triplet_from_state(state: dict, prefix: str, fallback_label_key: str, fallback_default: str) -> tuple[float, float, float]:
    """
    Prefer explicit 3-factor fields (<prefix>_monitoring / _coordination / _skill) if
    present in state; otherwise fall back to the legacy combined Low/Medium/High label.
    """
    monitoring_key, coordination_key, skill_key = f"{prefix}_monitoring", f"{prefix}_coordination", f"{prefix}_skill"
    if monitoring_key in state or coordination_key in state or skill_key in state:
        fallback = _maintenance_triplet(state.get(fallback_label_key, fallback_default))
        return (
            _get_state_value(state, monitoring_key, fallback[0]),
            _get_state_value(state, coordination_key, fallback[1]),
            _get_state_value(state, skill_key, fallback[2]),
        )
    return _maintenance_triplet(state.get(fallback_label_key, fallback_default))


def _build_pysd_params(state: dict, strategies: list[str] | None = None) -> dict:
    """Translate UI state into the variable names expected by the PySD model."""
    strategies = strategies or state.get("strategies", []) or []
    use_maintenance_strategy = "Change Quality of Maintenance" in strategies

    change_stp = use_maintenance_strategy and bool(state.get("change_maint_stp", False))
    change_pump = use_maintenance_strategy and bool(state.get("change_maint_pump", False))
    change_tapped_ng = use_maintenance_strategy and bool(state.get("change_maint_tapped_nongravity", False))
    change_tapped_g = use_maintenance_strategy and bool(state.get("change_maint_tapped_gravity", False))
    change_sewer_ng = use_maintenance_strategy and bool(state.get("change_maint_sewer_nongravity", False))
    change_sewer_g = use_maintenance_strategy and bool(state.get("change_maint_sewer_gravity", False))

    base_tapped_g = _triplet_from_state(state, "maint_tapped_gravity", "maint_tapped", "low (0.40)")
    base_tapped_ng = _triplet_from_state(state, "maint_tapped_nongravity", "maint_tapped", "low (0.40)")
    base_stp = _triplet_from_state(state, "maint_stp", "maint_stp", "high (>0.90)")
    base_pump = _triplet_from_state(state, "maint_pump", "maint_pump", "high (>0.90)")
    base_sewer_g = _triplet_from_state(state, "maint_sewer_gravity", "maint_sewer_gravity", "high (>0.90)")
    base_sewer_ng = _triplet_from_state(state, "maint_sewer_nongravity", "maint_sewer_nongravity", "high (>0.90)")

    target_tapped_ng = _triplet_from_state(state, "new_maint_tapped_ng", "new_maint_tapped_ng", state.get("maint_tapped", "low (0.40)"))
    target_tapped_g = _triplet_from_state(state, "new_maint_tapped_g", "new_maint_tapped_g", state.get("maint_tapped", "low (0.40)"))
    target_stp = _triplet_from_state(state, "new_maint_stp", "new_maint_stp_dec", state.get("maint_stp", "high (>0.90)"))
    target_pump = _triplet_from_state(state, "new_maint_pump", "new_maint_pump", state.get("maint_pump", "high (>0.90)"))
    target_sewer_g = _triplet_from_state(state, "new_maint_sewer_gravity", "new_maint_sewer_gravity", "high (>0.90)")
    target_sewer_ng = _triplet_from_state(state, "new_maint_sewer_nongravity", "new_maint_sewer_nongravity", "high (>0.90)")

    current_tapped_ng = target_tapped_ng if change_tapped_ng else base_tapped_ng
    current_tapped_g = target_tapped_g if change_tapped_g else base_tapped_g
    current_stp = target_stp if change_stp else base_stp
    current_pump = target_pump if change_pump else base_pump
    current_sewer_g = target_sewer_g if change_sewer_g else base_sewer_g
    current_sewer_ng = target_sewer_ng if change_sewer_ng else base_sewer_ng

    num_stp = int(state.get("num_stp_required", 0) or 0)
    planning_choice = int(state.get("planning_choice", 1 if num_stp <= 1 else 2) or 1)

    params = {
        "total_population_at_tzero": _get_state_value(state, "population", 2644440),
        "per_capita_sewage_generationlpcd": _get_state_value(state, "per_capita_sewage", 135.0),
        "percentage_population_in_untapped_drains_area_at_t_zero": _get_discharge_value(state, "pct_untapped_drains", 31.0),
        "percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero": _get_discharge_value(state, "pct_tapped_non_gravity", 32.0),
        "percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero": _get_discharge_value(state, "pct_tapped_gravity", 0.0),
        "percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero": _get_discharge_value(state, "pct_stp_gravity_sewer", 22.0),
        "percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero": _get_discharge_value(state, "pct_stp_non_gravity_sewer", 15.0),
        "percentage_population_in_nonstp_sewer_network_area_at_t_zero": _get_discharge_value(state, "pct_non_stp_sewer", 0.0),
        "percentage_population_in_insitu_area_at_t_zero": _get_discharge_value(state, "pct_in_situ", 0.0),
        "stp_installed_capacity_at_t_zero": _get_state_value(state, "stp_capacity", 260.0),
        "pumping_capacity_at_t_zero": _get_state_value(state, "pump_capacity", 140.0, aliases=("pumping_capacity",)),
        "unit_cost_of_stp_construction": _get_state_value(state, "stp_construction", 0.0, aliases=("cost_stp_construction",)),
        "unit_cost_of_stp_oandm": _get_state_value(state, "stp_om_cost", 0.0, aliases=("cost_stp_om",)),
        "unit_cost_of_tapping_construction": _get_state_value(state, "tap_construction", 0.0, aliases=("cost_tapping_construction",)),
        "unit_cost_of_tapping_oandm": _get_state_value(state, "tap_om_cost", 0.0, aliases=("cost_tapping_om",)),
        "unit_cost_of_pumping_station_construction": _get_state_value(state, "pump_construction", 0.0, aliases=("cost_pumping_construction",)),
        "unit_cost_of_pumping_station_oandm": _get_state_value(state, "pump_om_cost", 0.0, aliases=("cost_pumping_om",)),
        "bau_oandm_cost_for_stps": _get_state_value(state, "om_stp", 28.47),
        "bau_oandm_cost_for_pumps": _get_state_value(state, "om_pump", 1.4, aliases=("om_pumps",)),
        "bau_oandm_cost_for_tapped_network": _get_state_value(state, "om_tapped", 4.0),
        "bau_oandm_cost_for_sewer_network": _get_state_value(state, "om_sewer_network", 10.0),
        "planning_choice_between_centralised_and_decentralised": planning_choice,
        "no_of_stps_in_decentralised_planning": max(2, num_stp) if num_stp > 1 else 2,
        "stp_unit_size": _get_state_value(state, "unit_stp_size", 0.0),
        "technology_choice": int(state.get("technology_choice", 5) or 5),
        "proposal_to_approval_avg_time": _get_state_value(state, "proposal_approval_time", 1.0),
        "approval_to_underconstruction_time": _get_state_value(state, "approval_construction_time", 1.0),
        "underconstruction_time": _get_state_value(state, "underconstruction_time", 1.0),
        "budget_allocation_delay": _get_state_value(state, "budget_allocation_delay", 0.5),
        "land_acquisition_delay": _get_state_value(state, "land_acquisition_delay", 0.5),
        "operational_clearance_time": _get_state_value(state, "operational_clearance_time", 0.5),
        "sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population": _get_state_value(state, "drain_tap_gravity", 0.0),
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": _get_state_value(state, "drain_tap_nongravity", 0.0),
        "time_for_tapping_gravity_based_infra_and_zero_stp_addition": _get_state_value(state, "drain_tap_gravity_time", 0.0),
        "time_for_tapping_nongravity_based_infra_and_zero_stp_addition": _get_state_value(state, "drain_tap_nongravity_time", 0.0),
        "additional_pump_required": _get_state_value(state, "additional_pumping", 0.0),
        "time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition": _get_state_value(state, "pumping_station_time", 0.0),

        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network": _get_state_value(state, "sewer_flow_untapped_gravity", 0.0),
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": _get_state_value(state, "sewer_flow_tapped_nongravity_gravity", 0.0),
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": _get_state_value(state, "sewer_flow_tapped_gravity_gravity", 0.0),
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network": _get_state_value(state, "sewer_flow_insitu_gravity", 0.0),
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network": _get_state_value(state, "sewer_flow_nonstp_gravity", 0.0),
        "time_for_stp_connected_gravity_based_sewer_network_addition": _get_state_value(state, "sewer_time_gravity", 0.0),

        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network": _get_state_value(state, "sewer_flow_untapped_nongravity", 0.0),
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": _get_state_value(state, "sewer_flow_tapped_nongravity_nongravity", 0.0),
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": _get_state_value(state, "sewer_flow_tapped_gravity_nongravity", 0.0),
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network": _get_state_value(state, "sewer_flow_insitu_nongravity", 0.0),
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network": _get_state_value(state, "sewer_flow_nonstp_nongravity", 0.0),
        "time_for_stp_connected_nongravity_based_sewer_network_addition": _get_state_value(state, "sewer_time_nongravity", 0.0),

        "user_input_sewer_network_length": _get_state_value(state, "user_input_sewer_network_length", 0.0),
        "unit_cost_of_sewer_network_construction": _get_state_value(state, "sewer_network_construction_per_km", 0.4),
        "unit_cost_of_sewer_network_oandm": _get_state_value(state, "sewer_network_om_per_km", 0.0),
        "change_in_maintenance_of_tapped_nongravity_network": 1 if change_tapped_ng else 0,
        "change_in_maintenance_of_tapped_gravity_network": 1 if change_tapped_g else 0,
        "change_in_maintenance_of_stps": 1 if change_stp else 0,
        "change_in_maintenance_of_pumps": 1 if change_pump else 0,
        "change_in_maintenance_of_gravity_sewer_network": 1 if change_sewer_g else 0,
        "change_in_maintenance_of_nongravity_sewer_network": 1 if change_sewer_ng else 0,
        "time_for_changing_maintentance_effort_for_tapped_nongravity": _get_state_value(state, "maint_time_tapped_ng", 0.0),
        "time_for_changing_maintentance_effort_for_tapped_gravity": _get_state_value(state, "maint_time_tapped_g", 0.0),
        "time_for_changing_maintentance_effort_for_stp": _get_state_value(state, "maint_time_stp", 0.0),
        "time_for_changing_maintentance_effort_for_pumps": _get_state_value(state, "maint_time_pump", 0.0),
        "time_for_changing_maintentance_effort_for_gravity_sewer_network": _get_state_value(state, "maint_time_sewer_gravity", 0.0),
        "time_for_changing_maintentance_effort_for_nongravity_sewer_network": _get_state_value(state, "maint_time_sewer_nongravity", 0.0),

        "tzero_adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance": base_tapped_g[0],
        "tzero_coordination_between_agencies_for_tapped_gravity_drains": base_tapped_g[1],
        "tzero_availability_of_appropriate_skill_for_tapped_gravity_drains": base_tapped_g[2],
        "tzero_adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance": base_tapped_ng[0],
        "tzero_coordination_between_agencies_for_tapped_nongravity_drains": base_tapped_ng[1],
        "tzero_availability_of_appropriate_skill_for_tapped_nongravity_drains": base_tapped_ng[2],
        "tzero_adequacy_of_monitoring_and_oversight_of_stp_performance": base_stp[0],
        "tzero_coordination_between_agencies_for_stp": base_stp[1],
        "tzero_availability_of_appropriate_skill_for_stp": base_stp[2],
        "tzero_adequacy_of_monitoring_and_oversight_of_pumping_performance": base_pump[0],
        "tzero_coordination_between_agencies_for_pumps": base_pump[1],
        "tzero_availability_of_appropriate_skill_for_pumps": base_pump[2],
        "tzero_adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance": base_sewer_g[0],
        "tzero_coordination_between_agencies_for_gravity_sewer_network": base_sewer_g[1],
        "tzero_availability_of_appropriate_skill_for_gravity_sewer_network": base_sewer_g[2],
        "tzero_adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance": base_sewer_ng[0],
        "tzero_coordination_between_agencies_for_nongravity_sewer_network": base_sewer_ng[1],
        "tzero_availability_of_appropriate_skill_for_nongravity_sewer_network": base_sewer_ng[2],

        "adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance": current_tapped_g[0],
        "coordination_between_agencies_for_tapped_gravity_drains": current_tapped_g[1],
        "availability_of_appropriate_skill_for_tapped_gravity_drains": current_tapped_g[2],
        "adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance": current_tapped_ng[0],
        "coordination_between_agencies_for_tapped_nongravity_drains": current_tapped_ng[1],
        "availability_of_appropriate_skill_for_tapped_nongravity_drains": current_tapped_ng[2],
        "adequacy_of_monitoring_and_oversight_of_stp_performance": current_stp[0],
        "coordination_between_agencies_for_stp": current_stp[1],
        "availability_of_appropriate_skill_for_stp": current_stp[2],
        "adequacy_of_monitoring_and_oversight_of_pumping_performance": current_pump[0],
        "coordination_between_agencies_for_pumps": current_pump[1],
        "availability_of_appropriate_skill_for_pumps": current_pump[2],
        "adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance": current_sewer_g[0],
        "coordination_between_agencies_for_gravity_sewer_network": current_sewer_g[1],
        "availability_of_appropriate_skill_for_gravity_sewer_network": current_sewer_g[2],
        "adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance": current_sewer_ng[0],
        "coordination_between_agencies_for_nongravity_sewer_network": current_sewer_ng[1],
        "availability_of_appropriate_skill_for_nongravity_sewer_network": current_sewer_ng[2],
    }
    return params

calculate_snapshot = compute_snapshot

def run_projection(state: dict, years: int = 10) -> list[dict]:
    """
    Executes the underlying system dynamics engine loops across a 3650 day scope.
    Converts data to lists of dicts to preserve compatibility with app.py's baseline structures.
    """
    try:
        model = _get_pysd_model()
        timestamps = [step_year * 365 for step_year in range(years + 1)]
        raw = model.run(
            params=_build_pysd_params(state, state.get("strategies", [])),
            return_timestamps=timestamps,
            return_columns=[
                "total_sewerage_generation",
                "treatment",
                "total_untreated_sewage_water_discharge_into_river",
                "overflows_from_tapped_drains_nongravity_to_river",
                "overflows_from_tapped_draingravity_to_river",
                "untreated_wastewater_discharge_from_stp_to_varuna",
            ],
            reload=True,
            progress=False,
        ).reset_index().rename(columns={"time": "Day"})
        return [
            {
                "year": int(row["Day"] // 365),
                "total_sewage": round(float(row["total_sewerage_generation"]), 2),
                "actual_treated": round(float(row["treatment"]), 2),
                "treatment_deficit": round(float(row["total_untreated_sewage_water_discharge_into_river"]), 2),
                "untreated_untapped": 0.0,
                "overflow_tapped": round(
                    float(row["overflows_from_tapped_drains_nongravity_to_river"])
                    + float(row["overflows_from_tapped_draingravity_to_river"]),
                    2,
                ),
                "non_stp_sewer_flow": 0.0,
                "stp_overflow": round(float(row["untreated_wastewater_discharge_from_stp_to_varuna"]), 2),
            }
            for _, row in raw.iterrows()
        ]
    except Exception:
        df = run_simulation(state, [], years=years)
        projections = []
        for step_year in range(years + 1):
            target_day = step_year * 365
            idx = (df["Day"] - target_day).abs().idxmin()
            row = df.loc[idx]
            projections.append({
                "year": step_year,
                "total_sewage": float(row["Total Sewage (MLD)"]),
                "actual_treated": float(row["Treated (MLD)"]),
                "treatment_deficit": float(row["Untreated Load (MLD)"]),
                "untreated_untapped": 0.0,
                "overflow_tapped": float(row.get("Tapped Drain Overflow (Non-Gravity) (MLD)", 0.0))
                + float(row.get("Tapped Drain Overflow (Gravity) (MLD)", 0.0)),
                "non_stp_sewer_flow": 0.0,
                "stp_overflow": float(row.get("STP Overflow (MLD)", 0.0)),
            })
        return projections

def run_simulation(state: dict, strategies: list[str], years: int = 10) -> pd.DataFrame:
    """
    Direct data frame execution engine used for granular chart renderings.
    """
    try:
        time_points = list(range(0, (years * 365) + 1, 30))
        model = _get_pysd_model()
        raw = model.run(
            params=_build_pysd_params(state, strategies),
            return_timestamps=time_points,
            return_columns=[
                "total_sewerage_generation",
                "treatment",
                "total_untreated_sewage_water_discharge_into_river",
                "treated_sewage_dischage_to_river",
                "untreated_sewage_discharge_from_untapped_drains_to_river",
                "overflows_from_tapped_drains_nongravity_to_river",
                "overflows_from_tapped_draingravity_to_river",
                "untreated_wastewater_discharge_from_stp_to_varuna",
                "overflow_from_ps_to_river",
                "ps_to_stp",
                "conveyance_through_untapped_drains",
                "conveyance_through_tapped_drains_nongravity",
                "conveyance_through_tapped_drainsgravity",
                "conveyance_through_sewer_network_connected_to_stp",
                "sewer_network_to_ps",
                "infilteration_from_sewer_network_to_gw",
                "discharge_from_non_stp_sewer_network_to_river",
                "untreated_sewage_from_gw_to_river",
                "stp_installed_capacity",
                "condition_of_stp",
                "conditions_of_screens_in_tapped_drains_nongravity",
                "conditions_of_screens_in_tapped_drains_gravity",
                "condition_of_gravity_sewer_network",
                "condition_of_nongravity_sewer_network",
                "ratio_of_tapped_drain_to_stp_and_discharge_through_tapped_drains",
                "bod_in_treated_sewage",
                "bod_of_untreated_sewage_water",
                "total_bod_load_from_sewage_water_into_river",
                "tapping_annual_oandm_cost",
                "pumping_station_annual_oandm_cost",
                "stp_annual_oandm_cost",
                "total_capital_cost",
                "total_oandm_cost",
            ],
            reload=True,
            progress=False,
        )
        raw = raw.reset_index().rename(columns={"time": "Day"})
        raw["Year"] = raw["Day"].apply(lambda d: int(2025 + (d // 365)))
        raw["Treatment %"] = (raw["treatment"] / raw["total_sewerage_generation"].clip(lower=1.0) * 100).clip(upper=100)
        raw["tapped_overflow_total"] = (
            raw["overflows_from_tapped_drains_nongravity_to_river"]
            + raw["overflows_from_tapped_draingravity_to_river"]
        )
        raw["conveyance_to_drains"] = (
            raw["conveyance_through_untapped_drains"]
            + raw["conveyance_through_tapped_drains_nongravity"]
            + raw["conveyance_through_tapped_drainsgravity"]
        )
        raw["conveyance_through_tapped_drain"] = (
            raw["conveyance_through_tapped_drains_nongravity"]
            + raw["conveyance_through_tapped_drainsgravity"]
        )
        raw["stp_effective_capacity"] = raw["stp_installed_capacity"] * raw["condition_of_stp"] / 100
        raw["condition_of_tapped_drain"] = (
            raw["conditions_of_screens_in_tapped_drains_nongravity"]
            + raw["conditions_of_screens_in_tapped_drains_gravity"]
        ) / 2
        raw["condition_of_sewer_network_avg"] = (
            raw["condition_of_gravity_sewer_network"]
            + raw["condition_of_nongravity_sewer_network"]
        ) / 2
        raw["bod_of_river"] = raw["total_bod_load_from_sewage_water_into_river"] / raw[
            "total_sewerage_generation"
        ].clip(lower=1.0)
        return pd.DataFrame({
            "Year": raw["Year"].astype(int),
            "Day": raw["Day"].astype(int),
            "Total Sewage (MLD)": raw["total_sewerage_generation"].round(2),
            "Treated (MLD)": raw["treatment"].round(2),
            "Untreated Load (MLD)": raw["total_untreated_sewage_water_discharge_into_river"].round(2),
            "Treatment %": raw["Treatment %"].round(1),
            "Treated Sewage Discharge to River (MLD)": raw["treated_sewage_dischage_to_river"].round(2),
            "Untreated From Untapped Drains (MLD)": raw["untreated_sewage_discharge_from_untapped_drains_to_river"].round(2),
            "Tapped Drain Overflow (Non-Gravity) (MLD)": raw["overflows_from_tapped_drains_nongravity_to_river"].round(2),
            "Tapped Drain Overflow (Gravity) (MLD)": raw["overflows_from_tapped_draingravity_to_river"].round(2),
            "Tapped Drain Overflow Total (MLD)": raw["tapped_overflow_total"].round(2),
            "STP Overflow (MLD)": raw["untreated_wastewater_discharge_from_stp_to_varuna"].round(2),
            "Pumping Station Overflow (MLD)": raw["overflow_from_ps_to_river"].round(2),
            "PS to STP (MLD)": raw["ps_to_stp"].round(2),
            "Conveyance to Drains (MLD)": raw["conveyance_to_drains"].round(2),
            "Conveyance Through Tapped Drain (MLD)": raw["conveyance_through_tapped_drain"].round(2),
            "Conveyance to Sewer Network (MLD)": raw["conveyance_through_sewer_network_connected_to_stp"].round(2),
            "Sewer Network to PS (MLD)": raw["sewer_network_to_ps"].round(2),
            "Leakages from Sewer Network to GW (MLD)": raw["infilteration_from_sewer_network_to_gw"].round(2),
            "Non-STP Sewer Discharge to River (MLD)": raw["discharge_from_non_stp_sewer_network_to_river"].round(2),
            "Untreated Sewage From GW to River (MLD)": raw["untreated_sewage_from_gw_to_river"].round(2),
            "STP Effective Capacity (MLD)": raw["stp_effective_capacity"].round(2),
            "STP Installed Capacity (MLD)": raw["stp_installed_capacity"].round(2),
            "Condition of Tapped Drain (%)": raw["condition_of_tapped_drain"].round(2),
            "Condition of Sewer Network (Gravity) (%)": raw["condition_of_gravity_sewer_network"].round(2),
            "Condition of Sewer Network (Non-Gravity) (%)": raw["condition_of_nongravity_sewer_network"].round(2),
            "Condition of Sewer Network (%)": raw["condition_of_sewer_network_avg"].round(2),
            "Ratio Tapped Drain to STP": raw["ratio_of_tapped_drain_to_stp_and_discharge_through_tapped_drains"].round(4),
            "BOD in Untreated Sewage": raw["bod_of_untreated_sewage_water"].round(2),
            "BOD in Treated Sewage": raw["bod_in_treated_sewage"].round(2),
            "BOD of River": raw["bod_of_river"].round(2),
            "Maintenance Cost of Tapped Drains (Cr)": raw["tapping_annual_oandm_cost"].round(2),
            "Maintenance Cost of Pumps (Cr)": raw["pumping_station_annual_oandm_cost"].round(2),
            "Maintenance Cost of STP (Cr)": raw["stp_annual_oandm_cost"].round(2),
            "Capital Cost (Cr)": raw["total_capital_cost"].round(2),
            "OM Cost (Cr)": raw["total_oandm_cost"].round(2),
        })
    except Exception:
        return _fallback_run_simulation(state, strategies, years=years)
