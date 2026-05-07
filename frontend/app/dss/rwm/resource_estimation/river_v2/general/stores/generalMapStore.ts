import { create } from "zustand";

interface GeneralMapState {
  selectedBaseMap: string;
  activePanel: string | null;
  opacity: number;
  hoveredFeature: any | null;
  showUploadedLayer: boolean;
  showWqiPoints: boolean;
  showRaster: boolean;
  showLegend: boolean;

  setSelectedBaseMap: (baseMap: string) => void;
  setActivePanel: (panel: string | null) => void;
  setOpacity: (opacity: number) => void;
  setHoveredFeature: (feature: any | null) => void;
  setShowUploadedLayer: (show: boolean) => void;
  setShowWqiPoints: (show: boolean) => void;
  setShowRaster: (show: boolean) => void;
  setShowLegend: (show: boolean) => void;
  resetMapState: () => void;
}

export const useGeneralMapStore = create<GeneralMapState>((set) => ({
  selectedBaseMap: "terrain",
  activePanel: null,
  opacity: 85,
  hoveredFeature: null,
  showUploadedLayer: true,
  showWqiPoints: true,
  showRaster: true,
  showLegend: true,

  setSelectedBaseMap: (baseMap) => set({ selectedBaseMap: baseMap }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setOpacity: (opacity) => set({ opacity }),
  setHoveredFeature: (feature) => set({ hoveredFeature: feature }),
  setShowUploadedLayer: (show) => set({ showUploadedLayer: show }),
  setShowWqiPoints: (show) => set({ showWqiPoints: show }),
  setShowRaster: (show) => set({ showRaster: show }),
  setShowLegend: (show) => set({ showLegend: show }),
  resetMapState: () =>
    set({
      activePanel: null,
      opacity: 85,
      hoveredFeature: null,
      showUploadedLayer: true,
      showWqiPoints: true,
      showRaster: true,
      showLegend: true,
    }),
}));

