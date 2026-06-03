import { api } from "@/services/api";
import type {
  ClipRasters,
  SelectRasterLayer,
  Stp_area,
  SuitabilityAreaPayload,
  SuitabilityAreaResult,
  SuitabilityCategoryBundle,
  SuitabilityVisualDisplayResult,
  ManualAreaConfirmPayload,
  ManualAreaConfirmResult,
  ManualCheckConstraintsPayload,
  ManualCheckConstraintsResult,
  ManualFindPathPayload,
  ManualFindPathResult,
  ManualSuitabilityAnalysisPayload,
  MultiAreaConfirmPayload,
  MultiAreaConfirmResponse,
  MultiFindPathPayload,
  MultiFindPathResponse,
  MultiAreaPayload,
  MultiAreaResponse,
  stp_sutability_Output,
} from "./manual_stpSuitabilityTypes";

const FALLBACK_STP_AREA_OPTIONS: Stp_area[] = [
  { id: 1, tech_name: "Trickling Filter", tech_value: 0.25 },
  { id: 2, tech_name: "Activated Sludge Process", tech_value: 0.15 },
  { id: 3, tech_name: "Extended Aeration", tech_value: 0.15 },
  { id: 4, tech_name: "Sequential Batch Reactor", tech_value: 0.1 },
  { id: 5, tech_name: "BIOFOR-F", tech_value: 0.08 },
  { id: 6, tech_name: "Membrane Bioreactor", tech_value: 0.05 },
  { id: 7, tech_name: "Constructed Wetland", tech_value: 0.3 },
  { id: 8, tech_name: "Waste Stabilization Pond", tech_value: 0.4 },
  { id: 9, tech_name: "Anaerobic Baffled Reactor", tech_value: 0.08 },
  { id: 10, tech_name: "UASB + Constructed Wetland", tech_value: 0.15 },
  { id: 11, tech_name: "Compact MBBR", tech_value: 0.06 },
  { id: 12, tech_name: "Packaged Modular STP", tech_value: 0.05 },
];

const areaResultCache = new Map<string, SuitabilityAreaResult>();
const areaRequestCache = new Map<string, Promise<SuitabilityAreaResult>>();
const WS_BASE = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

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

async function fetchSuitabilityAreaOptions(): Promise<Stp_area[]> {
  try {
    const response = await api.get<Stp_area[]>("/stp_manual_operation/get_stp_suitability_area");
    return response.message?.length ? response.message : FALLBACK_STP_AREA_OPTIONS;
  } catch {
    return FALLBACK_STP_AREA_OPTIONS;
  }
}

export async function fetchSuitabilityCategories(): Promise<SuitabilityCategoryBundle> {
  try {
    const [conditionResponse, constraintResponse] = await Promise.all([
      api.get<import("./manual_stpSuitabilityTypes").Category[]>(
        "/stp_manual_operation/get_suitability_by_category?category=condition&all_data=true",
      ),
      api.get<import("./manual_stpSuitabilityTypes").Category[]>(
        "/stp_manual_operation/get_suitability_by_category?category=constraint&all_data=true",
      ),
    ]);
    const areaOptions = await fetchSuitabilityAreaOptions();
    return {
      conditionCategories: conditionResponse.message ?? [],
      constraintCategories: constraintResponse.message ?? [],
      areaOptions,
    };
  } catch (error) {
    normalizeApiError(error, "Failed to fetch suitability categories");
  }
}

