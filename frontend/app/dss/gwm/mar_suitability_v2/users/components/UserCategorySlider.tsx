"use client";

// This connects the user category data to the slider UI.
// MAR has two separate types: conditions and constraints.
import React, { useMemo, useState } from "react";
import { CategorySliderModel } from "@/components/dss_common/CategorySliderView";
import CategorySliderView from "@/components/dss_common/CategorySliderView";
import { useUserCategoryStore } from "../stores/userCategoryStore";

interface UserCategorySliderProps {
  editable?: boolean;
  onToggleEditable?: () => void;
}

export default function UserCategorySlider({
  editable = false,
  onToggleEditable,
}: UserCategorySliderProps) {
  const [activeTab, setActiveTab] = useState<"conditions" | "constraints">("conditions");
  
  const conditionCategories = useUserCategoryStore((state) => state.conditionCategories);
  const constraintCategories = useUserCategoryStore((state) => state.constraintCategories);
  
  const selectedConditions = useUserCategoryStore((state) => state.selectedConditions);
  const selectedConstraints = useUserCategoryStore((state) => state.selectedConstraints);

  const isConditionSelected = useUserCategoryStore((state) => state.isConditionSelected);
  const isConstraintSelected = useUserCategoryStore((state) => state.isConstraintSelected);
  
  const updateConditionInfluence = useUserCategoryStore((state) => state.updateConditionCategoryInfluence);
  const updateConstraintInfluence = useUserCategoryStore((state) => state.updateConstraintCategoryInfluence);
  
  const getConditionInfluence = useUserCategoryStore((state) => state.getConditionCategoryInfluence);
  const getConstraintInfluence = useUserCategoryStore((state) => state.getConstraintCategoryInfluence);
  
  const getConditionWeight = useUserCategoryStore((state) => state.getConditionCategoryWeight);
  const getConstraintWeight = useUserCategoryStore((state) => state.getConstraintCategoryWeight);
  
  const toggleConditionCategory = useUserCategoryStore((state) => state.toggleConditionCategory);
  const toggleConstraintCategory = useUserCategoryStore((state) => state.toggleConstraintCategory);
  
  const selectAllConditions = useUserCategoryStore((state) => state.selectAllConditionCategories);
  const clearAllConditions = useUserCategoryStore((state) => state.clearAllConditionCategories);
  
  const selectAllConstraints = useUserCategoryStore((state) => state.selectAllConstraintCategories);
  const clearAllConstraints = useUserCategoryStore((state) => state.clearAllConstraintCategories);

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
