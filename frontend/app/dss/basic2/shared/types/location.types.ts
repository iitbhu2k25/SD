export type LocationMode = 'admin' | 'drain' | 'india_catchment';

// ── Admin mode types ──────────────────────────────────────────────────────────

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
}

export interface VillageOption {
  village_code: string;
  village_name: string;
  subdistrict_code: string;
  population?: number;
  area?: number;
}

export interface AdminLocationSelection {
  state: StateOption | null;
  districts: DistrictOption[];
  subDistricts: SubDistrictOption[];
  villages: VillageOption[];
}

// ── Drain mode types ──────────────────────────────────────────────────────────

export interface DrainRiver {
  id: string;
  name: string;
}

export interface DrainStretch {
  id: string;
  name: string;
  riverId: string;
}

export interface DrainItem {
  id: string;
  name: string;
  stretchId: string;
  stretchName?: string;
}

export interface DrainVillage {
  shapeID: string;
  shapeName: string;
  drainNo: number;
  subDistrictCode?: string;
  subDistrictName?: string;
  districtName?: string;
  stateName?: string;
  population?: number;
  selected?: boolean;
}

export interface DrainLocationSelection {
  river: DrainRiver | null;
  stretch: DrainStretch | null;
  drains: DrainItem[];
  villages: DrainVillage[];
  selectedVillageIds: string[];
  totalPopulation: number;
}

// ── India Catchment types ─────────────────────────────────────────────────────

export interface IndiaVillage {
  vlcode: string;
  village: string;
  population?: number;
  subdis_cod?: string;
  geometry?: any;
}

export interface IndiaCatchmentSelection {
  point: { lat: number; lng: number };
  watershedInfo: { features: number; geometryType?: string; properties?: any } | null;
  villages: IndiaVillage[];
  selectedVillageIds: string[];
  totalPopulation: number;
}

// ── Confirmed location (union) ────────────────────────────────────────────────

export interface ConfirmedLocation {
  mode: LocationMode;
  admin?: AdminLocationSelection;
  drain?: DrainLocationSelection;
  indiaCatchment?: IndiaCatchmentSelection;
  label: string;
}

// ── Map payload (admin map sync) ─────────────────────────────────────────────

export interface MapLocationPayload {
  state: string;
  districts: string[];
  subDistricts: string[];
  villages: string[];
  allVillages?: any[];
  totalPopulation?: number;
}
