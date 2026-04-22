"use client";

import { toast } from "react-toastify";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminUiStore } from "../stores/adminUiStore";

export function useAdminViewModel() {
  const selectedCondition = useAdminCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useAdminCategoryStore((state) => state.selectedConstraint);
  const stpProcess = useAdminCategoryStore((state) => state.stpProcess);
  const tableData = useAdminCategoryStore((state) => state.tableData);
  const categoryLoading = useAdminCategoryStore((state) => state.isLoading);

  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectedVillages = useAdminLocationStore((state) => state.selectedVillages);
  const locationLoading = useAdminLocationStore((state) => state.isLoading);

  const runAnalysis = useAdminMapStore((state) => state.runAnalysis);
  const loading = useAdminMapStore((state) => state.loading);
  const isMapLoading = useAdminMapStore((state) => state.isMapLoading);
  const stpOperation = useAdminMapStore((state) => state.stpOperation);

  const categoriesEditable = useAdminUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useAdminUiStore((state) => state.isRightPanelOpen);
  const toggleCategoriesEditable = useAdminUiStore(
    (state) => state.toggleCategoriesEditable,
  );
  const setRightPanelOpen = useAdminUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useAdminUiStore((state) => state.toggleRightPanel);

  const handleSubmit = async () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", {
        position: "top-center",
      });
      return;
    }

    if (selectedVillages.length < 1) {
      toast.error("Please select at least one village", {
        position: "top-center",
      });
      return;
    }

    await runAnalysis();
  };

  return {
    selectedCondition,
    selectedConstraint,
    stpProcess,
    tableData,
    categoryLoading,
    selectionsLocked,
    displayRaster,
    selectedVillages,
    locationLoading,
    loading,
    isMapLoading,
    stpOperation,
    categoriesEditable,
    isRightPanelOpen,
    toggleCategoriesEditable,
    setRightPanelOpen,
    toggleRightPanel,
    handleSubmit,
  };
}
