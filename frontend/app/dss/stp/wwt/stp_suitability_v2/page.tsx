"use client";

import WholeLoading from "@/components/app_layout/newLoading";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import StpSuitabilityPdfGenerationStatus from "./PdfGenerationStatus";
import AdminBottomResultsPanel from "./admin/components/AdminBottomResultsPanel";
import AdminDataInit from "./admin/components/AdminDataInit";
import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import AdminRightPanel from "./admin/components/AdminRightPanel";
import { useAdminViewModel } from "./admin/hooks/useAdminViewModel";
import type { MapMode } from "./config/mapModes";
import { getMapModeInfo } from "./config/mapModes";
import { stpSuitabilityPanelSettings } from "./config/panels.config";
import UserBottomResultsPanel from "./users/components/UserBottomResultsPanel";
import UserDataInit from "./users/components/UserDataInit";
import UserLeftPanel from "./users/components/UserLeftPanel";
import UserRightPanel from "./users/components/UserRightPanel";
import { useUserViewModel } from "./users/hooks/useUserViewModel";

const AdminMapView = dynamic(() => import("./admin/components/AdminOpenLayersMap"), {
  ssr: false,
});

const UserMapView = dynamic(() => import("./users/components/UserOpenLayersMap"), {
  ssr: false,
});

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

