import {
  Category,
  Catchment,
  ClipRasters,
  District,
  Drain,
  Layer_name,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  SubDistrict,
  villages,
  stp_priority_Output,
} from "@/interface/raster_context";
import { CsvRow, Gwpl_Table } from "@/interface/table";
import { api } from "@/services/api";

interface RasterVisualResponse {
  raster_layer: ClipRasters[];
  vector_layer?: string | null;
}

type DisplayRasterApiMessage = ClipRasters[] | RasterVisualResponse;

export interface DisplayRasterResult {
  rasterLayer: ClipRasters[];
  vectorLayer: string | null;
}

interface RawStretch {
  Stretch_ID: number;
  river_code?: number;
  river_Code?: number;
  name?: string;
}

interface RawDrain {
  Drain_No: number;
  stretch_id: number;
  name?: string;
  Name?: string;
  latitude?: number;
  longitude?: number;
}

interface GwplFindScoreResponseObject {
  table: Gwpl_Table[];
  well_points: CsvRow[];
}

type GwplFindScoreResponse = Gwpl_Table[] | GwplFindScoreResponseObject;

export interface PumpingFindScoreResult {
  table: Gwpl_Table[];
  wellPoints: CsvRow[];
}

export interface AdminPumpingAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  village_layer: string | null;
}

export interface UserPumpingAnalysisPayload {
  data: SelectRasterLayer[];
  village_layer: string | null;
}

export interface AdminPumpingFindScorePayload {
  location: CsvRow[];
  raster_name: string;
  village_layer: string | null;
}

export interface UserPumpingFindScorePayload {
  location: CsvRow[];
  raster_name: string;
}

function normalizeDisplayRasterPayload(message: DisplayRasterApiMessage | null | undefined): DisplayRasterResult {
  if (Array.isArray(message)) {
    return { rasterLayer: message, vectorLayer: null };
  }

  if (message && Array.isArray(message.raster_layer)) {
    return {
      rasterLayer: message.raster_layer,
      vectorLayer: typeof message.vector_layer === "string" ? message.vector_layer : null,
    };
  }

  return { rasterLayer: [], vectorLayer: null };
}

function normalizeGwplFindScorePayload(
  message: GwplFindScoreResponse | null | undefined,
  fallbackPoints: CsvRow[],
): PumpingFindScoreResult {
  if (Array.isArray(message)) {
    return {
      table: message,
      wellPoints: fallbackPoints,
    };
  }

  if (message && Array.isArray(message.table)) {
    return {
      table: message.table,
      wellPoints: Array.isArray(message.well_points) ? message.well_points : fallbackPoints,
    };
  }

  return {
    table: [],
    wellPoints: fallbackPoints,
  };
}

function uniqueById<T>(items: T[], getId: (item: T) => number | string): T[] {
  return Array.from(new Map(items.map((item) => [getId(item), item])).values());
}

export async function fetchPumpingCategories(
  categoryType: "condition" | "constraint",
): Promise<Category[]> {
  const response = await api.get<Category[]>(
    `/gwz_operation/get_gwpl_category?category=${categoryType}&all_data=true`,
  );

  return (response.message ?? []).filter(
    (item) =>
      !!item &&
      typeof item.file_name === "string" &&
      item.file_name.length > 0 &&
      typeof item.weight === "number" &&
      item.weight >= 0,
  );
}

export async function fetchStates(): Promise<State[]> {
  const response = await api.get<State[]>("/location/get_states?all_data=true");
  return response.message ?? [];
}

export async function fetchDistricts(stateId: number): Promise<District[]> {
  const response = await api.post<District[]>("/location/get_districts", {
    body: {
      state: stateId,
      all_data: true,
    },
  });

  return response.message ?? [];
}

export async function fetchSubDistricts(districtIds: number[]): Promise<SubDistrict[]> {
  if (districtIds.length === 0) {
    return [];
  }

  const response = await api.post<SubDistrict[]>("/location/get_sub_districts/", {
    body: {
      districts: districtIds,
      all_data: true,
    },
  });

  return response.message ?? [];
}

export async function fetchVillages(subDistrictIds: number[]): Promise<villages[]> {
  if (subDistrictIds.length === 0) {
    return [];
  }

  const response = await api.post<villages[]>("/location/get_villages/", {
    body: {
      subdis_code: subDistrictIds,
      all_data: true,
    },
  });

  return response.message ?? [];
}

