// Admin screen orchestration hook.
// Collects values from all admin stores and exposes screen-ready state and actions.
import { useCallback } from "react";
import { useAdminLocationStore, AdminConfirmResult } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminUiStore, AdminExportData } from "../stores/adminUiStore";
import { toast } from "react-toastify";

export function useAdminViewModel() {
  const locationStore = useAdminLocationStore();
  const mapStore = useAdminMapStore();
  const uiStore = useAdminUiStore();

  const isExportReady =
    locationStore.selectionsLocked &&
    mapStore.rasterResponse !== null &&
    (mapStore.rasterResponse?.clipped_rasters?.length ?? 0) > 0;

  const isIndexProduct =
    locationStore.selectedProductType?.toLowerCase() === "index";

  const handleConfirm = useCallback(async () => {
    const result: AdminConfirmResult | null =
      await locationStore.confirmSelections();

    if (!result) {
      toast.error("Confirm failed. Check your selections.");
      return;
    }

    // Push raster result into the map store.
    mapStore.setRasterResponse(result.rasterResult);

    // Build export data and push to UI store.
    const exportData: AdminExportData = {
      rasterResult: result.rasterResult,
      subDistrictCodes: result.subDistrictCodes,
      stateName: result.stateName,
      districtNames: result.districtNames,
      subDistrictNames: result.subDistrictNames,
      year: result.year,
      season: result.season,
      productType: result.productType,
      timeScale: result.timeScale,
    };

    uiStore.setExportData(exportData);
    uiStore.unlockRightPanel();
    toast.success("Raster data loaded successfully.");
  }, [locationStore, mapStore, uiStore]);

  const handleReset = useCallback(() => {
    locationStore.resetSelections();
    mapStore.resetMapState();
    uiStore.resetUiState();
  }, [locationStore, mapStore, uiStore]);

  const handleEdit = useCallback(() => {
    locationStore.editSelections();
    // Clear stale raster/export context so the next confirm always reflects new selection.
    mapStore.resetMapState();
    uiStore.resetUiState();
  }, [locationStore, mapStore, uiStore]);

  const handleYearChange = useCallback(
    (year: number) => {
      mapStore.setActiveYear(year);
    },
    [mapStore],
  );

  return {
    // Location state
    selectionsLocked: locationStore.selectionsLocked,
    selectedProductType: locationStore.selectedProductType,
    isLoading: locationStore.isLoading,
    locationError: locationStore.error,

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
    handleEdit,
    handleReset,
    handleYearChange,
  };
}
