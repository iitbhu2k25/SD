"use client";

// This collects data from the admin stores in one place.
// It also keeps actions like submit and report in one file for the UI.
import { toast } from "react-toastify";
import { useAdminUiStore } from "../stores/adminUiStore";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { startAdminPriorityReport } from "../../services/stpPriorityApi";

export function useAdminViewModel() {
  const selectedCategories = useAdminCategoryStore((state) => state.selectedCategories);
  const stpProcess = useAdminCategoryStore((state) => state.stpProcess);
  const tableData = useAdminCategoryStore((state) => state.tableData);
  const categoryLoading = useAdminCategoryStore((state) => state.isLoading);

  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectedSubDistricts = useAdminLocationStore((state) => state.selectedSubDistricts);
  const selectedSubDistrictsNames = useAdminLocationStore(
    (state) => state.selectedSubDistrictsNames,
  );
  const selectedDistrictsNames = useAdminLocationStore(
    (state) => state.selectedDistrictsNames,
  );
  const selectedStateName = useAdminLocationStore((state) => state.selectedStateName);
  const locationLoading = useAdminLocationStore((state) => state.isLoading);

  const runAnalysis = useAdminMapStore((state) => state.runAnalysis);
  const loading = useAdminMapStore((state) => state.loading);
  const isMapLoading = useAdminMapStore((state) => state.isMapLoading);
  const stpOperation = useAdminMapStore((state) => state.stpOperation);

  const categoriesEditable = useAdminUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useAdminUiStore((state) => state.isRightPanelOpen);
  const reportLoading = useAdminUiStore((state) => state.reportLoading);
  const isPdfGenerating = useAdminUiStore((state) => state.isPdfGenerating);
  const showPdfStatus = useAdminUiStore((state) => state.showPdfStatus);
  const taskId = useAdminUiStore((state) => state.taskId);
  const toggleCategoriesEditable = useAdminUiStore(
    (state) => state.toggleCategoriesEditable,
  );
  const setRightPanelOpen = useAdminUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useAdminUiStore((state) => state.toggleRightPanel);
  const startReportFlow = useAdminUiStore((state) => state.startReportFlow);
  const setReportTask = useAdminUiStore((state) => state.setReportTask);
  const finishReportRequest = useAdminUiStore((state) => state.finishReportRequest);
  const failReportFlow = useAdminUiStore((state) => state.failReportFlow);
  const completePdfGeneration = useAdminUiStore(
    (state) => state.completePdfGeneration,
  );
  const failPdfGeneration = useAdminUiStore((state) => state.failPdfGeneration);

  const handleSubmit = async () => {
    if (selectedCategories.length < 1) {
      toast.error("Please select at least one category", {
        position: "top-center",
      });
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

      const response = await startAdminPriorityReport({
        table: tableData,
        raster: commonLayers,
        place: "Admin",
        clip: selectedSubDistricts,
        location: {
          state: selectedStateName,
          districts: selectedDistrictsNames,
          subDistricts: selectedSubDistrictsNames,
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
    selectedCategories,
    stpProcess,
    tableData,
    categoryLoading,
    selectionsLocked,
    displayRaster,
    selectedSubDistricts,
    selectedSubDistrictsNames,
    selectedDistrictsNames,
    selectedStateName,
    locationLoading,
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
