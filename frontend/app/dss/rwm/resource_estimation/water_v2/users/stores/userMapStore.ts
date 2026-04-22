// Holds user (basin) map and raster display state.
// Replaces DrainMapContext from contexts/water/users/DrainMapContext.tsx.
import { create } from "zustand";
import { WaterRasterLayer, WaterRasterResponse } from "../../services/waterApi";

interface UserMapState {
  rasterResponse: WaterRasterResponse | null;
  activeYear: number | null;
  availableYears: number[];
  rasterLayerInfo: WaterRasterLayer | null;
  catchmentLayerName: string | null;
  legendVisible: boolean;
  rasterOpacity: number;
  isMapLoading: boolean;
}

interface UserMapActions {
  setRasterResponse: (response: WaterRasterResponse | null) => void;
  setActiveYear: (year: number) => void;
  setRasterLayerInfo: (layer: WaterRasterLayer | null) => void;
  setCatchmentLayerName: (name: string | null) => void;
  setLegendVisible: (visible: boolean) => void;
  setRasterOpacity: (opacity: number) => void;
  resetMapState: () => void;
}

export type UserMapStore = UserMapState & UserMapActions;

export const useUserMapStore = create<UserMapStore>((set, get) => ({
  rasterResponse: null,
  activeYear: null,
  availableYears: [],
  rasterLayerInfo: null,
  catchmentLayerName: null,
  legendVisible: true,
  rasterOpacity: 1,
  isMapLoading: false,

  setRasterResponse: (response) => {
    if (!response) {
      set({
        rasterResponse: null,
        activeYear: null,
        availableYears: [],
        rasterLayerInfo: null,
      });
      return;
    }

    const yearSet = new Set<number>(response.clipped_rasters.map((r) => r.year));
    const availableYears = Array.from(yearSet).sort((a, b) => a - b);
    const defaultYear = availableYears[0] ?? null;
    const firstRaster =
      response.clipped_rasters.find((r) => r.year === defaultYear) ??
      response.clipped_rasters[0] ??
      null;

    set({
      rasterResponse: response,
      availableYears,
      activeYear: defaultYear,
      rasterLayerInfo: firstRaster,
    });
  },

  setActiveYear: (year) => {
    const { rasterResponse } = get();
    if (!rasterResponse) return;
    const raster =
      rasterResponse.clipped_rasters.find((r) => r.year === year) ?? null;
    set({ activeYear: year, rasterLayerInfo: raster });
  },

  setRasterLayerInfo: (layer) => set({ rasterLayerInfo: layer }),
  setCatchmentLayerName: (name) => set({ catchmentLayerName: name }),
  setLegendVisible: (visible) => set({ legendVisible: visible }),
  setRasterOpacity: (opacity) => set({ rasterOpacity: opacity }),

  resetMapState: () => {
    set({
      rasterResponse: null,
      activeYear: null,
      availableYears: [],
      rasterLayerInfo: null,
      catchmentLayerName: null,
      legendVisible: true,
      rasterOpacity: 1,
      isMapLoading: false,
    });
  },
}));
