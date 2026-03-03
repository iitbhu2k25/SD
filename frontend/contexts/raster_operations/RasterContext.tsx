"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "react-toastify";
import { uploadFileInChunks } from "@/utils/chunkUpload";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RasterLayer {
  file_id: string;
  file_name: string;
  layer_name: string;
  category?: string;
}

export interface BandInfo {
  band_number: number;
  dtype: string;
  color_interpretation: string;
  min: number;
  max: number;
  mean: number;
  std: number;
}

export interface RasterDetails {
  file_size: { value: number; unit: string };
  driver: string;
  width: number;
  height: number;
  band_count: number;
  dtypes: string[];
  nodata: number | null;
  crs: string;
  crs_unit: string;
  bounds: { west: number; south: number; east: number; north: number; unit: string };
  bounds_wgs84: { west: number; south: number; east: number; north: number; unit: string };
  resolution: { x: { value: number; unit: string }; y: { value: number; unit: string } };
  compression: string | null;
  is_tiled: boolean;
  block_shapes: number[][];
  is_cog_like: boolean;
  bands: BandInfo[];
  tags: Record<string, string>;
}

export type OperationType =
  | "reprojection"
  | "reclassification"
  | "euclidean_distance"
  | "slope"
  | "tpi"
  | "twi";

export type OperationStatus = "idle" | "running" | "success" | "error";

export interface OperationResult {
  file_id: string;
  file_name: string;
  layer_name: string;
  output_path?: string;
}

export interface Operation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  params: Record<string, unknown>;
  result?: OperationResult;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export type SidebarTab = "layers" | "basemap" | "details" | "operations";

export const BASE_MAPS = {
  satellite: {
    name: "Satellite",
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
  },
  osm: {
    name: "OpenStreetMap",
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  },
  topo: {
    name: "Topographic",
    icon: "M5 3l14 9-14 9V3z",
  },
} as const;

export type BaseMapKey = keyof typeof BASE_MAPS;

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  uploading: boolean;
  uploadProgress: number;

  layers: RasterLayer[];
  activeLayer: RasterLayer | null;

  details: RasterDetails | null;
  detailsLoading: boolean;

  operations: Operation[];

  activeBaseMap: BaseMapKey;
  wmsOpacity: number;
  legendUrl: string | null;
  showLegend: boolean;
  mapLoading: boolean;
  isFullscreen: boolean;

  sidebarTab: SidebarTab;
  sidebarOpen: boolean;
  error: string | null;
}

