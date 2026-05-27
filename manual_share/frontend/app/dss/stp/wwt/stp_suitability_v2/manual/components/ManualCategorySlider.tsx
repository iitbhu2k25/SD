"use client";

import { useMemo, useState } from "react";
import CategorySliderView, { type CategorySliderModel } from "@/components/dss_common/CategorySliderView";
import { useManualCategoryStore } from "../stores/manualCategoryStore";

export default function ManualCategorySlider() {
  const [activeTab, setActiveTab] = useState<"conditions" | "constraints">("conditions");

  const conditionCategories = useManualCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useManualCategoryStore((state) => state.constraintCategories);
  const selectedCondition = useManualCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useManualCategoryStore((state) => state.selectedConstraint);
  const toggleConditionCategory = useManualCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useManualCategoryStore((state) => state.toggleConstraintCategory);
  const updateConditionCategoryInfluence = useManualCategoryStore((state) => state.updateConditionCategoryInfluence);
  const selectAllConditionCategories = useManualCategoryStore((state) => state.selectAllConditionCategories);
  const clearAllConditionCategories = useManualCategoryStore((state) => state.clearAllConditionCategories);
  const selectAllConstraintCategories = useManualCategoryStore((state) => state.selectAllConstraintCategories);
  const clearAllConstraintCategories = useManualCategoryStore((state) => state.clearAllConstraintCategories);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex rounded-full bg-slate-100 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
            activeTab === "conditions" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("conditions")}
        >
          Conditions
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
            activeTab === "constraints" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("constraints")}
        >
          Constraints
        </button>
      </div>

      {activeTab === "conditions" ? (
        <CategorySliderView editable={true} model={conditionModel} showInfluenceControls={true} />
      ) : (
        <CategorySliderView editable={true} model={constraintModel} showInfluenceControls={false} />
      )}
    </div>
  );
}
