"use client";

import { create } from "zustand";
import type { AdminSelectionState, DrainSelectionState, GroundWaterGeoJSON, RsqView } from "../types/rsq.types";

interface RsqStore {
  activeView: RsqView;
  setActiveView: (view: RsqView) => void;
  admin: AdminSelectionState;
  drain: DrainSelectionState;
  analysis: Record<RsqView, {
    selectedYear: string;
    groundWaterData: GroundWaterGeoJSON | null;
    isLoading: boolean;
    error: string | null;
  }>;
  setAdmin: (updater: (state: AdminSelectionState) => AdminSelectionState) => void;
  setDrain: (updater: (state: DrainSelectionState) => DrainSelectionState) => void;
  setAnalysis: (
    view: RsqView,
    updater: (state: { selectedYear: string; groundWaterData: GroundWaterGeoJSON | null; isLoading: boolean; error: string | null }) => {
      selectedYear: string;
      groundWaterData: GroundWaterGeoJSON | null;
      isLoading: boolean;
      error: string | null;
    }
  ) => void;
  clearAnalysis: (view: RsqView) => void;
}

const defaultAdminState: AdminSelectionState = {
  states: [],
  districts: [],
  blocks: [],
  villages: [],
  selectedState: null,
  selectedDistricts: [],
  selectedBlocks: [],
  selectedVillages: [],
  isLoading: false,
  error: null,
};

const defaultDrainState: DrainSelectionState = {
  rivers: [],
  stretches: [],
  drains: [],
  catchments: [],
  villages: [],
  selectedRiver: null,
  selectedStretch: null,
  selectedDrain: null,
  selectedCatchments: [],
  selectedVillages: [],
  selectionsLocked: false,
  areaConfirmed: false,
  isLoading: false,
  error: null,
};

const defaultAnalysis = {
  selectedYear: "",
  groundWaterData: null,
  isLoading: false,
  error: null,
};

export const useRsqStore = create<RsqStore>((set) => ({
  activeView: "admin",
  setActiveView: (activeView) => set({ activeView }),
  admin: defaultAdminState,
  drain: defaultDrainState,
  analysis: {
    admin: { ...defaultAnalysis },
    drain: { ...defaultAnalysis },
  },
  setAdmin: (updater) => set((state) => ({ admin: updater(state.admin) })),
  setDrain: (updater) => set((state) => ({ drain: updater(state.drain) })),
  setAnalysis: (view, updater) =>
    set((state) => ({
      analysis: {
        ...state.analysis,
        [view]: updater(state.analysis[view]),
      },
    })),
  clearAnalysis: (view) =>
    set((state) => ({
      analysis: {
        ...state.analysis,
        [view]: { ...defaultAnalysis },
      },
    })),
}));
