"use client";
import React, { useEffect } from "react";
import { useCategory } from "@/contexts/stp/stp_priority/admin/CategoryContext";

interface CategorySliderProps {
  editable?: boolean;
}

const CategorySlider: React.FC<CategorySliderProps> = ({ editable = false }) => {
  const {
    categories,
    selectedCategories,
    isSelected,
    updateCategoryInfluence,
    getCategoryInfluence,
    getCategoryWeight,
    toggleCategory,
  } = useCategory();

  useEffect(() => {
    if (selectedCategories.length > 0) {
      let influenceSum = 0;
      selectedCategories.forEach((category) => {
        influenceSum += getCategoryInfluence(category.id);
      });
    }
  }, [selectedCategories, getCategoryInfluence]);

  return (
    <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_100px_100px] gap-4 w-full mb-4">
        <div></div> {/* Checkbox column */}
        <h2 className="text-lg font-semibold text-gray-800 text-left">
          Category
        </h2>
        <h2 className="text-lg font-semibold text-gray-800 text-center">
          Influences
        </h2>
        <h2 className="text-lg font-semibold text-gray-800 text-right">
          Weight
        </h2>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((category) => {
          const selected = isSelected(category.id);

          return (
            <div
              key={category.id}
              className={`transition ${
                !selected || !editable ? "opacity-50" : ""
              }`}
            >
              {/* Single aligned row */}
              <div className="grid grid-cols-[auto_1fr_100px_100px] gap-4 items-center">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() =>
                    toggleCategory(category.id, category.file_name)
                  }
                  className="h-4 w-4 text-blue-600 rounded"
                />

                {/* Category name and slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span
                      title={category.file_name}
                      className="font-medium w-48 truncate shrink-0"
                    >
                      {category.file_name}
                    </span>

                    {/* Slider */}
                    <div className="relative flex-1 min-w-[220px]">
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
                        value={getCategoryInfluence(category.id)}
                        onChange={(e) =>
                          selected &&
                          editable &&
                          updateCategoryInfluence(
                            category.id,
                            category.file_name,
                            parseFloat(e.target.value)
                          )
                        }
                        disabled={!selected || !editable}
                        className={`relative w-full h-2 bg-transparent appearance-none z-10 ${
                          !selected || !editable
                            ? "cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                        style={{
                          WebkitAppearance: "none",
                          appearance: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Scale indicators - positioned below slider */}
                  <div className="flex justify-between pl-[12rem]">
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

                {/* Influence */}
                <span className="text-sm font-bold text-center">
                  {Math.max(
                    1,
                    Math.round(getCategoryInfluence(category.id))
                  )}
                </span>

                {/* Weight */}
                <span className="text-sm font-bold text-right">
                  {getCategoryWeight(category.id)}
                </span>
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

export default CategorySlider;