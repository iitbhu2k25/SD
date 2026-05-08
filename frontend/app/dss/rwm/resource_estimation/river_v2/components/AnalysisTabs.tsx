"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type Plotly from "plotly.js-dist-min";
import {
  CartesianGrid,
  Legend as RechartsLegend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchWqiProfile } from "../services/rwmRiverApi";
import type { ProcessedWaterQualityData } from "../utils/chartFormatters";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface SamplingLocationsTabProps {
  data: Array<Record<string, string | number | null>>;
  selectedAttribute: string;
  selectedAttributeLabel: string;
  selectedAttributeUnit?: string;
  qualityThreshold?: number;
  borderColors: Record<string, string>;
  embedded?: boolean;
  showHeader?: boolean;
}

interface LocationTypeSummaryTabProps {
  filteredData: ProcessedWaterQualityData[];
  selectedAttribute: string;
  selectedAttributeLabel: string;
  borderColors: Record<string, string>;
  parseValue: (value: string | number | null | undefined) => number;
  embedded?: boolean;
  showHeader?: boolean;
}

interface ComparisonTableRow {
  location: string;
  locationType: string;
  premonsoon: ProcessedWaterQualityData | null;
  monsoon: ProcessedWaterQualityData | null;
  postmonsoon: ProcessedWaterQualityData | null;
}

interface SeasonalComparisonTabProps {
  comparisonTableData: ComparisonTableRow[];
  selectedAttribute: string;
  selectedAttributeLabel: string;
  isLoadingAllSeasons: boolean;
  allSeasonsError: string | null;
  borderColors: Record<string, string>;
  embedded?: boolean;
  showHeader?: boolean;
}

interface GraphTabProps {
  selectedAttributeLabel: string;
  interpolationLayerName: string | null;
  riverBufferData: any;
  isPreparingRaster?: boolean;
  rasterError?: string | null;
}

interface ProfilePoint {
  distance_m: number;
  value: number;
}

interface ProfileMeta {
  river_length_km?: number;
}

const LOCATION_TYPES = ["Upstream", "Downstream", "Drain"] as const;
const LINE_COLOR = "#2563eb";

const getLocationBgColor = (
  locationType: string,
  borderColors: Record<string, string>,
): string => {
  const color = borderColors[locationType];
  if (!color) return "rgba(243, 244, 246, 0.7)";
  return color.replace(", 1)", ", 0.08)").replace(",1)", ",0.08)");
};

const getLocationValues = (
  rows: ProcessedWaterQualityData[],
  selectedAttribute: string,
  parseValue: (value: string | number | null | undefined) => number,
  locationType?: string,
): number[] =>
  rows
    .filter((row) => {
      if (!locationType) return true;
      const location = String(row.location || "");
      return location === locationType || location.includes(locationType);
    })
    .map((row) => parseValue(row[selectedAttribute] as string | number))
    .filter((value) => value !== 0);

