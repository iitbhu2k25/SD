// Mirrors app/api/schema/varuna_simulation_schema.py in fast_m.

export interface VarunaScenarioParams {
  population: number;
  per_capita_sewage: number;

  pct_untapped_drains: number;
  pct_tapped_non_gravity: number;
  pct_tapped_gravity: number;
  pct_stp_gravity_sewer: number;
  pct_stp_non_gravity_sewer: number;
  pct_non_stp_sewer: number;
  pct_in_situ: number;

  growth_untapped: number;
  growth_tapped_non_gravity: number;
  growth_tapped_gravity: number;
  growth_stp_gravity: number;
  growth_stp_non_gravity: number;
  growth_non_stp_sewer: number;
  growth_in_situ: number;

  stp_capacity: number;
  pump_capacity: number;

  maint_tapped: string;
  maint_stp: string;
  maint_pump: string;

  // Contextual maintenance — 3-factor breakdown (0/45/70/95)
  maint_tapped_gravity_monitoring: number;
  maint_tapped_gravity_coordination: number;
  maint_tapped_gravity_skill: number;
  maint_tapped_nongravity_monitoring: number;
  maint_tapped_nongravity_coordination: number;
  maint_tapped_nongravity_skill: number;
  maint_stp_monitoring: number;
  maint_stp_coordination: number;
  maint_stp_skill: number;
  maint_pump_monitoring: number;
  maint_pump_coordination: number;
  maint_pump_skill: number;
  maint_sewer_gravity_monitoring: number;
  maint_sewer_gravity_coordination: number;
  maint_sewer_gravity_skill: number;
  maint_sewer_nongravity_monitoring: number;
  maint_sewer_nongravity_coordination: number;
  maint_sewer_nongravity_skill: number;

  om_tapped: number;
  om_stp: number;
  om_pump: number;
  om_sewer_network: number;

  planning_choice: number;
  num_stp_required: number;
  unit_stp_size: number;
  technology_choice: number;
  proposal_approval_time: number;
  approval_construction_time: number;
  underconstruction_time: number;
  budget_allocation_delay: number;
  land_acquisition_delay: number;
  operational_clearance_time: number;

  drain_tap_gravity: number;
  drain_tap_gravity_time: number;
  drain_tap_nongravity: number;
  drain_tap_nongravity_time: number;
  additional_pumping: number;
  pumping_station_time: number;

  new_maint_tapped_ng: string;
  maint_time_tapped_ng: number;
  new_maint_tapped_g: string;
  maint_time_tapped_g: number;
  new_maint_pump: string;
  maint_time_pump: number;
  new_maint_stp_dec: string;
  maint_time_stp: number;

  change_maint_stp: boolean;
  change_maint_pump: boolean;
  change_maint_tapped_nongravity: boolean;
  change_maint_tapped_gravity: boolean;
  change_maint_sewer_nongravity: boolean;
  change_maint_sewer_gravity: boolean;

  new_maint_tapped_ng_monitoring: number;
  new_maint_tapped_ng_coordination: number;
  new_maint_tapped_ng_skill: number;
  new_maint_tapped_g_monitoring: number;
  new_maint_tapped_g_coordination: number;
  new_maint_tapped_g_skill: number;
  new_maint_pump_monitoring: number;
  new_maint_pump_coordination: number;
  new_maint_pump_skill: number;
  new_maint_stp_monitoring: number;
  new_maint_stp_coordination: number;
  new_maint_stp_skill: number;
  new_maint_sewer_gravity_monitoring: number;
  new_maint_sewer_gravity_coordination: number;
  new_maint_sewer_gravity_skill: number;
  maint_time_sewer_gravity: number;
  new_maint_sewer_nongravity_monitoring: number;
  new_maint_sewer_nongravity_coordination: number;
  new_maint_sewer_nongravity_skill: number;
  maint_time_sewer_nongravity: number;

  sewer_flow_untapped_gravity: number;
  sewer_flow_tapped_nongravity_gravity: number;
  sewer_flow_tapped_gravity_gravity: number;
  sewer_flow_insitu_gravity: number;
  sewer_flow_nonstp_gravity: number;
  sewer_time_gravity: number;

