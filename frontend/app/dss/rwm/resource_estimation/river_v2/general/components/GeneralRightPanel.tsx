"use client";

import React, { useCallback, useRef } from "react";
import CloseIcon from "@/components/dss_common/CloseIcon";
import CollapsibleAnalysisSection from "../../components/CollapsibleAnalysisSection";
import type { RightPanelSettings } from "../../config/panels.config";
import { useUiModeStore } from "../../services/uiModeService";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import GeneralWqiComparisonChart from "./GeneralWqiComparisonChart";
import GeneralWqiSummaryPanel from "./GeneralWqiSummaryPanel";

interface GeneralRightPanelProps {
  isOpen: boolean;
  width: string;
  onClose: () => void;
  onWidthChange?: (width: string) => void;
  panelSettings: RightPanelSettings;
  isMobile?: boolean;
}

export default function GeneralRightPanel({
  isOpen,
  width,
  onClose,
  onWidthChange,
  panelSettings,
  isMobile = false,
}: GeneralRightPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useUiModeStore((s) => s.isDark);
  const {
    upload,
    ui,
    activeResult,
    activeValidPoints,
    activeRejectedPoints,
    datasetLabels,
    rasterComparisonProfiles,
    selectDataset,
    selectWqiClass,
    selectRasterParameter,
    downloadRaster,
    downloadReport,
  } = useGeneralViewModel();

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current || !onWidthChange) return;
        const parent = containerRef.current.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const newWidthPx = parentRect.right - moveEvent.clientX;
        const newWidthPercent = (newWidthPx / parentRect.width) * 100;
        const clamped = Math.min(
          panelSettings.maxWidthPercent,
          Math.max(panelSettings.minWidthPercent, newWidthPercent),
        );
        onWidthChange(`${clamped.toFixed(1)}%`);
      };

      const onMouseUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onWidthChange, panelSettings],
  );

  return (
    <>
      {isOpen && <div className="absolute inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />}
      <div
        ref={containerRef}
        className={`${
          isMobile ? "absolute inset-y-0 right-0 z-40 max-w-full" : "relative z-20 h-full shrink-0"
        } overflow-hidden border-l text-slate-800 shadow-2xl transition-[width] duration-300 ease-in-out ${
          isDark
            ? "border-[#1e3a5f]/50 bg-gradient-to-b from-[#050911] via-[#080e1c] to-[#060c18]"
            : "border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)]"
        } ${isOpen ? "" : "w-0 border-l-0"}`}
        style={{
          width: isOpen
            ? isMobile
              ? panelSettings.mobileWidthOpen
              : width
            : panelSettings.widthClosed,
        }}
      >
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className={`group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center transition-colors lg:flex ${
              isDark ? "hover:bg-cyan-400/10" : "hover:bg-emerald-400/20"
            }`}
          >
            <div
              className={`h-10 w-0.5 rounded-full transition-colors ${
                isDark
                  ? "bg-[#1e3a5f]/60 group-hover:bg-cyan-400"
                  : "bg-stone-300 group-hover:bg-emerald-500"
              }`}
            />
          </div>
        )}

        <div className="flex h-full max-w-full flex-col" style={{ width: "100%" }}>
          <div
            className={`flex shrink-0 items-center justify-between border-b px-3 py-2.5 sm:px-4 sm:py-3 ${
              isDark ? "border-[#1e3a5f]/60 bg-[#050911]" : "border-stone-200/80 bg-[#f5f1ea]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-100 text-purple-700"
                }`}
              >
                G
              </span>
              <h3 className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                General Analysis
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close panel"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                isDark ? "text-slate-400 hover:bg-[#0a1628] hover:text-cyan-300" : "text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {!activeResult || !activeResult.summary ? (
              <section
                className={`rounded-lg border p-4 shadow-sm ${
                  isDark
                    ? "border-[#1e3a5f]/50 bg-[#0d1629]/80 text-slate-200"
                    : "border-stone-200 bg-white/80 text-slate-700"
                }`}
              >
                <h4 className="mb-1 text-sm font-semibold">Waiting for processed datasets</h4>
                <p className="text-xs opacity-75">
                  Upload a shapefile and process at least one CSV to unlock WQI statistics,
                  raster downloads, comparison charts, and PDF output.
                </p>
              </section>
            ) : (
              <div className="animate-fadeIn space-y-3 sm:space-y-4">
                <CollapsibleAnalysisSection
                  title="WQI Summary"
                  badge={activeResult.fileLabel}
                  badgeClassName="bg-purple-100 text-purple-700"
                  description="Processed file statistics, class filters, raster downloads, and PDF output."
                  isDark={isDark}
                  defaultMinimized
                  accentClassName="border-l-purple-400"
                >
                  <GeneralWqiSummaryPanel
                    activeResult={activeResult}
                    datasetLabels={datasetLabels}
                    selectedClass={upload.selectedWqiClass}
                    activeParameter={upload.activeParameter}
                    activeValidPoints={activeValidPoints}
                    activeRejectedPoints={activeRejectedPoints}
                    isDownloadingRaster={ui.isDownloadingRaster}
                    isDownloadingReport={ui.isDownloadingReport}
                    onSelectDataset={selectDataset}
                    onSelectClass={selectWqiClass}
                    onSelectParameter={selectRasterParameter}
                    onDownloadRaster={downloadRaster}
                    onDownloadReport={downloadReport}
                    isDark={isDark}
                  />
                </CollapsibleAnalysisSection>

                {rasterComparisonProfiles.length > 0 && (
                  <CollapsibleAnalysisSection
                    title="Raster Profile Comparison"
                    badge={`${rasterComparisonProfiles.length} Files`}
                    badgeClassName="bg-indigo-100 text-indigo-700"
                    description="Plotly comparison of WQI raster profiles across processed uploads."
                    isDark={isDark}
                    defaultMinimized
                    accentClassName="border-l-indigo-400"
                  >
                    <GeneralWqiComparisonChart data={rasterComparisonProfiles} isDark={isDark} />
                  </CollapsibleAnalysisSection>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
