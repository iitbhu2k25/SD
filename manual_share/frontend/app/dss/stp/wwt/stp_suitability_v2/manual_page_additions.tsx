// ============================================================
// MANUAL MODE — page.tsx INTEGRATION GUIDE
//
// This file lives next to page.tsx (same folder).
// Your page.tsx already has "admin" and "user" (drain) modes.
// Follow the numbered steps below to add "manual" mode.
//
// Folder: frontend/app/dss/stp/wwt/stp_suitability_v2/
// ============================================================


// ══════════════════════════════════════════════════════════════
// STEP 1 — Add these imports at the top of page.tsx
//           (after your existing admin/user imports)
// ══════════════════════════════════════════════════════════════

import ManualBottomResultsPanel from "./manual/components/ManualBottomResultsPanel";
import ManualMultiResultsPanel from "./manual/components/ManualMultiResultsPanel";
import ManualDataInit from "./manual/components/ManualDataInit";
import ManualLeftPanel from "./manual/components/ManualLeftPanel";
import ManualRightPanel from "./manual/components/ManualRightPanel";
import { useManualAreaStore } from "./manual/stores/manualAreaStore";
import { useManualMapStore } from "./manual/stores/manualMapStore";
import { useManualMultiStore } from "./manual/stores/manualMultiStore";
import { useManualViewModel } from "./manual/hooks/useManualViewModel";

// Dynamic import (add alongside AdminMapView / UserMapView)
const ManualMapView = dynamic(() => import("./manual/components/ManualOpenLayersMap"), {
  ssr: false,
});

// Icon component (add alongside AdminIcon / DrainIcon)
const ManualIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  </svg>
);


// ══════════════════════════════════════════════════════════════
// STEP 2 — Add inside StpSuitabilityV2Page(), after userViewModel
// ══════════════════════════════════════════════════════════════

  const manualViewModel = useManualViewModel();
  const multiSelectionsLocked = useManualMultiStore((s) => s.selectionsLocked);


// ══════════════════════════════════════════════════════════════
// STEP 3 — Add "manual" entry to the railItems array
//           (after your drain/user entry)
// ══════════════════════════════════════════════════════════════

    {
      id: "manual",
      icon: <ManualIcon />,
      label: "Manual",
      tooltip: "Manual area selection",
      onClick: () => handleModeChange("manual"),
      isActive: selectedMode === "manual",
      activeClassName: "bg-violet-600 text-white shadow-lg shadow-violet-200",
    },


// ══════════════════════════════════════════════════════════════
// STEP 4 — Update canShowRightPanel logic
//           Replace your existing shouldShowRightPanelToggle block
// ══════════════════════════════════════════════════════════════

  const adminCanShowRightPanel = adminViewModel.selectionsLocked;
  const userCanShowRightPanel = userViewModel.selectionsLocked;
  const manualCanShowRightPanel = manualViewModel.selectionsLocked || multiSelectionsLocked;
  const shouldShowRightPanelToggle =
    selectedMode === "admin"
      ? adminCanShowRightPanel
      : selectedMode === "user"
        ? userCanShowRightPanel
        : manualCanShowRightPanel;


// ══════════════════════════════════════════════════════════════
// STEP 5 — Update leftPanel ternary (add manual case at end)
// ══════════════════════════════════════════════════════════════

  const leftPanel =
    selectedMode === "admin"
      ? <AdminLeftPanel />
      : selectedMode === "user"
        ? <UserLeftPanel />
        : <ManualLeftPanel />;


// ══════════════════════════════════════════════════════════════
// STEP 6 — Update mapContent ternary (add manual case at end)
// ══════════════════════════════════════════════════════════════

  const mapContent =
    selectedMode === "admin"
      ? <AdminMapView />
      : selectedMode === "user"
        ? <UserMapView />
        : <ManualMapView />;


