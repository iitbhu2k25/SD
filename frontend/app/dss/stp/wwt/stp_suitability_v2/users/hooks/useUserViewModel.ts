"use client";

import { toast } from "react-toastify";
import {
  findSuitabilityAreaCluster,
  startUserSuitabilityReport,
} from "../../services/stpSuitabilityApi";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserUiStore } from "../stores/userUiStore";

interface TreatmentSubmitValues {
  areaId: number | null;
  mldCapacity: number;
  customLand: number;
}

export function useUserViewModel() {
  const conditionCategories = useUserCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useUserCategoryStore((state) => state.constraintCategories);
  const areaOptions = useUserCategoryStore((state) => state.areaOptions);
  const selectedCondition = useUserCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useUserCategoryStore((state) => state.selectedConstraint);
  const selectedAreaOption = useUserCategoryStore((state) => state.selectedAreaOption);
  const tableData = useUserCategoryStore((state) => state.tableData);
  const categoryLoading = useUserCategoryStore((state) => state.isLoading);
  const categoryError = useUserCategoryStore((state) => state.error);
  const toggleConditionCategory = useUserCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useUserCategoryStore(
    (state) => state.toggleConstraintCategory,
  );
  const updateConditionCategoryInfluence = useUserCategoryStore(
    (state) => state.updateConditionCategoryInfluence,
  );
  const selectAllConditionCategories = useUserCategoryStore(
    (state) => state.selectAllConditionCategories,
  );
  const clearAllConditionCategories = useUserCategoryStore(
    (state) => state.clearAllConditionCategories,
  );
  const selectAllConstraintCategories = useUserCategoryStore(
    (state) => state.selectAllConstraintCategories,
  );
  const clearAllConstraintCategories = useUserCategoryStore(
    (state) => state.clearAllConstraintCategories,
  );
  const setSelectedAreaOption = useUserCategoryStore((state) => state.setSelectedAreaOption);

  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  // Keep these selection labels in state for report payloads even when the UI summary card is hidden.
  const selectedRiverName = useUserRiverStore((state) => state.selectedRiverName);
  const selectedStretchNames = useUserRiverStore((state) => state.selectedStretchNames);
  const selectedDrainsNames = useUserRiverStore((state) => state.selectedDrainsNames);
  const selectedCatchmentsNames = useUserRiverStore((state) => state.selectedCatchmentsNames);
  const riverLoading = useUserRiverStore((state) => state.isLoading);
  const riverError = useUserRiverStore((state) => state.error);

  const runAnalysis = useUserMapStore((state) => state.runAnalysis);
  const setResultVectorLayer = useUserMapStore((state) => state.setResultVectorLayer);
  const loading = useUserMapStore((state) => state.loading);
  const isMapLoading = useUserMapStore((state) => state.isMapLoading);
  const stpOperation = useUserMapStore((state) => state.stpOperation);
  const mapError = useUserMapStore((state) => state.error);

  const categoriesEditable = useUserUiStore((state) => state.categoriesEditable);
  const isRightPanelOpen = useUserUiStore((state) => state.isRightPanelOpen);
  const reportLoading = useUserUiStore((state) => state.reportLoading);
  const treatmentLoading = useUserUiStore((state) => state.treatmentLoading);
  const isPdfGenerating = useUserUiStore((state) => state.isPdfGenerating);
  const showPdfStatus = useUserUiStore((state) => state.showPdfStatus);
  const taskId = useUserUiStore((state) => state.taskId);
  const toggleCategoriesEditable = useUserUiStore((state) => state.toggleCategoriesEditable);
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);
  const toggleRightPanel = useUserUiStore((state) => state.toggleRightPanel);
  const startReportFlow = useUserUiStore((state) => state.startReportFlow);
  const setReportTask = useUserUiStore((state) => state.setReportTask);
  const finishReportRequest = useUserUiStore((state) => state.finishReportRequest);
  const failReportFlow = useUserUiStore((state) => state.failReportFlow);
  const completePdfGeneration = useUserUiStore((state) => state.completePdfGeneration);
  const failPdfGeneration = useUserUiStore((state) => state.failPdfGeneration);
  const setTreatmentLoading = useUserUiStore((state) => state.setTreatmentLoading);

  const handleSubmit = async () => {
    if (selectedCatchments.length < 1) {
      toast.error("Please select and confirm at least one catchment", {
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

      const response = await startUserSuitabilityReport({
        table: tableData,
        raster: displayRaster,
        place: "Drain",
        clip: selectedCatchments,
        location: {
          River: selectedRiverName,
          Stretch: selectedStretchNames,
          Drain: selectedDrainsNames,
          Catchment: selectedCatchmentsNames,
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
    selectedCatchments,
    riverLoading,
    riverError,
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
