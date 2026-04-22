"use client";

import { toast } from "react-toastify";
import { useUserUiStore } from "../stores/userUiStore";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";

export function useUserViewModel() {
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const tableData = useUserCategoryStore((state) => state.tableData);
  const riverLoading = useUserRiverStore((state) => state.isLoading);

  const selectedConditions = useUserCategoryStore((state) => state.selectedConditions);
  const selectedConstraints = useUserCategoryStore((state) => state.selectedConstraints);
  const marProcess = useUserCategoryStore((state) => state.marProcess);
  const categoryLoading = useUserCategoryStore((state) => state.isLoading);

  const runAnalysis = useUserMapStore((state) => state.runAnalysis);
  const loading = useUserMapStore((state) => state.loading);
  const isMapLoading = useUserMapStore((state) => state.isMapLoading);
  const marOperation = useUserMapStore((state) => state.marOperation);
  const rasterLayerInfo = useUserMapStore((state) => state.rasterLayerInfo);

  const categoriesEditable = useUserUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useUserUiStore((state) => state.isRightPanelOpen);
  const toggleCategoriesEditable = useUserUiStore((state) => state.toggleCategoriesEditable);
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useUserUiStore((state) => state.toggleRightPanel);

  const handleSubmit = async () => {
    if (selectedConditions.length === 0 && selectedConstraints.length === 0) {
      toast.error("Please select at least one condition or constraint category", { position: "top-center" });
      return;
    }
    if (selectedCatchments.length < 1) {
      toast.error("Please select at least one catchment", { position: "top-center" });
      return;
    }
    
    await runAnalysis();
  };

  return {
    selectionsLocked,
    tableData,
    riverLoading,
    selectedConditions,
    selectedConstraints,
    marProcess,
    categoryLoading,
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
