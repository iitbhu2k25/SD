"use client";

import React, { useState } from "react";
import { MapMode, getMapModeInfo, getNextMapMode } from "./config/mapModes";
import { stpPriorityPanelSettings } from "./config/panels.config";
import UserDataInit from "./users/components/UserDataInit";
import UserLeftPanel from "./users/components/UserLeftPanel";
import UserMainView from "./users/components/UserMainView";
import PageLayout from "./shared/layout/PageLayout";
import AdminDataInit from "./admin/components/AdminDataInit";
import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import AdminMainView from "./admin/components/AdminMainView";
import ModuleInfoModal from "./shared/ui/ModuleInfoModal";

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
);

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

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

export default function StpPriorityV2Page() {
  const [selectedMode, setSelectedMode] = useState<MapMode>("admin");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(
    stpPriorityPanelSettings.left.defaultOpen,
  );
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const activeModeInfo = getMapModeInfo(selectedMode);
  const nextMode = getNextMapMode(selectedMode);
  const nextModeInfo = getMapModeInfo(nextMode);

  const handleViewChange = (): void => {
    setSelectedMode((prev) => getNextMapMode(prev));
    setIsPanelOpen(true);
  };

  const railItems = [
    {
      id: "filter",
      icon: <FilterIcon />,
      label: "Filters",
      tooltip: "Selection Panel",
      onClick: () => setIsPanelOpen((open) => !open),
      isActive: isPanelOpen,
    },
    {
      id: "view",
      icon: selectedMode === "admin" ? <AdminIcon /> : <DrainIcon />,
      label: activeModeInfo.shortLabel,
      tooltip: `Switch to ${nextModeInfo.shortLabel}`,
      onClick: handleViewChange,
      isActive: false,
    },
    {
      id: "info",
      icon: <InfoIcon />,
      label: "Info",
      tooltip: "Module Info",
      onClick: () => setShowInfo(true),
      isActive: false,
    },
  ];

  const leftPanelContent =
    selectedMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;

  const mainContent =
    selectedMode === "admin" ? <AdminMainView /> : <UserMainView />;

  const pageLayout = (
    <>
      <PageLayout
        title="STP Priority"
        badge={activeModeInfo.label}
        badgeClassName={activeModeInfo.badgeClassName}
        config={stpPriorityPanelSettings}
        railItems={railItems}
        leftPanel={leftPanelContent}
        center={mainContent}
        isLeftOpen={isPanelOpen}
        onToggleLeft={() => setIsPanelOpen((open) => !open)}
        onCloseLeft={() => setIsPanelOpen(false)}
      />
      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="STP Priority System"
        imageSrc="/Images/modules/image_25.png"
        imageAlt="STP Priority Information"
        points={[
          "STP Priority helps find sewage priority risk hot-spot areas.",
          "It uses GIS layers like sewerage, demography, land use, and groundwater.",
          "The final output can also be generated as a PDF report.",
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
