"use client";

// This connects the admin category data to the slider UI.
// MAR has two separate types: conditions and constraints.
import React, { useMemo, useState } from "react";
import { CategorySliderModel } from "@/components/dss_common/CategorySliderView";
import CategorySliderView from "@/components/dss_common/CategorySliderView";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";

interface AdminCategorySliderProps {
  editable?: boolean;
  onToggleEditable?: () => void;
}

export default function AdminCategorySlider({
  editable = false,
  onToggleEditable,
}: AdminCategorySliderProps) {
  const [activeTab, setActiveTab] = useState<"conditions" | "constraints">("conditions");
  
  const conditionCategories = useAdminCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useAdminCategoryStore((state) => state.constraintCategories);
  
  const selectedConditions = useAdminCategoryStore((state) => state.selectedConditions);
  const selectedConstraints = useAdminCategoryStore((state) => state.selectedConstraints);

  const isConditionSelected = useAdminCategoryStore((state) => state.isConditionSelected);
  const isConstraintSelected = useAdminCategoryStore((state) => state.isConstraintSelected);
  
  const updateConditionInfluence = useAdminCategoryStore((state) => state.updateConditionCategoryInfluence);
  const updateConstraintInfluence = useAdminCategoryStore((state) => state.updateConstraintCategoryInfluence);
  
  const getConditionInfluence = useAdminCategoryStore((state) => state.getConditionCategoryInfluence);
  const getConstraintInfluence = useAdminCategoryStore((state) => state.getConstraintCategoryInfluence);
  
  const getConditionWeight = useAdminCategoryStore((state) => state.getConditionCategoryWeight);
  const getConstraintWeight = useAdminCategoryStore((state) => state.getConstraintCategoryWeight);
  
  const toggleConditionCategory = useAdminCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useAdminCategoryStore((state) => state.toggleConstraintCategory);
  
  const selectAllConditions = useAdminCategoryStore((state) => state.selectAllConditionCategories);
  const clearAllConditions = useAdminCategoryStore((state) => state.clearAllConditionCategories);
  
  const selectAllConstraints = useAdminCategoryStore((state) => state.selectAllConstraintCategories);
  const clearAllConstraints = useAdminCategoryStore((state) => state.clearAllConstraintCategories);

  const conditionModel = useMemo<CategorySliderModel>(
    () => ({
      categories: conditionCategories,
      selectedCategories: selectedConditions,
      isSelected: isConditionSelected,
      updateCategoryInfluence: updateConditionInfluence,
      getCategoryInfluence: getConditionInfluence,
      getCategoryWeight: getConditionWeight,
      toggleCategory: toggleConditionCategory,
      selectAllCategories: selectAllConditions,
      clearAllCategories: clearAllConditions,
    }),
    [
      conditionCategories, selectedConditions, isConditionSelected,
      updateConditionInfluence, getConditionInfluence, getConditionWeight,
      toggleConditionCategory, selectAllConditions, clearAllConditions,
    ],
  );

  const constraintModel = useMemo<CategorySliderModel>(
    () => ({
      categories: constraintCategories,
      selectedCategories: selectedConstraints,
      isSelected: isConstraintSelected,
      updateCategoryInfluence: updateConstraintInfluence,
      getCategoryInfluence: getConstraintInfluence,
      getCategoryWeight: getConstraintWeight,
      toggleCategory: toggleConstraintCategory,
      selectAllCategories: selectAllConstraints,
      clearAllCategories: clearAllConstraints,
    }),
    [
      constraintCategories, selectedConstraints, isConstraintSelected,
      updateConstraintInfluence, getConstraintInfluence, getConstraintWeight,
      toggleConstraintCategory, selectAllConstraints, clearAllConstraints,
    ],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Tab Switcher */}
      <div className="flex rounded-full bg-slate-100 p-1">
        <button
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
          editable={editable}
          model={conditionModel}
          onToggleEditable={onToggleEditable}
          showInfluenceControls={true}
        />
      ) : (
        <CategorySliderView
          editable={editable}
          model={constraintModel}
          onToggleEditable={onToggleEditable}
          showInfluenceControls={false}
        />
      )}
    </div>
  );
}
