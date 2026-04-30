import { create } from "zustand";
import { executeAdminInterpolation } from "../../services/rwmRiverApi";

interface RunInterpolationParams {
  attribute: string;
  season: string;
  subDistrictCodes: number[];
  riverData: any;
  riverBufferData: any;
  pointsData: any;
}

interface AdminMapState {
  activeRasterLayer: string | null;
  currentInterpolationAttribute: string | null;
  opacity: number;
  hoveredFeature: any | null; // Tooltip logic
  isMapLayersLoading: boolean;
  interpolationError: string | null;
  showLegend: boolean;
  
  // Custom Map Toggles 
  showInterpolation: boolean;
  showPoints: boolean;
  showSubDistrictBoundaries: boolean;
  showRiver: boolean;
  showRiverBuffer: boolean;

  // Actions
  setActiveRasterLayer: (layerName: string | null) => void;
  setOpacity: (opacity: number) => void;
  setHoveredFeature: (feature: any | null) => void;
  setShowInterpolation: (show: boolean) => void;
  setShowPoints: (show: boolean) => void;
  setShowSubDistrictBoundaries: (show: boolean) => void;
  setShowRiver: (show: boolean) => void;
  setShowRiverBuffer: (show: boolean) => void;
  setShowLegend: (show: boolean) => void;
  runInterpolation: (params: RunInterpolationParams) => Promise<string>;
  clearInterpolation: () => void;
  resetMapState: () => void;
}

export const useAdminMapStore = create<AdminMapState>((set) => ({
  activeRasterLayer: null,
  currentInterpolationAttribute: null,
  opacity: 80,
  hoveredFeature: null,
  isMapLayersLoading: false,
  interpolationError: null,
  showLegend: true,
  
  showInterpolation: true,
  showPoints: true,
  showSubDistrictBoundaries: true,
  showRiver: true,
  showRiverBuffer: true,

  setActiveRasterLayer: (layerName) => set({
    activeRasterLayer: layerName,
    showLegend: Boolean(layerName),
  }),
  setOpacity: (opacity) => set({ opacity }),
  setHoveredFeature: (feature) => set({ hoveredFeature: feature }),
  setShowInterpolation: (show) => set({ showInterpolation: show }),
  setShowPoints: (show) => set({ showPoints: show }),
  setShowSubDistrictBoundaries: (show) => set({ showSubDistrictBoundaries: show }),
  setShowRiver: (show) => set({ showRiver: show }),
  setShowRiverBuffer: (show) => set({ showRiverBuffer: show }),
  setShowLegend: (show) => set({ showLegend: show }),
  runInterpolation: async ({
    attribute,
    season,
    subDistrictCodes,
    riverData,
    riverBufferData,
    pointsData,
  }) => {
    if (!subDistrictCodes.length) {
      throw new Error("Select at least one sub-district before interpolation.");
    }
    if (!riverData || !riverBufferData || !pointsData) {
      throw new Error("River, buffer, and water quality data are required for interpolation.");
    }

    set({ isMapLayersLoading: true, interpolationError: null });

    try {
      const interpolationPayload = await executeAdminInterpolation({
        subDistrictCodes,
        season,
        attribute,
        riverData,
        riverBufferData,
        pointsData,
      });

      if (
        interpolationPayload?.status !== "success" ||
        !interpolationPayload?.primary_layer
      ) {
        throw new Error(
          interpolationPayload?.message ||
            `Interpolation did not return a layer for ${attribute}.`,
        );
      }

      const layerName = interpolationPayload.primary_layer as string;
      set({
        activeRasterLayer: layerName,
        currentInterpolationAttribute: attribute,
        showInterpolation: true,
        showLegend: true,
        interpolationError: null,
        isMapLayersLoading: false,
      });
      return layerName;
    } catch (error: any) {
      const message = error?.message || "Interpolation failed.";
      set({ interpolationError: message, isMapLayersLoading: false });
      throw new Error(message);
    }
  },
  clearInterpolation: () => set({
    activeRasterLayer: null,
    currentInterpolationAttribute: null,
    interpolationError: null,
    showInterpolation: true,
    showLegend: true,
  }),

  resetMapState: () => set({
    activeRasterLayer: null,
    currentInterpolationAttribute: null,
    opacity: 80,
    hoveredFeature: null,
    isMapLayersLoading: false,
    interpolationError: null,
    showLegend: true,
    showInterpolation: true,
    showPoints: true,
    showSubDistrictBoundaries: true,
    showRiver: true,
    showRiverBuffer: true,
  })
}));
