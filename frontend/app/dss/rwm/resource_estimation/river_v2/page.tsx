"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import WholeLoading from "@/components/app_layout/newLoading";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import { type MapMode, getMapModeInfo } from "./config/mapModes";
import {
  GENERAL_RIGHT_PANEL_CONFIG,
  RIGHT_PANEL_CONFIG,
  rwmRiverPanelSettings,
} from "./config/panels.config";

import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import AdminRightPanel from "./admin/components/AdminRightPanel";
import { useAdminViewModel } from "./admin/hooks/useAdminViewModel";

import DrainLeftPanel from "./drain/components/DrainLeftPanel";
import DrainRightPanel from "./drain/components/DrainRightPanel";
import { useDrainViewModel } from "./drain/hooks/useDrainViewModel";

import GeneralLeftPanel from "./general/components/GeneralLeftPanel";
import GeneralRightPanel from "./general/components/GeneralRightPanel";
import { useGeneralViewModel } from "./general/hooks/useGeneralViewModel";

import { useUiModeStore } from "./services/uiModeService";

const AdminMapView = dynamic(() => import("./admin/components/AdminOpenLayersMap"), { ssr: false });
const DrainMapView = dynamic(() => import("./drain/components/DrainOpenLayersMap"), { ssr: false });
const GeneralMapView = dynamic(() => import("./general/components/GeneralOpenLayersMap"), { ssr: false });

// Icons
const MoonIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const SunIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;

