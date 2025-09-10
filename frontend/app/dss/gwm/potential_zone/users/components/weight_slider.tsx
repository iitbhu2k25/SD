"use client";
import React, { useEffect, useState } from "react";
import { useCategory } from "@/contexts/groundwaterzone/admin/CategoryContext";

export const CategorySlider = () => {
  const {
    categories,
    selectedCategories,
    isSelected,
    updateCategoryInfluence,
    getCategoryInfluence,
    getCategoryWeight,
  } = useCategory();
  useEffect(() => {
    const checkInfluence = () => {
      if (selectedCategories.length > 0) {
        let InfluenceSum = 0;
        selectedCategories.forEach((category) => {
          InfluenceSum += getCategoryInfluence(category.file_name);
        });
      }
    };
    checkInfluence();
  }, [selectedCategories, updateCategoryInfluence]);
  // If no categories are selected, show a message
  if (selectedCategories.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Select categories to adjust their Influences
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="grid grid-cols-3 w-full mb-4">
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
      <div className="space-y-5">
        {categories.map(
          (category) =>
            // Only render sliders for selected categories
            isSelected(category.file_name) && (
              <div key={category.id} className="mb-4">
                <div className="grid grid-cols-3 gap-2 items-center mb-2">
                  <span title={category.file_name}>{category.file_name}</span>
                  <span className="text-sm font-bold text-center">
                    {Math.max(
                      1,
                      Math.round(getCategoryInfluence(category.file_name))
                    )}
                  </span>
                  <span className="text-sm font-bold text-right">
                    {getCategoryWeight(category.file_name)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-24 text-left">
                    <span className="font-medium">1</span> (Least Important)
                  </div>

                  <div className="relative flex-1">
                    {/* Custom slider track with gradient */}
                    <div className="absolute h-2 w-full rounded-lg bg-gradient-to-r from-blue-100 to-blue-600"></div>

                    {/* Tick marks for reference points */}
                    <div className="absolute w-full flex justify-between px-1 -mt-1">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-4 w-0.5 bg-gray-300"></div>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={getCategoryInfluence(category.file_name)}
                      onChange={(e) =>
                        updateCategoryInfluence(
                          category.file_name,
                          parseFloat(e.target.value)
                        )
                      }
                      className="relative w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
                      style={{
                        // Custom thumb styling for better visibility
                        WebkitAppearance: "none",
                        appearance: "none",
                      }}
                      aria-label={`Adjust importance of ${category.file_name} from 1 (least important) to 10 (most important)`}
                    />
                  </div>

                  <div className="text-xs text-gray-500 w-24 text-right">
                    <span className="font-medium">10</span> (Most Important)
                  </div>
                </div>

                {/* Visual scale indicators */}
                <div className="flex justify-between mt-1 px-24">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-100"></div>
                    <span className="text-xs text-gray-400">Low</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-300"></div>
                    <span className="text-xs text-gray-400">Medium</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <span className="text-xs text-gray-400">High</span>
                  </div>
                </div>
              </div>
            )
        )}
      </div>

      <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600 border-l-4 border-blue-400">
        <p className="font-medium mb-1 text-gray-700">How to use:</p>
        <ul className="list-disc pl-5 space-y-1 marker:text-purple-500 marker:text-[1.25rem]">
          <li>
            Initially, all actual preassigned weights will be displayed, which
            can be changed by dragging the sliders.
          </li>
          <li>Drag the sliders to adjust the importance of each category.</li>
          <li>
            Higher values (closer to 10) give more weight to that factor in the
            analysis.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CategorySlider;
