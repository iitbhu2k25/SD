"use client";

import React from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from "recharts";

interface SamplingLocationsTabProps {
  data: Array<Record<string, string | number | null>>;
  selectedAttribute: string;
  selectedAttributeLabel: string;
  selectedAttributeUnit?: string;
  qualityThreshold?: number;
  borderColors: Record<string, string>;
}

const SamplingLocationsTab: React.FC<SamplingLocationsTabProps> = ({
  data,
  selectedAttribute,
  selectedAttributeLabel,
  selectedAttributeUnit,
  qualityThreshold,
  borderColors,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all border-l-4 border-l-blue-400">
      <div className="flex items-center justify-between p-5 border-b border-gray-100/80">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Individual Sampling Locations</h3>
          <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
            {data.length} Locations
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="h-[480px] w-full overflow-x-auto overflow-y-hidden rounded-xl bg-gradient-to-br from-slate-50/60 to-blue-50/30 border border-gray-100 shadow-inner">
          <div
            style={{
              minWidth: `${Math.max(data.length * 60, 800)}px`,
              height: "480px",
              padding: "20px 20px 30px 20px",
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              style={{
                outline: "none",
                border: "none",
                background: "transparent",
              }}
            >
              <LineChart
                data={data}
                margin={{ top: 25, right: 30, left: 15, bottom: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={true}
                  horizontal={true}
                />

                <XAxis
                  dataKey="sampling"
                  tick={{ fontSize: 11, fill: "#4B5563", fontWeight: 500 }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={80}
                  axisLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                  tickLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                />

                <YAxis
                  tick={{ fontSize: 11, fill: "#4B5563", fontWeight: 500 }}
                  axisLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                  tickLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                  label={{
                    value: selectedAttributeLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: {
                      textAnchor: "middle",
                      fill: "#374151",
                      fontWeight: 600,
                      fontSize: "12px",
                    },
                  }}
                />

                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!(active && payload && payload.length)) return null;
                    const activeData = payload.filter(
                      (entry) => entry.value !== null && entry.value !== undefined,
                    );
                    if (activeData.length === 0) return null;

                    return (
                      <div className="bg-white/95 backdrop-blur-sm p-0 border border-gray-200/80 rounded-xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2">
                          <p className="text-white font-semibold text-sm">{label}</p>
                        </div>
                        <div className="px-4 py-2.5 space-y-1.5">
                          {activeData.map((entry, index) => {
                            const locationType = String(entry.name || "");
                            const pointColor = borderColors[locationType] || "#666";
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full shadow-sm"
                                  style={{ backgroundColor: pointColor }}
                                ></div>
                                <span className="text-sm font-medium" style={{ color: pointColor }}>
                                  {entry.name}: {entry.value}
                                  {selectedAttributeUnit ? ` ${selectedAttributeUnit}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />

                <RechartsLegend
                  verticalAlign="top"
                  height={60}
                  wrapperStyle={{
                    paddingBottom: "20px",
                    paddingTop: "10px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                  }}
                  content={() => (
                    <div className="flex justify-center items-center gap-3 mb-4">
                      {Object.entries(borderColors).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 shadow-sm">
                          <div
                            className="w-3.5 h-3.5 rounded-full shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-semibold text-slate-700">{type}</span>
                        </div>
                      ))}

                      {qualityThreshold !== undefined && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200/80 shadow-sm">
                          <div className="w-4 h-0 border-t-2 border-dashed border-red-500" />
                          <span className="text-xs font-semibold text-red-700">
                            WHO/BIS Limit: {qualityThreshold}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                />

                {qualityThreshold !== undefined && (
                  <ReferenceLine
                    y={qualityThreshold}
                    stroke="red"
                    strokeDasharray="5 5"
                  />
                )}

                {Object.keys(borderColors).map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={{
                      r: 6,
                      fill: borderColors[type],
                      stroke: borderColors[type],
                      strokeWidth: 2,
                      cursor: "pointer",
                    }}
                    activeDot={{
                      r: 8,
                      fill: borderColors[type],
                      stroke: "#fff",
                      strokeWidth: 2,
                      cursor: "pointer",
                    }}
                    connectNulls={false}
                    name={type}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SamplingLocationsTab;

