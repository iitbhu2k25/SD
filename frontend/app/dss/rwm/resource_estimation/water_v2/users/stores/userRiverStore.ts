// Holds user (basin) river system selection state and workflow actions.
// Replaces DrainContext from contexts/water/users/DrainContext.tsx.
import { create } from "zustand";
import {
  WaterRiver,
  fetchWaterRivers,
  fetchWaterStretches,
  fetchWaterDrains,
  fetchUserWaterRaster,
  WaterRasterResponse,
  UserRasterPayload,
} from "../../services/waterApi";

export type TimeScale = "seasonal" | "yearly" | "";

const USER_RASTER_CACHE_MAX = 24;
const userRasterResultCache = new Map<string, WaterRasterResponse>();
const inFlightUserRasterRequests = new Map<string, Promise<WaterRasterResponse>>();

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
  )
    .sort((a, b) => a - b);
}

function buildUserRasterCacheKey(
  payload: UserRasterPayload,
  selectionContext: { river: number | null; stretch: number | null },
): string {
  const years = normalizeYearSelection(payload.year);
  const season = payload.season ?? "";
  return [
    selectionContext.river ?? "na",
    selectionContext.stretch ?? "na",
    payload.drain_no,
    payload.product_type.trim().toLowerCase(),
    payload.time_scale.trim().toLowerCase(),
    season.trim().toLowerCase(),
    years.join(","),
  ].join("|");
}

function writeUserRasterCache(cacheKey: string, value: WaterRasterResponse): void {
  if (userRasterResultCache.has(cacheKey)) {
    userRasterResultCache.delete(cacheKey);
  }
  userRasterResultCache.set(cacheKey, value);
  while (userRasterResultCache.size > USER_RASTER_CACHE_MAX) {
    const oldestKey = userRasterResultCache.keys().next().value;
    if (!oldestKey) break;
    userRasterResultCache.delete(oldestKey);
  }
}

export interface UserConfirmResult {
  rasterResult: WaterRasterResponse;
  river: number | null;
  stretch: number | null;
  drain: number;
  riverName: string;
  year: number[];
  season: string;
  productType: string;
  timeScale: string;
}

interface UserRiverState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;

  rivers: WaterRiver[];
  allStretchIds: number[];
  allDrainIds: number[];

  selectedRiver: number | null;
  selectedStretch: number | null;
  selectedDrain: number | null;

  timeScale: TimeScale;
  selectedYears: number[];
  selectedSeason: string;
  selectedProductType: string;

  selectionsLocked: boolean;
}

interface UserRiverActions {
  initialize: () => Promise<void>;
  handleRiverChange: (riverCode: number | null) => void;
  setSelectedStretch: (stretchId: number | null) => void;
  setSelectedDrain: (drainNo: number | null) => void;
  setTimeScale: (scale: TimeScale) => void;
  setSelectedYears: (years: number[]) => void;
  setSelectedSeason: (season: string) => void;
  setSelectedProductType: (type: string) => void;
  confirmSelections: () => Promise<UserConfirmResult | null>;
  editSelections: () => void;
  resetSelections: () => void;
}

export type UserRiverStore = UserRiverState & UserRiverActions;

