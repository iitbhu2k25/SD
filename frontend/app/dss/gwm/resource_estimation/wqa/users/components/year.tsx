"use client";

import React from "react";
import { useYear } from "@/contexts/water_quality_assesment/users/yearContext";

const YearSelector = () => {
  const { years, selectedYear, setSelectedYear } = useYear();

  if (!years.length) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-gray-500 text-sm">Loading years...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6 p-6 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-200 rounded-lg shadow-lg">

      {years.map((year) => (
        <button
          key={year}
          onClick={() => setSelectedYear(year)}
          className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 ease-in-out 
            transform hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-blue-500
            ${
              selectedYear === year
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg ring-2 ring-blue-500"
                : "bg-white text-gray-800 border-2 border-gray-300 hover:bg-blue-100 hover:text-blue-600 hover:border-blue-500"
            }`}
          aria-pressed={selectedYear === year}
        >
          {year}
        </button>
      ))}
    </div>
  );
};

export default YearSelector;
