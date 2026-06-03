"use client";

import DataTable from "react-data-table-component";
import CollapseToggle from "@/components/dss_common/CollapseToggle";
import type { BottomPanelSettings } from "../config/manual_panels.config";
import { suitabilityVillageColumns } from "../config/villageTableColumns";
import type { DataRow } from "../services/manual_stpSuitabilityTypes";
import { downloadSuitabilityCsv } from "../utils/manual_downloadSuitabilityCsv";

const lightDataTableStyles = {
  table: { style: { backgroundColor: "transparent" } },
  headRow: {
    style: {
      minHeight: "2.75rem",
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
      minHeight: "2.75rem",
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
  cells: { style: { color: "#334155", fontSize: "0.8125rem" } },
  pagination: {
    style: {
      minHeight: "3.25rem",
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

interface ManualBottomResultsPanelProps {
  isOpen: boolean;
  height: string;
  tableData: DataRow[];
  panelSettings: BottomPanelSettings;
  isMobile?: boolean;
  isPdfGenerating: boolean;
  onToggle: () => void;
  onReport: () => void | Promise<void>;
}

export default function ManualBottomResultsPanel({
  isOpen,
  height,
  tableData,
  panelSettings,
  isMobile = false,
  isPdfGenerating,
  onToggle,
  onReport,
}: ManualBottomResultsPanelProps) {
  const isCompactHeader = !isOpen;

  if (tableData.length === 0) return null;

  return (
    <section
      className="relative z-20 shrink-0 overflow-hidden border-t border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#f0edf7_100%)] transition-[height] duration-300 ease-in-out"
      style={{
        height: isOpen
          ? isMobile
            ? panelSettings.mobileHeightOpen
            : height
          : panelSettings.heightClosed,
      }}
    >
      <div className="flex h-full flex-col">
        <header
          className={`flex shrink-0 border-b border-stone-200 bg-white/70 px-3 ${
            isCompactHeader ? "py-1.5 sm:py-2" : "py-2 sm:py-3"
          } ${
            isCompactHeader
              ? "items-center justify-between gap-1.5"
              : "flex-wrap items-center justify-between gap-2"
          } sm:px-4`}
        >
          <div
            className={`min-w-0 ${
              isCompactHeader ? "max-w-[34vw] sm:max-w-none" : "min-w-[8rem] flex-1"
            }`}
          >
            <h3 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
              Village-wise Suitability
            </h3>
            {!isCompactHeader && (
              <p className="text-[10px] text-slate-500 sm:text-xs">{tableData.length} rows</p>
            )}
          </div>

          <div className={isCompactHeader ? "shrink-0" : "order-3 w-full sm:order-none sm:w-auto"}>
            <button
              type="button"
              onClick={onReport}
              disabled={isPdfGenerating}
              className={`inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full font-semibold shadow-sm transition ${
                isCompactHeader
                  ? "h-7 px-2.5 text-[10px] sm:h-8 sm:px-3 sm:text-[11px]"
                  : "h-8 w-full px-3 text-[11px] sm:w-auto sm:px-4 sm:text-xs"
              } ${
                isPdfGenerating
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
              }`}
            >
              {isPdfGenerating
                ? isCompactHeader
                  ? "PDF..."
                  : "Generating PDF..."
                : isCompactHeader
                  ? "Report"
                  : "Generate Report"}
            </button>
          </div>

          <div className="flex shrink-0 items-center justify-self-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => downloadSuitabilityCsv(tableData, "STP_Suitability_manual.csv")}
              className={`inline-flex cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full bg-blue-600 font-semibold text-white shadow-sm transition hover:bg-blue-500 ${
                isCompactHeader
                  ? "h-7 px-2 text-[10px] sm:h-8 sm:px-2.5 sm:text-[11px]"
                  : "h-8 px-2.5 text-[11px] sm:px-3 sm:text-xs"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v12m0 0l4-4m-4 4l-4-4m-5 8h18"
                />
              </svg>
              CSV
            </button>
            <CollapseToggle
              isCollapsed={!isOpen}
              onToggle={onToggle}
              expandLabel="Expand table panel"
              collapseLabel="Collapse table panel"
              contentPosition="above"
              className={isCompactHeader ? "h-7 w-7 sm:h-8 sm:w-8" : ""}
            />
          </div>
        </header>

        {isOpen && (
          <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-2.5 sm:space-y-3 sm:p-3">
            <div className="h-full min-h-0 overflow-auto rounded-xl border border-stone-200 bg-white/78 p-1.5 sm:p-2">
              <DataTable
                columns={suitabilityVillageColumns}
                data={tableData}
                customStyles={lightDataTableStyles}
                pagination
                responsive
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10, 20]}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
