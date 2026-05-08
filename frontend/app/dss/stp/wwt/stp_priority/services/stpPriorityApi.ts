import {
  Category,
  ClipRasters,
  District,
  Drain,
  Layer_name,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  SubDistrict,
  stp_priority_Output,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import { api } from "@/services/api";

export interface AdminLocationReferenceData {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
}

export interface UserRiverReferenceData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
}

interface RawStretch {
  Stretch_ID: number;
  river_Code: number;
  name?: string;
}

interface RawDrain {
  Drain_No: number;
  stretch_id: number;
  name?: string;
  latitude?: number;
  longitude?: number;
}

interface RasterVisualResponse {
  raster_layer: ClipRasters[];
  vector_layer?: string | null;
}

type DisplayRasterApiMessage = ClipRasters[] | RasterVisualResponse;

function uniqueById<T>(items: T[], getId: (item: T) => number | string): T[] {
  return Array.from(new Map(items.map((item) => [getId(item), item])).values());
}

function normalizeDisplayRasterPayload(message: DisplayRasterApiMessage | null | undefined): {
  rasterLayer: ClipRasters[];
  vectorLayer: string | null;
} {
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

export interface AdminPriorityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  place: "sub_district";
  village_layer?: string | null;
}

export interface UserPriorityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  place: "Drain";
  village_layer?: string | null;
}

export interface AdminPriorityReportPayload {
  table: DataRow[];
  raster: ClipRasters[];
  place: "Admin";
  clip: number[];
  location: {
    state: string;
    districts: string[];
    subDistricts: string[];
  };
  weight_data: SelectRasterLayer[];
}

export interface UserPriorityReportPayload {
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
}

export interface ReportTaskResponse {
  task_id: string;
}

export interface DisplayRasterResult {
  rasterLayer: ClipRasters[];
  vectorLayer: string | null;
}

export async function fetchPriorityCategories(): Promise<Category[]> {
  const response =
    await api.get<Category[]>("/stp_operation/get_priority_category?all_data=true");
  return (response.message ?? []).filter(
    (item) =>
      !!item &&
      typeof item.file_name === "string" &&
      item.file_name.length > 0 &&
      typeof item.weight === "number" &&
      item.weight >= 0,
  );
}

export async function fetchAdminLocationReferenceData(): Promise<AdminLocationReferenceData> {
  const [statesResponse, districtsResponse, subDistrictsResponse] = await Promise.all([
    api.get<State[]>("/location/get_states?all_data=true"),
    api.get<District[]>("/location/all_districts"),
    api.get<SubDistrict[]>("/location/all_sub_districts"),
  ]);

  return {
    states: statesResponse.message ?? [],
    districts: districtsResponse.message ?? [],
    subDistricts: subDistrictsResponse.message ?? [],
  };
}

export async function fetchAdminDisplayRaster(clip: number[]): Promise<DisplayRasterResult> {
  const response = await api.post<DisplayRasterApiMessage>(
    "/stp_operation/stp_priority_visual_display",
    {
      body: {
        clip,
        place: "sub_district",
      },
    },
  );

  return normalizeDisplayRasterPayload(response.message);
}

export async function runAdminPriorityAnalysis(
  payload: AdminPriorityAnalysisPayload,
): Promise<stp_priority_Output> {
  const response = await api.post<stp_priority_Output>("/stp_operation/stp_priority", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("STP analysis returned no payload");
  }

  return response.message;
}

export async function fetchUserRiverReferenceData(): Promise<UserRiverReferenceData> {
  const [riversResponse, stretchesResponse, drainsResponse] = await Promise.all([
    api.get<River[]>("/location/get_river"),
    api.get<RawStretch[]>("/location/all_stretch"),
    api.get<RawDrain[]>("/location/all_drain"),
  ]);

  return {
    rivers: uniqueById(
      (riversResponse.message ?? []).map((river) => ({
        River_Name: river.River_Name,
        River_Code: river.River_Code,
      })),
      (river) => river.River_Code,
    ),
    stretches: uniqueById(
      (stretchesResponse.message ?? []).map((stretch) => ({
        id: stretch.Stretch_ID,
        Stretch_ID: stretch.Stretch_ID,
        river_code: stretch.river_Code,
        name: stretch.name,
      })),
      (stretch) => stretch.id,
    ),
    drains: uniqueById(
      (drainsResponse.message ?? []).map((drain) => ({
        id: drain.Drain_No,
        Drain_No: drain.Drain_No,
        stretch_id: drain.stretch_id,
        name: drain.name,
        latitude: drain.latitude ?? 0,
        longitude: drain.longitude ?? 0,
      })),
      (drain) => drain.id,
    ),
  };
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

  return response.message;
}

export async function fetchUserDisplayRaster(
  clip: number[],
  layerName?: string | null,
): Promise<DisplayRasterResult> {
  const requestBody: {
    clip: number[];
    place: "Drain";
    layer_name?: string;
  } = {
    clip,
    place: "Drain",
  };

  if (layerName) {
    requestBody.layer_name = layerName;
  }

  const response = await api.post<DisplayRasterApiMessage>(
    "/stp_operation/stp_priority_visual_display",
    {
      body: requestBody,
    },
  );

  return normalizeDisplayRasterPayload(response.message);
}

export async function runUserPriorityAnalysis(
  payload: UserPriorityAnalysisPayload,
): Promise<stp_priority_Output> {
  const response = await api.post<stp_priority_Output>("/stp_operation/stp_priority", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("STP analysis returned no payload");
  }

  return response.message;
}

export async function startAdminPriorityReport(
  payload: AdminPriorityReportPayload,
) {
  return api.post<ReportTaskResponse>("/stp_operation/stp_priority_admin_report", {
    body: payload,
  });
}

export async function startUserPriorityReport(payload: UserPriorityReportPayload) {
  return api.post<ReportTaskResponse>("/stp_operation/stp_priority_drain_report", {
    body: payload,
  });
}