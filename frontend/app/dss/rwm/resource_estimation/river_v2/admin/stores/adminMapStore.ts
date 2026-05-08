import { create } from "zustand";
import {
  executeAdminBatchInterpolation,
  executeAdminInterpolation,
} from "../../services/rwmRiverApi";
import { CHART_TO_BACKEND_ATTRIBUTE } from "../../utils/chartFormatters";

interface RunInterpolationParams {
  attribute: string;
  season: string;
  subDistrictCodes: number[];
  riverData: any;
  riverBufferData: any;
  pointsData: any;
}

interface RunBatchInterpolationParams {
  season: string;
  subDistrictCodes: number[];
  riverData: any;
  riverBufferData: any;
  pointsData: any;
}

interface AdminMapState {
  activeRasterLayer: string | null;
  currentInterpolationAttribute: string | null;
  generatedRasterLayers: Record<string, string>;
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
  runBatchInterpolation: (params: RunBatchInterpolationParams) => Promise<Record<string, string>>;
  setActiveRasterAttribute: (attribute: string) => string | null;
  clearInterpolation: () => void;
  resetMapState: () => void;
}

const normalizeLayerMap = (layers: any): Record<string, string> =>
  Object.entries(layers || {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string" && value.trim()) {
      acc[key] = value;
    }
    return acc;
  }, {});

export const useAdminMapStore = create<AdminMapState>((set, get) => ({
  activeRasterLayer: null,
  currentInterpolationAttribute: null,
  generatedRasterLayers: {},
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
        generatedRasterLayers: { [attribute]: layerName },
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
  runBatchInterpolation: async ({
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
      const interpolationPayload = await executeAdminBatchInterpolation({
        subDistrictCodes,
        season,
        attributes: CHART_TO_BACKEND_ATTRIBUTE,
        riverData,
        riverBufferData,
        pointsData,
      });

      const layers = normalizeLayerMap(interpolationPayload?.layers);
      if (interpolationPayload?.status !== "success" || !Object.keys(layers).length) {
        throw new Error(
          interpolationPayload?.message || "Batch interpolation did not return any layers.",
        );
      }

      const primaryAttribute =
        typeof interpolationPayload?.primary_attribute === "string" &&
        layers[interpolationPayload.primary_attribute]
          ? interpolationPayload.primary_attribute
          : layers.wqi
            ? "wqi"
            : Object.keys(layers)[0];

      set({
        generatedRasterLayers: layers,
        activeRasterLayer: layers[primaryAttribute],
        currentInterpolationAttribute: primaryAttribute,
        showInterpolation: true,
        showLegend: true,
        interpolationError: null,
        isMapLayersLoading: false,
      });

      return layers;
    } catch (error: any) {
      const message = error?.message || "Batch interpolation failed.";
      set({ interpolationError: message, isMapLayersLoading: false });
      throw new Error(message);
    }
  },
  setActiveRasterAttribute: (attribute) => {
    const layerName = get().generatedRasterLayers[attribute];
    if (!layerName) {
      set({ interpolationError: "Raster unavailable for this parameter." });
      return null;
    }

    set({
      activeRasterLayer: layerName,
      currentInterpolationAttribute: attribute,
      showInterpolation: true,
      showLegend: true,
      interpolationError: null,
    });
    return layerName;
  },
  clearInterpolation: () => set({
    activeRasterLayer: null,
    currentInterpolationAttribute: null,
    generatedRasterLayers: {},
    interpolationError: null,
    showInterpolation: true,
    showLegend: true,
  }),

  resetMapState: () => set({
    activeRasterLayer: null,
    currentInterpolationAttribute: null,
    generatedRasterLayers: {},
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
