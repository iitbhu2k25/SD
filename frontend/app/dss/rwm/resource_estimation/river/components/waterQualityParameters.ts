"use client";

export interface WaterQualityParameterDefinition {
  key: string;
  backendKey: string;
  label: string;
  unit?: string;
  range?: string;
  min?: number;
  max?: number;
}

// Converts a list of key-value pairs into an object for quick lookup.
const toRecord = <K extends string, V>(
  entries: ReadonlyArray<readonly [K, V]>,
): Record<K, V> => Object.fromEntries(entries) as Record<K, V>;

export const WATER_QUALITY_PARAMETERS = [
  {
    key: "ph",
    backendKey: "pH",
    label: "pH",
    unit: "",
    range: "6.5-8.5",
    min: 0,
    max: 14,
  },
  {
    key: "tds",
    backendKey: "TDS_mg_L_",
    label: "TDS",
    unit: "mg/L",
    range: "<=500",
    min: 0,
    max: 2000,
  },
  {
    key: "ec",
    backendKey: "EC__S_cm_",
    label: "EC",
    unit: "uS/cm",
    range: "",
    min: 0,
    max: 5000,
  },
  {
    key: "temperature",
    backendKey: "Temperatur",
    label: "Temperature",
    unit: "°C",
    range: "",
    min: 0,
    max: 50,
  },
  {
    key: "turbidity",
    backendKey: "Turbidity_",
    label: "Turbidity",
    unit: "NTU",
    range: "<=1",
    min: 0,
    max: 1000,
  },
  {
    key: "dissolvedOxygen",
    backendKey: "DO_mg_L_",
    label: "Dissolved Oxygen",
    unit: "mg/L",
    range: ">=5",
    min: 0,
    max: 15,
  },
  {
    key: "orp",
    backendKey: "ORP",
    label: "ORP",
    unit: "mV",
    range: "",
    min: -500,
    max: 500,
  },
  {
    key: "tss",
    backendKey: "TSS_mg_L_",
    label: "TSS",
    unit: "mg/L",
    range: "",
    min: 0,
    max: 500,
  },
  {
    key: "cod",
    backendKey: "COD_mg_L_",
    label: "COD",
    unit: "mg/L",
    range: "<=3",
    min: 0,
    max: 100,
  },
  {
    key: "bod",
    backendKey: "BOD_mg_L_",
    label: "BOD",
    unit: "mg/L",
    range: "<=2",
    min: 0,
    max: 50,
  },
  {
    key: "ts",
    backendKey: "TS_mg_L_",
    label: "Total Solids",
    unit: "mg/L",
    range: "",
    min: 0,
    max: 2000,
  },
  {
    key: "chloride",
    backendKey: "Chloride_m",
    label: "Chloride",
    unit: "mg/L",
    range: "<=250",
    min: 0,
    max: 1000,
  },
  {
    key: "nitrate",
    backendKey: "Nitrate_mg",
    label: "Nitrate",
    unit: "mg/L",
    range: "<=45",
    min: 0,
    max: 100,
  },
  {
    key: "hardness",
    backendKey: "Hardness_m",
    label: "Hardness",
    unit: "mg/L",
    range: "<=200",
    min: 0,
    max: 1000,
  },
  {
    key: "faecalColiform",
    backendKey: "Faecal_Col",
    label: "Faecal Coliform",
    unit: "MPN/100ml",
    range: "<=0",
  },
  {
    key: "totalColiform",
    backendKey: "Total_Coli",
    label: "Total Coliform",
    unit: "MPN/100ml",
    range: "<=50",
  },
  {
    key: "wqi",
    backendKey: "WQI",
    label: "Water Quality Index",
    unit: "",
    range: "0-100",
    min: 0,
    max: 100,
  },
] as const satisfies readonly WaterQualityParameterDefinition[];

export const WQ_PARAMETERS = WATER_QUALITY_PARAMETERS;

export type WaterQualityParameter = (typeof WATER_QUALITY_PARAMETERS)[number];
export type WaterQualityFrontendKey = WaterQualityParameter["key"];
export type WaterQualityBackendKey = WaterQualityParameter["backendKey"];

export const WATER_QUALITY_ATTRIBUTES = WATER_QUALITY_PARAMETERS.map(
  (param) => param.key,
);

export const FRONTEND_TO_BACKEND_ATTRIBUTE = toRecord(
  WATER_QUALITY_PARAMETERS.map((param) => [param.key, param.backendKey] as const),
);

export const BACKEND_TO_FRONTEND_ATTRIBUTE = toRecord(
  WATER_QUALITY_PARAMETERS.map((param) => [param.backendKey, param.key] as const),
);

export const BACKEND_PARAMETER_MAPPING = FRONTEND_TO_BACKEND_ATTRIBUTE;

export const WATER_QUALITY_PARAMETER_BY_FRONTEND_KEY = toRecord(
  WATER_QUALITY_PARAMETERS.map((param) => [param.key, param] as const),
);

export const WATER_QUALITY_PARAMETER_BY_BACKEND_KEY = toRecord(
  WATER_QUALITY_PARAMETERS.map((param) => [param.backendKey, param] as const),
);

export const WATER_QUALITY_ATTRIBUTE_LABELS = WATER_QUALITY_PARAMETERS.reduce<
  Record<string, string>
>((acc, param) => {
  acc[param.key] = `${param.label}${param.unit ? ` (${param.unit})` : ""}`;
  return acc;
}, {});

// Returns the full parameter details using either the frontend key or backend key.
export const getParameterDefinition = (key: string) =>
  WATER_QUALITY_PARAMETER_BY_FRONTEND_KEY[key as WaterQualityFrontendKey] ||
  WATER_QUALITY_PARAMETER_BY_BACKEND_KEY[key as WaterQualityBackendKey] ||
  null;

// Returns the backend field name for a given frontend parameter key.
export const getBackendAttributeName = (frontendKey: string) =>
  FRONTEND_TO_BACKEND_ATTRIBUTE[frontendKey as WaterQualityFrontendKey] || null;

// Returns the frontend parameter key for a given backend field name.
export const getFrontendAttributeName = (backendKey: string) =>
  BACKEND_TO_FRONTEND_ATTRIBUTE[backendKey as WaterQualityBackendKey] || null;

// Returns the matching frontend or backend name for the given parameter key.
export const getPairedAttributeName = (key: string) => {
  const parameter = getParameterDefinition(key);
  if (!parameter) return null;
  return key === parameter.key ? parameter.backendKey : parameter.key;
};

// Returns the short label of a parameter.
export const getParameterLabel = (key: string) =>
  getParameterDefinition(key)?.label || key;

// Returns the unit text for a parameter.
export const getParameterUnit = (key: string) =>
  getParameterDefinition(key)?.unit || "";

// Returns the label with unit included for display in the UI.
export const getParameterDisplayLabel = (key: string) => {
  const parameter = getParameterDefinition(key);
  if (!parameter) return key;
  return `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ""}`;
};
