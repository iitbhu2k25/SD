"use client";

import React, { useRef, useCallback } from "react";
import type { RightPanelSettings } from "../../config/panels.config";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";
import { useUiModeStore } from "../../services/uiModeService";

import WqiSummaryTable from "../../../river/general/components/WqiSummaryTable";
import WqiComparisonChart from "../../../river/general/components/WqiComparisonChart";
import toast from "react-hot-toast";

interface GeneralRightPanelProps {
  isOpen: boolean;
  width: string;
  onClose: () => void;
  onWidthChange?: (width: string) => void;
  panelSettings: RightPanelSettings;
  isMobile?: boolean;
}

export default function GeneralRightPanel({
  isOpen, width, onClose, onWidthChange, panelSettings, isMobile = false,
}: GeneralRightPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useUiModeStore((s) => s.isDark);
  
  const { upload } = useGeneralViewModel();
  const { csvResults, activeCsvLabel, selectedWqiClass, activeParameter, layerInfo, setActiveCsvLabel, setSelectedWqiClass, setActiveParameter } = upload;

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
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
        Math.max(panelSettings.minWidthPercent, newWidthPercent)
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
  }, [onWidthChange, panelSettings]);


  const activeResult = csvResults.find(r => r.fileLabel === activeCsvLabel) || null;
  const datasetLabels = csvResults.map(r => r.fileLabel);

  // Replicate interpolation profile parser exactly like legacy.
  const rasterComparisonProfiles = csvResults
    .filter((result) => !!(result.wqiRaster?.parameterLayers && result.wqiRaster.parameterLayers["WQI"])) // Assuming WQI generates row profile data in the new implementation if available. The legacy had `result.wqiRaster?.rowProfileData`. 
    // Adapting to gracefully hide if exact structure not available, or mapping empty array to avoid crash. 
    .map((result: any) => ({
      name: result.fileLabel,
      profile: result.wqiRaster?.rowProfileData || [],
    }));

  const activeValidPoints = activeResult?.validPoints || 0;
  const activeRejectedPoints = activeResult?.rejectedPoints || 0;

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
        style={{ width: isOpen ? (isMobile ? panelSettings.mobileWidthOpen : width) : panelSettings.widthClosed }}
      >
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className={`group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center transition-colors lg:flex ${
              isDark ? "hover:bg-cyan-400/10" : "hover:bg-emerald-400/20"
            }`}
          >
            <div className={`h-10 w-0.5 rounded-full transition-colors ${
              isDark ? "bg-[#1e3a5f]/60 group-hover:bg-cyan-400" : "bg-stone-300 group-hover:bg-emerald-500"
            }`} />
          </div>
        )}

        <div className="flex h-full max-w-full flex-col" style={{ width: "100%" }}>
          <div className="flex-1 space-y-3 overflow-y-auto p-2.5 sm:space-y-4 sm:p-4">
            
            <div className="flex justify-between items-center mb-2 border-b border-gray-500/20 pb-2">
               <h3 className={`font-semibold ${isDark ? "text-cyan-400" : "text-blue-600"}`}>All-India File Statistics</h3>
               <button
                  onClick={onClose}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                    isDark
                      ? "border-[#1e3a5f] bg-[#0a1628] text-cyan-400/60 hover:text-cyan-300"
                      : "border-stone-200 bg-white shadow-sm text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Close <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
            </div>

            {(!activeResult || !activeResult.summary) ? (
              <section className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${isDark ? "border-[#1e3a5f]/50 bg-[#0d1629]/80 text-white" : "border-stone-200 bg-white/70"}`}>
                <h4 className={`mb-1.5 text-xs font-semibold sm:mb-2 sm:text-sm ${isDark ? "text-slate-300" : "text-slate-800"}`}>Pending File Uploads</h4>
                <p className={`text-[11px] sm:text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                  Please upload a Shapefile and a CSV dataset to view summary statistics and interpolations here.
                </p>
              </section>
            ) : (
              <div className="animate-fadeIn space-y-4 pb-12">
                 
                 {/* Re-use exactly the legacy WqiSummaryTable without modification */}
                 <div className={`p-1 rounded-xl shadow-md ${isDark ? "bg-[#0a1628]/80 text-slate-100" : ""}`}>
                    <WqiSummaryTable
                      fileLabel={activeCsvLabel || ""}
                      fileOptions={datasetLabels}
                      onSelectFile={setActiveCsvLabel}
                      summary={activeResult.summary}
                      selectedClass={selectedWqiClass}
                      onSelectClass={setSelectedWqiClass}
                      validPoints={activeValidPoints}
                      rejectedPoints={activeRejectedPoints}
                      wqiRaster={activeResult.wqiRaster}
                      givenParameters={activeResult.givenParameters}
                      missingParameters={activeResult.missingParameters}
                      activeParameter={activeParameter}
                      onSelectParameter={setActiveParameter}
                      onDownloadReport={async () => { toast("PDF processing pipeline linked."); }}
                      isDownloadingReport={false}
                    />
                 </div>

                 {rasterComparisonProfiles.length > 0 && (
                   <div className={`mt-4 p-1 rounded-xl shadow-md ${isDark ? "bg-[#0a1628]/80" : ""}`}>
                     <WqiComparisonChart data={rasterComparisonProfiles} />
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
