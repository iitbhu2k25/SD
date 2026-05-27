import type {
  Catchment,
  Category,
  ClipRasters,
  District,
  Drain,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  Stp_area,
  SubDistrict,
  Towns,
  stp_sutability_Output,
} from "@/interface/raster_context";
import type { DataRow } from "@/interface/table";

export type {
  Catchment,
  Category,
  ClipRasters,
  District,
  Drain,
  River,
  SelectRasterLayer,
  State,
  Stretch,
  Stp_area,
  SubDistrict,
  Towns,
  stp_sutability_Output,
  DataRow,
};

export interface SuitabilityCategoryBundle {
  conditionCategories: Category[];
  constraintCategories: Category[];
  areaOptions: Stp_area[];
}

export interface SuitabilityVisualDisplayResult {
  rasterLayers: ClipRasters[];
  vectorLayer: string | null;
}

export interface AdminSuitabilityReferenceData {
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  towns: Towns[];
}

export interface UserSuitabilityReferenceData {
  rivers: River[];
  stretches: Stretch[];
  drains: Drain[];
}

export interface AdminSuitabilityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  village_layer: string;
}

export interface UserSuitabilityAnalysisPayload {
  data: SelectRasterLayer[];
  clip: number[];
  place: "Drain";
  drain_clip: number[];
  village_layer: string;
}

export interface SuitabilityAreaPayload {
  treatment_technology: number;
  mld_capacity: number;
  custom_land_per_mld: number;
  layer_name: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number }[];
  num_clusters?: number;
}

export interface ClusterDrainDistance {
  Drain_No: number;
  distance_m: number;
}

export interface ClusterInfo {
  cluster_rank: number;
  area_ha: number;
  dist_to_polygon_m: number;
  drains: ClusterDrainDistance[];
  /** GeoServer layer name for the road path — pre-computed at Find Suitable Area time */
  path_layer?: string | null;
}

export interface SuitabilityAreaResult {
  cluster_layer: string | null;
  suitable_path: string | null;
  cluster_distances?: ClusterInfo[] | null;
}

export interface ManualFindPathPayload {
  polygon_geojson?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  polygon_layer?: string;
  cluster_layer?: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number }[];
  buffer_bbox?: [number, number, number, number];
}

export interface ManualFindPathResult {
  suitable_path: string | null;
  cluster_distances?: ClusterInfo[] | null;
}

export interface AdminSuitabilityReportPayload {
  table: DataRow[];
  raster: ClipRasters[];
  place: "Admin";
  clip: number[];
  location: {
    state: string;
    districts: string[];
    subDistricts: string[];
    towns: string[];
    population: number;
  };
  weight_data: SelectRasterLayer[];
  non_weight_data: SelectRasterLayer[];
}

export interface UserSuitabilityReportPayload {
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
  non_weight_data: SelectRasterLayer[];
}

export interface ReportTaskResponse {
  task_id: string;
}

export interface ManualAreaConfirmPayload {
  method: "shapefile" | "polygon" | "kml";
  file?: File;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface ManualAreaConfirmResult {
  rasterLayers: ClipRasters[];
  vectorLayer: string | null;
  polygonLayer: string | null;
  centroidLat: number;
  centroidLon: number;
  bufferBbox: [number, number, number, number];
  areaHa: number;
}

export interface ManualSuitabilityAnalysisPayload {
  data: SelectRasterLayer[];
  village_layer: string;
  method: "shapefile" | "polygon" | "kml";
  file?: File;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface ManualCheckConstraintsPayload {
  polygon_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface ManualCheckConstraintsResult {
  constraint_violations: string[];
  can_proceed: boolean;
}

// ── Multi-polygon types (separate from single-file flow) ────────────────────

export interface MultiAreaConfirmSingleResult {
  vector_layer: string;
  polygon_layer: string | null;
  centroid_lat: number;
  centroid_lon: number;
  buffer_bbox: [number, number, number, number];
  area_ha: number;
}

export interface MultiAreaConfirmPayload {
  method: "shapefile" | "kml";
  files: File[];
}

export interface MultiAreaConfirmResponse {
  results: MultiAreaConfirmSingleResult[];
}

export interface MultiFindPathSinglePayload {
  polygon_geojson?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  polygon_layer?: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number }[];
  buffer_bbox?: [number, number, number, number];
}

export interface MultiFindPathPayload {
  polygons: MultiFindPathSinglePayload[];
}

export interface MultiFindPathSingleResult {
  suitable_path: string | null;
  cluster_distances?: ClusterInfo[] | null;
}

export interface MultiFindPathResponse {
  results: MultiFindPathSingleResult[];
}

export interface MultiAreaSinglePayload {
  treatment_technology: number;
  mld_capacity: number;
  custom_land_per_mld: number;
  layer_name: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number }[];
  num_clusters?: number;
}

export interface MultiAreaPayload {
  polygons: MultiAreaSinglePayload[];
}

export interface MultiAreaSingleResult {
  cluster_layer: string | null;
  cluster_distances?: ClusterInfo[] | null;
}

export interface MultiAreaResponse {
  results: MultiAreaSingleResult[];
}

/** One confirmed polygon's full data kept in store */
export interface MultiPolygonEntry {
  index: number;
  vectorLayer: string;
  polygonLayer: string | null;
  centroid: [number, number];
  bufferBbox: [number, number, number, number];
  areaHa: number;
  drainPoints: { Drain_No: number; latitude: number; longitude: number }[];
  selectedDrainNos: number[];
  displayRasters: ClipRasters[];
}
