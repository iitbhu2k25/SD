// Holds admin location selection state and all selection workflow actions.
// Replaces LocationContext from contexts/water/admin/LocationContext.tsx.
import { create } from "zustand";
import {
  WaterState,
  WaterDistrict,
  WaterSubDistrict,
  fetchWaterStates,
  fetchWaterDistricts,
  fetchWaterSubDistricts,
  fetchAdminWaterRaster,
  WaterRasterResponse,
  AdminRasterPayload,
} from "../../services/waterApi";

export type TimeScale = "seasonal" | "yearly" | "";

export interface AdminConfirmResult {
  rasterResult: WaterRasterResponse;
  subDistrictCodes: number[];
  stateName: string;
  districtNames: string[];
  subDistrictNames: string[];
  year: number[];
  season: string;
  productType: string;
  timeScale: string;
}

interface AdminLocationState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Reference lists
  allStates: WaterState[];
  allDistricts: WaterDistrict[];
  allSubDistricts: WaterSubDistrict[];

  // Filtered lists (derived from selection)
  states: WaterState[];
  districts: WaterDistrict[];
  subDistricts: WaterSubDistrict[];

  // Selections
  selectedState: number | null;
  selectedDistricts: number[];
  selectedSubDistricts: number[];

  // Query parameters
  timeScale: TimeScale;
  selectedYears: number[];
  selectedSeason: string;
  selectedProductType: string;
  yearSeasonLocked: boolean;

  // Workflow state
  selectionsLocked: boolean;

  // Derived display names
  selectedStateName: string;
  selectedDistrictsNames: string[];
  selectedSubDistrictsNames: string[];
}

interface AdminLocationActions {
  initialize: () => Promise<void>;
  handleStateChange: (stateId: number | null) => void;
  setSelectedDistricts: (districtIds: number[]) => void;
  setSelectedSubDistricts: (subDistrictIds: number[]) => void;
  setTimeScale: (scale: TimeScale) => void;
  setSelectedYears: (years: number[]) => void;
  setSelectedSeason: (season: string) => void;
  setSelectedProductType: (type: string) => void;
  confirmSelections: () => Promise<AdminConfirmResult | null>;
  editSelections: () => void;
  resetSelections: () => void;
}

export type AdminLocationStore = AdminLocationState & AdminLocationActions;

function normalizeYearSelection(years: number[]): number[] {
  return Array.from(
    new Set(
      years
        .map((value) => Number(value))
        .filter(
          (value) =>
            Number.isFinite(value) &&
            Number.isInteger(value) &&
            value >= 1900 &&
            value <= 2100,
        ),
    ),
  ).sort((a, b) => a - b);
}

function normalizeSubDistrictSelection(subDistrictIds: number[]): number[] {
  return Array.from(
    new Set(
      subDistrictIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && Number.isInteger(value) && value > 0),
    ),
  ).sort((a, b) => a - b);
}

function deriveNames(
  allStates: WaterState[],
  allDistricts: WaterDistrict[],
  allSubDistricts: WaterSubDistrict[],
  selectedState: number | null,
  selectedDistricts: number[],
  selectedSubDistricts: number[],
) {
  return {
    selectedStateName:
      allStates.find((s) => s.id === selectedState)?.name ?? "",
    selectedDistrictsNames: allDistricts
      .filter((d) => selectedDistricts.includes(d.id))
      .map((d) => d.name),
    selectedSubDistrictsNames: allSubDistricts
      .filter((sd) => selectedSubDistricts.includes(sd.id))
      .map((sd) => sd.name),
  };
}

