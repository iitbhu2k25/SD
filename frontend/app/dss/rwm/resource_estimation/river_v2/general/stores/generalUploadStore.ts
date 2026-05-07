import { create } from "zustand";
import type {
  GeneralCsvEntryState,
  GeneralCsvUploadResult,
  GeneralLayerInfo,
  GeneralUploadStatus,
} from "../types";

interface GeneralUploadState {
  layerInfo: GeneralLayerInfo | null;
  csvEntries: GeneralCsvEntryState[];
  csvResults: GeneralCsvUploadResult[];
  activeCsvLabel: string | null;
  selectedWqiClass: string | null;
  activeParameter: string;
  shapefileStatus: GeneralUploadStatus;
  csvBatchStatus: GeneralUploadStatus;
  statusMessage: string | null;
  errorMessage: string | null;

  setLayerInfo: (info: GeneralLayerInfo | null) => void;
  setCsvEntries: (entries: GeneralCsvEntryState[]) => void;
  upsertCsvEntry: (entry: GeneralCsvEntryState) => void;
  setCsvEntryStatus: (
    id: string,
    status: GeneralUploadStatus,
    error?: string | null,
  ) => void;
  setCsvResults: (results: GeneralCsvUploadResult[]) => void;
  upsertCsvResult: (result: GeneralCsvUploadResult) => void;
  setActiveCsvLabel: (label: string | null) => void;
  setSelectedWqiClass: (wqiClass: string | null) => void;
  setActiveParameter: (param: string) => void;
  setShapefileStatus: (
    status: GeneralUploadStatus,
    message?: string | null,
    error?: string | null,
  ) => void;
  setCsvBatchStatus: (
    status: GeneralUploadStatus,
    message?: string | null,
    error?: string | null,
  ) => void;
  resetCsvWorkflow: () => void;
  resetAll: () => void;
}

export const useGeneralUploadStore = create<GeneralUploadState>((set) => ({
  layerInfo: null,
  csvEntries: [],
  csvResults: [],
  activeCsvLabel: null,
  selectedWqiClass: null,
  activeParameter: "WQI",
  shapefileStatus: "idle",
  csvBatchStatus: "idle",
  statusMessage: null,
  errorMessage: null,

  setLayerInfo: (info) =>
    set({
      layerInfo: info,
      csvEntries: info ? [] : [],
      csvResults: info ? [] : [],
      activeCsvLabel: null,
      selectedWqiClass: null,
      activeParameter: "WQI",
      errorMessage: null,
    }),

  setCsvEntries: (entries) => set({ csvEntries: entries }),

  upsertCsvEntry: (entry) =>
    set((state) => {
      const existingIndex = state.csvEntries.findIndex((item) => item.id === entry.id);
      if (existingIndex < 0) {
        return { csvEntries: [...state.csvEntries, entry] };
      }
      const csvEntries = [...state.csvEntries];
      csvEntries[existingIndex] = entry;
      return { csvEntries };
    }),

  setCsvEntryStatus: (id, status, error = null) =>
    set((state) => ({
      csvEntries: state.csvEntries.map((entry) =>
        entry.id === id ? { ...entry, status, error } : entry,
      ),
    })),

  setCsvResults: (results) =>
    set((state) => {
      const activeCsvLabel =
        state.activeCsvLabel && results.some((result) => result.fileLabel === state.activeCsvLabel)
          ? state.activeCsvLabel
          : results[0]?.fileLabel || null;
      return {
        csvResults: results,
        activeCsvLabel,
        selectedWqiClass: null,
        activeParameter: "WQI",
      };
    }),

  upsertCsvResult: (result) =>
    set((state) => {
      const existingIndex = state.csvResults.findIndex(
        (item) => item.fileLabel === result.fileLabel,
      );
      const csvResults = [...state.csvResults];
      if (existingIndex >= 0) {
        csvResults[existingIndex] = result;
      } else {
        csvResults.push(result);
      }
      return {
        csvResults,
        activeCsvLabel: result.fileLabel,
        selectedWqiClass: null,
        activeParameter: "WQI",
      };
    }),

  setActiveCsvLabel: (label) =>
    set({ activeCsvLabel: label, selectedWqiClass: null, activeParameter: "WQI" }),

  setSelectedWqiClass: (wqiClass) => set({ selectedWqiClass: wqiClass }),

  setActiveParameter: (param) => set({ activeParameter: param }),

  setShapefileStatus: (status, message = null, error = null) =>
    set({ shapefileStatus: status, statusMessage: message, errorMessage: error }),

  setCsvBatchStatus: (status, message = null, error = null) =>
    set({ csvBatchStatus: status, statusMessage: message, errorMessage: error }),

  resetCsvWorkflow: () =>
    set({
      csvEntries: [],
      csvResults: [],
      activeCsvLabel: null,
      selectedWqiClass: null,
      activeParameter: "WQI",
      csvBatchStatus: "idle",
      statusMessage: null,
      errorMessage: null,
    }),

  resetAll: () =>
    set({
      layerInfo: null,
      csvEntries: [],
      csvResults: [],
      activeCsvLabel: null,
      selectedWqiClass: null,
      activeParameter: "WQI",
      shapefileStatus: "idle",
      csvBatchStatus: "idle",
      statusMessage: null,
      errorMessage: null,
    }),
}));

