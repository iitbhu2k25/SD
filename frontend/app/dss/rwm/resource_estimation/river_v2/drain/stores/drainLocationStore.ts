import { create } from "zustand";
import {
  Stretch,
  fetchDrainStretches,
  fetchDrainShapefiles,
  fetchDrainLines,
  fetchDrainBuffer,
} from "../../services/rwmRiverApi";

interface DrainLocationState {
  stretches: Stretch[];
  selectedStretches: string[];
  selectedSeason: "premonsoon" | "monsoon" | "postmonsoon" | "";
  selectedYear: "2025" | "";
  
  isLoading: boolean;
  error: string | null;
  areaConfirmed: boolean;
  selectionsLocked: boolean;

  // Single season data
  waterQualityData: any | null; 
  isLoadingWaterQuality: boolean;

  // Multi season data
  seasonalWaterQualityData: {
    premonsoon: any | null;
    monsoon: any | null;
    postmonsoon: any | null;
  };
  isLoadingAllSeasons: boolean;

  // Stretch specific geometries
  stretchLinesData: any | null;
  stretchBufferData: any | null;

  // Actions
  setSelectedStretches: (stretchIds: string[]) => void;
  setSelectedSeason: (season: "premonsoon" | "monsoon" | "postmonsoon" | "") => void;
  setSelectedYear: (year: "2025" | "") => void;
  fetchInitialStretches: () => Promise<void>;
  handleAreaConfirm: () => Promise<boolean>;
  resetSelections: () => void;
  clearWaterQualityData: () => void;
  returnToSelection: () => void;
}

export const useDrainLocationStore = create<DrainLocationState>((set, get) => ({
  stretches: [],
  selectedStretches: [],
  selectedSeason: "",
  selectedYear: "",
  
  isLoading: false,
  error: null,
  areaConfirmed: false,
  selectionsLocked: false,

  waterQualityData: null,
  isLoadingWaterQuality: false,

  seasonalWaterQualityData: {
    premonsoon: null,
    monsoon: null,
    postmonsoon: null,
  },
  isLoadingAllSeasons: false,

  stretchLinesData: null,
  stretchBufferData: null,

  fetchInitialStretches: async () => {
    set({ isLoading: true, error: null });
    try {
      const stretches = await fetchDrainStretches();
      set({ stretches, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setSelectedStretches: (stretchIds: string[]) => {
    set({ selectedStretches: stretchIds, areaConfirmed: false });
    get().clearWaterQualityData();
  },

  setSelectedSeason: (season) => {
    set({ selectedSeason: season });
    if (get().areaConfirmed && get().selectedStretches.length > 0 && season !== "" && get().selectedYear !== "") {
      get().handleAreaConfirm(); 
    }
  },

  setSelectedYear: (year) => {
    set({ selectedYear: year });
  },

  handleAreaConfirm: async () => {
    const { selectedStretches, selectedSeason, selectedYear } = get();
    if (selectedStretches.length === 0 || selectedSeason === "" || selectedYear === "") return false;

    set({ 
      areaConfirmed: true, 
      selectionsLocked: true, 
      isLoadingWaterQuality: true, 
      isLoadingAllSeasons: true 
    });

    try {
      // 1. Fetch Stretch geometries concurrently
      const [lines, buffer] = await Promise.all([
        fetchDrainLines(selectedStretches).catch(() => null),
        fetchDrainBuffer(selectedStretches).catch(() => null),
      ]);
      set({ stretchLinesData: lines, stretchBufferData: buffer });

      // 2. Fetch Active Season WQI
      const wqiData = await fetchDrainShapefiles(selectedStretches, selectedSeason);
      
      // Basic sampling name normalizer matching legacy drain logic
      if (wqiData?.features) {
        wqiData.features = wqiData.features.map((f: any) => {
          const original = f.properties.Sampling || "";
          f.properties.NormalizedSampling = original
            .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
            .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
            .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
            .trim();
          return f;
        });
      }
      
      set({ waterQualityData: wqiData, isLoadingWaterQuality: false });

      // 3. Fetch all seasons for the comparison charts
      const seasons: ("premonsoon" | "monsoon" | "postmonsoon")[] = [
        "premonsoon",
        "monsoon",
        "postmonsoon",
      ];
      const seasonalData = await Promise.all(
        seasons.map(s => fetchDrainShapefiles(selectedStretches, s).catch(() => null))
      );
      
      set({
        seasonalWaterQualityData: {
          premonsoon: seasonalData[0] || null,
          monsoon: seasonalData[1] || null,
          postmonsoon: seasonalData[2] || null,
        },
        isLoadingAllSeasons: false,
      });

      return true;
    } catch (err: any) {
      set({ 
        error: `Drain data fetch failed: ${err.message}`, 
        isLoadingWaterQuality: false, 
        isLoadingAllSeasons: false 
      });
      return false;
    }
  },

  resetSelections: () => {
    set({
      selectedStretches: [],
      selectedSeason: "",
      selectedYear: "",
      areaConfirmed: false,
      selectionsLocked: false,
      error: null,
    });
    get().clearWaterQualityData();
  },

  returnToSelection: () => {
    set({
      areaConfirmed: false,
      selectionsLocked: false,
    });
  },

  clearWaterQualityData: () => {
    set({
      waterQualityData: null,
      stretchLinesData: null,
      stretchBufferData: null,
      seasonalWaterQualityData: {
        premonsoon: null,
        monsoon: null,
        postmonsoon: null,
      },
    });
  },
}));
