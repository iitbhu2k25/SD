"use client";

import { toast } from "react-toastify";
import {
  findSuitabilityAreaCluster,
  startAdminSuitabilityReport,
} from "../../services/stpSuitabilityApi";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminUiStore } from "../stores/adminUiStore";

interface TreatmentSubmitValues {
  areaId: number | null;
  mldCapacity: number;
  customLand: number;
}

export function useAdminViewModel() {
  const conditionCategories = useAdminCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useAdminCategoryStore((state) => state.constraintCategories);
  const areaOptions = useAdminCategoryStore((state) => state.areaOptions);
  const selectedCondition = useAdminCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useAdminCategoryStore((state) => state.selectedConstraint);
  const selectedAreaOption = useAdminCategoryStore((state) => state.selectedAreaOption);
  const tableData = useAdminCategoryStore((state) => state.tableData);
  const categoryLoading = useAdminCategoryStore((state) => state.isLoading);
  const categoryError = useAdminCategoryStore((state) => state.error);
  const toggleConditionCategory = useAdminCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useAdminCategoryStore(
    (state) => state.toggleConstraintCategory,
  );
  const updateConditionCategoryInfluence = useAdminCategoryStore(
    (state) => state.updateConditionCategoryInfluence,
  );
  const selectAllConditionCategories = useAdminCategoryStore(
    (state) => state.selectAllConditionCategories,
  );
  const clearAllConditionCategories = useAdminCategoryStore(
    (state) => state.clearAllConditionCategories,
  );
  const selectAllConstraintCategories = useAdminCategoryStore(
    (state) => state.selectAllConstraintCategories,
  );
  const clearAllConstraintCategories = useAdminCategoryStore(
    (state) => state.clearAllConstraintCategories,
  );
  const setSelectedAreaOption = useAdminCategoryStore((state) => state.setSelectedAreaOption);

  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  // Keep these selection labels in state for report payloads even when the UI summary card is hidden.
  const selectedStateName = useAdminLocationStore((state) => state.selectedStateName);
  const selectedDistrictsNames = useAdminLocationStore((state) => state.selectedDistrictsNames);
  const selectedSubDistrictsNames = useAdminLocationStore(
    (state) => state.selectedSubDistrictsNames,
  );
  const selectedTownsNames = useAdminLocationStore((state) => state.selectedTownsNames);
  const selectedVillages = useAdminLocationStore((state) => state.selectedVillages);
  const selectedTowns = useAdminLocationStore((state) => state.selectedTowns);
  const totalPopulation = useAdminLocationStore((state) => state.totalPopulation);
  const locationLoading = useAdminLocationStore((state) => state.isLoading);
  const locationError = useAdminLocationStore((state) => state.error);

  const runAnalysis = useAdminMapStore((state) => state.runAnalysis);
  const setResultVectorLayer = useAdminMapStore((state) => state.setResultVectorLayer);
  const loading = useAdminMapStore((state) => state.loading);
  const isMapLoading = useAdminMapStore((state) => state.isMapLoading);
  const stpOperation = useAdminMapStore((state) => state.stpOperation);
  const mapError = useAdminMapStore((state) => state.error);

  const categoriesEditable = useAdminUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useAdminUiStore((state) => state.isRightPanelOpen);
  const reportLoading = useAdminUiStore((state) => state.reportLoading);
  const treatmentLoading = useAdminUiStore((state) => state.treatmentLoading);
  const isPdfGenerating = useAdminUiStore((state) => state.isPdfGenerating);
  const showPdfStatus = useAdminUiStore((state) => state.showPdfStatus);
  const taskId = useAdminUiStore((state) => state.taskId);
  const toggleCategoriesEditable = useAdminUiStore((state) => state.toggleCategoriesEditable);
  const setRightPanelOpen = useAdminUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useAdminUiStore((state) => state.toggleRightPanel);
  const startReportFlow = useAdminUiStore((state) => state.startReportFlow);
  const setReportTask = useAdminUiStore((state) => state.setReportTask);
  const finishReportRequest = useAdminUiStore((state) => state.finishReportRequest);
  const failReportFlow = useAdminUiStore((state) => state.failReportFlow);
  const completePdfGeneration = useAdminUiStore((state) => state.completePdfGeneration);
  const failPdfGeneration = useAdminUiStore((state) => state.failPdfGeneration);
  const setTreatmentLoading = useAdminUiStore((state) => state.setTreatmentLoading);

  const handleSubmit = async () => {
    if (selectedTowns.length < 1) {
      toast.error("Please select and confirm at least one town", {
        position: "top-center",
      });
      return;
    }

    if (selectedCondition.length < 1) {
      toast.error("Please select at least one condition category", {
        position: "top-center",
      });
      return;
    }

    await runAnalysis();
  };

  const handleTreatmentSubmit = async ({
    areaId,
    mldCapacity,
    customLand,
  }: TreatmentSubmitValues) => {
    const selectedTechnology =
      areaId === null ? null : areaOptions.find((option) => option.id === areaId) ?? null;
    const suitabilityLayer = displayRaster.find(
      (option) => option.file_name === "STP_Suitability",
    )?.layer_name;

    if (!selectedTechnology) {
      toast.error("Please select a treatment technology");
      return;
    }

    if (!suitabilityLayer) {
      toast.error("Run suitability analysis before finding treatment clusters");
      return;
    }

    setSelectedAreaOption(selectedTechnology.id);
    setTreatmentLoading(true);

    try {
      const vectorLayer = await findSuitabilityAreaCluster({
        TREATMENT_TECHNOLOGY: selectedTechnology.id,
        MLD_CAPACITY: mldCapacity,
        CUSTOM_LAND_PER_MLD: customLand,
        layer_name: suitabilityLayer,
      });

      if (!vectorLayer) {
        toast.error("No treatment cluster found for the current configuration");
        return;
      }

      setResultVectorLayer(vectorLayer);
      toast.success("Treatment cluster located");
    } catch (_error) {
      toast.error("Failed to find treatment cluster");
    } finally {
      setTreatmentLoading(false);
    }
  };

  const handleReport = async () => {
    if (tableData.length === 0) {
      toast.error("Run suitability analysis before generating a report");
      return;
    }

    try {
      startReportFlow();

      const response = await startAdminSuitabilityReport({
        table: tableData,
        raster: displayRaster,
        place: "Admin",
        clip: selectedVillages,
        location: {
          state: selectedStateName,
          districts: selectedDistrictsNames,
          subDistricts: selectedSubDistrictsNames,
          towns: selectedTownsNames,
          population: totalPopulation,
        },
        weight_data: selectedCondition,
        non_weight_data: selectedConstraint,
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
    conditionCategories,
    constraintCategories,
    areaOptions,
    selectedCondition,
    selectedConstraint,
    selectedAreaOption,
    tableData,
    categoryLoading,
    categoryError,
    selectionsLocked,
    displayRaster,
    locationLoading,
    locationError,
    loading,
    isMapLoading,
    stpOperation,
    mapError,
    categoriesEditable,
    isRightPanelOpen,
    reportLoading,
    treatmentLoading,
    isPdfGenerating,
    showPdfStatus,
    taskId,
    toggleConditionCategory,
    toggleConstraintCategory,
    updateConditionCategoryInfluence,
    selectAllConditionCategories,
    clearAllConditionCategories,
    selectAllConstraintCategories,
    clearAllConstraintCategories,
    setSelectedAreaOption,
    toggleCategoriesEditable,
    setRightPanelOpen,
    toggleRightPanel,
    completePdfGeneration,
    failPdfGeneration,
    handleSubmit,
    handleTreatmentSubmit,
    handleReport,
  };
}
