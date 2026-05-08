"use client";

import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SingleSelect } from "@/components/dss_common/SingleSelect";

interface ChartStats {
  avg: string;
  min: string;
  max: string;
  count: number;
}

interface WqiInfo {
  label: string;
  color: string;
}

interface ChartStickyHeaderProps {
  selectedAttribute: string;
  attributes: string[];
  attributeLabels: Record<string, string>;
  onAttributeChange: (value: string) => void;
  stats: ChartStats | null;
  wqiMean: string | null;
  wqiInfo: WqiInfo;
}

const getWqiAccentColor = (label: string) => {
  switch (label) {
    case "Excellent":
      return { accent: "#2563eb", bg: "from-blue-50 to-blue-100/60" };
    case "Good":
      return { accent: "#059669", bg: "from-emerald-50 to-emerald-100/60" };
    case "Poor":
      return { accent: "#ea580c", bg: "from-orange-50 to-orange-100/60" };
    case "Very Poor":
      return { accent: "#dc2626", bg: "from-red-50 to-red-100/60" };
    case "Unsuitable for use":
      return { accent: "#7f1d1d", bg: "from-red-100 to-red-200/60" };
    default:
      return { accent: "#64748b", bg: "from-slate-50 to-slate-100/60" };
  }
};

export default function ChartStickyHeader({
  selectedAttribute,
  attributes,
  attributeLabels,
  onAttributeChange,
  stats,
  wqiMean,
  wqiInfo,
}: ChartStickyHeaderProps) {
  const wqiAccent = getWqiAccentColor(wqiInfo.label);

  const statCards = stats
    ? [
        {
          label: "Minimum",
          value: stats.min,
          icon: <ArrowDown size={12} strokeWidth={2.4} />,
          gradient: "from-emerald-50/80 to-teal-50/60",
          accent: "#10b981",
          valueColor: "text-emerald-600",
        },
        {
          label: "Average",
          value: stats.avg,
          icon: "~",
          gradient: "from-blue-50/80 to-indigo-50/60",
          accent: "#3b82f6",
          valueColor: "text-blue-600",
        },
        {
          label: "Maximum",
          value: stats.max,
          icon: <ArrowUp size={12} strokeWidth={2.4} />,
          gradient: "from-rose-50/80 to-red-50/60",
          accent: "#ef4444",
          valueColor: "text-red-500",
        },
        {
          label: "No. of Points",
          value: stats.count,
          icon: "#",
          gradient: "from-violet-50/80 to-purple-50/60",
          accent: "#8b5cf6",
          valueColor: "text-violet-600",
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-4 shadow-md">

      {/* WQI badge — full width, compact */}
      <div className={`mb-3 flex items-center gap-3 rounded-full border border-slate-200/80 bg-gradient-to-r ${wqiAccent.bg} px-4 py-2 shadow-sm`}>
        <span className="text-[11px] font-bold uppercase text-slate-500">Mean WQI</span>
        <span className="text-lg font-extrabold leading-none" style={{ color: wqiAccent.accent }}>
          {wqiMean || "N/A"}
        </span>
        <span
          className="ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: `${wqiAccent.accent}1A`, color: wqiAccent.accent }}
        >
          {wqiInfo.label}
        </span>
      </div>

      {/* Parameter selector — full width */}
      <SingleSelect
        items={attributes.map((attr) => ({
          id: attr,
          name: attributeLabels[attr],
        }))}
        selectedValue={selectedAttribute}
        onValueChange={(value) => {
          if (value !== null) onAttributeChange(String(value));
        }}
        label="Chart Parameter"
        placeholder="Select parameter"
      />

      {/* Stat cards — 2×2 grid so labels never clip */}
      {stats && (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/80 p-2.5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <p className="text-xs font-bold text-slate-600">
              {attributeLabels[selectedAttribute]} Statistics
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} p-2.5 transition hover:shadow-md`}
              >
                <div
                  className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: card.accent }}
                />
                <p className="mb-1 flex items-center gap-1 pl-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center justify-center">{card.icon}</span>
                  {card.label}
                </p>
                <p className={`pl-1 text-base font-extrabold ${card.valueColor}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