  sewer_flow_untapped_nongravity: number;
  sewer_flow_tapped_nongravity_nongravity: number;
  sewer_flow_tapped_gravity_nongravity: number;
  sewer_flow_insitu_nongravity: number;
  sewer_flow_nonstp_nongravity: number;
  sewer_time_nongravity: number;

  user_input_sewer_network_length: number;

  stp_construction: number;
  stp_om_cost: number;
  tap_construction: number;
  tap_om_cost: number;
  pump_construction: number;
  pump_om_cost: number;
  sewer_network_construction_per_km: number;
  sewer_network_om_per_km: number;

  projection_years: number;
  strategies: string[];
}

export const CONVEYANCE_LABELS: Record<string, string> = {
  pct_untapped_drains: 'Untapped Drains',
  pct_tapped_non_gravity: 'Tapped Non-Gravity',
  pct_tapped_gravity: 'Tapped Gravity',
  pct_stp_gravity_sewer: 'STP Gravity Sewer',
  pct_stp_non_gravity_sewer: 'STP Non-Gravity Sewer',
  pct_non_stp_sewer: 'Non-STP Sewer',
  pct_in_situ: 'In-Situ Treatment',
};

export const MAINTENANCE_OPTIONS = ['low (0.40)', 'medium (0.60)', 'high (>0.90)'];

// low/medium/high -> the 45/70/95 index value used by the SD model's
// monitoring/coordination/skill factors.
export const MAINTENANCE_FACTOR_OPTIONS: { label: string; value: number }[] = [
  { label: 'low', value: 45 },
  { label: 'medium', value: 70 },
  { label: 'high', value: 95 },
];

export const TECHNOLOGY_CHOICE_LABELS: Record<number, string> = {
  1: 'Waste Stabilization Pond (WSP)',
  2: 'Duckweed Pond System (DPS)',
  3: 'Facultative Aerated Lagoon (FAL)',
  4: 'Trickling Filter (TF)',
  5: 'Activated Sludge Process (ASP)',
  6: 'BIOFOR',
  7: 'Biofor-F (High Rate ASP)',
  8: 'Fluidized Aerated Bed (FAB)',
  9: 'SAFF (Submerged Aeration Fixed Film)',
  10: 'CASP (Cyclic Activated Sludge)',
  11: 'UASB',
};

