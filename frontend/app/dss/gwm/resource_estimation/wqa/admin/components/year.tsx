"use client";

import React from "react";
import { useYear } from "@/contexts/water_quality_assesment/admin/yearContext";

const YearSelector = () => {
  const { years, selectedYear, setSelectedYear } = useYear();

  if (!years.length) {
    return (
      <div className="flex items-center justify-center py-2">
        <p className="text-gray-500 text-sm">Loading years...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700 mr-2">
        Select Year:
      </span>

      {years.map((year) => (
        <button
          key={year}
          onClick={() => setSelectedYear(year)}
          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-150
            ${
              selectedYear === year
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
            }`}
        >
          {year}
        </button>
      ))}
    </div>
  );
};

export default YearSelector;
