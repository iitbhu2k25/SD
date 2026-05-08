import { create } from "zustand";
import {
  buildSeasonalComparisonRows,
  ProcessedWaterQualityData,
  transformGeoJsonToChartData,
} from "../../utils/chartFormatters";
import { useDrainLocationStore } from "./drainLocationStore";

interface DrainChartState {
  selectedAttribute: string;
  processedChartData: ProcessedWaterQualityData[];
  comparisonTableData: any[];

  setSelectedAttribute: (attributeId: string) => void;
  syncFromLocationStore: () => void;
  resetChartState: () => void;
}

export const useDrainChartStore = create<DrainChartState>((set) => ({
  selectedAttribute: "wqi", 
  processedChartData: [],
  comparisonTableData: [],

  setSelectedAttribute: (attributeId) => set({ selectedAttribute: attributeId }),
  
  syncFromLocationStore: () => {
    const locationState = useDrainLocationStore.getState();
    const waterQualityData = locationState.waterQualityData;
    const allSeasonsData = locationState.seasonalWaterQualityData;

    if (!waterQualityData) {
      set({ processedChartData: [], comparisonTableData: [] });
      return;
    }

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

useDrainLocationStore.subscribe((state, prevState) => {
  if (state.waterQualityData !== prevState.waterQualityData || 
      state.seasonalWaterQualityData !== prevState.seasonalWaterQualityData) {
    useDrainChartStore.getState().syncFromLocationStore();
  }
});
