"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";

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
  onDownloadRaster: (format: "png" | "tiff") => void | Promise<void>;
  isRasterDownloadAvailable: boolean;
  isRasterDownloading?: boolean;
}

const getWqiAccentColor = (label: string) => {
  switch (label) {
    case "Excellent":
      return { accent: "#3b82f6", bg: "from-blue-50 to-blue-100/60" };
    case "Good":
      return { accent: "#10b981", bg: "from-emerald-50 to-emerald-100/60" };
    case "Poor":
      return { accent: "#f97316", bg: "from-orange-50 to-orange-100/60" };
    case "Very Poor":
      return { accent: "#ef4444", bg: "from-red-50 to-red-100/60" };
    case "Unsuitable for use":
      return { accent: "#991b1b", bg: "from-red-100 to-red-200/60" };
    default:
      return { accent: "#94a3b8", bg: "from-slate-50 to-slate-100/60" };
  }
};

const ChartStickyHeader: React.FC<ChartStickyHeaderProps> = ({
  selectedAttribute,
  attributes,
  attributeLabels,
  onAttributeChange,
  stats,
  wqiMean,
  wqiInfo,
  onDownloadRaster,
  isRasterDownloadAvailable,
  isRasterDownloading = false,
}) => {
  const [downloadFormat, setDownloadFormat] = useState<"png" | "tiff">("png");
  const wqiAccent = getWqiAccentColor(wqiInfo.label);

  const statCards = stats
    ? [
      {
        label: "Minimum",
        value: stats.min,
        icon: "↓",
        gradient: "from-emerald-50/80 to-teal-50/60",
        accent: "#10b981",
        valueColor: "text-emerald-600",
      },
      {
        label: "Average",
        value: stats.avg,
        icon: "≈",
        gradient: "from-blue-50/80 to-indigo-50/60",
        accent: "#3b82f6",
        valueColor: "text-blue-600",
      },
      {
        label: "Maximum",
        value: stats.max,
        icon: "↑",
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
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-5 shadow-md">
      {/* Top row: label + download controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          Water Quality Parameter
        </label>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setDownloadFormat("png")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${downloadFormat === "png"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
                }`}
            >
              PNG
            </button>
            <button
              type="button"
              onClick={() => setDownloadFormat("tiff")}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${downloadFormat === "tiff"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
                }`}
            >
              TIFF
            </button>
          </div>
          <button
            type="button"
            onClick={() => onDownloadRaster(downloadFormat)}
            disabled={!isRasterDownloadAvailable || isRasterDownloading}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ${isRasterDownloadAvailable && !isRasterDownloading
              ? "border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:shadow-md hover:scale-105 cursor-pointer"
              : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            title={
              isRasterDownloadAvailable
                ? isRasterDownloading
                  ? `Downloading ${downloadFormat.toUpperCase()} raster...`
                  : `Download ${downloadFormat.toUpperCase()} raster`
                : "Generate interpolation for selected parameter to enable raster download"
            }
            aria-label={`Download ${downloadFormat.toUpperCase()} raster`}
          >
            {isRasterDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Main content: dropdown + WQI card | stats grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left column: select + WQI */}
        <div className="space-y-3">
          <select
            className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={selectedAttribute}
            onChange={(e) => onAttributeChange(e.target.value)}
          >
            {attributes.map((attr) => (
              <option key={attr} value={attr}>
                {attributeLabels[attr]}
              </option>
            ))}
          </select>

          {/* WQI Card with accent bar */}
          <div
            className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${wqiAccent.bg} border border-slate-200/70 px-4 py-3 shadow-sm`}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: wqiAccent.accent }}
            />
            <div className="flex items-center gap-3 pl-2">
              <div
                className="h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: wqiAccent.accent }}
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-500 tracking-wide">Mean WQI</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-extrabold" style={{ color: wqiAccent.accent }}>
                    {wqiMean || "N/A"}
                  </p>
                  <p className="text-xs font-medium text-slate-500">{wqiInfo.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: stat cards */}
        <div className="w-full">
          {stats && (
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <p className="text-sm font-bold text-slate-700">
                  {attributeLabels[selectedAttribute]} Statistics
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} p-3 text-center transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                      style={{ backgroundColor: card.accent }}
                    />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      <span className="mr-1">{card.icon}</span>
                      {card.label}
                    </p>
                    <p className={`text-xl font-extrabold ${card.valueColor}`}>
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartStickyHeader;
