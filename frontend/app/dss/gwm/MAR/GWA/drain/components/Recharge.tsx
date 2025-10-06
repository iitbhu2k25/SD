"use client";

import React, { useState } from "react";
import { useRecharge } from "@/contexts/groundwater_assessment/drain/RechargeContext";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { useWell } from "@/contexts/groundwater_assessment/drain/WellContext";

// Display only these fields from your CSV columns
const DISPLAY_FIELDS: string[] = [
  "village",
  "SY",
  "mean_water_fluctuation",
  "Shape_Area",
  "recharge",
];

// Updated labels to match your CSV structure
const LABEL_MAP: Record<string, string> = {
  village: "Village",
  SY: "Specific Yield",
  mean_water_fluctuation: "Water Fluctuation (m)",
  Shape_Area: "Shape Area (m²)",
  recharge: "Recharge (m³)",
};

// Formatting functions for better display
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === "") return "N/A";

  // Format numbers based on field type
  if (typeof value === "number") {
    switch (key) {
      case "SY":
        return value.toFixed(3); // Specific yield to 3 decimal places
      case "mean_water_fluctuation":
        return `${value.toFixed(2)} m`; // Water fluctuation in meters
      case "Shape_Area":
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 }); // Area without decimals
      case "recharge":
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 }); // Recharge with 2 decimals
      default:
        return value.toString();
    }
  }

  return String(value);
};

const formatLabel = (key: string) =>
  LABEL_MAP[key] ||
  key.replace(/_/g, " ");

const Recharge = () => {
  const { tableData, isLoading, error, computeRecharge, canComputeRecharge } = useRecharge();
  const { selectedVillages } = useLocation(); // Uses selectedVillages for drain case
  const { csvFilename } = useWell(); // wells CSV status if desired

  // State to control table visibility
  const [showTable, setShowTable] = useState(false);

  const handleComputeRecharge = async () => {
    await computeRecharge();
  };

  // Toggle table visibility
  const toggleTable = () => {
    setShowTable(!showTable);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (tableData.length === 0) return null;

    const totalRecharge = tableData.reduce((sum, row) => {
      const recharge = parseFloat(String(row.recharge || 0));
      return sum + (isNaN(recharge) ? 0 : recharge);
    }, 0);

    const avgWaterFluctuation = tableData.reduce((sum, row) => {
      const fluctuation = parseFloat(String(row.mean_water_fluctuation || 0));
      return sum + (isNaN(fluctuation) ? 0 : fluctuation);
    }, 0) / tableData.length;

    const totalArea = tableData.reduce((sum, row) => {
      const area = parseFloat(String(row.Shape_Area || 0));
      return sum + (isNaN(area) ? 0 : area);
    }, 0);

    return {
      totalVillages: tableData.length,
      totalRecharge: totalRecharge,
      averageWaterFluctuation: avgWaterFluctuation,
      totalArea: totalArea / 1000000, // Convert to km²
    };
  }, [tableData]);

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
      {isLoading && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-white rounded-xl shadow-2xl p-8">
            <div className="inline-block relative">
              {/* Outer rotating gradient ring */}
              <svg
                className="animate-spin h-20 w-20"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
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
                <circle
                  className="opacity-20"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="url(#spinner-gradient-recharge)"
                  strokeWidth="3"
                />
                <path
                  className="opacity-90"
                  fill="url(#spinner-gradient-2-recharge)"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>

              {/* Pulsing center dot */}
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

      {/* Status section */}
      {/* <div className="mb-4 text-sm text-gray-600">
        <p>
          <strong>Wells CSV:</strong> {csvFilename || "Not available (upload/confirm wells first)"}
        </p>
        <p>
          <strong>Selected Villages:</strong> {selectedVillages.length} selected
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p className="font-medium">Computation Failed</p>
          <p className="text-sm mt-1">{String(error)}</p>
        </div>
      )} */}

      {!canComputeRecharge() && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
          <p className="font-medium">Requirements Not Met</p>
          <p className="text-sm mt-1">
            Please ensure the wells CSV is saved and villages are selected before computing recharge.
          </p>
        </div>
      )}
      <div className="mb-4 flex items-center gap-4">
        {/* Compute Recharge Button */}
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
          {isLoading ? <span>Computing Recharge...</span> : <span>Compute Recharge</span>}
        </button>

        {/* Show/Hide Table Button - Only show when data is available */}
        {tableData.length > 0 && (
          <button
            onClick={toggleTable}
            className={[
              "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 rounded-full py-3 px-5 text-white shadow-md focus:outline-none focus:ring-4",
              showTable
                ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 focus:ring-yellow-400 focus:ring-opacity-50"
                : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:ring-blue-400 focus:ring-opacity-50",
            ].join(" ")}
          >
            <svg
              className={["w-4 h-4 transition-transform", showTable ? "rotate-180" : ""].join(" ")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showTable ? "Hide Recharge Table" : "Show Recharge Table"}
          </button>
        )}

        {/* Quick stats */}
        {tableData.length > 0 && (
          <span className="text-sm text-blue-600 font-medium">
            {tableData.length} village{tableData.length !== 1 ? "s" : ""} computed
          </span>
        )}
      </div>



      {/* Village-wise Recharge Table - Conditionally rendered */}
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
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider bg-gray-50 border-b-2 border-gray-200"
                    >
                      {formatLabel(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row, index) => (
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
                        className={`px-4 py-3 text-sm whitespace-nowrap ${field === "recharge" ? "text-blue-900 font-semibold" : "text-gray-900"
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

          <div className="mt-2 text-sm text-gray-600 flex justify-between items-center">
            <span>
              Showing {tableData.length} village{tableData.length !== 1 ? "s" : ""} with recharge analysis
            </span>
            <span className="text-blue-600 font-medium">
              Total Recharge: {summaryStats?.totalRecharge.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recharge;
