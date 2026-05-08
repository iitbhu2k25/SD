"use client";

import { useMemo, useState } from "react";
import type { PriorityRiskCounts } from "../utils/riskFactorSummary";

interface PriorityRiskSummaryProps {
  counts: PriorityRiskCounts;
  isDark?: boolean;
}

interface RiskSegment {
  key: "veryLow" | "low" | "medium" | "high" | "veryHigh";
  label: string;
  color: string;
  value: number;
}

const RISK_SEGMENT_META: Array<Omit<RiskSegment, "value">> = [
  { key: "veryLow", label: "Very Low", color: "#14b8a6" },
  { key: "low", label: "Low", color: "#3b82f6" },
  { key: "medium", label: "Medium", color: "#eab308" },
  { key: "high", label: "High", color: "#f97316" },
  { key: "veryHigh", label: "Very High", color: "#e11d48" },
];

const EMPTY_COUNTS: PriorityRiskCounts = {
  veryLow: 0,
  low: 0,
  medium: 0,
  high: 0,
  veryHigh: 0,
  unknown: 0,
  total: 0,
};

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  if (value >= 99.95) {
    return "100%";
  }

  if (value <= 0.05) {
    return "0%";
  }

  return `${value.toFixed(1)}%`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PriorityRiskSummary({
  counts,
  isDark = false,
}: PriorityRiskSummaryProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<RiskSegment["key"] | null>(null);
  const safeCounts = counts ?? EMPTY_COUNTS;

  const segments = useMemo<RiskSegment[]>(
    () =>
      RISK_SEGMENT_META.map((meta) => ({
        ...meta,
        value: safeCounts[meta.key],
      })),
    [safeCounts],
  );

  const total = safeCounts.total;
  const highRankCount = safeCounts.high + safeCounts.veryHigh;
  const highRankPercent = total > 0 ? (highRankCount / total) * 100 : 0;

  if (!counts || total <= 0) {
    return null;
  }

  const ringSize = 104;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference * (1 - Math.min(100, Math.max(0, highRankPercent)) / 100);

  const donutDiameter = 132;
  const donutStroke = 20;
  const donutHoverStroke = 24;
  const donutPadding = 10;
  const donutSize = donutDiameter + donutPadding * 2;
  const donutCenter = donutSize / 2;
  const donutRadius = (donutDiameter - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;

  let runningLength = 0;
  const donutSlices = segments
    .filter((segment) => segment.value > 0 && total > 0)
    .map((segment) => {
      const rawSliceLength = (segment.value / total) * donutCircumference;
      const visibleSliceLength = Math.max(0, rawSliceLength - 2);
      const strokeDasharray = `${visibleSliceLength} ${donutCircumference}`;
      const strokeDashoffset = -runningLength;
      runningLength += rawSliceLength;

      return {
        ...segment,
        strokeDasharray,
        strokeDashoffset,
      };
    });

  return (
    <section
      className={`mt-3 rounded-3xl border shadow-[0_16px_34px_rgba(0,0,0,0.3)] transition-all sm:mt-4 ${
        isDark
          ? "border-[#1e3a5f]/50 bg-[#0d1629]/80"
          : "border-stone-200 bg-white/72"
      }`}
    >
      <div className={isMinimized ? "p-2.5 sm:p-3" : "p-3 sm:p-4"}>
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className={`truncate border-l-2 border-l-cyan-400 pl-2 text-xs font-semibold sm:text-sm ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              MAR Suitability Insights
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setIsMinimized((current) => !current)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition sm:gap-2 sm:px-3 sm:text-xs ${
              isMinimized
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
            }`}
            title={isMinimized ? "Expand MAR suitability insights" : "Minimize MAR suitability insights"}
            aria-label={isMinimized ? "Expand MAR suitability insights" : "Minimize MAR suitability insights"}
          >
            <svg className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isMinimized ? "M5 10l7 7 7-7" : "M19 14l-7-7-7 7"}
              />
            </svg>
            <span>{isMinimized ? "Expand" : "Minimize"}</span>
          </button>
        </div>

        {!isMinimized && (
          <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          <div
            className={`rounded-xl border p-3 ${
              isDark
                ? "border-[#1e3a5f]/50 bg-[#0a1628]/80"
                : "border-stone-200 bg-stone-50/75"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isDark ? "text-cyan-300/80" : "text-slate-500"
              }`}
            >
              High Ranking Share
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-[108px] w-[108px] shrink-0">
                <svg
                  width={ringSize}
                  height={ringSize}
                  viewBox={`0 0 ${ringSize} ${ringSize}`}
                  className="block"
                >
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="none"
                    stroke={isDark ? "#1e293b" : "#e2e8f0"}
                    strokeWidth={ringStroke}
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth={ringStroke}
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-xl font-bold ${
                      isDark ? "text-rose-300" : "text-rose-600"
                    }`}
                  >
                    {formatPercent(highRankPercent)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    high rank
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    isDark ? "text-slate-100" : "text-slate-900"
                  }`}
                >
                  {highRankCount} of {total} villages are High or Very High ranked
                </p>
                <div
                  className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    isDark
                      ? "border-rose-900/60 bg-rose-950/30 text-rose-300"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  Focus MAR recharge planning
                </div>
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              isDark
                ? "border-[#1e3a5f]/50 bg-[#0a1628]/80"
                : "border-stone-200 bg-stone-50/75"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isDark ? "text-cyan-300/80" : "text-slate-500"
              }`}
            >
              Suitability Distribution
            </p>

            <div className="mt-3 flex flex-col items-center gap-3">
              <div className="relative h-[136px] w-[136px]">
                <svg
                  width={donutSize}
                  height={donutSize}
                  viewBox={`0 0 ${donutSize} ${donutSize}`}
                  className="block"
                >
                  <circle
                    cx={donutCenter}
                    cy={donutCenter}
                    r={donutRadius}
                    fill="none"
                    stroke={isDark ? "#1e293b" : "#e2e8f0"}
                    strokeWidth={donutStroke}
                  />
                  {donutSlices.map((slice) => (
                    <circle
                      key={slice.key}
                      cx={donutCenter}
                      cy={donutCenter}
                      r={hoveredSegment === slice.key ? donutRadius + 1 : donutRadius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={hoveredSegment === slice.key ? donutHoverStroke : donutStroke}
                      strokeLinecap="butt"
                      strokeDasharray={slice.strokeDasharray}
                      strokeDashoffset={slice.strokeDashoffset}
                      transform={`rotate(-90 ${donutCenter} ${donutCenter})`}
                      style={{
                        cursor: "pointer",
                        opacity:
                          hoveredSegment && hoveredSegment !== slice.key ? 0.55 : 1,
                        filter:
                          hoveredSegment === slice.key
                            ? `drop-shadow(0 0 7px ${hexToRgba(slice.color, 0.68)})`
                            : "none",
                        transition: "all 160ms ease",
                      }}
                      onMouseEnter={() => setHoveredSegment(slice.key)}
                      onMouseLeave={() => setHoveredSegment(null)}
                    />
                  ))}
                </svg>
              </div>

              <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {segments.map((segment) => (
                  <div
                    key={segment.key}
                    className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition ${
                      hoveredSegment === segment.key
                        ? isDark
                          ? "bg-cyan-900/30"
                          : "bg-slate-100"
                        : ""
                    }`}
                    onMouseEnter={() => setHoveredSegment(segment.key)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-[2px]"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className={isDark ? "text-slate-200" : "text-slate-700"}>
                      {segment.label}:{" "}
                      <strong className={isDark ? "text-white" : "text-slate-900"}>
                        {segment.value}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </section>
  );
}
