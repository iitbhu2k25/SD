import React, { useState } from "react";
import { BarChart2, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const BACKEND_URL =   `${process.env.NEXT_PUBLIC_DJANGO_URL}`;

interface WqiSummaryTableProps {
  fileLabel: string;
  fileOptions: string[];
  onSelectFile: (label: string) => void;
  summary: {
    min: number;
    max: number;
    mean: number;
    countByClass: Record<string, number>;
  };
  selectedClass: string | null;
  onSelectClass: (cls: string | null) => void;
  validPoints: number;
  rejectedPoints: number;
  wqiRaster: {
    layerName: string;
    workspace: string;
    parameterLayers?: Record<string, string>;
    mapImage?: string;
    legendImage?: string;
  } | null;
  onDownloadReport: () => void | Promise<void>;
  isDownloadingReport?: boolean;
  givenParameters?: string[];
  missingParameters?: string[];
  activeParameter: string;
  onSelectParameter: (param: string) => void;
}

const WQI_CLASSES = [
  { name: "Excellent", color: "#22c55e", text: "text-green-700", badge: "bg-green-100" },
  { name: "Good", color: "#3b82f6", text: "text-blue-700", badge: "bg-blue-100" },
  { name: "Poor", color: "#eab308", text: "text-yellow-700", badge: "bg-yellow-100" },
  { name: "Very Poor", color: "#f97316", text: "text-orange-700", badge: "bg-orange-100" },
  { name: "Unsuitable", color: "#ef4444", text: "text-red-700", badge: "bg-red-100" },
];

const WqiSummaryTable: React.FC<WqiSummaryTableProps> = ({
  fileLabel,
  fileOptions,
  onSelectFile,
  summary,
  selectedClass,
  onSelectClass,
  validPoints,
  rejectedPoints,
  wqiRaster,
  onDownloadReport,
  isDownloadingReport = false,
  givenParameters = [],
  missingParameters = [],
  activeParameter,
  onSelectParameter,
}) => {
  const [isRasterDownloading, setIsRasterDownloading] = useState(false);
  const [rasterDownloadFormat, setRasterDownloadFormat] = useState<"tiff" | "png">("tiff");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="px-5 py-4 border-b border-gray-100 bg-white">
        <div className="flex flex-col gap-3">
          {/* Header Row: Title + Tags */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-bold tracking-tight text-gray-800">WQI Summary</h3>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium ml-2">
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-green-50 text-green-700 border border-green-100"
                title="Total valid points"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>
                  Valid: <span className="font-bold">{validPoints}</span>
                </span>
              </div>
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm border ${rejectedPoints > 0
                  ? "bg-red-50 text-red-700 border-red-100"
                  : "bg-gray-50 text-gray-500 border-gray-100"
                  }`}
                title="Points outside buffer"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${rejectedPoints > 0 ? "bg-red-500" : "bg-gray-400"}`}
                />
                <span>
                  Rejected: <span className="font-bold">{rejectedPoints}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Given/Missing Parameters Row */}
          {(givenParameters.length > 0 || missingParameters.length > 0) && (
            <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Parameters Detected in CSV
              </span>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {givenParameters.map(param => (
                  <span key={`given-${param}`} className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm shrink-0">
                    {param}
                  </span>
                ))}
                {missingParameters.map(param => (
                  <span key={`missing-${param}`} className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 rounded-md shrink-0 opacity-60 line-through">
                    {param}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* File & Export Controls Row */}
          <div className="grid grid-cols-2 gap-4 mt-1">
            {/* File Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                FILE
              </label>
              <select
                value={fileLabel}
                onChange={(e) => onSelectFile(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-gray-200 bg-gradient-to-r from-gray-50 to-white text-xs text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm cursor-pointer"
                title="Select file"
              >
                {fileOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Raster Exports & Controls */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                RASTER PARAMETER
              </label>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={activeParameter}
                  onChange={(e) => onSelectParameter(e.target.value)}
                  disabled={!wqiRaster}
                  className={`w-full h-8 px-2 rounded-md border border-gray-200 bg-gradient-to-r from-gray-50 to-white text-xs font-semibold text-gray-700 outline-none shadow-sm ${wqiRaster ? "focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  title={wqiRaster ? "Select parameter" : "Generate rasters to enable parameters"}
                >
                  <option value="WQI">WQI</option>
                  {(wqiRaster?.parameterLayers ? Object.keys(wqiRaster.parameterLayers) : []).map((param) => (
                    <option key={param} value={param}>
                      {param}
                    </option>
                  ))}
                </select>

                <select
                  value={rasterDownloadFormat}
                  onChange={(e) => setRasterDownloadFormat(e.target.value as "tiff" | "png")}
                  disabled={!wqiRaster || isRasterDownloading}
                  className={`h-8 px-2 rounded-md border border-gray-200 bg-gradient-to-r from-gray-50 to-white text-[11px] font-semibold text-gray-700 outline-none shadow-sm ${wqiRaster && !isRasterDownloading ? "focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  title={wqiRaster ? "Select raster format" : "Generate rasters to enable format selection"}
                >
                  <option value="tiff">TIFF</option>
                  <option value="png">PNG</option>
                </select>

                {/* Contextual Download Button */}
                <button
                  title={wqiRaster ? (isRasterDownloading ? `Downloading ${activeParameter} (${rasterDownloadFormat.toUpperCase()})...` : `Download ${activeParameter} ${rasterDownloadFormat.toUpperCase()}`) : "Generate rasters first"}
                  disabled={!wqiRaster || isRasterDownloading}
                  onClick={async () => {
                    if (!wqiRaster) return;
                    const layerId = activeParameter === "WQI"
                      ? wqiRaster.layerName
                      : wqiRaster.parameterLayers?.[activeParameter];
                    if (!layerId) {
                      toast.error(`No raster layer found for ${activeParameter}. Regenerate rasters and try again.`);
                      return;
                    }

                    const layerNameWithWorkspace = layerId.includes(':')
                      ? layerId
                      : `${wqiRaster.workspace}:${layerId}`;
                    const safeFile = `${fileLabel}_${activeParameter}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
                    const fileExtension = rasterDownloadFormat === "png" ? "png" : "tif";
                    const fullFileName = `${safeFile}.${fileExtension}`;
                    const apiBase = BACKEND_URL.replace(/\/+$/, "");
                    const url = `${apiBase}/rwm/general/download-raster?layer_name=${encodeURIComponent(layerNameWithWorkspace)}&workspace=${encodeURIComponent(wqiRaster.workspace)}&filename=${encodeURIComponent(fullFileName)}&format=${encodeURIComponent(rasterDownloadFormat)}`;

                    setIsRasterDownloading(true);
                    const toastId = toast.loading(`Preparing ${activeParameter} ${rasterDownloadFormat.toUpperCase()}...`);
                    try {
                      const response = await fetch(url, { method: "GET" });
                      if (!response.ok) {
                        let errorMessage = `Download failed (${response.status})`;
                        const contentType = response.headers.get("content-type") || "";
                        if (contentType.includes("application/json")) {
                          const payload = await response.json();
                          errorMessage = payload?.error || errorMessage;
                          if (Array.isArray(payload?.details) && payload.details.length > 0) {
                            errorMessage = `${errorMessage} ${payload.details[0]}`;
                          }
                        }
                        throw new Error(errorMessage);
                      }

                      const blob = await response.blob();
                      const objectUrl = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = objectUrl;
                      link.download = fullFileName;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(objectUrl);

                      toast.success(`${activeParameter} ${rasterDownloadFormat.toUpperCase()} download started.`, { id: toastId });
                    } catch (error: any) {
                      const message = error?.message || "Failed to download raster.";
                      toast.error(message, { id: toastId });
                    } finally {
                      setIsRasterDownloading(false);
                    }
                  }}
                  className={`flex shrink-0 items-center justify-center p-2 rounded-md transition-colors tooltip group relative ${wqiRaster
                    ? (isRasterDownloading ? "bg-gray-500 text-white cursor-wait" : "bg-gray-900 text-white hover:bg-gray-800")
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                  {isRasterDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="absolute -top-8 right-0 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded scale-0 group-hover:scale-100 transition-transform origin-bottom-right drop-shadow-sm whitespace-nowrap">
                    {isRasterDownloading ? `Downloading ${activeParameter} (${rasterDownloadFormat.toUpperCase()})` : `Download ${activeParameter} (${rasterDownloadFormat.toUpperCase()})`}
                  </span>
                </button>
              </div>

              {!wqiRaster && (
                <div className="w-full h-8 px-3 rounded-md border border-dashed border-gray-300 text-[11px] text-gray-500 bg-gray-50 flex items-center justify-center mt-1">
                  Rasters are generated automatically for all uploaded files.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 p-5 bg-white border-b border-gray-50">
        <div className="flex flex-col items-center justify-center p-3.5 bg-gradient-to-br from-blue-50/60 to-blue-100/60 rounded-xl shadow-sm border border-blue-100/80 outline outline-1 outline-blue-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
          <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest mb-1 group-hover:text-blue-700 transition-colors">Mean WQI</span>
          <span className="text-2xl font-bold text-blue-900 drop-shadow-sm">{summary.mean.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3.5 flex-1 bg-gradient-to-br from-red-50/60 to-red-100/60 rounded-xl shadow-sm border border-red-100/80 outline outline-1 outline-red-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
          <span className="text-[10px] font-bold text-red-600/80 uppercase tracking-widest mb-1 group-hover:text-red-700 transition-colors">Max WQI</span>
          <span className="text-2xl font-bold text-red-900 drop-shadow-sm">{summary.max.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3.5 flex-1 bg-gradient-to-br from-green-50/60 to-green-100/60 rounded-xl shadow-sm border border-green-100/80 outline outline-1 outline-green-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default group">
          <span className="text-[10px] font-bold text-green-600/80 uppercase tracking-widest mb-1 group-hover:text-green-700 transition-colors">Min WQI</span>
          <span className="text-2xl font-bold text-green-900 drop-shadow-sm">{summary.min.toFixed(2)}</span>
        </div>
      </div>

      <div className="p-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-2 flex justify-between items-center">
          <span>Class Distribution</span>
          {selectedClass ? (
            <button
              onClick={() => onSelectClass(null)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              Show All
            </button>
          ) : (
            <span className="font-normal text-gray-400 italic normal-case">Select to filter map</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {WQI_CLASSES.map((cls) => {
            const count = summary.countByClass[cls.name] || 0;
            if (count === 0) return null;

            const isSelected = selectedClass === cls.name;
            const isDimmed = !!selectedClass && !isSelected;

            return (
              <button
                key={cls.name}
                onClick={() => onSelectClass(isSelected ? null : cls.name)}
                className={`w-full sm:w-[calc(50%-0.25rem)] flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 overflow-hidden relative group`}
                style={{
                  backgroundColor: isSelected ? `${cls.color}25` : '#ffffff',
                  borderColor: isSelected ? cls.color : '#e5e7eb',
                  opacity: isDimmed ? 0.4 : 1,
                  filter: isDimmed ? 'grayscale(0.8)' : 'none'
                }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                  style={{ backgroundColor: cls.color }}
                />
                <div className="flex items-center gap-2.5 relative z-10">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: cls.color }} />
                  <span className="font-bold tracking-tight text-sm" style={{ color: isSelected ? cls.color : "#4b5563" }}>{cls.name}</span>
                </div>
                <span className={`text-[11px] font-black tracking-wide px-2 py-0.5 rounded-md relative z-10 ${isSelected ? "text-white shadow-sm" : cls.text + " " + cls.badge}`} style={{ backgroundColor: isSelected ? cls.color : undefined }}>{count} pts</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex flex-col gap-3">
          {wqiRaster ? (
            <button
              onClick={onDownloadReport}
              disabled={isDownloadingReport}
              aria-busy={isDownloadingReport}
              className={`w-full py-2.5 px-4 rounded-xl font-bold tracking-tight text-white transition-all duration-300 flex items-center justify-center gap-2 border
                ${isDownloadingReport
                  ? "bg-purple-300 border-purple-300 cursor-wait"
                  : "bg-gradient-to-r from-purple-600 to-purple-500 border-purple-600 hover:from-purple-700 hover:to-purple-600 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 cursor-pointer"
                }`}
            >
              {isDownloadingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Full PDF Report
                </>
              )}
            </button>
          ) : validPoints > 0 ? (
            <div className="text-center py-2 text-sm text-gray-500 italic">Report not available. No raster overlay exists.</div>
          ) : null}
        </div>
      </div>
    </div >
  );
};

export default WqiSummaryTable;
