"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import CollapseToggle from "@/components/dss_common/CollapseToggle";
import type { DataRow, Stp_area } from "../services/stpSuitabilityTypes";
import StpTechnologyDss, {
  type TechnologyAreaSubmitValues,
} from "./StpTechnologyDss";

interface SuitabilityWorkflowPanelProps {
  showCategories: boolean;
  categoryLoading: boolean;
  workflowError: string | null;
  selectedConditionCount: number;
  selectedConstraintCount: number;
  areaOptions?: Stp_area[];
  selectedAreaOptionId?: number | null;
  stpProcess: boolean;
  isTreatmentLoading: boolean;
  tableData: DataRow[];
  renderCategorySlider: () => ReactNode;
  renderPriorityRiskSummary?: () => ReactNode;
  canFindTechnologyArea: boolean;
  enableDprCostEstimator?: boolean;
  initialTechnologyValues?: TechnologyAreaSubmitValues | null;
  onAnalyze: () => void | Promise<void>;
  onSelectAreaOption?: (areaId: number | null) => void;
  onTreatmentSubmit?: (values: TechnologyAreaSubmitValues) => void | Promise<void>;
  onTechnologyAreaSubmit: (values: TechnologyAreaSubmitValues) => void | boolean | Promise<void | boolean>;
}

export default function SuitabilityWorkflowPanel({
  showCategories,
  categoryLoading,
  workflowError,
  selectedConditionCount,
  selectedConstraintCount,
  stpProcess,
  isTreatmentLoading,
  tableData,
  renderCategorySlider,
  renderPriorityRiskSummary,
  canFindTechnologyArea,
  enableDprCostEstimator = false,
  initialTechnologyValues = null,
  onAnalyze,
  onTechnologyAreaSubmit,
}: SuitabilityWorkflowPanelProps) {
  const [isCategorySectionMinimized, setIsCategorySectionMinimized] = useState(false);

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
            <CollapseToggle
              isCollapsed={isCategorySectionMinimized}
              onToggle={() => setIsCategorySectionMinimized((current) => !current)}
              expandLabel="Expand suitability categories"
              collapseLabel="Minimize suitability categories"
            />
          </div>
        </div>

        {!isCategorySectionMinimized && (
          <div className="mt-3 space-y-3 sm:space-y-4">
            {renderCategorySlider()}

            {workflowError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 sm:text-xs">
                {workflowError}
              </div>
            )}

            {!workflowError && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-slate-600 sm:text-xs">
                {categoryLoading
                  ? "Loading suitability categories..."
                  : `${selectedConditionCount} condition layer(s) and ${selectedConstraintCount} constraint layer(s) selected.`}
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
                onClick={() => {
                  onAnalyze();
                  setIsCategorySectionMinimized(true);
                }}
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

      {renderPriorityRiskSummary?.()}

      {tableData.length > 0 && (
        <div className="space-y-3">
          <StpTechnologyDss
            canFindArea={canFindTechnologyArea}
            enableDprCostEstimator={enableDprCostEstimator}
            isFindingArea={isTreatmentLoading}
            initialValues={initialTechnologyValues}
            showClusterSelect={true}
            onFindArea={onTechnologyAreaSubmit}
          />
        </div>
      )}
    </div>
  );
}
