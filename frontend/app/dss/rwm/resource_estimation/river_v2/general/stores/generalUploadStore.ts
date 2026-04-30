import { create } from "zustand";

export interface UploadedCsvResult {
  fileLabel: string;
  summary: {
    min: number;
    max: number;
    mean: number;
    countByClass: Record<string, number>;
  };
  validPoints: number;
  rejectedPoints: number;
  missingParameters: string[];
  givenParameters: string[];
  wqiRaster: {
    layerName: string;
    workspace: string;
    parameterLayers?: Record<string, string>;
    rowProfileData?: any[];
  } | null;
  geojson?: any;
}

export interface LayerInfo {
  layerName: string;
  wmsUrl: string;
  wfsUrl: string;
  geometryType: string;
  bufferCreated: boolean;
  featureCount: number;
  bbox: [number, number, number, number] | null;
}

interface GeneralUploadState {
  // Shapefile states
  layerInfo: LayerInfo | null;
  
  // CSV Multi-upload Array
  csvResults: UploadedCsvResult[];
  activeCsvLabel: string | null;
  
  // Filtering & Display State (for the WQI Summary table and map)
  selectedWqiClass: string | null;
  activeParameter: "WQI" | string;
  
  // Actions
  setLayerInfo: (info: LayerInfo | null) => void;
  setCsvResults: (results: UploadedCsvResult[]) => void;
  addCsvResult: (result: UploadedCsvResult) => void;
  setActiveCsvLabel: (label: string | null) => void;
  setSelectedWqiClass: (wqiClass: string | null) => void;
  setActiveParameter: (param: string) => void;
  resetAll: () => void;
}

export const useGeneralUploadStore = create<GeneralUploadState>((set, get) => ({
  layerInfo: null,
  csvResults: [],
  activeCsvLabel: null,
  selectedWqiClass: null,
  activeParameter: "WQI",

  setLayerInfo: (info) => {
    set({ layerInfo: info });
    // Keep csv results if it's an additive workflow, but usually changing shapefile invalidates points.
    // Following old logic: changing shapefile means clearing old points.
    if (!info) {
      set({ csvResults: [], activeCsvLabel: null, activeParameter: "WQI", selectedWqiClass: null });
    }
  },

  setCsvResults: (results) => set({ csvResults: results }),

  addCsvResult: (result) => set((state) => {
    const existingIndex = state.csvResults.findIndex(r => r.fileLabel === result.fileLabel);
    let newResults;
    if (existingIndex >= 0) {
      newResults = [...state.csvResults];
      newResults[existingIndex] = result;
    } else {
      newResults = [...state.csvResults, result];
    }
    return { 
      csvResults: newResults,
      activeCsvLabel: result.fileLabel // Auto-switch to newest
    };
  }),

  setActiveCsvLabel: (label) => set({ activeCsvLabel: label, selectedWqiClass: null }),
  setSelectedWqiClass: (wqiClass) => set({ selectedWqiClass: wqiClass }),
  setActiveParameter: (param) => set({ activeParameter: param }),

  resetAll: () => set({
    layerInfo: null,
    csvResults: [],
    activeCsvLabel: null,
    selectedWqiClass: null,
    activeParameter: "WQI",
  })
}));
