"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import DataSelection from "./components/DataSelection";
import GroundwaterContour from "./components/contour";
import GroundwaterTrend from "./components/trend";
import GroundwaterForecast from "./components/forecast";
import GSR from "./components/GSR";
import PDF from "./components/pdf";
import { GroundwaterContourProvider } from "@/contexts/groundwater_assessment/admin/ContourContext";
import { GroundwaterTrendProvider } from "@/contexts/groundwater_assessment/admin/TrendContext";
import { GroundwaterForecastProvider } from "@/contexts/groundwater_assessment/admin/ForecastContext";
import { LocationProvider, useLocation } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { WellProvider } from "@/contexts/groundwater_assessment/admin/WellContext";
import { MapProvider } from "@/contexts/groundwater_assessment/admin/MapContext";
import { PDFProvider } from "@/contexts/groundwater_assessment/admin/PDFContext";
import { RechargeProvider, useRecharge } from "@/contexts/groundwater_assessment/admin/RechargeContext";
import { DemandProvider } from "@/contexts/groundwater_assessment/admin/DemandContext";
import { GSRProvider, useGSR } from "@/contexts/groundwater_assessment/admin/GSRContext";
import PageLayout from "@/components/dss_common/PageLayout";
import RightPanelToggle from "@/components/dss_common/RightPanelToggle";
import { gwaPanelSettings } from "../config/panels.config";
import { useUiModeService } from "../services/uiModeService";

// Map uses Leaflet — must be dynamic
const MapComponent = dynamic(() => import("./components/Map"), { ssr: false });

// ─── Props from root page ─────────────────────────────────────────────────────
export interface AdminGWAProps {
  activeStep: number;
  enableGroundwaterDepth: boolean;
  enableTimeseriesAnalysis: boolean;
  onSelectionsLockedChange?: (locked: boolean) => void;
  onModeChange?: (mode: "admin" | "drain") => void;
  currentMode?: "admin" | "drain";
}

