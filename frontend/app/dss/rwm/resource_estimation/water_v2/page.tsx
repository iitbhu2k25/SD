"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import { MapMode, getMapModeInfo } from "./config/mapModes";
import { waterV2PanelSettings } from "./config/panels.config";
import { useUiModeService } from "./services/uiModeService";
import AdminDataInit from "./admin/components/AdminDataInit";
import AdminLeftPanel from "./admin/components/AdminLeftPanel";
import UserDataInit from "./users/components/UserDataInit";
import UserLeftPanel from "./users/components/UserLeftPanel";
import { useAdminLocationStore } from "./admin/stores/adminLocationStore";
import { useAdminMapStore } from "./admin/stores/adminMapStore";
import { useAdminUiStore } from "./admin/stores/adminUiStore";
import { useUserRiverStore } from "./users/stores/userRiverStore";
import { useUserMapStore } from "./users/stores/userMapStore";
import { useUserUiStore } from "./users/stores/userUiStore";

const AdminOpenLayersMap = dynamic(
  () => import("./admin/components/AdminOpenLayersMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    ),
  },
);

const UserOpenLayersMap = dynamic(
  () => import("./users/components/UserOpenLayersMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
      </div>
    ),
  },
);

const AdminRightPanel = dynamic(() => import("./admin/components/AdminRightPanel"), {
  ssr: false,
});
const UserRightPanel = dynamic(() => import("./users/components/UserRightPanel"), {
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

const BasinIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
    />
  </svg>
);

const InfoIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

export default function WaterV2Page() {
  const [activeMode, setActiveMode] = useState<MapMode>("admin");
  const [isLeftOpen, setIsLeftOpen] = useState<boolean>(
    waterV2PanelSettings.left.defaultOpen,
  );
  const [rightPanelWidth] = useState<string>(waterV2PanelSettings.right.widthOpen);
  const [isRightOpen, setIsRightOpen] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const { isDark } = useUiModeService();
  const adminRightPanelUnlocked = useAdminUiStore((s) => s.rightPanelUnlocked);
  const userRightPanelUnlocked = useUserUiStore((s) => s.rightPanelUnlocked);
  const rightPanelUnlocked =
    activeMode === "admin" ? adminRightPanelUnlocked : userRightPanelUnlocked;
  const activeModeInfo = getMapModeInfo(activeMode);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (rightPanelUnlocked) {
      setIsRightOpen(true);
    }
  }, [rightPanelUnlocked]);

  useEffect(() => {
    setIsRightOpen(false);
  }, [activeMode]);

  const resetAllModeState = () => {
    useAdminLocationStore.getState().resetSelections();
    useAdminMapStore.getState().resetMapState();
    useAdminUiStore.getState().resetUiState();
    useUserRiverStore.getState().resetSelections();
    useUserMapStore.getState().resetMapState();
    useUserUiStore.getState().resetUiState();
  };

  const switchMode = (nextMode: MapMode) => {
    if (nextMode === activeMode) return;
    resetAllModeState();
    setActiveMode(nextMode);
    setIsLeftOpen(true);
  };

  const railItems = [
    {
      id: "admin",
      icon: <AdminIcon />,
      label: "Admin",
      tooltip: "Admin Mode",
      onClick: () => switchMode("admin"),
      isActive: activeMode === "admin",
    },
    {
      id: "basin",
      icon: <BasinIcon />,
      label: "Basin",
      tooltip: "Basin Mode",
      onClick: () => switchMode("user"),
      isActive: activeMode === "user",
    },
    {
      id: "info",
      icon: <InfoIcon />,
      label: "Info",
      tooltip: "Module Info",
      onClick: () => setShowInfo(true),
      isActive: false,
    },
    {
      id: "toggle",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isLeftOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          )}
        </svg>
      ),
      label: isLeftOpen ? "Close" : "Open",
      tooltip: isLeftOpen ? "Close Panel" : "Open Panel",
      onClick: () => setIsLeftOpen((open) => !open),
      isActive: isLeftOpen,
    },
  ];

  const leftPanel = activeMode === "admin" ? <AdminLeftPanel /> : <UserLeftPanel />;
  const mapContent =
    activeMode === "admin" ? <AdminOpenLayersMap /> : <UserOpenLayersMap />;

  const rightPanel = isRightOpen ? (
    <div
      className={`relative flex-shrink-0 overflow-hidden border-l transition-[width] duration-300 ease-in-out ${
        isDark ? "border-[#1e3a5f]/50 bg-[#080e1c]" : "border-stone-200 bg-white"
      }`}
      style={{
        width: isMobile ? waterV2PanelSettings.right.mobileWidthOpen : rightPanelWidth,
      }}
    >
      {activeMode === "admin" ? <AdminRightPanel /> : <UserRightPanel />}
    </div>
  ) : null;

  const rightPanelToggle = rightPanelUnlocked ? (
    <RightPanelToggle
      isOpen={isRightOpen}
      onToggle={() => setIsRightOpen((open) => !open)}
      openOffset={isRightOpen ? rightPanelWidth : "0px"}
      isDark={isDark}
    />
  ) : null;

  const pageLayout = (
    <>
      <PageLayout
        title="Water Availability"
        badge={activeModeInfo.label}
        badgeClassName={activeModeInfo.badgeClassName}
        config={waterV2PanelSettings}
        railItems={railItems}
        leftPanel={leftPanel}
        mapContent={mapContent}
        rightPanel={rightPanel}
        rightPanelToggle={rightPanelToggle}
        isLeftOpen={isLeftOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsLeftOpen((open) => !open)}
        onCloseLeft={() => setIsLeftOpen(false)}
        isDark={isDark}
        hideHeader
      />
      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Water Availability"
        imageSrc="/Images/modules/water_availability.png"
        imageAlt="Water Availability Module"
        points={[
          "Shows water balance computed from precipitation minus evapotranspiration minus runoff.",
          "Supports 4 product types: Water Budget (MLD), Surplus, Deficit, and SWCI Index.",
          "Select by administrative boundary (Admin) or river system (Basin).",
          "Reports can be generated as a PDF for the selected area and time period.",
        ]}
        learnMoreHref="/dss/home"
        learnMoreLabel="Learn more about Water Availability"
      />
    </>
  );

  if (activeMode === "admin") {
    return <AdminDataInit>{pageLayout}</AdminDataInit>;
  }

  return <UserDataInit>{pageLayout}</UserDataInit>;
}