export default function RiverV2Page() {
  const [selectedMode, setSelectedMode] = useState<MapMode>("varuna_admin");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const activeModeInfo = getMapModeInfo(selectedMode);
  
  const isDark = useUiModeStore((s) => s.isDark);
  const toggleTheme = useUiModeStore((s) => s.toggleTheme);
  
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_CONFIG.widthOpen);
  const [isMobile, setIsMobile] = useState(false);

  const adminVM = useAdminViewModel();
  const drainVM = useDrainViewModel();
  const generalVM = useGeneralViewModel();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsMobile(!mq.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const handleModeChange = (mode: MapMode) => {
    setSelectedMode(mode);
    setIsLeftPanelOpen(true);
    setRightPanelWidth(
      mode === "all_india"
        ? GENERAL_RIGHT_PANEL_CONFIG.widthOpen
        : RIGHT_PANEL_CONFIG.widthOpen,
    );
  };

  const railItems = [
    {
      id: "varuna_admin",
      icon: <span className="text-sm font-bold">A</span>,
      label: "Admin",
      tooltip: "Admin Mode (State/District/Sub-district)",
      onClick: () => handleModeChange("varuna_admin"),
      isActive: selectedMode === "varuna_admin",
      activeClassName: isDark ? "bg-blue-700 text-white shadow-lg" : "bg-blue-600 text-white shadow-lg shadow-blue-200",
    },
    {
      id: "varuna_drain",
      icon: <span className="text-sm font-bold">D</span>,
      label: "Drain",
      tooltip: "Drain Mode (River Stretches)",
      onClick: () => handleModeChange("varuna_drain"),
      isActive: selectedMode === "varuna_drain",
      activeClassName: isDark ? "bg-emerald-700 text-white shadow-lg" : "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
    {
      id: "all_india",
      icon: <span className="text-sm font-bold">G</span>,
      label: "General",
      tooltip: "General Mode (Custom Vectors & CSV)",
      onClick: () => handleModeChange("all_india"),
      isActive: selectedMode === "all_india",
      activeClassName: isDark ? "bg-purple-700 text-white shadow-lg" : "bg-purple-600 text-white shadow-lg shadow-purple-200",
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

  // Map active states based on mode
  let leftPanelContent, rightPanelContent, mapContent, rightPanelToggle, isLoadingVisible;

  // Configuration routing depending on the active Mode enum
  switch (selectedMode) {
    case "varuna_admin":
      leftPanelContent = <AdminLeftPanel />;
      mapContent = <AdminMapView />;
      rightPanelContent = (
        <AdminRightPanel
          isOpen={adminVM.ui.isRightPanelOpen}
          width={rightPanelWidth}
          onClose={() => adminVM.ui.setRightPanelOpen(false)}
          onWidthChange={setRightPanelWidth}
          panelSettings={RIGHT_PANEL_CONFIG}
          isMobile={isMobile}
        />
      );
      rightPanelToggle = (
        <RightPanelToggle
          isOpen={adminVM.ui.isRightPanelOpen}
          openOffset={rightPanelWidth}
          onToggle={() => adminVM.ui.setRightPanelOpen(!adminVM.ui.isRightPanelOpen)}
          isDark={isDark}
        />
      );
      isLoadingVisible = adminVM.location.isLoading || adminVM.map.isMapLayersLoading;
      break;

    case "varuna_drain":
      leftPanelContent = <DrainLeftPanel />;
      mapContent = <DrainMapView />;
      rightPanelContent = (
        <DrainRightPanel
          isOpen={drainVM.ui.isRightPanelOpen}
          width={rightPanelWidth}
          onClose={() => drainVM.ui.setRightPanelOpen(false)}
          onWidthChange={setRightPanelWidth}
          panelSettings={RIGHT_PANEL_CONFIG}
          isMobile={isMobile}
        />
      );
      rightPanelToggle = (
        <RightPanelToggle
          isOpen={drainVM.ui.isRightPanelOpen}
          openOffset={rightPanelWidth}
          onToggle={() => drainVM.ui.setRightPanelOpen(!drainVM.ui.isRightPanelOpen)}
          isDark={isDark}
        />
      );
      isLoadingVisible = drainVM.location.isLoading || drainVM.map.isMapLayersLoading;
      break;

    case "all_india":
      leftPanelContent = <GeneralLeftPanel />;
      mapContent = <GeneralMapView />;
      rightPanelContent = (
        <GeneralRightPanel
          isOpen={generalVM.ui.isRightPanelOpen}
          width={rightPanelWidth}
          onClose={() => generalVM.ui.setRightPanelOpen(false)}
          onWidthChange={setRightPanelWidth}
          panelSettings={GENERAL_RIGHT_PANEL_CONFIG}
          isMobile={isMobile}
        />
      );
      rightPanelToggle = (
        <RightPanelToggle
          isOpen={generalVM.ui.isRightPanelOpen}
          openOffset={rightPanelWidth}
          onToggle={() => generalVM.ui.setRightPanelOpen(!generalVM.ui.isRightPanelOpen)}
          isDark={isDark}
        />
      );
      isLoadingVisible = false;
      break;
  }

  return (
    <>
      <WholeLoading
        visible={isLoadingVisible}
        title="Loading Resources"
        message="Fetching river parameters and geometries..."
      />

      <PageLayout
        title="River Resource Estimation"
        badge={activeModeInfo.label}
        badgeClassName={activeModeInfo.badgeClassName}
        onTitleInfoClick={() => setShowInfo(true)}
        titleInfoTooltip="Module info"
        config={rwmRiverPanelSettings}
        railItems={railItems}
        leftPanel={leftPanelContent}
        mapContent={mapContent}
        rightPanel={rightPanelContent}
        rightPanelToggle={rightPanelToggle}
        isLeftOpen={isLeftPanelOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        isDark={isDark}
      />

      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="River Resource Estimation"
        imageSrc="/Images/modules/river_resource_estimation.gif"
        imageAlt="River Module"
        points={[
          "Analyze water quality indices combining primary and secondary data.",
          "Identify contamination zones via geospatial buffer analysis (200m trace).",
          "Compare pre-monsoon, monsoon, and post-monsoon pollution profiles.",
          "Generate comprehensive PDF investigation reports natively.",
        ]}
        learnMoreHref="/dss/home/home_grid/home_card/basic_module"
        learnMoreLabel="Learn more about River module"
      />
    </>
  );
}
