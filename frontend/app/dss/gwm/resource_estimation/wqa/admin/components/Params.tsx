"use client";
import React from "react";
import { useYear } from "@/contexts/water_quality_assesment/admin/yearContext";

interface MultiSelectButtonsProps {
  options: string[];
  label?: string;
  onChange?: (selectedParam: string[]) => void;
}

const MultiSelectButtons: React.FC<MultiSelectButtonsProps> = ({ options, label, onChange }) => {
  const { selectedParam, setSelectedParam } = useYear();

  const toggleSelect = (option: string) => {
    const newSelected = selectedParam.includes(option)
      ? selectedParam.filter((item) => item !== option)
      : [...selectedParam, option];
    setSelectedParam(newSelected);
    onChange?.(newSelected);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md">
      {label && <h2 className="text-lg font-semibold text-gray-800 mb-4">{label}</h2>}

      {/* 4-column grid layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => toggleSelect(option)}
            className={`w-full text-center px-4 py-2 rounded-xl border text-sm font-medium tracking-wide transition-all duration-200
              ${
                selectedParam.includes(option)
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-gray-50 text-gray-800 border-gray-300 hover:bg-blue-50 hover:border-blue-400"
              }
            `}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Display selected params */}
      {selectedParam.length > 0 && (
        <div className="mt-5 text-sm text-gray-700 border-t pt-3">
          <span className="font-semibold text-gray-800">Selected Parameters:</span>{" "}
          <span className="text-blue-600">{selectedParam.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

export default MultiSelectButtons;
