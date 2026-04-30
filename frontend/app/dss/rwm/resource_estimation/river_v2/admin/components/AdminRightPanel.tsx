"use client";

import React, { useCallback, useMemo, useRef } from "react";
import type { RightPanelSettings } from "../../config/panels.config";
import { useAdminViewModel } from "../hooks/useAdminViewModel";
import { useUiModeStore } from "../../services/uiModeService";
import ChartStickyHeader from "../../components/ChartStickyHeader";
import CollapsibleAnalysisSection from "../../components/CollapsibleAnalysisSection";
import PdfReportBuilder from "../../components/PdfReportBuilder";
import {
  LocationTypeSummaryTab,
  SamplingLocationsTab,
  SeasonalComparisonTab,
} from "../../components/AnalysisTabs";

import {
  WQ_PARAMETERS,
  attributeLabels,
  qualityThresholds,
  getWQIInfo,
  parseStringValue,
  CHART_TO_BACKEND_ATTRIBUTE,
} from "../../utils/chartFormatters";

const borderColors: Record<string, string> = {
  Drain: "rgba(244, 114, 182, 1)",
  Upstream: "rgba(59, 130, 246, 1)",
  Downstream: "rgba(132, 204, 22, 1)",
};

interface AdminRightPanelProps {
  isOpen: boolean;
  width: string;
  onClose: () => void;
  onWidthChange?: (width: string) => void;
  panelSettings: RightPanelSettings;
  isMobile?: boolean;
}

