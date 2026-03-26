"use client";

// This file shows the right side panel for analysis, results, and report actions.
import { useCallback, useRef, useState } from "react";
import DataTable from "react-data-table-component";
import { FaLock, FaUnlock } from "react-icons/fa";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { Village_columns } from "@/interface/table";
import type { DataRow } from "@/interface/table";
import type { RightPanelSettings } from "../../config/panels.config";
import AdminCategorySlider from "./AdminCategorySlider";

const lightDataTableStyles = {
  table: {
    style: {
      backgroundColor: "transparent",
    },
  },
  headRow: {
    style: {
      minHeight: "3rem",
      backgroundColor: "#f8fafc",
      borderBottomColor: "rgba(203, 213, 225, 0.9)",
      color: "#334155",
    },
  },
  headCells: {
    style: {
      backgroundColor: "#f8fafc",
      color: "#0f172a",
      fontSize: "0.75rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
    },
  },
  rows: {
    style: {
      minHeight: "3rem",
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      color: "#334155",
      borderBottomColor: "rgba(226, 232, 240, 0.95)",
    },
    highlightOnHoverStyle: {
      backgroundColor: "#f8fafc",
      color: "#0f172a",
      outline: "none",
    },
  },
  cells: {
    style: {
      color: "#334155",
      fontSize: "0.875rem",
    },
  },
  pagination: {
    style: {
      minHeight: "3.5rem",
      backgroundColor: "#f8fafc",
      color: "#475569",
      borderTopColor: "rgba(203, 213, 225, 0.9)",
    },
    pageButtonsStyle: {
      borderRadius: "9999px",
      color: "#475569",
      fill: "#475569",
      backgroundColor: "transparent",
      transition: "all 160ms ease",
    },
  },
};

interface AdminRightPanelProps {
  isOpen: boolean;
  width: string;
  showCategories: boolean;
  tableData: DataRow[];
  categoriesEditable: boolean;
  stpProcess: boolean;
  isPdfGenerating: boolean;
  toggleCategoriesEditable: () => void;
  onClose: () => void;
  handleSubmit: () => void | Promise<void>;
  handleReport: () => void | Promise<void>;
  onWidthChange?: (width: string) => void;
  panelSettings: RightPanelSettings;
  isMobile?: boolean;
}

