import { create } from "zustand";
import {
  State,
  District,
  SubDistrict,
  fetchAdminStates,
  fetchAdminDistricts,
  fetchAdminSubDistricts,
  fetchAdminShapefiles,
  fetchAdminIndiaBoundary,
  fetchAdminDistrictBoundaries,
  fetchAdminSubDistrictBoundaries,
  fetchAdminRiverData,
  fetchAdminRiverBuffer,
} from "../../services/rwmRiverApi";

interface AdminLocationState {
  // Cascading Drops
  states: State[];
  districts: District[];
  subDistricts: SubDistrict[];
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];
  
  // Seasonal Selection
  selectedSeason: "premonsoon" | "monsoon" | "postmonsoon" | "";
  selectedYear: "2025" | "";
  
  // Component UI State
  isLoading: boolean;
  error: string | null;
  areaConfirmed: boolean;
  selectionsLocked: boolean;

  // Single season data
  waterQualityData: any | null; // GeoJSON format
  isLoadingWaterQuality: boolean;

  // Multi season data
  seasonalWaterQualityData: {
    premonsoon: any | null;
    monsoon: any | null;
    postmonsoon: any | null;
  };
  isLoadingAllSeasons: boolean;

  // Geospatial Boundaries
  indiaBoundary: any | null;
  stateBoundary: any | null;
  districtBoundaries: any | null;
  subDistrictBoundaries: any | null;
  riverData: any | null;
  riverBufferData: any | null;

  // Actions
  handleStateChange: (stateId: number) => Promise<void>;
  setSelectedDistricts: (districtIds: number[]) => Promise<void>;
  setSelectedSubDistricts: (subDistrictIds: number[]) => Promise<void>;
  setSelectedSeason: (season: "premonsoon" | "monsoon" | "postmonsoon" | "") => void;
  setSelectedYear: (year: "2025" | "") => void;
  
  fetchInitialStates: () => Promise<void>;
  handleAreaConfirm: () => Promise<boolean>;
  resetSelections: () => void;
  clearWaterQualityData: () => void;
  returnToSelection: () => void;
}

const toNumberIds = (items: Array<{ id: string | number }>) =>
  items.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));

