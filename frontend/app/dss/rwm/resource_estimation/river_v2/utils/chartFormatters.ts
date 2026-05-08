/**
 * Pure functions extracted from the legacy charts to handle data translation.
 */

export interface ProcessedWaterQualityData {
  id: string;
  sampling: string;
  originalSampling: string;
  location: string;
  [key: string]: string | number | null; // dynamic parameters
}

export interface ComparisonTableRow {
  location: string;
  normalizedSampling: string;
  locationType: string;
  premonsoon: ProcessedWaterQualityData | null;
  monsoon: ProcessedWaterQualityData | null;
  postmonsoon: ProcessedWaterQualityData | null;
}

export const WQ_PARAMETERS = [
  { key: "ph", label: "pH", unit: "", range: "6.5-8.5" },
  { key: "tds", label: "TDS", unit: "mg/L", range: "≤500" },
  { key: "ec", label: "EC", unit: "μS/cm", range: "" },
  { key: "temperature", label: "Temperature", unit: "°C", range: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU", range: "≤1" },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", unit: "mg/L", range: "≥5" },
  { key: "orp", label: "ORP", unit: "mV", range: "" },
  { key: "tss", label: "TSS", unit: "mg/L", range: "" },
  { key: "cod", label: "COD", unit: "mg/L", range: "≤3" },
  { key: "bod", label: "BOD", unit: "mg/L", range: "≤2" },
  { key: "ts", label: "Total Solids", unit: "mg/L", range: "" },
  { key: "chloride", label: "Chloride", unit: "mg/L", range: "≤250" },
  { key: "nitrate", label: "Nitrate", unit: "mg/L", range: "≤45" },
  { key: "hardness", label: "Hardness", unit: "mg/L", range: "≤200" },
  { key: "faecalColiform", label: "Faecal Coliform", unit: "MPN/100ml", range: "≤0" },
  { key: "totalColiform", label: "Total Coliform", unit: "MPN/100ml", range: "≤50" },
  { key: "wqi", label: "Water Quality Index" },
];

export const CHART_TO_BACKEND_ATTRIBUTE: Record<string, string> = {
  ph: "pH",
  tds: "TDS_mg_L_",
  ec: "EC__S_cm_",
  temperature: "Temperatur",
  turbidity: "Turbidity_",
  dissolvedOxygen: "DO_mg_L_",
  orp: "ORP",
  tss: "TSS_mg_L_",
  cod: "COD_mg_L_",
  bod: "BOD_mg_L_",
  ts: "TS_mg_L_",
  chloride: "Chloride_m",
  nitrate: "Nitrate_mg",
  hardness: "Hardness_m",
  faecalColiform: "Faecal_Col",
  totalColiform: "Total_Coli",
  wqi: "WQI",
};

export interface WaterQualityParameterCatalogItem {
  key: string;
  label: string;
  unit?: string;
  range?: string;
  threshold?: number;
  backendField: string;
  reportable: boolean;
}

export const WATER_QUALITY_PARAMETER_CATALOG: Record<string, WaterQualityParameterCatalogItem> = {
  ph: {
    key: "ph",
    label: "pH",
    unit: "",
    range: "6.5-8.5",
    threshold: 8.5,
    backendField: "pH",
    reportable: true,
  },
  tds: {
    key: "tds",
    label: "TDS",
    unit: "mg/L",
    range: "≤500",
    threshold: 500,
    backendField: "TDS_mg_L_",
    reportable: true,
  },
  ec: {
    key: "ec",
    label: "EC",
    unit: "μS/cm",
    range: "",
    backendField: "EC__S_cm_",
    reportable: true,
  },
  temperature: {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    range: "",
    threshold: 25,
    backendField: "Temperatur",
    reportable: true,
  },
  turbidity: {
    key: "turbidity",
    label: "Turbidity",
    unit: "NTU",
    range: "≤1",
    threshold: 1,
    backendField: "Turbidity_",
    reportable: true,
  },
  dissolvedOxygen: {
    key: "dissolvedOxygen",
    label: "Dissolved Oxygen",
    unit: "mg/L",
    range: "≥5",
    threshold: 5,
    backendField: "DO_mg_L_",
    reportable: true,
  },
  orp: {
    key: "orp",
    label: "ORP",
    unit: "mV",
    range: "",
    backendField: "ORP",
    reportable: true,
  },
  tss: {
    key: "tss",
    label: "TSS",
    unit: "mg/L",
    range: "",
    backendField: "TSS_mg_L_",
    reportable: true,
  },
  cod: {
    key: "cod",
    label: "COD",
    unit: "mg/L",
    range: "≤3",
    backendField: "COD_mg_L_",
    reportable: true,
  },
  bod: {
    key: "bod",
    label: "BOD",
    unit: "mg/L",
    range: "≤2",
    backendField: "BOD_mg_L_",
    reportable: true,
  },
  ts: {
    key: "ts",
    label: "Total Solids",
    unit: "mg/L",
    range: "",
    backendField: "TS_mg_L_",
    reportable: true,
  },
  chloride: {
    key: "chloride",
    label: "Chloride",
    unit: "mg/L",
    range: "≤250",
    threshold: 250,
    backendField: "Chloride_m",
    reportable: true,
  },
  nitrate: {
    key: "nitrate",
    label: "Nitrate",
    unit: "mg/L",
    range: "≤45",
    threshold: 50,
    backendField: "Nitrate_mg",
    reportable: true,
  },
  hardness: {
    key: "hardness",
    label: "Hardness",
    unit: "mg/L",
    range: "≤200",
    threshold: 300,
    backendField: "Hardness_m",
    reportable: true,
  },
  faecalColiform: {
    key: "faecalColiform",
    label: "Faecal Coliform",
    unit: "MPN/100ml",
    range: "≤0",
    backendField: "Faecal_Col",
    reportable: true,
  },
  totalColiform: {
    key: "totalColiform",
    label: "Total Coliform",
    unit: "MPN/100ml",
    range: "≤50",
    backendField: "Total_Coli",
    reportable: true,
  },
  wqi: {
    key: "wqi",
    label: "Water Quality Index",
    backendField: "WQI",
    reportable: false,
  },
};

