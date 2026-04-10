"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import toast from "react-hot-toast";
import { uploadFileInChunks } from "@/utils/chunkUpload";
import {
  RasterDetails,
  RasterDetailsApiResponse,
  RasterLayer,
  OperationType,
  OperationStatus,
  OperationResult,
  Operation,
  ColorStop,
  SLDConfig,
  normaliseRasterDetails,
  VectorDetails,
  VectorDetailsApiResponse,
  normaliseVectorDetails,
} from "@/interface/raster_operations";
import { api, ApiError } from "@/services/api";
import { LegendEntry } from "@/interface/raster_operations";

// ── Import TaskState types from the hook file ─────────────────────────────────
import {
  INITIAL_TASK_STATE,
} from "./Useoperationtask";
import { TaskState, TaskStatus } from "@/interface/raster_operations";

export type SidebarTab = "layers" | "basemap" | "details" | "operations";

export type VectorLayer = {
  file_name: string;
  file_id: string;
};

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


interface CtxValue {
  uploading: boolean;
  uploadProgress: number;
  layer: RasterLayer | null;
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
  rasterFileName: string | null;
  sldConfig: SLDConfig | null;
  setSldConfig: (sldConfig: SLDConfig | null) => void;
  legendInterpolation: "linear" | "discrete";
  setLegendInterpolation: (v: "linear" | "discrete") => void;
  rasterStack: RasterLayer[];
  addToStack: (layer: RasterLayer) => void;
  selectLayer: (layer: RasterLayer) => void;
  legendEntries: LegendEntry[];
  setLegendEntries: (entries: LegendEntry[]) => void;
  legendEntriesLoading: boolean;
  fetchLegendEntries: () => Promise<LegendEntry[]>;

  // ── Task state (lifted from useOperationTask) ────────────────────────────
  taskState: TaskState;
  setTaskState: React.Dispatch<React.SetStateAction<TaskState>>;

  setRasterFileName: (name: string | null) => void;

  handleUpload: (file: File) => Promise<void>;
  removeLayer: () => void;

  vectorLayer: VectorLayer | null;
  vectorUploading: boolean;
  vectorUploadProgress: number;
  vectorDetails: VectorDetails | null;
  vectorDetailsLoading: boolean;
  handleVectorUpload: (file: File) => Promise<VectorLayer | null>;
  removeVectorLayer: () => void;

