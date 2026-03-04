"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "react-toastify";
import { uploadFileInChunks } from "@/utils/chunkUpload";
import {
  RasterDetails,
  RasterLayer,
  OperationType,
  OperationStatus,
  OperationResult,
  Operation,
} from "@/interface/raster_operations";
import { api } from "@/services/api";

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

const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT VALUE
// ─────────────────────────────────────────────────────────────────────────────

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

  setRasterFileName: (name: string | null) => void;

  handleUpload: (file: File) => Promise<void>;
  removeLayer: () => void;
  executeOperation: (type: OperationType, params: Record<string, unknown>) => Promise<void>;
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

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function RasterProvider({ children }: { children: ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [layer, setLayer] = useState<RasterLayer | null>(null);
  const [details, setDetails] = useState<RasterDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [activeBaseMap, setActiveBaseMap] = useState<BaseMapKey>("satellite");
  const [wmsOpacity, setWmsOpacity] = useState(75);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("layers");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rasterFileName, setRasterFileName] = useState<string | null>(null);

  // ── Load details ──────────────────────────────────────────────────────────
  const loadDetails = useCallback(async (fileId: string) => {
    setDetailsLoading(true);
    try {
      const resp = await api.get<RasterDetails>(`/tools/raster/${fileId}/details`);
      if (resp.status > 201) {
        toast.error("Failed to load metadata");
        return;
      }
      setDetails(resp.message);
    } catch {
      toast.error("Failed to load metadata");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File must be ${MAX_FILE_SIZE / 1024 / 1024} MB or less`);
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const res = await uploadFileInChunks(file, (progress: number) => {
          setUploadProgress(progress);
        });

        if (res.status > 201) {
          toast.error("Failed to upload file");
          setUploading(false);
          return;
        }

        const newLayer: RasterLayer = res.data;
        setLayer(newLayer);
        setUploading(false);
        setUploadProgress(100);
        toast.success(`"${file.name}" uploaded`);
        setRasterFileName(file.name);
        loadDetails(newLayer.file_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploading(false);
        setError(msg);
        toast.error(msg);
      }
    },
    [loadDetails],
  );

  // ── Layer actions ─────────────────────────────────────────────────────────
  const removeLayer = useCallback(() => {
    setLayer(null);
    setDetails(null);
    setRasterFileName(null);
    setLegendUrl(null);
    setShowLegend(false);
    toast.info("Layer removed");
  }, []);

  // ── Operations ────────────────────────────────────────────────────────────
  const executeOperation = useCallback(
    async (type: OperationType, params: Record<string, unknown>) => {
      if (!layer) {
        toast.error("Upload a layer first");
        return;
      }

      const op: Operation = {
        id: `op_${Date.now()}`,
        type,
        status: "running",
        params,
        startedAt: Date.now(),
      };

      setOperations((prev) => [...prev, op]);
      toast.info(`Running ${type.replace(/_/g, " ")}…`);

      try {
        const resp = await api.post<OperationResult>("/api/raster/operation", {
          file_id: layer.file_id,
          operation: type,
          params,
        });
        const result = resp.data;

        setOperations((prev) =>
          prev.map((o) =>
            o.id === op.id ? { ...o, status: "success" as OperationStatus, result } : o,
          ),
        );
        toast.success(`${type.replace(/_/g, " ")} completed`);

        if (result.file_id && result.layer_name) {
          const updatedLayer: RasterLayer = {
            file_id: result.file_id,
            file_name: result.file_name,
            layer_name: result.layer_name,
          };
          setLayer(updatedLayer);
          loadDetails(updatedLayer.file_id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Operation failed";
        setOperations((prev) =>
          prev.map((o) =>
            o.id === op.id ? { ...o, status: "error" as OperationStatus, error: msg } : o,
          ),
        );
        toast.error(msg);
      }
    },
    [layer, loadDetails],
  );

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
        error,
        rasterFileName,
        setRasterFileName,
        handleUpload,
        removeLayer,
        executeOperation,
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

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useRaster(): CtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRaster must be inside <RasterProvider>");
  return ctx;
}