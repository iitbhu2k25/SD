"""
Python model 'River Rejuvenation SD model (1).py'
Translated using PySD
"""

from pathlib import Path
import numpy as np

from pysd.py_backend.functions import if_then_else, pulse, integer
from pysd.py_backend.statefuls import DelayFixed, Initial, Integ
from pysd import Component

__pysd_version__ = "3.14.3"

__data = {"scope": None, "time": lambda: 0}

_root = Path(__file__).parent


component = Component()

#######################################################################
#                          CONTROL VARIABLES                          #
#######################################################################

_control_vars = {
    "initial_time": lambda: 0,
    "final_time": lambda: 3650,
    "time_step": lambda: 1,
    "saveper": lambda: time_step(),
}


def _init_outer_references(data):
    for key in data:
        __data[key] = data[key]


@component.add(name="Time")
def time():
    """
    Current time of the model.
    """
    return __data["time"]()


@component.add(
    name="FINAL TIME", units="day", comp_type="Constant", comp_subtype="Normal"
)
def final_time():
    """
    The final time for the simulation.
    """
    return __data["time"].final_time()


@component.add(
    name="INITIAL TIME", units="day", comp_type="Constant", comp_subtype="Normal"
)
def initial_time():
    """
    The initial time for the simulation.
    """
    return __data["time"].initial_time()


@component.add(
    name="SAVEPER",
    units="day",
    limits=(0.0, np.nan),
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time_step": 1},
)
def saveper():
    """
    The frequency with which output is stored.
    """
    return __data["time"].saveper()


@component.add(
    name="TIME STEP",
    units="day",
    limits=(0.0, np.nan),
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_step():
    """
    The time step for the simulation.
    """
    return __data["time"].time_step()


#######################################################################
#                           MODEL VARIABLES                           #
#######################################################################


@component.add(
    name="Tzero adequacy of monitoring and oversight of STP performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_stp_performance():
    return 95


@component.add(
    name="Tzero adequacy of monitoring and oversight of tapped gravity drains performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance():
    return 45


@component.add(
    name="Tzero adequacy of monitoring and oversight of tapped nongravity drains performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance():
    return 45


@component.add(
    name="adequacy of monitoring and oversight of pumping performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_pumping_performance():
    return 95


@component.add(
    name="adequacy of monitoring and oversight of STP performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_stp_performance():
    return 95


@component.add(
    name="adequacy of monitoring and oversight of tapped gravity drains performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance():
    return 45


@component.add(
    name="adequacy of monitoring and oversight of tapped nongravity drains performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance():
    return 45


@component.add(
    name="timeline for capital investment in new pumping",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 1,
        "timeline_for_capital_investment_in_new_tapping": 1,
        "time": 1,
        "time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition": 1,
    },
)
def timeline_for_capital_investment_in_new_pumping():
    return if_then_else(
        sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
        > 0,
        lambda: timeline_for_capital_investment_in_new_tapping(),
        lambda: pulse(
            __data["time"],
            integer(
                time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition()
                * 365
            ),
            width=1,
        ),
    )


@component.add(
    name="approval",
    units="ML/(day*day)",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"stp_unit_size": 1, "stp_proposal_to_approval_timeline": 1},
)
def approval():
    """
    DELAY FIXED ( proposal,proposal to commissioning time*365 , 0 )
    """
    return stp_unit_size() * stp_proposal_to_approval_timeline()


@component.add(
    name="Tzero coordination between agencies for tapped gravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_tapped_gravity_drains():
    return 45


@component.add(
    name="coordination between agencies for pumps",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_pumps():
    return 95


@component.add(
    name="coordination between agencies for STP",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_stp():
    return 95


@component.add(
    name="at Tzero gap between installed STP capacity and treatment",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"stp_installed_capacity_at_t_zero": 1, "tzero_treatement": 1},
)
def at_tzero_gap_between_installed_stp_capacity_and_treatment():
    return stp_installed_capacity_at_t_zero() - tzero_treatement()


@component.add(
    name="coordination between agencies for tapped nongravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_tapped_nongravity_drains():
    return 45


@component.add(
    name="at Tzero gap between sewage generation and treatment",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "per_capita_sewage": 1,
        "tzero_treatement": 1,
    },
)
def at_tzero_gap_between_sewage_generation_and_treatment():
    return total_population_at_tzero() * per_capita_sewage() - tzero_treatement()


@component.add(
    name="Tzero maintenance effort index for pumps",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_pumping_performance": 1,
        "tzero_coordination_between_agencies_for_pumps": 1,
        "tzero_availability_of_appropriate_skill_for_pumps": 1,
    },
)
def tzero_maintenance_effort_index_for_pumps():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_pumping_performance()
        * tzero_coordination_between_agencies_for_pumps()
        * tzero_availability_of_appropriate_skill_for_pumps()
        / 1000000.0
    )


@component.add(
    name="availability of appropriate skill for pumps",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_pumps():
    return 70


@component.add(
    name="availability of appropriate skill for STP",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_stp():
    return 70


@component.add(
    name="availability of appropriate skill for tapped gravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_tapped_gravity_drains():
    return 70


@component.add(
    name="availability of appropriate skill for tapped nongravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_tapped_nongravity_drains():
    return 70


@component.add(
    name="pumping station capital cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "additional_pump_required": 1,
        "unit_cost_of_pumping_station_construction": 1,
        "timeline_for_capital_investment_in_new_pumping": 1,
    },
)
def pumping_station_capital_cost():
    return (
        additional_pump_required()
        * unit_cost_of_pumping_station_construction()
        * timeline_for_capital_investment_in_new_pumping()
    )


@component.add(
    name="Budget allocation delay", comp_type="Constant", comp_subtype="Normal"
)
def budget_allocation_delay():
    return 0.5


@component.add(
    name="STP capacity addition",
    units="1*ML/(day*day)",
    comp_type="Stateful",
    comp_subtype="DelayFixed",
    depends_on={"_delayfixed_stp_capacity_addition": 1},
    other_deps={
        "_delayfixed_stp_capacity_addition": {
            "initial": {"underconstruction_time": 1, "operational_clearance_time": 1},
            "step": {"underconstruction": 1},
        }
    },
)
def stp_capacity_addition():
    return _delayfixed_stp_capacity_addition()


_delayfixed_stp_capacity_addition = DelayFixed(
    lambda: underconstruction(),
    lambda: integer((underconstruction_time() + operational_clearance_time()) * 365),
    lambda: 0,
    time_step,
    "_delayfixed_stp_capacity_addition",
)


@component.add(
    name="input efforts preventive maintenance for pumps",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_pumps": 1},
)
def input_efforts_preventive_maintenance_for_pumps():
    return np.interp(
        input_maintenance_effort_index_for_pumps(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.99,
            0.99,
            0.99,
            0.99,
            0.99,
            0.99,
            0.99,
        ],
    )


@component.add(
    name="input efforts preventive maintenance for STPs",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_stps": 1},
)
def input_efforts_preventive_maintenance_for_stps():
    return np.interp(
        input_maintenance_effort_index_for_stps(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="input efforts preventive maintenance for tapped gravity drains",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_tapped_gravity_drains": 1},
)
def input_efforts_preventive_maintenance_for_tapped_gravity_drains():
    return np.interp(
        input_maintenance_effort_index_for_tapped_gravity_drains(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="input efforts preventive maintenance for tapped nongravity drains",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_tapped_nongravity_drains": 1},
)
def input_efforts_preventive_maintenance_for_tapped_nongravity_drains():
    return np.interp(
        input_maintenance_effort_index_for_tapped_nongravity_drains(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="input maintenance effort index for pumps",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_pumping_performance": 1,
        "coordination_between_agencies_for_pumps": 1,
        "availability_of_appropriate_skill_for_pumps": 1,
    },
)
def input_maintenance_effort_index_for_pumps():
    return (
        adequacy_of_monitoring_and_oversight_of_pumping_performance()
        * coordination_between_agencies_for_pumps()
        * availability_of_appropriate_skill_for_pumps()
        / 1000000.0
    )


@component.add(
    name="input maintenance effort index for STPs",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_stp_performance": 1,
        "coordination_between_agencies_for_stp": 1,
        "availability_of_appropriate_skill_for_stp": 1,
    },
)
def input_maintenance_effort_index_for_stps():
    return (
        adequacy_of_monitoring_and_oversight_of_stp_performance()
        * coordination_between_agencies_for_stp()
        * availability_of_appropriate_skill_for_stp()
        / 1000000.0
    )


@component.add(
    name="input maintenance effort index for tapped gravity drains",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance": 1,
        "coordination_between_agencies_for_tapped_gravity_drains": 1,
        "availability_of_appropriate_skill_for_tapped_gravity_drains": 1,
    },
)
def input_maintenance_effort_index_for_tapped_gravity_drains():
    return (
        adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance()
        * coordination_between_agencies_for_tapped_gravity_drains()
        * availability_of_appropriate_skill_for_tapped_gravity_drains()
        / 1000000.0
    )


@component.add(
    name="input maintenance effort index for tapped nongravity drains",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance": 1,
        "coordination_between_agencies_for_tapped_nongravity_drains": 1,
        "availability_of_appropriate_skill_for_tapped_nongravity_drains": 1,
    },
)
def input_maintenance_effort_index_for_tapped_nongravity_drains():
    return (
        adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance()
        * coordination_between_agencies_for_tapped_nongravity_drains()
        * availability_of_appropriate_skill_for_tapped_nongravity_drains()
        / 1000000.0
    )


@component.add(
    name="Tzero coordination between agencies for STP",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_stp():
    return 95


@component.add(
    name="Tapping capital cost",
    units="INR cr/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population": 1,
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 1,
        "unit_cost_of_tapping_construction": 1,
        "timeline_for_capital_investment_in_new_tapping": 1,
        "no_of_stps": 1,
    },
)
def tapping_capital_cost():
    return (
        (
            sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population()
            + sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
        )
        * unit_cost_of_tapping_construction()
        * timeline_for_capital_investment_in_new_tapping()
        / no_of_stps()
    )


@component.add(
    name="change in maintenance of Pumps", comp_type="Constant", comp_subtype="Normal"
)
def change_in_maintenance_of_pumps():
    return 0


@component.add(
    name="change in maintenance of STPs", comp_type="Constant", comp_subtype="Normal"
)
def change_in_maintenance_of_stps():
    return 0


@component.add(
    name="change in maintenance of Tapped gravity network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def change_in_maintenance_of_tapped_gravity_network():
    return 0


@component.add(
    name="change in maintenance of Tapped nongravity network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def change_in_maintenance_of_tapped_nongravity_network():
    return 0


@component.add(
    name="total time for tapped network augmentation when treatment capacity augmentation",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "approaval_start_time": 1,
        "approval_endtime": 1,
        "total_approval_to_construction_time": 1,
    },
)
def total_time_for_tapped_network_augmentation_when_treatment_capacity_augmentation():
    return integer(
        (approaval_start_time() + approval_endtime()) / 2
        + total_approval_to_construction_time() * 365
    )


@component.add(
    name="Tzero availability of appropriate skill for pumps",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_pumps():
    return 70


@component.add(
    name="No of STPs",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "planning_choice_between_centralised_and_decentralised": 1,
        "no_of_stps_in_decentralised_planning": 1,
    },
)
def no_of_stps():
    return if_then_else(
        planning_choice_between_centralised_and_decentralised() == 1,
        lambda: 1,
        lambda: no_of_stps_in_decentralised_planning(),
    )


@component.add(
    name="No of STPs in decentralised planning",
    units="Dmnl",
    comp_type="Constant",
    comp_subtype="Normal",
)
def no_of_stps_in_decentralised_planning():
    return 2


@component.add(
    name="default unit OandM cost of treatment technology",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "planning_choice_between_centralised_and_decentralised": 1,
        "unit_oandm_cost_of_centralised_treatment_technology": 1,
        "unit_oandm_cost_of_decentralised_treatment_technology": 1,
    },
)
def default_unit_oandm_cost_of_treatment_technology():
    return if_then_else(
        planning_choice_between_centralised_and_decentralised() == 1,
        lambda: unit_oandm_cost_of_centralised_treatment_technology(),
        lambda: unit_oandm_cost_of_decentralised_treatment_technology(),
    )


@component.add(
    name="STP annual OandM cost",
    units="INR cr/(day*day)",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "change_in_maintenance_of_stps": 1,
        "decision_for_stp_capacity_augmentation": 1,
        "time": 1,
        "unit_cost_of_stp_oandm": 2,
        "time_for_changing_maintentance_effort_for_stp": 1,
        "stp_installed_capacity_at_t_zero": 2,
        "bau_oandm_cost_for_stps": 2,
        "stp_installed_capacity": 1,
    },
)
def stp_annual_oandm_cost():
    return if_then_else(
        np.logical_and(
            change_in_maintenance_of_stps() == 1,
            decision_for_stp_capacity_augmentation() == 0,
        ),
        lambda: if_then_else(
            time() > time_for_changing_maintentance_effort_for_stp() * 365,
            lambda: stp_installed_capacity_at_t_zero() * unit_cost_of_stp_oandm() / 365,
            lambda: bau_oandm_cost_for_stps() / 365,
        ),
        lambda: (stp_installed_capacity() - stp_installed_capacity_at_t_zero())
        * unit_cost_of_stp_oandm()
        / 365
        + bau_oandm_cost_for_stps() / 365,
    )


@component.add(
    name="timeline for capital investment in new tapping",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_stp_capacity_augmentation": 1,
        "decision_for_conveyance_capacity_augmentation": 1,
        "stp_proposal_to_approval_timeline": 1,
        "time_for_tapping_gravity_based_infra_and_zero_stp_addition": 1,
        "time": 1,
        "time_for_tapping_nongravity_based_infra_and_zero_stp_addition": 1,
    },
)
def timeline_for_capital_investment_in_new_tapping():
    return if_then_else(
        np.logical_and(
            decision_for_stp_capacity_augmentation() == 1,
            decision_for_conveyance_capacity_augmentation() == 1,
        ),
        lambda: stp_proposal_to_approval_timeline(),
        lambda: pulse(
            __data["time"],
            float(
                np.maximum(
                    time_for_tapping_gravity_based_infra_and_zero_stp_addition() * 365,
                    time_for_tapping_nongravity_based_infra_and_zero_stp_addition()
                    * 365,
                )
            ),
            width=1,
        ),
    )


@component.add(
    name="Unit OandM cost of centralised treatment technology",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"technology_choice": 1},
)
def unit_oandm_cost_of_centralised_treatment_technology():
    return np.interp(
        technology_choice(),
        [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0],
        [0.01, 0.018, 0.02, 0.05, 0.05, 0.086, 0.018, 0.075, 0.114, 0.06, 0.017],
    )


@component.add(
    name="Tzero adequacy of monitoring and oversight of pumping performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_pumping_performance():
    return 95


@component.add(
    name="unit capital cost of decentralised treatment technology",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"technology_choice": 1},
)
def unit_capital_cost_of_decentralised_treatment_technology():
    return np.interp(
        technology_choice(),
        [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0],
        [0.56, 0.56, 0.36, 0.48, 0.5, 1.01, 0.65, 0.44, 0.88, 0.53, 0.45],
    )


@component.add(
    name="coordination between agencies for tapped gravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_tapped_gravity_drains():
    return 45


@component.add(
    name="Operational clearance time", comp_type="Constant", comp_subtype="Normal"
)
def operational_clearance_time():
    return 0.5


@component.add(
    name="Tzero efforts preventive maintenance for tapped nongravity drains",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_tapped_nongravity_drains": 1},
)
def tzero_efforts_preventive_maintenance_for_tapped_nongravity_drains():
    return np.interp(
        tzero_maintenance_effort_index_for_tapped_nongravity_drains(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="Tzero availability of appropriate skill for STP",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_stp():
    return 70


@component.add(
    name="Tzero availability of appropriate skill for tapped gravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_tapped_gravity_drains():
    return 70


@component.add(
    name="Tzero availability of appropriate skill for tapped nongravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_tapped_nongravity_drains():
    return 70


@component.add(
    name="Tzero coordination between agencies for pumps",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_pumps():
    return 95


@component.add(
    name="Tzero treatement",
    comp_type="Stateful",
    comp_subtype="Initial",
    depends_on={"_initial_tzero_treatement": 1},
    other_deps={"_initial_tzero_treatement": {"initial": {"treatment": 1}, "step": {}}},
)
def tzero_treatement():
    return _initial_tzero_treatement()


_initial_tzero_treatement = Initial(lambda: treatment(), "_initial_tzero_treatement")


@component.add(
    name="underconstruction",
    units="ML*1/(day*day)",
    comp_type="Stateful",
    comp_subtype="DelayFixed",
    depends_on={"_delayfixed_underconstruction": 1},
    other_deps={
        "_delayfixed_underconstruction": {
            "initial": {
                "approval_to_underconstruction_time": 1,
                "budget_allocation_delay": 1,
                "land_acquisition_delay": 1,
            },
            "step": {"approval": 1},
        }
    },
)
def underconstruction():
    return _delayfixed_underconstruction()


_delayfixed_underconstruction = DelayFixed(
    lambda: approval(),
    lambda: integer(
        (
            approval_to_underconstruction_time()
            + budget_allocation_delay()
            + land_acquisition_delay()
        )
        * 365
    ),
    lambda: 0,
    time_step,
    "_delayfixed_underconstruction",
)


@component.add(
    name="Tzero coordination between agencies for tapped nongravity drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_tapped_nongravity_drains():
    return 45


@component.add(
    name="Tzero efforts preventive maintenance for pumps",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_pumps": 1},
)
def tzero_efforts_preventive_maintenance_for_pumps():
    return np.interp(
        tzero_maintenance_effort_index_for_pumps(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="total population percentage at tzero",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero": 1,
        "percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero": 1,
        "percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero": 1,
        "percentage_population_in_insitu_area_at_t_zero": 1,
        "percentage_population_in_nonstp_sewer_network_area_at_t_zero": 1,
        "percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero": 1,
        "percentage_population_in_untapped_drains_area_at_t_zero": 1,
    },
)
def total_population_percentage_at_tzero():
    return (
        percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero()
        + percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero()
        + percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero()
        + percentage_population_in_insitu_area_at_t_zero()
        + percentage_population_in_nonstp_sewer_network_area_at_t_zero()
        + percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero()
        + percentage_population_in_untapped_drains_area_at_t_zero()
    )


@component.add(
    name="Tzero efforts preventive maintenance for STPs",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_stps": 1},
)
def tzero_efforts_preventive_maintenance_for_stps():
    return np.interp(
        tzero_maintenance_effort_index_for_stps(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="Tzero efforts preventive maintenance for tapped gravity drains",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_tapped_gravity_drains": 1},
)
def tzero_efforts_preventive_maintenance_for_tapped_gravity_drains():
    return np.interp(
        tzero_maintenance_effort_index_for_tapped_gravity_drains(),
        [
            0.091,
            0.142,
            0.142,
            0.142,
            0.192,
            0.192,
            0.192,
            0.221,
            0.221,
            0.221,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.299,
            0.343,
            0.406,
            0.406,
            0.406,
            0.466,
            0.466,
            0.466,
            0.632,
            0.632,
            0.632,
            0.857,
        ],
        [
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.45,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.7,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
            0.95,
        ],
    )


@component.add(
    name="STP proposal to approval timeline",
    units="year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "planning_choice_between_centralised_and_decentralised": 1,
        "approaval_start_time": 3,
        "approval_endtime": 3,
        "time": 2,
        "no_of_stps": 1,
    },
)
def stp_proposal_to_approval_timeline():
    """
    (PULSE ( 0+180, 1 ) + PULSE ( 30 +180 , 1 ) + PULSE ( 60+180 ,1) + PULSE (90+180 , 1) + PULSE ( 120+180,1 ) + PULSE ( 150 +180 , 1 ) + PULSE ( 180+180 , 1 ) + PULSE ( 210+180, 1 ) + PULSE ( 240+180 , 1 ) + PULSE ( 270+180, 1 ) + PULSE ( 365+ 180 , 1 ))
    """
    return if_then_else(
        planning_choice_between_centralised_and_decentralised() == 1,
        lambda: pulse(
            __data["time"],
            integer((approaval_start_time() + approval_endtime() + 1) / 2),
            width=1,
        ),
        lambda: pulse(
            __data["time"],
            approaval_start_time() + 1,
            repeat_time=integer(
                (approval_endtime() - approaval_start_time()) / no_of_stps()
            )
            + 1,
            width=1,
            end=approval_endtime(),
        ),
    )


@component.add(
    name="Tzero maintenance effort index for STPs",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_stp_performance": 1,
        "tzero_coordination_between_agencies_for_stp": 1,
        "tzero_availability_of_appropriate_skill_for_stp": 1,
    },
)
def tzero_maintenance_effort_index_for_stps():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_stp_performance()
        * tzero_coordination_between_agencies_for_stp()
        * tzero_availability_of_appropriate_skill_for_stp()
        / 1000000.0
    )


@component.add(
    name="default unit capital cost of treatment technology",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "planning_choice_between_centralised_and_decentralised": 1,
        "unit_capital_cost_of_centralised_treatment_technology": 1,
        "unit_capital_cost_of_decentralised_treatment_technology": 1,
    },
)
def default_unit_capital_cost_of_treatment_technology():
    return if_then_else(
        planning_choice_between_centralised_and_decentralised() == 1,
        lambda: unit_capital_cost_of_centralised_treatment_technology(),
        lambda: unit_capital_cost_of_decentralised_treatment_technology(),
    )


@component.add(
    name="timeline for tapping from untapped for nongravity based infra",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_stp_capacity_augmentation": 1,
        "decision_for_conveyance_capacity_augmentation": 2,
        "time": 3,
        "time_for_tapping_nongravity_based_infra_and_zero_stp_addition": 1,
        "no_of_stps": 1,
        "total_approval_to_construction_time": 3,
        "planning_choice_between_centralised_and_decentralised": 1,
        "approval_endtime": 3,
        "approaval_start_time": 3,
    },
)
def timeline_for_tapping_from_untapped_for_nongravity_based_infra():
    """
    IF THEN ELSE ( No of drains to be tapped Non gravity based=0, 0 , IF THEN ELSE ( No of drains to be tapped Non gravity based=1 , PULSE ( INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2) , 1 ) , PULSE TRAIN ( approaval start time+1+total approval to construction time *365 , 1, INTEGER ((approval endtime-approaval start time)/(No of drains to be tapped Non gravity based))+1, approval endtime+total approval to construction time *365 )))
    """
    return if_then_else(
        np.logical_and(
            decision_for_stp_capacity_augmentation() == 0,
            decision_for_conveyance_capacity_augmentation() == 1,
        ),
        lambda: pulse(
            __data["time"],
            integer(
                time_for_tapping_nongravity_based_infra_and_zero_stp_addition() * 365
            ),
            width=1,
        ),
        lambda: if_then_else(
            np.logical_and(
                decision_for_conveyance_capacity_augmentation() == 1,
                planning_choice_between_centralised_and_decentralised() == 1,
            ),
            lambda: pulse(
                __data["time"],
                integer(
                    (approaval_start_time() + approval_endtime()) / 2
                    + total_approval_to_construction_time() * 365
                ),
                width=1,
            ),
            lambda: pulse(
                __data["time"],
                approaval_start_time()
                + 1
                + integer(total_approval_to_construction_time() * 365),
                repeat_time=integer(
                    (approval_endtime() - approaval_start_time()) / no_of_stps()
                )
                + 1,
                width=1,
                end=approval_endtime()
                + integer(total_approval_to_construction_time() * 365),
            ),
        ),
    )


@component.add(
    name="Tzero maintenance effort index for tapped nongravity drains",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance": 1,
        "tzero_coordination_between_agencies_for_tapped_nongravity_drains": 1,
        "tzero_availability_of_appropriate_skill_for_tapped_nongravity_drains": 1,
    },
)
def tzero_maintenance_effort_index_for_tapped_nongravity_drains():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_tapped_nongravity_drains_performance()
        * tzero_coordination_between_agencies_for_tapped_nongravity_drains()
        * tzero_availability_of_appropriate_skill_for_tapped_nongravity_drains()
        / 1000000.0
    )


@component.add(
    name="tapping annual OandM cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "change_in_maintenance_of_tapped_gravity_network": 1,
        "change_in_maintenance_of_tapped_nongravity_network": 1,
        "decision_for_conveyance_capacity_augmentation": 1,
        "time": 3,
        "time_for_changing_maintentance_effort_for_tapped_gravity": 1,
        "per_capita_sewage": 1,
        "population_discharging_to_nongravity_based_tapped_infra_at_t_zero": 1,
        "bau_oandm_cost_for_tapped_network": 5,
        "unit_cost_of_tapping_oandm": 3,
        "time_for_changing_maintentance_effort_for_tapped_nongravity": 1,
        "time_for_tapping_gravity_based_infra_and_zero_stp_addition": 1,
        "total_time_for_tapped_network_augmentation_when_treatment_capacity_augmentation": 1,
        "decision_for_stp_capacity_augmentation": 1,
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 2,
        "sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population": 2,
        "time_for_tapping_nongravity_based_infra_and_zero_stp_addition": 1,
    },
)
def tapping_annual_oandm_cost():
    return if_then_else(
        np.logical_and(
            np.logical_or(
                change_in_maintenance_of_tapped_gravity_network() == 1,
                change_in_maintenance_of_tapped_nongravity_network() == 1,
            ),
            decision_for_conveyance_capacity_augmentation() == 0,
        ),
        lambda: if_then_else(
            time()
            > float(
                np.maximum(
                    time_for_changing_maintentance_effort_for_tapped_gravity() * 365,
                    time_for_changing_maintentance_effort_for_tapped_nongravity() * 365,
                )
            ),
            lambda: population_discharging_to_nongravity_based_tapped_infra_at_t_zero()
            * per_capita_sewage()
            * unit_cost_of_tapping_oandm()
            / 365,
            lambda: bau_oandm_cost_for_tapped_network() / 365,
        ),
        lambda: if_then_else(
            decision_for_stp_capacity_augmentation() == 1,
            lambda: if_then_else(
                time()
                > total_time_for_tapped_network_augmentation_when_treatment_capacity_augmentation(),
                lambda: (
                    sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population()
                    + sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
                )
                * unit_cost_of_tapping_oandm()
                / 365
                + bau_oandm_cost_for_tapped_network() / 365,
                lambda: bau_oandm_cost_for_tapped_network() / 365,
            ),
            lambda: if_then_else(
                time()
                > float(
                    np.maximum(
                        time_for_tapping_gravity_based_infra_and_zero_stp_addition()
                        * 365,
                        time_for_tapping_nongravity_based_infra_and_zero_stp_addition()
                        * 365,
                    )
                ),
                lambda: (
                    sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population()
                    + sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
                )
                * unit_cost_of_tapping_oandm()
                / 365
                + bau_oandm_cost_for_tapped_network() / 365,
                lambda: bau_oandm_cost_for_tapped_network() / 365,
            ),
        ),
    )


@component.add(
    name="Land acquisition delay", comp_type="Constant", comp_subtype="Normal"
)
def land_acquisition_delay():
    return 0.5


@component.add(
    name="Unit OandM cost of decentralised treatment technology",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"technology_choice": 1},
)
def unit_oandm_cost_of_decentralised_treatment_technology():
    return np.interp(
        technology_choice(),
        [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0],
        [0.01, 0.02, 0.03, 0.07, 0.07, 0.11, 0.02, 0.1, 0.15, 0.08, 0.02],
    )


@component.add(
    name="pumping station annual OandM cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "additional_pump_required": 1,
        "unit_cost_of_pumping_station_oandm": 2,
        "time": 1,
        "bau_oandm_cost_for_pumps": 2,
        "installed_pumping_capacity": 2,
        "time_for_changing_maintentance_effort_for_pumps": 1,
        "pumping_capacity_at_t_zero": 1,
    },
)
def pumping_station_annual_oandm_cost():
    return if_then_else(
        additional_pump_required() == 0,
        lambda: if_then_else(
            time() < time_for_changing_maintentance_effort_for_pumps() * 365,
            lambda: bau_oandm_cost_for_pumps() / 365,
            lambda: installed_pumping_capacity()
            * unit_cost_of_pumping_station_oandm()
            / 365,
        ),
        lambda: (installed_pumping_capacity() - pumping_capacity_at_t_zero())
        * unit_cost_of_pumping_station_oandm()
        / 365
        + bau_oandm_cost_for_pumps() / 365,
    )


@component.add(
    name="Unit cost of STP OandM",
    units="(INR cr/(ML/day))/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "user_input_oandm_cost_for_treatment_technology": 2,
        "default_unit_oandm_cost_of_treatment_technology": 1,
    },
)
def unit_cost_of_stp_oandm():
    """
    {Unit cost is taken as weighted avg for centralises and decentralised STPs}
    """
    return if_then_else(
        user_input_oandm_cost_for_treatment_technology() == 0,
        lambda: default_unit_oandm_cost_of_treatment_technology(),
        lambda: user_input_oandm_cost_for_treatment_technology(),
    )


@component.add(
    name="Tzero maintenance effort index for tapped gravity drains",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance": 1,
        "tzero_coordination_between_agencies_for_tapped_gravity_drains": 1,
        "tzero_availability_of_appropriate_skill_for_tapped_gravity_drains": 1,
    },
)
def tzero_maintenance_effort_index_for_tapped_gravity_drains():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_tapped_gravity_drains_performance()
        * tzero_coordination_between_agencies_for_tapped_gravity_drains()
        * tzero_availability_of_appropriate_skill_for_tapped_gravity_drains()
        / 1000000.0
    )