  setOpacity: (v: number) => void;
  setLegendUrl: (url: string | null) => void;
  setShowLegend: (v: boolean) => void;
  setMapLoading: (v: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setBaseMap: (key: BaseMapKey) => void;
  setTab: (tab: SidebarTab) => void;
  setSidebar: (open: boolean) => void;
  clearError: () => void;
}

const Ctx = createContext<CtxValue | null>(null);

export function RasterProvider({ children }: { children: ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [layer, setLayer] = useState<RasterLayer | null>(null);
  const [details, setDetails] = useState<RasterDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMapKey>("osm");
  const [wmsOpacity, setWmsOpacity] = useState(75);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("layers");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rasterFileName, setRasterFileName] = useState<string | null>(null);
  const [sldConfig, setSldConfig] = useState<SLDConfig | null>(null);
  const [legendInterpolation, setLegendInterpolation] = useState<"linear" | "discrete">("discrete");
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [rasterStack, setRasterStack] = useState<RasterLayer[]>([]);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer | null>(null);
  const [vectorUploading, setVectorUploading] = useState(false);
  const [vectorUploadProgress, setVectorUploadProgress] = useState(0);
  const [vectorDetails, setVectorDetails] = useState<VectorDetails | null>(null);
  const [vectorDetailsLoading, setVectorDetailsLoading] = useState(false);

  const addToStack = useCallback((newLayer: RasterLayer) => {
    setRasterStack((prev) =>
      prev.some((r) => r.file_id === newLayer.file_id) ? prev : [...prev, newLayer],
    );
  }, []);

  // selectLayer is defined after loadDetails — use a ref to avoid forward-reference
  const loadDetailsRef = React.useRef<(fileId: string) => Promise<void>>(async () => {});
  const selectLayer = useCallback((target: RasterLayer) => {
    setLayer(target);
    loadDetailsRef.current(target.file_id);
  }, []);
  const [legendEntriesLoading, setLegendEntriesLoading] = useState(false);

  // ── Task state (owns the WebSocket task lifecycle globally) ───────────────
  const [taskState, setTaskState] = useState<TaskState>(INITIAL_TASK_STATE);

  const geoserverUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;

  // ── Fetch Legend Entries ──────────────────────────────────────────────────
  const fetchLegendEntries = useCallback(async (): Promise<LegendEntry[]> => {
    if (!layer) return [];

    setLegendEntriesLoading(true);
    try {
      const url =
        `${geoserverUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic` +
        `&FORMAT=application/json&LAYER=${encodeURIComponent(layer.layer_name)}`;

      const res = await fetch(url);
      if (!res.ok) {
        setLegendEntries([]);
        return [];
      }

      const json = await res.json();
      const rules: any[] = json?.Legend?.[0]?.rules ?? [];
      const entries: LegendEntry[] = [];

      for (const rule of rules) {
        for (const sym of rule.symbolizers ?? []) {
          const raster = sym.Raster ?? sym.raster;
          if (raster?.colormap?.entries) {
            for (const e of raster.colormap.entries) {
              entries.push({
                label: e.label ?? String(e.quantity ?? ""),
                color: e.color ?? "#cccccc",
                opacity: parseFloat(e.opacity ?? "1"),
              });
            }
            // "ramp" → continuous gradient, anything else → discrete blocks
            const cmType: string = raster.colormap.type ?? "ramp";
            setLegendInterpolation(cmType === "ramp" ? "linear" : "discrete");
            setLegendEntries(entries);
            return entries;
          }
        }
      }

      setLegendEntries(entries);
      return entries;
    } catch {
      setLegendEntries([]);
      return [];
    } finally {
      setLegendEntriesLoading(false);
    }
  }, [layer, geoserverUrl]);

  useEffect(() => {
    if (!sldConfig) return;
    const timer = setTimeout(() => {
      fetchLegendEntries();
    }, 1500);
    return () => clearTimeout(timer);
  }, [sldConfig]);

  // ── When an operation completes, swap the active layer to the output ──────
  useEffect(() => {
    if (taskState.status !== "completed" || !taskState.result) return;

    const { file_id, layer_name, file_name } = taskState.result;
    const resultLayer: RasterLayer = { file_id, layer_name, file_name };
    setLayer(resultLayer);
    addToStack(resultLayer);
    setRasterFileName(file_name);

    // Reload metadata for the new output file
    loadDetailsRef.current(file_id);
  }, [taskState.status, taskState.result, addToStack]);

  const loadDetails = useCallback(async (fileId: string) => {
    setDetailsLoading(true);
    try {
      const resp = await api.get<RasterDetailsApiResponse>(
        `/tools/raster/${fileId}/details`,
      );
      setDetails(
        normaliseRasterDetails(resp.message as RasterDetailsApiResponse),
      );
    } catch(error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }else {
        toast.error("Failed to fetch raster details");
      }
    } finally {
      setDetailsLoading(false);
    }
  }, []);

 
  loadDetailsRef.current = loadDetails;

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const res = await uploadFileInChunks(file, (progress: number) => {
          setUploadProgress(progress);
        });
        const newLayer: RasterLayer = res!.message as RasterLayer;
        setLayer(newLayer);
        addToStack(newLayer);
        setUploading(false);
        setUploadProgress(100);
        toast.success(`"${file.name}" uploaded`);
        setRasterFileName(file.name);
        loadDetails(newLayer.file_id);
      } catch (err) {
        let msg = err instanceof Error ? err.message : "Upload failed";
        if (err instanceof ApiError) {
          msg = err.message;
        }
        setUploading(false);
        setError(msg);
        toast.error(msg);
      }
    },
    [loadDetails],
  );

  const loadVectorDetails = useCallback(async (fileId: string) => {
    setVectorDetailsLoading(true);
    try {
      const resp = await api.get<VectorDetailsApiResponse>(
        `/tools/vector/${fileId}/details`,
      );
      setVectorDetails(
        normaliseVectorDetails(resp.message as VectorDetailsApiResponse),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to fetch vector details");
      }
    } finally {
      setVectorDetailsLoading(false);
    }
  }, []);

  const handleVectorUpload = useCallback(async (file: File): Promise<VectorLayer | null> => {
    setVectorUploading(true);
    setVectorUploadProgress(0);
    try {
      const res = await uploadFileInChunks(file, (progress: number) => {
        setVectorUploadProgress(progress);
      });

      const newLayer: VectorLayer = res!.message as VectorLayer;
      setVectorLayer(newLayer);
      setVectorUploadProgress(100);
      toast.success(`"${file.name}" uploaded`);
      loadVectorDetails(newLayer.file_id);
      return newLayer;
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Upload failed";
      if (err instanceof ApiError) {
        msg = err.message;
      }
      toast.error(msg);
      return null;
    } finally {
      setVectorUploading(false);
    }
  }, [loadVectorDetails]);

  const removeVectorLayer = useCallback(() => {
    setVectorLayer(null);
    setVectorUploadProgress(0);
    setVectorDetails(null);
  }, []);

  // ── Layer actions ─────────────────────────────────────────────────────────
  const removeLayer = useCallback(() => {
    setLayer(null);
    setDetails(null);
    setRasterFileName(null);
    setLegendUrl(null);
    setShowLegend(false);
    setLegendEntries([]);
    setTaskState(INITIAL_TASK_STATE);
  }, []);

  return (
    <Ctx.Provider
      value={{
        uploading,
        uploadProgress,
        layer,
        details,
        detailsLoading,
        operations,
        activeBaseMap,
        wmsOpacity,
        legendUrl,
        showLegend,
        mapLoading,
        isFullscreen,
        sidebarTab,
        sidebarOpen,
        setSldConfig,
        sldConfig,
        legendInterpolation,
        setLegendInterpolation,
        rasterStack,
        addToStack,
        selectLayer,
        setLegendEntries,
        legendEntries,
        legendEntriesLoading,
        fetchLegendEntries,
        error,
        rasterFileName,
        setRasterFileName,
  
        taskState,
        setTaskState,
        handleUpload,
        removeLayer,
        vectorLayer,
        vectorUploading,
        vectorUploadProgress,
        vectorDetails,
        vectorDetailsLoading,
        handleVectorUpload,
        removeVectorLayer,
        setOpacity: setWmsOpacity,
        setLegendUrl,
        setShowLegend,
        setMapLoading,
        setFullscreen: setIsFullscreen,
        setBaseMap: setActiveBaseMap,
        setTab: setSidebarTab,
        setSidebar: setSidebarOpen,
        clearError: () => setError(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}


export function useRaster(): CtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRaster must be inside <RasterProvider>");
  return ctx;
}