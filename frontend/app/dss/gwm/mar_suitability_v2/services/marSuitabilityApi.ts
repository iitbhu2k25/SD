import {
  Category,
  ClipRasters,
  District,
  Drain,
  Layer_name,
  MarLayerInfo,
  MarSuitabilityResponse,
  raster_visual_resp,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  SubDistrict,
  villages,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import { api } from "@/services/api";

export interface MarSuitabilityOutput {
  csv_details: DataRow[];
  layer_name: string;
  workspace: string;
}

export interface AdminLocationReferenceData {
  states: State[];
}

export interface UserRiverReferenceData {
  rivers: River[];
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
  latitude: number;
  longitude: number;
}

type UserDisplayRasterApiMessage = ClipRasters[] | raster_visual_resp;

function normalizeUserDisplayRasterPayload(
  message: UserDisplayRasterApiMessage | null | undefined,
): raster_visual_resp {
  if (Array.isArray(message)) {
    return {
      raster_layer: message,
      vector_layer: "",
    };
  }

  if (message && Array.isArray(message.raster_layer)) {
    return {
      raster_layer: message.raster_layer,
      vector_layer: typeof message.vector_layer === "string" ? message.vector_layer : "",
    };
  }

  return { raster_layer: [], vector_layer: "" };
}

function uniqueById<T>(items: T[], getId: (item: T) => number | string): T[] {
  return Array.from(new Map(items.map((item) => [getId(item), item])).values());
}

export interface AdminPriorityAnalysisPayload {
  data: SelectRasterLayer[];
  village_layer: string;
}

export interface UserPriorityAnalysisPayload {
  data: SelectRasterLayer[];
  village_layer: string;
  place: "Drain";
}

export async function fetchMarConditionCategories(): Promise<Category[]> {
  const response =
    await api.get<Category[]>("/gwz_operation/get_mar_suitability_category?category=condition&all_data=true");
  return (response.message ?? []).filter(
    (item) =>
      !!item &&
      typeof item.file_name === "string" &&
      item.file_name.length > 0 &&
      typeof item.weight === "number" &&
      item.weight >= 0,
  );
}

export async function fetchMarConstraintCategories(): Promise<Category[]> {
  const response =
    await api.get<Category[]>("/gwz_operation/get_mar_suitability_category?category=constraint&all_data=true");
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
  const [statesResponse] = await Promise.all([
    api.get<State[]>("/location/get_states?all_data=true"),
  ]);

  return {
    states: statesResponse.message ?? [],
  };
}

export async function fetchDistrictsByState(stateId: number): Promise<District[]> {
  const response = await api.post<District[]>("/location/get_districts", {
    body: {
      state: stateId,
      all_data: true,
    },
  });
  return response.message ?? [];
}

export async function fetchSubDistrictsByDistrict(districtId: number): Promise<SubDistrict[]> {
  const response = await api.post<SubDistrict[]>("/location/get_sub_districts/", {
    body: {
      districts: [districtId],
      all_data: true,
    },
  });
  return response.message ?? [];
}

export async function fetchVillagesBySubDistrict(subDistrictId: number): Promise<villages[]> {
  const response = await api.post<villages[]>("/location/get_villages/", {
    body: {
      subdis_code: [subDistrictId],
      all_data: true,
    },
  });
  return response.message ?? [];
}

export async function fetchAdminDisplayRaster(clip: number[]): Promise<raster_visual_resp> {
  const response = await api.post<raster_visual_resp>(
    "/gwz_operation/mar_suitability_visual_display",
    {
      body: {
        clip,
        place: "District",
      },
    },
  );

  return response.message ?? { raster_layer: [], vector_layer: "" };
}

export async function runAdminMarAnalysis(
  payload: AdminPriorityAnalysisPayload,
): Promise<MarSuitabilityOutput> {
  const response = await api.post<MarSuitabilityOutput>("/gwz_operation/mar_suitability", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("MAR analysis returned no payload");
  }

  return response.message;
}

export async function fetchUserRiverReferenceData(): Promise<UserRiverReferenceData> {
  const [riversResponse] = await Promise.all([
    api.get<River[]>("/location/get_river"),
  ]);

  return {
    rivers: uniqueById(
      (riversResponse.message ?? []).map((river) => ({
        River_Name: river.River_Name,
        River_Code: river.River_Code,
      })),
      (river) => river.River_Code,
    ),
  };
}

export async function fetchStretchesByRiver(riverCode: number): Promise<Stretch[]> {
  const stretchesResponse = await api.post<RawStretch[]>("/location/get_stretch", {
    body: {
      river_code: riverCode,
      all_data: true,
    },
  });
  
  return uniqueById(
    (stretchesResponse.message ?? []).map((stretch) => ({
      id: stretch.Stretch_ID,
      Stretch_ID: stretch.Stretch_ID,
      river_code: stretch.river_Code,
      name: stretch.name,
    })),
    (stretch) => stretch.id,
  );
}

export async function fetchDrainsByStretches(stretchIds: number[]): Promise<Drain[]> {
  const drainsResponse = await api.post<RawDrain[]>("/location/get_suitability_drain", {
    body: {
      stretch_ids: stretchIds,
      all_data: true,
    },
  });
  
  return uniqueById(
    (drainsResponse.message ?? []).map((drain) => ({
      id: drain.Drain_No,
      Drain_No: drain.Drain_No,
      stretch_id: drain.stretch_id,
      name: drain.name,
      latitude: drain.latitude,
      longitude: drain.longitude,
    })),
    (drain) => drain.id,
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

  return response.message;
}

export async function fetchUserDisplayRaster(
  clip: number[],
  layerName?: string | null,
): Promise<raster_visual_resp> {
  const requestWithLayerName = layerName
    ? ({
        layer_name: layerName,
        place: "Drain",
      } as const)
    : null;

  if (requestWithLayerName) {
    const response = await api.post<UserDisplayRasterApiMessage>(
      "/stp_operation/stp_suitability_visual_display",
      {
        body: requestWithLayerName,
      },
    );
    const normalized = normalizeUserDisplayRasterPayload(response.message);
    if (normalized.raster_layer.length > 0) {
      return normalized;
    }
  }

  const response = await api.post<UserDisplayRasterApiMessage>(
    "/stp_operation/stp_suitability_visual_display",
    {
      body: {
        clip,
        place: "Drain",
      },
    },
  );

  return normalizeUserDisplayRasterPayload(response.message);
}

export async function runUserMarAnalysis(
  payload: UserPriorityAnalysisPayload,
): Promise<MarSuitabilityOutput> {
  const response = await api.post<MarSuitabilityOutput>("/gwz_operation/mar_suitability", {
    body: payload,
  });

  if (!response.message) {
    throw new Error("MAR analysis returned no payload");
  }

  return response.message;
}

function normalizeMarSubsurfacePayload(
  payload: MarSuitabilityResponse | MarLayerInfo[] | null | undefined,
): MarSuitabilityResponse {
  if (Array.isArray(payload)) {
    return {
      layers: payload,
      validation: [],
    };
  }

  if (payload && Array.isArray(payload.layers)) {
    return {
      layers: payload.layers,
      validation: Array.isArray(payload.validation) ? payload.validation : [],
    };
  }

  return {
    layers: [],
    validation: [],
  };
}

export async function fetchMarSubsurfaceDetails(
  lat: number,
  lon: number,
): Promise<MarSuitabilityResponse> {
  const response = await api.post<MarSuitabilityResponse | MarLayerInfo[]>(
    "/gwz_operation/mar_raster_details",
    {
      body: { lat, lon },
    },
  );
  return normalizeMarSubsurfacePayload(response.message);
}
