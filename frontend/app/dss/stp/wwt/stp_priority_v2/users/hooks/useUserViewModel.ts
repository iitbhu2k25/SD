"use client";

import { toast } from "react-toastify";
import { useUserUiStore } from "../stores/userUiStore";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";
import { startUserPriorityReport } from "../../services/stpPriorityApi";

export function useUserViewModel() {
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const selectedRiverName = useUserRiverStore((state) => state.selectedRiverName);
  const selectedStreachNames = useUserRiverStore((state) => state.selectedStreachNames);
  const selectedDrainsNames = useUserRiverStore((state) => state.selectedDrainsNames);
  const selectedCatchmentsNames = useUserRiverStore(
    (state) => state.selectedCatchmentsNames,
  );
  const tableData = useUserRiverStore((state) => state.tableData);
  const riverLoading = useUserRiverStore((state) => state.isLoading);

  const selectedCategories = useUserCategoryStore((state) => state.selectedCategories);
  const stpProcess = useUserCategoryStore((state) => state.stpProcess);
  const categoryLoading = useUserCategoryStore((state) => state.isLoading);

  const runAnalysis = useUserMapStore((state) => state.runAnalysis);
  const loading = useUserMapStore((state) => state.loading);
  const isMapLoading = useUserMapStore((state) => state.isMapLoading);
  const stpOperation = useUserMapStore((state) => state.stpOperation);

  const categoriesEditable = useUserUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useUserUiStore((state) => state.isRightPanelOpen);
  const reportLoading = useUserUiStore((state) => state.reportLoading);
  const isPdfGenerating = useUserUiStore((state) => state.isPdfGenerating);
  const showPdfStatus = useUserUiStore((state) => state.showPdfStatus);
  const taskId = useUserUiStore((state) => state.taskId);
  const toggleCategoriesEditable = useUserUiStore(
    (state) => state.toggleCategoriesEditable,
  );
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useUserUiStore((state) => state.toggleRightPanel);
  const startReportFlow = useUserUiStore((state) => state.startReportFlow);
  const setReportTask = useUserUiStore((state) => state.setReportTask);
  const finishReportRequest = useUserUiStore((state) => state.finishReportRequest);
  const failReportFlow = useUserUiStore((state) => state.failReportFlow);
  const completePdfGeneration = useUserUiStore(
    (state) => state.completePdfGeneration,
  );
  const failPdfGeneration = useUserUiStore((state) => state.failPdfGeneration);

  const handleSubmit = async () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one category", { position: "top-center" });
      return;
    }
    if (selectedCatchments.length < 1) {
      toast.error("Please select at least one catchment", { position: "top-center" });
      return;
    }
    await runAnalysis();
  };

  const handleReport = async () => {
    try {
      startReportFlow();

      const commonLayers = displayRaster.filter(
        (layer) =>
          selectedCategories.some((selected) => selected.file_name === layer.file_name) ||
          layer.file_name === "STP_Priority",
      );

      const response = await startUserPriorityReport({
        table: tableData,
        raster: commonLayers,
        place: "Drain",
        clip: selectedCatchments,
        location: {
          River: selectedRiverName,
          Stretch: selectedStreachNames,
          Drain: selectedDrainsNames,
          Catchment: selectedCatchmentsNames,
        },
        weight_data: selectedCategories,
      });

      if (response.status !== 201 || !response.message?.task_id) {
        toast.error("Failed to start report", { position: "top-center" });
        failReportFlow();
        return;
      }

      toast.success("Report generation started");
      setReportTask(response.message.task_id);
    } catch (_error) {
      toast.error("Failed to start report");
      failReportFlow();
    } finally {
      finishReportRequest();
    }
  };

  return {
    selectionsLocked,
    tableData,
    riverLoading,
    selectedCategories,
    stpProcess,
    categoryLoading,
    loading,
    isMapLoading,
    stpOperation,
    categoriesEditable,
    isRightPanelOpen,
    reportLoading,
    isPdfGenerating,
    showPdfStatus,
    taskId,
    toggleCategoriesEditable,
    setRightPanelOpen,
    toggleRightPanel,
    completePdfGeneration,
    failPdfGeneration,
    handleSubmit,
    handleReport,
  };
}
