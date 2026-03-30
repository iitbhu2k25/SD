"use client";

import { useState } from "react";
import DataTable from "react-data-table-component";
import { FaLock, FaUnlock } from "react-icons/fa";
import { downloadCSV } from "@/components/utils/downloadCsv";
import { Village_columns } from "@/interface/table";
import type {
  Category,
  DataRow,
  SelectRasterLayer,
  Stp_area,
} from "../../services/stpSuitabilityTypes";
import CategorySliderView from "./CategorySliderView";
import SuitabilityTreatmentCard, {
  type TreatmentSubmitValues,
} from "./SuitabilityTreatmentCard";

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

interface SuitabilityWorkflowPanelProps {
  showCategories: boolean;
  categoryLoading: boolean;
  workflowError: string | null;
  conditionCategories: Category[];
  constraintCategories: Category[];
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  areaOptions: Stp_area[];
  selectedAreaOptionId: number | null;
  categoriesEditable: boolean;
  stpProcess: boolean;
  isPdfGenerating: boolean;
  isTreatmentLoading: boolean;
  tableData: DataRow[];
  csvFileName: string;
  onToggleCategoriesEditable: () => void;
  onAnalyze: () => void | Promise<void>;
  onReport: () => void | Promise<void>;
  onSelectAreaOption: (areaId: number | null) => void;
  onTreatmentSubmit: (values: TreatmentSubmitValues) => void | Promise<void>;
  onToggleConditionCategory: (id: number, fileName: string) => void;
  onToggleConstraintCategory: (id: number, fileName: string) => void;
  onUpdateConditionInfluence: (id: number, fileName: string, influence: number) => void;
  onSelectAllCondition: () => void;
  onClearAllCondition: () => void;
  onSelectAllConstraint: () => void;
  onClearAllConstraint: () => void;
}

