export type GeneralUploadStatus =
  | "idle"
  | "uploading"
  | "generating_raster"
  | "success"
  | "error";

export interface GeneralLayerInfo {
  layerName: string;
  wmsUrl: string;
  wfsUrl: string;
  geometryType: string;
  bufferCreated: boolean;
  featureCount: number;
  bbox: [number, number, number, number] | null;
}

export interface GeneralWqiSummary {
  min: number;
  max: number;
  mean: number;
  countByClass: Record<string, number>;
}

export interface GeneralRasterStatistics {
  min: number;
  max: number;
  mean: number;
  points_used?: number;
}

export interface GeneralRowProfilePoint {
  distance_m: number;
  wqi: number | null;
}

export interface GeneralWqiRasterInfo {
  layerName: string;
  workspace: string;
  styleName?: string;
  statistics?: GeneralRasterStatistics;
  mapImage?: string;
  legendImage?: string;
  profileData?: GeneralRowProfilePoint[];
  profileMeta?: {
    length_m: number;
    step_m: number;
  } | null;
  rowProfileData?: GeneralRowProfilePoint[];
  rowProfileMeta?: {
    rows: number;
    pixel_size_m: number;
    direction: string;
  } | null;
  parameterLayers?: Record<string, string>;
  parameterStatistics?: Record<string, GeneralRasterStatistics>;
}

export interface GeneralCsvUploadResult {
  fileLabel: string;
  sourceFileName: string;
  uploadId: string;
  totalPoints: number;
  validPoints: number;
  rejectedPoints: number;
  geojson: any;
  summary: GeneralWqiSummary | null;
  wqiRaster: GeneralWqiRasterInfo | null;
  givenParameters: string[];
  missingParameters: string[];
}

export interface GeneralCsvFileInput {
  id: string;
  file: File;
  label: string;
}

export interface GeneralCsvEntryState {
  id: string;
  fileName: string;
  label: string;
  status: GeneralUploadStatus;
  error: string | null;
}

export type GeneralRasterDownloadFormat = "tiff" | "png";

