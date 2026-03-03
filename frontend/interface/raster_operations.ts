// =============================================================================
// src/types/index.ts  —  Shared types for the entire raster app
// =============================================================================

// ─── Upload & Layer ───────────────────────────────────────────────────────────

export interface RasterLayer {
  file_id: string;
  file_name: string;
  layer_name: string;
  category?: string;
}

export interface UploadResponse {
  success: boolean;
  file_id: string;
  message: RasterLayer[];
}

// ─── Raster Metadata ──────────────────────────────────────────────────────────

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
  bounds: {
    west: number; south: number; east: number; north: number; unit: string;
  };
  bounds_wgs84: {
    west: number; south: number; east: number; north: number; unit: string;
  };
  resolution: {
    x: { value: number; unit: string };
    y: { value: number; unit: string };
  };
  compression: string | null;
  is_tiled: boolean;
  block_shapes: number[][];
  is_cog_like: boolean;
  bands: BandInfo[];
  tags: Record<string, string>;
}

// ─── Raster Operations ────────────────────────────────────────────────────────

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
  id: string;           // local uuid
  type: OperationType;
  status: OperationStatus;
  params: Record<string, unknown>;
  result?: OperationResult;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

// ─── Map / GeoServer ──────────────────────────────────────────────────────────

export interface BaseMapConfig {
  name: string;
  icon: string;
  source: () => unknown;
}

export interface WMSLayerState {
  fileId: string;
  fileName: string;
  layerName: string;  // full: "workspace:name"
  opacity: number;
  visible: boolean;
  legendUrl: string | null;
  showLegend: boolean;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export type RasterPanelTab = "layers" | "basemap" | "details" | "operations";