export const attributeLabels: Record<string, string> = WQ_PARAMETERS.reduce(
  (acc, param) => {
    acc[param.key] = `${param.label}${param.unit ? ` (${param.unit})` : ""}`;
    return acc;
  },
  {} as Record<string, string>
);

export const qualityThresholds: Record<string, number> = {
  ph: 8.5,
  tds: 500,
  temperature: 25,
  turbidity: 1,
  dissolvedOxygen: 5,
  chloride: 250,
  nitrate: 50,
  hardness: 300,
};

export function parseStringValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    return parseFloat(cleaned) || 0;
  }
  return parseFloat(value.toString()) || 0;
}

export function normalizeSamplingName(originalSampling: string): string {
  return originalSampling
    .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
    .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
    .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
    .trim();
}

export function transformGeoJsonToChartData(geoJson: any): ProcessedWaterQualityData[] {
  if (!geoJson || !geoJson.features) return [];

  return geoJson.features.map((feature: any) => {
    const props = feature.properties || {};
    const originalSampling = props.Sampling || "";
    const normalizedSampling =
      props.NormalizedSampling || normalizeSamplingName(originalSampling) || "Unknown";

    return {
      id: feature.id || props.S_No_?.toString() || Math.random().toString(),
      sampling: normalizedSampling,
      originalSampling,
      location: props.Location || "Unknown",
      ph: props.pH,
      tds: props.TDS_mg_L_,
      ec: props.EC__S_cm_,
      temperature: props.Temperatur,
      turbidity: props.Turbidity_,
      dissolvedOxygen: props.DO_mg_L_,
      orp: props.ORP,
      tss: props.TSS_mg_L_,
      cod: props.COD_mg_L_,
      bod: props.BOD_mg_L_,
      ts: props.TS_mg_L_,
      chloride: props.Chloride_m,
      nitrate: props.Nitrate_mg,
      hardness: props.Hardness_m,
      faecalColiform: props.Faecal_Col,
      totalColiform: props.Total_Coli,
      wqi: props.WQI,
      wqiClass: props.WQI_Class,
      latitude: props.LATITUDE,
      longitude: props.LONGITUDE,
    };
  });
}

export function buildSeasonalComparisonRows({
  premonsoon,
  monsoon,
  postmonsoon,
}: {
  premonsoon: ProcessedWaterQualityData[];
  monsoon: ProcessedWaterQualityData[];
  postmonsoon: ProcessedWaterQualityData[];
}): ComparisonTableRow[] {
  const comparisonMap = new Map<string, ComparisonTableRow>();
  const seasons: Array<"premonsoon" | "monsoon" | "postmonsoon"> = [
    "premonsoon",
    "monsoon",
    "postmonsoon",
  ];
  const seasonData = { premonsoon, monsoon, postmonsoon };

  seasons.forEach((season) => {
    seasonData[season].forEach((point) => {
      const sampling = point.sampling || "Unknown";
      const locationType = point.location || "Unknown";
      const uniqueKey = `${sampling}|${locationType}`;

      if (!comparisonMap.has(uniqueKey)) {
        comparisonMap.set(uniqueKey, {
          location: `${sampling} - ${locationType}`,
          normalizedSampling: sampling,
          locationType,
          premonsoon: null,
          monsoon: null,
          postmonsoon: null,
        });
      }

      const row = comparisonMap.get(uniqueKey);
      if (row) row[season] = point;
    });
  });

  const locationOrder: Record<string, number> = {
    Drain: 1,
    Upstream: 2,
    Downstream: 3,
  };

  return Array.from(comparisonMap.values()).sort((a, b) => {
    const samplingCompare = a.normalizedSampling.localeCompare(b.normalizedSampling);
    if (samplingCompare !== 0) return samplingCompare;
    return (locationOrder[a.locationType] || 999) - (locationOrder[b.locationType] || 999);
  });
}

export function getWQIInfo(wqi: string | number | null) {
  const value = Number(wqi);
  if (!wqi || isNaN(value)) return { label: "N/A", color: "text-gray-400" };
  if (value <= 50) return { label: "Excellent", color: "text-blue-600" };
  if (value <= 100) return { label: "Good", color: "text-green-600" };
  if (value <= 200) return { label: "Poor", color: "text-orange-600" };
  if (value <= 300) return { label: "Very Poor", color: "text-red-600" };
  return { label: "Unsuitable for use", color: "text-red-800" };
}
