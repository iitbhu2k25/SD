// All backend communication for the water_v2 module lives here.
// Components, hooks, and stores must not call fetch directly.

const FAST_URL = process.env.NEXT_PUBLIC_FAST_URL || "/fastapi";

async function fetchWater<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${FAST_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `HTTP ${response.status} — ${path}`,
    );
  }

  return data as T;
}

// ─── Shared types ────────────────────────────────────────────────────────────

export interface WaterState {
  id: number;
  name: string;
}

export interface WaterDistrict {
  id: number;
  name: string;
  stateId: number;
}

export interface WaterSubDistrict {
  id: number;
  name: string;
  districtId: number;
}

export interface WaterRiver {
  River_Name: string;
  River_Code: number;
}

export interface LegendClass {
  class: number;
  color: string;
  min: number;
  max: number;
  label: string;
  pixel_count?: number;
  percentage?: number;
}

export interface LegendData {
  layer_name: string;
  product_type: string;
  region_min: number;
  region_max: number;
  region_mean: number;
  num_classes: number;
  classes: LegendClass[];
}

export interface ClassPixelCount {
  class: number;
  color: string;
  label: string;
  swci_range?: string;
  min?: number;
  max?: number;
  pixel_count: number;
  percentage?: number;
}

export interface WaterRasterLayer {
  legend_data: LegendData | null;
  original_name: string;
  layer_name: string;
  layer_type: string;
  workspace: string;
  style: string;
  year: number;
  time_scale: "seasonal" | "yearly";
  aggregation: string;
  season?: string;
  volume_MLD?: number;
  pixel_count?: number;
  invalid_count?: number;
  bbox?: [number, number, number, number] | null;
  class_pixel_counts?: ClassPixelCount[];
}

export interface StudyAreaVector {
  workspace: string;
  layer_name: string;
}

export interface WaterRasterResponse {
  status: string;
  study_area_vector: StudyAreaVector;
  clipped_rasters: WaterRasterLayer[];
  bbox?: [number, number, number, number] | null;
  metadata: {
    year: number;
    product_type: string;
    time_scale: string;
    season?: string;
    layers_processed: number;
  };
}

// ─── Admin reference data ────────────────────────────────────────────────────

export async function fetchWaterStates(): Promise<WaterState[]> {
  const data = await fetchWater<WaterState[] | { message?: WaterState[] }>(
    "/water/get_states?all_data=true",
  );
  const raw = Array.isArray(data) ? data : (data as any)?.message ?? [];
  return raw.map((s: any) => ({ id: s.id, name: s.name }));
}

export interface FetchDistrictsPayload {
  stateId: number;
}

export async function fetchWaterDistricts(
  stateId: number,
): Promise<WaterDistrict[]> {
  const data = await fetchWater<WaterDistrict[] | { message?: WaterDistrict[] }>(
    "/water/get_districts",
    {
      method: "POST",
      body: JSON.stringify({ state: stateId, all_data: true }),
    },
  );
  const raw = Array.isArray(data) ? data : (data as any)?.message ?? [];
  return raw.map((d: any) => ({ id: d.id, name: d.name, stateId }));
}

export async function fetchWaterSubDistricts(
  districtIds: number[],
): Promise<WaterSubDistrict[]> {
  const data = await fetchWater<
    WaterSubDistrict[] | { message?: WaterSubDistrict[] }
  >("/water/get_sub_districts", {
    method: "POST",
    body: JSON.stringify({ districts: districtIds, all_data: true }),
  });
  const raw = Array.isArray(data) ? data : (data as any)?.message ?? [];
  return raw.map((sd: any) => ({
    id: sd.id,
    name: sd.name,
    districtId: districtIds[0],
  }));
}

// ─── Admin raster ─────────────────────────────────────────────────────────────

export interface AdminRasterPayload {
  subdistrict_codes: number[];
  year: number[];
  season: string;
  product_type: string;
  time_scale: string;
}

export async function fetchAdminWaterRaster(
  payload: AdminRasterPayload,
): Promise<WaterRasterResponse> {
  const data = await fetchWater<{ message?: WaterRasterResponse } | WaterRasterResponse>(
    "/water/process_water_raster",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return ((data as any).message ?? data) as WaterRasterResponse;
}

// ─── User (Basin) reference data ─────────────────────────────────────────────

export async function fetchWaterRivers(): Promise<WaterRiver[]> {
  const data = await fetchWater<WaterRiver[]>("/water/get_river");
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    River_Name: r.River_Name,
    River_Code: r.River_Code,
  }));
}

export async function fetchWaterStretches(riverCode: number): Promise<number[]> {
  const data = await fetchWater<{ stretch_ids: number[] }>("/water/get_stretch", {
    method: "POST",
    body: JSON.stringify({ river_code: riverCode }),
  });
  return data.stretch_ids ?? [];
}

export async function fetchWaterDrains(stretchId: number): Promise<number[]> {
  const data = await fetchWater<{ drains: number[] }>("/water/get_drain", {
    method: "POST",
    body: JSON.stringify({ stretch_id: stretchId, all_data: true }),
  });
  return data.drains ?? [];
}

// ─── User (Basin) raster ──────────────────────────────────────────────────────

export interface UserRasterPayload {
  drain_no: number;
  year: number[];
  time_scale: string;
  season: string | null;
  product_type: string;
}

export async function fetchUserWaterRaster(
  payload: UserRasterPayload,
): Promise<WaterRasterResponse> {
  const data = await fetchWater<WaterRasterResponse>("/water/process_drain_raster", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
}
