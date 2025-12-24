// frontend/app/dss/rsq/drain/components/rsq.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRSQ } from "@/contexts/rsq/drain/RsqContext";
import { useLocation } from "@/contexts/rsq/drain/LocationContext";

/* ================= YEAR OPTIONS ================= */

const YEAR_OPTIONS = [
  "2016 - 17",
  "2019 - 20",
  "2021 - 22",
  "2022 - 23",
  "2023 - 24",
];

export default function RSQAnalysis() {
  const { selectedYear, setSelectedYear, groundWaterData, isLoading, error, fetchGroundWaterData, clearData } =
    useRSQ();
  const { selectedVillages } = useLocation();

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");


  // Clear data when villages change
  useEffect(() => {
    clearData();
  }, [selectedVillages]);

  /* ================= GET ALL COLUMNS DYNAMICALLY ================= */

  const allColumns = useMemo(() => {
    if (!groundWaterData?.features?.length) return [];

    const firstFeature = groundWaterData.features[0];
    const props = firstFeature.properties;

    const keys = Object.keys(props).filter(
      key => !['status', 'color','vlcode', 'blockcode','srno','SUBDIS_COD', 'Total_Geographical_Area', 'Recharge_Worthy_Area'].includes(key)
    );

    return keys;
  }, [groundWaterData]);

  /* ================= SORT ================= */

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  /* ================= FORMAT COLUMN NAME ================= */

  const formatColumnName = (key: string) => {
    return key
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  /* ================= FORMAT CELL VALUE ================= */

/* ================= FORMAT CELL VALUE ================= */

const formatCellValue = (value: any) => {
  if (value === null || value === undefined) return "-";
  
  // ✅ Handle numbers (already in your code)
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  
  // ✅ NEW: Handle numeric strings
  if (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "") {
    return Number(value).toFixed(2);
  }
  
  return String(value);
};

  /* ================= HIGHLIGHT SEARCH TERM ================= */

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;

    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  /* ================= FILTER + SORT ================= */

  const processedData = useMemo(() => {
    if (!groundWaterData?.features) return [];

    let filtered = [...groundWaterData.features];

    // Global search
    if (globalSearch.trim()) {
      filtered = filtered.filter((f) => {
        const searchLower = globalSearch.toLowerCase();
        return Object.values(f.properties).some((val) =>
          String(val).toLowerCase().includes(searchLower)
        );
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (f) => f.properties.status === statusFilter
      );
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a.properties[sortConfig.key];
        const bVal = b.properties[sortConfig.key];

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return (
          String(aVal).localeCompare(String(bVal)) *
          (sortConfig.direction === "asc" ? 1 : -1)
        );
      });
    }

    return filtered;
  }, [groundWaterData, sortConfig, globalSearch, statusFilter]);

  /* ================= STATS ================= */

  const stats = useMemo(() => {
    if (!groundWaterData?.features?.length) return null;

    const categories = groundWaterData.features.reduce((acc, f) => {
      const cat = f.properties.status || "No Data";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { categories };
  }, [groundWaterData]);

  /* ================= CLEAR FILTERS ================= */

  const clearAllFilters = () => {
    setGlobalSearch("");
    setStatusFilter("all");
  };

  /* ================= DOWNLOAD CSV ================= */

  const downloadCSV = () => {
    if (!processedData.length) {
      alert("No data to download");
      return;
    }

    try {
      // Prepare CSV headers
      const headers = [...allColumns.map(formatColumnName), "Status"];
      
      // Prepare CSV rows
      const rows = processedData.map(feature => {
        const p = feature.properties;
        const rowData = allColumns.map(key => {
          const value = formatCellValue(p[key]);
          // Escape commas and quotes in CSV
          return `"${String(value).replace(/"/g, '""')}"`;
        });
        // Add status column
        rowData.push(`"${p.status || 'No Data'}"`);
        return rowData.join(',');
      });

      // Combine headers and rows
      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `RSQ_Analysis_Drain_${selectedYear.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ CSV downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading CSV:', error);
      alert('Failed to download CSV. Please try again.');
    }
  };

  if (selectedVillages.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg border border-blue-100">
          <svg className="w-16 h-16 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Villages Selected</h3>
          <p className="text-sm text-gray-600">Please select villages to view RSQ analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">

      {/* ================= YEAR SELECTION CARD ================= */}

      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">Select Assessment Year</h3>
            <p className="text-xs text-gray-600">
              Selected {selectedVillages.length} villages for assessment
            </p>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => {
              console.log("Year changed to:", e.target.value);
              setSelectedYear(e.target.value);
            }}
            className="border border-gray-300 px-3 py-2 rounded-md shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-sm font-medium"
            disabled={isLoading}
          >
            <option value="">Select Year</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Only show rest of the content after year is selected */}
      {selectedYear && (
        <>
          {/* ================= STATUS LEGEND CARD ================= */}

          {stats && (
            <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs font-semibold text-gray-700 mr-2">Filter by Status:</span>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${statusFilter === "all"
                      ? "bg-gray-800 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  All ({groundWaterData?.features?.length || 0})
                </button>
                {Object.entries(stats.categories).map(([cat, count]) => {
                  const color =
                    groundWaterData?.features.find(
                      (f) => f.properties.status === cat
                    )?.properties.color || "#d10c0cff";

                  return (
                    <button
                      key={cat}
                      onClick={() => setStatusFilter(cat)}
                      className={`px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-all ${statusFilter === cat ? "ring-2 ring-offset-1 shadow-md scale-105" : "hover:opacity-90 shadow-sm"
                        }`}
                      style={{ backgroundColor: color }}
                    >
                      {cat}: {count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= SEARCH & ACTIONS CARD ================= */}

          <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex-1 min-w-[250px] relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search across all columns..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="border border-gray-300 pl-9 pr-9 py-2 rounded-md w-full text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                {globalSearch && (
                  <button
                    onClick={() => setGlobalSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* ✅ RESULTS COUNT */}
              <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
                <span className="text-xs font-semibold text-blue-700">
                  Showing {processedData.length} {processedData.length === 1 ? 'result' : 'results'}
                </span>
              </div>

              {/* ✅ DOWNLOAD CSV BUTTON */}
              {processedData.length > 0 && (
                <button
                  onClick={downloadCSV}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-all shadow-sm hover:shadow-md font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download CSV
                </button>
              )}

              {(globalSearch || statusFilter !== "all") && (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-all shadow-sm hover:shadow-md font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* ================= LOADING / ERROR ================= */}

          {isLoading && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-3 text-sm text-gray-600 font-medium">Loading RSQ data for {selectedYear}...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* ================= TABLE CARD WITH BOTH SCROLLBARS ================= */}

          {groundWaterData && !isLoading && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              {/* ✅ SCROLLABLE CONTAINER - Both vertical AND horizontal scroll */}
              <div 
                className="overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100" 
                style={{ maxHeight: '600px', maxWidth: '100%' }}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  {/* ✅ STICKY HEADER */}
                  <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
                    <tr>
                      {allColumns.map((key) => (
                        <th key={key} className="px-4 py-3 text-left whitespace-nowrap">
                          <div
                            className="flex items-center gap-1.5 cursor-pointer hover:text-blue-300 transition-colors select-none group"
                            onClick={() => handleSort(key)}
                          >
                            <span className="font-semibold text-xs text-white uppercase tracking-wide">
                              {formatColumnName(key)}
                            </span>
                            {sortConfig?.key === key ? (
                              <span className="text-blue-300 text-sm">
                                {sortConfig.direction === "asc" ? "↑" : "↓"}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                ↕
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left whitespace-nowrap">
                        <span className="font-semibold text-xs text-white uppercase tracking-wide">Status</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedData.length === 0 ? (
                      <tr>
                        <td colSpan={allColumns.length + 1} className="text-center py-12">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-sm text-gray-500 font-medium">No data matches your filters</p>
                        </td>
                      </tr>
                    ) : (
                      processedData.map((f, i) => {
                        const p = f.properties;

                        return (
                          <tr
                            key={i}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {allColumns.map((key) => (
                              <td key={key} className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                                {typeof p[key] === "string"
                                  ? highlightText(formatCellValue(p[key]), globalSearch)
                                  : formatCellValue(p[key])}
                              </td>
                            ))}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className="px-2.5 py-1 rounded-md text-white text-xs font-semibold inline-block shadow-sm"
                                style={{ backgroundColor: p.color || "#999" }}
                              >
                                {p.status || "No Data"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ✅ SCROLL HINT - Shows when table has many columns */}
              {allColumns.length > 5 && (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-center">
                  <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Scroll horizontally to view all {allColumns.length + 1} columns
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}