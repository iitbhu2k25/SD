"use client";

import React, { useMemo } from "react";
import { ProcessedWaterQualityData } from "@/contexts/riverwater_assessment/drain/ChartContext";

interface LocationTypeSummaryTabProps {
  filteredData: ProcessedWaterQualityData[];
  selectedAttribute: string;
  selectedAttributeLabel: string;
  borderColors: Record<string, string>;
  parseValue: (value: string | number | null | undefined) => number;
}

const LOCATION_TYPES = ["Upstream", "Downstream", "Drain"] as const;

const LocationTypeSummaryTab: React.FC<LocationTypeSummaryTabProps> = ({
  filteredData,
  selectedAttribute,
  selectedAttributeLabel,
  borderColors,
  parseValue,
}) => {
  const locationSummaryRows = useMemo(
    () =>
      LOCATION_TYPES.map((locationType) => {
        const locationData = filteredData.filter(
          (row) => row.location === locationType,
        );
        const values = locationData
          .map((row) =>
            parseValue(
              row[selectedAttribute as keyof typeof row] as number | string,
            ),
          )
          .filter((v) => v !== 0);

        const textColor = borderColors[locationType] || "#333";
        const bgColor = textColor.replace("1)", "0.08)").replace("0.6)", "0.08)");

        if (values.length === 0) {
          return {
            locationType,
            hasData: false,
            textColor,
            bgColor,
          };
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;

        return {
          locationType,
          hasData: true,
          textColor,
          bgColor,
          min: min.toFixed(2),
          max: max.toFixed(2),
          avg: avg.toFixed(2),
          count: values.length,
        };
      }),
    [filteredData, selectedAttribute, borderColors, parseValue],
  );

  const overallStats = useMemo(() => {
    const allValues = filteredData
      .map((row) =>
        parseValue(
          row[selectedAttribute as keyof typeof row] as number | string,
        ),
      )
      .filter((v) => v !== 0);

    if (allValues.length === 0) return null;

    const totalMin = Math.min(...allValues);
    const totalMax = Math.max(...allValues);
    const totalAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;

    return {
      min: totalMin.toFixed(2),
      max: totalMax.toFixed(2),
      avg: totalAvg.toFixed(2),
      count: allValues.length,
    };
  }, [filteredData, selectedAttribute, parseValue]);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-emerald-400">
      <div className="flex items-center justify-between p-5 border-b border-gray-100/80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Average Values by Location Type</h3>
          <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
            Aggregated
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="h-auto w-full rounded-xl bg-gradient-to-br from-slate-50/60 to-emerald-50/20 border border-gray-100 overflow-x-auto shadow-inner">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border-b-2 border-slate-200">
                <th className="px-4 py-3 font-bold text-gray-700">Location Type</th>
                <th className="px-4 py-3 font-bold text-gray-700 text-center">
                  <span className="inline-flex items-center gap-1"><span className="text-emerald-500">↓</span> Minimum</span>
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    {selectedAttributeLabel}
                  </span>
                </th>
                <th className="px-4 py-3 font-bold text-gray-700 text-center">
                  <span className="inline-flex items-center gap-1"><span className="text-blue-500">≈</span> Average</span>
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    {selectedAttributeLabel}
                  </span>
                </th>
                <th className="px-4 py-3 font-bold text-gray-700 text-center">
                  <span className="inline-flex items-center gap-1"><span className="text-red-500">↑</span> Maximum</span>
                  <br />
                  <span className="text-xs font-normal text-gray-500">
                    {selectedAttributeLabel}
                  </span>
                </th>
                <th className="px-4 py-3 font-bold text-gray-700 text-center">
                  <span className="inline-flex items-center gap-1"><span className="text-violet-500">#</span> No. of Points</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {locationSummaryRows.map((row) => {
                if (!row.hasData) {
                  return (
                    <tr
                      key={row.locationType}
                      className="border-b border-gray-100"
                      style={{ backgroundColor: row.bgColor }}
                    >
                      <td className="px-4 py-2 font-semibold" style={{ color: row.textColor }}>
                        {row.locationType}
                      </td>
                      <td
                        colSpan={4}
                        className="px-4 py-2 text-center italic"
                        style={{ color: row.textColor }}
                      >
                        No data available
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.locationType}
                    className="border-b border-gray-100 hover:brightness-[0.97] transition-all duration-200"
                    style={{ backgroundColor: row.bgColor }}
                  >
                    <td className="px-4 py-2.5 font-bold" style={{ color: row.textColor }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.textColor }}></div>
                        {row.locationType}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>
                      {row.min}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>
                      {row.avg}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>
                      {row.max}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>
                      {row.count}
                    </td>
                  </tr>
                );
              })}

              {overallStats && (
                <tr
                  className="font-bold border-t-2 border-blue-200"
                  style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))" }}
                >
                  <td className="px-4 py-3 text-blue-700 text-[15px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                      All points
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-green-700 tabular-nums text-[15px]">{overallStats.min}</td>
                  <td className="px-4 py-3 text-center text-blue-700 tabular-nums text-[15px]">{overallStats.avg}</td>
                  <td className="px-4 py-3 text-center text-red-700 tabular-nums text-[15px]">{overallStats.max}</td>
                  <td className="px-4 py-3 text-center text-purple-700 tabular-nums text-[15px]">{overallStats.count}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocationTypeSummaryTab;
