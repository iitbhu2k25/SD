"use client";

import React, { useMemo, useState } from "react";
import CategorySliderView, {
  CategorySliderModel,
} from "@/components/dss_common/CategorySliderView";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useUiModeService } from "../../services/uiModeService";

interface AdminCategorySliderProps {
  editable?: boolean;
  onToggleEditable?: () => void;
}

export default function AdminCategorySlider({
  editable = false,
  onToggleEditable,
}: AdminCategorySliderProps) {
  const [activeTab, setActiveTab] = useState<"conditions" | "constraints">("conditions");
  const isDark = useUiModeService((state) => state.isDark);

  const conditionCategories = useAdminCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useAdminCategoryStore((state) => state.constraintCategories);
  const selectedCondition = useAdminCategoryStore((state) => state.selectedCondition);
  const selectedConstraint = useAdminCategoryStore((state) => state.selectedConstraint);
  const isConditionSelected = useAdminCategoryStore((state) => state.isConditionSelected);
  const isConstraintSelected = useAdminCategoryStore((state) => state.isConstraintSelected);
  const updateConditionInfluence = useAdminCategoryStore(
    (state) => state.updateConditionInfluence,
  );
  const updateConstraintInfluence = useAdminCategoryStore(
    (state) => state.updateConstraintInfluence,
  );
  const getConditionInfluence = useAdminCategoryStore(
    (state) => state.getConditionInfluence,
  );
  const getConstraintInfluence = useAdminCategoryStore(
    (state) => state.getConstraintInfluence,
  );
  const getConditionWeight = useAdminCategoryStore((state) => state.getConditionWeight);
  const getConstraintWeight = useAdminCategoryStore((state) => state.getConstraintWeight);
  const toggleConditionCategory = useAdminCategoryStore(
    (state) => state.toggleConditionCategory,
  );
  const toggleConstraintCategory = useAdminCategoryStore(
    (state) => state.toggleConstraintCategory,
  );
  const selectAllConditionCategories = useAdminCategoryStore(
    (state) => state.selectAllConditionCategories,
  );
  const clearAllConditionCategories = useAdminCategoryStore(
    (state) => state.clearAllConditionCategories,
  );
  const selectAllConstraintCategories = useAdminCategoryStore(
    (state) => state.selectAllConstraintCategories,
  );
  const clearAllConstraintCategories = useAdminCategoryStore(
    (state) => state.clearAllConstraintCategories,
  );

  const conditionModel = useMemo<CategorySliderModel>(
    () => ({
      categories: conditionCategories,
      selectedCategories: selectedCondition,
      isSelected: isConditionSelected,
      updateCategoryInfluence: updateConditionInfluence,
      getCategoryInfluence: getConditionInfluence,
      getCategoryWeight: getConditionWeight,
      toggleCategory: toggleConditionCategory,
      selectAllCategories: selectAllConditionCategories,
      clearAllCategories: clearAllConditionCategories,
    }),
    [
      clearAllConditionCategories,
      conditionCategories,
      getConditionInfluence,
      getConditionWeight,
      isConditionSelected,
      selectAllConditionCategories,
      selectedCondition,
      toggleConditionCategory,
      updateConditionInfluence,
    ],
  );

  const constraintModel = useMemo<CategorySliderModel>(
    () => ({
      categories: constraintCategories,
      selectedCategories: selectedConstraint,
      isSelected: isConstraintSelected,
      updateCategoryInfluence: updateConstraintInfluence,
      getCategoryInfluence: getConstraintInfluence,
      getCategoryWeight: getConstraintWeight,
      toggleCategory: toggleConstraintCategory,
      selectAllCategories: selectAllConstraintCategories,
      clearAllCategories: clearAllConstraintCategories,
    }),
    [
      clearAllConstraintCategories,
      constraintCategories,
      getConstraintInfluence,
      getConstraintWeight,
      isConstraintSelected,
      selectAllConstraintCategories,
      selectedConstraint,
      toggleConstraintCategory,
      updateConstraintInfluence,
    ],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex rounded-full p-1 ${
          isDark ? "bg-[#06101e] border border-[#1e3a5f]/50" : "bg-slate-100"
        }`}
      >
        <button
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
            activeTab === "conditions"
              ? isDark
                ? "bg-[#0c2e63] text-cyan-100 shadow-sm"
                : "bg-white text-emerald-700 shadow-sm"
              : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("conditions")}
        >
          Conditions
        </button>
        <button
          className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all duration-200 ${
            activeTab === "constraints"
              ? isDark
                ? "bg-[#0c2e63] text-cyan-100 shadow-sm"
                : "bg-white text-rose-700 shadow-sm"
              : isDark
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("constraints")}
        >
          Constraints
        </button>
      </div>

      {activeTab === "conditions" ? (
        <CategorySliderView
          editable={editable}
          model={conditionModel}
          onToggleEditable={onToggleEditable}
          isDark={isDark}
          showInfluenceControls={true}
        />
      ) : (
        <CategorySliderView
          editable={editable}
          model={constraintModel}
          onToggleEditable={onToggleEditable}
          isDark={isDark}
          showInfluenceControls={false}
        />
      )}
    </div>
  );
}
