"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import WholeLoading from "@/components/app_layout/newLoading";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import { MapMode, getMapModeInfo } from "./config/mapModes";
import { gwmPumpingPanelSettings } from "./config/panels.config";
import UserDataInit from "./users/components/UserDataInit";
import UserLeftPanel from "./users/components/UserLeftPanel";
import UserRightPanel from "./users/components/UserRightPanel";
import UserBottomResultsPanel from "./users/components/UserBottomResultsPanel";
import AdminDataInit from "./admin/components/AdminDataInit";
import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import AdminRightPanel from "./admin/components/AdminRightPanel";
import AdminBottomResultsPanel from "./admin/components/AdminBottomResultsPanel";
import { useAdminViewModel } from "./admin/hooks/useAdminViewModel";
import { useUserViewModel } from "./users/hooks/useUserViewModel";
import { useUiModeService } from "./services/uiModeService";

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
      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
    />
  </svg>
);

const MoonIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />
  </svg>
);

const SunIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

export default function GwmPumpingLocationV2Page() {
  const panelSettings = gwmPumpingPanelSettings;
  const [selectedMode, setSelectedMode] = useState<MapMode>("admin");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const activeModeInfo = getMapModeInfo(selectedMode);
  const isDark = useUiModeService((state) => state.isDark);
  const toggleTheme = useUiModeService((state) => state.toggleTheme);
  const [rightPanelWidth, setRightPanelWidth] = useState(panelSettings.right.widthOpen);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(panelSettings.bottom.heightOpen);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(panelSettings.bottom.defaultOpen);
  const [isMobile, setIsMobile] = useState(false);

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
    setRightPanelWidth(isDesktop ? panelSettings.right.widthOpen : panelSettings.right.mobileWidthOpen);
    setBottomPanelHeight(
      isDesktop ? panelSettings.bottom.heightOpen : panelSettings.bottom.mobileHeightOpen,
    );

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(!event.matches);
      setRightPanelWidth(
        event.matches ? panelSettings.right.widthOpen : panelSettings.right.mobileWidthOpen,
      );
      setBottomPanelHeight(
        event.matches ? panelSettings.bottom.heightOpen : panelSettings.bottom.mobileHeightOpen,
      );
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [
    panelSettings.bottom.heightOpen,
    panelSettings.bottom.mobileHeightOpen,
    panelSettings.right.mobileWidthOpen,
    panelSettings.right.widthOpen,
  ]);

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

  const handleModeChange = (mode: MapMode) => {
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
      activeClassName: isDark
        ? "bg-blue-700 text-white shadow-lg shadow-blue-900"
        : "bg-blue-600 text-white shadow-lg shadow-blue-200",
    },
    {
      id: "drain",
      icon: <DrainIcon />,
      label: "Drain",
      tooltip: "Drain Mode",
      onClick: () => handleModeChange("user"),
      isActive: selectedMode === "user",
      activeClassName: isDark
        ? "bg-emerald-700 text-white shadow-lg shadow-emerald-900"
        : "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
    {
      id: "theme",
      icon: isDark ? <SunIcon /> : <MoonIcon />,
      label: isDark ? "Light" : "Dark",
      tooltip: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
      onClick: toggleTheme,
      isActive: isDark,
      activeClassName: "bg-slate-700 text-cyan-400 shadow-lg",
    },
  ];

  const adminShowCategories = adminViewModel.selectionsLocked;
  const adminCanShowRightPanel = adminShowCategories;
  const userShowCategories = userViewModel.selectionsLocked;
  const userCanShowRightPanel = userShowCategories;
  const activeTableData =
    selectedMode === "admin" ? adminViewModel.tableData : userViewModel.tableData;
  const activeValidationMessage =
    selectedMode === "admin" ? adminViewModel.locationError : userViewModel.riverError;
  const canShowBottomPanel = activeTableData.length > 0 || Boolean(activeValidationMessage);

  useEffect(() => {
    if (canShowBottomPanel) {
      setIsBottomPanelOpen(true);
    }
  }, [canShowBottomPanel, selectedMode]);

  const leftPanelContent = selectedMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;
  const mapContent = selectedMode === "admin" ? <AdminMapView /> : <UserMapView />;

  const rightPanelContent =
    selectedMode === "admin"
      ? adminCanShowRightPanel ? (
          <AdminRightPanel
            isOpen={adminViewModel.isRightPanelOpen}
            width={rightPanelWidth}
            showCategories={adminShowCategories}
            categoriesEditable={adminViewModel.categoriesEditable}
            pumpingProcess={adminViewModel.stpProcess}
            toggleCategoriesEditable={adminViewModel.toggleCategoriesEditable}
            onClose={() => adminViewModel.setRightPanelOpen(false)}
            handleSubmit={adminViewModel.handleSubmit}
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
            categoriesEditable={userViewModel.categoriesEditable}
            pumpingProcess={userViewModel.pumpingProcess}
            toggleCategoriesEditable={userViewModel.toggleCategoriesEditable}
            onClose={() => userViewModel.setRightPanelOpen(false)}
            handleSubmit={userViewModel.handleSubmit}
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
            isDark={isDark}
          />
        ) : null
      : userCanShowRightPanel ? (
          <RightPanelToggle
            isOpen={userViewModel.isRightPanelOpen}
            openOffset={rightPanelWidth}
            onToggle={userViewModel.toggleRightPanel}
            isDark={isDark}
          />
        ) : null;

  const bottomPanelContent = canShowBottomPanel
    ? selectedMode === "admin" ? (
        <AdminBottomResultsPanel
          isOpen={isBottomPanelOpen}
          height={bottomPanelHeight}
          tableData={activeTableData}
          validationMessage={activeValidationMessage}
          panelSettings={panelSettings.bottom}
          isMobile={isMobile}
          onToggle={() => setIsBottomPanelOpen((open) => !open)}
        />
      ) : (
        <UserBottomResultsPanel
          isOpen={isBottomPanelOpen}
          height={bottomPanelHeight}
          tableData={activeTableData}
          validationMessage={activeValidationMessage}
          panelSettings={panelSettings.bottom}
          isMobile={isMobile}
          onToggle={() => setIsBottomPanelOpen((open) => !open)}
        />
      )
    : null;

  const loadingVisible =
    selectedMode === "admin"
      ? adminViewModel.loading ||
        adminViewModel.isMapLoading ||
        adminViewModel.stpOperation ||
        adminViewModel.locationLoading ||
        adminViewModel.categoryLoading
      : userViewModel.loading ||
        userViewModel.isMapLoading ||
        userViewModel.pumpingOperation ||
        userViewModel.riverLoading ||
        userViewModel.categoryLoading;

  const isActiveOperation =
    selectedMode === "admin" ? adminViewModel.stpOperation : userViewModel.pumpingOperation;

  const pageLayout = (
    <>
      <WholeLoading
        visible={loadingVisible}
        title={isActiveOperation ? "Analyzing pumping locations" : "Loading Resources"}
        message={
          isActiveOperation
            ? "Analyzing selected categories and generating pumping raster..."
            : "Fetching map data and initializing components..."
        }
      />
      <PageLayout
        title="Groundwater Pumping Location"
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
        bottomPanel={bottomPanelContent}
        isBottomOpen={canShowBottomPanel && isBottomPanelOpen}
        bottomPanelOpenHeight={bottomPanelHeight}
        bottomPanelClosedHeight={panelSettings.bottom.heightClosed}
        isLeftOpen={isPanelOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsPanelOpen((open) => !open)}
        isDark={isDark}
      />
      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Groundwater Pumping Location"
        imageSrc="/Images/modules/Layer_0.png"
        imageAlt="Pumping Location Information"
        points={[
          "Identifies groundwater pumping location zones based on selected condition and constraint rasters.",
          "Supports administrative and river-drain based selection workflows in a single module shell.",
          "Validates uploaded and manually plotted well-points against the generated pumping raster.",
        ]}
        learnMoreHref="/dss/home/home_grid/home_card/basic_module"
        learnMoreLabel="Learn more about Pumping Location"
      />
    </>
  );

  if (selectedMode === "admin") {
    return <AdminDataInit>{pageLayout}</AdminDataInit>;
  }

  return <UserDataInit>{pageLayout}</UserDataInit>;
}
