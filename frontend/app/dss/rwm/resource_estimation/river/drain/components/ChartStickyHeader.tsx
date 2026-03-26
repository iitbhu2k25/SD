"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Loader2 } from "lucide-react";
import ParameterSelect from "@/app/dss/rwm/resource_estimation/river/components/ParameterSelect";

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
  onBackToSelection: () => void;
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
  onBackToSelection,
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
          icon: <ArrowDown size={12} strokeWidth={2.4} />,
          gradient: "from-emerald-50/80 to-teal-50/60",
          accent: "#10b981",
          valueColor: "text-emerald-600",
        },
        {
          label: "Average",
          value: stats.avg,
          icon: <span className="text-[11px] font-bold">~</span>,
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
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 p-5 shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBackToSelection}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer"
          aria-label="Back to selection"
          title="Back to selection"
        >
          <ArrowLeft size={17} />
        </button>

        <div
          className={`inline-flex min-h-10 items-center gap-3 rounded-full border border-slate-200/80 bg-gradient-to-r ${wqiAccent.bg} px-4 py-2 shadow-sm`}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Mean WQI
          </span>
          <span
            className="text-xl font-extrabold leading-none"
            style={{ color: wqiAccent.accent }}
          >
            {wqiMean || "N/A"}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm"
            style={{
              backgroundColor: `${wqiAccent.accent}1A`,
              color: wqiAccent.accent,
            }}
          >
            {wqiInfo.label}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <ParameterSelect
              options={attributes.map((attr) => ({
                value: attr,
                label: attributeLabels[attr],
              }))}
              value={selectedAttribute}
              onChange={onAttributeChange}
              ariaLabel="Water quality parameter"
            />
          </div>

          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setDownloadFormat("png")}
              className={`inline-flex h-9 min-w-[52px] items-center justify-center rounded-full px-3 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                downloadFormat === "png"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              PNG
            </button>
            <button
              type="button"
              onClick={() => setDownloadFormat("tiff")}
              className={`inline-flex h-9 min-w-[52px] items-center justify-center rounded-full px-3 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                downloadFormat === "tiff"
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
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all duration-200 ${
              isRasterDownloadAvailable && !isRasterDownloading
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

      {stats && (
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 py-3 shadow-sm lg:min-w-[180px]">
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-blue-500" />
              <div className="flex h-full items-center gap-2 pl-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-sm font-bold text-slate-700">
                  {attributeLabels[selectedAttribute]} Statistics
                </p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} p-2.5 text-center transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                    style={{ backgroundColor: card.accent }}
                  />
                  <p className="mb-1 flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="inline-flex items-center justify-center">
                      {card.icon}
                    </span>
                    {card.label}
                  </p>
                  <p className={`text-xl font-extrabold ${card.valueColor}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartStickyHeader;
