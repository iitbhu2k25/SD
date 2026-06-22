"use client";

import WholeLoading from "@/components/app_layout/newLoading";
import ModuleInfoModal from "@/components/dss_common/ModuleInfoModal";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import StpSuitabilityPdfGenerationStatus from "../PdfGenerationStatus";
import ManualBottomResultsPanel from "./components/ManualBottomResultsPanel";
import ManualMultiResultsPanel from "./components/ManualMultiResultsPanel";
import ManualDataInit from "./components/ManualDataInit";
import ManualLeftPanel from "./components/ManualLeftPanel";
import ManualRightPanel from "./components/ManualRightPanel";
import { useManualAreaStore } from "./stores/manualAreaStore";
import { useManualMapStore } from "./stores/manualMapStore";
import { useManualMultiStore } from "./stores/manualMultiStore";
import { useManualViewModel } from "./hooks/useManualViewModel";
import { stpSuitabilityPanelSettings } from "../config/panels.config";

const ManualMapView = dynamic(() => import("./components/ManualOpenLayersMap"), {
  ssr: false,
});

export default function ManualPage() {
  const panelSettings = stpSuitabilityPanelSettings;
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [rightPanelWidthPercent, setRightPanelWidthPercent] = useState(
    Number.parseInt(panelSettings.right.widthOpen, 10) || panelSettings.right.minWidthPercent,
  );
  const [bottomPanelHeight, setBottomPanelHeight] = useState(panelSettings.bottom.heightOpen);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(panelSettings.bottom.defaultOpen);

  const manualViewModel = useManualViewModel();
  const multiSelectionsLocked = useManualMultiStore((s) => s.selectionsLocked);

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

  const manualCanShowRightPanel = manualViewModel.selectionsLocked || multiSelectionsLocked;

  const handleRightPanelWidthChange = (value: number) => {
    setRightPanelWidthPercent(
      Math.min(
        panelSettings.right.maxWidthPercent,
        Math.max(panelSettings.right.minWidthPercent, value),
      ),
    );
  };

  const handleManualRedrawPolygon = useCallback(() => {
    manualViewModel.setRightPanelOpen(false);
    useManualMapStore.getState().resetMapView();
    useManualAreaStore.getState().unlockSelections();
    useManualAreaStore.getState().setSelectedMethod("polygon");
    useManualMapStore.getState().setDrawingActive(true);
  }, [manualViewModel]);

  const rightPanel = manualCanShowRightPanel ? (
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
  ) : null;

  const rightPanelToggle = manualCanShowRightPanel ? (
    <RightPanelToggle
      isOpen={manualViewModel.isRightPanelOpen}
      openOffset={rightPanelWidth}
      onToggle={manualViewModel.toggleRightPanel}
    />
  ) : null;

  const bottomPanel = (
    <>
      <ManualBottomResultsPanel
        isOpen={isBottomPanelOpen}
        height={bottomPanelHeight}
        tableData={[]}
        panelSettings={panelSettings.bottom}
        isMobile={isMobile}
        isPdfGenerating={manualViewModel.isPdfGenerating}
        onToggle={() => setIsBottomPanelOpen((open) => !open)}
        onReport={undefined}
      />
      <ManualMultiResultsPanel />
    </>
  );

  const loadingVisible =
    manualViewModel.loading ||
    manualViewModel.isMapLoading ||
    manualViewModel.reportLoading ||
    manualViewModel.treatmentLoading ||
    manualViewModel.areaLoading;

  const pageLayout = (
    <>
      <WholeLoading
        visible={loadingVisible}
        title={
          manualViewModel.isMapLoading
            ? "Analyzing STP suitability"
            : manualViewModel.reportLoading
              ? "Generating report for STP suitability"
              : manualViewModel.treatmentLoading
                ? "Finding treatment cluster"
                : "Loading Resources"
        }
        message={
          manualViewModel.isMapLoading
            ? "Analyzing site suitability and generating results..."
            : manualViewModel.reportLoading
              ? "Generating report, please wait..."
              : manualViewModel.treatmentLoading
                ? "Evaluating treatment land requirement and locating clusters..."
                : "Fetching map data and initializing components..."
        }
      />

      <PageLayout
        title="STP Suitability"
        badge="Manual Area"
        badgeClassName="bg-violet-100 text-violet-700 border border-violet-200"
        onTitleInfoClick={() => setShowInfo(true)}
        titleInfoTooltip="Module info"
        config={panelSettings}
        railItems={[]}
        leftPanel={<ManualLeftPanel />}
        mapContent={<ManualMapView />}
        rightPanel={rightPanel}
        rightPanelToggle={rightPanelToggle}
        bottomPanel={bottomPanel}
        isBottomOpen={isBottomPanelOpen}
        bottomPanelOpenHeight={bottomPanelHeight}
        bottomPanelClosedHeight={panelSettings.bottom.heightClosed}
        isLeftOpen={isLeftOpen}
        isMobile={isMobile}
        onToggleLeft={() => setIsLeftOpen((current) => !current)}
        onCloseLeft={() => setIsLeftOpen(false)}
      />

      {manualViewModel.showPdfStatus && manualViewModel.taskId && (
        <StpSuitabilityPdfGenerationStatus
          taskId={manualViewModel.taskId}
          onComplete={manualViewModel.completePdfGeneration}
          onFailure={manualViewModel.failPdfGeneration}
        />
      )}

      <ModuleInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="STP Suitability — Manual Area"
        imageSrc="/Images/modules/image_30.png"
        imageAlt="STP Suitability module information"
        points={[
          "Manual mode allows custom area selection by uploading shapefiles, drawing polygons, or uploading KML files.",
          "Suitable locations are identified using GIS-based conditioning layers and constraint layers.",
          "The model enables pin-point identification of STP locations for desired capacity and selected technologies.",
          "Final output related to sewage site suitability can be generated in PDF format.",
        ]}
        learnMoreHref="/dss/home/home_grid/home_card/basic_module"
        learnMoreLabel="Learn more about STP Suitability"
      />
    </>
  );

  return <ManualDataInit>{pageLayout}</ManualDataInit>;
}
