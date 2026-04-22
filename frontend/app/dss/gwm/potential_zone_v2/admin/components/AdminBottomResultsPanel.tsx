"use client";

import DataTable from "react-data-table-component";
import type { DataRow } from "@/interface/table";
import { potentialVillageColumns } from "../../config/villageTableColumns";
import { downloadPotentialCsv } from "../../utils/downloadPotentialCsv";
import type { BottomPanelSettings } from "../../config/panels.config";
import { useUiModeService } from "../../services/uiModeService";

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

export const darkDataTableStyles = {
  table: {
    style: {
      backgroundColor: "#050911",
      color: "#e2e8f0",
    },
  },
  header: {
    style: {
      backgroundColor: "#080e1c",
      color: "#f8fafc",
    },
  },
  headRow: {
    style: {
      backgroundColor: "#060c18",
      borderBottomColor: "#1e3a5f",
      color: "#e2e8f0",
      fontWeight: 600,
    },
  },
  headCells: {
    style: {
      fontSize: "0.75rem",
      color: "#f8fafc",
    },
  },
  rows: {
    style: {
      backgroundColor: "#050911",
      color: "#cbd5e1",
      "&:not(:last-of-type)": {
        borderBottomColor: "#1e3a5f",
      },
      "&:hover": {
        backgroundColor: "#080e1c",
      },
    },
  },
  pagination: {
    style: {
      backgroundColor: "#050911",
      color: "#cbd5e1",
      borderTopColor: "#1e3a5f",
    },
    pageButtonsStyle: {
      color: "#cbd5e1",
      fill: "#cbd5e1",
      "&:disabled": {
        color: "#475569",
        fill: "#475569",
      },
      "&:hover:not(:disabled)": {
        backgroundColor: "#1e3a5f",
      },
    },
  },
};

interface AdminBottomResultsPanelProps {
  isOpen: boolean;
  height: string;
  tableData: DataRow[];
  panelSettings: BottomPanelSettings;
  isMobile?: boolean;
  isPdfGenerating: boolean;
  onToggle: () => void;
  onReport: () => void | Promise<void>;
}

export default function AdminBottomResultsPanel({
  isOpen,
  height,
  tableData,
  panelSettings,
  isMobile = false,
  isPdfGenerating,
  onToggle,
  onReport,
}: AdminBottomResultsPanelProps) {
  const isDark = useUiModeService((s) => s.isDark);
  const isCompactHeader = !isOpen;
  if (tableData.length === 0) {
    return null;
  }

  return (
    <section
      className={`relative z-20 shrink-0 overflow-hidden border-t transition-[height] duration-300 ease-in-out ${
        isDark
          ? "border-[#1e3a5f]/50 bg-[#050911]"
          : "border-stone-200 bg-[linear-gradient(180deg,#f5f1ea_0%,#f2f5f7_48%,#edf3ee_100%)]"
      }`}
      style={{
        height: isOpen
          ? isMobile
            ? panelSettings.mobileHeightOpen
            : height
          : panelSettings.heightClosed,
      }}
    >
      <div className="flex h-full flex-col">
        <header className={`flex shrink-0 items-center justify-between border-b px-3 ${
          isCompactHeader ? "py-1.5 sm:py-2" : "py-2 sm:py-3"
        } sm:px-4 ${
          isDark ? "border-[#1e3a5f]/50 bg-[#080e1c]" : "border-stone-200 bg-white/70"
        }`}>
          <div className="min-w-0">
            <h3 className={`truncate text-sm font-semibold sm:text-base ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}>
              Groundwater Potential Zone - Village-wise Analysis
            </h3>
            {!isCompactHeader && (
              <p className={`text-[10px] sm:text-xs ${
                isDark ? "text-slate-500" : "text-slate-500"
              }`}>
                {tableData.length} rows
              </p>
            )}
          </div>

          <div className="justify-self-center">
            <button
              onClick={onReport}
              disabled={isPdfGenerating}
              className={`inline-flex cursor-pointer items-center justify-center rounded-full font-semibold shadow-sm transition ${
                isCompactHeader
                  ? "h-7 px-2.5 text-[10px] sm:h-8 sm:px-3 sm:text-[11px]"
                  : "h-8 px-3 text-[11px] sm:px-4 sm:text-xs"
              } ${
                isPdfGenerating
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
              }`}
            >
              {isPdfGenerating ? "Generating PDF..." : "Generate Report"}
            </button>
          </div>

          <div className="flex shrink-0 items-center justify-self-end gap-1.5 sm:gap-2">
            <button
              onClick={() => downloadPotentialCsv(tableData, "Groundwater_Potential_admin.csv")}
              className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-full bg-blue-600 font-semibold text-white shadow-sm transition hover:bg-blue-500 ${
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
            <button
              onClick={onToggle}
              className={`inline-flex items-center gap-1.5 rounded-full border font-semibold shadow-sm transition ${
                isCompactHeader
                  ? "px-2 py-1 text-[10px] sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                  : "px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs"
              } ${
                isDark
                  ? "border-[#1e3a5f] bg-[#0a1628]/80 text-cyan-400/60 hover:border-cyan-500/40 hover:text-cyan-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
              title={isOpen ? "Collapse table panel" : "Expand table panel"}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isOpen ? "M5 10l7 7 7-7" : "M19 14l-7-7-7 7"}
                />
              </svg>
              {isOpen ? "Minimize" : "Expand"}
            </button>
          </div>
        </header>

        {isOpen && (
          <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-2.5 sm:space-y-3 sm:p-3">
            <div className={`h-full min-h-0 overflow-auto rounded-xl border p-1.5 sm:p-2 ${
              isDark ? "border-slate-700 bg-slate-800/60" : "border-stone-200 bg-white/78"
            }`}>
              <DataTable
                columns={potentialVillageColumns}
                data={tableData}
                customStyles={isDark ? darkDataTableStyles : lightDataTableStyles}
                pagination
                responsive
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10]}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
