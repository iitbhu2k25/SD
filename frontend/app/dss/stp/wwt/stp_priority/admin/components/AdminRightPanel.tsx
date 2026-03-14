"use client";

// This file shows the right side panel for analysis, results, and report actions.
import DataTable from "react-data-table-component";
import { FaLock, FaUnlock } from "react-icons/fa";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { Village_columns } from "@/interface/table";
import type { DataRow } from "@/interface/table";
import AdminCategorySlider from "./AdminCategorySlider";

interface AdminRightPanelProps {
  isOpen: boolean;
  widthClass: string;
  showCategories: boolean;
  tableData: DataRow[];
  categoriesEditable: boolean;
  stpProcess: boolean;
  isPdfGenerating: boolean;
  toggleCategoriesEditable: () => void;
  handleSubmit: () => void | Promise<void>;
  handleReport: () => void | Promise<void>;
}

export default function AdminRightPanel({
  isOpen,
  widthClass,
  showCategories,
  tableData,
  categoriesEditable,
  stpProcess,
  isPdfGenerating,
  toggleCategoriesEditable,
  handleSubmit,
  handleReport,
}: AdminRightPanelProps) {
  return (
    <div
      className={`h-full shrink-0 overflow-hidden border-l border-slate-700/70 bg-[#0b1627]/95 text-white shadow-2xl backdrop-blur-sm transition-[width] duration-300 ease-in-out ${
        isOpen ? widthClass : "w-0 border-l-0"
      }`}
    >
      <div className={`h-full flex flex-col ${widthClass}`}>
        <div className="px-4 py-3 border-b border-slate-600/60 bg-gradient-to-r from-slate-900 to-slate-800">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-300">
            Analysis Categories
          </h3>
          <p className="text-[11px] text-slate-300">Weights, processing, and outputs</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!showCategories && (
            <section className="rounded-xl border border-slate-600/70 bg-slate-900/60 p-4">
              <h4 className="text-sm font-semibold text-white mb-2">Setup pending</h4>
              <p className="text-xs text-slate-300">
                Confirm location selections from the left panel to unlock category
                weights and analysis actions.
              </p>
            </section>
          )}

          {showCategories && (
            <div className="animate-fadeIn">
              <section className="p-3 bg-slate-900/70 rounded-xl border border-slate-600/70">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-white mb-1">
                      Category Weights
                    </h3>
                    <p className="text-xs text-slate-300">
                      Adjust the influence of each category
                    </p>
                  </div>
                  <button
                    onClick={toggleCategoriesEditable}
                    className="relative group p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition"
                  >
                    {categoriesEditable ? <FaUnlock size={12} /> : <FaLock size={12} />}
                  </button>
                </div>

                <AdminCategorySlider editable={categoriesEditable} />
              </section>

              <div className="flex justify-start mt-3">
                <button
                  onClick={handleSubmit}
                  disabled={stpProcess}
                  className={`px-6 py-2 rounded-full text-sm font-medium shadow-md flex items-center transition duration-200 ${
                    stpProcess
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                  }`}
                >
                  Analyze System
                </button>
              </div>
            </div>
          )}

          {tableData.length > 0 && (
            <section className="bg-slate-900/70 rounded-xl border border-slate-600/70 p-3 animate-fadeIn">
              <div className="p-3 bg-slate-950/60 rounded-xl shadow-sm">
                <div className="mb-3 flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-white">Village-wise Analysis</h2>
                  <button
                    onClick={() => downloadCSV(tableData, "STP_Priority_admin.csv")}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg shadow transition duration-200 gap-1"
                  >
                    Download CSV
                  </button>
                </div>
                <DataTable
                  columns={Village_columns}
                  data={tableData}
                  pagination
                  responsive
                  paginationPerPage={5}
                  paginationRowsPerPageOptions={[5, 10]}
                />
              </div>
            </section>
          )}

          {tableData.length > 0 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={handleReport}
                disabled={isPdfGenerating}
                className={`px-6 py-2 rounded-full text-sm font-medium shadow-md flex items-center gap-2 transition duration-200 ${
                  isPdfGenerating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                }`}
              >
                {isPdfGenerating ? "Generating PDF..." : "Generate Report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