const INIT: State = {
  uploading: false,
  uploadProgress: 0,
  layers: [],
  activeLayer: null,
  details: null,
  detailsLoading: false,
  operations: [],
  activeBaseMap: "satellite",
  wmsOpacity: 75,
  legendUrl: null,
  showLegend: true,
  mapLoading: false,
  isFullscreen: false,
  sidebarTab: "layers",
  sidebarOpen: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_PROGRESS"; pct: number }
  | { type: "UPLOAD_SUCCESS"; layers: RasterLayer[] }
  | { type: "UPLOAD_ERROR"; msg: string }
  | { type: "ADD_LAYERS"; layers: RasterLayer[] }
  | { type: "REMOVE_LAYER"; fileId: string }
  | { type: "SET_ACTIVE"; layer: RasterLayer }
  | { type: "CLEAR_ACTIVE" }
  | { type: "DETAILS_START" }
  | { type: "DETAILS_OK"; details: RasterDetails }
  | { type: "DETAILS_FAIL" }
  | { type: "OP_ADD"; op: Operation }
  | { type: "OP_UPDATE"; id: string; status: OperationStatus; result?: OperationResult; error?: string }
  | { type: "SET_BASEMAP"; key: BaseMapKey }
  | { type: "SET_OPACITY"; v: number }
  | { type: "SET_LEGEND_URL"; url: string | null }
  | { type: "SET_SHOW_LEGEND"; v: boolean }
  | { type: "SET_MAP_LOADING"; v: boolean }
  | { type: "SET_FULLSCREEN"; v: boolean }
  | { type: "SET_TAB"; tab: SidebarTab }
  | { type: "SET_SIDEBAR"; open: boolean }
  | { type: "SET_ERROR"; msg: string | null };

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "UPLOAD_START":
      return { ...s, uploading: true, uploadProgress: 0, error: null };

    case "UPLOAD_PROGRESS":
      return { ...s, uploadProgress: a.pct };

    case "UPLOAD_SUCCESS":
    case "ADD_LAYERS": {
      const incoming = a.layers.filter(
        (l) => !s.layers.some((ex) => ex.file_id === l.file_id)
      );
      return {
        ...s,
        uploading: false,
        uploadProgress: 0,
        layers: [...s.layers, ...incoming],
      };
    }

    case "UPLOAD_ERROR":
      return { ...s, uploading: false, uploadProgress: 0, error: a.msg };

    case "REMOVE_LAYER": {
      const layers = s.layers.filter((l) => l.file_id !== a.fileId);
      const gone = s.activeLayer?.file_id === a.fileId;
      return {
        ...s,
        layers,
        activeLayer: gone ? null : s.activeLayer,
        details: gone ? null : s.details,
        legendUrl: gone ? null : s.legendUrl,
      };
    }

    case "SET_ACTIVE":
      return { ...s, activeLayer: a.layer, details: null };

    case "CLEAR_ACTIVE":
      return { ...s, activeLayer: null, details: null, legendUrl: null };

    case "DETAILS_START":
      return { ...s, detailsLoading: true, details: null };

    case "DETAILS_OK":
      return { ...s, detailsLoading: false, details: a.details };

    case "DETAILS_FAIL":
      return { ...s, detailsLoading: false };

    case "OP_ADD":
      return { ...s, operations: [a.op, ...s.operations] };

    case "OP_UPDATE":
      return {
        ...s,
        operations: s.operations.map((op) =>
          op.id !== a.id
            ? op
            : {
                ...op,
                status: a.status,
                finishedAt: Date.now(),
                ...(a.result ? { result: a.result } : {}),
                ...(a.error ? { error: a.error } : {}),
              }
        ),
      };

    case "SET_BASEMAP":     return { ...s, activeBaseMap: a.key };
    case "SET_OPACITY":     return { ...s, wmsOpacity: a.v };
    case "SET_LEGEND_URL":  return { ...s, legendUrl: a.url };
    case "SET_SHOW_LEGEND": return { ...s, showLegend: a.v };
    case "SET_MAP_LOADING": return { ...s, mapLoading: a.v };
    case "SET_FULLSCREEN":  return { ...s, isFullscreen: a.v };
    case "SET_TAB":         return { ...s, sidebarTab: a.tab };
    case "SET_SIDEBAR":     return { ...s, sidebarOpen: a.open };
    case "SET_ERROR":       return { ...s, error: a.msg };

    default:
      return s;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const MAX_FILE_SIZE = 500 * 1024 * 1024;

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg = b.detail ?? b.message ?? msg;
    } catch {/* ignore */}
    throw new Error(msg);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg = b.detail ?? b.message ?? msg;
    } catch {/* ignore */}
    throw new Error(msg);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT VALUE
// ─────────────────────────────────────────────────────────────────────────────

interface CtxValue {
  state: State;
  dispatch: React.Dispatch<Action>;

  // Upload & layers
  handleUpload: (file: File) => Promise<void>;
  selectLayer: (layer: RasterLayer) => void;
  removeLayer: (fileId: string) => void;
  clearActiveLayer: () => void;

  // Operations
  executeOperation: (type: OperationType, params: Record<string, unknown>) => Promise<void>;