export const DEFAULT_VARUNA_PARAMS: VarunaScenarioParams = {
  population: 2_644_440,
  per_capita_sewage: 135.0,

  pct_untapped_drains: 31.0,
  pct_tapped_non_gravity: 32.0,
  pct_tapped_gravity: 0.0,
  pct_stp_gravity_sewer: 22.0,
  pct_stp_non_gravity_sewer: 15.0,
  pct_non_stp_sewer: 0.0,
  pct_in_situ: 0.0,

  growth_untapped: 2.0,
  growth_tapped_non_gravity: 2.0,
  growth_tapped_gravity: 2.0,
  growth_stp_gravity: 2.0,
  growth_stp_non_gravity: 2.0,
  growth_non_stp_sewer: 2.0,
  growth_in_situ: 2.0,

  stp_capacity: 260.0,
  pump_capacity: 140.0,

  maint_tapped: 'low (0.40)',
  maint_stp: 'high (>0.90)',
  maint_pump: 'high (>0.90)',

  maint_tapped_gravity_monitoring: 45,
  maint_tapped_gravity_coordination: 45,
  maint_tapped_gravity_skill: 70,
  maint_tapped_nongravity_monitoring: 45,
  maint_tapped_nongravity_coordination: 45,
  maint_tapped_nongravity_skill: 70,
  maint_stp_monitoring: 95,
  maint_stp_coordination: 95,
  maint_stp_skill: 70,
  maint_pump_monitoring: 95,
  maint_pump_coordination: 95,
  maint_pump_skill: 70,
  maint_sewer_gravity_monitoring: 95,
  maint_sewer_gravity_coordination: 95,
  maint_sewer_gravity_skill: 95,
  maint_sewer_nongravity_monitoring: 95,
  maint_sewer_nongravity_coordination: 95,
  maint_sewer_nongravity_skill: 95,

  om_tapped: 4.0,
  om_stp: 28.47,
  om_pump: 1.4,
  om_sewer_network: 10.0,

  planning_choice: 1,
  num_stp_required: 0,
  unit_stp_size: 0,
  technology_choice: 5,
  proposal_approval_time: 1,
  approval_construction_time: 1,
  underconstruction_time: 1,
  budget_allocation_delay: 0.5,
  land_acquisition_delay: 0.5,
  operational_clearance_time: 0.5,

  drain_tap_gravity: 0,
  drain_tap_gravity_time: 0,
  drain_tap_nongravity: 0,
  drain_tap_nongravity_time: 0,
  additional_pumping: 0,
  pumping_station_time: 0,

  new_maint_tapped_ng: 'low (0.4)',
  maint_time_tapped_ng: 0,
  new_maint_tapped_g: 'low (0.4)',
  maint_time_tapped_g: 0,
  new_maint_pump: 'high (>0.9)',
  maint_time_pump: 0,
  new_maint_stp_dec: 'high (>0.9)',
  maint_time_stp: 0,

  change_maint_stp: false,
  change_maint_pump: false,
  change_maint_tapped_nongravity: false,
  change_maint_tapped_gravity: false,
  change_maint_sewer_nongravity: false,
  change_maint_sewer_gravity: false,

  new_maint_tapped_ng_monitoring: 45,
  new_maint_tapped_ng_coordination: 45,
  new_maint_tapped_ng_skill: 70,
  new_maint_tapped_g_monitoring: 45,
  new_maint_tapped_g_coordination: 45,
  new_maint_tapped_g_skill: 70,
  new_maint_pump_monitoring: 95,
  new_maint_pump_coordination: 95,
  new_maint_pump_skill: 70,
  new_maint_stp_monitoring: 95,
  new_maint_stp_coordination: 95,
  new_maint_stp_skill: 70,
  new_maint_sewer_gravity_monitoring: 95,
  new_maint_sewer_gravity_coordination: 95,
  new_maint_sewer_gravity_skill: 95,
  maint_time_sewer_gravity: 0,
  new_maint_sewer_nongravity_monitoring: 95,
  new_maint_sewer_nongravity_coordination: 95,
  new_maint_sewer_nongravity_skill: 95,
  maint_time_sewer_nongravity: 0,

  sewer_flow_untapped_gravity: 0,
  sewer_flow_tapped_nongravity_gravity: 0,
  sewer_flow_tapped_gravity_gravity: 0,
  sewer_flow_insitu_gravity: 0,
  sewer_flow_nonstp_gravity: 0,
  sewer_time_gravity: 0,

  sewer_flow_untapped_nongravity: 0,
  sewer_flow_tapped_nongravity_nongravity: 0,
  sewer_flow_tapped_gravity_nongravity: 0,
  sewer_flow_insitu_nongravity: 0,
  sewer_flow_nonstp_nongravity: 0,
  sewer_time_nongravity: 0,

  user_input_sewer_network_length: 0,

  stp_construction: 0,
  stp_om_cost: 0,
  tap_construction: 0,
  tap_om_cost: 0,
  pump_construction: 0,
  pump_om_cost: 0,
  sewer_network_construction_per_km: 0.4,
  sewer_network_om_per_km: 0,

  projection_years: 10,
  strategies: [],
};

export interface SnapshotResponse {
  total_sewage: number;
  capacity_deficit: number;
  treatment_deficit: number;
  untreated_untapped: number;
  overflow_tapped: number;
  flow_to_stp: number;
  eff_stp: number;
  actual_treated: number;
  pumping_shortfall: number;
  stp_overflow: number;
  non_stp_sewer_flow?: number;
  stp_installed_capacity: number;
  stp_unutilised_capacity: number;
}

export type SimulationRow = Record<string, number | string>;

export interface SimulateResponse {
  rows: SimulationRow[];
}

export interface ScenarioSummary {
  id: number;
  name: string;
  strategies: string[];
  treatment_pct: number;
  untreated: number;
  capacity_deficit: number;
  created_at: string;
}

export interface ScenarioOut extends ScenarioSummary {
  params: Record<string, unknown>;
  rows: SimulationRow[];
}

// chatbot disabled for now
// export interface ChatSource {
//   source: string;
//   snippet: string;
// }

// export interface ChatResponse {
//   answer: string;
//   sources: ChatSource[];
// }
