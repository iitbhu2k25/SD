"use client";

import { toast } from "react-toastify";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserUiStore } from "../stores/userUiStore";

export function useUserViewModel() {
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const riverLoading = useUserRiverStore((state) => state.isLoading);
  const riverError = useUserRiverStore((state) => state.error);

  const selectedCondition = useUserCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useUserCategoryStore((state) => state.selectedConstraint);
  const pumpingProcess = useUserCategoryStore((state) => state.pumpingProcess);
  const tableData = useUserCategoryStore((state) => state.tableData);
  const categoryLoading = useUserCategoryStore((state) => state.isLoading);

  const runAnalysis = useUserMapStore((state) => state.runAnalysis);
  const loading = useUserMapStore((state) => state.loading);
  const isMapLoading = useUserMapStore((state) => state.isMapLoading);
  const pumpingOperation = useUserMapStore((state) => state.pumpingOperation);

  const categoriesEditable = useUserUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useUserUiStore((state) => state.isRightPanelOpen);
  const toggleCategoriesEditable = useUserUiStore(
    (state) => state.toggleCategoriesEditable,
  );
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useUserUiStore((state) => state.toggleRightPanel);

  const handleSubmit = async () => {
    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", {
        position: "top-center",
      });
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
    displayRaster,
    selectedCatchments,
    tableData,
    riverLoading,
    riverError,
    selectedCondition,
    selectedConstraint,
    pumpingProcess,
    categoryLoading,
    loading,
    isMapLoading,
    pumpingOperation,
    categoriesEditable,
    isRightPanelOpen,
    toggleCategoriesEditable,
    setRightPanelOpen,
    toggleRightPanel,
    handleSubmit,
  };
}