@component.add(
    name="Unit cost of STP construction",
    units="(INR/(ML/day))",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "user_input_capital_cost_for_treatment_technology": 2,
        "default_unit_capital_cost_of_treatment_technology": 1,
    },
)
def unit_cost_of_stp_construction():
    return if_then_else(
        user_input_capital_cost_for_treatment_technology() == 0,
        lambda: default_unit_capital_cost_of_treatment_technology(),
        lambda: user_input_capital_cost_for_treatment_technology(),
    )


@component.add(
    name="user input OandM cost for treatment technology",
    comp_type="Constant",
    comp_subtype="Normal",
)
def user_input_oandm_cost_for_treatment_technology():
    return 0


@component.add(
    name="Planning choice between centralised and decentralised",
    units="Dmnl",
    comp_type="Constant",
    comp_subtype="Normal",
)
def planning_choice_between_centralised_and_decentralised():
    """
    Value of variable to be 1 if centralised planning and 2 if decentralised planning
    """
    return 1


@component.add(
    name="user input capital cost for treatment technology",
    comp_type="Constant",
    comp_subtype="Normal",
)
def user_input_capital_cost_for_treatment_technology():
    return 0


@component.add(
    name="timeline for tapping from untapped for gravity based infra",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_stp_capacity_augmentation": 1,
        "decision_for_conveyance_capacity_augmentation": 2,
        "time_for_tapping_gravity_based_infra_and_zero_stp_addition": 1,
        "time": 3,
        "no_of_stps": 1,
        "total_approval_to_construction_time": 3,
        "planning_choice_between_centralised_and_decentralised": 1,
        "approval_endtime": 3,
        "approaval_start_time": 3,
    },
)
def timeline_for_tapping_from_untapped_for_gravity_based_infra():
    """
    (PULSE ( 0+180+365, 1 ) + PULSE ( 30 +180+365 , 1 ) + PULSE ( 60+180+365 ,1) + PULSE (90+180+365 , 1) + PULSE ( 120+180+365,1 ) + PULSE ( 150 +180 +365, 1 ) + PULSE ( 180+180 +365, 1 ) + PULSE ( 210+180+365, 1 ) + PULSE ( 240+180+365 , 1 ) + PULSE ( 270+180+365, 1 ) + PULSE ( 365+180+365, 1 )) PULSE (approval endtime+total approval to construction time*365 , 1) IF THEN ELSE ( No of drains to be tapped gravity based=0, 0 , IF THEN ELSE ( No of drains to be tapped gravity based=1 , PULSE ( INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2) , 1 ) , PULSE TRAIN (approaval start time+1 + total approval to construction time *365 , 1, INTEGER ((approval endtime-approaval start time)/(No of drains to be tapped gravity based))+1, approval endtime+total approval to construction time*365 )))
    """
    return if_then_else(
        np.logical_and(
            decision_for_stp_capacity_augmentation() == 0,
            decision_for_conveyance_capacity_augmentation() == 1,
        ),
        lambda: pulse(
            __data["time"],
            integer(time_for_tapping_gravity_based_infra_and_zero_stp_addition() * 365),
            width=1,
        ),
        lambda: if_then_else(
            np.logical_and(
                decision_for_conveyance_capacity_augmentation() == 1,
                planning_choice_between_centralised_and_decentralised() == 1,
            ),
            lambda: pulse(
                __data["time"],
                integer(
                    (approaval_start_time() + approval_endtime()) / 2
                    + total_approval_to_construction_time() * 365
                ),
                width=1,
            ),
            lambda: pulse(
                __data["time"],
                approaval_start_time()
                + 1
                + integer(total_approval_to_construction_time() * 365),
                repeat_time=integer(
                    (approval_endtime() - approaval_start_time()) / no_of_stps()
                )
                + 1,
                width=1,
                end=approval_endtime()
                + integer(total_approval_to_construction_time() * 365),
            ),
        ),
    )


@component.add(
    name="total approval to construction time",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "approval_to_underconstruction_time": 1,
        "underconstruction_time": 1,
        "budget_allocation_delay": 1,
        "land_acquisition_delay": 1,
        "operational_clearance_time": 1,
    },
)
def total_approval_to_construction_time():
    return (
        approval_to_underconstruction_time()
        + underconstruction_time()
        + budget_allocation_delay()
        + land_acquisition_delay()
        + operational_clearance_time()
    )


@component.add(name="Technology choice", comp_type="Constant", comp_subtype="Normal")
def technology_choice():
    return 5


@component.add(
    name="unit capital cost of centralised treatment technology",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"technology_choice": 1},
)
def unit_capital_cost_of_centralised_treatment_technology():
    return np.interp(
        technology_choice(),
        [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0],
        [0.45, 0.45, 0.29, 0.38, 0.4, 0.81, 0.52, 0.35, 0.7, 0.42, 0.36],
    )


@component.add(
    name="Total sewage generation at Tzero",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"total_population_at_tzero": 1, "per_capita_sewage": 1},
)
def total_sewage_generation_at_tzero():
    return total_population_at_tzero() * per_capita_sewage()


@component.add(
    name="decision for change in Maintenance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def decision_for_change_in_maintenance():
    return 0


@component.add(
    name="decision for conveyance capacity augmentation",
    comp_type="Constant",
    comp_subtype="Normal",
)
def decision_for_conveyance_capacity_augmentation():
    return 0


@component.add(
    name="decision for STP capacity augmentation",
    comp_type="Constant",
    comp_subtype="Normal",
)
def decision_for_stp_capacity_augmentation():
    return 0


@component.add(
    name="Total OandM cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_oandm_cost_of_new_pumping_station": 1,
        "total_oandm_cost_of_new_sewer_network": 1,
        "total_oandm_cost_of_new_stp": 1,
        "total_oandm_cost_of_new_tapping": 1,
    },
)
def total_oandm_cost():
    return (
        total_oandm_cost_of_new_pumping_station()
        + total_oandm_cost_of_new_sewer_network()
        + total_oandm_cost_of_new_stp()
        + total_oandm_cost_of_new_tapping()
    )


@component.add(
    name="BAU OandM cost for pumps", comp_type="Constant", comp_subtype="Normal"
)
def bau_oandm_cost_for_pumps():
    return 1.4


@component.add(
    name="BAU OandM cost for STPs", comp_type="Constant", comp_subtype="Normal"
)
def bau_oandm_cost_for_stps():
    return 28.47


@component.add(
    name="BAU OandM cost for tapped network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def bau_oandm_cost_for_tapped_network():
    return 4


@component.add(
    name="STP age increment",
    units="day/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"stp_installed_capacity": 1},
)
def stp_age_increment():
    return if_then_else(stp_installed_capacity() == 0, lambda: 0, lambda: 1 / 365)


@component.add(
    name='"new tapping (nongravity)"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_nongravity_based_tapped_infra": 1,
        "tapped_drain_nongravity_average_age": 1,
        "per_capita_sewage": 1,
        "non_gravity_based_tapping": 1,
        "conveyance_through_tapped_drains_nongravity": 2,
    },
)
def new_tapping_nongravity():
    return if_then_else(
        population_discharging_to_nongravity_based_tapped_infra() == 0,
        lambda: 0,
        lambda: tapped_drain_nongravity_average_age()
        * (
            1
            - conveyance_through_tapped_drains_nongravity()
            / (
                conveyance_through_tapped_drains_nongravity()
                + non_gravity_based_tapping() * per_capita_sewage()
            )
        ),
    )


@component.add(
    name='"tapped drain (nongravity) age increament"',
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"population_discharging_to_nongravity_based_tapped_infra": 1},
)
def tapped_drain_nongravity_age_increament():
    return if_then_else(
        population_discharging_to_nongravity_based_tapped_infra() == 0,
        lambda: 0,
        lambda: 1 / 365,
    )


@component.add(
    name="time for pumping capacity addition when zero tapped nongravity addition",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition():
    return 0


@component.add(
    name="STP capital cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "stp_unit_size": 1,
        "unit_cost_of_stp_construction": 1,
        "stp_proposal_to_approval_timeline": 1,
    },
)
def stp_capital_cost():
    return (
        stp_unit_size()
        * unit_cost_of_stp_construction()
        * stp_proposal_to_approval_timeline()
    )


@component.add(
    name="pump age increment",
    units="year/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"installed_pumping_capacity": 1},
)
def pump_age_increment():
    return if_then_else(installed_pumping_capacity() == 0, lambda: 0, lambda: 1 / 365)


@component.add(
    name="sewer age increment",
    units="year/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"conveyance_through_sewer_network_connected_to_stp": 1},
)
def sewer_age_increment():
    return if_then_else(
        conveyance_through_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: 1 / 365,
    )


@component.add(
    name="new STP",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "stp_installed_capacity": 3,
        "stp_average_age": 1,
        "stp_capacity_addition": 1,
    },
)
def new_stp():
    return if_then_else(
        stp_installed_capacity() == 0,
        lambda: 0,
        lambda: stp_average_age()
        * (
            1
            - stp_installed_capacity()
            / (stp_installed_capacity() + stp_capacity_addition())
        ),
    )


@component.add(
    name="pump addition timeline",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 1,
        "time": 1,
        "time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition": 1,
        "timeline_for_tapping_from_untapped_for_nongravity_based_infra": 1,
    },
)
def pump_addition_timeline():
    """
    IF THEN ELSE ( No of Pumps required=0, 0 , IF THEN ELSE ( No of Pumps required=1 , PULSE ( INTEGER((approaval start time+approval endtime + 2*total approval to construction time *365)/2) , 1 ), PULSE TRAIN (approaval start time+1 + total approval to construction time *365 , 1, INTEGER ((approval endtime-approaval start time)/(No of Pumps required))+1, approval endtime +total approval to construction time*365))) ——————————— IF THEN ELSE ( No of STPs=0, PULSE(INTEGER(time for tapping nongravity based infra and zero STP addition*365),1), IF THEN ELSE ( No of STPs=1 , PULSE ( (INTEGER ((approaval start time+approval endtime)/2 + total approval to construction time*365) ) , 1) , PULSE TRAIN (approaval start time+1 + total approval to construction time *365 , 1, INTEGER ((approval endtime-approaval start time)/(No of STPs))+1, approval endtime + INTEGER(total approval to construction time*365) )))
    """
    return if_then_else(
        sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
        == 0,
        lambda: pulse(
            __data["time"],
            integer(
                time_for_pumping_capacity_addition_when_zero_tapped_nongravity_addition()
                * 365
            ),
            width=1,
        ),
        lambda: timeline_for_tapping_from_untapped_for_nongravity_based_infra(),
    )


@component.add(
    name="at Tzero overflows from tapped drains",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Initial",
    depends_on={"_initial_at_tzero_overflows_from_tapped_drains": 1},
    other_deps={
        "_initial_at_tzero_overflows_from_tapped_drains": {
            "initial": {
                "overflows_from_tapped_drains_nongravity_to_river": 1,
                "overflows_from_tapped_draingravity_to_river": 1,
            },
            "step": {},
        }
    },
)
def at_tzero_overflows_from_tapped_drains():
    return _initial_at_tzero_overflows_from_tapped_drains()


_initial_at_tzero_overflows_from_tapped_drains = Initial(
    lambda: overflows_from_tapped_drains_nongravity_to_river()
    + overflows_from_tapped_draingravity_to_river(),
    "_initial_at_tzero_overflows_from_tapped_drains",
)


@component.add(
    name="per STP population to be tapped on nongravity based infra from untapped population",
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "no_of_stps": 2,
        "per_capita_sewage": 2,
        "sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 2,
    },
)
def per_stp_population_to_be_tapped_on_nongravity_based_infra_from_untapped_population():
    return if_then_else(
        no_of_stps() > 0,
        lambda: (
            sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
        / per_capita_sewage(),
    )


@component.add(
    name="Efforts preventive maintenance for Pumpstations",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_pumps": 1,
        "tzero_efforts_preventive_maintenance_for_pumps": 1,
        "input_efforts_preventive_maintenance_for_pumps": 1,
    },
)
def efforts_preventive_maintenance_for_pumpstations():
    return if_then_else(
        time() < integer(time_for_changing_maintentance_effort_for_pumps() * 365),
        lambda: tzero_efforts_preventive_maintenance_for_pumps(),
        lambda: input_efforts_preventive_maintenance_for_pumps(),
    )


@component.add(
    name="efforts preventive maintenance for STPs",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_stp": 1,
        "tzero_efforts_preventive_maintenance_for_stps": 1,
        "input_efforts_preventive_maintenance_for_stps": 1,
    },
)
def efforts_preventive_maintenance_for_stps():
    return if_then_else(
        time() < integer(time_for_changing_maintentance_effort_for_stp() * 365),
        lambda: tzero_efforts_preventive_maintenance_for_stps(),
        lambda: input_efforts_preventive_maintenance_for_stps(),
    )


@component.add(
    name="at Tzero flow from untapped drains",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_untapped_drains_area_at_t_zero": 1,
        "per_capita_sewage": 1,
    },
)
def at_tzero_flow_from_untapped_drains():
    return population_in_untapped_drains_area_at_t_zero() * per_capita_sewage()


@component.add(
    name="at Tzero gap between sewage generation and installed STP capacity",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "per_capita_sewage": 1,
        "stp_installed_capacity_at_t_zero": 1,
    },
)
def at_tzero_gap_between_sewage_generation_and_installed_stp_capacity():
    return (
        total_population_at_tzero() * per_capita_sewage()
        - stp_installed_capacity_at_t_zero()
    )


@component.add(
    name='"Efforts preventive maintenance for tapped drains (gravity)"',
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_tapped_gravity": 1,
        "tzero_efforts_preventive_maintenance_for_tapped_gravity_drains": 1,
        "input_efforts_preventive_maintenance_for_tapped_gravity_drains": 1,
    },
)
def efforts_preventive_maintenance_for_tapped_drains_gravity():
    """
    IF THEN ELSE ( No of drains to be tapped gravity based=0, Tzero efforts preventive maintenance for tapped gravity drains , IF THEN ELSE ( No of drains to be tapped gravity based=1 , IF THEN ELSE ( Time<INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2), Tzero efforts preventive maintenance for tapped gravity drains , input efforts preventive maintenance for tapped gravity drains ) , IF THEN ELSE ( Time<approaval start time+1 + total approval to construction time *365, Tzero efforts preventive maintenance for tapped gravity drains , input efforts preventive maintenance for tapped gravity drains ) ) ) ———————— IF THEN ELSE ( No of STPs=0, IF THEN ELSE( Time< INTEGER(time for changing maintentance effort STP zero condition for tapped gravity*365), Tzero efforts preventive maintenance for tapped gravity drains, input efforts preventive maintenance for tapped gravity drains), IF THEN ELSE ( No of STPs=1 , IF THEN ELSE ( Time<INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2), Tzero efforts preventive maintenance for tapped gravity drains , input efforts preventive maintenance for tapped gravity drains ) , IF THEN ELSE ( Time<approaval start time+1 + INTEGER(total approval to construction time *365), Tzero efforts preventive maintenance for tapped gravity drains, input efforts preventive maintenance for tapped gravity drains ) ) )
    """
    return if_then_else(
        time()
        < integer(time_for_changing_maintentance_effort_for_tapped_gravity() * 365),
        lambda: tzero_efforts_preventive_maintenance_for_tapped_gravity_drains(),
        lambda: input_efforts_preventive_maintenance_for_tapped_gravity_drains(),
    )


