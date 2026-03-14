"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import WholeLoading from "@/components/app_layout/newLoading";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import MainLayout from "../../shared/ui/MainLayout";
import UserRightPanel from "./UserRightPanel";
import UserRightPanelToggle from "./UserRightPanelToggle";
import { useUserViewModel } from "../hooks/useUserViewModel";

const MapView = dynamic(() => import("./UserOpenLayersMap"), {
  ssr: false,
});

export default function UserMainView() {
  const {
    selectionsLocked,
    tableData,
    riverLoading,
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
  } = useUserViewModel();
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
          riverLoading ||
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
            <UserRightPanel
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
            <UserRightPanelToggle
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
