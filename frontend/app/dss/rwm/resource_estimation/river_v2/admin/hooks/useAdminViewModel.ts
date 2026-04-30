import { useEffect } from "react";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminUiStore } from "../stores/adminUiStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminChartStore } from "../stores/adminChartStore";

export function useAdminViewModel() {
  const locStore = useAdminLocationStore();
  const uiStore = useAdminUiStore();
  const mapStore = useAdminMapStore();
  const chartStore = useAdminChartStore();

  // Initialization
  useEffect(() => {
    if (locStore.states.length === 0) {
      locStore.fetchInitialStates();
    }
  }, []);

  // Complex Orchestrators
  const handleConfirmArea = async () => {
    const success = await locStore.handleAreaConfirm();
    if (success) {
      uiStore.setRightPanelOpen(true);
      uiStore.showToast("Analysis complete.", "success");
    } else {
      uiStore.showToast("Select sub-district, season, and year before confirming.", "error");
    }
  };

  const handleReset = () => {
    locStore.resetSelections();
    uiStore.setRightPanelOpen(false);
    mapStore.resetMapState();
    chartStore.resetChartState();
  };

  const handleStateSelection = async (stateId: number) => {
    uiStore.setRightPanelOpen(false);
    await locStore.handleStateChange(stateId);
  };

  const handleDistrictSelection = async (districtIds: number[]) => {
    uiStore.setRightPanelOpen(false);
    await locStore.setSelectedDistricts(districtIds);
  };

  return {
    // Stores
    location: locStore,
    ui: uiStore,
    map: mapStore,
    chart: chartStore,
    
    // Orchestrators
    handleConfirmArea,
    handleReset,
    handleStateSelection,
    handleDistrictSelection,
  };
}
