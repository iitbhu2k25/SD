"use client";

import WholeLoading from "@/components/app_layout/newLoading";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import AdminDataInit from "../../admin/components/AdminDataInit";
import AdminLeftPanel from "../../admin/components/AdminLeftPanel";
import AdminRightPanel from "../../admin/components/AdminRightPanel";
import { useAdminViewModel } from "../../admin/hooks/useAdminViewModel";
import type { MapMode } from "../../config/mapModes";
import { getMapModeInfo } from "../../config/mapModes";
import { stpSuitabilityPanelSettings } from "../../config/panels.config";
import UserDataInit from "../../users/components/UserDataInit";
import UserLeftPanel from "../../users/components/UserLeftPanel";
import UserRightPanel from "../../users/components/UserRightPanel";
import { useUserViewModel } from "../../users/hooks/useUserViewModel";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import PageLayout from "@/components/dss_common/PageLayout";

const AdminMapView = dynamic(() => import("../../admin/components/AdminOpenLayersMap"), {
  ssr: false,
});

const UserMapView = dynamic(() => import("../../users/components/UserOpenLayersMap"), {
  ssr: false,
});

interface StpSuitabilityShellProps {
  initialMode?: MapMode;
  lockMode?: boolean;
}

const AdminIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

const DrainIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7h18M6 12h12M10 17h4"
    />
  </svg>
);