@component.add(
    name='"efforts preventive maintenance for tapped drains (nongravity)"',
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_tapped_nongravity": 1,
        "tzero_efforts_preventive_maintenance_for_tapped_nongravity_drains": 1,
        "input_efforts_preventive_maintenance_for_tapped_nongravity_drains": 1,
    },
)
def efforts_preventive_maintenance_for_tapped_drains_nongravity():
    """
    {545 represents the time at which first tapping is done before that the performance should be as it is without intevention} IF THEN ELSE (No of drains to be tapped Non gravity based= 0, Tzero efforts preventive maintenance for tapped nongravity drains , IF THEN ELSE ( No of drains to be tapped Non gravity based=1 , IF THEN ELSE ( Time<INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2) , Tzero efforts preventive maintenance for tapped nongravity drains , input efforts preventive maintenance for tapped nongravity drains) , IF THEN ELSE ( Time<approaval start time+1 + total approval to construction time *365, Tzero efforts preventive maintenance for tapped nongravity drains , input efforts preventive maintenance for tapped nongravity drains ) ) ) —————————————————————— IF THEN ELSE (No of STPs=0, IF THEN ELSE( Time< INTEGER(time for changing maintentance effort STP zero condition for tapped nongravity*365), Tzero efforts preventive maintenance for tapped nongravity drains, input efforts preventive maintenance for tapped nongravity drains) , IF THEN ELSE ( No of STPs=1 , IF THEN ELSE ( Time<INTEGER((approaval start time+approval endtime + 2*total approval to construction time*365)/2) , Tzero efforts preventive maintenance for tapped nongravity drains , input efforts preventive maintenance for tapped nongravity drains) , IF THEN ELSE ( Time<approaval start time+1 + INTEGER(total approval to construction time*365), Tzero efforts preventive maintenance for tapped nongravity drains , input efforts preventive maintenance for tapped nongravity drains ) ) )
    """
    return if_then_else(
        time()
        < integer(time_for_changing_maintentance_effort_for_tapped_nongravity() * 365),
        lambda: tzero_efforts_preventive_maintenance_for_tapped_nongravity_drains(),
        lambda: input_efforts_preventive_maintenance_for_tapped_nongravity_drains(),
    )


@component.add(
    name="time for changing maintentance effort for STP",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_stp():
    return 0


@component.add(
    name="time for changing maintentance effort for pumps",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_pumps():
    return 0


@component.add(
    name="time for tapping nongravity based infra and zero STP addition",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_tapping_nongravity_based_infra_and_zero_stp_addition():
    return 0


@component.add(
    name="additional pump required",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def additional_pump_required():
    return 0


@component.add(
    name="time for tapping gravity based infra and zero STP addition",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_tapping_gravity_based_infra_and_zero_stp_addition():
    return 0


@component.add(
    name="time for changing maintentance effort for tapped gravity",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_tapped_gravity():
    return 0


@component.add(
    name="time for changing maintentance effort for tapped nongravity",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_tapped_nongravity():
    return 0


@component.add(
    name="proposal to approval avg time",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def proposal_to_approval_avg_time():
    return 1


@component.add(
    name="approval endtime",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"approaval_start_time": 1, "proposal_to_approval_avg_time": 1},
)
def approval_endtime():
    return approaval_start_time() + integer(proposal_to_approval_avg_time() * 365)


@component.add(
    name="per STP population to be tapped on gravity based infra from untapped population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "no_of_stps": 2,
        "per_capita_sewage": 2,
        "sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population": 2,
    },
)
def per_stp_population_to_be_tapped_on_gravity_based_infra_from_untapped_population():
    """
    420000 for 2 STP
    """
    return if_then_else(
        no_of_stps() > 0,
        lambda: (
            sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population()
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population()
        / per_capita_sewage(),
    )


@component.add(
    name="sewage flow to be tapped on gravity based infra from untapped population",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_to_be_tapped_on_gravity_based_infra_from_untapped_population():
    """
    420000 for 2 STP
    """
    return 0


@component.add(
    name="sewage flow to be tapped on nongravity based infra from untapped population",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_to_be_tapped_on_nongravity_based_infra_from_untapped_population():
    return 0


@component.add(
    name="effective STP degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_stp_degradation_rate": 1,
        "efforts_preventive_maintenance_for_stps": 1,
    },
)
def effective_stp_degradation_rate():
    return normal_stp_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_stps()
    )


@component.add(
    name="total sewerage generation",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_untapped_drains": 1,
        "conveyance_through_tapped_drainsgravity": 1,
        "conveyance_through_tapped_drains_nongravity": 1,
        "conveyance_through_sewer_network_connected_to_stp": 1,
        "conveyance_through_non_stp_sewer_network": 1,
        "sewer_water_generation_in_insitu": 1,
    },
)
def total_sewerage_generation():
    return (
        conveyance_through_untapped_drains()
        + conveyance_through_tapped_drainsgravity()
        + conveyance_through_tapped_drains_nongravity()
        + conveyance_through_sewer_network_connected_to_stp()
        + conveyance_through_non_stp_sewer_network()
        + sewer_water_generation_in_insitu()
    )


@component.add(
    name='"Population in Non-STP sewer network area at t zero"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_in_nonstp_sewer_network_area_at_t_zero": 1,
    },
)
def population_in_nonstp_sewer_network_area_at_t_zero():
    return (
        total_population_at_tzero()
        * percentage_population_in_nonstp_sewer_network_area_at_t_zero()
        / 100
    )


@component.add(
    name="per capita sewage",
    units="(ML/day)/people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"per_capita_sewage_generationlpcd": 1},
)
def per_capita_sewage():
    return per_capita_sewage_generationlpcd() / 1000000.0


@component.add(
    name="OandM cost for BAU",
    units="INR cr",
    comp_type="Constant",
    comp_subtype="Normal",
)
def oandm_cost_for_bau():
    return 338


@component.add(
    name="OandM cost time period", comp_type="Constant", comp_subtype="Normal"
)
def oandm_cost_time_period():
    return 10


@component.add(
    name="Population in untapped drains area at t zero",
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_in_untapped_drains_area_at_t_zero": 1,
    },
)
def population_in_untapped_drains_area_at_t_zero():
    """
    814815
    """
    return (
        total_population_at_tzero()
        * percentage_population_in_untapped_drains_area_at_t_zero()
        / 100
    )


@component.add(
    name='"Population discharging to non-gravity based tapped infra at t zero"',
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero": 1,
    },
)
def population_discharging_to_nongravity_based_tapped_infra_at_t_zero():
    """
    837037
    """
    return (
        total_population_at_tzero()
        * percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero()
        / 100
    )


@component.add(
    name="Percentage population in untapped drains area at t zero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_in_untapped_drains_area_at_t_zero():
    return 31


@component.add(
    name='"per capita sewage generation(LPCD)"',
    units="l/(day*people)",
    comp_type="Constant",
    comp_subtype="Normal",
)
def per_capita_sewage_generationlpcd():
    return 135


@component.add(
    name='"population growth rate in non-gravity based STP connected sewer network"',
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_in_nongravity_based_stp_connected_sewer_network():
    return 0.02


@component.add(
    name="Percentage population discharging to gravity based tapped infra at t zero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero():
    return 0


@component.add(
    name='"percentage population in in-situ area at t zero"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_in_insitu_area_at_t_zero():
    return 0


@component.add(
    name='"Percentage population in Non-STP sewer network area at t zero"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_in_nonstp_sewer_network_area_at_t_zero():
    return 0


@component.add(
    name='"population in in-situ area at t zero"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_in_insitu_area_at_t_zero": 1,
    },
)
def population_in_insitu_area_at_t_zero():
    return (
        total_population_at_tzero()
        * percentage_population_in_insitu_area_at_t_zero()
        / 100
    )


@component.add(
    name="Population discharging to gravity based tapped infra at t zero",
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero": 1,
    },
)
def population_discharging_to_gravity_based_tapped_infra_at_t_zero():
    return (
        total_population_at_tzero()
        * percentage_population_discharging_to_gravity_based_tapped_infra_at_t_zero()
        / 100
    )


@component.add(
    name='"Population discharging to non-gravity based STP connected sewer network at t zero"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero": 1,
        "total_population_at_tzero": 1,
    },
)
def population_discharging_to_nongravity_based_stp_connected_sewer_network_at_t_zero():
    """
    592593
    """
    return (
        percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero()
        * total_population_at_tzero()
        / 100
    )


@component.add(
    name="Population discharging to gravity based STP connected sewer network at t zero",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_population_at_tzero": 1,
        "percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero": 1,
    },
)
def population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero():
    """
    400000
    """
    return (
        total_population_at_tzero()
        * percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero()
        / 100
    )


@component.add(
    name='"Percentage population discharging to non-gravity based tapped infra at t zero"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_discharging_to_nongravity_based_tapped_infra_at_t_zero():
    return 32


@component.add(
    name="Total Population at Tzero",
    units="people",
    comp_type="Constant",
    comp_subtype="Normal",
)
def total_population_at_tzero():
    return 2644440.0


@component.add(
    name="Percentage population discharging to gravity based STP connected sewer network at t zero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero():
    return 22


@component.add(
    name="percentage population in nongravity based STP connected sewer network at T zero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def percentage_population_in_nongravity_based_stp_connected_sewer_network_at_t_zero():
    return 15


@component.add(
    name='"tapped drain (gravity) age increment"',
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"population_discharging_to_gravity_based_tapped_infra": 1},
)
def tapped_drain_gravity_age_increment():
    return if_then_else(
        population_discharging_to_gravity_based_tapped_infra() == 0,
        lambda: 0,
        lambda: 1 / 365,
    )


@component.add(
    name='"Tapped drain (gravity) average age"',
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_tapped_drain_gravity_average_age": 1},
    other_deps={
        "_integ_tapped_drain_gravity_average_age": {
            "initial": {},
            "step": {"tapped_drain_gravity_age_increment": 1, "new_tapping_gravity": 1},
        }
    },
)
def tapped_drain_gravity_average_age():
    return _integ_tapped_drain_gravity_average_age()


_integ_tapped_drain_gravity_average_age = Integ(
    lambda: tapped_drain_gravity_age_increment() - new_tapping_gravity(),
    lambda: 0,
    "_integ_tapped_drain_gravity_average_age",
)


@component.add(
    name='"tapped drain (gravity) degradation"',
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conditions_of_screens_in_tapped_drains_gravity": 1,
        "effective_tapped_drain_gravity_degradation_rate": 1,
    },
)
def tapped_drain_gravity_degradation():
    return (
        conditions_of_screens_in_tapped_drains_gravity()
        * effective_tapped_drain_gravity_degradation_rate()
        / 365
    )


@component.add(
    name='"tapped drain (gravity) rehabilitation"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def tapped_drain_gravity_rehabilitation():
    return 0


@component.add(
    name='"tapped drain (gravity) to STP"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drainsgravity": 1,
        "overflows_from_tapped_draingravity_to_river": 1,
    },
)
def tapped_drain_gravity_to_stp():
    return (
        conveyance_through_tapped_drainsgravity()
        - overflows_from_tapped_draingravity_to_river()
    )


@component.add(
    name='"normal tapped drain (gravity) degradation rate"',
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tapped_drain_gravity_average_age": 1},
)
def normal_tapped_drain_gravity_degradation_rate():
    return np.interp(
        tapped_drain_gravity_average_age(),
        [
            0.00000e00,
            9.03610e-02,
            1.56627e-01,
            2.40964e-01,
            3.01205e-01,
            3.55422e-01,
            4.06626e-01,
            4.48795e-01,
            5.00000e-01,
            5.81325e-01,
            6.74699e-01,
            7.71084e-01,
            8.58434e-01,
            9.33735e-01,
            1.00000e00,
            1.12952e00,
            1.25000e00,
            2.00000e00,
            3.00000e00,
            1.00000e02,
        ],
        [
            0.0,
            0.038235,
            0.097059,
            0.211765,
            0.305882,
            0.408824,
            0.508824,
            0.608824,
            0.717647,
            0.814706,
            0.879412,
            0.935294,
            0.973529,
            0.988235,
            0.99,
            0.991176,
            1.0,
            1.0,
            1.0,
            1.0,
        ],
    )


@component.add(
    name="total outflow from tapped drains",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "overflows_from_tapped_drains_nongravity_to_river": 1,
        "tapped_drain_to_stp": 1,
        "overflows_from_tapped_draingravity_to_river": 1,
    },
)
def total_outflow_from_tapped_drains():
    return (
        overflows_from_tapped_drains_nongravity_to_river()
        + tapped_drain_to_stp()
        + overflows_from_tapped_draingravity_to_river()
    )


@component.add(
    name='"condition of screens in newly added tapping (gravity) infra"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_of_screens_in_newly_added_tapping_gravity_infra():
    return 100


@component.add(
    name="tapped drain to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"tapped_drain_gravity_to_stp": 1, "tapped_drains_nongravity_to_ps": 1},
)
def tapped_drain_to_stp():
    return tapped_drain_gravity_to_stp() + tapped_drains_nongravity_to_ps()


@component.add(
    name='"tapped drains (nongravity) to PS"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drains_nongravity": 1,
        "discharge_from_non_stp_sewer_network_to_tapped_drain": 1,
        "overflows_from_tapped_drains_nongravity_to_river": 1,
    },
)
def tapped_drains_nongravity_to_ps():
    return (
        conveyance_through_tapped_drains_nongravity()
        + discharge_from_non_stp_sewer_network_to_tapped_drain()
        - overflows_from_tapped_drains_nongravity_to_river()
    )


@component.add(
    name='"effective tapped drain (gravity) degradation rate"',
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_tapped_drain_gravity_degradation_rate": 1,
        "efforts_preventive_maintenance_for_tapped_drains_gravity": 1,
    },
)
def effective_tapped_drain_gravity_degradation_rate():
    return normal_tapped_drain_gravity_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_tapped_drains_gravity()
    )


@component.add(
    name='"untreated wastewater discharge from STP other drain/canal"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "ps_to_stp": 1,
        "gravity_based_flow_from_sewer_to_stp": 1,
        "sewage_water_from_diversion_to_stp": 1,
        "tapped_drain_gravity_to_stp": 1,
        "treatment": 1,
        "fraction_of_untreated_sewage_discharge_from_stp_to_other_drainscanal": 1,
    },
)
def untreated_wastewater_discharge_from_stp_other_draincanal():
    return (
        ps_to_stp()
        + gravity_based_flow_from_sewer_to_stp()
        + sewage_water_from_diversion_to_stp()
        + tapped_drain_gravity_to_stp()
        - treatment()
    ) * fraction_of_untreated_sewage_discharge_from_stp_to_other_drainscanal()


@component.add(
    name="treatment",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "ps_to_stp": 1,
        "sewage_water_from_diversion_to_stp": 1,
        "gravity_based_flow_from_sewer_to_stp": 1,
        "tapped_drain_gravity_to_stp": 1,
        "stp_installed_capacity": 1,
        "condition_of_stp": 1,
    },
)
def treatment():
    return float(
        np.minimum(
            ps_to_stp()
            + sewage_water_from_diversion_to_stp()
            + gravity_based_flow_from_sewer_to_stp()
            + tapped_drain_gravity_to_stp(),
            stp_installed_capacity() * (condition_of_stp() / 100),
        )
    )


@component.add(
    name='"condition change due to new tapping (gravity)"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drainsgravity": 3,
        "gravity_based_tapping": 2,
        "per_capita_sewage": 2,
        "conditions_of_screens_in_tapped_drains_gravity": 2,
        "condition_of_screens_in_newly_added_tapping_gravity_infra": 1,
    },
)
def condition_change_due_to_new_tapping_gravity():
    return if_then_else(
        conveyance_through_tapped_drainsgravity() == 0,
        lambda: 0,
        lambda: (
            conditions_of_screens_in_tapped_drains_gravity()
            * conveyance_through_tapped_drainsgravity()
            + condition_of_screens_in_newly_added_tapping_gravity_infra()
            * gravity_based_tapping()
            * per_capita_sewage()
        )
        / (
            conveyance_through_tapped_drainsgravity()
            + gravity_based_tapping() * per_capita_sewage()
        )
        - conditions_of_screens_in_tapped_drains_gravity(),
    )


@component.add(
    name='"condition change due to new tapping (nongravity)"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drains_nongravity": 3,
        "condition_of_screens_in_newly_added_tapping_nongravity_infra": 1,
        "conditions_of_screens_in_tapped_drains_nongravity": 2,
        "per_capita_sewage": 2,
        "non_gravity_based_tapping": 2,
    },
)
def condition_change_due_to_new_tapping_nongravity():
    return if_then_else(
        conveyance_through_tapped_drains_nongravity() == 0,
        lambda: 0,
        lambda: (
            conditions_of_screens_in_tapped_drains_nongravity()
            * conveyance_through_tapped_drains_nongravity()
            + condition_of_screens_in_newly_added_tapping_nongravity_infra()
            * non_gravity_based_tapping()
            * per_capita_sewage()
        )
        / (
            conveyance_through_tapped_drains_nongravity()
            + non_gravity_based_tapping() * per_capita_sewage()
        )
        - conditions_of_screens_in_tapped_drains_nongravity(),
    )


@component.add(
    name="ratio of tapped drain to STP and discharge through tapped drains",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"tapped_drain_to_stp": 1, "total_inflow_to_tapped_drains": 1},
)
def ratio_of_tapped_drain_to_stp_and_discharge_through_tapped_drains():
    return tapped_drain_to_stp() / total_inflow_to_tapped_drains()


@component.add(
    name='"new tapping (gravity)"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_tapped_infra": 1,
        "conveyance_through_tapped_drainsgravity": 2,
        "gravity_based_tapping": 1,
        "per_capita_sewage": 1,
        "tapped_drain_gravity_average_age": 1,
    },
)
def new_tapping_gravity():
    return if_then_else(
        population_discharging_to_gravity_based_tapped_infra() == 0,
        lambda: 0,
        lambda: tapped_drain_gravity_average_age()
        * (
            1
            - conveyance_through_tapped_drainsgravity()
            / (
                conveyance_through_tapped_drainsgravity()
                + gravity_based_tapping() * per_capita_sewage()
            )
        ),
    )


@component.add(
    name='"Conditions of screens in tapped drains (gravity)"',
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_conditions_of_screens_in_tapped_drains_gravity": 1},
    other_deps={
        "_integ_conditions_of_screens_in_tapped_drains_gravity": {
            "initial": {},
            "step": {
                "condition_change_due_to_new_tapping_gravity": 1,
                "tapped_drain_gravity_rehabilitation": 1,
                "tapped_drain_gravity_degradation": 1,
            },
        }
    },
)
def conditions_of_screens_in_tapped_drains_gravity():
    return _integ_conditions_of_screens_in_tapped_drains_gravity()


_integ_conditions_of_screens_in_tapped_drains_gravity = Integ(
    lambda: condition_change_due_to_new_tapping_gravity()
    + tapped_drain_gravity_rehabilitation()
    - tapped_drain_gravity_degradation(),
    lambda: 100,
    "_integ_conditions_of_screens_in_tapped_drains_gravity",
)


@component.add(
    name="total untreated sewage water discharge into river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "untreated_sewage_discharge_from_untapped_drains_to_river": 1,
        "overflows_from_tapped_drains_nongravity_to_river": 1,
        "overflows_from_tapped_draingravity_to_river": 1,
        "overflow_from_ps_to_river": 1,
        "discharge_from_non_stp_sewer_network_to_river": 1,
        "untreated_wastewater_discharge_from_stp_to_varuna": 1,
        "untreated_sewage_from_gw_to_river": 1,
    },
)
def total_untreated_sewage_water_discharge_into_river():
    return (
        untreated_sewage_discharge_from_untapped_drains_to_river()
        + overflows_from_tapped_drains_nongravity_to_river()
        + overflows_from_tapped_draingravity_to_river()
        + overflow_from_ps_to_river()
        + discharge_from_non_stp_sewer_network_to_river()
        + untreated_wastewater_discharge_from_stp_to_varuna()
        + untreated_sewage_from_gw_to_river()
    )


@component.add(
    name="Untreated sewage water entered into River",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_untreated_sewage_water_entered_into_river": 1},
    other_deps={
        "_integ_untreated_sewage_water_entered_into_river": {
            "initial": {},
            "step": {
                "discharge_from_non_stp_sewer_network_to_river": 1,
                "overflow_from_ps_to_river": 1,
                "overflows_from_tapped_draingravity_to_river": 1,
                "overflows_from_tapped_drains_nongravity_to_river": 1,
                "untreated_sewage_discharge_from_untapped_drains_to_river": 1,
                "untreated_sewage_from_gw_to_river": 1,
                "untreated_wastewater_discharge_from_stp_to_varuna": 1,
                "total_untreated_sewage_water_discharge_into_river": 1,
            },
        }
    },
)
def untreated_sewage_water_entered_into_river():
    return _integ_untreated_sewage_water_entered_into_river()


_integ_untreated_sewage_water_entered_into_river = Integ(
    lambda: discharge_from_non_stp_sewer_network_to_river()
    + overflow_from_ps_to_river()
    + overflows_from_tapped_draingravity_to_river()
    + overflows_from_tapped_drains_nongravity_to_river()
    + untreated_sewage_discharge_from_untapped_drains_to_river()
    + untreated_sewage_from_gw_to_river()
    + untreated_wastewater_discharge_from_stp_to_varuna()
    - total_untreated_sewage_water_discharge_into_river(),
    lambda: 0,
    "_integ_untreated_sewage_water_entered_into_river",
)


@component.add(
    name='"overflows from tapped drains (nongravity) to river"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drains_nongravity": 1,
        "discharge_from_non_stp_sewer_network_to_tapped_drain": 1,
        "conditions_of_screens_in_tapped_drains_nongravity": 1,
    },
)
def overflows_from_tapped_drains_nongravity_to_river():
    """
    IF THEN ELSE (conveyance through tapped drains+discharge from Non STP sewer network to tapped drain >tapped drain max capacity*(Conditions of screens in tapped drains/100), (conveyance through tapped drains+discharge from Non STP sewer network to tapped drain - tapped drain max capacity*(Conditions of screens in tapped drains /100) ), (conveyance through tapped drains+discharge from Non STP sewer network to tapped drain)*(1-(Conditions of screens in tapped drains /100)) )
    """
    return (
        conveyance_through_tapped_drains_nongravity()
        + discharge_from_non_stp_sewer_network_to_tapped_drain()
    ) * (1 - conditions_of_screens_in_tapped_drains_nongravity() / 100)


@component.add(
    name="untreated wastewater discharge from STP to varuna",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "ps_to_stp": 1,
        "sewage_water_from_diversion_to_stp": 1,
        "gravity_based_flow_from_sewer_to_stp": 1,
        "tapped_drain_gravity_to_stp": 1,
        "treatment": 1,
        "untreated_wastewater_discharge_from_stp_other_draincanal": 1,
    },
)
def untreated_wastewater_discharge_from_stp_to_varuna():
    return (
        ps_to_stp()
        + sewage_water_from_diversion_to_stp()
        + gravity_based_flow_from_sewer_to_stp()
        + tapped_drain_gravity_to_stp()
        - treatment()
        - untreated_wastewater_discharge_from_stp_other_draincanal()
    )


@component.add(
    name='"Sewage water in tapped drains (Gravity)"',
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_tapped_drains_gravity": 1},
    other_deps={
        "_integ_sewage_water_in_tapped_drains_gravity": {
            "initial": {},
            "step": {
                "conveyance_through_tapped_drainsgravity": 1,
                "overflows_from_tapped_draingravity_to_river": 1,
                "tapped_drain_gravity_to_stp": 1,
            },
        }
    },
)
def sewage_water_in_tapped_drains_gravity():
    return _integ_sewage_water_in_tapped_drains_gravity()