export const useAdminLocationStore = create<AdminLocationStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,

  allStates: [],
  allDistricts: [],
  allSubDistricts: [],
  states: [],
  districts: [],
  subDistricts: [],

  selectedState: null,
  selectedDistricts: [],
  selectedSubDistricts: [],

  timeScale: "",
  selectedYears: [],
  selectedSeason: "",
  selectedProductType: "",
  yearSeasonLocked: false,

  selectionsLocked: false,

  selectedStateName: "",
  selectedDistrictsNames: [],
  selectedSubDistrictsNames: [],

  initialize: async () => {
    if (get().initialized) return;
    set({ isLoading: true, error: null });
    try {
      const states = await fetchWaterStates();
      set({ initialized: true, isLoading: false, allStates: states, states });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load states",
      });
    }
  },

  handleStateChange: (stateId) => {
    const { allStates, allDistricts, allSubDistricts } = get();
    const names = deriveNames(allStates, allDistricts, allSubDistricts, stateId, [], []);
    set({
      selectedState: stateId,
      selectedDistricts: [],
      selectedSubDistricts: [],
      districts: [],
      subDistricts: [],
      selectionsLocked: false,
      yearSeasonLocked: false,
      ...names,
    });

    if (!stateId) return;

    set({ isLoading: true });
    fetchWaterDistricts(stateId)
      .then((districts) => {
        set({
          allDistricts: districts,
          districts,
          isLoading: false,
        });
      })
      .catch((err) => {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load districts",
        });
      });
  },

  setSelectedDistricts: (districtIds) => {
    const { allStates, allDistricts, allSubDistricts, selectedState } = get();
    const names = deriveNames(
      allStates,
      allDistricts,
      allSubDistricts,
      selectedState,
      districtIds,
      [],
    );
    set({
      selectedDistricts: districtIds,
      selectedSubDistricts: [],
      subDistricts: [],
      selectionsLocked: false,
      yearSeasonLocked: false,
      ...names,
    });

    if (districtIds.length === 0) return;

    set({ isLoading: true });
    fetchWaterSubDistricts(districtIds)
      .then((subDistricts) => {
        set({ allSubDistricts: subDistricts, subDistricts, isLoading: false });
      })
      .catch((err) => {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load sub-districts",
        });
      });
  },

  setSelectedSubDistricts: (subDistrictIds) => {
    const { allStates, allDistricts, allSubDistricts, selectedState, selectedDistricts } =
      get();
    const names = deriveNames(
      allStates,
      allDistricts,
      allSubDistricts,
      selectedState,
      selectedDistricts,
      subDistrictIds,
    );
    set({ selectedSubDistricts: subDistrictIds, selectionsLocked: false, ...names });
  },

  setTimeScale: (scale) => set({ timeScale: scale, selectedSeason: "" }),
  setSelectedYears: (years) =>
    set({ selectedYears: normalizeYearSelection(years) }),
  setSelectedSeason: (season) => set({ selectedSeason: season }),
  setSelectedProductType: (type) => set({ selectedProductType: type }),

  confirmSelections: async () => {
    const {
      selectedSubDistricts,
      selectedYears,
      selectedSeason,
      selectedProductType,
      timeScale,
      selectedStateName,
      selectedDistrictsNames,
      selectedSubDistrictsNames,
    } = get();

    if (
      selectedSubDistricts.length === 0 ||
      selectedYears.length === 0 ||
      !selectedProductType ||
      !timeScale ||
      (timeScale === "seasonal" && !selectedSeason)
    ) {
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const normalizedSubDistricts = normalizeSubDistrictSelection(selectedSubDistricts);
      const normalizedYears = normalizeYearSelection(selectedYears);

      if (normalizedSubDistricts.length === 0 || normalizedYears.length === 0) {
        set({ isLoading: false });
        return null;
      }

      const payload: AdminRasterPayload = {
        subdistrict_codes: normalizedSubDistricts,
        year: normalizedYears,
        season: timeScale === "yearly" ? "Yearly" : selectedSeason,
        product_type: selectedProductType,
        time_scale: timeScale,
      };

      const rasterResult = await fetchAdminWaterRaster(payload);

      set({ selectionsLocked: true, yearSeasonLocked: true, isLoading: false });

      return {
        rasterResult,
        subDistrictCodes: [...normalizedSubDistricts],
        stateName: selectedStateName,
        districtNames: [...selectedDistrictsNames],
        subDistrictNames: [...selectedSubDistrictsNames],
        year: [...normalizedYears],
        season: timeScale === "yearly" ? "Yearly" : selectedSeason,
        productType: selectedProductType,
        timeScale,
      };
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch raster data",
      });
      return null;
    }
  },

  // Edit reopens the workflow without clearing current values (standard rule).
  editSelections: () => {
    set({ selectionsLocked: false, yearSeasonLocked: false });
  },

  // Reset is the explicit destructive clear action.
  resetSelections: () => {
    set({
      selectedState: null,
      selectedDistricts: [],
      selectedSubDistricts: [],
      districts: [],
      subDistricts: [],
      timeScale: "",
      selectedYears: [],
      selectedSeason: "",
      selectedProductType: "",
      yearSeasonLocked: false,
      selectionsLocked: false,
      selectedStateName: "",
      selectedDistrictsNames: [],
      selectedSubDistrictsNames: [],
      error: null,
    });
  },
}));
