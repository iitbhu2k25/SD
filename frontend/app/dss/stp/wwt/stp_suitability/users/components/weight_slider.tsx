'use client'
import React from 'react';
import { useCategory } from '@/contexts/stp_suitability/admin/CategoryContext';

interface CategorySliderProps {
  activeTab: 'condition' | 'constraint';
  editable?: boolean;
}

// Constants for better maintainability
const SLIDER_CONFIG = {
  MIN: 1,
  MAX: 10,
  STEP: 0.1,
} as const;

export const CategorySlider: React.FC<CategorySliderProps> = ({ activeTab, editable = false }) => {

  const {
    condition_categories,
    constraint_categories,
    selectedCondition,
    selectedConstraint,
    updateConditionCategoryInfluence,
    getConditionCategoryInfluence,
    isConditionSelected,
    isConstraintSelected,
    getConditionCategoryWeight,
    toggleConditionCategory,
    selectAllConditionCategories,
    clearAllConditionCategories,
    toggleConstraintCategory,
    selectAllConstraintCategories,
    clearAllConstraintCategories,
  } = useCategory();

  // Render condition categories with sliders
  const renderConditionCategories = () => {
    const allSelected = condition_categories.length === selectedCondition.length && condition_categories.length > 0;
    const selectedCount = selectedCondition.length;

    return (
      <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Select/Clear All Buttons */}
        <div className="flex gap-6 mb-4 justify-end">
          <button
            onClick={selectAllConditionCategories}
            disabled={allSelected}
            className={`text-xs px-3 py-1 rounded-md ${allSelected
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            Select All
          </button>
          <button
            onClick={clearAllConditionCategories}
            disabled={selectedCount === 0}
            className={`text-xs px-3 py-1 rounded-md ${selectedCount === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            Clear All
          </button>
        </div>

        {/* Header Row */}
        <div className="grid grid-cols-3 w-full mb-4">
          <h2 className="text-lg font-semibold text-gray-800 text-left">
            Condition Category
          </h2>
          <h2 className="text-lg font-semibold text-gray-800 text-center">
            Influences
          </h2>
          <h2 className="text-lg font-semibold text-gray-800 text-right">
            Weight
          </h2>
        </div>

        {/* Categories */}
        <div className="space-y-5">
          {condition_categories.map((category) => {
            const selected = isConditionSelected(category.id);

            return (
              <div
                key={category.id}
                className={`mb-4 transition ${!selected || !editable ? "opacity-50" : ""
                  }`}
              >
                {/* Title row */}
                <div className="grid grid-cols-3 gap-2 items-center mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        toggleConditionCategory(category.id, category.file_name)
                      }
                      className="h-4 w-4 text-blue-600 rounded"
                    />

                    <span
                      title={category.file_name}
                      className="font-medium"
                    >
                      {category.file_name}
                    </span>
                  </div>

                  <span className="text-sm font-bold text-center">
                    {Math.max(
                      1,
                      Math.round(getConditionCategoryInfluence(category.id))
                    )}
                  </span>

                  <span className="text-sm font-bold text-right">
                    {getConditionCategoryWeight(category.id)}
                  </span>
                </div>

                {/* Slider */}
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-24 text-left">
                    <span className="font-medium">1</span> (Least Important)
                  </div>

                  <div className="relative flex-1">
                    {/* Track */}
                    <div className="absolute h-2 w-full rounded-lg bg-gradient-to-r from-blue-100 to-blue-600" />

                    {/* Tick marks */}
                    <div className="absolute w-full flex justify-between px-1 -mt-1">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="h-4 w-0.5 bg-gray-300"
                        />
                      ))}
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={getConditionCategoryInfluence(category.id)}
                      onChange={(e) =>
                        selected &&
                        editable &&
                        updateConditionCategoryInfluence(
                          category.id,
                          category.file_name,
                          parseFloat(e.target.value)
                        )
                      }
                      disabled={!selected || !editable}
                      className={`relative w-full h-2 bg-transparent appearance-none z-10 ${!selected || !editable
                        ? "cursor-not-allowed"
                        : "cursor-pointer"
                        }`}
                      style={{
                        WebkitAppearance: "none",
                        appearance: "none",
                      }}
                      aria-label={`Adjust importance of ${category.file_name}`}
                    />
                  </div>

                  <div className="text-xs text-gray-500 w-24 text-right">
                    <span className="font-medium">10</span> (Most Important)
                  </div>
                </div>

                {/* Scale indicators */}
                <div className="flex justify-between mt-1 px-24">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-100" />
                    <span className="text-xs text-gray-400">Low</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-300" />
                    <span className="text-xs text-gray-400">Medium</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-xs text-gray-400">High</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600 border-l-4 border-blue-400">
          <p className="font-medium mb-1 text-gray-700">How to use:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Select categories using the checkbox.</li>
            <li>Drag the sliders to adjust their influence.</li>
            <li>Higher values give more weight in the analysis.</li>
          </ul>
        </div>
      </div>
    );
  };

  // Render constraint categories (display only with checkboxes)
  const renderConstraintCategories = () => {
    const allSelected = constraint_categories.length === selectedConstraint.length && constraint_categories.length > 0;
    const selectedCount = selectedConstraint.length;

    return (
      <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Select/Clear All Buttons */}
        <div className="flex gap-6 mb-4 justify-end">
          <button
            onClick={selectAllConstraintCategories}
            disabled={allSelected}
            className={`text-xs px-3 py-1 rounded-md ${allSelected
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            Select All
          </button>
          <button
            onClick={clearAllConstraintCategories}
            disabled={selectedCount === 0}
            className={`text-xs px-3 py-1 rounded-md ${selectedCount === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            Clear All
          </button>
        </div>

        {/* Header */}
        <h2 className="text-lg font-semibold mb-4 text-gray-800 text-left">
          Constraint Categories
        </h2>

        {/* Categories */}
        <div className="space-y-3">
          {constraint_categories.map((category) => {
            const selected = isConstraintSelected(category.id);

            return (
              <div
                key={category.id}
                className={`p-3 bg-gray-50 rounded-md border border-gray-200 transition ${
                  !selected ? 'opacity-50' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        toggleConstraintCategory(category.id, category.file_name)
                      }
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span 
                      title={category.file_name}
                      className="font-medium text-gray-700"
                    >
                      {category.file_name}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                    Constraint
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600 border-l-4 border-red-400">
          <p className="font-medium mb-1 text-gray-700">How to use:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Select constraint categories using the checkbox.</li>
            <li>Constraint categories define areas that are excluded from the analysis.</li>
          </ul>
        </div>
      </div>
    );
  };

  return activeTab === 'condition' ? renderConditionCategories() : renderConstraintCategories();
};

export default CategorySlider;