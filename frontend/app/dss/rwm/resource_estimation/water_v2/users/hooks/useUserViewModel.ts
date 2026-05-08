// Basin (user) screen orchestration hook.
// Collects values from all user stores and exposes screen-ready state and actions.
import { useCallback } from "react";
import { useUserRiverStore, UserConfirmResult } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserUiStore, UserExportData } from "../stores/userUiStore";
import { toast } from "react-toastify";

export function useUserViewModel() {
  const riverStore = useUserRiverStore();
  const mapStore = useUserMapStore();
  const uiStore = useUserUiStore();

  const isExportReady =
    riverStore.selectionsLocked &&
    mapStore.rasterResponse !== null &&
    (mapStore.rasterResponse?.clipped_rasters?.length ?? 0) > 0;

  const isIndexProduct =
    riverStore.selectedProductType?.toLowerCase() === "index";

  const handleConfirm = useCallback(async () => {
    const result: UserConfirmResult | null = await riverStore.confirmSelections();

    if (!result) {
      toast.error("Confirm failed. Check your selections.");
      return;
    }

    // Push raster result into the map store.
    mapStore.setRasterResponse(result.rasterResult);

    // Build export data and push to UI store.
    const exportData: UserExportData = {
      rasterResult: result.rasterResult,
      river: result.river,
      stretch: result.stretch,
      drain: result.drain,
      riverName: result.riverName,
      year: result.year,
      season: result.season,
      productType: result.productType,
      timeScale: result.timeScale,
    };

    uiStore.setExportData(exportData);
    uiStore.unlockRightPanel();
    toast.success("Data loaded. Ready to export.");
  }, [riverStore, mapStore, uiStore]);

  const handleReset = useCallback(() => {
    riverStore.resetSelections();
    mapStore.resetMapState();
    uiStore.resetUiState();
  }, [riverStore, mapStore, uiStore]);

  const handleYearChange = useCallback(
    (year: number) => {
      mapStore.setActiveYear(year);
    },
    [mapStore],
  );

  return {
    // River state
    selectionsLocked: riverStore.selectionsLocked,
    selectedProductType: riverStore.selectedProductType,
    isLoading: riverStore.isLoading,
    riverError: riverStore.error,

    // Map state
    rasterResponse: mapStore.rasterResponse,
    activeYear: mapStore.activeYear,
    availableYears: mapStore.availableYears,
    rasterLayerInfo: mapStore.rasterLayerInfo,

    // UI state
    exportData: uiStore.exportData,
    reportLoading: uiStore.reportLoading,
    rightPanelUnlocked: uiStore.rightPanelUnlocked,

    // Derived
    isExportReady,
    isIndexProduct,

    // Actions
    handleConfirm,
    handleReset,
    handleYearChange,
  };
}