export default function AdminRightPanel({
  isOpen,
  width,
  showCategories,
  tableData,
  categoriesEditable,
  stpProcess,
  isPdfGenerating,
  toggleCategoriesEditable,
  onClose,
  handleSubmit,
  handleReport,
  onWidthChange,
  panelSettings,
  isMobile = false,
}: AdminRightPanelProps) {
  const [isCategorySectionMinimized, setIsCategorySectionMinimized] = useState(true);
  const [isAnalysisSectionMinimized, setIsAnalysisSectionMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [onWidthChange, panelSettings.maxWidthPercent, panelSettings.minWidthPercent]);

  return (
    <>
      {isOpen && (
        <div className="absolute inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} />
      )}
      <div
        ref={containerRef}
        className={`absolute inset-y-0 right-0 z-30 max-w-full shrink-0 overflow-hidden border-l border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)] text-slate-800 shadow-2xl transition-[width] duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto ${
          isOpen ? "lg:w-auto" : "w-0 border-l-0"
        }`}
        style={{
          width: isOpen ? (isMobile ? panelSettings.mobileWidthOpen : width) : panelSettings.widthClosed,
        }}
      >
        {isOpen && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="group absolute inset-y-0 left-0 z-10 hidden w-2 cursor-col-resize items-center justify-center hover:bg-emerald-400/20 transition-colors lg:flex"
          >
            <div className="h-10 w-0.5 rounded-full bg-stone-300 group-hover:bg-emerald-500 transition-colors" />
          </div>
        )}
        <div className="flex h-full max-w-full flex-col" style={{ width: "100%" }}>
          <div className="flex-1 space-y-3 overflow-y-auto p-2.5 sm:space-y-4 sm:p-4">
            {!showCategories && (
              <section className="rounded-2xl border border-stone-200 bg-white/70 p-3 shadow-sm sm:p-4">
                <h4 className="mb-1.5 text-xs font-semibold text-slate-800 sm:mb-2 sm:text-sm">Setup pending</h4>
                <p className="text-[11px] text-slate-500 sm:text-xs">
                  Confirm location selections from the left panel to unlock category
                  weights and analysis actions.
                </p>
              </section>
            )}

            {showCategories && (
              <div className="animate-fadeIn">
                <section
                  className={`rounded-3xl border border-stone-200 bg-white/72 shadow-[0_16px_34px_rgba(148,163,184,0.12)] transition-all ${
                    isCategorySectionMinimized ? "p-2.5 sm:p-3" : "p-3 sm:p-4"
                  }`}
                >
                  <div className="flex flex-row items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate border-l-2 border-l-teal-400 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
                        Category Weights
                      </h3>
                      {!isCategorySectionMinimized && (
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                          Choose what matters most before running the analysis.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setIsCategorySectionMinimized((current) => !current)
                        }
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
                          isCategorySectionMinimized
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                        }`}
                        title={
                          isCategorySectionMinimized
                            ? "Expand category weights"
                            : "Minimize category weights"
                        }
                        aria-label={
                          isCategorySectionMinimized
                            ? "Expand category weights"
                            : "Minimize category weights"
                        }
                      >
                        <svg
                          className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={
                              isCategorySectionMinimized
                                ? "M5 10l7 7 7-7"
                                : "M19 14l-7-7-7 7"
                            }
                          />
                        </svg>
                        <span>
                          {isCategorySectionMinimized ? "Expand" : "Minimize"}
                        </span>
                      </button>
                      <button
                        onClick={toggleCategoriesEditable}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:text-xs ${
                          categoriesEditable
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                        title={
                          categoriesEditable
                            ? "Category weights are unlocked for editing"
                            : "Category weights are locked"
                        }
                        aria-label={
                          categoriesEditable
                            ? "Unlock state active. Click to lock category weights"
                            : "Lock state active. Click to unlock category weights"
                        }
                      >
                        {categoriesEditable ? <FaUnlock size={12} /> : <FaLock size={12} />}
                        <span>{categoriesEditable ? "Unlocked" : "Locked"}</span>
                      </button>
                    </div>
                  </div>

                  {!isCategorySectionMinimized && (
                    <div className="mt-3">
                      <AdminCategorySlider editable={categoriesEditable} />

                      <div className="mt-3 sm:mt-4">
                        <button
                          onClick={handleSubmit}
                          disabled={stpProcess}
                          className={`flex w-full cursor-pointer items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-md transition duration-200 sm:px-6 sm:py-2.5 sm:text-sm ${
                            stpProcess
                              ? "cursor-not-allowed bg-slate-200 text-slate-400"
                              : "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:scale-[1.01] hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-200"
                          }`}
                        >
                          Analyze System
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {tableData.length > 0 && (
              <section className="animate-fadeIn">
                <div className="rounded-3xl border border-stone-200 bg-white/72 p-2.5 shadow-[0_16px_34px_rgba(148,163,184,0.12)] sm:p-3">
                  <div className="flex flex-row items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate border-l-2 border-l-emerald-400 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
                        Village-wise Analysis
                      </h2>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setIsAnalysisSectionMinimized((current) => !current)
                        }
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
                          isAnalysisSectionMinimized
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                        }`}
                        title={
                          isAnalysisSectionMinimized
                            ? "Expand village-wise analysis"
                            : "Minimize village-wise analysis"
                        }
                        aria-label={
                          isAnalysisSectionMinimized
                            ? "Expand village-wise analysis"
                            : "Minimize village-wise analysis"
                        }
                      >
                        <svg
                          className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={
                              isAnalysisSectionMinimized
                                ? "M5 10l7 7 7-7"
                                : "M19 14l-7-7-7 7"
                            }
                          />
                        </svg>
                        <span>
                          {isAnalysisSectionMinimized ? "Expand" : "Minimize"}
                        </span>
                      </button>
                      <button
                        onClick={() => downloadCSV(tableData, "STP_Priority_admin.csv")}
                        className="flex cursor-pointer items-center justify-center gap-1 rounded-full bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-500 sm:px-3 sm:text-xs"
                      >
                        <svg
                          className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v12m0 0l4-4m-4 4l-4-4m-5 8h18"
                          />
                        </svg>
                        Download CSV
                      </button>
                    </div>
                  </div>

                  {!isAnalysisSectionMinimized && (
                    <div className="mt-3 space-y-3">
                      <div className="overflow-x-auto">
                        <div className="min-w-0 lg:min-w-130">
                          <DataTable
                            columns={Village_columns}
                            data={tableData}
                            customStyles={lightDataTableStyles}
                            pagination
                            responsive
                            paginationPerPage={5}
                            paginationRowsPerPageOptions={[5, 10]}
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleReport}
                        disabled={isPdfGenerating}
                        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-md transition duration-200 sm:px-6 sm:py-2.5 sm:text-sm ${
                          isPdfGenerating
                            ? "cursor-not-allowed bg-slate-200 text-slate-400"
                            : "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:scale-[1.01] hover:from-emerald-500 hover:to-teal-500 shadow-emerald-200"
                        }`}
                      >
                        {isPdfGenerating ? "Generating PDF..." : "Generate Report"}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {!showCategories && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-2.5 py-2 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-800 sm:px-3 sm:text-xs"
                  title="Close analysis panel"
                >
                  <span>Close Panel</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