export const useUserRiverStore = create<UserRiverStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,

  rivers: [],
  allStretchIds: [],
  allDrainIds: [],

  selectedRiver: null,
  selectedStretch: null,
  selectedDrain: null,

  timeScale: "",
  selectedYears: [],
  selectedSeason: "",
  selectedProductType: "",

  selectionsLocked: false,

  initialize: async () => {
    if (get().initialized) return;
    set({ isLoading: true, error: null });
    try {
      const rivers = await fetchWaterRivers();
      set({ initialized: true, isLoading: false, rivers });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load rivers",
      });
    }
  },

  handleRiverChange: (riverCode) => {
    set({
      selectedRiver: riverCode,
      selectedStretch: null,
      selectedDrain: null,
      allStretchIds: [],
      allDrainIds: [],
      selectionsLocked: false,
    });

    if (!riverCode) return;

    set({ isLoading: true });
    fetchWaterStretches(riverCode)
      .then((stretchIds) => {
        set({ allStretchIds: stretchIds, isLoading: false });
      })
      .catch((err) => {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load stretches",
        });
      });
  },

  setSelectedStretch: (stretchId) => {
    set({
      selectedStretch: stretchId,
      selectedDrain: null,
      allDrainIds: [],
      selectionsLocked: false,
    });

    if (stretchId === null) return;

    set({ isLoading: true });
    fetchWaterDrains(stretchId)
      .then((drainIds) => {
        set({ allDrainIds: drainIds, isLoading: false });
      })
      .catch((err) => {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load drains",
        });
      });
  },

  setSelectedDrain: (drainNo) => {
    set({ selectedDrain: drainNo, selectionsLocked: false });
  },

  setTimeScale: (scale) => set({ timeScale: scale, selectedSeason: "" }),
  setSelectedYears: (years) => set({ selectedYears: years }),
  setSelectedSeason: (season) => set({ selectedSeason: season }),
  setSelectedProductType: (type) => set({ selectedProductType: type }),

  confirmSelections: async () => {
    const {
      selectedRiver,
      selectedStretch,
      selectedDrain,
      selectedYears,
      selectedSeason,
      selectedProductType,
      timeScale,
      rivers,
    } = get();

    if (
      selectedDrain === null ||
      selectedYears.length === 0 ||
      !selectedProductType ||
      !timeScale ||
      (timeScale === "seasonal" && !selectedSeason)
    ) {
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const normalizedYears = normalizeYearSelection(selectedYears);
      if (normalizedYears.length === 0) {
        set({ isLoading: false });
        return null;
      }

      const payload: UserRasterPayload = {
        drain_no: selectedDrain,
        year: normalizedYears,
        time_scale: timeScale,
        season: timeScale === "seasonal" ? selectedSeason : null,
        product_type: selectedProductType,
      };
      const cacheKey = buildUserRasterCacheKey(payload, {
        river: selectedRiver,
        stretch: selectedStretch,
      });
      const cachedRaster = userRasterResultCache.get(cacheKey);
      const startedAt = Date.now();

      let rasterResult: WaterRasterResponse;
      if (cachedRaster) {
        rasterResult = cachedRaster;
      } else {
        let requestPromise = inFlightUserRasterRequests.get(cacheKey);
        if (!requestPromise) {
          requestPromise = fetchUserWaterRaster(payload);
          inFlightUserRasterRequests.set(cacheKey, requestPromise);
        }

        try {
          rasterResult = await requestPromise;
          writeUserRasterCache(cacheKey, rasterResult);
        } finally {
          inFlightUserRasterRequests.delete(cacheKey);
        }
      }

      const elapsedMs = Date.now() - startedAt;
      console.info(
        `[water_v2][user][confirm] drain=${selectedDrain} years=${normalizedYears.join(",")} cached=${Boolean(cachedRaster)} duration_ms=${elapsedMs}`,
      );

      set({ selectionsLocked: true, isLoading: false });

      const riverName =
        rivers.find((r) => r.River_Code === selectedRiver)?.River_Name ??
        "Unknown River";

      return {
        rasterResult,
        river: selectedRiver,
        stretch: selectedStretch,
        drain: selectedDrain,
        riverName,
        year: normalizedYears,
        season: timeScale === "seasonal" ? selectedSeason : "Yearly",
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
    set({ selectionsLocked: false });
  },

  // Reset is the explicit destructive clear action.
  resetSelections: () => {
    set({
      selectedRiver: null,
      selectedStretch: null,
      selectedDrain: null,
      allStretchIds: [],
      allDrainIds: [],
      timeScale: "",
      selectedYears: [],
      selectedSeason: "",
      selectedProductType: "",
      selectionsLocked: false,
      error: null,
    });
  },
}));