export default function SuitabilityWorkflowPanel({
  showCategories,
  categoryLoading,
  workflowError,
  conditionCategories,
  constraintCategories,
  selectedCondition,
  selectedConstraint,
  areaOptions,
  selectedAreaOptionId,
  categoriesEditable,
  stpProcess,
  isPdfGenerating,
  isTreatmentLoading,
  tableData,
  csvFileName,
  onToggleCategoriesEditable,
  onAnalyze,
  onReport,
  onSelectAreaOption,
  onTreatmentSubmit,
  onToggleConditionCategory,
  onToggleConstraintCategory,
  onUpdateConditionInfluence,
  onSelectAllCondition,
  onClearAllCondition,
  onSelectAllConstraint,
  onClearAllConstraint,
}: SuitabilityWorkflowPanelProps) {
  const [activeTab, setActiveTab] = useState<"condition" | "constraint">("condition");
  const [isCategorySectionMinimized, setIsCategorySectionMinimized] = useState(false);
  const [isResultsSectionMinimized, setIsResultsSectionMinimized] = useState(false);

  return (
    <div className="space-y-3 sm:space-y-4">
      <section
        className={`rounded-3xl border border-stone-200 bg-white/72 shadow-[0_16px_34px_rgba(148,163,184,0.12)] transition-all ${
          isCategorySectionMinimized ? "p-2.5 sm:p-3" : "p-3 sm:p-4"
        }`}
      >
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate border-l-2 border-l-teal-400 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
              Suitability Categories
            </h3>
            {!isCategorySectionMinimized && (
              <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                Tune weighted conditions and choose exclusion constraints before analysis.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCategorySectionMinimized((current) => !current)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
                isCategorySectionMinimized
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
              }`}
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
            <button
              type="button"
              onClick={onToggleCategoriesEditable}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition sm:gap-2 sm:px-3 sm:text-xs ${
                categoriesEditable
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              {categoriesEditable ? <FaUnlock size={12} /> : <FaLock size={12} />}
              <span>{categoriesEditable ? "Unlocked" : "Locked"}</span>
            </button>
          </div>
        </div>

        {!isCategorySectionMinimized && (
          <div className="mt-3 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("condition")}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  activeTab === "condition"
                    ? "cursor-pointer bg-white text-emerald-700 shadow-sm"
                    : "cursor-pointer text-slate-600 hover:bg-white/70"
                }`}
              >
                Conditions
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("constraint")}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  activeTab === "constraint"
                    ? "cursor-pointer bg-white text-rose-700 shadow-sm"
                    : "cursor-pointer text-slate-600 hover:bg-white/70"
                }`}
              >
                Constraints
              </button>
            </div>

            <CategorySliderView
              activeTab={activeTab}
              conditionCategories={conditionCategories}
              constraintCategories={constraintCategories}
              selectedCondition={selectedCondition}
              selectedConstraint={selectedConstraint}
              editable={categoriesEditable}
              onToggleConditionCategory={onToggleConditionCategory}
              onToggleConstraintCategory={onToggleConstraintCategory}
              onUpdateConditionInfluence={onUpdateConditionInfluence}
              onSelectAllCondition={onSelectAllCondition}
              onClearAllCondition={onClearAllCondition}
              onSelectAllConstraint={onSelectAllConstraint}
              onClearAllConstraint={onClearAllConstraint}
            />

            {workflowError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 sm:text-xs">
                {workflowError}
              </div>
            )}

            {!workflowError && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-slate-600 sm:text-xs">
                {categoryLoading
                  ? "Loading suitability categories..."
                  : `${selectedCondition.length} condition layer(s) and ${selectedConstraint.length} constraint layer(s) selected.`}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 sm:text-xs">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-5a1 1 0 012 0v2a1 1 0 11-2 0V8z"
                    clipRule="evenodd"
                  />
                </svg>
                At least one condition category must be selected before analysis.
              </div>

              <button
                type="button"
                onClick={onAnalyze}
                disabled={stpProcess || !showCategories}
                className={`flex w-full items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-md transition duration-200 sm:px-6 sm:py-2.5 sm:text-sm ${
                  stpProcess || !showCategories
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-200 hover:from-emerald-500 hover:to-teal-500"
                }`}
              >
                {stpProcess ? "Analyzing Suitability..." : "Analyze Suitability"}
              </button>
            </div>
          </div>
        )}
      </section>

      {tableData.length > 0 && (
        <>
          <section className="rounded-3xl border border-stone-200 bg-white/72 p-2.5 shadow-[0_16px_34px_rgba(148,163,184,0.12)] sm:p-3">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate border-l-2 border-l-emerald-400 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
                  Village-wise Analysis
                </h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResultsSectionMinimized((current) => !current)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
                    isResultsSectionMinimized
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                  }`}
                >
                  <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={isResultsSectionMinimized ? "M5 10l7 7 7-7" : "M19 14l-7-7-7 7"}
                    />
                  </svg>
                  <span>{isResultsSectionMinimized ? "Expand" : "Minimize"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadCSV(tableData, csvFileName)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition duration-200 hover:bg-blue-500 sm:px-3 sm:text-xs"
                >
                  <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {!isResultsSectionMinimized && (
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
              </div>
            )}
          </section>

          <SuitabilityTreatmentCard
            areaOptions={areaOptions}
            selectedAreaId={selectedAreaOptionId}
            onSelectAreaId={onSelectAreaOption}
            onSubmit={onTreatmentSubmit}
            isSubmitting={isTreatmentLoading}
          />

          <button
            type="button"
            onClick={onReport}
            disabled={isPdfGenerating}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-md transition duration-200 sm:px-6 sm:py-2.5 sm:text-sm ${
              isPdfGenerating
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-200 hover:from-emerald-500 hover:to-teal-500"
            }`}
          >
            {isPdfGenerating ? "Generating PDF..." : "Generate Report"}
          </button>
        </>
      )}
    </div>
  );
}
