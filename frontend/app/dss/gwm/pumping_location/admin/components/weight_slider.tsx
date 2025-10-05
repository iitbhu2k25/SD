'use client'
import React from 'react';
import { useCategory } from '@/contexts/groundwaterIdent/admin/CategoryContext';

interface CategorySliderProps {
  activeTab: 'condition' | 'constraint';
}

// Constants for better maintainability
const SLIDER_CONFIG = {
  MIN: 1,
  MAX: 10,
  STEP: 0.1,
} as const;

export const CategorySlider: React.FC<CategorySliderProps> = ({ activeTab }) => {

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
    getConstraintCategoryInfluence
  } = useCategory();

  // Format file name for display - actually implement formatting logic
  const formatName = (fileName: string): string => {
    console.log(fileName);
    return fileName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  };

  // Render condition categories with sliders
  const renderConditionCategories = () => {
    if (selectedCondition.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          Select condition categories to adjust their influences
        </div>
      );
    }

    return (
      <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
         <div className="grid grid-cols-3 w-full mb-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Selected Constraint Categories
        </h3>
         <h2 className="text-lg font-semibold text-gray-800 text-center">
          Influences
        </h2>
        <h2 className="text-lg font-semibold text-gray-800 text-right">
          Weight
        </h2>
      </div>
        
        <div className="space-y-5">
          {condition_categories
            .filter(category => isConditionSelected(category.id))
            .map((category) => (
              <div key={category.id} className="mb-4">
               <div className="grid grid-cols-3 gap-2 items-center mb-2">
                  <span title={category.file_name}>{category.file_name}</span>
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
                
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-24 text-left">
                    <span className="font-medium">{SLIDER_CONFIG.MIN}</span> (Least Important)
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
                      min={SLIDER_CONFIG.MIN}
                      max={SLIDER_CONFIG.MAX}
                     
                      value={getConditionCategoryInfluence(category.id)}
                      onChange={(e) => updateConditionCategoryInfluence(
                        category.id, 
                        category.file_name,
                        parseFloat(e.target.value)
                      )}
                      className="relative w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
                       style={{
                        // Custom thumb styling for better visibility
                        WebkitAppearance: "none",
                        appearance: "none",
                      }}
                      aria-label={`Adjust importance of ${formatName(category.file_name)} from ${SLIDER_CONFIG.MIN} (least important) to ${SLIDER_CONFIG.MAX} (most important)`}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-500 w-24 text-right">
                    <span className="font-medium">{SLIDER_CONFIG.MAX}</span> (Most Important)
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
            ))}
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

  // Render constraint categories (display only)
  const renderConstraintCategories = () => {
    if (selectedConstraint.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          Select constraint categories to view them
        </div>
      );
    }

    return (
      <div className="w-full p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Selected Constraint Categories
        </h3>
        
        
        <div className="space-y-2">
          {constraint_categories
            .filter(category => isConstraintSelected(category.id))
            .map((category) => (
              <div key={category.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">
                    {formatName(category.file_name)}
                  </span>
                  <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full border border-red-100">
                    Constraint
                  </span>
                </div>
              </div>
            ))}
        </div>
        
        <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600 border-l-4 border-red-400">
          <p>Constraint categories define areas that are excluded from the analysis.</p>
        </div>
      </div>
    );
  };

  return activeTab === 'condition' ? renderConditionCategories() : renderConstraintCategories();
};

export default CategorySlider;