// ══════════════════════════════════════════════════════════════
// STEP 7 — Add handleManualRedrawPolygon callback
//           (after your handleUserAnalyze function)
// ══════════════════════════════════════════════════════════════

  const handleManualRedrawPolygon = useCallback(() => {
    manualViewModel.setRightPanelOpen(false);
    useManualMapStore.getState().resetMapView();
    useManualAreaStore.getState().unlockSelections();
    useManualAreaStore.getState().setSelectedMethod("polygon");
    useManualMapStore.getState().setDrawingActive(true);
  }, [manualViewModel]);


// ══════════════════════════════════════════════════════════════
// STEP 8 — Update rightPanel ternary
//           Replace the last ": null" in your rightPanel with:
// ══════════════════════════════════════════════════════════════

        : manualCanShowRightPanel
          ? (
              <ManualRightPanel
                isOpen={manualViewModel.isRightPanelOpen}
                width={rightPanelWidth}
                widthPercent={rightPanelWidthPercent}
                minWidthPercent={panelSettings.right.minWidthPercent}
                maxWidthPercent={panelSettings.right.maxWidthPercent}
                onWidthChange={handleRightPanelWidthChange}
                onClose={() => manualViewModel.setRightPanelOpen(false)}
                isMobile={isMobile}
                isTreatmentLoading={manualViewModel.treatmentLoading}
                canFindTechnologyArea={manualViewModel.canFindTechnologyArea}
                drainCapacityMld={manualViewModel.drainCapacityMld}
                markedAreaHa={manualViewModel.markedAreaHa}
                handleTechnologyAreaSubmit={manualViewModel.handleTechnologyAreaSubmit}
                onRedrawPolygon={handleManualRedrawPolygon}
              />
            )
          : null;


// ══════════════════════════════════════════════════════════════
// STEP 9 — Update RightPanelToggle props (isOpen and onToggle)
// ══════════════════════════════════════════════════════════════

      isOpen={
        selectedMode === "admin"
          ? adminViewModel.isRightPanelOpen
          : selectedMode === "user"
            ? userViewModel.isRightPanelOpen
            : manualViewModel.isRightPanelOpen
      }
      onToggle={
        selectedMode === "admin"
          ? adminViewModel.toggleRightPanel
          : selectedMode === "user"
            ? userViewModel.toggleRightPanel
            : manualViewModel.toggleRightPanel
      }


// ══════════════════════════════════════════════════════════════
// STEP 10 — Update bottomPanel ternary
//            Replace the last else branch with:
// ══════════════════════════════════════════════════════════════

        : (
            <>
              <ManualBottomResultsPanel
                isOpen={isBottomPanelOpen}
                height={bottomPanelHeight}
                tableData={activeTableData}
                panelSettings={panelSettings.bottom}
                isMobile={isMobile}
                isPdfGenerating={activeIsPdfGenerating}
                onToggle={() => setIsBottomPanelOpen((open) => !open)}
                onReport={activeHandleReport}
              />
              <ManualMultiResultsPanel />
            </>
          )


// ══════════════════════════════════════════════════════════════
// STEP 11 — Update all loading / state ternaries
//            For each one that ends in ": userViewModel.X",
//            extend it to ": manualViewModel.X" like below.
//
//  NOTE: activeTableData stays [] for manual (manual uses its
//        own bottom panel driven by manualCategoryStore.tableData
//        accessed inside ManualBottomResultsPanel directly).
// ══════════════════════════════════════════════════════════════

  // loadingVisible — replace the last branch:
        : manualViewModel.loading ||
          manualViewModel.isMapLoading ||
          manualViewModel.reportLoading ||
          manualViewModel.treatmentLoading ||
          manualViewModel.areaLoading;

  // isActiveStpOperation — replace last branch:
        : manualViewModel.stpOperation;

  // isActiveReportLoading — replace last branch:
        : manualViewModel.reportLoading;

  // isActiveTreatmentLoading — replace last branch:
        : manualViewModel.treatmentLoading;

  // activeIsPdfGenerating — replace last branch:
        : manualViewModel.isPdfGenerating;

  // showPdfStatus — replace last branch:
        : manualViewModel.showPdfStatus;

  // taskId — replace last branch:
        : manualViewModel.taskId;

  // handlePdfComplete — replace last branch:
        : manualViewModel.completePdfGeneration;

  // handlePdfFailure — replace last branch:
        : manualViewModel.failPdfGeneration;


