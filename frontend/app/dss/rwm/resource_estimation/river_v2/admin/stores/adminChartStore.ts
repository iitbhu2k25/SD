import { create } from "zustand";
import {
  buildSeasonalComparisonRows,
  ProcessedWaterQualityData,
  transformGeoJsonToChartData,
} from "../../utils/chartFormatters";
import { useAdminLocationStore } from "./adminLocationStore";

interface AdminChartState {
  selectedAttribute: string;
  processedChartData: ProcessedWaterQualityData[];
  comparisonTableData: any[];

  // Actions
  setSelectedAttribute: (attributeId: string) => void;
  syncFromLocationStore: () => void;
  resetChartState: () => void;
}

export const useAdminChartStore = create<AdminChartState>((set) => ({
  selectedAttribute: "wqi", // Default selected chart
  processedChartData: [],
  comparisonTableData: [],

  setSelectedAttribute: (attributeId) => set({ selectedAttribute: attributeId }),
  
  syncFromLocationStore: () => {
    // This allows syncing directly from the source of truth without contexts
    const locationState = useAdminLocationStore.getState();
    const waterQualityData = locationState.waterQualityData;
    const allSeasonsData = locationState.seasonalWaterQualityData;

    if (!waterQualityData) {
      set({ processedChartData: [], comparisonTableData: [] });
      return;
    }

    // 1. Process primary season data points (which are in GeoJSON format)
    const processedChartData = transformGeoJsonToChartData(waterQualityData);

    const comparisonTableData = allSeasonsData && processedChartData.length > 0
      ? buildSeasonalComparisonRows({
          premonsoon: transformGeoJsonToChartData(allSeasonsData.premonsoon),
          monsoon: transformGeoJsonToChartData(allSeasonsData.monsoon),
          postmonsoon: transformGeoJsonToChartData(allSeasonsData.postmonsoon),
        })
      : [];

    set({ processedChartData, comparisonTableData });
  },

  resetChartState: () => set({
    selectedAttribute: "wqi",
    processedChartData: [],
    comparisonTableData: [],
  })
}));

// Subscribe to location store changes so charts auto-recalculate when new fetch finishes
useAdminLocationStore.subscribe((state, prevState) => {
  if (state.waterQualityData !== prevState.waterQualityData || 
      state.seasonalWaterQualityData !== prevState.seasonalWaterQualityData) {
    useAdminChartStore.getState().syncFromLocationStore();
  }
});
