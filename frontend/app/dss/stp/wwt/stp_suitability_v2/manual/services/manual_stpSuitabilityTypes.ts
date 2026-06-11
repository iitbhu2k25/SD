import type {
  Category,
  ClipRasters,
  SelectRasterLayer,
  Stp_area,
  stp_sutability_Output,
} from "@/interface/raster_context";
import type { DataRow } from "@/interface/table";

export type { Category, ClipRasters, DataRow, SelectRasterLayer, Stp_area, stp_sutability_Output };

export interface SuitabilityCategoryBundle {
  conditionCategories: Category[];
  constraintCategories: Category[];
  areaOptions: Stp_area[];
}

export interface SuitabilityVisualDisplayResult {
  rasterLayers: ClipRasters[];
  vectorLayer: string | null;
}

export interface SuitabilityAreaPayload {
  treatment_technology: number;
  mld_capacity: number;
  custom_land_per_mld: number;
  layer_name: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number; Elevation: number }[];
  num_clusters?: number;
}

export interface ClusterDrainDistance {
  Drain_No: number;
  distance_m: number;
  elevation?: number;
}

export interface ClusterInfo {
  cluster_rank: number;
  area_ha: number;
  dist_to_polygon_m: number;
  drains: ClusterDrainDistance[];
  /** GeoServer layer name for the road path to this cluster's drains — pre-computed at Find Suitable Area time */
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
  /** When set, backend filters cluster_layer to this specific rank's polygon */
  cluster_rank?: number;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number; Elevation: number }[];
  buffer_bbox?: [number, number, number, number];
}

export interface ManualFindPathResult {
  suitable_path: string | null;
  cluster_distances?: ClusterInfo[] | null;
}

export interface ManualAreaConfirmPayload {
  method: "shapefile" | "polygon" | "kml";
  file?: File;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  bufferRadiusKm?: number;
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

// ── Multi-polygon types ──────────────────────────────────────────────────────

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
  bufferRadiusKm?: number;
}

export interface MultiAreaConfirmResponse {
  results: MultiAreaConfirmSingleResult[];
}

export interface MultiFindPathSinglePayload {
  polygon_geojson?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  polygon_layer?: string;
  location: [number, number][];
  drain_points?: { Drain_No: number; latitude: number; longitude: number; Elevation: number }[];
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
  drain_points?: { Drain_No: number; latitude: number; longitude: number; Elevation: number }[];
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

export interface MultiPolygonEntry {
  index: number;
  vectorLayer: string;
  polygonLayer: string | null;
  centroid: [number, number];
  bufferBbox: [number, number, number, number];
  areaHa: number;
  drainPoints: { Drain_No: number; latitude: number; longitude: number; Elevation: number }[];
  selectedDrainNos: number[];
  displayRasters: ClipRasters[];
}
