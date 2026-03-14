"use client";

// This is the main working area of the admin page.
// It connects the map area, the right panel, and the loading boxes.
import { useEffect } from "react";
import dynamic from "next/dynamic";
import WholeLoading from "@/components/app_layout/newLoading";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import MainLayout from "../../shared/ui/MainLayout";
import AdminRightPanel from "./AdminRightPanel";
import AdminRightPanelToggle from "./AdminRightPanelToggle";
import { useAdminViewModel } from "../hooks/useAdminViewModel";

const MapView = dynamic(() => import("./AdminOpenLayersMap"), {
  ssr: false,
});

export default function AdminMainView() {
  const {
    stpProcess,
    tableData,
    categoryLoading,
    selectionsLocked,
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
  } = useAdminViewModel();
  const showCategories = selectionsLocked;

  useEffect(() => {
    setRightPanelOpen(selectionsLocked);
  }, [selectionsLocked, setRightPanelOpen]);

  const canShowRightPanel = showCategories || tableData.length > 0;
  const rightPanelWidthClass = "w-[clamp(320px,30vw,460px)]";
  const rightPanelOffsetClass = "right-[clamp(320px,30vw,460px)]";

  return (
    <>
      <WholeLoading
        visible={
          loading ||
          isMapLoading ||
          stpOperation ||
          reportLoading ||
          locationLoading ||
          categoryLoading
        }
        title={
          stpOperation
            ? "Analyzing STP priorities"
            : reportLoading
              ? "Generating report for STP priorities"
              : "Loading Resources"
        }
        message={
          stpOperation
            ? "Analyzing site priorities and generating results..."
            : reportLoading
              ? "Generating report, please wait..."
              : "Fetching map data and initializing components..."
        }
      />
      <MainLayout
        mapContent={<MapView />}
        rightPanel={
          canShowRightPanel ? (
            <AdminRightPanel
              isOpen={isRightPanelOpen}
              widthClass={rightPanelWidthClass}
              showCategories={showCategories}
              tableData={tableData}
              categoriesEditable={categoriesEditable}
              stpProcess={stpProcess}
              isPdfGenerating={isPdfGenerating}
              toggleCategoriesEditable={toggleCategoriesEditable}
              handleSubmit={handleSubmit}
              handleReport={handleReport}
            />
          ) : null
        }
        rightPanelToggle={
          canShowRightPanel ? (
            <AdminRightPanelToggle
              isOpen={isRightPanelOpen}
              openOffsetClass={rightPanelOffsetClass}
              onToggle={toggleRightPanel}
            />
          ) : null
        }
      />

      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed bottom-8 right-8 w-96 z-50 animate-fadeIn"
          autoClose={true}
          closeDelay={3000}
          enableAutoDownload={true}
          onComplete={completePdfGeneration}
          onFailure={failPdfGeneration}
        />
      )}
    </>
  );
}
