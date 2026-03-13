"use client";

import React from "react";
import { ComparisonTableRow, ProcessedWaterQualityData } from "@/contexts/riverwater_assessment/admin/ChartContext";

interface SeasonalComparisonTabProps {
  comparisonTableData: ComparisonTableRow[];
  selectedAttribute: string;
  selectedAttributeLabel: string;
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;
  borderColors: Record<string, string>;
}

const getLocationBgColor = (
  locationType: string,
  borderColors: Record<string, string>,
): string => {
  const color = borderColors[locationType];
  if (!color) return "rgba(243, 244, 246, 0.7)";
  return color.replace(", 1)", ", 0.08)").replace(",1)", ",0.08)");
};

const formatParameterValue = (
  dataPoint: ProcessedWaterQualityData | null,
  attribute: string,
): string => {
  if (!dataPoint) return "-";
  const value = dataPoint[attribute];
  if (value === undefined || value === null || value === "" || value === 0) return "-";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
};

const SeasonalComparisonTab: React.FC<SeasonalComparisonTabProps> = ({
  comparisonTableData,
  selectedAttribute,
  selectedAttributeLabel,
  isLoadingAllSeasons,
  allSeasonsError,
  borderColors,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-amber-400">
      <div className="flex items-center justify-between p-5 border-b border-gray-100/80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Seasonal Comparison Table</h3>
          <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
            {comparisonTableData.length} Locations
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {isLoadingAllSeasons && (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
              <div className="text-lg text-gray-700">
                Loading seasonal comparison data...
              </div>
            </div>
          </div>
        )}

        {allSeasonsError && !isLoadingAllSeasons && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h4 className="text-red-800 font-semibold mb-2">
              Error Loading Seasonal Data
            </h4>
            <p className="text-red-600">{allSeasonsError}</p>
          </div>
        )}

        {!isLoadingAllSeasons &&
          !allSeasonsError &&
          comparisonTableData.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-inner">
              <table className="min-w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold text-gray-800 border-b-2 border-slate-300 sticky left-0 bg-gradient-to-r from-slate-100 to-slate-50 z-10" style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
                      Location
                    </th>
                    <th className="px-6 py-4 text-center font-bold text-blue-700 border-b-2 border-slate-300">
                      <span className="inline-flex items-center gap-1">🌞 Pre-monsoon</span>
                      <br />
                      <span className="text-xs font-normal text-gray-500">
                        {selectedAttributeLabel}
                      </span>
                    </th>
                    <th className="px-6 py-4 text-center font-bold text-green-700 border-b-2 border-slate-300">
                      <span className="inline-flex items-center gap-1">🌧️ Monsoon</span>
                      <br />
                      <span className="text-xs font-normal text-gray-500">
                        {selectedAttributeLabel}
                      </span>
                    </th>
                    <th className="px-6 py-4 text-center font-bold text-amber-700 border-b-2 border-slate-300">
                      <span className="inline-flex items-center gap-1">🍂 Post-monsoon</span>
                      <br />
                      <span className="text-xs font-normal text-gray-500">
                        {selectedAttributeLabel}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonTableData.map((row, index) => {
                    const locationColor = borderColors[row.locationType] || "#333";
                    const locationBgColor = getLocationBgColor(
                      row.locationType,
                      borderColors,
                    );

                    return (
                      <tr
                        key={index}
                        className="border-b border-gray-100 hover:brightness-[0.97] transition-all duration-200"
                        style={{ backgroundColor: locationBgColor }}
                      >
                        <td
                          className="px-6 py-4 font-semibold sticky left-0 z-10"
                          style={{
                            color: locationColor,
                            backgroundColor: locationBgColor,
                            boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: locationColor }}
                            ></div>
                            {row.location}
                          </div>
                        </td>
                        {[
                          { data: row.premonsoon, key: 'pre' },
                          { data: row.monsoon, key: 'mon' },
                          { data: row.postmonsoon, key: 'post' },
                        ].map(({ data, key }) => {
                          const val = formatParameterValue(data, selectedAttribute);
                          const isEmpty = val === "-";
                          return (
                            <td
                              key={key}
                              className={`px-6 py-4 text-center tabular-nums ${isEmpty ? "italic text-gray-300 font-normal" : "font-semibold"}`}
                              style={isEmpty ? undefined : { color: locationColor }}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {!isLoadingAllSeasons &&
          !allSeasonsError &&
          comparisonTableData.length === 0 && (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">No</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-700 mb-2">
                  No Seasonal Data Available
                </h4>
                <p className="text-gray-500 max-w-md">
                  Please confirm your area selection to view seasonal comparison
                  data for the selected sub-districts.
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default SeasonalComparisonTab;