export const useAdminLocationStore = create<AdminLocationState>((set, get) => ({
  states: [],
  districts: [],
  subDistricts: [],
  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],
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

  indiaBoundary: null,
  stateBoundary: null,
  districtBoundaries: null,
  subDistrictBoundaries: null,
  riverData: null,
  riverBufferData: null,

  fetchInitialStates: async () => {
    set({ isLoading: true, error: null });
    try {
      const [states, indiaBoundary] = await Promise.all([
        fetchAdminStates(),
        fetchAdminIndiaBoundary().catch(() => null)
      ]);
      set({ states, indiaBoundary, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  handleStateChange: async (stateId: number) => {
    set({
      selectedState: stateId,
      selectedDistricts: [],
      selectedSubDistricts: [],
      districts: [],
      subDistricts: [],
      areaConfirmed: false,
      selectionsLocked: false,
      stateBoundary: null,
      districtBoundaries: null,
      subDistrictBoundaries: null,
      riverData: null,
      riverBufferData: null,
    });
    get().clearWaterQualityData();

    set({ isLoading: true, error: null });
    try {
      const districts = await fetchAdminDistricts(stateId);
      const districtIds = toNumberIds(districts);
      const districtBoundaries = districtIds.length > 0
        ? await fetchAdminDistrictBoundaries(districtIds).catch(() => null)
        : null;
      set({ districts, districtBoundaries, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setSelectedDistricts: async (districtIds: number[]) => {
    set({
      selectedDistricts: districtIds,
      selectedSubDistricts: [],
      subDistricts: [],
      areaConfirmed: false,
      districtBoundaries: null,
      subDistrictBoundaries: null,
      riverData: null,
      riverBufferData: null,
    });
    get().clearWaterQualityData();

    if (districtIds.length === 0) {
      const stateDistrictIds = toNumberIds(get().districts);
      if (stateDistrictIds.length === 0) return;

      set({ isLoading: true, error: null });
      try {
        const districtBoundaries = await fetchAdminDistrictBoundaries(stateDistrictIds).catch(() => null);
        set({ districtBoundaries, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const districts = get().districts;
      const subDistricts = await fetchAdminSubDistricts(districtIds, districts);
      const subDistrictIds = toNumberIds(subDistricts);
      const subDistrictBoundaries = subDistrictIds.length > 0
        ? await fetchAdminSubDistrictBoundaries(subDistrictIds).catch(() => null)
        : null;
      set({ subDistricts, subDistrictBoundaries, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setSelectedSubDistricts: async (subDistrictIds: number[]) => {
    set({
      selectedSubDistricts: subDistrictIds,
      areaConfirmed: false,
      subDistrictBoundaries: null,
      riverData: null,
      riverBufferData: null,
    });
    get().clearWaterQualityData();

    if (subDistrictIds.length === 0) {
      const districtSubDistrictIds = toNumberIds(get().subDistricts);
      if (districtSubDistrictIds.length === 0) return;

      set({ isLoading: true, error: null });
      try {
        const subDistrictBoundaries = await fetchAdminSubDistrictBoundaries(districtSubDistrictIds).catch(() => null);
        set({ subDistrictBoundaries, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const subDistrictBoundaries = await fetchAdminSubDistrictBoundaries(subDistrictIds).catch(() => null);
      set({ subDistrictBoundaries, isLoading: false });
    } catch {
      set({ subDistrictBoundaries: null, isLoading: false });
    }
  },

  setSelectedSeason: (season) => {
    set({ selectedSeason: season });
    // Trigger auto fetch if area is confirmed
    if (get().areaConfirmed) {
      const subs = get().selectedSubDistricts;
      if (subs.length > 0 && season !== "" && get().selectedYear !== "") {
        // Just trigger single season data fetch. All seasons is already fetched on confirm.
        get().handleAreaConfirm(); // this is safe as long as we separate the data streams, but let's just implement a targeted fetch here if needed later.
      }
    }
  },

  setSelectedYear: (year) => {
    set({ selectedYear: year });
  },

  handleAreaConfirm: async () => {
    const { selectedSubDistricts, selectedSeason, selectedYear } = get();
    if (selectedSubDistricts.length === 0 || selectedSeason === "" || selectedYear === "") return false;

    set({ areaConfirmed: true, selectionsLocked: true, isLoadingWaterQuality: true, isLoadingAllSeasons: true });

    try {
      // 1. Fetch single active season
      const [wqiData, riverData, riverBufferData] = await Promise.all([
        fetchAdminShapefiles(selectedSubDistricts, selectedSeason),
        fetchAdminRiverData(selectedSubDistricts).catch(() => null),
        fetchAdminRiverBuffer(selectedSubDistricts).catch(() => null),
      ]);
      set({
        waterQualityData: wqiData,
        riverData,
        riverBufferData,
        isLoadingWaterQuality: false,
      });

      // 2. Fetch all seasons for the comparison charts
      const seasons: ("premonsoon" | "monsoon" | "postmonsoon")[] = ["premonsoon", "monsoon", "postmonsoon"];
      const seasonalData = await Promise.all(
        seasons.map((s) => fetchAdminShapefiles(selectedSubDistricts, s).catch(() => null))
      );
      
      set({
        seasonalWaterQualityData: {
          premonsoon: seasonalData[0],
          monsoon: seasonalData[1],
          postmonsoon: seasonalData[2],
        },
        isLoadingAllSeasons: false,
      });

      return true;
    } catch (err: any) {
      set({ 
        error: `Data fetch failed: ${err.message}`, 
        isLoadingWaterQuality: false, 
        isLoadingAllSeasons: false 
      });
      return false;
    }
  },

  resetSelections: () => {
    set({
      selectedState: null,
      selectedDistricts: [],
      selectedSubDistricts: [],
      selectedSeason: "",
      selectedYear: "",
      areaConfirmed: false,
      selectionsLocked: false,
      error: null,
      stateBoundary: null,
      districtBoundaries: null,
      subDistrictBoundaries: null,
      riverData: null,
      riverBufferData: null,
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
      seasonalWaterQualityData: {
        premonsoon: null,
        monsoon: null,
        postmonsoon: null,
      },
      riverData: null,
      riverBufferData: null,
    });
  },
}));
