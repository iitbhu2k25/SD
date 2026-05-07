import { create } from "zustand";
import {
  executeDrainBatchInterpolation,
  executeDrainInterpolation,
  fetchDrainBasins,
  fetchDrainRiverBuffer,
  fetchDrainRivers,
} from "../../services/rwmRiverApi";
import { CHART_TO_BACKEND_ATTRIBUTE } from "../../utils/chartFormatters";

interface RunDrainInterpolationParams {
  attribute: string;
  season: string;
  stretchIds: string[];
  pointsData: any;
}

interface RunDrainBatchInterpolationParams {
  season: string;
  stretchIds: string[];
  pointsData: any;
}

interface DrainMapState {
  activeRasterLayer: string | null;
  currentInterpolationAttribute: string | null;
  generatedRasterLayers: Record<string, string>;
  opacity: number;
  hoveredFeature: any | null;

  basinData: any | null;
  riverData: any | null;
  riverBufferData: any | null;
  isMapLayersLoading: boolean;
  interpolationError: string | null;
  showLegend: boolean;

  showInterpolation: boolean;
  showPoints: boolean;
  showStretchLines: boolean;
  showStretchBuffer: boolean;
  showBasin: boolean;
  showRiver: boolean;

  fetchInitialMapLayers: () => Promise<void>;
  setActiveRasterLayer: (layerName: string | null) => void;
  setOpacity: (opacity: number) => void;
  setHoveredFeature: (feature: any | null) => void;
  setShowInterpolation: (show: boolean) => void;
  setShowPoints: (show: boolean) => void;
  setShowStretchLines: (show: boolean) => void;
  setShowStretchBuffer: (show: boolean) => void;
  setShowBasin: (show: boolean) => void;
  setShowRiver: (show: boolean) => void;
  setShowLegend: (show: boolean) => void;
  runInterpolation: (params: RunDrainInterpolationParams) => Promise<string>;
  runBatchInterpolation: (params: RunDrainBatchInterpolationParams) => Promise<Record<string, string>>;
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

export const useDrainMapStore = create<DrainMapState>((set, get) => ({
  activeRasterLayer: null,
  currentInterpolationAttribute: null,
  generatedRasterLayers: {},
  opacity: 80,
  hoveredFeature: null,

  basinData: null,
  riverData: null,
  riverBufferData: null,
  isMapLayersLoading: false,
  interpolationError: null,
  showLegend: true,

  showInterpolation: true,
  showPoints: true,
  showStretchLines: true,
  showStretchBuffer: true,
  showBasin: true,
  showRiver: true,

  fetchInitialMapLayers: async () => {
    set({ isMapLayersLoading: true });
    try {
      const [basinData, riverData, riverBufferData] = await Promise.all([
        fetchDrainBasins().catch(() => null),
        fetchDrainRivers().catch(() => null),
        fetchDrainRiverBuffer().catch(() => null),
      ]);
      set({ basinData, riverData, riverBufferData, isMapLayersLoading: false });
    } catch {
      set({ isMapLayersLoading: false });
    }
  },

  setActiveRasterLayer: (layerName) =>
    set({
      activeRasterLayer: layerName,
      showLegend: Boolean(layerName),
    }),
  setOpacity: (opacity) => set({ opacity }),
  setHoveredFeature: (feature) => set({ hoveredFeature: feature }),
  setShowInterpolation: (show) => set({ showInterpolation: show }),
  setShowPoints: (show) => set({ showPoints: show }),
  setShowStretchLines: (show) => set({ showStretchLines: show }),
  setShowStretchBuffer: (show) => set({ showStretchBuffer: show }),
  setShowBasin: (show) => set({ showBasin: show }),
  setShowRiver: (show) => set({ showRiver: show }),
  setShowLegend: (show) => set({ showLegend: show }),

  runInterpolation: async ({ attribute, season, stretchIds, pointsData }) => {
    if (!stretchIds.length) {
      throw new Error("Select at least one stretch before interpolation.");
    }
    if (!pointsData?.features?.length) {
      throw new Error("Water quality point data is required for interpolation.");
    }

    set({ isMapLayersLoading: true, interpolationError: null });

    try {
      const interpolationPayload = await executeDrainInterpolation({
        attribute,
        season,
        stretchIds,
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

  runBatchInterpolation: async ({ season, stretchIds, pointsData }) => {
    if (!stretchIds.length) {
      throw new Error("Select at least one stretch before interpolation.");
    }
    if (!pointsData?.features?.length) {
      throw new Error("Water quality point data is required for interpolation.");
    }

    set({ isMapLayersLoading: true, interpolationError: null });

    try {
      const interpolationPayload = await executeDrainBatchInterpolation({
        stretchIds,
        season,
        attributes: CHART_TO_BACKEND_ATTRIBUTE,
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

  clearInterpolation: () =>
    set({
      activeRasterLayer: null,
      currentInterpolationAttribute: null,
      generatedRasterLayers: {},
      interpolationError: null,
      showInterpolation: true,
      showLegend: true,
    }),

  resetMapState: () =>
    set({
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
      showStretchLines: true,
      showStretchBuffer: true,
      showBasin: true,
      showRiver: true,
    }),
}));
