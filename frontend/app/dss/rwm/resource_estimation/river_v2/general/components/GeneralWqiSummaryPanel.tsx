"use client";

import { Download, Loader2 } from "lucide-react";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import type { GeneralCsvUploadResult, GeneralRasterDownloadFormat } from "../types";
import { useState } from "react";

const WQI_CLASSES = [
  { name: "Excellent", color: "#22c55e", text: "text-green-700", badge: "bg-green-100" },
  { name: "Good", color: "#3b82f6", text: "text-blue-700", badge: "bg-blue-100" },
  { name: "Poor", color: "#eab308", text: "text-yellow-700", badge: "bg-yellow-100" },
  { name: "Very Poor", color: "#f97316", text: "text-orange-700", badge: "bg-orange-100" },
  { name: "Unsuitable", color: "#ef4444", text: "text-red-700", badge: "bg-red-100" },
];

interface GeneralWqiSummaryPanelProps {
  activeResult: GeneralCsvUploadResult;
  datasetLabels: string[];
  selectedClass: string | null;
  activeParameter: string;
  activeValidPoints: number;
  activeRejectedPoints: number;
  isDownloadingRaster: boolean;
  isDownloadingReport: boolean;
  onSelectDataset: (label: string) => void;
  onSelectClass: (wqiClass: string | null) => void;
  onSelectParameter: (parameter: string) => void;
  onDownloadRaster: (format: GeneralRasterDownloadFormat) => void;
  onDownloadReport: () => void;
  isDark?: boolean;
}

export default function GeneralWqiSummaryPanel({
  activeResult,
  datasetLabels,
  selectedClass,
  activeParameter,
  activeValidPoints,
  activeRejectedPoints,
  isDownloadingRaster,
  isDownloadingReport,
  onSelectDataset,
  onSelectClass,
  onSelectParameter,
  onDownloadRaster,
  onDownloadReport,
  isDark = false,
}: GeneralWqiSummaryPanelProps) {
  const [rasterFormat, setRasterFormat] = useState<GeneralRasterDownloadFormat>("tiff");
  const summary = activeResult.summary;
  const raster = activeResult.wqiRaster;
  const parameterOptions = ["WQI", ...Object.keys(raster?.parameterLayers || {})];
  const fileItems = datasetLabels.map((label) => ({ id: label, name: label }));
  const parameterItems = parameterOptions.map((parameter) => ({
    id: parameter,
    name: parameter,
  }));
  const rasterFormatItems = [
    { id: "tiff", name: "TIFF" },
    { id: "png", name: "PNG" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SingleSelect
          items={fileItems}
          selectedValue={activeResult.fileLabel}
          onValueChange={(value) => {
            if (value !== null) onSelectDataset(String(value));
          }}
          label="File"
          placeholder="Select file"
          isDark={isDark}
        />

        <SingleSelect
          items={parameterItems}
          selectedValue={activeParameter}
          onValueChange={(value) => {
            if (value !== null) onSelectParameter(String(value));
          }}
          label="Raster Parameter"
          placeholder="Select parameter"
          disabled={!raster}
          isDark={isDark}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-md p-2 ${isDark ? "bg-blue-500/10" : "bg-blue-50"}`}>
          <div className="text-[10px] font-semibold uppercase text-blue-500">Mean WQI</div>
          <div className={`text-lg font-bold ${isDark ? "text-blue-200" : "text-blue-800"}`}>
            {summary?.mean?.toFixed?.(2) ?? "NA"}
          </div>
        </div>
        <div className={`rounded-md p-2 ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
          <div className="text-[10px] font-semibold uppercase text-emerald-500">Valid Points</div>
          <div className={`text-lg font-bold ${isDark ? "text-emerald-200" : "text-emerald-800"}`}>
            {activeValidPoints}
          </div>
        </div>
        <div className={`rounded-md p-2 ${isDark ? "bg-slate-500/10" : "bg-slate-50"}`}>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Min / Max</div>
          <div className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {summary ? `${summary.min.toFixed(1)} / ${summary.max.toFixed(1)}` : "NA"}
          </div>
        </div>
        <div className={`rounded-md p-2 ${isDark ? "bg-red-500/10" : "bg-red-50"}`}>
          <div className="text-[10px] font-semibold uppercase text-red-500">Rejected</div>
          <div className={`text-lg font-bold ${isDark ? "text-red-200" : "text-red-800"}`}>
            {activeRejectedPoints}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {WQI_CLASSES.map((item) => {
          const count = summary?.countByClass?.[item.name] || 0;
          const isSelected = selectedClass === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onSelectClass(isSelected ? null : item.name)}
              className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-xs font-semibold transition ${
                isSelected
                  ? "border-transparent text-white"
                  : isDark
                    ? "border-[#1e3a5f]/70 bg-[#080e1c] text-slate-200 hover:bg-[#12233f]/70"
                    : "border-stone-200 bg-white text-slate-700 hover:bg-stone-50"
              }`}
              style={isSelected ? { backgroundColor: item.color } : undefined}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className={isSelected ? "text-white" : `${item.text} ${item.badge} rounded px-2 py-0.5`}>
                {count} pts
              </span>
            </button>
          );
        })}
      </div>

      <div className={`border-t pt-3 ${isDark ? "border-[#1e3a5f]/60" : "border-stone-100"}`}>
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <SingleSelect
            items={rasterFormatItems}
            selectedValue={rasterFormat}
            onValueChange={(value) => {
              if (value !== null) setRasterFormat(value as GeneralRasterDownloadFormat);
            }}
            label="Format"
            placeholder="Select format"
            disabled={!raster || isDownloadingRaster}
            isDark={isDark}
          />
          <button
            type="button"
            disabled={!raster || isDownloadingRaster}
            onClick={() => onDownloadRaster(rasterFormat)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isDownloadingRaster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Raster
          </button>
        </div>
        <button
          type="button"
          disabled={!raster || isDownloadingReport}
          onClick={onDownloadReport}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isDownloadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Full PDF Report
        </button>
      </div>
    </div>
  );
}