  // Map config
  setOpacity: (v: number) => void;
  setLegendUrl: (url: string | null) => void;
  setShowLegend: (v: boolean) => void;
  setMapLoading: (v: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setBaseMap: (key: BaseMapKey) => void;

  // UI
  setTab: (tab: SidebarTab) => void;
  setSidebar: (open: boolean) => void;
  clearError: () => void;
}

const Ctx = createContext<CtxValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function RasterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INIT);

  // ── Load details for a layer ──────────────────────────────────────────────
  const loadDetails = useCallback(async (fileId: string) => {
    dispatch({ type: "DETAILS_START" });
    try {
      const details = await apiGet<RasterDetails>(`/api/raster/${fileId}/details`);
      dispatch({ type: "DETAILS_OK", details });
    } catch (err) {
      dispatch({ type: "DETAILS_FAIL" });
      toast.error(err instanceof Error ? err.message : "Failed to load metadata");
    }
  }, []);

  // ── Upload (chunked) ─────────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File must be ${MAX_FILE_SIZE / 1024 / 1024} MB or less`);
        return;
      }

      dispatch({ type: "UPLOAD_START" });

      try {
        
        const res = await uploadFileInChunks(file, (pct: number) =>
          dispatch({ type: "UPLOAD_PROGRESS", pct })
        );

        // Normalise: your chunk endpoint may return layers in `message` or directly
        const layers: RasterLayer[] = Array.isArray(res) ? res : (typeof res === 'string' ? JSON.parse(res) : []);

        if (layers.length === 0) {
          throw new Error("No layers returned from server");
        }

        dispatch({ type: "UPLOAD_SUCCESS", layers });
        toast.success(`"${file.name}" uploaded`);

        // Auto-select first layer and fetch details
        const first = layers[0];
        dispatch({ type: "SET_ACTIVE", layer: first });
        loadDetails(first.file_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        dispatch({ type: "UPLOAD_ERROR", msg });
        toast.error(msg);
      }
    },
    [loadDetails]
  );

  // ── Layer actions ─────────────────────────────────────────────────────────
  const selectLayer = useCallback(
    (layer: RasterLayer) => {
      dispatch({ type: "SET_ACTIVE", layer });
      loadDetails(layer.file_id);
    },
    [loadDetails]
  );

  const removeLayer = useCallback((fileId: string) => {
    dispatch({ type: "REMOVE_LAYER", fileId });
    toast.info("Layer removed");
  }, []);

  const clearActiveLayer = useCallback(() => {
    dispatch({ type: "CLEAR_ACTIVE" });
  }, []);

  // ── Operations ────────────────────────────────────────────────────────────
  const executeOperation = useCallback(
    async (type: OperationType, params: Record<string, unknown>) => {
      const active = state.activeLayer;
      if (!active) {
        toast.error("Select a layer first");
        return;
      }

      const op: Operation = {
        id: `op_${Date.now()}`,
        type,
        status: "running",
        params,
        startedAt: Date.now(),
      };
      dispatch({ type: "OP_ADD", op });
      toast.info(`Running ${type.replace(/_/g, " ")}…`);

      try {
        const result = await apiPost<OperationResult>("/api/raster/operation", {
          file_id: active.file_id,
          operation: type,
          params,
        });
        dispatch({ type: "OP_UPDATE", id: op.id, status: "success", result });
        toast.success(`${type.replace(/_/g, " ")} completed`);

        if (result.file_id && result.layer_name) {
          dispatch({
            type: "ADD_LAYERS",
            layers: [
              {
                file_id: result.file_id,
                file_name: result.file_name,
                layer_name: result.layer_name,
              },
            ],
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Operation failed";
        dispatch({ type: "OP_UPDATE", id: op.id, status: "error", error: msg });
        toast.error(msg);
      }
    },
    [state.activeLayer]
  );

  // ── Map config ────────────────────────────────────────────────────────────
  const setOpacity    = useCallback((v: number)          => dispatch({ type: "SET_OPACITY", v }), []);
  const setLegendUrl  = useCallback((url: string | null) => dispatch({ type: "SET_LEGEND_URL", url }), []);
  const setShowLegend = useCallback((v: boolean)         => dispatch({ type: "SET_SHOW_LEGEND", v }), []);
  const setMapLoading = useCallback((v: boolean)         => dispatch({ type: "SET_MAP_LOADING", v }), []);
  const setFullscreen = useCallback((v: boolean)         => dispatch({ type: "SET_FULLSCREEN", v }), []);
  const setBaseMap    = useCallback((key: BaseMapKey)     => dispatch({ type: "SET_BASEMAP", key }), []);

  // ── UI ────────────────────────────────────────────────────────────────────
  const setTab     = useCallback((tab: SidebarTab) => dispatch({ type: "SET_TAB", tab }), []);
  const setSidebar = useCallback((open: boolean)   => dispatch({ type: "SET_SIDEBAR", open }), []);
  const clearError = useCallback(()                => dispatch({ type: "SET_ERROR", msg: null }), []);

  return (
    <Ctx.Provider
      value={{
        state,
        dispatch,
        handleUpload,
        selectLayer,
        removeLayer,
        clearActiveLayer,
        executeOperation,
        setOpacity,
        setLegendUrl,
        setShowLegend,
        setMapLoading,
        setFullscreen,
        setBaseMap,
        setTab,
        setSidebar,
        clearError,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useRaster(): CtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRaster must be inside <RasterProvider>");
  return ctx;
}