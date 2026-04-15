import { api } from "@/services/api";
import type {
  AdminSuitabilityAnalysisPayload,
  AdminSuitabilityReferenceData,
  AdminSuitabilityReportPayload,
  Category,
  ClipRasters,
  District,
  Drain,
  ReportTaskResponse,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  Stp_area,
  SubDistrict,
  SuitabilityAreaPayload,
  SuitabilityCategoryBundle,
  Towns,
  UserSuitabilityAnalysisPayload,
  UserSuitabilityReferenceData,
  UserSuitabilityReportPayload,
  stp_sutability_Output,
  Catchment,
} from "./stpSuitabilityTypes";

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

interface SuitabilityCatchmentResponse {
  layer_name: string;
  catchments: Catchment[];
}

function uniqueById<T>(items: T[], getId: (item: T) => number | string): T[] {
  return Array.from(new Map(items.map((item) => [getId(item), item])).values());
}

function normalizeApiError(error: unknown, fallback: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    throw new Error((error as { message: string }).message);
  }

  throw new Error(fallback);
}

export async function fetchSuitabilityCategories(): Promise<SuitabilityCategoryBundle> {
  try {
    const [conditionResponse, constraintResponse, areaResponse] = await Promise.all([
      api.get<Category[]>(
        "/stp_operation/get_suitability_by_category?category=condition&all_data=true",
      ),
      api.get<Category[]>(
        "/stp_operation/get_suitability_by_category?category=constraint&all_data=true",
      ),
      api.get<Stp_area[]>("/stp_operation/get_stp_suitability_area"),
    ]);

    return {
      conditionCategories: conditionResponse.message ?? [],
      constraintCategories: constraintResponse.message ?? [],
      areaOptions: areaResponse.message ?? [],
    };
  } catch (error) {
    normalizeApiError(error, "Failed to fetch suitability categories");
  }
}

export async function fetchAdminSuitabilityReferenceData(): Promise<AdminSuitabilityReferenceData> {
  try {
    const [statesResponse, districtsResponse, subDistrictsResponse, townsResponse] =
      await Promise.all([
        api.get<State[]>("/location/get_states?all_data=true"),
        api.get<District[]>("/location/all_districts"),
        api.get<SubDistrict[]>("/location/all_sub_districts"),
        api.get<Towns[]>("/location/get_all_towns"),
      ]);

    return {
      states: statesResponse.message ?? [],
      districts: districtsResponse.message ?? [],
      subDistricts: subDistrictsResponse.message ?? [],
      towns: townsResponse.message ?? [],
    };
  } catch (error) {
    normalizeApiError(error, "Failed to fetch admin suitability reference data");
  }
}

export async function fetchUserSuitabilityReferenceData(): Promise<UserSuitabilityReferenceData> {
  try {
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
          latitude: drain.latitude,
          longitude: drain.longitude,
        })),
        (drain) => drain.id,
      ),
    };
  } catch (error) {
    normalizeApiError(error, "Failed to fetch user suitability reference data");
  }
}

export async function fetchSuitabilityCatchments(
  drainNos: number[],
): Promise<SuitabilityCatchmentResponse> {
  try {
    const response = await api.post<SuitabilityCatchmentResponse>(
      "/stp_operation/get_suitability_cachement",
      {
        body: {
          drain_nos: drainNos,
          all_data: true,
        },
      },
    );

    if (!response.message) {
      throw new Error("Catchment request returned no payload");
    }

    return response.message;
  } catch (error) {
    normalizeApiError(error, "Failed to fetch suitability catchments");
  }
}

export async function fetchAdminSuitabilityDisplayRaster(
  clip: number[],
): Promise<ClipRasters[]> {
  try {
    const response = await api.post<ClipRasters[]>(
      "/stp_operation/stp_suitability_visual_display",
      {
        body: {
          clip,
          place: "sub_district",
        },
      },
    );

    return response.message ?? [];
  } catch (error) {
    normalizeApiError(error, "Failed to fetch admin suitability display raster");
  }
}

export async function fetchUserSuitabilityDisplayRaster(
  clip: number[],
): Promise<ClipRasters[]> {
  try {
    const response = await api.post<ClipRasters[]>(
      "/stp_operation/stp_suitability_visual_display",
      {
        body: {
          clip,
          place: "Drain",
        },
      },
    );

    return response.message ?? [];
  } catch (error) {
    normalizeApiError(error, "Failed to fetch user suitability display raster");
  }
}

export async function runAdminSuitabilityAnalysis(
  payload: AdminSuitabilityAnalysisPayload,
): Promise<stp_sutability_Output> {
  try {
    const response = await api.post<stp_sutability_Output>("/stp_operation/stp_suitability", {
      body: payload,
    });

    if (!response.message) {
      throw new Error("Admin suitability analysis returned no payload");
    }

    return response.message;
  } catch (error) {
    normalizeApiError(error, "Failed to run admin suitability analysis");
  }
}

export async function runUserSuitabilityAnalysis(
  payload: UserSuitabilityAnalysisPayload,
): Promise<stp_sutability_Output> {
  try {
    const response = await api.post<stp_sutability_Output>("/stp_operation/stp_suitability", {
      body: payload,
    });

    if (!response.message) {
      throw new Error("User suitability analysis returned no payload");
    }

    return response.message;
  } catch (error) {
    normalizeApiError(error, "Failed to run user suitability analysis");
  }
}

export async function findSuitabilityAreaCluster(
  payload: SuitabilityAreaPayload,
): Promise<string | null> {
  try {
    const response = await api.post<string>("/stp_operation/stp_suitability_area", {
      body: payload,
    });

    return response.message ?? null;
  } catch (error) {
    normalizeApiError(error, "Failed to find suitability area cluster");
  }
}

export async function startAdminSuitabilityReport(
  payload: AdminSuitabilityReportPayload,
) {
  return api.post<ReportTaskResponse>("/stp_operation/stp_suitability_admin_report", {
    body: payload,
  });
}

export async function startUserSuitabilityReport(
  payload: UserSuitabilityReportPayload,
) {
  return api.post<ReportTaskResponse>("/stp_operation/stp_suitability_drain_report", {
    body: payload,
  });
}

export function buildWeightedSelections(
  selectedLayers: SelectRasterLayer[],
): SelectRasterLayer[] {
  if (selectedLayers.length === 0) {
    return [];
  }

  const totalInfluence = selectedLayers.reduce(
    (sum, layer) => sum + Number.parseFloat(layer.Influence),
    0,
  );

  if (totalInfluence === 0) {
    const equalWeight = (1 / selectedLayers.length).toFixed(4);
    return selectedLayers.map((layer) => ({ ...layer, weight: equalWeight }));
  }

  return selectedLayers.map((layer) => ({
    ...layer,
    weight: (Number.parseFloat(layer.Influence) / totalInfluence).toFixed(4),
  }));
}