export default function AdminRightPanel({
  isOpen,
  width,
  onClose,
  onWidthChange,
  panelSettings,
  isMobile = false,
}: AdminRightPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useUiModeStore((s) => s.isDark);
  const { location, chart } = useAdminViewModel();

  const { areaConfirmed } = location;
  const {
    processedChartData,
    comparisonTableData,
    selectedAttribute,
    setSelectedAttribute,
  } = chart;
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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

  const filteredData = processedChartData;

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const values = filteredData
      .map((row) => parseStringValue(row[selectedAttribute] as string | number))
      .filter((v) => v !== 0);

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: (sum / values.length).toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2),
      count: values.length,
    };
  }, [filteredData, selectedAttribute]);

  const wqiMean = useMemo(() => {
    if (filteredData.length === 0) return null;

    const wqiValues = filteredData
      .map((item) => parseStringValue(item.wqi))
      .filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

    if (wqiValues.length === 0) return null;

    return (
      wqiValues.reduce((sum, val) => sum + val, 0) / wqiValues.length
    ).toFixed(2);
  }, [filteredData]);

  const wqiInfo = useMemo(() => getWQIInfo(wqiMean), [wqiMean]);

  const rechartsData = useMemo(() => {
    const groupedBySampling = filteredData.reduce((acc, row) => {
      const sampling = row.sampling || "Unknown";
      if (!acc[sampling]) acc[sampling] = [];
      acc[sampling].push(row);
      return acc;
    }, {} as Record<string, typeof filteredData>);

    return Object.keys(groupedBySampling).map((sampling) => {
      const dataPoint: Record<string, string | number | null> = { sampling };
      Object.keys(borderColors).forEach((type) => {
        const matchingRow = groupedBySampling[sampling]?.find((row) =>
          row.location?.includes(type),
        );
        dataPoint[type] = matchingRow
          ? parseStringValue(matchingRow[selectedAttribute])
          : null;
      });
      return dataPoint;
    });
  }, [filteredData, selectedAttribute]);

  const selectedAttributeUnit =
    WQ_PARAMETERS.find((p) => p.key === selectedAttribute)?.unit;

  return (
    <>
      {isOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <div
        ref={containerRef}
        className={`${
          isMobile
            ? "absolute inset-y-0 right-0 z-40 max-w-full"
            : "relative z-20 h-full shrink-0"
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
          <div className="flex-1 space-y-3 overflow-y-auto p-2.5 sm:space-y-4 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className={`font-semibold ${isDark ? "text-cyan-400" : "text-blue-600"}`}>
                River Analysis
              </h3>
              <button
                onClick={onClose}
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  isDark
                    ? "border-[#1e3a5f] bg-[#0a1628] text-cyan-400/60 hover:text-cyan-300"
                    : "border-stone-200 bg-white shadow-sm text-slate-600 hover:text-slate-800"
                }`}
              >
                Close
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {!areaConfirmed ? (
              <section
                className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${
                  isDark
                    ? "border-[#1e3a5f]/50 bg-[#0d1629]/80"
                    : "border-stone-200 bg-white/70"
                }`}
              >
                <h4
                  className={`mb-1.5 text-xs font-semibold sm:mb-2 sm:text-sm ${
                    isDark ? "text-slate-300" : "text-slate-800"
                  }`}
                >
                  Analysis pending
                </h4>
                <p
                  className={`text-[11px] sm:text-xs ${
                    isDark ? "text-slate-500" : "text-slate-500"
                  }`}
                >
                  Confirm area selections on the map to unlock advanced water quality
                  charts and PDF reports.
                </p>
              </section>
            ) : (
              <div className="animate-fadeIn space-y-4 pb-12">
                <ChartStickyHeader
                  selectedAttribute={selectedAttribute}
                  attributes={Object.keys(CHART_TO_BACKEND_ATTRIBUTE)}
                  attributeLabels={attributeLabels}
                  onAttributeChange={setSelectedAttribute}
                  stats={stats}
                  wqiMean={wqiMean}
                  wqiInfo={wqiInfo}
                />

                <div className="space-y-3 sm:space-y-4">
                  <CollapsibleAnalysisSection
                    title="Individual Sampling Locations"
                    badge={`${rechartsData.length} Locations`}
                    badgeClassName="bg-blue-100 text-blue-700"
                    description="Point-wise values for the selected water quality parameter."
                    isDark={isDark}
                    accentClassName="border-l-blue-400"
                  >
                    <SamplingLocationsTab
                      data={rechartsData}
                      selectedAttribute={selectedAttribute}
                      selectedAttributeLabel={attributeLabels[selectedAttribute]}
                      selectedAttributeUnit={selectedAttributeUnit}
                      qualityThreshold={qualityThresholds[selectedAttribute]}
                      borderColors={borderColors}
                      embedded
                      showHeader={false}
                    />
                  </CollapsibleAnalysisSection>

                  <CollapsibleAnalysisSection
                    title="Average Values by Location Type"
                    badge="Aggregated"
                    badgeClassName="bg-emerald-100 text-emerald-700"
                    description="Minimum, average, and maximum values grouped by sampling type."
                    isDark={isDark}
                    accentClassName="border-l-emerald-400"
                  >
                    <LocationTypeSummaryTab
                      filteredData={filteredData as any}
                      selectedAttribute={selectedAttribute}
                      selectedAttributeLabel={attributeLabels[selectedAttribute]}
                      borderColors={borderColors}
                      parseValue={parseStringValue}
                      embedded
                      showHeader={false}
                    />
                  </CollapsibleAnalysisSection>

                  <CollapsibleAnalysisSection
                    title="Seasonal Comparison Table"
                    badge={`${comparisonTableData.length} Locations`}
                    badgeClassName="bg-amber-100 text-amber-700"
                    description="Compare pre-monsoon, monsoon, and post-monsoon values."
                    isDark={isDark}
                    accentClassName="border-l-amber-400"
                  >
                    <SeasonalComparisonTab
                      comparisonTableData={comparisonTableData as any}
                      selectedAttribute={selectedAttribute}
                      selectedAttributeLabel={attributeLabels[selectedAttribute]}
                      isLoadingAllSeasons={location.isLoadingAllSeasons}
                      allSeasonsError={null}
                      borderColors={borderColors}
                      embedded
                      showHeader={false}
                    />
                  </CollapsibleAnalysisSection>

                  <CollapsibleAnalysisSection
                    title="Generate PDF Report"
                    description="Select parameters and generate the river water quality report."
                    isDark={isDark}
                    accentClassName="border-l-pink-400"
                  >
                    <PdfReportBuilder
                      modeLabel="Admin"
                      dataType="subdistbased"
                      selectedIds={location.selectedSubDistricts}
                      selectedSeason={location.selectedSeason}
                      embedded
                      showHeader={false}
                    />
                  </CollapsibleAnalysisSection>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
