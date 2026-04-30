"use client";

import { useCallback, useRef, useState } from "react";
import type { RightPanelSettings } from "../../config/panels.config";
import UserCategorySlider from "./UserCategorySlider";
import { useUiModeService } from "../../services/uiModeService";
import PumpingRiskSummary from "../../components/PumpingRiskSummary";
import { useUserCategoryStore } from "../stores/userCategoryStore";

interface UserRightPanelProps {
  isOpen: boolean;
  width: string;
  showCategories: boolean;
  categoriesEditable: boolean;
  pumpingProcess: boolean;
  toggleCategoriesEditable: () => void;
  onClose: () => void;
  handleSubmit: () => void | Promise<void>;
  onWidthChange?: (width: string) => void;
  panelSettings: RightPanelSettings;
  isMobile?: boolean;
}

export default function UserRightPanel({
  isOpen,
  width,
  showCategories,
  categoriesEditable,
  pumpingProcess,
  toggleCategoriesEditable,
  onClose,
  handleSubmit,
  onWidthChange,
  panelSettings,
  isMobile = false,
}: UserRightPanelProps) {
  const [isCategorySectionMinimized, setIsCategorySectionMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useUiModeService((state) => state.isDark);
  const villageRiskCounts = useUserCategoryStore((state) => state.villageRiskCounts);

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current || !onWidthChange) {
          return;
        }

        const parent = containerRef.current.parentElement;
        if (!parent) {
          return;
        }

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
    [onWidthChange, panelSettings.maxWidthPercent, panelSettings.minWidthPercent],
  );

  const handleAnalyzeClick = async () => {
    setIsCategorySectionMinimized(true);
    await handleSubmit();
  };

  return (
    <>
      {isOpen && (
        <div className="absolute inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} />
      )}
      <div
        ref={containerRef}
        className={`absolute inset-y-0 right-0 z-30 max-w-full shrink-0 overflow-hidden border-l shadow-2xl transition-[width] duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto ${
          isDark
            ? "border-[#1e3a5f]/50 bg-gradient-to-b from-[#050911] via-[#080e1c] to-[#060c18]"
            : "border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)]"
        } ${isOpen ? "lg:w-auto" : "w-0 border-l-0"}`}
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
        <div className="flex h-full flex-col p-3 sm:p-4">
          {!showCategories && (
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
                Setup pending
              </h4>
              <p
                className={`text-[11px] sm:text-xs ${
                  isDark ? "text-slate-500" : "text-slate-500"
                }`}
              >
                Confirm river system selections and create pumping raster to unlock
                category controls.
              </p>
            </section>
          )}

          {showCategories && (
            <div className="animate-fadeIn">
              <section
                className={`rounded-3xl border shadow-[0_16px_34px_rgba(0,0,0,0.3)] ${
                  isDark ? "border-[#1e3a5f]/50 bg-[#0d1629]/80" : "border-stone-200 bg-white/72"
                } ${isCategorySectionMinimized ? "p-2.5 sm:p-3" : "p-3 sm:p-4"}`}
              >
                <div className="flex flex-row items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`truncate border-l-2 border-l-cyan-400 pl-2 text-xs font-semibold sm:text-sm ${
                        isDark ? "text-slate-100" : "text-slate-900"
                      }`}
                    >
                      Category Weights
                    </h3>
                    {!isCategorySectionMinimized && (
                      <p className={`mt-1 text-[11px] sm:text-xs ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}>
                        Choose category influence before analyzing pumping locations.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsCategorySectionMinimized((current) => !current)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
                      isCategorySectionMinimized
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                    }`}
                    title={isCategorySectionMinimized ? "Expand category weights" : "Minimize category weights"}
                  >
                    <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={isCategorySectionMinimized ? "M5 10l7 7 7-7" : "M19 14l-7-7-7 7"}
                      />
                    </svg>
                    <span>{isCategorySectionMinimized ? "Expand" : "Minimize"}</span>
                  </button>
                </div>

                {!isCategorySectionMinimized && (
                  <div className="mt-3">
                    <UserCategorySlider
                      editable={categoriesEditable}
                      onToggleEditable={toggleCategoriesEditable}
                    />

                    <div className="mt-3 sm:mt-4">
                      <button
                        onClick={() => void handleAnalyzeClick()}
                        disabled={pumpingProcess}
                        className={`flex w-full cursor-pointer items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-md transition duration-200 sm:px-6 sm:py-2.5 sm:text-sm ${
                          pumpingProcess
                            ? "cursor-not-allowed bg-slate-200 text-slate-400"
                            : "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:scale-[1.01] hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-200"
                        }`}
                      >
                        Analyze Pumping Zones
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* <PumpingRiskSummary counts={villageRiskCounts} isDark={isDark} /> */}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
