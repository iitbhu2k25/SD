export interface RasterLayer {
  file_id: string;
  file_name: string;
  layer_name: string;
  category?: string;
}

export interface ColorStop {
  id: string;
  value: number;
  color: string;
  label?: string;
}

export interface SLDConfig {
  layerName: string;
  colorStops?: ColorStop[];
  interpolation?: "linear" | "discrete";
  opacity: number;
  renderMode?: 'singleband_pseudocolor' | 'singleband_gray';
}

export interface UploadResponse {
  success: boolean;
  file_id: string;
  message: RasterLayer[];
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

// ─── Raw API response shape ───────────────────────────────────────────────────

export interface RasterInfoRaw {
  file_name: string;
  file_id: string;
  layer_name: string;
  raster_type: string;
  modified_at: string;        // ISO datetime string
  id: number;
  parent_id: number | null;
}

export interface LegendEntry {
  label: string;
  color: string;   // hex
  opacity: number; // 0-1
}

export interface RasterMetaRaw {
  file_size: { value: number; unit: string };
  driver: string;
  width: number;
  height: number;
  band_count: number;
  dtypes: string;             // API returns a plain string, not an array
  nodata: string;
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

/** Top-level shape returned by the details endpoint */
export interface RasterDetailsApiResponse {
  raster_info: RasterInfoRaw;
  raster_meta: RasterMetaRaw;
}

// ─── Normalised shape used internally ────────────────────────────────────────

export interface RasterDetails {
  // from raster_info
  file_name: string;
  file_id: string;
  layer_name: string;
  raster_type: string;
  modified_at: string;
  id: number;
  parent_id: number | null;

  // from raster_meta (dtypes normalised to string[])
  file_size: { value: number; unit: string };
  driver: string;
  width: number;
  height: number;
  band_count: number;
  dtypes: string[];          
  nodata: string;
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

export interface UploadComplete extends RasterDetails {
  /* RasterDetails already carries file_id and layer_name */
}

// ─── Helper: normalise raw API response → RasterDetails ──────────────────────

export function normaliseRasterDetails(
  raw: RasterDetailsApiResponse
): RasterDetails {
  const { raster_info: info, raster_meta: meta } = raw;
  return {
    // info fields
    file_name: info.file_name,
    file_id: info.file_id,
    layer_name: info.layer_name,
    raster_type: info.raster_type,
    modified_at: info.modified_at,
    id: info.id,
    parent_id: info.parent_id,

    // meta fields
    file_size: meta.file_size,
    driver: meta.driver,
    width: meta.width,
    height: meta.height,
    band_count: meta.band_count,
    // normalise: API may send "float32" or ["float32"]
    dtypes: Array.isArray(meta.dtypes) ? meta.dtypes : [meta.dtypes],
    nodata: meta.nodata,
    crs: meta.crs,
    crs_unit: meta.crs_unit,
    bounds: meta.bounds,
    bounds_wgs84: meta.bounds_wgs84,
    resolution: meta.resolution,
    compression: meta.compression,
    is_tiled: meta.is_tiled,
    block_shapes: meta.block_shapes,
    is_cog_like: meta.is_cog_like,
    bands: meta.bands,
    tags: meta.tags,
  };
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
  id: string;
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
  layerName: string;
  opacity: number;
  visible: boolean;
  legendUrl: string | null;
  showLegend: boolean;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export type RasterPanelTab = "layers" | "basemap" | "details" | "operations";

export type TaskStatus = "idle" | "submitting" | "pending" | "running" | "completed" | "failed";

export interface TaskLog {
  timestamp: string;
  message: string;
}

export interface TaskResult {
  file_id: string;
  layer_name: string;
  file_name: string;
}

export interface TaskState {
  taskId: string | null;
  status: TaskStatus;
  progress: number;          // 0–100
  logs: TaskLog[];
  result: TaskResult | null;
  error: string | null;
}