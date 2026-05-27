"use client";

import { useMemo, useState } from "react";
import CategorySliderView, { type CategorySliderModel } from "@/components/dss_common/CategorySliderView";
import { useManualCategoryStore } from "../stores/manualCategoryStore";
import { useManualMapStore } from "../stores/manualMapStore";

interface ManualCategorySelectorProps {
  onAnalyzeDone: () => void;
}

export default function ManualCategorySelector({ onAnalyzeDone }: ManualCategorySelectorProps) {
  const [activeTab, setActiveTab] = useState<"conditions" | "constraints">("conditions");
  const [analyzed, setAnalyzed] = useState(false);

  const conditionCategories = useManualCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useManualCategoryStore((state) => state.constraintCategories);
  const selectedCondition = useManualCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useManualCategoryStore((state) => state.selectedConstraint);
  const isLoading = useManualCategoryStore((state) => state.isLoading);
  const error = useManualCategoryStore((state) => state.error);
  const toggleConditionCategory = useManualCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useManualCategoryStore((state) => state.toggleConstraintCategory);
  const updateConditionCategoryInfluence = useManualCategoryStore((state) => state.updateConditionCategoryInfluence);
  const selectAllConditionCategories = useManualCategoryStore((state) => state.selectAllConditionCategories);
  const clearAllConditionCategories = useManualCategoryStore((state) => state.clearAllConditionCategories);
  const selectAllConstraintCategories = useManualCategoryStore((state) => state.selectAllConstraintCategories);
  const clearAllConstraintCategories = useManualCategoryStore((state) => state.clearAllConstraintCategories);

  const runAnalysis = useManualMapStore((state) => state.runAnalysis);
  const stpOperation = useManualMapStore((state) => state.stpOperation);

  const conditionModel = useMemo<CategorySliderModel>(
    () => ({
      categories: conditionCategories,
      selectedCategories: selectedCondition,
      isSelected: (id) => selectedCondition.some((item) => item.id === id),
      updateCategoryInfluence: updateConditionCategoryInfluence,
      getCategoryInfluence: (id) => {
        const selected = selectedCondition.find((item) => item.id === id);
        if (selected) return Number.parseFloat(selected.Influence);
        const category = conditionCategories.find((item) => item.id === id);
        return category ? Number(category.weight) : 0;
      },
      getCategoryWeight: (id) => {
        const selected = selectedCondition.find((item) => item.id === id);
        return selected?.weight ? Number.parseFloat(selected.weight) : 0;
      },
      toggleCategory: toggleConditionCategory,
      selectAllCategories: selectAllConditionCategories,
      clearAllCategories: clearAllConditionCategories,
    }),
    [conditionCategories, selectedCondition, updateConditionCategoryInfluence, toggleConditionCategory, selectAllConditionCategories, clearAllConditionCategories],
  );

  const constraintModel = useMemo<CategorySliderModel>(
    () => ({
      categories: constraintCategories,
      selectedCategories: selectedConstraint,
      isSelected: (id) => selectedConstraint.some((item) => item.id === id),
      updateCategoryInfluence: () => undefined,
      getCategoryInfluence: (id) => {
        const selected = selectedConstraint.find((item) => item.id === id);
        if (selected) return Number.parseFloat(selected.Influence);
        const category = constraintCategories.find((item) => item.id === id);
        return category ? Number(category.weight) : 0;
      },
      getCategoryWeight: (id) => {
        const selected = selectedConstraint.find((item) => item.id === id);
        return selected?.weight ? Number.parseFloat(selected.weight) : 0;
      },
      toggleCategory: toggleConstraintCategory,
      selectAllCategories: selectAllConstraintCategories,
      clearAllCategories: clearAllConstraintCategories,
    }),
    [constraintCategories, selectedConstraint, toggleConstraintCategory, selectAllConstraintCategories, clearAllConstraintCategories],
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center text-xs text-slate-500">
        Loading categories…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        {error}
      </div>
    );
  }

  if (conditionCategories.length === 0) return null;

  const handleAnalyze = async () => {
    setAnalyzed(false);
    await runAnalysis();
    setAnalyzed(true);
  };

  return (
    <section className="rounded-3xl border border-stone-200 bg-white/72 p-3 shadow-[0_16px_34px_rgba(148,163,184,0.12)] sm:p-4">
      <div className="mb-3">
        <h3 className="border-l-2 border-l-violet-500 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
          Suitability Categories
        </h3>
        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
          Select condition and constraint layers, then analyze suitability for the marked area.
        </p>
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="flex rounded-full bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
              activeTab === "conditions"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("conditions")}
          >
            Conditions
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
              activeTab === "constraints"
                ? "bg-white text-rose-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("constraints")}
          >
            Constraints
          </button>
        </div>

        {activeTab === "conditions" ? (
          <CategorySliderView
            editable={true}
            model={conditionModel}
            showInfluenceControls={true}
          />
        ) : (
          <CategorySliderView
            editable={true}
            model={constraintModel}
            showInfluenceControls={false}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void handleAnalyze()}
          disabled={stpOperation || selectedCondition.length === 0}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all ${
            stpOperation || selectedCondition.length === 0
              ? "cursor-not-allowed bg-stone-300"
              : "bg-gradient-to-r from-violet-600 to-purple-600 shadow-md shadow-violet-200 hover:from-violet-500 hover:to-purple-500 hover:scale-[1.02]"
          }`}
        >
          {stpOperation ? "Analyzing…" : "Analyze Suitability"}
        </button>

        {selectedCondition.length === 0 && (
          <p className="text-center text-[11px] text-amber-600">
            Select at least one condition category to run analysis.
          </p>
        )}

        {analyzed && !stpOperation && (
          <button
            type="button"
            onClick={onAnalyzeDone}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Proceed to STP Technology Selection →
          </button>
        )}
      </div>
    </section>
  );
}
