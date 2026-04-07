"use client";

export type RsqView = "admin" | "drain";

export interface AdminState {
  id: string;
  name: string;
}

export interface AdminDistrict {
  id: string;
  name: string;
  stateId: string;
}

export interface AdminBlock {
  id: string;
  name: string;
  districtCode: string;
}

export interface AdminVillage {
  id: string;
  name: string;
  blockCode: string;
}

export interface DrainRiver {
  id: string | number;
  name: string;
  code: number;
}

export interface DrainStretch {
  id: string | number;
  name: string;
  stretchId: number;
  riverCode: number;
  riverName: string;
}

export interface DrainItem {
  id: string | number;
  drainNo: number;
  riverCode: number;
  stretchId: number;
}

export interface DrainCatchment {
  id: string | number;
  name: string;
  objectId: number;
  gridCode: number;
  drainNo: number;
}

export interface DrainVillage {
  code: number;
  id: string | number;
  name: string;
  village_code: string | number;
  catchment_gridcode?: number;
}

export interface GroundWaterFeature {
  type: "Feature";
  id?: string;
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

export interface GroundWaterGeoJSON {
  type: "FeatureCollection";
  features: GroundWaterFeature[];
}

export interface AdminSelectionState {
  states: AdminState[];
  districts: AdminDistrict[];
  blocks: AdminBlock[];
  villages: AdminVillage[];
  selectedState: string | null;
  selectedDistricts: string[];
  selectedBlocks: string[];
  selectedVillages: string[];
  isLoading: boolean;
  error: string | null;
}

export interface DrainSelectionState {
  rivers: DrainRiver[];
  stretches: DrainStretch[];
  drains: DrainItem[];
  catchments: DrainCatchment[];
  villages: DrainVillage[];
  selectedRiver: number | null;
  selectedStretch: number | null;
  selectedDrain: number | null;
  selectedCatchments: number[];
  selectedVillages: number[];
  selectionsLocked: boolean;
  areaConfirmed: boolean;
  isLoading: boolean;
  error: string | null;
}
