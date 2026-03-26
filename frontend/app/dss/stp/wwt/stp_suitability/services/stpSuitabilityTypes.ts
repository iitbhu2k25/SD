import type {
  Catchment,
  Category,
  ClipRasters,
  District,
  Drain,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  Stp_area,
  SubDistrict,
  Towns,
  stp_sutability_Output,
} from "@/interface/raster_context";
import type { DataRow } from "@/interface/table";

export type {
  Catchment,
  Category,
  ClipRasters,
  District,
  Drain,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  Stp_area,
  SubDistrict,
  Towns,
  stp_sutability_Output,
  DataRow,
};

export interface SuitabilityCategoryBundle {
  conditionCategories: Category[];
  constraintCategories: Category[];
  areaOptions: Stp_area[];
}

export interface AdminSuitabilityReferenceData {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  towns: Towns[];
}

export interface UserSuitabilityReferenceData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
}

export interface AdminSuitabilityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
}

export interface UserSuitabilityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  place: "Drain";
  drain_clip: number[];
}

export interface SuitabilityAreaPayload {
  TREATMENT_TECHNOLOGY: number;
  MLD_CAPACITY: number;
  CUSTOM_LAND_PER_MLD: number;
  layer_name?: string;
}

export interface AdminSuitabilityReportPayload {
  table: DataRow[];
  raster: ClipRasters[];
  place: "Admin";
  clip: number[];
  location: {
    state: string;
    districts: string[];
    subDistricts: string[];
    towns: string[];
    population: number;
  };
  weight_data: SelectRasterLayer[];
  non_weight_data: SelectRasterLayer[];
}

export interface UserSuitabilityReportPayload {
  table: DataRow[];
  raster: ClipRasters[];
  place: "Drain";
  clip: number[];
  location: {
    River: string;
    Stretch: number[];
    Drain: number[];
    Catchment: string[];
  };
  weight_data: SelectRasterLayer[];
  non_weight_data: SelectRasterLayer[];
}

export interface ReportTaskResponse {
  task_id: string;
}