export default function StpSuitabilityV2Page() {
  const panelSettings = stpSuitabilityPanelSettings;
  const [selectedMode, setSelectedMode] = useState<MapMode>("admin");
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelWidthPercent, setRightPanelWidthPercent] = useState(
    Number.parseInt(panelSettings.right.widthOpen, 10) || panelSettings.right.minWidthPercent,
  );
  const [bottomPanelHeight, setBottomPanelHeight] = useState(panelSettings.bottom.heightOpen);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(panelSettings.bottom.defaultOpen);
  const suppressNextBottomAutoOpenRef = useRef(false);

  const adminViewModel = useAdminViewModel();
  const userViewModel = useUserViewModel();

  const activeModeInfo = getMapModeInfo(selectedMode);
  const rightPanelWidth = isMobile
    ? panelSettings.right.mobileWidthOpen
    : `${rightPanelWidthPercent}%`;

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setIsLeftOpen(panelSettings.left.defaultOpen);
    }
  }, [panelSettings.left.defaultOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const isDesktop = mq.matches;
    setIsMobile(!isDesktop);
    setBottomPanelHeight(
      isDesktop ? panelSettings.bottom.heightOpen : panelSettings.bottom.mobileHeightOpen,
    );
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(!event.matches);
      setBottomPanelHeight(
        event.matches ? panelSettings.bottom.heightOpen : panelSettings.bottom.mobileHeightOpen,
      );
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [panelSettings.bottom.heightOpen, panelSettings.bottom.mobileHeightOpen]);

  useEffect(() => {
    if (selectedMode === "admin") {
      adminViewModel.setRightPanelOpen(adminViewModel.selectionsLocked);
    }
  }, [adminViewModel.selectionsLocked, adminViewModel.setRightPanelOpen, selectedMode]);

  useEffect(() => {
    if (selectedMode === "user") {
      userViewModel.setRightPanelOpen(userViewModel.selectionsLocked);
    }
  }, [selectedMode, userViewModel.selectionsLocked, userViewModel.setRightPanelOpen]);

  const activeTableData =
    selectedMode === "admin" ? adminViewModel.tableData : userViewModel.tableData;
  const canShowBottomPanel = activeTableData.length > 0;

  useEffect(() => {
    if (canShowBottomPanel) {
      if (suppressNextBottomAutoOpenRef.current) {
        suppressNextBottomAutoOpenRef.current = false;
        setIsBottomPanelOpen(false);
        return;
      }
      setIsBottomPanelOpen(true);
    }
  }, [canShowBottomPanel, selectedMode]);

  const handleModeChange = (mode: MapMode) => {
    setSelectedMode(mode);
    setIsLeftOpen(true);
  };

  const handleRightPanelWidthChange = (value: number) => {
    setRightPanelWidthPercent(
      Math.min(
        panelSettings.right.maxWidthPercent,
        Math.max(panelSettings.right.minWidthPercent, value),
      ),
    );
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

  const adminCanShowRightPanel = adminViewModel.selectionsLocked;
  const userCanShowRightPanel = userViewModel.selectionsLocked;
  const shouldShowRightPanelToggle =
    selectedMode === "admin" ? adminCanShowRightPanel : userCanShowRightPanel;

  const leftPanel = selectedMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;
  const mapContent = selectedMode === "admin" ? <AdminMapView /> : <UserMapView />;

  const handleAdminAnalyze = async () => {
    suppressNextBottomAutoOpenRef.current = true;
    setIsBottomPanelOpen(false);
    await adminViewModel.handleSubmit();
  };

  const handleUserAnalyze = async () => {
    suppressNextBottomAutoOpenRef.current = true;
    setIsBottomPanelOpen(false);
    await userViewModel.handleSubmit();
  };

  const rightPanel =
    selectedMode === "admin"
      ? adminCanShowRightPanel
        ? (
            <AdminRightPanel
              isOpen={adminViewModel.isRightPanelOpen}
              width={rightPanelWidth}
              widthPercent={rightPanelWidthPercent}
              minWidthPercent={panelSettings.right.minWidthPercent}
              maxWidthPercent={panelSettings.right.maxWidthPercent}
              onWidthChange={handleRightPanelWidthChange}
              onClose={() => adminViewModel.setRightPanelOpen(false)}
              isMobile={isMobile}
              showCategories={adminViewModel.selectionsLocked}
              categoryLoading={adminViewModel.categoryLoading}
              workflowError={
                adminViewModel.categoryError ?? adminViewModel.locationError ?? adminViewModel.mapError
              }
              selectedConditionCount={adminViewModel.selectedCondition.length}
              selectedConstraintCount={adminViewModel.selectedConstraint.length}
              areaOptions={adminViewModel.areaOptions}
              selectedAreaOptionId={adminViewModel.selectedAreaOption?.id ?? null}
              categoriesEditable={adminViewModel.categoriesEditable}
              stpProcess={adminViewModel.stpOperation}
              isTreatmentLoading={adminViewModel.treatmentLoading}
              canFindTechnologyArea={adminViewModel.canFindTechnologyArea}
              tableData={adminViewModel.tableData}
              toggleCategoriesEditable={adminViewModel.toggleCategoriesEditable}
              handleSubmit={handleAdminAnalyze}
              handleTreatmentSubmit={adminViewModel.handleTreatmentSubmit}
              handleTechnologyAreaSubmit={adminViewModel.handleTechnologyAreaSubmit}
              setSelectedAreaOption={adminViewModel.setSelectedAreaOption}
            />
          )
        : null
      : userCanShowRightPanel
        ? (
            <UserRightPanel
              isOpen={userViewModel.isRightPanelOpen}
              width={rightPanelWidth}
              widthPercent={rightPanelWidthPercent}
              minWidthPercent={panelSettings.right.minWidthPercent}
              maxWidthPercent={panelSettings.right.maxWidthPercent}
              onWidthChange={handleRightPanelWidthChange}
              onClose={() => userViewModel.setRightPanelOpen(false)}
              isMobile={isMobile}
              showCategories={userViewModel.selectionsLocked}
              categoryLoading={userViewModel.categoryLoading}
              workflowError={
                userViewModel.categoryError ?? userViewModel.riverError ?? userViewModel.mapError
              }
              selectedConditionCount={userViewModel.selectedCondition.length}
              selectedConstraintCount={userViewModel.selectedConstraint.length}
              areaOptions={userViewModel.areaOptions}
              selectedAreaOptionId={userViewModel.selectedAreaOption?.id ?? null}
              categoriesEditable={userViewModel.categoriesEditable}
              stpProcess={userViewModel.stpOperation}
              isTreatmentLoading={userViewModel.treatmentLoading}
              canFindTechnologyArea={userViewModel.canFindTechnologyArea}
              tableData={userViewModel.tableData}
              toggleCategoriesEditable={userViewModel.toggleCategoriesEditable}
              handleSubmit={handleUserAnalyze}
              handleTreatmentSubmit={userViewModel.handleTreatmentSubmit}
              handleTechnologyAreaSubmit={userViewModel.handleTechnologyAreaSubmit}
              setSelectedAreaOption={userViewModel.setSelectedAreaOption}
            />
          )
        : null;

  const rightPanelToggle = shouldShowRightPanelToggle ? (
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
  ) : null;

  const activeIsPdfGenerating =
    selectedMode === "admin" ? adminViewModel.isPdfGenerating : userViewModel.isPdfGenerating;

  const activeHandleReport =
    selectedMode === "admin" ? adminViewModel.handleReport : userViewModel.handleReport;

  const bottomPanel = canShowBottomPanel
    ? selectedMode === "admin"
      ? (
          <AdminBottomResultsPanel
            isOpen={isBottomPanelOpen}
            height={bottomPanelHeight}
            tableData={activeTableData}
            panelSettings={panelSettings.bottom}
            isMobile={isMobile}
            isPdfGenerating={activeIsPdfGenerating}
            onToggle={() => setIsBottomPanelOpen((open) => !open)}
            onReport={activeHandleReport}
          />
        )
      : (
          <UserBottomResultsPanel
            isOpen={isBottomPanelOpen}
            height={bottomPanelHeight}
            tableData={activeTableData}
            panelSettings={panelSettings.bottom}
            isMobile={isMobile}
            isPdfGenerating={activeIsPdfGenerating}
            onToggle={() => setIsBottomPanelOpen((open) => !open)}
            onReport={activeHandleReport}
          />
        )
    : null;

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
    selectedMode === "admin" ? adminViewModel.treatmentLoading : userViewModel.treatmentLoading;

  const showPdfStatus =
    selectedMode === "admin" ? adminViewModel.showPdfStatus : userViewModel.showPdfStatus;

  const taskId =
    selectedMode === "admin" ? adminViewModel.taskId : userViewModel.taskId;

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
        config={panelSettings}
        railItems={railItems}
        leftPanel={leftPanel}
        mapContent={mapContent}
        rightPanel={rightPanel}
        rightPanelToggle={rightPanelToggle}
        bottomPanel={bottomPanel}
        isBottomOpen={canShowBottomPanel && isBottomPanelOpen}
        bottomPanelOpenHeight={bottomPanelHeight}
        bottomPanelClosedHeight={panelSettings.bottom.heightClosed}
        isLeftOpen={isLeftOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsLeftOpen((current) => !current)}
        onCloseLeft={() => setIsLeftOpen(false)}
      />

      {showPdfStatus && taskId && (
        <StpSuitabilityPdfGenerationStatus
          taskId={taskId}
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
          "Suitable locations are identified using GIS-based conditioning layers and constraint layers through a multi-criteria decision-making model.",
          "The model enables pin-point identification of STP locations for desired capacity and selected technologies.",
          "Final output related to sewage site suitability can be generated in PDF format.",
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
