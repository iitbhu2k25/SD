// frontend/app/dss/extractdata/rainfall/components/daily.tsx
"use client";

import React, { useContext } from "react";
import { DailyContext } from "@/contexts/extract/Rainfal/RaifallContext";
import { motion } from "framer-motion";
import { Droplets, AlertTriangle, CalendarClock } from "lucide-react";

const extractValue = (text: string | undefined | null, label: string) => {
  if (!text || typeof text !== 'string') return "-";
  const regex = new RegExp(`${label} ?:? ?([\\d\\.\\-]+)`);
  const match = text.match(regex);
  return match ? match[1] : "-";
};

const getCategoryColor = (category: string | undefined | null) => {
  if (!category) return "text-gray-700 bg-gray-50";

  switch (category.toLowerCase()) {
    case "excess":
      return "text-blue-700 bg-blue-50";
    case "normal":
      return "text-green-700 bg-green-50";
    case "deficient":
      return "text-yellow-700 bg-yellow-50";
    case "large deficient":
      return "text-red-700 bg-red-50";
    case "large excess":
      return "text-cyan-700 bg-cyan-50";
    case "no rain":
      return "text-gray-700 bg-gray-50";
    default:
      return "text-gray-700 bg-gray-50";
  }
};

const parseCategoryFromDeparture = (departureStr: string) => {
  const departure = parseFloat(departureStr);
  if (isNaN(departure)) return "N/A";
  if (departure >= 60) return "Large Excess";
  if (departure >= 20) return "Excess";
  if (departure >= -19) return "Normal";
  if (departure >= -59) return "Deficient";
  return "Large Deficient";
};

export const DailyRainfallTable = () => {
  const dailyCtx = useContext(DailyContext);
  if (!dailyCtx) throw new Error("RainfallTable must be inside DailyProvider");

  const { rainfallData, loading, error, category } = dailyCtx;

  // Don't show table for river basin
  if (category === "riverbasin") {
    return null;
  }

  // Loading shimmer
  if (loading)
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/3"></div>
        <div className="h-48 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 rounded-xl shadow-inner"></div>
      </div>
    );

  if (error)
    return (
      <motion.div
        className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AlertTriangle size={18} />
        <span>Error loading table: {error}</span>
      </motion.div>
    );

  if (!rainfallData || rainfallData.features.length === 0)
    return (
      <motion.div
        className="text-gray-600 text-center p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        No rainfall data available.
      </motion.div>
    );

  // District table (updated structure with new API fields)
  if (category === "district") {
    return (
      <motion.div
        className="p-4 bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Droplets className="text-blue-500" />
            District Rainfall Statistics
            {rainfallData.period_label && (
              <span className="text-sm font-normal text-gray-600">
                ({rainfallData.period_label})
              </span>
            )}
          </h3>
          <span className="flex items-center text-gray-500 text-sm gap-1">
            <CalendarClock size={14} />
            {rainfallData.date_range || "No date available"}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[60vh] rounded-xl border border-gray-200 shadow-inner">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">District</th>
                <th className="px-4 py-3 text-right">Actual Rainfall (mm)</th>
                <th className="px-4 py-3 text-right">Normal Rainfall (mm)</th>
                <th className="px-4 py-3 text-right">Departure (%)</th>
                <th className="px-4 py-3 text-center">Category</th>
              </tr>
            </thead>

            <tbody>
              {rainfallData.features.map((feature, i) => {
                const props = feature.properties;
                const actual = extractValue(props.rainfall_balloonText, "Actual");
                const normal = extractValue(props.rainfall_balloonText, "Normal");
                const departure = extractValue(props.rainfall_balloonText, "Departure");
                const categoryLabel = parseCategoryFromDeparture(departure);

                return (
                  <motion.tr
                    key={i}
                    className={`hover:bg-blue-50 transition-all duration-200 ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {props.DISTRICT || props.rainfall_title || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">{actual ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{normal ?? "-"}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        departure && parseFloat(departure) > 0
                          ? "text-green-600"
                          : departure && parseFloat(departure) < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {departure ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full font-semibold text-xs ${getCategoryColor(
                          categoryLabel
                        )}`}
                      >
                        {categoryLabel || "N/A"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with metadata */}
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <span>
            Source: {rainfallData.metadata?.source || "India Meteorological Department"}
          </span>
          <span>
            Total Districts: {rainfallData.features.length}
          </span>
        </div>
      </motion.div>
    );
  }

  // State table (existing structure - kept as is)
 return (
  <motion.div
    className="p-4 bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
        <Droplets className="text-blue-500" />
        State Rainfall Statistics
      </h3>
      <span className="flex items-center text-gray-500 text-sm gap-1">
        {rainfallData.features?.[0]?.properties?.last_updated
          ? `Last Updated: ${rainfallData.features[0].properties.last_updated}`
          : null}
      </span>
    </div>

    <div className="overflow-x-auto max-h-[60vh] rounded-xl border border-gray-200 shadow-inner">
      <table className="min-w-full text-sm text-gray-700">
        <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
          <tr>
            <th className="px-4 py-3 text-left">State</th>
            <th className="px-4 py-3 text-right">Actual Rainfall (mm)</th>
            <th className="px-4 py-3 text-right">Normal Rainfall (mm)</th>
            <th className="px-4 py-3 text-right">Departure (%)</th>
            <th className="px-4 py-3 text-center">Category</th>
            <th className="px-4 py-3 text-center">Last Updated</th>
          </tr>
        </thead>

        <tbody>
          {rainfallData.features.map((feature, i) => {
            const {
              state,
              actual_rainfall,
              normal_rainfall,
              departure,
              category: cat,
              last_updated,
            } = feature.properties;
            return (
              <motion.tr
                key={i}
                className={`hover:bg-blue-50 transition-all duration-200 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
                whileHover={{ scale: 1.01 }}
              >
                <td className="px-4 py-3 font-medium text-gray-800">{state}</td>
                <td className="px-4 py-3 text-right">{actual_rainfall ?? "-"}</td>
                <td className="px-4 py-3 text-right">{normal_rainfall ?? "-"}</td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${
                    departure && parseFloat(departure) > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {departure ?? "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-3 py-1 rounded-full font-semibold text-xs ${getCategoryColor(
                      cat
                    )}`}
                  >
                    {cat || "N/A"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500 text-sm">
                  {last_updated}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </motion.div>
);

};