"use client";

import { create } from "zustand";
import type { MultiAreaSingleResult, MultiFindPathSingleResult, MultiPolygonEntry } from "../../services/manual_stpSuitabilityTypes";

export interface MultiPolygonResult {
  index: number;
  /** GeoServer layer name for the cluster polygons (DSS) or the polygon itself (non-DSS) */
  clusterLayer: string | null;
  /** GeoServer layer name for the road path (non-DSS only) */
  suitablePath: string | null;
  clusterDistances: import("../../services/manual_stpSuitabilityTypes").ClusterInfo[] | null;
}

interface ManualMultiStoreState {
  /** Files selected for multi-upload (shapefile zips or KML files) */
  uploadedFiles: File[];
  /** Confirmed polygon entries — one per file after confirm */
  polygonEntries: MultiPolygonEntry[];
  /** Per-polygon results after Find Area is run */
  polygonResults: MultiPolygonResult[];
  /** Combined drain capacity for the multi set */
  drainCapacityMld: number | null;
  isLoading: boolean;
  error: string | null;
  selectionsLocked: boolean;
}

interface ManualMultiStoreActions {
  setUploadedFiles: (files: File[]) => void;
  addUploadedFile: (file: File) => void;
  removeUploadedFile: (index: number) => void;
  setPolygonEntries: (entries: MultiPolygonEntry[]) => void;
  updateEntryDrainNos: (index: number, nos: number[]) => void;
  setPolygonResults: (results: MultiPolygonResult[]) => void;
  setDrainCapacityMld: (mld: number | null) => void;
  lockSelections: () => void;
  unlockSelections: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type ManualMultiStore = ManualMultiStoreState & ManualMultiStoreActions;

const initialState: ManualMultiStoreState = {
  uploadedFiles: [],
  polygonEntries: [],
  polygonResults: [],
  drainCapacityMld: null,
  isLoading: false,
  error: null,
  selectionsLocked: false,
};

export const useManualMultiStore = create<ManualMultiStore>((set) => ({
  ...initialState,
  setUploadedFiles: (files) => set({ uploadedFiles: files, error: null }),
  addUploadedFile: (file) =>
    set((state) => ({ uploadedFiles: [...state.uploadedFiles, file], error: null })),
  removeUploadedFile: (index) =>
    set((state) => ({ uploadedFiles: state.uploadedFiles.filter((_, i) => i !== index) })),
  setPolygonEntries: (polygonEntries) => set({ polygonEntries }),
  updateEntryDrainNos: (index, nos) =>
    set((state) => ({
      polygonEntries: state.polygonEntries.map((e) =>
        e.index === index ? { ...e, selectedDrainNos: nos } : e,
      ),
    })),
  setPolygonResults: (polygonResults) => set({ polygonResults }),
  setDrainCapacityMld: (drainCapacityMld) => set({ drainCapacityMld }),
  lockSelections: () => set({ selectionsLocked: true }),
  unlockSelections: () => set({ selectionsLocked: false, polygonEntries: [], polygonResults: [] }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initialState }),
}));