_integ_sewage_water_in_tapped_drains_gravity = Integ(
    lambda: conveyance_through_tapped_drainsgravity()
    - overflows_from_tapped_draingravity_to_river()
    - tapped_drain_gravity_to_stp(),
    lambda: 0,
    "_integ_sewage_water_in_tapped_drains_gravity",
)


@component.add(
    name='"Sewage water in tapped drains (non-gravity)"',
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_tapped_drains_nongravity": 1},
    other_deps={
        "_integ_sewage_water_in_tapped_drains_nongravity": {
            "initial": {},
            "step": {
                "conveyance_through_tapped_drains_nongravity": 1,
                "discharge_from_non_stp_sewer_network_to_tapped_drain": 1,
                "overflows_from_tapped_drains_nongravity_to_river": 1,
                "tapped_drains_nongravity_to_ps": 1,
            },
        }
    },
)
def sewage_water_in_tapped_drains_nongravity():
    return _integ_sewage_water_in_tapped_drains_nongravity()


_integ_sewage_water_in_tapped_drains_nongravity = Integ(
    lambda: conveyance_through_tapped_drains_nongravity()
    + discharge_from_non_stp_sewer_network_to_tapped_drain()
    - overflows_from_tapped_drains_nongravity_to_river()
    - tapped_drains_nongravity_to_ps(),
    lambda: 20,
    "_integ_sewage_water_in_tapped_drains_nongravity",
)


@component.add(
    name="total inflow to tapped drains",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drains_nongravity": 1,
        "conveyance_through_tapped_drainsgravity": 1,
    },
)
def total_inflow_to_tapped_drains():
    return (
        conveyance_through_tapped_drains_nongravity()
        + conveyance_through_tapped_drainsgravity()
    )


@component.add(
    name='"conveyance through tapped drains(gravity)"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_tapped_infra": 1,
        "per_capita_sewage": 1,
    },
)
def conveyance_through_tapped_drainsgravity():
    return population_discharging_to_gravity_based_tapped_infra() * per_capita_sewage()


@component.add(
    name='"conveyance through tapped drains (nongravity)"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_nongravity_based_tapped_infra": 1,
        "per_capita_sewage": 1,
    },
)
def conveyance_through_tapped_drains_nongravity():
    return (
        population_discharging_to_nongravity_based_tapped_infra() * per_capita_sewage()
    )


@component.add(
    name="Sewage water in STP",
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_stp": 1},
    other_deps={
        "_integ_sewage_water_in_stp": {
            "initial": {},
            "step": {
                "gravity_based_flow_from_sewer_to_stp": 1,
                "tapped_drain_gravity_to_stp": 1,
                "ps_to_stp": 1,
                "sewage_water_from_diversion_to_stp": 1,
                "treatment": 1,
                "untreated_wastewater_discharge_from_stp_other_draincanal": 1,
                "untreated_wastewater_discharge_from_stp_to_varuna": 1,
            },
        }
    },
)
def sewage_water_in_stp():
    return _integ_sewage_water_in_stp()


_integ_sewage_water_in_stp = Integ(
    lambda: gravity_based_flow_from_sewer_to_stp()
    + tapped_drain_gravity_to_stp()
    + ps_to_stp()
    + sewage_water_from_diversion_to_stp()
    - treatment()
    - untreated_wastewater_discharge_from_stp_other_draincanal()
    - untreated_wastewater_discharge_from_stp_to_varuna(),
    lambda: 125,
    "_integ_sewage_water_in_stp",
)


@component.add(
    name='"overflows from tapped drain(gravity) to river"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_tapped_drainsgravity": 1,
        "conditions_of_screens_in_tapped_drains_gravity": 1,
    },
)
def overflows_from_tapped_draingravity_to_river():
    return conveyance_through_tapped_drainsgravity() * (
        1 - conditions_of_screens_in_tapped_drains_gravity() / 100
    )


@component.add(
    name="gravity based tapping",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "per_stp_population_to_be_tapped_on_gravity_based_infra_from_untapped_population": 1,
        "timeline_for_tapping_from_untapped_for_gravity_based_infra": 1,
    },
)
def gravity_based_tapping():
    return (
        per_stp_population_to_be_tapped_on_gravity_based_infra_from_untapped_population()
        * timeline_for_tapping_from_untapped_for_gravity_based_infra()
    )


@component.add(
    name="drain tapping",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"gravity_based_tapping": 1, "non_gravity_based_tapping": 1},
)
def drain_tapping():
    return gravity_based_tapping() + non_gravity_based_tapping()


@component.add(name="approaval start time", comp_type="Constant", comp_subtype="Normal")
def approaval_start_time():
    return 180


@component.add(
    name="gravity based STP connected sewer network addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "per_stp_population_to_be_added_to_stp_connected_gravity_sewer_network": 1,
        "timeline_for_stp_connected_gravity_sewer_network_addition": 1,
    },
)
def gravity_based_stp_connected_sewer_network_addition():
    return (
        per_stp_population_to_be_added_to_stp_connected_gravity_sewer_network()
        * timeline_for_stp_connected_gravity_sewer_network_addition()
    )


@component.add(
    name="No of Pumps required",
    units="Dmnl",
    comp_type="Constant",
    comp_subtype="Normal",
)
def no_of_pumps_required():
    return 0


@component.add(
    name="timeline for gravity based STP connected sewer network addition to untapped population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_gravity_based_stp_connected_sewer_network_addition_to_untapped_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="non gravity based STP sewer network connection addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "per_stp_population_to_be_added_to_stp_connected_nongravity_sewer_network": 1,
        "timeline_for_stp_connected_nongravity_sewer_network_addition": 1,
    },
)
def non_gravity_based_stp_sewer_network_connection_addition():
    return (
        per_stp_population_to_be_added_to_stp_connected_nongravity_sewer_network()
        * timeline_for_stp_connected_nongravity_sewer_network_addition()
    )


@component.add(
    name="non gravity based tapping",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "per_stp_population_to_be_tapped_on_nongravity_based_infra_from_untapped_population": 1,
        "timeline_for_tapping_from_untapped_for_nongravity_based_infra": 1,
    },
)
def non_gravity_based_tapping():
    return (
        per_stp_population_to_be_tapped_on_nongravity_based_infra_from_untapped_population()
        * timeline_for_tapping_from_untapped_for_nongravity_based_infra()
    )


@component.add(
    name="population added to STP connected sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
    },
)
def population_added_to_stp_connected_sewer_network():
    return (
        gravity_based_stp_connected_sewer_network_addition()
        + non_gravity_based_stp_sewer_network_connection_addition()
    )


@component.add(
    name="BAU OandM cost for sewer network", comp_type="Constant", comp_subtype="Normal"
)
def bau_oandm_cost_for_sewer_network():
    return 10


@component.add(
    name="sewer network annual OandM cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewer_network_length_to_be_built": 1,
        "sewer_network_length": 1,
        "sewer_network_length_at_tzero": 1,
        "unit_cost_of_sewer_network_oandm": 1,
        "bau_oandm_cost_for_sewer_network": 1,
    },
)
def sewer_network_annual_oandm_cost():
    return if_then_else(
        sewer_network_length_to_be_built() > 0,
        lambda: (sewer_network_length() - sewer_network_length_at_tzero())
        * unit_cost_of_sewer_network_oandm()
        / 365
        + bau_oandm_cost_for_sewer_network() / 365,
        lambda: bau_oandm_cost_for_sewer_network() / 365,
    )


@component.add(
    name="Pump unit size", units="ML/day", comp_type="Constant", comp_subtype="Normal"
)
def pump_unit_size():
    return 110


@component.add(
    name="Pumping capacity at t zero",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def pumping_capacity_at_t_zero():
    return 140


@component.add(
    name="Installed pumping capacity",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_installed_pumping_capacity": 1},
    other_deps={
        "_integ_installed_pumping_capacity": {
            "initial": {"pumping_capacity_at_t_zero": 1},
            "step": {"pump_addition": 1},
        }
    },
)
def installed_pumping_capacity():
    return _integ_installed_pumping_capacity()


_integ_installed_pumping_capacity = Integ(
    lambda: pump_addition(),
    lambda: pumping_capacity_at_t_zero(),
    "_integ_installed_pumping_capacity",
)


@component.add(
    name="Population in tapped drains area",
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_in_tapped_drains_area": 1},
    other_deps={
        "_integ_population_in_tapped_drains_area": {
            "initial": {"population_in_tapped_drains_area_at_t_zero": 1},
            "step": {
                "drain_tapping": 1,
                "growth_of_population_discharging_to_tapped_drains": 1,
                "stp_connected_sewer_connection_to_tapped_drain": 1,
            },
        }
    },
)
def population_in_tapped_drains_area():
    return _integ_population_in_tapped_drains_area()


_integ_population_in_tapped_drains_area = Integ(
    lambda: drain_tapping()
    + growth_of_population_discharging_to_tapped_drains()
    - stp_connected_sewer_connection_to_tapped_drain(),
    lambda: population_in_tapped_drains_area_at_t_zero(),
    "_integ_population_in_tapped_drains_area",
)


@component.add(
    name="new sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_sewer_network_connected_to_stp": 3,
        "average_age_of_sewer_network": 1,
        "population_added_to_stp_connected_sewer_network": 1,
        "per_capita_sewage": 1,
    },
)
def new_sewer_network():
    return if_then_else(
        conveyance_through_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: average_age_of_sewer_network()
        * (
            1
            - conveyance_through_sewer_network_connected_to_stp()
            / (
                conveyance_through_sewer_network_connected_to_stp()
                + population_added_to_stp_connected_sewer_network()
                * per_capita_sewage()
            )
        ),
    )


@component.add(
    name="timeline for gravity based STP connected sewer network addition to insitu population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_gravity_based_stp_connected_sewer_network_addition_to_insitu_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="timeline for gravity based STP connected sewer network addition to NonSTP sewer network population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_gravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="sewer network capital cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewer_network_length_to_be_built": 1,
        "default_per_km_construction_cost_for_sewer_network": 1,
        "timeline_for_capital_investment_in_new_sewer_network": 1,
    },
)
def sewer_network_capital_cost():
    return (
        sewer_network_length_to_be_built()
        * default_per_km_construction_cost_for_sewer_network()
        * timeline_for_capital_investment_in_new_sewer_network()
    )


@component.add(
    name='"STP connected sewer network connection to in-situ timeline"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "timeline_for_gravity_based_stp_connected_sewer_network_addition_to_insitu_population": 1,
        "timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_insitu_population": 1,
    },
)
def stp_connected_sewer_network_connection_to_insitu_timeline():
    return (
        timeline_for_gravity_based_stp_connected_sewer_network_addition_to_insitu_population()
        + timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_insitu_population()
    )


@component.add(
    name="timeline for nongravity based STP connected sewer network addition to insitu population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_insitu_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="STP installed capacity at t zero",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def stp_installed_capacity_at_t_zero():
    return 260


@component.add(
    name="timeline for nongravity based STP connected sewer network addition to untapped population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_untapped_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="STP connection to Non STP sewer network",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def stp_connection_to_non_stp_sewer_network():
    return if_then_else(
        (
            gravity_based_stp_connected_sewer_network_addition()
            + non_gravity_based_stp_sewer_network_connection_addition()
        )
        > 0,
        lambda: (
            (
                sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network()
                + sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network()
            )
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: 0,
    )


@component.add(
    name='"Population in in-situ setup area"',
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_in_insitu_setup_area": 1},
    other_deps={
        "_integ_population_in_insitu_setup_area": {
            "initial": {"population_in_insitu_area_at_t_zero": 1},
            "step": {
                "growth_of_insitu_population": 1,
                "nonstp_sewer_connection_of_insitu_population": 1,
                "stp_connected_sewer_connection_of_insitu_population": 1,
                "untapped_connection_to_insitu": 1,
            },
        }
    },
)
def population_in_insitu_setup_area():
    """
    Intial value is assumed randomly
    """
    return _integ_population_in_insitu_setup_area()


_integ_population_in_insitu_setup_area = Integ(
    lambda: growth_of_insitu_population()
    - nonstp_sewer_connection_of_insitu_population()
    - stp_connected_sewer_connection_of_insitu_population()
    - untapped_connection_to_insitu(),
    lambda: population_in_insitu_area_at_t_zero(),
    "_integ_population_in_insitu_setup_area",
)


@component.add(
    name="STP installed capacity",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_installed_capacity": 1},
    other_deps={
        "_integ_stp_installed_capacity": {
            "initial": {"stp_installed_capacity_at_t_zero": 1},
            "step": {"stp_capacity_addition": 1},
        }
    },
)
def stp_installed_capacity():
    return _integ_stp_installed_capacity()


_integ_stp_installed_capacity = Integ(
    lambda: stp_capacity_addition(),
    lambda: stp_installed_capacity_at_t_zero(),
    "_integ_stp_installed_capacity",
)


@component.add(
    name="timeline for nongravity based STP connected sewer network addition to NonSTP sewer network population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="STP connected sewer network addition to untapped drains timeline",
    units="1/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "timeline_for_gravity_based_stp_connected_sewer_network_addition_to_untapped_population": 1,
        "timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_untapped_population": 1,
    },
)
def stp_connected_sewer_network_addition_to_untapped_drains_timeline():
    return (
        timeline_for_gravity_based_stp_connected_sewer_network_addition_to_untapped_population()
        + timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_untapped_population()
    )


@component.add(
    name="STP connected sewer network addition to tapped drains timeline",
    units="1/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "timeline_for_gravity_based_stp_connected_sewer_network_addition_to_tapped_population": 1,
        "timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_tapped_population": 1,
    },
)
def stp_connected_sewer_network_addition_to_tapped_drains_timeline():
    return (
        timeline_for_gravity_based_stp_connected_sewer_network_addition_to_tapped_population()
        + timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_tapped_population()
    )


@component.add(
    name="STP connected sewer network connection to NonSTP sewer network timeline",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "timeline_for_gravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population": 1,
        "timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population": 1,
    },
)
def stp_connected_sewer_network_connection_to_nonstp_sewer_network_timeline():
    return (
        timeline_for_gravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population()
        + timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_nonstp_sewer_network_population()
    )


@component.add(
    name="timeline for nongravity based STP connected sewer network addition to tapped population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_nongravity_based_stp_connected_sewer_network_addition_to_tapped_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name="timeline for gravity based STP connected sewer network addition to tapped population",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def timeline_for_gravity_based_stp_connected_sewer_network_addition_to_tapped_population():
    return pulse(__data["time"], 0, width=1)


@component.add(
    name='"effective tapped drain (nongravity) degradation rate"',
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_tapped_drain_nongravity_degradation_rate": 1,
        "efforts_preventive_maintenance_for_tapped_drains_nongravity": 1,
    },
)
def effective_tapped_drain_nongravity_degradation_rate():
    return normal_tapped_drain_nongravity_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_tapped_drains_nongravity()
    )


@component.add(
    name="STP unit size", units="ML/day", comp_type="Constant", comp_subtype="Normal"
)
def stp_unit_size():
    return 0


@component.add(
    name="additional STP capacity required",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"no_of_stps": 1, "stp_unit_size": 1},
)
def additional_stp_capacity_required():
    return no_of_stps() * stp_unit_size()


@component.add(
    name="pump addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "planning_choice_between_centralised_and_decentralised": 1,
        "additional_pump_required": 1,
        "pump_addition_timeline": 1,
        "no_of_stps": 1,
    },
)
def pump_addition():
    return if_then_else(
        planning_choice_between_centralised_and_decentralised() == 2,
        lambda: additional_pump_required() * pump_addition_timeline() / no_of_stps(),
        lambda: additional_pump_required() * pump_addition_timeline(),
    )


@component.add(
    name="effective pump degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_pump_degradation_rate": 1,
        "efforts_preventive_maintenance_for_pumpstations": 1,
    },
)
def effective_pump_degradation_rate():
    return normal_pump_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_pumpstations()
    )


@component.add(
    name="condition change due to pumping station addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "installed_pumping_capacity": 3,
        "condition_of_pumps_station": 2,
        "pump_addition": 2,
        "condition_of_newly_added_pump_station": 1,
    },
)
def condition_change_due_to_pumping_station_addition():
    return if_then_else(
        installed_pumping_capacity() == 0,
        lambda: 0,
        lambda: (
            condition_of_pumps_station() * installed_pumping_capacity()
            + condition_of_newly_added_pump_station() * pump_addition()
        )
        / (installed_pumping_capacity() + pump_addition())
        - condition_of_pumps_station(),
    )


@component.add(
    name="condition change due to sewer network addition",
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_change_due_to_sewer_network_addition():
    return 0


@component.add(
    name="condition change due to STP addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "stp_installed_capacity": 3,
        "stp_capacity_addition": 2,
        "condition_of_new_stp_added": 1,
        "condition_of_stp": 2,
    },
)
def condition_change_due_to_stp_addition():
    return if_then_else(
        stp_installed_capacity() == 0,
        lambda: 0,
        lambda: (
            condition_of_stp() * stp_installed_capacity()
            + condition_of_new_stp_added() * stp_capacity_addition()
        )
        / (stp_installed_capacity() + stp_capacity_addition())
        - condition_of_stp(),
    )


@component.add(
    name="condition of new STP added", comp_type="Constant", comp_subtype="Normal"
)
def condition_of_new_stp_added():
    return 100


@component.add(
    name="total treated sewage water discharge into river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"treated_sewage_dischage_to_river": 1},
)
def total_treated_sewage_water_discharge_into_river():
    return treated_sewage_dischage_to_river()


@component.add(
    name="Condition of pumps station",
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_condition_of_pumps_station": 1},
    other_deps={
        "_integ_condition_of_pumps_station": {
            "initial": {},
            "step": {
                "pump_rehabilitation": 1,
                "pump_degradation": 1,
                "condition_change_due_to_pumping_station_addition": 1,
            },
        }
    },
)
def condition_of_pumps_station():
    return _integ_condition_of_pumps_station()


_integ_condition_of_pumps_station = Integ(
    lambda: pump_rehabilitation()
    - pump_degradation()
    + condition_change_due_to_pumping_station_addition(),
    lambda: 100,
    "_integ_condition_of_pumps_station",
)


@component.add(
    name="new pumps",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "installed_pumping_capacity": 3,
        "average_age_of_pump_station": 1,
        "pump_addition": 1,
    },
)
def new_pumps():
    return if_then_else(
        installed_pumping_capacity() == 0,
        lambda: 0,
        lambda: average_age_of_pump_station()
        * (
            1
            - installed_pumping_capacity()
            / (installed_pumping_capacity() + pump_addition())
        ),
    )


@component.add(
    name="effective sewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_sewer_degradation_rate": 1,
        "efforts_preventive_maintenance_for_sewer_network": 1,
    },
)
def effective_sewer_degradation_rate():
    return normal_sewer_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_sewer_network()
    )


@component.add(
    name="BOD load from treated",
    units="KG/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "bod_in_treated_sewage": 1,
        "total_treated_sewage_water_discharge_into_river": 1,
    },
)
def bod_load_from_treated():
    return bod_in_treated_sewage() * total_treated_sewage_water_discharge_into_river()


@component.add(
    name="BOD load from untreated",
    units="KG/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "bod_of_untreated_sewage_water": 1,
        "untreated_wastewater_discharge_from_stp_to_varuna": 1,
        "discharge_from_non_stp_sewer_network_to_river": 1,
        "overflow_from_ps_to_river": 1,
        "untreated_sewage_discharge_from_untapped_drains_to_river": 1,
        "overflows_from_tapped_drains_nongravity_to_river": 1,
    },
)
def bod_load_from_untreated():
    return bod_of_untreated_sewage_water() * (
        discharge_from_non_stp_sewer_network_to_river()
        + overflow_from_ps_to_river()
        + overflows_from_tapped_drains_nongravity_to_river()
        + untreated_sewage_discharge_from_untapped_drains_to_river()
        + untreated_wastewater_discharge_from_stp_to_varuna()
    )


@component.add(
    name='"Conditions of screens in tapped drains (nongravity)"',
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_conditions_of_screens_in_tapped_drains_nongravity": 1},
    other_deps={
        "_integ_conditions_of_screens_in_tapped_drains_nongravity": {
            "initial": {},
            "step": {
                "condition_change_due_to_new_tapping_nongravity": 1,
                "tapped_drain_nongravity_rehabilitation": 1,
                "tapped_drain_nongravity_degradation": 1,
            },
        }
    },
)
def conditions_of_screens_in_tapped_drains_nongravity():
    return _integ_conditions_of_screens_in_tapped_drains_nongravity()


_integ_conditions_of_screens_in_tapped_drains_nongravity = Integ(
    lambda: condition_change_due_to_new_tapping_nongravity()
    + tapped_drain_nongravity_rehabilitation()
    - tapped_drain_nongravity_degradation(),
    lambda: 45,
    "_integ_conditions_of_screens_in_tapped_drains_nongravity",
)


@component.add(
    name="BOD load into river from seawge water",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "bod_load_from_treated": 1,
        "bod_load_from_untreated": 1,
        "bod_load_from_untreated_gw": 1,
    },
)
def bod_load_into_river_from_seawge_water():
    return (
        bod_load_from_treated()
        + bod_load_from_untreated()
        + bod_load_from_untreated_gw()
    )