export default function StpSuitabilityShell({
  initialMode = "admin",
  lockMode = false,
}: StpSuitabilityShellProps) {
  const [selectedMode, setSelectedMode] = useState<MapMode>(initialMode);
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelWidthPercent, setRightPanelWidthPercent] = useState(
    Number.parseInt(stpSuitabilityPanelSettings.right.widthOpen, 10) ||
      stpSuitabilityPanelSettings.right.maxWidthPercent,
  );

  const adminViewModel = useAdminViewModel();
  const userViewModel = useUserViewModel();

  const activeModeInfo = getMapModeInfo(selectedMode);
  const rightPanelWidth = isMobile
    ? stpSuitabilityPanelSettings.right.mobileWidthOpen
    : `${rightPanelWidthPercent}%`;
  const shouldShowRightPanelToggle =
    selectedMode === "admin" ? adminViewModel.selectionsLocked : userViewModel.selectionsLocked;

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setIsLeftOpen(stpSuitabilityPanelSettings.left.defaultOpen);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(!event.matches);
    };

    setIsMobile(!mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (selectedMode === "admin" && (adminViewModel.selectionsLocked || adminViewModel.tableData.length > 0)) {
      adminViewModel.setRightPanelOpen(true);
    }
  }, [
    adminViewModel.selectionsLocked,
    adminViewModel.setRightPanelOpen,
    adminViewModel.tableData.length,
    selectedMode,
  ]);

  useEffect(() => {
    if (selectedMode === "user" && (userViewModel.selectionsLocked || userViewModel.tableData.length > 0)) {
      userViewModel.setRightPanelOpen(true);
    }
  }, [
    selectedMode,
    userViewModel.selectionsLocked,
    userViewModel.setRightPanelOpen,
    userViewModel.tableData.length,
  ]);

  const handleModeChange = (mode: MapMode) => {
    if (lockMode) {
      return;
    }
    setSelectedMode(mode);
    setIsLeftOpen(true);
  };

  const railItems = [
    {
      id: "admin",
      icon: <AdminIcon />,
      label: "Admin",
      tooltip: "Administrative mode",
      onClick: () => handleModeChange("admin"),
      isActive: selectedMode === "admin",
      activeClassName: "bg-blue-600 text-white shadow-lg shadow-blue-200",
    },
    {
      id: "drain",
      icon: <DrainIcon />,
      label: "Drain",
      tooltip: "River-system mode",
      onClick: () => handleModeChange("user"),
      isActive: selectedMode === "user",
      activeClassName: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
  ];

  const visibleRailItems = lockMode
    ? railItems.filter((item) => item.id === selectedMode)
    : railItems;

  const leftPanel = selectedMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;
  const mapContent = selectedMode === "admin" ? <AdminMapView /> : <UserMapView />;

  const handleWidthChange = (value: number) => {
    setRightPanelWidthPercent(
      Math.min(
        stpSuitabilityPanelSettings.right.maxWidthPercent,
        Math.max(stpSuitabilityPanelSettings.right.minWidthPercent, value),
      ),
    );
  };

  const rightPanel =
    selectedMode === "admin" ? (
      <AdminRightPanel
        isOpen={adminViewModel.isRightPanelOpen}
        width={rightPanelWidth}
        widthPercent={rightPanelWidthPercent}
        minWidthPercent={stpSuitabilityPanelSettings.right.minWidthPercent}
        maxWidthPercent={stpSuitabilityPanelSettings.right.maxWidthPercent}
        onWidthChange={handleWidthChange}
        onClose={() => adminViewModel.setRightPanelOpen(false)}
        isMobile={isMobile}
        showCategories={adminViewModel.selectionsLocked}
        categoryLoading={adminViewModel.categoryLoading}
        workflowError={
          adminViewModel.categoryError ?? adminViewModel.locationError ?? adminViewModel.mapError
        }
        conditionCategories={adminViewModel.conditionCategories}
        constraintCategories={adminViewModel.constraintCategories}
        selectedCondition={adminViewModel.selectedCondition}
        selectedConstraint={adminViewModel.selectedConstraint}
        areaOptions={adminViewModel.areaOptions}
        selectedAreaOptionId={adminViewModel.selectedAreaOption?.id ?? null}
        categoriesEditable={adminViewModel.categoriesEditable}
        stpProcess={adminViewModel.stpOperation}
        isPdfGenerating={adminViewModel.isPdfGenerating}
        isTreatmentLoading={adminViewModel.treatmentLoading}
        tableData={adminViewModel.tableData}
        toggleCategoriesEditable={adminViewModel.toggleCategoriesEditable}
        handleSubmit={adminViewModel.handleSubmit}
        handleReport={adminViewModel.handleReport}
        handleTreatmentSubmit={adminViewModel.handleTreatmentSubmit}
        setSelectedAreaOption={adminViewModel.setSelectedAreaOption}
        toggleConditionCategory={adminViewModel.toggleConditionCategory}
        toggleConstraintCategory={adminViewModel.toggleConstraintCategory}
        updateConditionCategoryInfluence={adminViewModel.updateConditionCategoryInfluence}
        selectAllConditionCategories={adminViewModel.selectAllConditionCategories}
        clearAllConditionCategories={adminViewModel.clearAllConditionCategories}
        selectAllConstraintCategories={adminViewModel.selectAllConstraintCategories}
        clearAllConstraintCategories={adminViewModel.clearAllConstraintCategories}
      />
    ) : (
      <UserRightPanel
        isOpen={userViewModel.isRightPanelOpen}
        width={rightPanelWidth}
        widthPercent={rightPanelWidthPercent}
        minWidthPercent={stpSuitabilityPanelSettings.right.minWidthPercent}
        maxWidthPercent={stpSuitabilityPanelSettings.right.maxWidthPercent}
        onWidthChange={handleWidthChange}
        onClose={() => userViewModel.setRightPanelOpen(false)}
        isMobile={isMobile}
        showCategories={userViewModel.selectionsLocked}
        categoryLoading={userViewModel.categoryLoading}
        workflowError={
          userViewModel.categoryError ?? userViewModel.riverError ?? userViewModel.mapError
        }
        conditionCategories={userViewModel.conditionCategories}
        constraintCategories={userViewModel.constraintCategories}
        selectedCondition={userViewModel.selectedCondition}
        selectedConstraint={userViewModel.selectedConstraint}
        areaOptions={userViewModel.areaOptions}
        selectedAreaOptionId={userViewModel.selectedAreaOption?.id ?? null}
        categoriesEditable={userViewModel.categoriesEditable}
        stpProcess={userViewModel.stpOperation}
        isPdfGenerating={userViewModel.isPdfGenerating}
        isTreatmentLoading={userViewModel.treatmentLoading}
        tableData={userViewModel.tableData}
        toggleCategoriesEditable={userViewModel.toggleCategoriesEditable}
        handleSubmit={userViewModel.handleSubmit}
        handleReport={userViewModel.handleReport}
        handleTreatmentSubmit={userViewModel.handleTreatmentSubmit}
        setSelectedAreaOption={userViewModel.setSelectedAreaOption}
        toggleConditionCategory={userViewModel.toggleConditionCategory}
        toggleConstraintCategory={userViewModel.toggleConstraintCategory}
        updateConditionCategoryInfluence={userViewModel.updateConditionCategoryInfluence}
        selectAllConditionCategories={userViewModel.selectAllConditionCategories}
        clearAllConditionCategories={userViewModel.clearAllConditionCategories}
        selectAllConstraintCategories={userViewModel.selectAllConstraintCategories}
        clearAllConstraintCategories={userViewModel.clearAllConstraintCategories}
      />
    );

  const loadingVisible =
    selectedMode === "admin"
      ? adminViewModel.loading ||
        adminViewModel.isMapLoading ||
        adminViewModel.stpOperation ||
        adminViewModel.reportLoading ||
        adminViewModel.treatmentLoading ||
        adminViewModel.locationLoading ||
        adminViewModel.categoryLoading
      : userViewModel.loading ||
        userViewModel.isMapLoading ||
        userViewModel.stpOperation ||
        userViewModel.reportLoading ||
        userViewModel.treatmentLoading ||
        userViewModel.riverLoading ||
        userViewModel.categoryLoading;

  const isActiveStpOperation =
    selectedMode === "admin" ? adminViewModel.stpOperation : userViewModel.stpOperation;
  const isActiveReportLoading =
    selectedMode === "admin" ? adminViewModel.reportLoading : userViewModel.reportLoading;
  const isActiveTreatmentLoading =
    selectedMode === "admin"
      ? adminViewModel.treatmentLoading
      : userViewModel.treatmentLoading;
  const showPdfStatus =
    selectedMode === "admin"
      ? adminViewModel.showPdfStatus
      : userViewModel.showPdfStatus;
  const taskId = selectedMode === "admin" ? adminViewModel.taskId : userViewModel.taskId;
  const handlePdfComplete =
    selectedMode === "admin"
      ? adminViewModel.completePdfGeneration
      : userViewModel.completePdfGeneration;
  const handlePdfFailure =
    selectedMode === "admin"
      ? adminViewModel.failPdfGeneration
      : userViewModel.failPdfGeneration;

  const pageLayout = (
    <>
      <WholeLoading
        visible={loadingVisible}
        title={
          isActiveStpOperation
            ? "Analyzing STP suitability"
            : isActiveReportLoading
              ? "Generating report for STP suitability"
              : isActiveTreatmentLoading
                ? "Finding treatment cluster"
                : "Loading Resources"
        }
        message={
          isActiveStpOperation
            ? "Analyzing site suitability and generating results..."
            : isActiveReportLoading
              ? "Generating report, please wait..."
              : isActiveTreatmentLoading
                ? "Evaluating treatment land requirement and locating clusters..."
                : "Fetching map data and initializing components..."
        }
      />

      <PageLayout
        title="STP Suitability"
        badge={activeModeInfo.label}
        badgeClassName={activeModeInfo.badgeClassName}
        onTitleInfoClick={() => setShowInfo(true)}
        titleInfoTooltip="Module info"
        config={stpSuitabilityPanelSettings}
        railItems={visibleRailItems}
        leftPanel={leftPanel}
        mapContent={mapContent}
        rightPanel={rightPanel}
        rightPanelToggle={
          shouldShowRightPanelToggle ? (
            <RightPanelToggle
              isOpen={
                selectedMode === "admin"
                  ? adminViewModel.isRightPanelOpen
                  : userViewModel.isRightPanelOpen
              }
              openOffset={rightPanelWidth}
              onToggle={
                selectedMode === "admin"
                  ? adminViewModel.toggleRightPanel
                  : userViewModel.toggleRightPanel
              }
            />
          ) : null
        }
        isLeftOpen={isLeftOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsLeftOpen((current) => !current)}
        onCloseLeft={() => setIsLeftOpen(false)}
      />

      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed inset-x-4 bottom-4 z-50 animate-fadeIn sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-80 lg:bottom-8 lg:left-8 lg:w-96"
          autoClose={true}
          closeDelay={3000}
          enableAutoDownload={true}
          onComplete={handlePdfComplete}
          onFailure={handlePdfFailure}
        />
      )}

      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="STP Suitability System"
        imageSrc="/Images/modules/image_30.png"
        imageAlt="STP Suitability module information"
        points={[
          "STP Suitability module is intended to identify suitable locations for STP construction in sewage high-priority zones.",
          "Suitable locations are identified using GIS-based conditioning layers (groundwater, land-use, hydrology, soil, etc.) and constraint layers (ASI, roads, railways, flood plains) through a multi-criteria decision-making model.",
          "The model enables pin-point identification of STP locations for desired capacity and selected technologies (MBR, SBR, ASP, etc.).",
          "Final output related to sewage site suitability can be generated in PDF format."
        ]}
        learnMoreHref="/dss/home/home_grid/home_card/basic_module"
        learnMoreLabel="Learn more about STP Suitability"
      />
    </>
  );

  if (selectedMode === "admin") {
    return <AdminDataInit>{pageLayout}</AdminDataInit>;
  }

  return <UserDataInit>{pageLayout}</UserDataInit>;
}