export async function fetchAdminDisplayRaster(clip: number[]): Promise<DisplayRasterResult> {
  const response = await api.post<DisplayRasterApiMessage>(
    "/gwz_operation/gwpl_visual_display",
    {
      body: {
        clip,
        place: "District",
      },
    },
  );

  return normalizeDisplayRasterPayload(response.message);
}

export async function runAdminPumpingAnalysis(
  payload: AdminPumpingAnalysisPayload,
): Promise<stp_priority_Output> {
  const response = await api.post<stp_priority_Output>("/gwz_operation/gwpl_operation", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("Pumping analysis returned no payload");
  }

  return response.message;
}

export async function runAdminPumpingFindScore(
  payload: AdminPumpingFindScorePayload,
): Promise<PumpingFindScoreResult> {
  const response = await api.post<GwplFindScoreResponse>("/gwz_operation/gwpl_find_score", {
    body: payload,
  });

  return normalizeGwplFindScorePayload(response.message, payload.location);
}

export async function fetchRivers(): Promise<River[]> {
  const response = await api.get<River[]>("/location/get_river");
  return uniqueById(response.message ?? [], (item) => item.River_Code);
}

export async function fetchStretches(riverCode: number): Promise<Stretch[]> {
  const response = await api.post<RawStretch[]>("/location/get_stretch", {
    body: {
      river_code: riverCode,
      all_data: true,
    },
  });

  return uniqueById(
    (response.message ?? []).map((item) => ({
      id: item.Stretch_ID,
      Stretch_ID: item.Stretch_ID,
      river_code: item.river_code ?? item.river_Code ?? riverCode,
      name: item.name,
    })),
    (item) => item.id,
  );
}

export async function fetchDrains(stretchIds: number[]): Promise<Drain[]> {
  if (stretchIds.length === 0) {
    return [];
  }

  const response = await api.post<RawDrain[]>("/location/get_suitability_drain", {
    body: {
      stretch_ids: stretchIds,
      all_data: true,
    },
  });

  return uniqueById(
    (response.message ?? []).map((item) => ({
      id: item.Drain_No,
      Drain_No: item.Drain_No,
      stretch_id: item.stretch_id,
      name: item.name ?? item.Name,
      latitude: item.latitude ?? 0,
      longitude: item.longitude ?? 0,
    })),
    (item) => item.id,
  );
}

export async function fetchPriorityCatchments(drainNos: number[]): Promise<Layer_name> {
  const response = await api.post<Layer_name>("/stp_operation/get_priority_cachement", {
    body: {
      drain_nos: drainNos,
      all_data: true,
    },
  });

  if (!response.message) {
    throw new Error("Catchment request returned no payload");
  }

  return {
    layer_name: response.message.layer_name,
    catchments: (response.message.catchments ?? []).map((item: Catchment) => ({
      id: item.id,
      village_name: item.village_name,
      area: item.area,
      name: item.name,
    })),
  };
}

export async function fetchUserDisplayRaster(
  clip: number[],
  layerName?: string | null,
): Promise<DisplayRasterResult> {
  const body: {
    clip: number[];
    place: "Drain";
    layer_name?: string;
  } = {
    clip,
    place: "Drain",
  };

  if (layerName) {
    body.layer_name = layerName;
  }

  const response = await api.post<DisplayRasterApiMessage>(
    "/gwz_operation/gwpl_visual_display",
    { body },
  );

  return normalizeDisplayRasterPayload(response.message);
}

export async function runUserPumpingAnalysis(
  payload: UserPumpingAnalysisPayload,
): Promise<stp_priority_Output> {
  const response = await api.post<stp_priority_Output>("/gwz_operation/gwpl_operation", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("Pumping analysis returned no payload");
  }

  return response.message;
}

export async function runUserPumpingFindScore(
  payload: UserPumpingFindScorePayload,
): Promise<PumpingFindScoreResult> {
  const response = await api.post<GwplFindScoreResponse>("/gwz_operation/gwpl_find_score", {
    body: payload,
  });

  return normalizeGwplFindScorePayload(response.message, payload.location);
}
