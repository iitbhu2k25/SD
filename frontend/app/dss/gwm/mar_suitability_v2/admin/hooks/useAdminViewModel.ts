"use client";

import { toast } from "react-toastify";
import { useAdminUiStore } from "../stores/adminUiStore";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

export function useAdminViewModel() {
  const selectedConditions = useAdminCategoryStore((state) => state.selectedConditions);
  const selectedConstraints = useAdminCategoryStore((state) => state.selectedConstraints);
  const marProcess = useAdminCategoryStore((state) => state.marProcess);
  const tableData = useAdminCategoryStore((state) => state.tableData);
  const categoryLoading = useAdminCategoryStore((state) => state.isLoading);

  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectedSubDistricts = useAdminLocationStore((state) => state.selectedSubDistricts);
  const selectedVillages = useAdminLocationStore((state) => state.selectedVillages);
  
  const selectedVillagesNames = useAdminLocationStore((state) => state.selectedVillagesNames);
  const selectedSubDistrictsNames = useAdminLocationStore((state) => state.selectedSubDistrictsNames);
  const selectedDistrictsNames = useAdminLocationStore((state) => state.selectedDistrictsNames);
  const selectedStateName = useAdminLocationStore((state) => state.selectedStateName);
  const locationLoading = useAdminLocationStore((state) => state.isLoading);

  const runAnalysis = useAdminMapStore((state) => state.runAnalysis);
  const loading = useAdminMapStore((state) => state.loading);
  const isMapLoading = useAdminMapStore((state) => state.isMapLoading);
  const marOperation = useAdminMapStore((state) => state.marOperation);
  const rasterLayerInfo = useAdminMapStore((state) => state.rasterLayerInfo);

  const categoriesEditable = useAdminUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useAdminUiStore((state) => state.isRightPanelOpen);
  const toggleCategoriesEditable = useAdminUiStore((state) => state.toggleCategoriesEditable);
  const setRightPanelOpen = useAdminUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useAdminUiStore((state) => state.toggleRightPanel);

  const handleSubmit = async () => {
    if (selectedConditions.length === 0 && selectedConstraints.length === 0) {
      toast.error("Please select at least one condition or constraint category", {
        position: "top-center",
      });
      return;
    }
    
    await runAnalysis();
  };

  return {
    selectedConditions,
    selectedConstraints,
    marProcess,
    tableData,
    categoryLoading,
    selectionsLocked,
    displayRaster,
    selectedSubDistricts,
    selectedVillages,
    selectedVillagesNames,
    selectedSubDistrictsNames,
    selectedDistrictsNames,
    selectedStateName,
    locationLoading,
    loading,
    isMapLoading,
    marOperation,
    rasterLayerInfo,
    categoriesEditable,
    isRightPanelOpen,
    toggleCategoriesEditable,
    setRightPanelOpen,
    toggleRightPanel,
    handleSubmit,
  };
}