export function buildWeightedSelections(
  selectedLayers: SelectRasterLayer[],
): SelectRasterLayer[] {
  if (selectedLayers.length === 0) return [];
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

/** Fresh (no-cache) version of findSuitabilityAreaCluster — used in manual mode. */
export async function findSuitabilityAreaClusterFresh(
  payload: SuitabilityAreaPayload,
): Promise<SuitabilityAreaResult> {
  const cacheKey = JSON.stringify(payload);
  areaResultCache.delete(cacheKey);
  areaRequestCache.delete(cacheKey);
  return findSuitabilityAreaCluster(payload);
}

async function findSuitabilityAreaCluster(
  payload: SuitabilityAreaPayload,
): Promise<SuitabilityAreaResult> {
  const cacheKey = JSON.stringify(payload);
  const cachedResult = areaResultCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  const pendingRequest = areaRequestCache.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = startSuitabilityAreaCluster(payload).finally(() => {
    areaRequestCache.delete(cacheKey);
  });
  areaRequestCache.set(cacheKey, request);

  const result = await request;
  areaResultCache.set(cacheKey, result);
  return result;
}

async function startSuitabilityAreaCluster(
  payload: SuitabilityAreaPayload,
): Promise<SuitabilityAreaResult> {
  try {
    const response = await api.post<{ task_id: string }>("/stp_manual_operation/stp_suitability_area", {
      body: payload,
    });
    const taskId = response.message?.task_id;
    if (!taskId) throw new Error("Treatment cluster request returned no task id");

    if (WS_BASE && typeof window !== "undefined") {
      try {
        await waitForOperationTask(taskId);
        return await fetchSuitabilityAreaResultOnce(taskId);
      } catch (_error) {
        return await pollSuitabilityAreaResult(taskId);
      }
    }
    return await pollSuitabilityAreaResult(taskId);
  } catch (error) {
    normalizeApiError(error, "Failed to find suitability area cluster");
  }
}

function waitForOperationTask(taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${WS_BASE}/tools/ws/operation/${taskId}`);
    const timeout = window.setTimeout(() => { socket.close(); reject(new Error("Timed out")); }, 600000);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as { status?: string; description?: string };
        if (message.status === "completed") { window.clearTimeout(timeout); socket.close(); resolve(); }
        if (message.status === "failed") { window.clearTimeout(timeout); socket.close(); reject(new Error(message.description ?? "Failed")); }
      } catch (_e) { /* ignore */ }
    };
    socket.onerror = () => { window.clearTimeout(timeout); socket.close(); reject(new Error("WebSocket failed")); };
  });
}

async function fetchSuitabilityAreaResultOnce(taskId: string): Promise<SuitabilityAreaResult> {
  const response = await api.get<SuitabilityAreaResult & { task_status?: string }>(`/stp_manual_operation/stp_area/${taskId}`);
  const msg = response.message;
  if (!msg) throw new Error("No payload");
  if (msg.task_status === "failed") throw new Error("Task failed on server");
  if (msg.cluster_layer || msg.cluster_distances) return msg;
  throw new Error("__pending__");
}

async function pollSuitabilityAreaResult(taskId: string): Promise<SuitabilityAreaResult> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try { return await fetchSuitabilityAreaResultOnce(taskId); }
    catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg !== "__pending__" && attempt === 299) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Treatment cluster request timed out");
}

export async function fetchManualSuitabilityDisplayRaster(
  vectorLayerName: string,
): Promise<SuitabilityVisualDisplayResult> {
  try {
    const response = await api.post<{ raster_layer?: ClipRasters[]; vector_layer?: string }>(
      "/stp_manual_operation/stp_suitability_visual_display",
      { body: { layer_name: vectorLayerName, place: "Manual" } },
    );
    return {
      rasterLayers: response.message?.raster_layer ?? [],
      vectorLayer: response.message?.vector_layer ?? null,
    };
  } catch (error) {
    normalizeApiError(error, "Failed to fetch manual suitability display raster");
  }
}

export async function confirmManualAreaSelection(
  payload: ManualAreaConfirmPayload,
): Promise<ManualAreaConfirmResult> {
  try {
    const formData = new FormData();
    formData.append("method", payload.method);
    if (payload.file) formData.append("file", payload.file);
    if (payload.polygon) formData.append("polygon", JSON.stringify(payload.polygon));

    const response = await api.post<{
      raster_layer?: ClipRasters[];
      vector_layer?: string;
      polygon_layer?: string;
      centroid_lat?: number;
      centroid_lon?: number;
      buffer_bbox?: [number, number, number, number];
      area_ha?: number;
    }>("/stp_manual_operation/stp_manual_area_confirm", { body: formData });

    return {
      rasterLayers: response.message?.raster_layer ?? [],
      vectorLayer: response.message?.vector_layer ?? null,
      polygonLayer: response.message?.polygon_layer ?? null,
      centroidLat: response.message?.centroid_lat ?? 0,
      centroidLon: response.message?.centroid_lon ?? 0,
      bufferBbox: response.message?.buffer_bbox ?? [0, 0, 0, 0],
      areaHa: response.message?.area_ha ?? 0,
    };
  } catch (error) {
    normalizeApiError(error, "Failed to confirm manual area selection");
  }
}

export async function fetchManualAreaRasterKey(vectorLayerName: string): Promise<string> {
  try {
    const response = await api.post<{ raster_layer: string }>(
      "/stp_manual_operation/stp_manual_area_raster",
      { body: { layer_name: vectorLayerName } },
    );
    if (!response.message?.raster_layer) throw new Error("No raster key returned");
    return response.message.raster_layer;
  } catch (error) {
    normalizeApiError(error, "Failed to create manual area suitability raster");
  }
}

export async function runManualSuitabilityAnalysis(
  payload: ManualSuitabilityAnalysisPayload,
): Promise<stp_sutability_Output> {
  try {
    const response = await api.post<stp_sutability_Output>(
      "/stp_manual_operation/stp_suitability",
      { body: { data: payload.data, village_layer: payload.village_layer, place: "Manual" } },
    );
    if (!response.message) throw new Error("Manual suitability analysis returned no payload");
    return response.message;
  } catch (error) {
    normalizeApiError(error, "Failed to run manual suitability analysis");
  }
}

export async function fetchDrainsInBbox(
  bbox: [number, number, number, number],
): Promise<{ Drain_No: number; latitude: number; longitude: number }[]> {
  try {
    const [min_lon, min_lat, max_lon, max_lat] = bbox;
    const response = await api.post<{ Drain_No: number; latitude: number; longitude: number }[]>(
      "/location/drains_in_bbox",
      { body: { min_lon, min_lat, max_lon, max_lat } },
    );
    return response.message ?? [];
  } catch {
    return [];
  }
}

export async function findManualPath(
  payload: ManualFindPathPayload,
): Promise<ManualFindPathResult> {
  try {
    const response = await api.post<ManualFindPathResult>(
      "/stp_manual_operation/stp_manual_find_path",
      { body: payload },
    );
    return {
      suitable_path: response.message?.suitable_path ?? null,
      cluster_distances: response.message?.cluster_distances ?? null,
    };
  } catch (error) {
    normalizeApiError(error, "Failed to find road path for manual area");
  }
}


export async function checkManualConstraints(
  payload: ManualCheckConstraintsPayload,
): Promise<ManualCheckConstraintsResult> {
  try {
    const response = await api.post<ManualCheckConstraintsResult>(
      "/stp_manual_operation/stp_manual_check_constraints",
      { body: payload },
    );
    return response.message ?? { constraint_violations: [], can_proceed: true };
  } catch {
    return { constraint_violations: [], can_proceed: true };
  }
}

export async function previewPolygon(payload: { method: string; files: File[] }): Promise<GeoJSON.FeatureCollection> {
  const formData = new FormData();
  formData.append("method", payload.method);
  for (const file of payload.files) formData.append("files", file);
  const response = await api.post<GeoJSON.FeatureCollection>(
    "/stp_manual_operation/stp_preview_polygon",
    { body: formData },
  );
  return response.message ?? { type: "FeatureCollection", features: [] };
}

export async function confirmMultiAreaSelection(
  payload: MultiAreaConfirmPayload,
): Promise<MultiAreaConfirmResponse> {
  try {
    const formData = new FormData();
    formData.append("method", payload.method);
    for (const file of payload.files) formData.append("files", file);
    const response = await api.post<MultiAreaConfirmResponse>(
      "/stp_manual_operation/stp_multi_area_confirm",
      { body: formData },
    );
    return response.message ?? { results: [] };
  } catch (error) {
    normalizeApiError(error, "Failed to confirm multi-area selection");
  }
}

export async function findMultiPath(
  payload: MultiFindPathPayload,
): Promise<MultiFindPathResponse> {
  try {
    const response = await api.post<MultiFindPathResponse>(
      "/stp_manual_operation/stp_multi_find_path",
      { body: payload },
    );
    return response.message ?? { results: [] };
  } catch (error) {
    normalizeApiError(error, "Failed to find road paths for multi-area");
  }
}

export async function findMultiArea(
  payload: MultiAreaPayload,
): Promise<MultiAreaResponse> {
  try {
    const response = await api.post<MultiAreaResponse>(
      "/stp_manual_operation/stp_multi_area",
      { body: payload },
    );
    return response.message ?? { results: [] };
  } catch (error) {
    normalizeApiError(error, "Failed to find DSS clusters for multi-area");
  }
}