// ══════════════════════════════════════════════════════════════
// STEP 12 — Update the return at the bottom of the function
//            Add the manual case after admin and user
// ══════════════════════════════════════════════════════════════

  if (selectedMode === "admin") {
    return <AdminDataInit>{pageLayout}</AdminDataInit>;
  }

  if (selectedMode === "user") {
    return <UserDataInit>{pageLayout}</UserDataInit>;
  }

  return <ManualDataInit>{pageLayout}</ManualDataInit>;


// ══════════════════════════════════════════════════════════════
// REFERENCE — Complete final page.tsx after all steps applied
// ══════════════════════════════════════════════════════════════
//
// "use client";
//
// import WholeLoading from "@/components/app_layout/newLoading";
// import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
// import PageLayout from "@/components/dss_common/PageLayout";
// import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
// import dynamic from "next/dynamic";
// import { useCallback, useEffect, useRef, useState } from "react";
// import StpSuitabilityPdfGenerationStatus from "./PdfGenerationStatus";
// import AdminBottomResultsPanel from "./admin/components/AdminBottomResultsPanel";
// import AdminDataInit from "./admin/components/AdminDataInit";
// import AdminLeftPanel from "./admin/components/AdminLeftPanel";
// import AdminRightPanel from "./admin/components/AdminRightPanel";
// import { useAdminViewModel } from "./admin/hooks/useAdminViewModel";
// import type { MapMode } from "./config/mapModes";
// import { getMapModeInfo } from "./config/mapModes";
// import { stpSuitabilityPanelSettings } from "./config/panels.config";
// import ManualBottomResultsPanel from "./manual/components/ManualBottomResultsPanel";
// import ManualMultiResultsPanel from "./manual/components/ManualMultiResultsPanel";
// import ManualDataInit from "./manual/components/ManualDataInit";
// import ManualLeftPanel from "./manual/components/ManualLeftPanel";
// import ManualRightPanel from "./manual/components/ManualRightPanel";
// import { useManualAreaStore } from "./manual/stores/manualAreaStore";
// import { useManualMapStore } from "./manual/stores/manualMapStore";
// import { useManualMultiStore } from "./manual/stores/manualMultiStore";
// import { useManualViewModel } from "./manual/hooks/useManualViewModel";
// import UserBottomResultsPanel from "./users/components/UserBottomResultsPanel";
// import UserDataInit from "./users/components/UserDataInit";
// import UserLeftPanel from "./users/components/UserLeftPanel";
// import UserRightPanel from "./users/components/UserRightPanel";
// import { useUserViewModel } from "./users/hooks/useUserViewModel";
//
// const AdminMapView = dynamic(() => import("./admin/components/AdminOpenLayersMap"), { ssr: false });
// const UserMapView  = dynamic(() => import("./users/components/UserOpenLayersMap"),  { ssr: false });
// const ManualMapView = dynamic(() => import("./manual/components/ManualOpenLayersMap"), { ssr: false });
//
// ... (AdminIcon, DrainIcon, ManualIcon SVGs) ...
//
// export default function StpSuitabilityV2Page() {
//   ... (all state, viewModels, railItems, panels as shown above) ...
//
//   if (selectedMode === "admin") return <AdminDataInit>{pageLayout}</AdminDataInit>;
//   if (selectedMode === "user")  return <UserDataInit>{pageLayout}</UserDataInit>;
//   return <ManualDataInit>{pageLayout}</ManualDataInit>;
// }
