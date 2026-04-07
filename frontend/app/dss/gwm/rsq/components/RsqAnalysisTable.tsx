"use client";

import React, { useMemo, useState } from "react";
import { useRsqAdmin, useRsqAnalysis, useRsqDrain } from "./RsqState";

type RsqView = "admin" | "drain";

const YEAR_OPTIONS = ["2016 - 17", "2019 - 20", "2021 - 22", "2022 - 23", "2023 - 24"];
const EXCLUDED_FIELDS = ["status", "color", "Year", "year"];
const PRIORITY_FIELDS = ["village", "blockname", "village_co", "block_code"];

interface RsqAnalysisTableProps {
  view: RsqView;
  isReady: boolean;
  readyTitle: string;
  readyDescription: string;
  showYearSelector?: boolean;
}

export default function RsqAnalysisTable({
  view,
  isReady,
  readyTitle,
  readyDescription,
  showYearSelector = true,
}: RsqAnalysisTableProps) {
  const { selectedYear, setSelectedYear, groundWaterData, isLoading, error } = useRsqAnalysis(view);
  const admin = useRsqAdmin();
  const drain = useRsqDrain();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const selectedVillages = view === "admin" ? admin.selectedVillages : drain.selectedVillages;

  const allColumns = useMemo(() => {
    if (!groundWaterData?.features?.length) {
      return [];
    }
    const keys = Object.keys(groundWaterData.features[0].properties).filter((key) => !EXCLUDED_FIELDS.includes(key));
    const priorityColumns = PRIORITY_FIELDS.filter((field) => keys.includes(field));
    const otherColumns = keys.filter((key) => !PRIORITY_FIELDS.includes(key));
    return [...priorityColumns, ...otherColumns];
  }, [groundWaterData]);

  const processedData = useMemo(() => {
    if (!groundWaterData?.features) {
      return [];
    }

    let filtered = [...groundWaterData.features];

    if (globalSearch.trim()) {
      const query = globalSearch.toLowerCase();
      filtered = filtered.filter((feature) =>
        Object.values(feature.properties).some((value) => String(value).toLowerCase().includes(query))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((feature) => feature.properties.status === statusFilter);
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a.properties[sortConfig.key];
        const bValue = b.properties[sortConfig.key];
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        }
        return String(aValue).localeCompare(String(bValue)) * (sortConfig.direction === "asc" ? 1 : -1);
      });
    }

    return filtered;
  }, [globalSearch, groundWaterData, sortConfig, statusFilter]);

  const stats = useMemo(() => {
    if (!groundWaterData?.features?.length) {
      return null;
    }
    const categories = groundWaterData.features.reduce((acc, feature) => {
      const category = feature.properties.status || "No Data";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { categories };
  }, [groundWaterData]);

  const formatColumnName = (key: string) =>
    key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

  const formatCellValue = (value: any, key?: string) => {
    if (value === null || value === undefined) {
      return "-";
    }
    if (typeof value === "number") {
      if (key && (key.includes("_co") || key.includes("code") || key.includes("_id"))) {
        return value.toString();
      }
      return value.toFixed(2);
    }
    if (typeof value === "string" && !Number.isNaN(Number(value)) && value.trim() !== "") {
      if (key && (key.includes("_co") || key.includes("code") || key.includes("_id"))) {
        return value;
      }
      return Number(value).toFixed(2);
    }
    return String(value);
  };

  if (!isReady) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center shadow-lg">
          <h3 className="mb-2 text-lg font-semibold text-slate-800">{readyTitle}</h3>
          <p className="text-sm text-slate-600">{readyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 bg-slate-50 p-4">
      {showYearSelector && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="mb-1 text-base font-semibold text-slate-800">Select Assessment Year</h3>
              <p className="text-xs text-slate-600">Selected {selectedVillages.length} villages for assessment</p>
            </div>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value="">Select Year</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {selectedYear && (
        <>
          {stats && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 text-xs font-semibold text-slate-700">Filter by Status:</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === "all" ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  All ({groundWaterData?.features?.length || 0})
                </button>
                {Object.entries(stats.categories).map(([category, count]) => {
                  const color = groundWaterData?.features.find((feature) => feature.properties.status === category)?.properties.color || "#999";
                  return (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setStatusFilter(category)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${
                        statusFilter === category ? "scale-105 shadow-md ring-2 ring-offset-1" : "shadow-sm hover:opacity-90"
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {category}: {count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Search across all columns..."
                className="min-w-[250px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-xs font-semibold text-blue-700">
                  Showing {processedData.length} {processedData.length === 1 ? "result" : "results"}
                </span>
              </div>
              {(globalSearch || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearch("");
                    setStatusFilter("all");
                  }}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-md">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="mt-3 text-sm font-medium text-slate-600">Loading RSQ data for {selectedYear}...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {groundWaterData && !isLoading && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
              <div className="overflow-auto" style={{ maxHeight: "600px", maxWidth: "100%" }}>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-700 to-slate-800">
                    <tr>
                      {allColumns.map((key) => (
                        <th key={key} className="whitespace-nowrap px-4 py-3 text-left">
                          <button
                            type="button"
                            onClick={() =>
                              setSortConfig((current) => ({
                                key,
                                direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
                              }))
                            }
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white"
                          >
                            {formatColumnName(key)}
                            {sortConfig?.key === key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                          </button>
                        </th>
                      ))}
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {processedData.length === 0 ? (
                      <tr>
                        <td colSpan={allColumns.length + 1} className="py-12 text-center text-sm font-medium text-slate-500">
                          No data matches your filters
                        </td>
                      </tr>
                    ) : (
                      processedData.map((feature, index) => (
                        <tr key={index} className="transition hover:bg-slate-50">
                          {allColumns.map((key) => (
                            <td key={key} className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                              {formatCellValue(feature.properties[key], key)}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className="inline-block rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                              style={{ backgroundColor: feature.properties.color || "#999" }}
                            >
                              {feature.properties.status || "No Data"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