@component.add(
    name="condition of newly added pump station",
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_of_newly_added_pump_station():
    return 100


@component.add(
    name='"condition of screens in newly added tapping (nongravity) infra"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_of_screens_in_newly_added_tapping_nongravity_infra():
    return 100


@component.add(
    name="Condition of sewer network",
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_condition_of_sewer_network": 1},
    other_deps={
        "_integ_condition_of_sewer_network": {
            "initial": {},
            "step": {
                "condition_change_due_to_sewer_network_addition": 1,
                "sewer_network_rehabilitation": 1,
                "sewer_network_degradation": 1,
            },
        }
    },
)
def condition_of_sewer_network():
    return _integ_condition_of_sewer_network()


_integ_condition_of_sewer_network = Integ(
    lambda: condition_change_due_to_sewer_network_addition()
    + sewer_network_rehabilitation()
    - sewer_network_degradation(),
    lambda: 100,
    "_integ_condition_of_sewer_network",
)


@component.add(
    name="Condition of STP",
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_condition_of_stp": 1},
    other_deps={
        "_integ_condition_of_stp": {
            "initial": {},
            "step": {
                "condition_change_due_to_stp_addition": 1,
                "stp_rehabilitation": 1,
                "stp_degradation": 1,
            },
        }
    },
)
def condition_of_stp():
    return _integ_condition_of_stp()


_integ_condition_of_stp = Integ(
    lambda: condition_change_due_to_stp_addition()
    + stp_rehabilitation()
    - stp_degradation(),
    lambda: 100,
    "_integ_condition_of_stp",
)


@component.add(
    name="Treated sewage water entered into River",
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_treated_sewage_water_entered_into_river": 1},
    other_deps={
        "_integ_treated_sewage_water_entered_into_river": {
            "initial": {},
            "step": {
                "treated_sewage_dischage_to_river": 1,
                "total_treated_sewage_water_discharge_into_river": 1,
            },
        }
    },
)
def treated_sewage_water_entered_into_river():
    """
    (baseflow+precipitation+hydrological inflows)+ (redirection of untreated sewage from STP+treated wastewater discharge+untreated sewage discharge to river from untapped drains +leakages from tapped drains )- (abstraction+downstream+evaporation)
    """
    return _integ_treated_sewage_water_entered_into_river()


_integ_treated_sewage_water_entered_into_river = Integ(
    lambda: treated_sewage_dischage_to_river()
    - total_treated_sewage_water_discharge_into_river(),
    lambda: 350,
    "_integ_treated_sewage_water_entered_into_river",
)


@component.add(
    name="Total BOD load from sewage water into river",
    units="KG",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_bod_load_from_sewage_water_into_river": 1},
    other_deps={
        "_integ_total_bod_load_from_sewage_water_into_river": {
            "initial": {},
            "step": {
                "bod_load_from_treated": 1,
                "bod_load_from_untreated": 1,
                "bod_load_from_untreated_gw": 1,
                "bod_load_into_river_from_seawge_water": 1,
            },
        }
    },
)
def total_bod_load_from_sewage_water_into_river():
    return _integ_total_bod_load_from_sewage_water_into_river()


_integ_total_bod_load_from_sewage_water_into_river = Integ(
    lambda: bod_load_from_treated()
    + bod_load_from_untreated()
    + bod_load_from_untreated_gw()
    - bod_load_into_river_from_seawge_water(),
    lambda: 5000,
    "_integ_total_bod_load_from_sewage_water_into_river",
)


@component.add(
    name="STP degradation",
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"condition_of_stp": 1, "effective_stp_degradation_rate": 1},
)
def stp_degradation():
    """
    INTEGER ( Condition of STP*(effective STP degradation rate)*10000 )/10000
    """
    return condition_of_stp() * effective_stp_degradation_rate() / 365


@component.add(
    name="Population in tapped drains area at t zero",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_tapped_infra_at_t_zero": 1,
        "population_discharging_to_nongravity_based_tapped_infra_at_t_zero": 1,
    },
)
def population_in_tapped_drains_area_at_t_zero():
    """
    taken from discharge value from tapped drains as per Varanasi data on UPJJN
    """
    return (
        population_discharging_to_gravity_based_tapped_infra_at_t_zero()
        + population_discharging_to_nongravity_based_tapped_infra_at_t_zero()
    )


@component.add(
    name='"Population discharging to non-gravity based tapped infra"',
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_discharging_to_nongravity_based_tapped_infra": 1},
    other_deps={
        "_integ_population_discharging_to_nongravity_based_tapped_infra": {
            "initial": {
                "population_discharging_to_nongravity_based_tapped_infra_at_t_zero": 1
            },
            "step": {
                "growth_of_population_discharging_to_nongravity_based_tapped_infra": 1,
                "non_gravity_based_tapping": 1,
            },
        }
    },
)
def population_discharging_to_nongravity_based_tapped_infra():
    return _integ_population_discharging_to_nongravity_based_tapped_infra()


_integ_population_discharging_to_nongravity_based_tapped_infra = Integ(
    lambda: growth_of_population_discharging_to_nongravity_based_tapped_infra()
    + non_gravity_based_tapping(),
    lambda: population_discharging_to_nongravity_based_tapped_infra_at_t_zero(),
    "_integ_population_discharging_to_nongravity_based_tapped_infra",
)


@component.add(
    name="Population discharging to gravity based tapped infra",
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_discharging_to_gravity_based_tapped_infra": 1},
    other_deps={
        "_integ_population_discharging_to_gravity_based_tapped_infra": {
            "initial": {
                "population_discharging_to_gravity_based_tapped_infra_at_t_zero": 1
            },
            "step": {
                "gravity_based_tapping": 1,
                "growth_of_population_discharging_to_gravity_based_tapped_infra": 1,
            },
        }
    },
)
def population_discharging_to_gravity_based_tapped_infra():
    return _integ_population_discharging_to_gravity_based_tapped_infra()


_integ_population_discharging_to_gravity_based_tapped_infra = Integ(
    lambda: gravity_based_tapping()
    + growth_of_population_discharging_to_gravity_based_tapped_infra(),
    lambda: population_discharging_to_gravity_based_tapped_infra_at_t_zero(),
    "_integ_population_discharging_to_gravity_based_tapped_infra",
)


@component.add(
    name="fraction of untapped population to be added to gravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_untapped_population_to_be_added_to_gravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="fraction of untapped population to be connected to nongravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_untapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name='"Population in Non-STP sewer network area"',
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_in_nonstp_sewer_network_area": 1},
    other_deps={
        "_integ_population_in_nonstp_sewer_network_area": {
            "initial": {"population_in_nonstp_sewer_network_area_at_t_zero": 1},
            "step": {
                "growth_of_population_discharging_to_nonstp_sewer_network": 1,
                "nonstp_sewer_connection_of_insitu_population": 1,
                "nonstp_sewer_connection_of_untapped_drains": 1,
                "stp_connection_to_non_stp_sewer_network": 1,
            },
        }
    },
)
def population_in_nonstp_sewer_network_area():
    """
    This stock is transitional but can be important if the transition time is high or if account for the construction time period of the infrastructure. (case of centralsiation vs decentralisation
    """
    return _integ_population_in_nonstp_sewer_network_area()


_integ_population_in_nonstp_sewer_network_area = Integ(
    lambda: growth_of_population_discharging_to_nonstp_sewer_network()
    + nonstp_sewer_connection_of_insitu_population()
    + nonstp_sewer_connection_of_untapped_drains()
    - stp_connection_to_non_stp_sewer_network(),
    lambda: population_in_nonstp_sewer_network_area_at_t_zero(),
    "_integ_population_in_nonstp_sewer_network_area",
)


@component.add(
    name="Population in STP connected sewer network area at t zero",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero": 1,
        "population_discharging_to_nongravity_based_stp_connected_sewer_network_at_t_zero": 1,
    },
)
def population_in_stp_connected_sewer_network_area_at_t_zero():
    return (
        population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero()
        + population_discharging_to_nongravity_based_stp_connected_sewer_network_at_t_zero()
    )


@component.add(name='"from in-situ area"', comp_type="Constant", comp_subtype="Normal")
def from_insitu_area():
    return 0


@component.add(
    name="growth of population discharging to STP connected sewer network",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "growth_of_population_discharging_to_gravity_based_stp_connected_sewer_network": 1,
        "growth_of_population_discharging_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def growth_of_population_discharging_to_stp_connected_sewer_network():
    return (
        growth_of_population_discharging_to_gravity_based_stp_connected_sewer_network()
        + growth_of_population_discharging_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(name="from untapped drains", comp_type="Constant", comp_subtype="Normal")
def from_untapped_drains():
    return 0


@component.add(
    name="gavity based sewer addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "from_tapped_drains": 1,
        "from_untapped_drains": 1,
        "gravity_based_sewer_network_growth": 1,
        "from_insitu_area": 1,
        "time": 1,
    },
)
def gavity_based_sewer_addition():
    return (
        from_tapped_drains()
        + from_untapped_drains()
        + gravity_based_sewer_network_growth()
        + from_insitu_area()
    ) * pulse(__data["time"], 3 * 365, width=1)


@component.add(
    name="gravity based flow from sewer to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_gravity_sewer_network_connected_to_stp": 1,
        "water_from_gwpipelines_to_stp_connected_gravity_sewer_network": 1,
        "infilteration_from_gravity_sewer_network_to_gw": 1,
    },
)
def gravity_based_flow_from_sewer_to_stp():
    return (
        conveyance_through_gravity_sewer_network_connected_to_stp()
        + water_from_gwpipelines_to_stp_connected_gravity_sewer_network()
        - infilteration_from_gravity_sewer_network_to_gw()
    )


@component.add(
    name="gravity based sewer network growth",
    comp_type="Constant",
    comp_subtype="Normal",
)
def gravity_based_sewer_network_growth():
    return 0


@component.add(
    name="Gravity based STP connected sewer network",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_gravity_based_stp_connected_sewer_network": 1},
    other_deps={
        "_integ_gravity_based_stp_connected_sewer_network": {
            "initial": {},
            "step": {
                "gavity_based_sewer_addition": 1,
                "gravity_based_stp_connection_to_nonstp_sewers": 1,
            },
        }
    },
)
def gravity_based_stp_connected_sewer_network():
    return _integ_gravity_based_stp_connected_sewer_network()


_integ_gravity_based_stp_connected_sewer_network = Integ(
    lambda: gavity_based_sewer_addition()
    + gravity_based_stp_connection_to_nonstp_sewers(),
    lambda: 0.37,
    "_integ_gravity_based_stp_connected_sewer_network",
)


@component.add(
    name="growth of population discharging to gravity based STP connected sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_stp_connected_sewer_network": 1,
        "population_growth_rate_in_gravity_based_stp_connected_sewer_network": 1,
    },
)
def growth_of_population_discharging_to_gravity_based_stp_connected_sewer_network():
    return (
        population_discharging_to_gravity_based_stp_connected_sewer_network()
        * population_growth_rate_in_gravity_based_stp_connected_sewer_network()
        / 365
    )


@component.add(
    name="growth of population discharging to gravity based tapped infra",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_tapped_infra": 1,
        "population_growth_rate_in_gravity_based_tapped_area": 1,
    },
)
def growth_of_population_discharging_to_gravity_based_tapped_infra():
    return (
        population_discharging_to_gravity_based_tapped_infra()
        * population_growth_rate_in_gravity_based_tapped_area()
        / 365
    )


@component.add(
    name='"growth of population discharging to non-gravity based STP connected sewer network"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_nongravity_based_stp_connected_sewer_network": 1,
        "population_growth_rate_in_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def growth_of_population_discharging_to_nongravity_based_stp_connected_sewer_network():
    return (
        population_discharging_to_nongravity_based_stp_connected_sewer_network()
        * population_growth_rate_in_nongravity_based_stp_connected_sewer_network()
        / 365
    )


@component.add(
    name='"growth of population discharging to non-gravity based tapped infra"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_nongravity_based_tapped_infra": 1,
        "population_growth_rate_in_non_gravity_tapped_area": 1,
    },
)
def growth_of_population_discharging_to_nongravity_based_tapped_infra():
    return (
        population_discharging_to_nongravity_based_tapped_infra()
        * population_growth_rate_in_non_gravity_tapped_area()
        / 365
    )


@component.add(
    name="fraction of NonSTP sewer network population to be connected to gravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_nonstp_sewer_network_population_to_be_connected_to_gravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="fraction of NonSTP sewer network population to be connected to nongravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_nonstp_sewer_network_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="growth of population discharging to tapped drains",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "growth_of_population_discharging_to_gravity_based_tapped_infra": 1,
        "growth_of_population_discharging_to_nongravity_based_tapped_infra": 1,
    },
)
def growth_of_population_discharging_to_tapped_drains():
    return (
        growth_of_population_discharging_to_gravity_based_tapped_infra()
        + growth_of_population_discharging_to_nongravity_based_tapped_infra()
    )


@component.add(
    name="Total capital cost",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_capital_cost_for_new_sewer_network": 1,
        "total_capital_cost_for_new_stp": 1,
        "total_capital_cost_for_new_tapping": 1,
        "total_capital_cost_of_new_pumping_station": 1,
    },
)
def total_capital_cost():
    return (
        total_capital_cost_for_new_sewer_network()
        + total_capital_cost_for_new_stp()
        + total_capital_cost_for_new_tapping()
        + total_capital_cost_of_new_pumping_station()
    )


