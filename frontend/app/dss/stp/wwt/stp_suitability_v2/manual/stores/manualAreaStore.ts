import { create } from "zustand";
import type { ClipRasters } from "../services/manual_stpSuitabilityTypes";

export type AreaInputMethod = "shapefile" | "polygon" | "kml";

export interface DrawnPolygon {
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  label: string;
}

export interface DrainPoint {
  Drain_No: number;
  latitude: number;
  longitude: number;
  Elevation: number;
}

interface ManualAreaStoreState {
  selectedMethod: AreaInputMethod;
  uploadedFile: File | null;
  uploadedFiles: File[];
  drawnPolygon: DrawnPolygon | null;
  drawnPolygons: DrawnPolygon[];
  selectionsLocked: boolean;
  isLoading: boolean;
  error: string | null;
  displayRaster: ClipRasters[];
  selectionVectorLayer: string | null;
  polygonLayer: string | null;
  suitabilityRasterKey: string | null;
  uploadedGeoJsonLayer: string | null;
  areaCentroid: [number, number] | null;
  bufferBbox: [number, number, number, number] | null;
  drainPoints: DrainPoint[];
  selectedDrainNos: number[];
  drainCapacityMld: number | null;
  markedAreaHa: number;
  previewGeojson: GeoJSON.FeatureCollection | null;
  surfaceRadius: number;
}

interface ManualAreaStoreActions {
  setSelectedMethod: (method: AreaInputMethod) => void;
  setUploadedFile: (file: File | null) => void;
  setUploadedFiles: (files: File[]) => void;
  addUploadedFile: (file: File) => void;
  removeUploadedFile: (index: number) => void;
  setDrawnPolygon: (polygon: DrawnPolygon | null) => void;
  addDrawnPolygon: (polygon: DrawnPolygon) => void;
  removeDrawnPolygon: (index: number) => void;
  setDrawnPolygons: (polygons: DrawnPolygon[]) => void;
  confirmSelections: (vectorLayer: string, rasterLayers: ClipRasters[], rasterKey: string, centroid: [number, number], polygonLayer: string, bufferBbox: [number, number, number, number], drainPoints?: DrainPoint[], markedAreaHa?: number) => void;
  unlockSelections: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUploadedGeoJsonLayer: (layer: string | null) => void;
  setSelectedDrainNos: (nos: number[]) => void;
  setDrainCapacityMld: (mld: number | null) => void;
  setPreviewGeojson: (geojson: GeoJSON.FeatureCollection | null) => void;
  setSurfaceRadius: (radius: number) => void;
  reset: () => void;
}

export type ManualAreaStore = ManualAreaStoreState & ManualAreaStoreActions;

const initialState: ManualAreaStoreState = {
  selectedMethod: "shapefile",
  uploadedFile: null,
  uploadedFiles: [],
  drawnPolygon: null,
  drawnPolygons: [],
  selectionsLocked: false,
  isLoading: false,
  error: null,
  displayRaster: [],
  selectionVectorLayer: null,
  polygonLayer: null,
  suitabilityRasterKey: null,
  uploadedGeoJsonLayer: null,
  areaCentroid: null,
  bufferBbox: null,
  drainPoints: [],
  selectedDrainNos: [],
  drainCapacityMld: null,
  markedAreaHa: 0,
  previewGeojson: null,
  surfaceRadius: 5,
};

export const useManualAreaStore = create<ManualAreaStore>((set) => ({
  ...initialState,
  setSelectedMethod: (method) =>
    set({
      selectedMethod: method,
      uploadedFile: null,
      uploadedFiles: [],
      drawnPolygon: null,
      drawnPolygons: [],
      error: null,
    }),
  setUploadedFile: (file) => set({ uploadedFile: file, error: null }),
  setUploadedFiles: (files) => set({ uploadedFiles: files, error: null }),
  addUploadedFile: (file) =>
    set((state) => ({ uploadedFiles: [...state.uploadedFiles, file], error: null })),
  removeUploadedFile: (index) =>
    set((state) => ({ uploadedFiles: state.uploadedFiles.filter((_, i) => i !== index) })),
  setDrawnPolygon: (polygon) => set({ drawnPolygon: polygon, error: null }),
  addDrawnPolygon: (polygon) =>
    set((state) => ({ drawnPolygons: [...state.drawnPolygons, polygon], error: null })),
  removeDrawnPolygon: (index) =>
    set((state) => ({ drawnPolygons: state.drawnPolygons.filter((_, i) => i !== index) })),
  setDrawnPolygons: (polygons) => set({ drawnPolygons: polygons, error: null }),
  confirmSelections: (vectorLayer, rasterLayers, rasterKey, centroid, polygonLayer, bufferBbox, drainPoints = [], markedAreaHa = 0) =>
    set({
      selectionsLocked: true,
      selectionVectorLayer: vectorLayer,
      polygonLayer,
      suitabilityRasterKey: rasterKey,
      displayRaster: rasterLayers,
      areaCentroid: centroid,
      bufferBbox,
      drainPoints,
      selectedDrainNos: [],
      markedAreaHa,
      previewGeojson: null,
      error: null,
    }),
  unlockSelections: () =>
    set({
      selectionsLocked: false,
      selectionVectorLayer: null,
      polygonLayer: null,
      suitabilityRasterKey: null,
      displayRaster: [],
      areaCentroid: null,
      bufferBbox: null,
      drainPoints: [],
      selectedDrainNos: [],
      markedAreaHa: 0,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setUploadedGeoJsonLayer: (uploadedGeoJsonLayer) => set({ uploadedGeoJsonLayer }),
  setSelectedDrainNos: (selectedDrainNos) => set({ selectedDrainNos }),
  setDrainCapacityMld: (drainCapacityMld) => set({ drainCapacityMld }),
  setPreviewGeojson: (previewGeojson) => set({ previewGeojson }),
  setSurfaceRadius: (surfaceRadius) => set({ surfaceRadius }),
  reset: () => set({ ...initialState }),
}));
