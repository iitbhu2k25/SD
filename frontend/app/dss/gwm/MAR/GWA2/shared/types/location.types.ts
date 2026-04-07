export type GwaMode = "admin" | "drain";

export interface StateOption {
  state_code: string;
  state_name: string;
}

export interface DistrictOption {
  district_code: string;
  district_name: string;
  state_code: string;
}

export interface SubDistrictOption {
  subdistrict_code: string;
  subdistrict_name: string;
  district_code: string;
  population?: number;
}

export interface AdminSelection {
  state: StateOption | null;
  districts: DistrictOption[];
  subDistricts: SubDistrictOption[];
}

export interface DrainRiver {
  id: string;
  name: string;
  code: number;
}

export interface DrainStretch {
  id: string;
  name: string;
  stretchId: number;
  riverCode: number;
}

export interface DrainItem {
  id: string;
  name: string;
  drainNo: number;
  stretchId: number;
}

export interface DrainVillage {
  shapeID: string;
  shapeName: string;
  village_code?: string;
  catchment_gridcode?: number;
  population?: number;
}

export interface DrainSelection {
  river: DrainRiver | null;
  stretch: DrainStretch | null;
  drains: DrainItem[];
  villages: DrainVillage[];
  selectedVillageIds: string[];
}

export interface ConfirmedLocation {
  mode: GwaMode;
  label: string;
  admin?: AdminSelection;
  drain?: DrainSelection;
}
