import type { ModuleMeta } from "../types/common.types";
import type { IndustrialSubtype } from "../types/module.types";

export const API_BASE_URL = `${process.env.NEXT_PUBLIC_FAST_URL ?? ""}`;
export const GEOSERVER_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL ?? ""}`;
export const GEOSERVER_WORKSPACE = `${process.env.NEXT_PUBLIC_FAST_WORKSPACE ?? "myworkspace"}`;

export const ADMIN_API = {
  STATE: `${API_BASE_URL}/basic/state/`,
  DISTRICT: `${API_BASE_URL}/basic/district/`,
  SUBDISTRICT: `${API_BASE_URL}/basic/subdistrict/`,
} as const;

export const DRAIN_API = {
  VILLAGES: `${API_BASE_URL}/gwa/villagescatchment`,
} as const;

export const GWA_API = {
  WELLS: `${API_BASE_URL}/gwa/wells`,
  VALIDATE_CSV: `${API_BASE_URL}/gwa/validate-csv`,
  UPLOAD_CSV: `${API_BASE_URL}/gwa/upload-csv`,
  TREND: `${API_BASE_URL}/gwa/trends`,
  RECHARGE: `${API_BASE_URL}/gwa/recharge2`,
  CROPS: `${API_BASE_URL}/gwa/crops`,
  DOMESTIC: `${API_BASE_URL}/gwa/forecast-population`,
  AGRICULTURAL: `${API_BASE_URL}/gwa/agricultural`,
  INDUSTRIAL: `${API_BASE_URL}/gwa/industrial`,
  GSR: `${API_BASE_URL}/gwa/gsr`,
  STRESS: `${API_BASE_URL}/gwa/stress`,
  FORECAST: `${API_BASE_URL}/gwa/forecast`,
} as const;

export const INITIAL_INDUSTRIAL_DATA: IndustrialSubtype[] = [
  { industry: "Thermal Power Plants", subtype: "Small (<1000 MW)", unit: "m3/tonne of product", consumptionValue: 3.1, production: 0 },
  { industry: "Thermal Power Plants", subtype: "Medium (1000-2500 MW)", unit: "m3/tonne of product", consumptionValue: 4.2, production: 0 },
  { industry: "Thermal Power Plants", subtype: "Large (>2500 MW)", unit: "m3/tonne of product", consumptionValue: 3.1, production: 0 },
  { industry: "Pulp & Paper", subtype: "Integrated Mills", unit: "m3/tonne of product", consumptionValue: 31.8, production: 0 },
  { industry: "Pulp & Paper", subtype: "RCF-based Mills", unit: "m3/tonne of product", consumptionValue: 11.5, production: 0 },
  { industry: "Textiles", subtype: "Integrated (Cotton)", unit: "m3/tonne of product", consumptionValue: 224, production: 0 },
  { industry: "Textiles", subtype: "Fabric Processing", unit: "m3/tonne of product", consumptionValue: 75, production: 0 },
  { industry: "Iron & Steel", subtype: "Integrated (Woollen)", unit: "m3/tonne of product", consumptionValue: 237, production: 0 },
  { industry: "Iron & Steel", subtype: "General", unit: "m3/tonne of product", consumptionValue: 6.5, production: 0 },
];

export const GWA_MODULES: ModuleMeta[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Confirmed area summary and readiness for the groundwater workflow.",
  },
  {
    key: "wells",
    label: "Wells",
    description: "Select existing wells or upload a wells CSV for the confirmed area.",
  },
  {
    key: "trend",
    label: "Trend",
    description: "Groundwater trend analysis for the confirmed area and wells dataset.",
  },
  {
    key: "recharge",
    label: "Recharge",
    description: "Village-wise recharge computation for the confirmed area.",
  },
  {
    key: "demand",
    label: "Demand",
    description: "Domestic, agricultural, and industrial demand computation.",
  },
  {
    key: "gsr",
    label: "GSR",
    description: "Groundwater sustainability ratio and MAR need assessment.",
  },
  {
    key: "forecast",
    label: "Forecast",
    description: "Forecast future groundwater values from generated trend timeseries.",
  },
];