@component.add(
    name="fraction of tapped population to be connected to gravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_tapped_population_to_be_connected_to_gravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="fraction of tapped population to be connected to nongravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_tapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="population growth rate in non gravity tapped area",
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_in_non_gravity_tapped_area():
    return 0.02


@component.add(
    name="STP connected sewer network addition to untapped drains goal",
    units="1/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fraction_of_untapped_population_to_be_added_to_gravity_based_stp_connected_sewer_network": 1,
        "fraction_of_untapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def stp_connected_sewer_network_addition_to_untapped_drains_goal():
    return (
        fraction_of_untapped_population_to_be_added_to_gravity_based_stp_connected_sewer_network()
        + fraction_of_untapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(
    name='"STP connected sewer network connection to in-situ goal"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fraction_of_insitu_population_to_be_connected_to_gravity_based_stp_connected_sewer_network": 1,
        "fraction_of_insitu_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def stp_connected_sewer_network_connection_to_insitu_goal():
    return (
        fraction_of_insitu_population_to_be_connected_to_gravity_based_stp_connected_sewer_network()
        + fraction_of_insitu_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(
    name='"STP connection to Non-STP sewer network fraction"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fraction_of_nonstp_sewer_network_population_to_be_connected_to_gravity_based_stp_connected_sewer_network": 1,
        "fraction_of_nonstp_sewer_network_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def stp_connection_to_nonstp_sewer_network_fraction():
    return (
        fraction_of_nonstp_sewer_network_population_to_be_connected_to_gravity_based_stp_connected_sewer_network()
        + fraction_of_nonstp_sewer_network_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(
    name="fraction of insitu population to be connected to nongravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_insitu_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="population growth rate in gravity based STP connected sewer network",
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_in_gravity_based_stp_connected_sewer_network():
    return 0.02


@component.add(
    name="fraction of population discharging into gravity based STP connected sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_stp_connected_sewer_network": 2,
        "population_discharging_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def fraction_of_population_discharging_into_gravity_based_stp_connected_sewer_network():
    return population_discharging_to_gravity_based_stp_connected_sewer_network() / (
        population_discharging_to_gravity_based_stp_connected_sewer_network()
        + population_discharging_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(
    name="population growth rate in gravity based tapped area",
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_in_gravity_based_tapped_area():
    return 0.02


@component.add(
    name='"Non-STP Sewer network coverage/capacity"',
    units="MLD",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_nonstp_sewer_network_coveragecapacity": 1},
    other_deps={
        "_integ_nonstp_sewer_network_coveragecapacity": {
            "initial": {"nonstp_sewer_network_at_t_zero": 1},
            "step": {
                "nonstp_sewer_connection_growth": 1,
                "gravity_based_stp_connection_to_nonstp_sewers": 1,
                "stp_connection_to_nonstp_sewers": 1,
            },
        }
    },
)
def nonstp_sewer_network_coveragecapacity():
    return _integ_nonstp_sewer_network_coveragecapacity()


_integ_nonstp_sewer_network_coveragecapacity = Integ(
    lambda: nonstp_sewer_connection_growth()
    - gravity_based_stp_connection_to_nonstp_sewers()
    - stp_connection_to_nonstp_sewers(),
    lambda: nonstp_sewer_network_at_t_zero(),
    "_integ_nonstp_sewer_network_coveragecapacity",
)


@component.add(
    name="Population discharging to gravity based STP connected sewer network",
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={
        "_integ_population_discharging_to_gravity_based_stp_connected_sewer_network": 1
    },
    other_deps={
        "_integ_population_discharging_to_gravity_based_stp_connected_sewer_network": {
            "initial": {
                "population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero": 1
            },
            "step": {
                "gravity_based_stp_connected_sewer_network_addition": 1,
                "growth_of_population_discharging_to_gravity_based_stp_connected_sewer_network": 1,
            },
        }
    },
)
def population_discharging_to_gravity_based_stp_connected_sewer_network():
    return _integ_population_discharging_to_gravity_based_stp_connected_sewer_network()


_integ_population_discharging_to_gravity_based_stp_connected_sewer_network = Integ(
    lambda: gravity_based_stp_connected_sewer_network_addition()
    + growth_of_population_discharging_to_gravity_based_stp_connected_sewer_network(),
    lambda: population_discharging_to_gravity_based_stp_connected_sewer_network_at_t_zero(),
    "_integ_population_discharging_to_gravity_based_stp_connected_sewer_network",
)


@component.add(
    name="STP connected sewer network addition to tapped drains goal",
    units="1/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fraction_of_tapped_population_to_be_connected_to_gravity_based_stp_connected_sewer_network": 1,
        "fraction_of_tapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network": 1,
    },
)
def stp_connected_sewer_network_addition_to_tapped_drains_goal():
    return (
        fraction_of_tapped_population_to_be_connected_to_gravity_based_stp_connected_sewer_network()
        + fraction_of_tapped_population_to_be_connected_to_nongravity_based_stp_connected_sewer_network()
    )


@component.add(
    name='"gravity based STP connection to Non-STP sewers"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def gravity_based_stp_connection_to_nonstp_sewers():
    return 0


@component.add(
    name='"Population discharging to non-gravity based STP connected sewer network"',
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={
        "_integ_population_discharging_to_nongravity_based_stp_connected_sewer_network": 1
    },
    other_deps={
        "_integ_population_discharging_to_nongravity_based_stp_connected_sewer_network": {
            "initial": {
                "population_discharging_to_nongravity_based_stp_connected_sewer_network_at_t_zero": 1
            },
            "step": {
                "growth_of_population_discharging_to_nongravity_based_stp_connected_sewer_network": 1,
                "non_gravity_based_stp_sewer_network_connection_addition": 1,
            },
        }
    },
)
def population_discharging_to_nongravity_based_stp_connected_sewer_network():
    return (
        _integ_population_discharging_to_nongravity_based_stp_connected_sewer_network()
    )


_integ_population_discharging_to_nongravity_based_stp_connected_sewer_network = Integ(
    lambda: growth_of_population_discharging_to_nongravity_based_stp_connected_sewer_network()
    + non_gravity_based_stp_sewer_network_connection_addition(),
    lambda: population_discharging_to_nongravity_based_stp_connected_sewer_network_at_t_zero(),
    "_integ_population_discharging_to_nongravity_based_stp_connected_sewer_network",
)


@component.add(
    name="fraction of insitu population to be connected to gravity based STP connected sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_insitu_population_to_be_connected_to_gravity_based_stp_connected_sewer_network():
    return 0


@component.add(
    name="Population in STP connected sewer network area",
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_in_stp_connected_sewer_network_area": 1},
    other_deps={
        "_integ_population_in_stp_connected_sewer_network_area": {
            "initial": {"population_in_stp_connected_sewer_network_area_at_t_zero": 1},
            "step": {
                "growth_of_population_discharging_to_stp_connected_sewer_network": 1,
                "stp_connected_sewer_connection_of_insitu_population": 1,
                "stp_connected_sewer_connection_to_tapped_drain": 1,
                "stp_connected_sewer_connection_to_untapped_drains": 1,
                "stp_connection_to_non_stp_sewer_network": 1,
            },
        }
    },
)
def population_in_stp_connected_sewer_network_area():
    return _integ_population_in_stp_connected_sewer_network_area()


_integ_population_in_stp_connected_sewer_network_area = Integ(
    lambda: growth_of_population_discharging_to_stp_connected_sewer_network()
    + stp_connected_sewer_connection_of_insitu_population()
    + stp_connected_sewer_connection_to_tapped_drain()
    + stp_connected_sewer_connection_to_untapped_drains()
    + stp_connection_to_non_stp_sewer_network(),
    lambda: population_in_stp_connected_sewer_network_area_at_t_zero(),
    "_integ_population_in_stp_connected_sewer_network_area",
)


@component.add(
    name="Total capital cost for new sewer network",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_capital_cost_for_new_sewer_network": 1},
    other_deps={
        "_integ_total_capital_cost_for_new_sewer_network": {
            "initial": {},
            "step": {"sewer_network_capital_cost": 1},
        }
    },
)
def total_capital_cost_for_new_sewer_network():
    return _integ_total_capital_cost_for_new_sewer_network()


_integ_total_capital_cost_for_new_sewer_network = Integ(
    lambda: sewer_network_capital_cost(),
    lambda: 0,
    "_integ_total_capital_cost_for_new_sewer_network",
)


@component.add(
    name="Total OandM cost of new sewer network",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_oandm_cost_of_new_sewer_network": 1},
    other_deps={
        "_integ_total_oandm_cost_of_new_sewer_network": {
            "initial": {},
            "step": {"sewer_network_annual_oandm_cost": 1},
        }
    },
)
def total_oandm_cost_of_new_sewer_network():
    return _integ_total_oandm_cost_of_new_sewer_network()


_integ_total_oandm_cost_of_new_sewer_network = Integ(
    lambda: sewer_network_annual_oandm_cost(),
    lambda: 0,
    "_integ_total_oandm_cost_of_new_sewer_network",
)


@component.add(
    name="tapping infra addition", comp_type="Constant", comp_subtype="Normal"
)
def tapping_infra_addition():
    return 0


@component.add(
    name="Unit cost of pumping station OandM",
    units="(INR/(ML/day))/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_pumping_station_oandm():
    return 0


@component.add(
    name="Unit cost of sewer network construction",
    units="(MillionINR/(ML/day))",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_sewer_network_construction():
    return 0


@component.add(
    name="Unit cost of tapping construction",
    units="(INR cr/(ML/day))",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_tapping_construction():
    return 0


@component.add(
    name="Unit cost of tapping OandM",
    units="(INR/(ML/day))/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_tapping_oandm():
    return 0


@component.add(
    name="Total capital cost for new tapping",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_capital_cost_for_new_tapping": 1},
    other_deps={
        "_integ_total_capital_cost_for_new_tapping": {
            "initial": {},
            "step": {"tapping_capital_cost": 1},
        }
    },
)
def total_capital_cost_for_new_tapping():
    return _integ_total_capital_cost_for_new_tapping()


_integ_total_capital_cost_for_new_tapping = Integ(
    lambda: tapping_capital_cost(),
    lambda: 0,
    "_integ_total_capital_cost_for_new_tapping",
)


@component.add(
    name="Unit cost of pumping station construction",
    units="(INR/(ML/day))",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_pumping_station_construction():
    """
    {Randomly Assumed to be 10% of the STP construction}
    """
    return 0


@component.add(
    name="Total OandM cost of new pumping station",
    units="INR cr",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_oandm_cost_of_new_pumping_station": 1},
    other_deps={
        "_integ_total_oandm_cost_of_new_pumping_station": {
            "initial": {},
            "step": {"pumping_station_annual_oandm_cost": 1},
        }
    },
)
def total_oandm_cost_of_new_pumping_station():
    return _integ_total_oandm_cost_of_new_pumping_station()


_integ_total_oandm_cost_of_new_pumping_station = Integ(
    lambda: pumping_station_annual_oandm_cost(),
    lambda: 0,
    "_integ_total_oandm_cost_of_new_pumping_station",
)


@component.add(
    name="Total OandM cost of new tapping",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_oandm_cost_of_new_tapping": 1},
    other_deps={
        "_integ_total_oandm_cost_of_new_tapping": {
            "initial": {},
            "step": {"tapping_annual_oandm_cost": 1},
        }
    },
)
def total_oandm_cost_of_new_tapping():
    return _integ_total_oandm_cost_of_new_tapping()


_integ_total_oandm_cost_of_new_tapping = Integ(
    lambda: tapping_annual_oandm_cost(),
    lambda: 0,
    "_integ_total_oandm_cost_of_new_tapping",
)


@component.add(
    name="Total Capital cost of new Pumping station",
    units="INR cr",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_capital_cost_of_new_pumping_station": 1},
    other_deps={
        "_integ_total_capital_cost_of_new_pumping_station": {
            "initial": {},
            "step": {"pumping_station_capital_cost": 1},
        }
    },
)
def total_capital_cost_of_new_pumping_station():
    return _integ_total_capital_cost_of_new_pumping_station()


_integ_total_capital_cost_of_new_pumping_station = Integ(
    lambda: pumping_station_capital_cost(),
    lambda: 0,
    "_integ_total_capital_cost_of_new_pumping_station",
)


@component.add(
    name="Unit cost of sewer network OandM",
    units="(INR/(ML/day))/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def unit_cost_of_sewer_network_oandm():
    return 0


@component.add(name="from tapped drains", comp_type="Constant", comp_subtype="Normal")
def from_tapped_drains():
    return 0


@component.add(
    name="untreated sewage from GW to river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "infilteration_from_gravity_sewer_network_to_gw": 1,
        "infilteration_from_nongravity_sewer_network_to_gw": 1,
        "infilteration_from_non_stp_sewer_network_to_gw": 1,
        "infilteration_to_gw_from_insitu": 1,
    },
)
def untreated_sewage_from_gw_to_river():
    return (
        infilteration_from_nongravity_sewer_network_to_gw()
        + infilteration_to_gw_from_insitu()
        + infilteration_from_gravity_sewer_network_to_gw()
        + infilteration_from_non_stp_sewer_network_to_gw()
    ) * 0


@component.add(
    name="sewer network rehabilitation", comp_type="Constant", comp_subtype="Normal"
)
def sewer_network_rehabilitation():
    return 0


@component.add(
    name='"infilteration to GW from in-situ"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"sewer_water_generation_in_insitu": 1},
)
def infilteration_to_gw_from_insitu():
    return sewer_water_generation_in_insitu()


@component.add(
    name="Population in untapped drains area",
    units="people",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_population_in_untapped_drains_area": 1},
    other_deps={
        "_integ_population_in_untapped_drains_area": {
            "initial": {"population_in_untapped_drains_area_at_t_zero": 1},
            "step": {
                "growth_of_population_discharging_to_untapped_drains": 1,
                "untapped_connection_to_insitu": 1,
                "drain_tapping": 1,
                "nonstp_sewer_connection_of_untapped_drains": 1,
                "stp_connected_sewer_connection_to_untapped_drains": 1,
            },
        }
    },
)
def population_in_untapped_drains_area():
    """
    57% of intial household https://jjm.up.gov.in/NamamiGange/_ClickData1?Action1=6.1&DistrictId=72&P1=46&P2=14&M _Scheme_Type_Id=&Header=Drains%20Details Value given is : 156300
    """
    return _integ_population_in_untapped_drains_area()


_integ_population_in_untapped_drains_area = Integ(
    lambda: growth_of_population_discharging_to_untapped_drains()
    + untapped_connection_to_insitu()
    - drain_tapping()
    - nonstp_sewer_connection_of_untapped_drains()
    - stp_connected_sewer_connection_to_untapped_drains(),
    lambda: population_in_untapped_drains_area_at_t_zero(),
    "_integ_population_in_untapped_drains_area",
)


@component.add(
    name="Total capital cost for new STP",
    units="INR cr",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_capital_cost_for_new_stp": 1},
    other_deps={
        "_integ_total_capital_cost_for_new_stp": {
            "initial": {},
            "step": {"stp_capital_cost": 1},
        }
    },
)
def total_capital_cost_for_new_stp():
    return _integ_total_capital_cost_for_new_stp()


_integ_total_capital_cost_for_new_stp = Integ(
    lambda: stp_capital_cost(), lambda: 0, "_integ_total_capital_cost_for_new_stp"
)


@component.add(
    name="sewer network to PS",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_nongravity_sewer_network_connected_to_stp": 1,
        "water_from_gwpipelines_to_stp_connected_sewer_network": 1,
        "infilteration_from_nongravity_sewer_network_to_gw": 1,
    },
)
def sewer_network_to_ps():
    return (
        conveyance_through_nongravity_sewer_network_connected_to_stp()
        + water_from_gwpipelines_to_stp_connected_sewer_network()
        - infilteration_from_nongravity_sewer_network_to_gw()
    )


@component.add(
    name="infilteration from sewer network to GW",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_sewer_network_connected_to_stp": 2,
        "water_from_gwpipelines_to_stp_connected_sewer_network": 2,
        "stp_connected_sewer_network_coveragecapacity": 2,
        "condition_of_sewer_network": 2,
    },
)
def infilteration_from_sewer_network_to_gw():
    return 0 * if_then_else(
        conveyance_through_sewer_network_connected_to_stp()
        + water_from_gwpipelines_to_stp_connected_sewer_network()
        > (condition_of_sewer_network() / 100)
        * stp_connected_sewer_network_coveragecapacity(),
        lambda: (
            conveyance_through_sewer_network_connected_to_stp()
            + water_from_gwpipelines_to_stp_connected_sewer_network()
        )
        - (condition_of_sewer_network() / 100)
        * stp_connected_sewer_network_coveragecapacity(),
        lambda: 0,
    )


@component.add(
    name='"water from GW/pipelines to STP connected gravity sewer network"',
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def water_from_gwpipelines_to_stp_connected_gravity_sewer_network():
    return 0


@component.add(
    name="infilteration from gravity sewer network to GW",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_gravity_sewer_network_connected_to_stp": 1,
        "water_from_gwpipelines_to_stp_connected_gravity_sewer_network": 1,
        "condition_of_gravity_sewer_network": 1,
    },
)
def infilteration_from_gravity_sewer_network_to_gw():
    return (
        conveyance_through_gravity_sewer_network_connected_to_stp()
        + water_from_gwpipelines_to_stp_connected_gravity_sewer_network()
    ) * (1 - (condition_of_gravity_sewer_network() / 100))


@component.add(
    name="infilteration from nongravity sewer network to GW",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_nongravity_sewer_network_connected_to_stp": 1,
        "water_from_gwpipelines_to_stp_connected_sewer_network": 1,
        "condition_of_nongravity_sewer_network": 1,
    },
)
def infilteration_from_nongravity_sewer_network_to_gw():
    return (
        conveyance_through_nongravity_sewer_network_connected_to_stp()
        + water_from_gwpipelines_to_stp_connected_sewer_network()
    ) * (1 - (condition_of_nongravity_sewer_network() / 100))


@component.add(
    name="Total OandM cost of new STP",
    units="INR cr",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_total_oandm_cost_of_new_stp": 1},
    other_deps={
        "_integ_total_oandm_cost_of_new_stp": {
            "initial": {},
            "step": {"stp_annual_oandm_cost": 1},
        }
    },
)
def total_oandm_cost_of_new_stp():
    return _integ_total_oandm_cost_of_new_stp()


_integ_total_oandm_cost_of_new_stp = Integ(
    lambda: stp_annual_oandm_cost(), lambda: 0, "_integ_total_oandm_cost_of_new_stp"
)


@component.add(
    name="infilteration from Non STP sewer network to GW",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_non_stp_sewer_network": 2,
        "water_from_gwpipelines_to_non_stp_sewer_network": 2,
        "condition_of_nongravity_sewer_network": 2,
        "nonstp_sewer_network_coveragecapacity": 2,
    },
)
def infilteration_from_non_stp_sewer_network_to_gw():
    return 0 * if_then_else(
        conveyance_through_non_stp_sewer_network()
        + water_from_gwpipelines_to_non_stp_sewer_network()
        > condition_of_nongravity_sewer_network() * nonstp_sewer_network_coveragecapacity(),
        lambda: (
            conveyance_through_non_stp_sewer_network()
            + water_from_gwpipelines_to_non_stp_sewer_network()
        )
        - condition_of_nongravity_sewer_network() * nonstp_sewer_network_coveragecapacity(),
        lambda: 0,
    )


@component.add(
    name='"STP connected sewer network coverage/capacity"',
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_connected_sewer_network_coveragecapacity": 1},
    other_deps={
        "_integ_stp_connected_sewer_network_coveragecapacity": {
            "initial": {"stp_connected_sewer_network_at_t_zero": 1},
            "step": {
                "stp_connected_sewer_connection_growth": 1,
                "stp_connected_sewer_connection_to_insitu_area": 1,
                "stp_connected_sewer_network_addition_to_tapped_drains_area": 1,
                "stp_connected_sewer_network_addition_to_untapped_drains_area": 1,
                "stp_connection_to_nonstp_sewers": 1,
            },
        }
    },
)
def stp_connected_sewer_network_coveragecapacity():
    return _integ_stp_connected_sewer_network_coveragecapacity()


_integ_stp_connected_sewer_network_coveragecapacity = Integ(
    lambda: stp_connected_sewer_connection_growth()
    + stp_connected_sewer_connection_to_insitu_area()
    + stp_connected_sewer_network_addition_to_tapped_drains_area()
    + stp_connected_sewer_network_addition_to_untapped_drains_area()
    + stp_connection_to_nonstp_sewers(),
    lambda: stp_connected_sewer_network_at_t_zero(),
    "_integ_stp_connected_sewer_network_coveragecapacity",
)


@component.add(
    name="STP connection timeline", comp_type="Constant", comp_subtype="Normal"
)
def stp_connection_timeline():
    return 0


@component.add(
    name="average age of pump station",
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_average_age_of_pump_station": 1},
    other_deps={
        "_integ_average_age_of_pump_station": {
            "initial": {},
            "step": {"pump_age_increment": 1, "new_pumps": 1},
        }
    },
)
def average_age_of_pump_station():
    return _integ_average_age_of_pump_station()


_integ_average_age_of_pump_station = Integ(
    lambda: pump_age_increment() - new_pumps(),
    lambda: 0,
    "_integ_average_age_of_pump_station",
)


@component.add(
    name="average age of sewer network",
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_average_age_of_sewer_network": 1},
    other_deps={
        "_integ_average_age_of_sewer_network": {
            "initial": {},
            "step": {"sewer_age_increment": 1, "new_sewer_network": 1},
        }
    },
)
def average_age_of_sewer_network():
    return _integ_average_age_of_sewer_network()


_integ_average_age_of_sewer_network = Integ(
    lambda: sewer_age_increment() - new_sewer_network(),
    lambda: 0,
    "_integ_average_age_of_sewer_network",
)


@component.add(
    name="STP average age",
    units="day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_average_age": 1},
    other_deps={
        "_integ_stp_average_age": {
            "initial": {},
            "step": {"stp_age_increment": 1, "new_stp": 1},
        }
    },
)
def stp_average_age():
    return _integ_stp_average_age()


_integ_stp_average_age = Integ(
    lambda: stp_age_increment() - new_stp(), lambda: 0, "_integ_stp_average_age"
)


@component.add(
    name='"Tapped drain (nongravity) average age"',
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_tapped_drain_nongravity_average_age": 1},
    other_deps={
        "_integ_tapped_drain_nongravity_average_age": {
            "initial": {},
            "step": {
                "tapped_drain_nongravity_age_increament": 1,
                "new_tapping_nongravity": 1,
            },
        }
    },
)
def tapped_drain_nongravity_average_age():
    return _integ_tapped_drain_nongravity_average_age()


_integ_tapped_drain_nongravity_average_age = Integ(
    lambda: tapped_drain_nongravity_age_increament() - new_tapping_nongravity(),
    lambda: 0,
    "_integ_tapped_drain_nongravity_average_age",
)


@component.add(
    name="growth of population discharging to untapped drains",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_untapped_drains_area": 1,
        "population_growth_rate_in_untapped_area": 1,
    },
)
def growth_of_population_discharging_to_untapped_drains():
    return (
        population_in_untapped_drains_area()
        * population_growth_rate_in_untapped_area()
        / 365
    )


@component.add(
    name="STP work in progress",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "stp_capacity_underproposal": 1,
        "stp_approved": 1,
        "stp_underconstruction": 1,
        "stp_installed_capacity": 1,
    },
)
def stp_work_in_progress():
    return (
        stp_capacity_underproposal()
        + stp_approved()
        + stp_underconstruction()
        + stp_installed_capacity()
    )


@component.add(
    name='"Non-STP sewer connection of in-situ population"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_insitu_setup_area": 1,
        "growth_of_insitu_population": 1,
        "nonstp_sewer_network_addition_to_insitu_goal": 1,
        "nonstp_sewer_network_addition_to_insitu_timeline": 1,
        "time": 1,
    },
)
def nonstp_sewer_connection_of_insitu_population():
    return (
        (population_in_insitu_setup_area() + growth_of_insitu_population())
        * nonstp_sewer_network_addition_to_insitu_goal()
        * pulse(
            __data["time"], nonstp_sewer_network_addition_to_insitu_timeline(), width=1
        )
    )


@component.add(
    name='"STP connected sewer connection of in-situ population"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def stp_connected_sewer_connection_of_insitu_population():
    return if_then_else(
        (
            gravity_based_stp_connected_sewer_network_addition()
            + non_gravity_based_stp_sewer_network_connection_addition()
        )
        > 0,
        lambda: (
            (
                sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network()
                + sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network()
            )
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: 0,
    )


@component.add(
    name="STP connected sewer connection to tapped drain",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "stp_sewer_network_addition_to_gravity_tapped": 1,
        "stp_sewer_network_connection_to_nongravity_tapped": 1,
    },
)
def stp_connected_sewer_connection_to_tapped_drain():
    return (
        stp_sewer_network_addition_to_gravity_tapped()
        + stp_sewer_network_connection_to_nongravity_tapped()
    )


@component.add(
    name='"population growth rate in-situ area"',
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_insitu_area():
    return 0


@component.add(
    name="STP connected sewer connection growth",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def stp_connected_sewer_connection_growth():
    return 0 * pulse(__data["time"], 3 * 365, width=1)


@component.add(
    name='"STP connected sewer connection to in-situ area"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def stp_connected_sewer_connection_to_insitu_area():
    return 0


@component.add(
    name='"Non-STP sewer network addition to in-situ timeline"',
    units="1/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def nonstp_sewer_network_addition_to_insitu_timeline():
    return 0


@component.add(
    name='"Non-STP sewer connection of untapped drains"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_untapped_drains_area": 1,
        "growth_of_population_discharging_to_untapped_drains": 1,
        "nonstp_sewer_network_addition_to_untapped_drains_goal": 1,
        "nonstp_sewer_network_addition_to_untapped_drains_timeline": 1,
        "time": 1,
    },
)
def nonstp_sewer_connection_of_untapped_drains():
    return (
        (
            population_in_untapped_drains_area()
            + growth_of_population_discharging_to_untapped_drains()
        )
        * nonstp_sewer_network_addition_to_untapped_drains_goal()
        * pulse(
            __data["time"],
            nonstp_sewer_network_addition_to_untapped_drains_timeline(),
            width=1,
        )
    )


@component.add(
    name="STP connected sewer network addition to tapped drains area",
    comp_type="Constant",
    comp_subtype="Normal",
)
def stp_connected_sewer_network_addition_to_tapped_drains_area():
    return 0


@component.add(
    name="STP connected sewer network addition to untapped drains area",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"time": 1},
)
def stp_connected_sewer_network_addition_to_untapped_drains_area():
    return 0 * pulse(__data["time"], 3 * 365, width=1)


@component.add(
    name='"Non-STP sewer network addition to untapped drains timeline"',
    units="1/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def nonstp_sewer_network_addition_to_untapped_drains_timeline():
    return 0


@component.add(
    name="conveyance through untapped drains",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"population_in_untapped_drains_area": 1, "per_capita_sewage": 1},
)
def conveyance_through_untapped_drains():
    return population_in_untapped_drains_area() * per_capita_sewage()


@component.add(
    name="NonSTP sewer connection growth", comp_type="Constant", comp_subtype="Normal"
)
def nonstp_sewer_connection_growth():
    return 0


@component.add(
    name="STP connected sewer network at t zero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def stp_connected_sewer_network_at_t_zero():
    return 130.2


@component.add(name="STP connection goal", comp_type="Constant", comp_subtype="Normal")
def stp_connection_goal():
    return 0


@component.add(
    name="untreated sewage discharge from untapped drains to river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_untapped_drains": 1,
        "discharge_from_non_stp_sewer_network_to_untapped_drain": 1,
    },
)
def untreated_sewage_discharge_from_untapped_drains_to_river():
    return (
        conveyance_through_untapped_drains()
        + discharge_from_non_stp_sewer_network_to_untapped_drain()
    )


@component.add(
    name='"STP connection to Non-STP sewers"',
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "nonstp_sewer_network_coveragecapacity": 1,
        "stp_connection_goal": 1,
        "stp_connection_timeline": 1,
        "time": 1,
    },
)
def stp_connection_to_nonstp_sewers():
    return (
        nonstp_sewer_network_coveragecapacity()
        * stp_connection_goal()
        * pulse(__data["time"], stp_connection_timeline(), width=1)
    )


@component.add(
    name='"growth of population discharging to Non-STP sewer network"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_nonstp_sewer_network_area": 1,
        "population_growth_rate_nonstp_sewer_network_area": 1,
    },
)
def growth_of_population_discharging_to_nonstp_sewer_network():
    return (
        population_in_nonstp_sewer_network_area()
        * population_growth_rate_nonstp_sewer_network_area()
        / 365
    )


@component.add(
    name='"Non-STP sewer network at t zero"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def nonstp_sewer_network_at_t_zero():
    return 0


@component.add(
    name="pumping working capacity",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"installed_pumping_capacity": 1, "condition_of_pumps_station": 1},
)
def pumping_working_capacity():
    return installed_pumping_capacity() * (condition_of_pumps_station() / 100)


@component.add(
    name="population growth rate in untapped area",
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_in_untapped_area():
    return 0.02


@component.add(
    name='"population growth rate Non-STP sewer network area"',
    units="1/year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def population_growth_rate_nonstp_sewer_network_area():
    return 0


@component.add(
    name='"growth of in-situ population"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_insitu_setup_area": 1,
        "population_growth_rate_insitu_area": 1,
    },
)
def growth_of_insitu_population():
    return (
        population_in_insitu_setup_area() * population_growth_rate_insitu_area() / 365
    )


@component.add(
    name="STP connected sewer connection to untapped drains",
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_untapped_drains_area": 1,
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def stp_connected_sewer_connection_to_untapped_drains():
    return if_then_else(
        population_in_untapped_drains_area() > 0,
        lambda: if_then_else(
            (
                gravity_based_stp_connected_sewer_network_addition()
                + non_gravity_based_stp_sewer_network_connection_addition()
            )
            > 0,
            lambda: (
                (
                    sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network()
                    + sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network()
                )
                / per_capita_sewage()
            )
            / no_of_stps(),
            lambda: 0,
        ),
        lambda: 0,
    )


@component.add(
    name="discharge from Non STP sewer network to river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_non_stp_sewer_network": 1,
        "water_from_gwpipelines_to_non_stp_sewer_network": 1,
        "discharge_from_non_stp_sewer_network_to_tapped_drain": 1,
        "discharge_from_non_stp_sewer_network_to_untapped_drain": 1,
    },
)
def discharge_from_non_stp_sewer_network_to_river():
    return (
        conveyance_through_non_stp_sewer_network()
        + water_from_gwpipelines_to_non_stp_sewer_network()
        - discharge_from_non_stp_sewer_network_to_tapped_drain()
        - discharge_from_non_stp_sewer_network_to_untapped_drain()
    )


@component.add(
    name="BOD in treated sewage",
    units="mg/l",
    comp_type="Constant",
    comp_subtype="Normal",
)
def bod_in_treated_sewage():
    """
    pg 89 https://cpcb.nic.in/NGT/Action-Plan-Rej-River-OA-No-368-2021.pdf Compliance status as per Hon’ble NGT order dated 30.04.2019. mg/l = KG/ML 12.88 is taken as per the t=zero diagram
    """
    return 12.88


@component.add(
    name="fractional discharge from Non STP sewer network to untapped drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fractional_discharge_from_non_stp_sewer_network_to_untapped_drains():
    return 0


@component.add(
    name="discharge from Non STP sewer network to untapped drain",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fractional_discharge_from_non_stp_sewer_network_to_untapped_drains": 1,
        "conveyance_through_non_stp_sewer_network": 1,
        "water_from_gwpipelines_to_non_stp_sewer_network": 1,
    },
)
def discharge_from_non_stp_sewer_network_to_untapped_drain():
    return fractional_discharge_from_non_stp_sewer_network_to_untapped_drains() * (
        conveyance_through_non_stp_sewer_network()
        + water_from_gwpipelines_to_non_stp_sewer_network()
    )


@component.add(
    name="fractional discharge from Non STP sewer network to tapped drains",
    comp_type="Constant",
    comp_subtype="Normal",
)
def fractional_discharge_from_non_stp_sewer_network_to_tapped_drains():
    return 0


@component.add(
    name="discharge from Non STP sewer network to tapped drain",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "fractional_discharge_from_non_stp_sewer_network_to_tapped_drains": 1,
        "conveyance_through_non_stp_sewer_network": 1,
        "water_from_gwpipelines_to_non_stp_sewer_network": 1,
    },
)
def discharge_from_non_stp_sewer_network_to_tapped_drain():
    return fractional_discharge_from_non_stp_sewer_network_to_tapped_drains() * (
        conveyance_through_non_stp_sewer_network()
        + water_from_gwpipelines_to_non_stp_sewer_network()
    )


@component.add(
    name="sewage water from diversion to STP",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_water_from_diversion_to_stp():
    return 0


@component.add(
    name="Sewage water in Non STP sewer network",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_non_stp_sewer_network": 1},
    other_deps={
        "_integ_sewage_water_in_non_stp_sewer_network": {
            "initial": {},
            "step": {
                "conveyance_through_non_stp_sewer_network": 1,
                "water_from_gwpipelines_to_non_stp_sewer_network": 1,
                "discharge_from_non_stp_sewer_network_to_tapped_drain": 1,
                "discharge_from_non_stp_sewer_network_to_untapped_drain": 1,
                "infilteration_from_non_stp_sewer_network_to_gw": 1,
                "discharge_from_non_stp_sewer_network_to_river": 1,
            },
        }
    },
)
def sewage_water_in_non_stp_sewer_network():
    return _integ_sewage_water_in_non_stp_sewer_network()


_integ_sewage_water_in_non_stp_sewer_network = Integ(
    lambda: conveyance_through_non_stp_sewer_network()
    + water_from_gwpipelines_to_non_stp_sewer_network()
    - discharge_from_non_stp_sewer_network_to_tapped_drain()
    - discharge_from_non_stp_sewer_network_to_untapped_drain()
    - infilteration_from_non_stp_sewer_network_to_gw()
    - discharge_from_non_stp_sewer_network_to_river(),
    lambda: 0,
    "_integ_sewage_water_in_non_stp_sewer_network",
)


@component.add(
    name='"Non-STP sewer network addition to in-situ goal"',
    units="1/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def nonstp_sewer_network_addition_to_insitu_goal():
    return 0


@component.add(
    name='"untapped connection to in-situ"',
    units="people/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "untapped_connection_rate_to_insitu": 1,
        "population_in_insitu_setup_area": 1,
    },
)
def untapped_connection_to_insitu():
    return untapped_connection_rate_to_insitu() * population_in_insitu_setup_area()


@component.add(
    name='"water from GW/pipelines to STP connected sewer network"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def water_from_gwpipelines_to_stp_connected_sewer_network():
    return 0


@component.add(
    name='"untapped connection rate to in-situ"',
    units="1/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def untapped_connection_rate_to_insitu():
    return 0


@component.add(
    name="Sewage water in sewer network connected to STP",
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_sewer_network_connected_to_stp": 1},
    other_deps={
        "_integ_sewage_water_in_sewer_network_connected_to_stp": {
            "initial": {},
            "step": {
                "conveyance_through_sewer_network_connected_to_stp": 1,
                "water_from_gwpipelines_to_stp_connected_sewer_network": 1,
                "gravity_based_flow_from_sewer_to_stp": 1,
                "infilteration_from_sewer_network_to_gw": 1,
                "sewer_network_to_ps": 1,
            },
        }
    },
)
def sewage_water_in_sewer_network_connected_to_stp():
    return _integ_sewage_water_in_sewer_network_connected_to_stp()


_integ_sewage_water_in_sewer_network_connected_to_stp = Integ(
    lambda: conveyance_through_sewer_network_connected_to_stp()
    + water_from_gwpipelines_to_stp_connected_sewer_network()
    - gravity_based_flow_from_sewer_to_stp()
    - infilteration_from_sewer_network_to_gw()
    - sewer_network_to_ps(),
    lambda: 125,
    "_integ_sewage_water_in_sewer_network_connected_to_stp",
)


@component.add(
    name='"water from GW/pipelines to Non STP sewer network"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def water_from_gwpipelines_to_non_stp_sewer_network():
    return 0


@component.add(
    name='"sewer water generation in In-situ"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"population_in_insitu_setup_area": 1, "per_capita_sewage": 1},
)
def sewer_water_generation_in_insitu():
    return population_in_insitu_setup_area() * per_capita_sewage()


@component.add(
    name="conveyance through Non STP sewer network",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"population_in_nonstp_sewer_network_area": 1, "per_capita_sewage": 1},
)
def conveyance_through_non_stp_sewer_network():
    return population_in_nonstp_sewer_network_area() * per_capita_sewage()


@component.add(
    name="Sewage water in untapped drains",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_untapped_drains": 1},
    other_deps={
        "_integ_sewage_water_in_untapped_drains": {
            "initial": {},
            "step": {
                "conveyance_through_untapped_drains": 1,
                "discharge_from_non_stp_sewer_network_to_untapped_drain": 1,
                "untreated_sewage_discharge_from_untapped_drains_to_river": 1,
            },
        }
    },
)
def sewage_water_in_untapped_drains():
    return _integ_sewage_water_in_untapped_drains()


_integ_sewage_water_in_untapped_drains = Integ(
    lambda: conveyance_through_untapped_drains()
    + discharge_from_non_stp_sewer_network_to_untapped_drain()
    - untreated_sewage_discharge_from_untapped_drains_to_river(),
    lambda: 100,
    "_integ_sewage_water_in_untapped_drains",
)


@component.add(
    name="conveyance through sewer network connected to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_in_stp_connected_sewer_network_area": 1,
        "per_capita_sewage": 1,
    },
)
def conveyance_through_sewer_network_connected_to_stp():
    return population_in_stp_connected_sewer_network_area() * per_capita_sewage()


@component.add(
    name="conveyance through gravity sewer network connected to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_gravity_based_stp_connected_sewer_network": 1,
        "per_capita_sewage": 1,
    },
)
def conveyance_through_gravity_sewer_network_connected_to_stp():
    return (
        population_discharging_to_gravity_based_stp_connected_sewer_network()
        * per_capita_sewage()
    )


@component.add(
    name="conveyance through nongravity sewer network connected to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "population_discharging_to_nongravity_based_stp_connected_sewer_network": 1,
        "per_capita_sewage": 1,
    },
)
def conveyance_through_nongravity_sewer_network_connected_to_stp():
    return (
        population_discharging_to_nongravity_based_stp_connected_sewer_network()
        * per_capita_sewage()
    )


@component.add(
    name="untreated sewage in GW",
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_untreated_sewage_in_gw": 1},
    other_deps={
        "_integ_untreated_sewage_in_gw": {
            "initial": {},
            "step": {
                "infilteration_to_gw_from_insitu": 1,
                "infilteration_from_non_stp_sewer_network_to_gw": 1,
                "infilteration_from_gravity_sewer_network_to_gw": 1,
                "infilteration_from_nongravity_sewer_network_to_gw": 1,
                "untreated_sewage_from_gw_to_river": 1,
            },
        }
    },
)
def untreated_sewage_in_gw():
    return _integ_untreated_sewage_in_gw()


_integ_untreated_sewage_in_gw = Integ(
    lambda: infilteration_to_gw_from_insitu()
    + infilteration_from_non_stp_sewer_network_to_gw()
    + infilteration_from_gravity_sewer_network_to_gw()
    + infilteration_from_nongravity_sewer_network_to_gw()
    - untreated_sewage_from_gw_to_river(),
    lambda: 0,
    "_integ_untreated_sewage_in_gw",
)


@component.add(
    name='"Sewage water in In-situ"',
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_insitu": 1},
    other_deps={
        "_integ_sewage_water_in_insitu": {
            "initial": {},
            "step": {
                "sewer_water_generation_in_insitu": 1,
                "infilteration_to_gw_from_insitu": 1,
            },
        }
    },
)
def sewage_water_in_insitu():
    return _integ_sewage_water_in_insitu()


_integ_sewage_water_in_insitu = Integ(
    lambda: sewer_water_generation_in_insitu() - infilteration_to_gw_from_insitu(),
    lambda: 100,
    "_integ_sewage_water_in_insitu",
)


@component.add(
    name="treated sewage dischage to river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"treatment": 1, "treated_water_to_other_drainscanal": 1},
)
def treated_sewage_dischage_to_river():
    return treatment() - treated_water_to_other_drainscanal()


@component.add(
    name="Treated sewage water in STP",
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_treated_sewage_water_in_stp": 1},
    other_deps={
        "_integ_treated_sewage_water_in_stp": {
            "initial": {},
            "step": {
                "treatment": 1,
                "treated_sewage_dischage_to_river": 1,
                "treated_water_to_other_drainscanal": 1,
            },
        }
    },
)
def treated_sewage_water_in_stp():
    return _integ_treated_sewage_water_in_stp()


_integ_treated_sewage_water_in_stp = Integ(
    lambda: treatment()
    - treated_sewage_dischage_to_river()
    - treated_water_to_other_drainscanal(),
    lambda: 125,
    "_integ_treated_sewage_water_in_stp",
)


@component.add(
    name='"treated water to other drains/canal"',
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "treatment": 1,
        "fraction_of_treated_sewage_discharge_from_stp_to_other_drainscanal": 1,
    },
)
def treated_water_to_other_drainscanal():
    return (
        treatment()
        * fraction_of_treated_sewage_discharge_from_stp_to_other_drainscanal()
    )


@component.add(
    name='"fraction of treated sewage discharge from STP to other drains/canal"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_treated_sewage_discharge_from_stp_to_other_drainscanal():
    return 0


@component.add(
    name='"fraction of untreated sewage discharge from STP to other drains/canal"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def fraction_of_untreated_sewage_discharge_from_stp_to_other_drainscanal():
    return 0


@component.add(
    name="BOD in untreated sewage from GW", comp_type="Constant", comp_subtype="Normal"
)
def bod_in_untreated_sewage_from_gw():
    return 1


@component.add(
    name="BOD load from untreated GW",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "untreated_sewage_from_gw_to_river": 1,
        "bod_in_untreated_sewage_from_gw": 1,
    },
)
def bod_load_from_untreated_gw():
    return untreated_sewage_from_gw_to_river() * bod_in_untreated_sewage_from_gw()


@component.add(
    name="actual pumping output",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"pumping_working_capacity": 1, "hrs_pump_operated": 1},
)
def actual_pumping_output():
    return pumping_working_capacity() * hrs_pump_operated() / 24


@component.add(
    name="PS to STP",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewer_network_to_ps": 1,
        "tapped_drains_nongravity_to_ps": 1,
        "actual_pumping_output": 1,
    },
)
def ps_to_stp():
    return float(
        np.minimum(
            sewer_network_to_ps() + tapped_drains_nongravity_to_ps(),
            actual_pumping_output(),
        )
    )


@component.add(
    name="pump degradation",
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"condition_of_pumps_station": 1, "effective_pump_degradation_rate": 1},
)
def pump_degradation():
    return condition_of_pumps_station() * effective_pump_degradation_rate() / 365


@component.add(name="pump rehabilitation", comp_type="Constant", comp_subtype="Normal")
def pump_rehabilitation():
    return 0


@component.add(
    name='"Non-STP sewer network addition to untapped drains goal"',
    units="1/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def nonstp_sewer_network_addition_to_untapped_drains_goal():
    return 0


@component.add(
    name='"tapped drain (nongravity) rehabilitation"',
    comp_type="Constant",
    comp_subtype="Normal",
)
def tapped_drain_nongravity_rehabilitation():
    return 0


@component.add(name="STP rehabilitation", comp_type="Constant", comp_subtype="Normal")
def stp_rehabilitation():
    return 0


@component.add(
    name="hrs pump operated", units="hour", comp_type="Constant", comp_subtype="Normal"
)
def hrs_pump_operated():
    return 24


@component.add(
    name="normal pump degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"average_age_of_pump_station": 1},
)
def normal_pump_degradation_rate():
    return np.interp(
        average_age_of_pump_station(),
        [
            0.0,
            0.207831,
            0.388554,
            0.533133,
            0.668675,
            0.831325,
            0.948795,
            1.08434,
            1.21988,
            1.34639,
            1.47289,
            1.61747,
            1.8494,
            2.03313,
            2.20482,
            2.42169,
            2.62952,
            2.81928,
            3.0,
            100.0,
        ],
        [
            0.0,
            0.041176,
            0.091176,
            0.158824,
            0.223529,
            0.317647,
            0.391176,
            0.461765,
            0.544118,
            0.626471,
            0.7,
            0.797059,
            0.897059,
            0.955882,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
        ],
    )


@component.add(
    name="sewer network degradation",
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"condition_of_sewer_network": 1, "effective_sewer_degradation_rate": 1},
)
def sewer_network_degradation():
    return condition_of_sewer_network() * effective_sewer_degradation_rate() / 365


@component.add(
    name="normal sewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"average_age_of_sewer_network": 1},
)
def normal_sewer_degradation_rate():
    return np.interp(
        average_age_of_sewer_network(),
        [
            0.0,
            4.24699,
            7.31928,
            10.3012,
            12.8313,
            15.1807,
            17.1687,
            18.9759,
            21.3253,
            22.8614,
            24.3072,
            26.747,
            30.0,
            100.0,
        ],
        [
            0.0,
            0.023529,
            0.055882,
            0.117647,
            0.185294,
            0.279412,
            0.370588,
            0.497059,
            0.65,
            0.767647,
            0.873529,
            0.976471,
            1.0,
            1.0,
        ],
    )


@component.add(
    name="normal STP degradation rate",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"stp_average_age": 1},
)
def normal_stp_degradation_rate():
    return np.interp(
        stp_average_age(),
        [
            0.0,
            1.58133,
            2.75602,
            3.75,
            4.78916,
            5.87349,
            6.68675,
            7.54518,
            8.17771,
            8.9006,
            9.53313,
            10.0301,
            10.7078,
            11.2952,
            11.8373,
            12.244,
            12.6054,
            13.3283,
            13.8705,
            15.0,
            20.0,
            25.0,
            50.0,
            100.0,
        ],
        [
            0.0,
            0.005882,
            0.017647,
            0.032353,
            0.067647,
            0.108824,
            0.152941,
            0.202941,
            0.247059,
            0.297059,
            0.358824,
            0.4,
            0.473529,
            0.541176,
            0.641176,
            0.755882,
            0.85,
            0.926471,
            0.964706,
            0.99,
            1.0,
            1.0,
            1.0,
            1.0,
        ],
    )


@component.add(
    name='"normal tapped drain (nongravity) degradation rate"',
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tapped_drain_nongravity_average_age": 1},
)
def normal_tapped_drain_nongravity_degradation_rate():
    return np.interp(
        tapped_drain_nongravity_average_age(),
        [
            0.00000e00,
            9.03610e-02,
            1.56627e-01,
            2.40964e-01,
            3.01205e-01,
            3.55422e-01,
            4.06626e-01,
            4.48795e-01,
            5.00000e-01,
            5.81325e-01,
            6.74699e-01,
            7.71084e-01,
            8.58434e-01,
            9.33735e-01,
            1.00000e00,
            1.12952e00,
            1.25000e00,
            2.00000e00,
            3.00000e00,
            1.00000e02,
        ],
        [
            0.0,
            0.038235,
            0.097059,
            0.211765,
            0.305882,
            0.408824,
            0.508824,
            0.608824,
            0.717647,
            0.814706,
            0.879412,
            0.935294,
            0.973529,
            0.988235,
            0.99,
            0.991176,
            1.0,
            1.0,
            1.0,
            1.0,
        ],
    )


@component.add(
    name='"tapped drain (nongravity) degradation"',
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conditions_of_screens_in_tapped_drains_nongravity": 1,
        "effective_tapped_drain_nongravity_degradation_rate": 1,
    },
)
def tapped_drain_nongravity_degradation():
    return (
        conditions_of_screens_in_tapped_drains_nongravity()
        * effective_tapped_drain_nongravity_degradation_rate()
        / 365
    )


@component.add(
    name="Efforts preventive maintenance for sewer network",
    units="Dmnl",
    comp_type="Constant",
    comp_subtype="Normal",
)
def efforts_preventive_maintenance_for_sewer_network():
    return 0.99


@component.add(
    name="underconstruction time",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def underconstruction_time():
    return 1


@component.add(
    name="STP capacity underproposal",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_capacity_underproposal": 1},
    other_deps={
        "_integ_stp_capacity_underproposal": {
            "initial": {},
            "step": {"proposal": 1, "approval": 1},
        }
    },
)
def stp_capacity_underproposal():
    return _integ_stp_capacity_underproposal()


_integ_stp_capacity_underproposal = Integ(
    lambda: proposal() - approval(), lambda: 0, "_integ_stp_capacity_underproposal"
)


@component.add(
    name="proposal",
    units="(ML/day)*1/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"additional_stp_capacity_required": 1, "time": 1},
)
def proposal():
    return additional_stp_capacity_required() * pulse(__data["time"], 0, width=1)


@component.add(
    name="STP underconstruction",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_underconstruction": 1},
    other_deps={
        "_integ_stp_underconstruction": {
            "initial": {},
            "step": {"underconstruction": 1, "stp_capacity_addition": 1},
        }
    },
)
def stp_underconstruction():
    return _integ_stp_underconstruction()


_integ_stp_underconstruction = Integ(
    lambda: underconstruction() - stp_capacity_addition(),
    lambda: 0,
    "_integ_stp_underconstruction",
)


@component.add(
    name="approval to underconstruction time",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def approval_to_underconstruction_time():
    return 1


@component.add(
    name="STP approved",
    units="ML/day",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_stp_approved": 1},
    other_deps={
        "_integ_stp_approved": {
            "initial": {},
            "step": {"approval": 1, "underconstruction": 1},
        }
    },
)
def stp_approved():
    return _integ_stp_approved()


_integ_stp_approved = Integ(
    lambda: approval() - underconstruction(), lambda: 0, "_integ_stp_approved"
)


@component.add(
    name="overflow from PS to river",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewer_network_to_ps": 1,
        "tapped_drains_nongravity_to_ps": 1,
        "ps_to_stp": 1,
    },
)
def overflow_from_ps_to_river():
    return (sewer_network_to_ps() + tapped_drains_nongravity_to_ps()) - ps_to_stp()


@component.add(
    name='"Sewage water in pumping station (PS)"',
    units="ML",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewage_water_in_pumping_station_ps": 1},
    other_deps={
        "_integ_sewage_water_in_pumping_station_ps": {
            "initial": {},
            "step": {
                "sewer_network_to_ps": 1,
                "tapped_drains_nongravity_to_ps": 1,
                "overflow_from_ps_to_river": 1,
                "ps_to_stp": 1,
            },
        }
    },
)
def sewage_water_in_pumping_station_ps():
    return _integ_sewage_water_in_pumping_station_ps()


_integ_sewage_water_in_pumping_station_ps = Integ(
    lambda: sewer_network_to_ps()
    + tapped_drains_nongravity_to_ps()
    - overflow_from_ps_to_river()
    - ps_to_stp(),
    lambda: 120,
    "_integ_sewage_water_in_pumping_station_ps",
)


@component.add(
    name="BOD of untreated sewage water",
    units="mg/l",
    comp_type="Constant",
    comp_subtype="Normal",
)
def bod_of_untreated_sewage_water():
    """
    approx avg value from all the drains in table 2.4 , stretch iii , https://cpcb.nic.in/NGT/Action-Plan-Rej-River-OA-No-368-2021.pdf mg/l = KG/ML 45 mg/l is taken as avg of drains from Anand’s data
    """
    return 45


# ────────────────────────────────────────────────────────────────────────────
# Sewer Network (gravity/nongravity) conveyance-augmentation pathway.
# Ported from Model Documentation.txt lines 540-557, 1111-1117, 1371-1394,
# 1790-1838, 1970-1990, 2085-2266, 2483-2532, 2787-2806, 3271-3274.
# ────────────────────────────────────────────────────────────────────────────


@component.add(
    name="sewage flow from untapped to be connected with STP connected gavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from untapped to be connected with STP connected nongavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from nongravity tapped drains to be connected with STP connected gavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from nongravity tapped drains to be connected with STP connected nongavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from gravity tapped drains to be connected with STP connected gavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from gravity tapped drains to be connected with STP connected nongavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from insitu to be connected with STP connected gavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from insitu to be connected with STP connected nongavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from nonSTP sewer network to be connected with STP connected gavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network():
    return 0


@component.add(
    name="sewage flow from nonSTP sewer network to be connected with STP connected nongavity sewer network",
    units="ML/day",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network():
    return 0


@component.add(
    name="total sewage flow to be connected with STP connected gravity sewer network",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
    },
)
def total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network():
    return (
        sewage_flow_from_insitu_to_be_connected_with_stp_connected_gavity_sewer_network()
        + sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_gavity_sewer_network()
        + sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network()
        + sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network()
        + sewage_flow_from_untapped_to_be_connected_with_stp_connected_gavity_sewer_network()
    )


@component.add(
    name="total sewage flow to be connected with STP connected nongravity sewer network",
    units="ML/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
    },
)
def total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network():
    return (
        sewage_flow_from_insitu_to_be_connected_with_stp_connected_nongavity_sewer_network()
        + sewage_flow_from_nonstp_sewer_network_to_be_connected_with_stp_connected_nongavity_sewer_network()
        + sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network()
        + sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network()
        + sewage_flow_from_untapped_to_be_connected_with_stp_connected_nongavity_sewer_network()
    )


@component.add(
    name="per STP population to be added to STP connected gravity sewer network",
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_stp_capacity_augmentation": 1,
        "total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def per_stp_population_to_be_added_to_stp_connected_gravity_sewer_network():
    return if_then_else(
        decision_for_stp_capacity_augmentation() == 1,
        lambda: (
            total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network()
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network()
        / per_capita_sewage(),
    )


@component.add(
    name="per STP population to be added to STP connected nongravity sewer network",
    units="people",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_stp_capacity_augmentation": 1,
        "total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def per_stp_population_to_be_added_to_stp_connected_nongravity_sewer_network():
    return if_then_else(
        decision_for_stp_capacity_augmentation() == 1,
        lambda: (
            total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network()
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network()
        / per_capita_sewage(),
    )


@component.add(
    name="time for STP connected gravity based sewer network addition",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_stp_connected_gravity_based_sewer_network_addition():
    return 0


@component.add(
    name="time for STP connected nongravity based sewer network addition",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_stp_connected_nongravity_based_sewer_network_addition():
    return 0


@component.add(
    name="timeline for STP connected gravity sewer network addition",
    units="year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_conveyance_capacity_augmentation": 1,
        "planning_choice_between_centralised_and_decentralised": 1,
        "time_for_stp_connected_gravity_based_sewer_network_addition": 1,
        "time": 1,
    },
)
def timeline_for_stp_connected_gravity_sewer_network_addition():
    return if_then_else(
        np.logical_and(
            decision_for_conveyance_capacity_augmentation() == 1,
            planning_choice_between_centralised_and_decentralised() == 1,
        ),
        lambda: pulse(
            __data["time"],
            integer(time_for_stp_connected_gravity_based_sewer_network_addition() * 365),
            width=1,
        ),
        lambda: pulse(
            __data["time"],
            integer(time_for_stp_connected_gravity_based_sewer_network_addition() * 365),
            width=1,
        ),
    )


@component.add(
    name="timeline for STP connected nongravity sewer network addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_conveyance_capacity_augmentation": 1,
        "planning_choice_between_centralised_and_decentralised": 1,
        "time_for_stp_connected_nongravity_based_sewer_network_addition": 1,
        "time": 1,
    },
)
def timeline_for_stp_connected_nongravity_sewer_network_addition():
    return if_then_else(
        np.logical_and(
            decision_for_conveyance_capacity_augmentation() == 1,
            planning_choice_between_centralised_and_decentralised() == 1,
        ),
        lambda: pulse(
            __data["time"],
            integer(time_for_stp_connected_nongravity_based_sewer_network_addition() * 365),
            width=1,
        ),
        lambda: pulse(
            __data["time"],
            integer(time_for_stp_connected_nongravity_based_sewer_network_addition() * 365),
            width=1,
        ),
    )


@component.add(
    name="timeline for capital investment in new sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "decision_for_conveyance_capacity_augmentation": 1,
        "decision_for_stp_capacity_augmentation": 1,
        "stp_proposal_to_approval_timeline": 1,
        "time_for_stp_connected_gravity_based_sewer_network_addition": 1,
        "time_for_stp_connected_nongravity_based_sewer_network_addition": 1,
        "time": 1,
    },
)
def timeline_for_capital_investment_in_new_sewer_network():
    return if_then_else(
        np.logical_and(
            decision_for_conveyance_capacity_augmentation() == 1,
            decision_for_stp_capacity_augmentation() == 1,
        ),
        lambda: stp_proposal_to_approval_timeline(),
        lambda: pulse(
            __data["time"],
            float(
                np.maximum(
                    time_for_stp_connected_gravity_based_sewer_network_addition() * 365,
                    time_for_stp_connected_nongravity_based_sewer_network_addition() * 365,
                )
            ),
            width=1,
        ),
    )


@component.add(
    name="default network length to be built",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network": 1,
        "total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network": 1,
        "no_of_stps": 1,
    },
)
def default_network_length_to_be_built():
    total_flow = (
        total_sewage_flow_to_be_connected_with_stp_connected_gravity_sewer_network()
        + total_sewage_flow_to_be_connected_with_stp_connected_nongravity_sewer_network()
    )
    return if_then_else(
        total_flow > 0,
        lambda: (-353 + 305 * np.log(total_flow)) / np.sqrt(no_of_stps()),
        lambda: 0,
    )


@component.add(
    name="default per KM construction cost for sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def default_per_km_construction_cost_for_sewer_network():
    return 0.4


@component.add(
    name="user input sewer network length",
    comp_type="Constant",
    comp_subtype="Normal",
)
def user_input_sewer_network_length():
    return 0


@component.add(
    name="sewer network length to be built",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "user_input_sewer_network_length": 1,
        "default_network_length_to_be_built": 1,
    },
)
def sewer_network_length_to_be_built():
    return if_then_else(
        user_input_sewer_network_length() == 0,
        lambda: default_network_length_to_be_built(),
        lambda: user_input_sewer_network_length(),
    )


@component.add(
    name="new sewer network addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "sewer_network_length_to_be_built": 1,
        "timeline_for_capital_investment_in_new_sewer_network": 1,
    },
)
def new_sewer_network_addition():
    return (
        sewer_network_length_to_be_built()
        * timeline_for_capital_investment_in_new_sewer_network()
    )


@component.add(
    name="sewer network length at Tzero",
    comp_type="Constant",
    comp_subtype="Normal",
)
def sewer_network_length_at_tzero():
    return 1442


@component.add(
    name="Sewer network length",
    units="KM",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_sewer_network_length": 1},
    other_deps={
        "_integ_sewer_network_length": {
            "initial": {"sewer_network_length_at_tzero": 1},
            "step": {"new_sewer_network_addition": 1},
        }
    },
)
def sewer_network_length():
    return _integ_sewer_network_length()


_integ_sewer_network_length = Integ(
    lambda: new_sewer_network_addition(),
    lambda: sewer_network_length_at_tzero(),
    "_integ_sewer_network_length",
)


@component.add(
    name="STP sewer network addition to gravity tapped",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def stp_sewer_network_addition_to_gravity_tapped():
    return if_then_else(
        (
            gravity_based_stp_connected_sewer_network_addition()
            + non_gravity_based_stp_sewer_network_connection_addition()
        )
        > 0,
        lambda: (
            (
                sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network()
                + sewage_flow_from_gravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network()
            )
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: 0,
    )


@component.add(
    name="STP sewer network connection to nongravity tapped",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network": 1,
        "sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network": 1,
        "per_capita_sewage": 1,
        "no_of_stps": 1,
    },
)
def stp_sewer_network_connection_to_nongravity_tapped():
    return if_then_else(
        (
            gravity_based_stp_connected_sewer_network_addition()
            + non_gravity_based_stp_sewer_network_connection_addition()
        )
        > 0,
        lambda: (
            (
                sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_nongavity_sewer_network()
                + sewage_flow_from_nongravity_tapped_drains_to_be_connected_with_stp_connected_gavity_sewer_network()
            )
            / per_capita_sewage()
        )
        / no_of_stps(),
        lambda: 0,
    )


# ────────────────────────────────────────────────────────────────────────────
# Gravity / non-gravity sewer network condition, age, degradation and
# maintenance-effort chain — split out from the previously-merged single
# "sewer network" subsystem, mirroring the existing tapped-gravity /
# tapped-nongravity pattern. Ported from Model Documentation.txt lines
# 22-30, 114-122, 241-249, 305-337, 369-405, 495-503, 660-678, 822-834,
# 910-919, 935-943, 956-970, 1256-1283, 1269-1283, 2448-2456, 2967-2985 (approx).
# ────────────────────────────────────────────────────────────────────────────


@component.add(
    name="adequacy of monitoring and oversight of gravity sewer network performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance():
    return 95


@component.add(
    name="adequacy of monitoring and oversight of nongravity sewer network performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance():
    return 95


@component.add(
    name="Tzero adequacy of monitoring and oversight of gravity sewer network performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance():
    return 95


@component.add(
    name="Tzero adequacy of monitoring and oversight of nongravity sewer network performance",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance():
    return 95


@component.add(
    name="availability of appropriate skill for gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_gravity_sewer_network():
    return 95


@component.add(
    name="availability of appropriate skill for nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def availability_of_appropriate_skill_for_nongravity_sewer_network():
    return 95


@component.add(
    name="Tzero availability of appropriate skill for gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_gravity_sewer_network():
    return 95


@component.add(
    name="Tzero availability of appropriate skill for nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_availability_of_appropriate_skill_for_nongravity_sewer_network():
    return 95


@component.add(
    name="coordination between agencies for gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_gravity_sewer_network():
    return 95


@component.add(
    name="coordination between agencies for nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def coordination_between_agencies_for_nongravity_sewer_network():
    return 95


@component.add(
    name="Tzero coordination between agencies for gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_gravity_sewer_network():
    return 95


@component.add(
    name="Tzero coordination between agencies for nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def tzero_coordination_between_agencies_for_nongravity_sewer_network():
    return 95


@component.add(
    name="change in maintenance of gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def change_in_maintenance_of_gravity_sewer_network():
    return 0


@component.add(
    name="change in maintenance of nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def change_in_maintenance_of_nongravity_sewer_network():
    return 0


@component.add(
    name="time for changing maintentance effort for gravity sewer network",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_gravity_sewer_network():
    return 0


@component.add(
    name="time for changing maintentance effort for nongravity sewer network",
    units="year",
    comp_type="Constant",
    comp_subtype="Normal",
)
def time_for_changing_maintentance_effort_for_nongravity_sewer_network():
    return 0


@component.add(
    name="input maintenance effort index for gravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance": 1,
        "coordination_between_agencies_for_gravity_sewer_network": 1,
        "availability_of_appropriate_skill_for_gravity_sewer_network": 1,
    },
)
def input_maintenance_effort_index_for_gravity_sewer_network():
    return (
        adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance()
        * coordination_between_agencies_for_gravity_sewer_network()
        * availability_of_appropriate_skill_for_gravity_sewer_network()
        / 1000000.0
    )


@component.add(
    name="input maintenance effort index for nongravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance": 1,
        "coordination_between_agencies_for_nongravity_sewer_network": 1,
        "availability_of_appropriate_skill_for_nongravity_sewer_network": 1,
    },
)
def input_maintenance_effort_index_for_nongravity_sewer_network():
    return (
        adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance()
        * coordination_between_agencies_for_nongravity_sewer_network()
        * availability_of_appropriate_skill_for_nongravity_sewer_network()
        / 1000000.0
    )


@component.add(
    name="Tzero maintenance effort index for gravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance": 1,
        "tzero_coordination_between_agencies_for_gravity_sewer_network": 1,
        "tzero_availability_of_appropriate_skill_for_gravity_sewer_network": 1,
    },
)
def tzero_maintenance_effort_index_for_gravity_sewer_network():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_gravity_sewer_network_performance()
        * tzero_coordination_between_agencies_for_gravity_sewer_network()
        * tzero_availability_of_appropriate_skill_for_gravity_sewer_network()
        / 1000000.0
    )


@component.add(
    name="Tzero maintenance effort index for nongravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "tzero_adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance": 1,
        "tzero_coordination_between_agencies_for_nongravity_sewer_network": 1,
        "tzero_availability_of_appropriate_skill_for_nongravity_sewer_network": 1,
    },
)
def tzero_maintenance_effort_index_for_nongravity_sewer_network():
    return (
        tzero_adequacy_of_monitoring_and_oversight_of_nongravity_sewer_network_performance()
        * tzero_coordination_between_agencies_for_nongravity_sewer_network()
        * tzero_availability_of_appropriate_skill_for_nongravity_sewer_network()
        / 1000000.0
    )


@component.add(
    name="input efforts preventive maintenance for gravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_gravity_sewer_network": 1},
)
def input_efforts_preventive_maintenance_for_gravity_sewer_network():
    return np.interp(
        input_maintenance_effort_index_for_gravity_sewer_network(),
        [
            0.091, 0.142, 0.142, 0.142, 0.192, 0.192, 0.192, 0.221, 0.221, 0.221,
            0.299, 0.299, 0.299, 0.299, 0.299, 0.299, 0.343, 0.406, 0.406, 0.406,
            0.466, 0.466, 0.466, 0.632, 0.632, 0.632, 0.857,
        ],
        [
            0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45,
            0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
            0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95,
        ],
    )


@component.add(
    name="input efforts preventive maintenance for nongravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"input_maintenance_effort_index_for_nongravity_sewer_network": 1},
)
def input_efforts_preventive_maintenance_for_nongravity_sewer_network():
    return np.interp(
        input_maintenance_effort_index_for_nongravity_sewer_network(),
        [
            0.091, 0.142, 0.142, 0.142, 0.192, 0.192, 0.192, 0.221, 0.221, 0.221,
            0.299, 0.299, 0.299, 0.299, 0.299, 0.299, 0.343, 0.406, 0.406, 0.406,
            0.466, 0.466, 0.466, 0.632, 0.632, 0.632, 0.857,
        ],
        [
            0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45,
            0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
            0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95,
        ],
    )


@component.add(
    name="Tzero efforts preventive maintenance for gravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_gravity_sewer_network": 1},
)
def tzero_efforts_preventive_maintenance_for_gravity_sewer_network():
    return np.interp(
        tzero_maintenance_effort_index_for_gravity_sewer_network(),
        [
            0.091, 0.142, 0.142, 0.142, 0.192, 0.192, 0.192, 0.221, 0.221, 0.221,
            0.299, 0.299, 0.299, 0.299, 0.299, 0.299, 0.343, 0.406, 0.406, 0.406,
            0.466, 0.466, 0.466, 0.632, 0.632, 0.632, 0.857,
        ],
        [
            0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45,
            0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
            0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95,
        ],
    )


@component.add(
    name="Tzero efforts preventive maintenance for nongravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"tzero_maintenance_effort_index_for_nongravity_sewer_network": 1},
)
def tzero_efforts_preventive_maintenance_for_nongravity_sewer_network():
    return np.interp(
        tzero_maintenance_effort_index_for_nongravity_sewer_network(),
        [
            0.091, 0.142, 0.142, 0.142, 0.192, 0.192, 0.192, 0.221, 0.221, 0.221,
            0.299, 0.299, 0.299, 0.299, 0.299, 0.299, 0.343, 0.406, 0.406, 0.406,
            0.466, 0.466, 0.466, 0.632, 0.632, 0.632, 0.857,
        ],
        [
            0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45,
            0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
            0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95,
        ],
    )


@component.add(
    name="Efforts preventive maintenance for gravity sewer network",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_gravity_sewer_network": 1,
        "tzero_efforts_preventive_maintenance_for_gravity_sewer_network": 1,
        "input_efforts_preventive_maintenance_for_gravity_sewer_network": 1,
    },
)
def efforts_preventive_maintenance_for_gravity_sewer_network():
    return if_then_else(
        time()
        < integer(
            time_for_changing_maintentance_effort_for_gravity_sewer_network() * 365
        ),
        lambda: tzero_efforts_preventive_maintenance_for_gravity_sewer_network(),
        lambda: input_efforts_preventive_maintenance_for_gravity_sewer_network(),
    )


@component.add(
    name="Efforts preventive maintenance for nongravity sewer network",
    units="Dmnl",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "time": 1,
        "time_for_changing_maintentance_effort_for_nongravity_sewer_network": 1,
        "tzero_efforts_preventive_maintenance_for_nongravity_sewer_network": 1,
        "input_efforts_preventive_maintenance_for_nongravity_sewer_network": 1,
    },
)
def efforts_preventive_maintenance_for_nongravity_sewer_network():
    return if_then_else(
        time()
        < integer(
            time_for_changing_maintentance_effort_for_nongravity_sewer_network() * 365
        ),
        lambda: tzero_efforts_preventive_maintenance_for_nongravity_sewer_network(),
        lambda: input_efforts_preventive_maintenance_for_nongravity_sewer_network(),
    )


@component.add(
    name="gravity sewer age increment",
    units="year/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"conveyance_through_gravity_sewer_network_connected_to_stp": 1},
)
def gravity_sewer_age_increment():
    return if_then_else(
        conveyance_through_gravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: 1 / 365,
    )


@component.add(
    name="non gravity sewer age increment",
    units="year/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={"conveyance_through_nongravity_sewer_network_connected_to_stp": 1},
)
def non_gravity_sewer_age_increment():
    return if_then_else(
        conveyance_through_nongravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: 1 / 365,
    )


@component.add(
    name="new gravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_gravity_sewer_network_connected_to_stp": 3,
        "average_age_of_gravity_sewer_network": 1,
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "per_capita_sewage": 1,
    },
)
def new_gravity_sewer_network():
    return if_then_else(
        conveyance_through_gravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: average_age_of_gravity_sewer_network()
        * (
            1
            - conveyance_through_gravity_sewer_network_connected_to_stp()
            / (
                conveyance_through_gravity_sewer_network_connected_to_stp()
                + gravity_based_stp_connected_sewer_network_addition() * per_capita_sewage()
            )
        ),
    )


@component.add(
    name="new nongravity sewer network",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_nongravity_sewer_network_connected_to_stp": 3,
        "average_age_of_non_gravity_sewer_network": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "per_capita_sewage": 1,
    },
)
def new_nongravity_sewer_network():
    return if_then_else(
        conveyance_through_nongravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: average_age_of_non_gravity_sewer_network()
        * (
            1
            - conveyance_through_nongravity_sewer_network_connected_to_stp()
            / (
                conveyance_through_nongravity_sewer_network_connected_to_stp()
                + non_gravity_based_stp_sewer_network_connection_addition() * per_capita_sewage()
            )
        ),
    )


@component.add(
    name="average age of gravity sewer network",
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_average_age_of_gravity_sewer_network": 1},
    other_deps={
        "_integ_average_age_of_gravity_sewer_network": {
            "initial": {},
            "step": {"gravity_sewer_age_increment": 1, "new_gravity_sewer_network": 1},
        }
    },
)
def average_age_of_gravity_sewer_network():
    return _integ_average_age_of_gravity_sewer_network()


_integ_average_age_of_gravity_sewer_network = Integ(
    lambda: gravity_sewer_age_increment() - new_gravity_sewer_network(),
    lambda: 0,
    "_integ_average_age_of_gravity_sewer_network",
)


@component.add(
    name="average age of non gravity sewer network",
    units="year",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_average_age_of_non_gravity_sewer_network": 1},
    other_deps={
        "_integ_average_age_of_non_gravity_sewer_network": {
            "initial": {},
            "step": {
                "non_gravity_sewer_age_increment": 1,
                "new_nongravity_sewer_network": 1,
            },
        }
    },
)
def average_age_of_non_gravity_sewer_network():
    return _integ_average_age_of_non_gravity_sewer_network()


_integ_average_age_of_non_gravity_sewer_network = Integ(
    lambda: non_gravity_sewer_age_increment() - new_nongravity_sewer_network(),
    lambda: 0,
    "_integ_average_age_of_non_gravity_sewer_network",
)


@component.add(
    name="normal gravity sewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"average_age_of_gravity_sewer_network": 1},
)
def normal_gravity_sewer_degradation_rate():
    return np.interp(
        average_age_of_gravity_sewer_network(),
        [0.0, 4.24699, 7.31928, 10.3012, 12.8313, 15.1807, 17.1687, 18.9759, 21.3253, 22.8614, 24.3072, 26.747, 30.0, 100.0],
        [0.0, 0.023529, 0.055882, 0.117647, 0.185294, 0.279412, 0.370588, 0.497059, 0.65, 0.767647, 0.873529, 0.976471, 1.0, 1.0],
    )


@component.add(
    name="normal nongravitysewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="with Lookup",
    depends_on={"average_age_of_non_gravity_sewer_network": 1},
)
def normal_nongravitysewer_degradation_rate():
    return np.interp(
        average_age_of_non_gravity_sewer_network(),
        [0.0, 4.24699, 7.31928, 10.3012, 12.8313, 15.1807, 17.1687, 18.9759, 21.3253, 22.8614, 24.3072, 26.747, 30.0, 100.0],
        [0.0, 0.023529, 0.055882, 0.117647, 0.185294, 0.279412, 0.370588, 0.497059, 0.65, 0.767647, 0.873529, 0.976471, 1.0, 1.0],
    )


@component.add(
    name="effective gravity sewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_gravity_sewer_degradation_rate": 1,
        "efforts_preventive_maintenance_for_gravity_sewer_network": 1,
    },
)
def effective_gravity_sewer_degradation_rate():
    return normal_gravity_sewer_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_gravity_sewer_network()
    )


@component.add(
    name="effective non gravity sewer degradation rate",
    units="1/year",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "normal_nongravitysewer_degradation_rate": 1,
        "efforts_preventive_maintenance_for_nongravity_sewer_network": 1,
    },
)
def effective_non_gravity_sewer_degradation_rate():
    return normal_nongravitysewer_degradation_rate() * (
        1 - efforts_preventive_maintenance_for_nongravity_sewer_network()
    )


@component.add(
    name="condition of newly added gravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_of_newly_added_gravity_sewer_network():
    return 100


@component.add(
    name="condition of newly added nongravity sewer network",
    comp_type="Constant",
    comp_subtype="Normal",
)
def condition_of_newly_added_nongravity_sewer_network():
    return 100


@component.add(
    name="gravity sewer network rehabilitation", comp_type="Constant", comp_subtype="Normal"
)
def gravity_sewer_network_rehabilitation():
    return 0


@component.add(
    name="condition change due to nongravity sewer network addition 0",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_gravity_sewer_network_connected_to_stp": 3,
        "condition_of_gravity_sewer_network": 2,
        "condition_of_newly_added_gravity_sewer_network": 1,
        "gravity_based_stp_connected_sewer_network_addition": 1,
        "per_capita_sewage": 1,
    },
)
def condition_change_due_to_nongravity_sewer_network_addition_0():
    return if_then_else(
        conveyance_through_gravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: (
            (
                condition_of_gravity_sewer_network()
                * conveyance_through_gravity_sewer_network_connected_to_stp()
                + condition_of_newly_added_gravity_sewer_network()
                * gravity_based_stp_connected_sewer_network_addition()
                * per_capita_sewage()
            )
            / (
                conveyance_through_gravity_sewer_network_connected_to_stp()
                + gravity_based_stp_connected_sewer_network_addition() * per_capita_sewage()
            )
        )
        - condition_of_gravity_sewer_network(),
    )


@component.add(
    name="condition change due to nongravity sewer network addition",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "conveyance_through_nongravity_sewer_network_connected_to_stp": 3,
        "condition_of_nongravity_sewer_network": 2,
        "condition_of_newly_added_nongravity_sewer_network": 1,
        "non_gravity_based_stp_sewer_network_connection_addition": 1,
        "per_capita_sewage": 1,
    },
)
def condition_change_due_to_nongravity_sewer_network_addition():
    return if_then_else(
        conveyance_through_nongravity_sewer_network_connected_to_stp() == 0,
        lambda: 0,
        lambda: (
            (
                condition_of_nongravity_sewer_network()
                * conveyance_through_nongravity_sewer_network_connected_to_stp()
                + condition_of_newly_added_nongravity_sewer_network()
                * non_gravity_based_stp_sewer_network_connection_addition()
                * per_capita_sewage()
            )
            / (
                conveyance_through_nongravity_sewer_network_connected_to_stp()
                + non_gravity_based_stp_sewer_network_connection_addition() * per_capita_sewage()
            )
        )
        - condition_of_nongravity_sewer_network(),
    )


@component.add(
    name="gravity sewer network degradation",
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "condition_of_gravity_sewer_network": 1,
        "effective_gravity_sewer_degradation_rate": 1,
    },
)
def gravity_sewer_network_degradation():
    return (
        condition_of_gravity_sewer_network()
        * effective_gravity_sewer_degradation_rate()
        / 365
    )


@component.add(
    name="nongravity sewer network degradation",
    units="performance/day",
    comp_type="Auxiliary",
    comp_subtype="Normal",
    depends_on={
        "condition_of_nongravity_sewer_network": 1,
        "effective_non_gravity_sewer_degradation_rate": 1,
    },
)
def nongravity_sewer_network_degradation():
    return (
        condition_of_nongravity_sewer_network()
        * effective_non_gravity_sewer_degradation_rate()
        / 365
    )


@component.add(
    name="Condition of gravity sewer network",
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_condition_of_gravity_sewer_network": 1},
    other_deps={
        "_integ_condition_of_gravity_sewer_network": {
            "initial": {},
            "step": {
                "condition_change_due_to_nongravity_sewer_network_addition_0": 1,
                "gravity_sewer_network_rehabilitation": 1,
                "gravity_sewer_network_degradation": 1,
            },
        }
    },
)
def condition_of_gravity_sewer_network():
    return _integ_condition_of_gravity_sewer_network()


_integ_condition_of_gravity_sewer_network = Integ(
    lambda: condition_change_due_to_nongravity_sewer_network_addition_0()
    + gravity_sewer_network_rehabilitation()
    - gravity_sewer_network_degradation(),
    lambda: 100,
    "_integ_condition_of_gravity_sewer_network",
)


@component.add(
    name="Condition of nongravity sewer network",
    units="condition",
    comp_type="Stateful",
    comp_subtype="Integ",
    depends_on={"_integ_condition_of_nongravity_sewer_network": 1},
    other_deps={
        "_integ_condition_of_nongravity_sewer_network": {
            "initial": {},
            "step": {
                "condition_change_due_to_nongravity_sewer_network_addition": 1,
                "sewer_network_rehabilitation": 1,
                "nongravity_sewer_network_degradation": 1,
            },
        }
    },
)
def condition_of_nongravity_sewer_network():
    return _integ_condition_of_nongravity_sewer_network()


_integ_condition_of_nongravity_sewer_network = Integ(
    lambda: condition_change_due_to_nongravity_sewer_network_addition()
    + sewer_network_rehabilitation()
    - nongravity_sewer_network_degradation(),
    lambda: 100,
    "_integ_condition_of_nongravity_sewer_network",
)
