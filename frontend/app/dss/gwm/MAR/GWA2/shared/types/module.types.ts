import type { ConfirmedLocation } from "./location.types";

export type PrimitiveCell = string | number | boolean | null | undefined;
export type TableRow = Record<string, PrimitiveCell>;

export type WellSelectionMode = "existing_and_new" | "upload_csv" | null;

export interface IndustrialSubtype {
  industry: string;
  subtype: string;
  unit: string;
  consumptionValue: number;
  production: number;
}

export interface WellsModuleState {
  selectionMode: WellSelectionMode;
  data: TableRow[];
  loading: boolean;
  error: string | null;
  isSaved: boolean;
  isUploading: boolean;
  uploadMessage: string | null;
  uploadSuccess: boolean;
  csvFilename: string | null;
  customColumns: string[];
  newColumnName: string;
}

export interface TrendModuleState {
  yearStart: string;
  yearEnd: string;
  data: any | null;
  loading: boolean;
  error: string | null;
}

export interface RechargeModuleState {
  data: TableRow[];
  loading: boolean;
  error: string | null;
}

export interface DemandModuleState {
  domesticChecked: boolean;
  agriculturalChecked: boolean;
  industrialChecked: boolean;
  perCapitaConsumption: number;
  kharifChecked: boolean;
  rabiChecked: boolean;
  zaidChecked: boolean;
  availableCrops: Record<string, string[]>;
  selectedCrops: Record<string, string[]>;
  cropsLoading: Record<string, boolean>;
  cropsError: Record<string, string | null>;
  groundwaterFactor: number;
  industrialData: IndustrialSubtype[];
  industrialGWShare: number;
  domesticData: TableRow[];
  agriculturalData: TableRow[];
  industrialResultData: TableRow[];
  combinedData: TableRow[];
  chartData: any | null;
  chartsError: string | null;
  domesticLoading: boolean;
  agriculturalLoading: boolean;
  industrialLoading: boolean;
  domesticError: string | null;
  agriculturalError: string | null;
  industrialError: string | null;
}

export interface GsrModuleState {
  data: TableRow[];
  loading: boolean;
  error: string | null;
  stressYears: string;
  stressData: TableRow[];
  stressLoading: boolean;
  stressError: string | null;
}

export interface ForecastModuleState {
  method: string;
  forecastType: string;
  rangeStart: string;
  rangeEnd: string;
  data: any | null;
  loading: boolean;
  error: string | null;
}

export interface GwaWorkflowState {
  location: ConfirmedLocation | null;
  wells: WellsModuleState;
  trend: TrendModuleState;
  recharge: RechargeModuleState;
  demand: DemandModuleState;
  gsr: GsrModuleState;
  forecast: ForecastModuleState;
}
