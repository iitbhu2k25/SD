"use client";

import React, { useState, useMemo } from "react";
import { useRecharge } from "@/contexts/groundwater_assessment/admin/RechargeContext";
import { useLocation } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { useWell } from "@/contexts/groundwater_assessment/admin/WellContext";

// Display only these fields from your CSV columns
const DISPLAY_FIELDS: string[] = [
  "village",
  "SY",
  "mean_water_fluctuation",
  "Shape_Area",
  "recharge",
];

// Custom labels for better display
const LABEL_MAP: Record<string, string> = {
  village: "Village",
  SY: "Specific Yield",
  mean_water_fluctuation: "Water Fluctuation (M)",
  Shape_Area: "Shape Area (M²)",
  recharge: "Recharge (Million Litres)",
};

// Formatting functions
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === "") return "N/A";

  if (typeof value === 'number') {
    switch (key) {
      case 'SY':
        return value.toFixed(3);
      case 'mean_water_fluctuation':
        return `${value.toFixed(2)} m`;
      case 'Shape_Area':
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      case 'recharge':
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      default:
        return value.toString();
    }
  }

  return String(value);
};

const formatLabel = (key: string) =>
  LABEL_MAP[key] || key.replace(/_/g, " ");

const Recharge = () => {
  const { tableData, isLoading, error, computeRecharge, canComputeRecharge } = useRecharge();
  const { selectedSubDistricts } = useLocation();
  const { csvFilename } = useWell();

  const [showTable, setShowTable] = useState(false);

  // Filter & Sort States
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleComputeRecharge = async () => {
    await computeRecharge();
  };

  const toggleTable = () => {
    setShowTable(!showTable);
  };

  // Apply Search
  const handleApplySearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  // Handle Column Header Click for Sorting
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Process data with applied filters and sorting
  const processedData = useMemo(() => {
    let data = [...tableData];

    // Apply Search
    if (appliedSearch) {
      data = data.filter(row =>
        String(row.village || "").toLowerCase().includes(appliedSearch.toLowerCase())
      );
    }

    // Apply Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }

        return 0;
      });
    }

    return data;
  }, [tableData, appliedSearch, sortConfig]);

  // Summary Stats (based on filtered data)
  const summaryStats = useMemo(() => {
    if (processedData.length === 0) return null;

    const totalRecharge = processedData.reduce((sum, row) => {
      const recharge = parseFloat(String(row.recharge || 0));
      return sum + (isNaN(recharge) ? 0 : recharge);
    }, 0);

    const avgWaterFluctuation = processedData.reduce((sum, row) => {
      const fluctuation = parseFloat(String(row.mean_water_fluctuation || 0));
      return sum + (isNaN(fluctuation) ? 0 : fluctuation);
    }, 0) / processedData.length;

    return {
      totalVillages: processedData.length,
      totalRecharge: totalRecharge,
      averageWaterFluctuation: avgWaterFluctuation,
    };
  }, [processedData]);

  // Sorting Icon (like in Demand.tsx)
  const getSortIcon = (field: string) => {
    if (sortConfig?.key !== field) return null;
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-600">▲</span>
    ) : (
      <span className="ml-1 text-blue-600">▼</span>
    );
  };

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
      {isLoading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <defs>
                  <linearGradient id="spinner-gradient-recharge" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="50%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="spinner-gradient-2-recharge" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-recharge)" strokeWidth="3" />
                <path className="opacity-90" fill="url(#spinner-gradient-2-recharge)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Computing Recharge...
            </p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we calculate groundwater recharge</p>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-blue-800 mb-3">
        Groundwater Recharge Analysis
      </h3>

      {!canComputeRecharge() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
          <p className="font-medium">Requirements Not Met</p>
          <p className="text-sm mt-1">
            Please ensure the wells CSV is saved (from wells workflow) and sub-districts are selected before computing recharge.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start">
        <button
          onClick={handleComputeRecharge}
          disabled={isLoading || !canComputeRecharge()}
          className={[
            "inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
            isLoading || !canComputeRecharge()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
          ].join(" ")}
        >
          {isLoading ? "Computing..." : "Compute Recharge"}
        </button>

        {/* Search & Toggle Controls */}
        {tableData.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 ml-auto">
            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search village..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleApplySearch()}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleApplySearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>

            {/* Toggle Table */}
            <button
              onClick={toggleTable}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              title={showTable ? "Hide Table" : "Show Table"}
            >
              {showTable ? (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.94 17.94A10.016 10.016 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.293-3.95M6.06 6.06A9.991 9.991 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-4.042 5.142" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 01-3 3m0-6a3 3 0 013 3m0 0a3 3 0 01-3 3m0 0L3 3m0 0l18 18" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Active Filters Indicator */}
      {(appliedSearch || sortConfig) && (
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {appliedSearch && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              Search: "{appliedSearch}"
              <button onClick={() => { setAppliedSearch(""); setSearchInput(""); }} className="ml-1 hover:text-blue-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          {sortConfig && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
              Sort: {formatLabel(sortConfig.key)} ({sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})
              <button onClick={() => setSortConfig(null)} className="ml-1 hover:text-green-900">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      {showTable && tableData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Village-wise Recharge Analysis Results
          </h4>

          <div className="overflow-x-auto overflow-y-auto max-h-96 bg-white border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200">
                    S.No.
                  </th>
                  {DISPLAY_FIELDS.map((header) => (
                    <th
                      key={header}
                      onClick={() => handleSort(header)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-600 tracking-wider bg-gray-50 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    >
                      <div className="flex items-center">
                        {formatLabel(header)}
                        {getSortIcon(header)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedData.map((row, index) => (
                  <tr
                    key={index}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                      {index + 1}
                    </td>
                    {DISPLAY_FIELDS.map((field) => (
                      <td
                        key={field}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${field === 'recharge' ? 'text-blue-900 font-semibold' : 'text-gray-900'
                          }`}
                      >
                        {formatValue(field, row[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>
              Showing <strong>{processedData.length}</strong> village{processedData.length !== 1 ? "s" : ""}
              {appliedSearch || sortConfig ? ` (filtered)` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recharge;