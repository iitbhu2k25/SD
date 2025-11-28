"use client";
import React from "react";
import { useYear } from "@/contexts/water_quality_assesment/users/yearContext";

interface MultiSelectButtonsProps {
  options: string[];
  label?: string;
  onChange?: (selectedParam: string[]) => void;
}

const MultiSelectButtons: React.FC<MultiSelectButtonsProps> = ({ options, label, onChange }) => {
  const { selectedParam, setSelectedParam } = useYear();

  // Toggle single select
  const toggleSelect = (option: string) => {
    const formattedOption = option.trim().replace(/\s+/g, "_");

    const newSelected = selectedParam.includes(formattedOption)
      ? selectedParam.filter((item) => item !== formattedOption)
      : [...selectedParam, formattedOption];

    setSelectedParam(newSelected);
    onChange?.(newSelected);
  };

  // Select all
  const handleSelectAll = () => {
    const allOptions = options.map((opt) => opt.trim().replace(/\s+/g, "_"));
    setSelectedParam(allOptions);
    onChange?.(allOptions);
  };

  // Reset all
  const handleResetAll = () => {
    setSelectedParam([]);
    onChange?.([]);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {label && <h2 className="text-lg font-semibold text-gray-800">{label}</h2>}
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
          >
            Select All
          </button>
          <button
            onClick={handleResetAll}
            className="px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* 4-column grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {options.map((option) => {
          const formattedOption = option.trim().replace(/\s+/g, "_");
          const isSelected = selectedParam.includes(formattedOption);
          return (
            <button
              key={option}
              onClick={() => toggleSelect(option)}
              className={`w-full text-center px-4 py-2 rounded-xl border text-sm font-medium tracking-wide transition-all duration-200
                ${isSelected
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-gray-50 text-gray-800 border-gray-300 hover:bg-blue-50 hover:border-blue-400"
                }
              `}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Display selected params */}
      {selectedParam.length > 0 && (
        <div className="mt-5 text-sm text-gray-700 border-t pt-3">
         
        </div>
      )}
    </div>
  );
};

export default MultiSelectButtons;