// ─── Right panel — analysis output ───────────────────────────────────────────
function AdminRightPanel({
  isOpen,
  width,
  activeStep,
  enableGroundwaterDepth,
  enableTimeseriesAnalysis,
  onClose,
  onWidthChange,
}: {
  isOpen: boolean;
  width: string;
  activeStep: number;
  enableGroundwaterDepth: boolean;
  enableTimeseriesAnalysis: boolean;
  onClose: () => void;
  onWidthChange: (w: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { stressTableData } = useGSR();
  const { selectedState, selectedDistricts, selectedSubDistricts } = useLocation();

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const parent = containerRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const newPct = ((rect.right - ev.clientX) / rect.width) * 100;
      const clamped = Math.min(gwaPanelSettings.right.maxWidthPercent, Math.max(gwaPanelSettings.right.minWidthPercent, newPct));
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
  }, [onWidthChange]);

  const handleComputeWater = () => {
    const params = new URLSearchParams();
    if (selectedState) params.append("state", selectedState.toString());
    if (selectedDistricts.length > 0) params.append("districts", selectedDistricts.join(","));
    if (selectedSubDistricts.length > 0) params.append("subdistricts", selectedSubDistricts.join(","));
    if (stressTableData?.length > 0) {
      try { localStorage.setItem("gwa_stress_data", JSON.stringify(stressTableData)); }
      catch { alert("Warning: Could not transfer stress data."); }
    } else {
      localStorage.removeItem("gwa_stress_data");
    }
    window.open(`/dss/gwm/MAR/SWA?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {isOpen && (
        <div className="absolute inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />
      )}
      <div
        ref={containerRef}
        className={`relative z-20 h-full shrink-0 overflow-hidden border-l border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)] text-slate-800 shadow-2xl transition-[width] duration-300 ease-in-out ${isOpen ? "" : "w-0 border-l-0"}`}
        style={{ width: isOpen ? width : gwaPanelSettings.right.widthClosed }}
      >
        {/* Resize handle */}
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center transition-colors hover:bg-emerald-400/20 lg:flex"
          >
            <div className="h-10 w-0.5 rounded-full bg-stone-300 transition-colors group-hover:bg-emerald-500" />
          </div>
        )}

        {isOpen && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 bg-[#f7f4ef]/88 px-3 py-2.5 backdrop-blur-sm">
              <h2 className="text-[14px] font-semibold tracking-[0.02em] text-slate-800">
                Analysis Output
              </h2>
              <button
                onClick={onClose}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white/80 text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
                title="Close panel"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeStep === 2 && (
                <GroundwaterTrend activeTab="groundwater-trend" step={activeStep} />
              )}
              {activeStep === 3 && (
                <GSR step={activeStep} />
              )}
              {activeStep === 4 && enableGroundwaterDepth && (
                <GroundwaterContour activeTab="groundwater-contour" step={activeStep} />
              )}
              {activeStep === 5 && enableTimeseriesAnalysis && (
                <GroundwaterForecast activeTab="groundwater-forecast" step={activeStep} />
              )}
              {activeStep === 1 && (
                <div className="rounded-2xl border border-stone-200 bg-white/70 p-4">
                  <p className="text-xs text-slate-500">Complete Step 1 (Data Collection) to unlock analysis output here.</p>
                </div>
              )}

              {/* PDF + Compute Available Water */}
              {activeStep >= 3 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-stone-200">
                  <PDF />
                  {stressTableData?.length > 0 && (
                    <button
                      onClick={handleComputeWater}
                      className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-sm rounded-full py-2 px-4 shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      Compute Available Water
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Inner layout (needs all contexts) ───────────────────────────────────────
function AdminGWALayout({ activeStep, enableGroundwaterDepth, enableTimeseriesAnalysis, onSelectionsLockedChange, onModeChange, currentMode }: AdminGWAProps) {
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [isRightOpen, setIsRightOpen] = useState<boolean>(false);
  const [rightWidth, setRightWidth] = useState<string>(gwaPanelSettings.right.widthOpen);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const { selectionsLocked } = useLocation();
  const { computeRecharge, tableData, canComputeRecharge } = useRecharge();
  const isDark = useUiModeService((s) => s.isDark);
  const toggleTheme = useUiModeService((s) => s.toggleTheme);

  // Surface selectionsLocked to root page
  useEffect(() => {
    onSelectionsLockedChange?.(selectionsLocked);
  }, [selectionsLocked, onSelectionsLockedChange]);

  // Open right panel when selections are confirmed
  useEffect(() => {
    if (selectionsLocked && activeStep >= 2) setIsRightOpen(true);
  }, [selectionsLocked, activeStep]);

  useEffect(() => {
    if (activeStep === 3 && canComputeRecharge() && tableData.length === 0) {
      computeRecharge();
    }
  }, [activeStep]);

  // Mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsMobile(!mq.matches);
    setIsPanelOpen(mq.matches);
    const handle = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
      if (!e.matches) setIsPanelOpen(false);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  // ── Rail items ─────────────────────────────────────────────────────────
  const railItems = [
    {
      id: "admin",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      ),
      label: "Admin",
      tooltip: "Admin Mode",
      onClick: () => setIsPanelOpen((o) => !o),
      isActive: currentMode === "admin",
      activeClassName: "bg-blue-600 text-white shadow-lg shadow-blue-200",
    },
    {
      id: "drain",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      label: "Drain",
      tooltip: "Switch to Drain Mode",
      onClick: () => onModeChange?.("drain"),
      isActive: currentMode === "drain",
      activeClassName: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
    {
      id: "dark",
      icon: isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
      label: isDark ? "Light" : "Dark",
      tooltip: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
      onClick: toggleTheme,
      isActive: isDark,
      activeClassName: "bg-slate-700 text-white shadow-lg shadow-slate-400",
    },
  ];

  // ── Left panel ─────────────────────────────────────────────────────────
  const leftPanel = (
    <DataSelection step={activeStep} />
  );

  // ── Right panel ────────────────────────────────────────────────────────
  const rightPanel = selectionsLocked ? (
    <AdminRightPanel
      isOpen={isRightOpen}
      width={isMobile ? gwaPanelSettings.right.mobileWidthOpen : rightWidth}
      activeStep={activeStep}
      enableGroundwaterDepth={enableGroundwaterDepth}
      enableTimeseriesAnalysis={enableTimeseriesAnalysis}
      onClose={() => setIsRightOpen(false)}
      onWidthChange={setRightWidth}
    />
  ) : null;

  const rightPanelToggle = selectionsLocked ? (
    <RightPanelToggle
      isOpen={isRightOpen}
      openOffset={isMobile ? gwaPanelSettings.right.mobileWidthOpen : rightWidth}
      onToggle={() => setIsRightOpen((o) => !o)}
    />
  ) : null;

  return (
    <PageLayout
      title="Groundwater Assessment"
      badge="Admin"
      badgeClassName="bg-blue-100 text-blue-800 border border-blue-200"
      config={gwaPanelSettings}
      railItems={railItems}
      leftPanel={leftPanel}
      mapContent={<MapComponent />}
      rightPanel={rightPanel}
      rightPanelToggle={rightPanelToggle}
      isLeftOpen={isPanelOpen}
      isMobile={isMobile}
      onToggleLeft={() => setIsPanelOpen((o) => !o)}
    />
  );
}

// ─── Provider wrapper ─────────────────────────────────────────────────────────
export default function GroundwaterAssessmentAdmin(props: AdminGWAProps) {
  return (
    <LocationProvider>
      <WellProvider>
        <MapProvider>
          <GroundwaterContourProvider activeTab="groundwater-contour">
            <PDFProvider>
              <GroundwaterTrendProvider activeTab="groundwater-trend">
                <GroundwaterForecastProvider activeTab="groundwater-forecast">
                  <RechargeProvider>
                    <DemandProvider>
                      <GSRProvider>
                        <AdminGWALayout {...props} />
                      </GSRProvider>
                    </DemandProvider>
                  </RechargeProvider>
                </GroundwaterForecastProvider>
              </GroundwaterTrendProvider>
            </PDFProvider>
          </GroundwaterContourProvider>
        </MapProvider>
      </WellProvider>
    </LocationProvider>
  );
}
