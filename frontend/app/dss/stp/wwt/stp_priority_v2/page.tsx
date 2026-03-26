"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import WholeLoading from "@/components/app_layout/newLoading";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { MapMode, getMapModeInfo } from "./config/mapModes";
import { stpPriorityPanelSettings } from "./config/panels.config";
import UserDataInit from "./users/components/UserDataInit";
import UserLeftPanel from "./users/components/UserLeftPanel";
import UserRightPanel from "./users/components/UserRightPanel";
import PageLayout from "./shared/layout/PageLayout";
import AdminDataInit from "./admin/components/AdminDataInit";
import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import AdminRightPanel from "./admin/components/AdminRightPanel";
import ModuleInfoModal from "./shared/ui/ModuleInfoModal";
import RightPanelToggle from "./shared/ui/RightPanelToggle";
import { useAdminViewModel } from "./admin/hooks/useAdminViewModel";
import { useUserViewModel } from "./users/hooks/useUserViewModel";

const AdminMapView = dynamic(() => import("./admin/components/AdminOpenLayersMap"), {
  ssr: false,
});

const UserMapView = dynamic(() => import("./users/components/UserOpenLayersMap"), {
  ssr: false,
});

const AdminIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

const DrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
    />
  </svg>
);

export default function StpPriorityV2Page() {
  const panelSettings = stpPriorityPanelSettings;
  const [selectedMode, setSelectedMode] = useState<MapMode>("admin");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const activeModeInfo = getMapModeInfo(selectedMode);
  const [rightPanelWidth, setRightPanelWidth] = useState<string>(panelSettings.right.widthOpen);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const adminViewModel = useAdminViewModel();
  const userViewModel = useUserViewModel();

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setIsPanelOpen(panelSettings.left.defaultOpen);
    }
  }, [panelSettings.left.defaultOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const isDesktop = mq.matches;
    setIsMobile(!isDesktop);
    setRightPanelWidth(
      isDesktop ? panelSettings.right.widthOpen : panelSettings.right.mobileWidthOpen
    );

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
      setRightPanelWidth(
        e.matches ? panelSettings.right.widthOpen : panelSettings.right.mobileWidthOpen
      );
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [panelSettings.right.mobileWidthOpen, panelSettings.right.widthOpen]);

  useEffect(() => {
    if (selectedMode === "admin") {
      adminViewModel.setRightPanelOpen(adminViewModel.selectionsLocked);
    }
  }, [
    adminViewModel.selectionsLocked,
    adminViewModel.setRightPanelOpen,
    selectedMode,
  ]);

  useEffect(() => {
    if (selectedMode === "user") {
      userViewModel.setRightPanelOpen(userViewModel.selectionsLocked);
    }
  }, [
    selectedMode,
    userViewModel.selectionsLocked,
    userViewModel.setRightPanelOpen,
  ]);

  const handleModeChange = (mode: MapMode): void => {
    setSelectedMode(mode);
    setIsPanelOpen(true);
  };

  const railItems = [
    {
      id: "admin",
      icon: <AdminIcon />,
      label: "Admin",
      tooltip: "Admin Mode",
      onClick: () => handleModeChange("admin"),
      isActive: selectedMode === "admin",
      activeClassName: "bg-blue-600 text-white shadow-lg shadow-blue-200",
    },
    {
      id: "drain",
      icon: <DrainIcon />,
      label: "Drain",
      tooltip: "Drain Mode",
      onClick: () => handleModeChange("user"),
      isActive: selectedMode === "user",
      activeClassName: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
  ];

  const adminShowCategories = adminViewModel.selectionsLocked;
  const adminCanShowRightPanel =
    adminShowCategories || adminViewModel.tableData.length > 0;
  const userShowCategories = userViewModel.selectionsLocked;
  const userCanShowRightPanel =
    userShowCategories || userViewModel.tableData.length > 0;

  const leftPanelContent =
    selectedMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;

  const mapContent = selectedMode === "admin" ? <AdminMapView /> : <UserMapView />;

  const rightPanelContent =
    selectedMode === "admin"
      ? adminCanShowRightPanel ? (
          <AdminRightPanel
            isOpen={adminViewModel.isRightPanelOpen}
            width={rightPanelWidth}
            showCategories={adminShowCategories}
            tableData={adminViewModel.tableData}
            categoriesEditable={adminViewModel.categoriesEditable}
            stpProcess={adminViewModel.stpProcess}
            isPdfGenerating={adminViewModel.isPdfGenerating}
            toggleCategoriesEditable={adminViewModel.toggleCategoriesEditable}
            onClose={() => adminViewModel.setRightPanelOpen(false)}
            handleSubmit={adminViewModel.handleSubmit}
            handleReport={adminViewModel.handleReport}
            onWidthChange={setRightPanelWidth}
            panelSettings={panelSettings.right}
            isMobile={isMobile}
          />
        ) : null
      : userCanShowRightPanel ? (
          <UserRightPanel
            isOpen={userViewModel.isRightPanelOpen}
            width={rightPanelWidth}
            showCategories={userShowCategories}
            tableData={userViewModel.tableData}
            categoriesEditable={userViewModel.categoriesEditable}
            stpProcess={userViewModel.stpProcess}
            isPdfGenerating={userViewModel.isPdfGenerating}
            toggleCategoriesEditable={userViewModel.toggleCategoriesEditable}
            onClose={() => userViewModel.setRightPanelOpen(false)}
            handleSubmit={userViewModel.handleSubmit}
            handleReport={userViewModel.handleReport}
            onWidthChange={setRightPanelWidth}
            panelSettings={panelSettings.right}
            isMobile={isMobile}
          />
        ) : null;

  const rightPanelToggle =
    selectedMode === "admin"
      ? adminCanShowRightPanel ? (
          <RightPanelToggle
            isOpen={adminViewModel.isRightPanelOpen}
            openOffset={rightPanelWidth}
            onToggle={adminViewModel.toggleRightPanel}
          />
        ) : null
      : userCanShowRightPanel ? (
          <RightPanelToggle
            isOpen={userViewModel.isRightPanelOpen}
            openOffset={rightPanelWidth}
            onToggle={userViewModel.toggleRightPanel}
          />
        ) : null;

  const loadingVisible =
    selectedMode === "admin"
      ? adminViewModel.loading ||
        adminViewModel.isMapLoading ||
        adminViewModel.stpOperation ||
        adminViewModel.reportLoading ||
        adminViewModel.locationLoading ||
        adminViewModel.categoryLoading
      : userViewModel.loading ||
        userViewModel.isMapLoading ||
        userViewModel.stpOperation ||
        userViewModel.reportLoading ||
        userViewModel.riverLoading ||
        userViewModel.categoryLoading;

  const isActiveStpOperation =
    selectedMode === "admin"
      ? adminViewModel.stpOperation
      : userViewModel.stpOperation;
  const isActiveReportLoading =
    selectedMode === "admin"
      ? adminViewModel.reportLoading
      : userViewModel.reportLoading;
  const showPdfStatus =
    selectedMode === "admin"
      ? adminViewModel.showPdfStatus
      : userViewModel.showPdfStatus;
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
            ? "Analyzing STP priorities"
            : isActiveReportLoading
              ? "Generating report for STP priorities"
              : "Loading Resources"
        }
        message={
          isActiveStpOperation
            ? "Analyzing site priorities and generating results..."
            : isActiveReportLoading
              ? "Generating report, please wait..."
              : "Fetching map data and initializing components..."
        }
      />
      <PageLayout
        title="STP Priority"
        badge={activeModeInfo.label}
        badgeClassName={activeModeInfo.badgeClassName}
        onTitleInfoClick={() => setShowInfo(true)}
        titleInfoTooltip="Module info"
        config={panelSettings}
        railItems={railItems}
        leftPanel={leftPanelContent}
        mapContent={mapContent}
        rightPanel={rightPanelContent}
        rightPanelToggle={rightPanelToggle}
        isLeftOpen={isPanelOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsPanelOpen((open) => !open)}
        onCloseLeft={() => setIsPanelOpen(false)}
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
        title="STP Priority System"
        imageSrc="/Images/modules/image_25.png"
        imageAlt="STP Priority Information"
        points={[
          "STP Priority module is intended to identify the sewage priority risk hot-spot areas.",
          "Several GIS-based layers related to sewerage, demography, land-use, and groundwater are used to identify sewage priority risk areas.",
          "Final output related to the sewage risk can be generated in PDF format.",
        ]}
        learnMoreHref="/dss/home/home_grid/home_card/basic_module"
        learnMoreLabel="Learn more about STP Priority"
      />
    </>
  );

  if (selectedMode === "admin") {
    return <AdminDataInit>{pageLayout}</AdminDataInit>;
  }

  return <UserDataInit>{pageLayout}</UserDataInit>;
}
