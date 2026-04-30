import { useEffect } from "react";
import { useDrainLocationStore } from "../stores/drainLocationStore";
import { useDrainUiStore } from "../stores/drainUiStore";
import { useDrainMapStore } from "../stores/drainMapStore";
import { useDrainChartStore } from "../stores/drainChartStore";

export function useDrainViewModel() {
  const locStore = useDrainLocationStore();
  const uiStore = useDrainUiStore();
  const mapStore = useDrainMapStore();
  const chartStore = useDrainChartStore();

  // Initialization
  useEffect(() => {
    if (locStore.stretches.length === 0) {
      locStore.fetchInitialStretches();
    }
    if (!mapStore.basinData && !mapStore.isMapLayersLoading) {
      mapStore.fetchInitialMapLayers();
    }
  }, []);

  const handleConfirmArea = async () => {
    const success = await locStore.handleAreaConfirm();
    if (success) {
      uiStore.setRightPanelOpen(true);
      uiStore.showToast("River trace and analysis complete.", "success");
    } else {
      uiStore.showToast("Select stretch, season, and year before confirming.", "error");
    }
  };

  const handleReset = () => {
    locStore.resetSelections();
    uiStore.setRightPanelOpen(false);
    mapStore.resetMapState();
    chartStore.resetChartState();
  };

  const handleStretchSelection = (stretchIds: string[]) => {
    uiStore.setRightPanelOpen(false);
    locStore.setSelectedStretches(stretchIds);
  };

  return {
    location: locStore,
    ui: uiStore,
    map: mapStore,
    chart: chartStore,
    
    handleConfirmArea,
    handleReset,
    handleStretchSelection,
  };
}