const buildSummaryStats = (values: number[]) => {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values).toFixed(2),
    max: Math.max(...values).toFixed(2),
    avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    count: values.length,
  };
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

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace("#", "");
  const bigint = parseInt(cleaned, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function SamplingLocationsTab({
  data,
  selectedAttributeLabel,
  selectedAttributeUnit,
  qualityThreshold,
  borderColors,
  embedded = false,
  showHeader = true,
}: SamplingLocationsTabProps) {
  return (
    <div className={embedded ? "" : "rounded-2xl border-l-4 border-l-blue-400 bg-white/80 shadow-lg backdrop-blur-sm"}>
      {showHeader && <div className="flex items-center justify-between border-b border-gray-100/80 p-5">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-blue-500 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">Individual Sampling Locations</h3>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            {data.length} Locations
          </span>
        </div>
      </div>}

      <div className={embedded ? "" : "px-5 pb-5 pt-4"}>
        <div className="h-[480px] w-full overflow-x-auto overflow-y-hidden rounded-xl border border-gray-100 bg-slate-50 shadow-inner">
          <div style={{ minWidth: `${Math.max(data.length * 60, 800)}px`, height: "480px", padding: "20px 20px 30px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 25, right: 30, left: 15, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="sampling" tick={{ fontSize: 11, fill: "#4B5563", fontWeight: 500 }} angle={-45} textAnchor="end" interval={0} height={80} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#4B5563", fontWeight: 500 }}
                  label={{
                    value: selectedAttributeLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "#374151", fontWeight: 600, fontSize: "12px" },
                  }}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!(active && payload && payload.length)) return null;
                    const activeData = payload.filter((entry) => entry.value !== null && entry.value !== undefined);
                    if (activeData.length === 0) return null;
                    return (
                      <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white/95 shadow-xl">
                        <div className="bg-slate-800 px-4 py-2">
                          <p className="text-sm font-semibold text-white">{label}</p>
                        </div>
                        <div className="space-y-1.5 px-4 py-2.5">
                          {activeData.map((entry, index) => {
                            const locationType = String(entry.name || "");
                            const pointColor = borderColors[locationType] || "#666";
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: pointColor }} />
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
                  content={() => (
                    <div className="mb-4 flex items-center justify-center gap-3">
                      {Object.entries(borderColors).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 shadow-sm">
                          <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-semibold text-slate-700">{type}</span>
                        </div>
                      ))}
                      {qualityThreshold !== undefined && (
                        <div className="flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3 py-1.5 shadow-sm">
                          <div className="h-0 w-4 border-t-2 border-dashed border-red-500" />
                          <span className="text-xs font-semibold text-red-700">Limit: {qualityThreshold}</span>
                        </div>
                      )}
                    </div>
                  )}
                />
                {qualityThreshold !== undefined && <ReferenceLine y={qualityThreshold} stroke="red" strokeDasharray="5 5" />}
                {Object.keys(borderColors).map((type) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={{ r: 6, fill: borderColors[type], stroke: borderColors[type], strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: borderColors[type], stroke: "#fff", strokeWidth: 2 }}
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
}

export function LocationTypeSummaryTab({
  filteredData,
  selectedAttribute,
  selectedAttributeLabel,
  borderColors,
  parseValue,
  embedded = false,
  showHeader = true,
}: LocationTypeSummaryTabProps) {
  const rows = useMemo(
    () =>
      LOCATION_TYPES.map((locationType) => {
        const values = getLocationValues(
          filteredData,
          selectedAttribute,
          parseValue,
          locationType,
        );
        const textColor = borderColors[locationType] || "#333";
        const bgColor = getLocationBgColor(locationType, borderColors);
        const stats = buildSummaryStats(values);
        if (!stats) return { locationType, hasData: false as const, textColor, bgColor };
        return {
          locationType,
          hasData: true as const,
          textColor,
          bgColor,
          ...stats,
        };
      }),
    [filteredData, selectedAttribute, borderColors, parseValue],
  );

  const overallStats = useMemo(
    () => buildSummaryStats(getLocationValues(filteredData, selectedAttribute, parseValue)),
    [filteredData, selectedAttribute, parseValue],
  );

  return (
    <div className={embedded ? "" : "rounded-2xl border-l-4 border-l-emerald-400 bg-white/80 shadow-lg backdrop-blur-sm"}>
      {showHeader && <div className="flex items-center gap-3 border-b border-gray-100/80 p-5">
        <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
        <h3 className="text-lg font-bold text-gray-800">Average Values by Location Type</h3>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Aggregated</span>
      </div>}
      <div className={embedded ? "" : "px-5 pb-5 pt-4"}>
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50/60 to-emerald-50/20 shadow-inner">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100">
              <th className="px-4 py-3 font-bold text-gray-700">Location Type</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                <span className="inline-flex items-center gap-1"><span className="text-emerald-500">&darr;</span> Minimum</span>
                <br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span>
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                <span className="inline-flex items-center gap-1"><span className="text-blue-500">~</span> Average</span>
                <br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span>
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                <span className="inline-flex items-center gap-1"><span className="text-red-500">&uarr;</span> Maximum</span>
                <br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span>
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                <span className="inline-flex items-center gap-1"><span className="text-violet-500">#</span> No. of Points</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.locationType} className="border-b border-gray-100 transition hover:brightness-[0.97]" style={{ backgroundColor: row.bgColor }}>
                <td className="px-4 py-2.5 font-bold" style={{ color: row.textColor }}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.textColor }} />
                    {row.locationType}
                  </div>
                </td>
                {row.hasData ? (
                  <>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>{row.min}</td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>{row.avg}</td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>{row.max}</td>
                    <td className="px-4 py-2.5 text-center font-semibold tabular-nums" style={{ color: row.textColor }}>{row.count}</td>
                  </>
                ) : (
                  <td colSpan={4} className="px-4 py-2.5 text-center italic" style={{ color: row.textColor }}>No data available</td>
                )}
              </tr>
            ))}
            {overallStats && (
              <tr
                className="border-t-2 border-blue-200 font-bold"
                style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08))" }}
              >
                <td className="px-4 py-3 text-[15px] text-blue-700">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    All points
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-[15px] text-green-700 tabular-nums">{overallStats.min}</td>
                <td className="px-4 py-3 text-center text-[15px] text-blue-700 tabular-nums">{overallStats.avg}</td>
                <td className="px-4 py-3 text-center text-[15px] text-red-700 tabular-nums">{overallStats.max}</td>
                <td className="px-4 py-3 text-center text-[15px] text-purple-700 tabular-nums">{overallStats.count}</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export function SeasonalComparisonTab({
  comparisonTableData,
  selectedAttribute,
  selectedAttributeLabel,
  isLoadingAllSeasons,
  allSeasonsError,
  borderColors,
  embedded = false,
  showHeader = true,
}: SeasonalComparisonTabProps) {
  return (
    <div className={embedded ? "" : "rounded-2xl border-l-4 border-l-amber-400 bg-white/80 shadow-lg backdrop-blur-sm"}>
      {showHeader && <div className="flex items-center gap-3 border-b border-gray-100/80 p-5">
        <div className="h-3 w-3 rounded-full bg-amber-500 shadow-sm" />
        <h3 className="text-lg font-bold text-gray-800">Seasonal Comparison Table</h3>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          {comparisonTableData.length} Locations
        </span>
      </div>}
      <div className={embedded ? "" : "px-5 pb-5 pt-4"}>
        {isLoadingAllSeasons && <div className="p-8 text-center text-gray-700">Loading seasonal comparison data...</div>}
        {allSeasonsError && !isLoadingAllSeasons && <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-600">{allSeasonsError}</div>}
        {!isLoadingAllSeasons && !allSeasonsError && comparisonTableData.length > 0 && (
          <div className="h-[420px] overflow-auto rounded-xl border border-gray-200 shadow-inner">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-30 border-b-2 border-slate-300 bg-slate-50 px-6 py-4 text-left font-bold text-gray-800">Location</th>
                  <th className="border-b-2 border-slate-300 px-6 py-4 text-center font-bold text-blue-700">Pre-monsoon<br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span></th>
                  <th className="border-b-2 border-slate-300 px-6 py-4 text-center font-bold text-green-700">Monsoon<br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span></th>
                  <th className="border-b-2 border-slate-300 px-6 py-4 text-center font-bold text-amber-700">Post-monsoon<br /><span className="text-xs font-normal text-gray-500">{selectedAttributeLabel}</span></th>
                </tr>
              </thead>
              <tbody>
                {comparisonTableData.map((row, index) => {
                  const locationColor = borderColors[row.locationType] || "#333";
                  const locationBgColor = getLocationBgColor(row.locationType, borderColors);
                  return (
                    <tr key={index} className="border-b border-gray-100" style={{ backgroundColor: locationBgColor }}>
                      <td className="sticky left-0 z-10 px-6 py-4 font-semibold" style={{ color: locationColor, backgroundColor: locationBgColor }}>{row.location}</td>
                      {[
                        row.premonsoon,
                        row.monsoon,
                        row.postmonsoon,
                      ].map((data, valueIndex) => {
                        const val = formatParameterValue(data, selectedAttribute);
                        return (
                          <td key={valueIndex} className={`px-6 py-4 text-center tabular-nums ${val === "-" ? "font-normal italic text-gray-300" : "font-semibold"}`} style={val === "-" ? undefined : { color: locationColor }}>
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
        {!isLoadingAllSeasons && !allSeasonsError && comparisonTableData.length === 0 && (
          <div className="p-12 text-center text-gray-500">No seasonal data available.</div>
        )}
      </div>
    </div>
  );
}

export function GraphTab({
  selectedAttributeLabel,
  interpolationLayerName,
  riverBufferData,
  isPreparingRaster = false,
  rasterError = null,
}: GraphTabProps) {
  const [profileData, setProfileData] = useState<ProfilePoint[]>([]);
  const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!interpolationLayerName || !riverBufferData) {
      setProfileData([]);
      setProfileMeta(null);
      setProfileError(null);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    fetchWqiProfile({ layerName: interpolationLayerName, riverBufferData })
      .then((result) => {
        if (cancelled) return;
        const normalizedProfileData = Array.isArray(result.profile_data)
          ? result.profile_data
              .map((point: any) => ({
                distance_m: Number(point?.distance_m),
                value: Number(point?.value ?? point?.wqi),
              }))
              .filter((point: ProfilePoint) => Number.isFinite(point.distance_m) && Number.isFinite(point.value))
          : [];

        if (result.success && normalizedProfileData.length > 0) {
          setProfileData(normalizedProfileData);
          setProfileMeta(result.profile_meta || null);
        } else {
          setProfileData([]);
          setProfileMeta(null);
          if (!result.success) setProfileError(result.error || "Profile generation failed");
        }
      })
      .catch((error: any) => {
        if (!cancelled) setProfileError(error?.message || "Network error");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [interpolationLayerName, riverBufferData]);

  const profileTraces = useMemo(() => {
    if (profileData.length === 0) return [];
    return [
      {
        type: "scatter",
        mode: "lines",
        name: selectedAttributeLabel,
        x: profileData.map((point) => point.distance_m),
        y: profileData.map((point) => point.value),
        connectgaps: true,
        line: { color: LINE_COLOR, width: 2, shape: "linear" },
        fill: "tozeroy",
        fillcolor: hexToRgba(LINE_COLOR, 0.18),
        hovertemplate: `Length: %{x:.0f} m<br>${selectedAttributeLabel}: %{y:.2f}<extra></extra>`,
      } as Partial<Plotly.Data>,
    ];
  }, [profileData, selectedAttributeLabel]);

  const profileLayout = useMemo<Partial<Plotly.Layout>>(
    () => ({
      autosize: true,
      margin: { t: 12, r: 24, b: 56, l: 52 },
      plot_bgcolor: "#f8fafc",
      paper_bgcolor: "#ffffff",
      font: { family: "Cambria, Georgia, serif" },
      hovermode: "x unified",
      legend: { orientation: "h", y: -0.22, x: 0 },
      xaxis: { title: { text: "Length (m)" }, showgrid: true, gridcolor: "#e5e7eb", zeroline: false },
      yaxis: { title: { text: selectedAttributeLabel }, showgrid: true, gridcolor: "#e5e7eb", zeroline: false },
    }),
    [selectedAttributeLabel],
  );

  const hasError = profileError || rasterError;

  return (
    <div className="rounded-2xl border-l-4 border-l-violet-400 bg-white/80 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-gray-100/80 p-5">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-violet-500 shadow-sm" />
          <h3 className="text-lg font-bold text-gray-800">{selectedAttributeLabel} Longitudinal Profile</h3>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Selected Parameter</span>
        </div>
        {profileMeta?.river_length_km && <span className="text-xs text-gray-500">River Length: {profileMeta.river_length_km} km</span>}
      </div>
      <div className="px-5 pb-5 pt-4">
        {(isPreparingRaster || profileLoading) && (
          <div className="flex h-[340px] items-center justify-center text-center">
            <div>
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm text-gray-500">{isPreparingRaster ? `Preparing ${selectedAttributeLabel} raster...` : `Generating ${selectedAttributeLabel} profile...`}</p>
            </div>
          </div>
        )}
        {!profileLoading && !isPreparingRaster && profileData.length > 0 && (
          <div className="h-[340px] w-full">
            <Plot
              data={profileTraces}
              layout={profileLayout}
              config={{ responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </div>
        )}
        {!profileLoading && !isPreparingRaster && profileData.length === 0 && !hasError && (
          <div className="flex h-[200px] items-center justify-center text-center text-sm text-gray-500">
            {interpolationLayerName ? `No profile data returned for ${selectedAttributeLabel}.` : `Open the graph tab after ${selectedAttributeLabel} raster preparation completes.`}
          </div>
        )}
        {!profileLoading && !isPreparingRaster && hasError && (
          <div className="flex h-[200px] items-center justify-center text-center">
            <div>
              <p className="mb-1 text-sm text-red-500">Warning: {hasError}</p>
              <p className="text-xs text-gray-400">Make sure interpolation can be prepared for the selected season and parameter.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
