"use client";

import React, { useCallback, useMemo, useState, ReactNode } from "react";
import {
  useChart,
  ProcessedWaterQualityData,
} from "@/contexts/riverwater_assessment/admin/ChartContext";
import { useLocation } from "@/contexts/riverwater_assessment/admin/LocationContext";
import { useMap } from "@/contexts/riverwater_assessment/admin/MapContext";
import toast from "react-hot-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartJSTooltip,
  Legend as ChartJSLegend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import ChartStickyHeader from "./ChartStickyHeader";
import SamplingLocationsTab from "./SamplingLocationsTab";
import LocationTypeSummaryTab from "./LocationTypeSummaryTab";
import SeasonalComparisonTab from "./SeasonalComparisonTab";
import GraphTab from "./GraphTab";
import PdfReportSection from "./PdfReportSection";

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
}

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartJSTooltip,
  ChartJSLegend,
  annotationPlugin,
);

// Update the WQ_PARAMETERS key mapping to match ProcessedWaterQualityData interface
const WQ_PARAMETERS = [
  { key: "ph", label: "pH", unit: "", range: "6.5-8.5" },
  { key: "tds", label: "TDS", unit: "mg/L", range: "≤500" },
  { key: "ec", label: "EC", unit: "μS/cm", range: "" },
  { key: "temperature", label: "Temperature", unit: "°C", range: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU", range: "≤1" },
  {
    key: "dissolvedOxygen",
    label: "Dissolved Oxygen",
    unit: "mg/L",
    range: "≥5",
  },
  { key: "orp", label: "ORP", unit: "mV", range: "" },
  { key: "tss", label: "TSS", unit: "mg/L", range: "" },
  { key: "cod", label: "COD", unit: "mg/L", range: "≤3" },
  { key: "bod", label: "BOD", unit: "mg/L", range: "≤2" },
  { key: "ts", label: "Total Solids", unit: "mg/L", range: "" },
  { key: "chloride", label: "Chloride", unit: "mg/L", range: "≤250" },
  { key: "nitrate", label: "Nitrate", unit: "mg/L", range: "≤45" },
  { key: "hardness", label: "Hardness", unit: "mg/L", range: "≤200" },
  {
    key: "faecalColiform",
    label: "Faecal Coliform",
    unit: "MPN/100ml",
    range: "≤0",
  },
  {
    key: "totalColiform",
    label: "Total Coliform",
    unit: "MPN/100ml",
    range: "≤50",
  },
  {
    key: "wqi",
    label: "Water Quality Index",
  },
];

// Map WQ_PARAMETERS to attributes format
const attributes = WQ_PARAMETERS.map((param) => param.key);
const attributeLabels: Record<string, string> = WQ_PARAMETERS.reduce(
  (acc, param) => {
    acc[param.key] = `${param.label}${param.unit ? ` (${param.unit})` : ""}`;
    return acc;
  },
  {} as Record<string, string>,
);

const CHART_TO_BACKEND_ATTRIBUTE: Record<string, string> = {
  ph: "pH",
  tds: "TDS_mg_L_",
  ec: "EC__S_cm_",
  temperature: "Temperatur",
  turbidity: "Turbidity_",
  dissolvedOxygen: "DO_mg_L_",
  orp: "ORP",
  tss: "TSS_mg_L_",
  cod: "COD_mg_L_",
  bod: "BOD_mg_L_",
  ts: "TS_mg_L_",
  chloride: "Chloride_m",
  nitrate: "Nitrate_mg",
  hardness: "Hardness_m",
  faecalColiform: "Faecal_Col",
  totalColiform: "Total_Coli",
  wqi: "WQI",
};

const sanitizeLayerAttributeToken = (value: string): string =>
  value.replace(/ /g, "_").replace(/[()]/g, "").replace(/\//g, "_");

const extractLayerAttributeToken = (
  layerName: string | null,
  season: string,
  dataType: "subdistbased" | "stretchbased",
): string | null => {
  if (!layerName) return null;
  const bareLayer = layerName.includes(":")
    ? layerName.split(":", 2)[1]
    : layerName;
  const prefix = "interp_";
  const marker = `_${season}_${dataType}_`;

  if (!bareLayer.startsWith(prefix)) return null;
  const markerIndex = bareLayer.indexOf(marker);
  if (markerIndex <= prefix.length) return null;
  return bareLayer.slice(prefix.length, markerIndex);
};

/* 
const attributeLabels = {
  "ph": "pH",
  "tds": "TDS (mg/L)",
  "ec": "EC (μS/cm)",
  "temperature": "Temperature (°C)",
  "turbidity": "Turbidity (NTU)",
  "dissolvedOxygen": "Dissolved Oxygen (mg/L)",
  "orp": "ORP (mV)",
  "tss": "TSS (mg/L)",
  "cod": "COD (mg/L)",
  "bod": "BOD (mg/L)",
  "ts": "Total Solids (mg/L)",
  "chloride": "Chloride (mg/L)",
  "nitrate": "Nitrate (mg/L)",
  "hardness": "Hardness (mg/L)",
  "faecalColiform": "Faecal Coliform (MPN/100ml)",
  "totalColiform": "Total Coliform (MPN/100ml)",
  "wqi": "Water Quality Index"
};*/

// Quality thresholds
const qualityThresholds: Record<string, number> = {
  ph: 8.5,
  tds: 500,
  temperature: 25,
  turbidity: 1,
  dissolvedOxygen: 5,
  chloride: 250,
  nitrate: 50,
  hardness: 300,
};

const borderColors: Record<string, string> = {
  Drain: "rgba(244, 114, 182, 1)",
  Upstream: "rgba(59, 130, 246, 1)",
  Downstream: "rgba(132, 204, 22, 1)",
};

const getWQIInfo = (wqi: string | number | null) => {
  const value = Number(wqi);
  if (!wqi || isNaN(value)) return { label: "N/A", color: "text-gray-400" };
  if (value <= 50) return { label: "Excellent", color: "text-blue-600" };
  if (value <= 100) return { label: "Good", color: "text-green-600" };
  if (value <= 200) return { label: "Poor", color: "text-orange-600" };
  if (value <= 300) return { label: "Very Poor", color: "text-red-600" };
  return { label: "Unsuitable for use", color: "text-red-800" };
};

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  badge,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg transition-all">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group w-full flex items-center justify-between p-5 cursor-pointer select-none transition-colors hover:bg-blue-50/40"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${open ? "bg-blue-500" : "bg-gray-300"
              } group-hover:bg-blue-400`}
          />
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {badge !== undefined && (
            <span className="ml-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              {badge}
            </span>
          )}
        </div>
        <span
          className={`transition-all duration-200 ${open ? "rotate-180 text-blue-500" : "text-gray-400"
            } group-hover:text-blue-400`}
        >
          v
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-full opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
};

const Chart: React.FC = () => {
  const {
    processedChartData,
    isLoadingWaterQuality,
    waterQualityError,
    comparisonTableData,
    isLoadingAllSeasons,
    allSeasonsError,
    selectedAttribute,
    setSelectedAttribute,
  } = useChart();

  const { selectedSubDistricts, areaConfirmed, selectedSeason, waterQualityData } = useLocation();
  const { currentInterpolationLayerName, fetchedData } = useMap();
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<
    "sampling" | "summary" | "seasonal" | "graph" | "report"
  >("sampling");
  const [isRasterDownloading, setIsRasterDownloading] = useState(false);
  // Use selectedSubDistricts as confirmedSubDistricts and empty array as confirmedStretches
  const confirmedSubDistricts = selectedSubDistricts;
  const confirmedStretches: string[] = [];

  // Use processedChartData as filteredData
  const filteredData = processedChartData;

  // Utility function to parse values
  const parseValue = useCallback((value: string | number | null | undefined): number => {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "");
      return parseFloat(cleaned) || 0;
    }
    return parseFloat(value.toString()) || 0;
  }, []);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const values = filteredData
      .map((row) =>
        parseValue(
          row[selectedAttribute as keyof typeof row] as string | number,
        ),
      )
      .filter((v) => v !== 0);

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      count: values.length,
    };
  }, [filteredData, selectedAttribute, parseValue]);

  const wqiMean = useMemo(() => {
    if (processedChartData.length === 0) return null;

    const wqiValues = processedChartData
      .map((item) => parseValue(item["wqi"]))
      .filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

    if (wqiValues.length === 0) return null;

    const mean =
      wqiValues.reduce((sum, val) => sum + val, 0) / wqiValues.length;
    return mean.toFixed(2);
  }, [processedChartData, parseValue]);

  const wqiInfo = useMemo(() => getWQIInfo(wqiMean), [wqiMean]);
  const selectedParameterConfig = WQ_PARAMETERS.find(
    (param) => param.key === selectedAttribute,
  );
  const selectedAttributeLabel =
    attributeLabels[selectedAttribute] || selectedAttribute;
  const selectedAttributeUnit = selectedParameterConfig?.unit;

  const rechartsData = useMemo(
    (): Array<Record<string, string | number | null>> => {
      const groupedBySampling = filteredData.reduce(
        (acc, row) => {
          const sampling = row.sampling || "Unknown";
          if (!acc[sampling]) acc[sampling] = [];
          acc[sampling].push(row);
          return acc;
        },
        {} as Record<string, ProcessedWaterQualityData[]>,
      );

      return Object.keys(groupedBySampling).map((sampling) => {
        const dataPoint: Record<string, string | number | null> = { sampling };
        Object.keys(borderColors).forEach((type) => {
          const matchingRow = groupedBySampling[sampling]?.find(
            (row: { location: string | string[] }) =>
              row.location?.includes(type),
          );
          dataPoint[type] = matchingRow
            ? parseValue(
              matchingRow[selectedAttribute as keyof typeof matchingRow] as
              | string
              | number,
            )
            : null;
        });
        return dataPoint;
      });
    },
    [filteredData, selectedAttribute, parseValue],
  );
  const analysisTabs: Array<{
    key: "sampling" | "summary" | "seasonal" | "graph" | "report";
    label: string;
    badge?: number;
    glow: string;
    icon: string;
  }> = [
      {
        key: "sampling",
        label: "Sampling Locations",
        badge: rechartsData.length,
        glow: "59,130,246",
        icon: "📍",
      },
      {
        key: "summary",
        label: "By Location Type",
        glow: "16,185,129",
        icon: "📊",
      },
      {
        key: "seasonal",
        label: "Seasonal",
        badge: comparisonTableData.length,
        glow: "245,158,11",
        icon: "🔄",
      },
      {
        key: "graph",
        label: "Graph",
        glow: "139,92,246",
        icon: "📈",
      },
      {
        key: "report",
        label: "Report Builder",
        glow: "219,39,119",
        icon: "📄",
      },
    ];
  const activeTabIndex = analysisTabs.findIndex(
    (tab) => tab.key === activeAnalysisTab,
  );
  const tabWidthPercent = 100 / analysisTabs.length;
  const activeTabGlow = analysisTabs[activeTabIndex]?.glow || "59,130,246";
  const isRasterDownloadAvailable =
    areaConfirmed &&
    selectedSubDistricts.length > 0 &&
    !!fetchedData.riverData &&
    !!fetchedData.riverBufferData &&
    !!waterQualityData;

  const handleRasterDownload = async (downloadFormat: "png" | "tiff") => {
    if (isRasterDownloading) return;

    setIsRasterDownloading(true);
    const toastId = toast.loading(
      `Preparing ${downloadFormat.toUpperCase()} raster download...`
    );

    try {
      const targetBackendAttribute =
        CHART_TO_BACKEND_ATTRIBUTE[selectedAttribute] || selectedAttribute;
      const selectedAttributeToken = sanitizeLayerAttributeToken(targetBackendAttribute);
      const seasonForLayer = selectedSeason || "premonsoon";

      let layerForDownload = currentInterpolationLayerName;
      const currentLayerToken = extractLayerAttributeToken(
        currentInterpolationLayerName,
        seasonForLayer,
        "subdistbased",
      );

      if (!layerForDownload || currentLayerToken !== selectedAttributeToken) {
        if (
          selectedSubDistricts.length === 0 ||
          !fetchedData.riverData ||
          !fetchedData.riverBufferData ||
          !waterQualityData
        ) {
          throw new Error(
            "Required data is missing. Please generate interpolation for the selected parameter first.",
          );
        }

        const interpolationResponse = await fetch(
          `/django/rwm/interpolate/${encodeURIComponent(targetBackendAttribute)}/subdistbased/${seasonForLayer}/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              Sub_District_Code: selectedSubDistricts,
              river_data: fetchedData.riverData,
              river_buffer_data: fetchedData.riverBufferData,
              points_data: waterQualityData,
            }),
          },
        );

        if (!interpolationResponse.ok) {
          const interpolationError = await interpolationResponse.text();
          throw new Error(
            `Failed to prepare selected parameter raster (${interpolationResponse.status}): ${interpolationError}`,
          );
        }

        const interpolationPayload = await interpolationResponse.json();
        if (interpolationPayload?.status !== "success" || !interpolationPayload?.primary_layer) {
          throw new Error(
            interpolationPayload?.message || "Interpolation did not return a downloadable raster layer.",
          );
        }
        layerForDownload = interpolationPayload.primary_layer;
      }
      if (!layerForDownload) {
        throw new Error("No raster layer found for the selected parameter.");
      }

      const workspace = layerForDownload.includes(":")
        ? layerForDownload.split(":", 1)[0]
        : "dss_vector";
      const fileExtension = downloadFormat === "png" ? "png" : "tif";
      const safeParam = (selectedAttribute || "interpolation")
        .replace(/[^a-zA-Z0-9._-]+/g, "_");
      const safeSeason = (selectedSeason || "season").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const fileName = `${safeParam}_${safeSeason}_interpolation.${fileExtension}`;
      const url = `/django/rwm/general/download-raster?layer_name=${encodeURIComponent(layerForDownload)}&workspace=${encodeURIComponent(workspace)}&filename=${encodeURIComponent(fileName)}&format=${encodeURIComponent(downloadFormat)}`;

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
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast.success(`${downloadFormat.toUpperCase()} raster download started.`, {
        id: toastId,
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to download raster.", { id: toastId });
    } finally {
      setIsRasterDownloading(false);
    }
  };

  if (isLoadingWaterQuality) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-lg">Loading water quality data...</div>
        </div>
      </div>
    );
  }

  if (waterQualityError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Data</h3>
        <p className="text-red-600">{waterQualityError}</p>
      </div>
    );
  }

  return (
    <>

      <div className="h-full overflow-y-auto">
        {/* Integrated Advanced Charts Section */}
        {(confirmedSubDistricts.length > 0 || confirmedStretches.length > 0) &&
          areaConfirmed && (
            <div className="mb-6">
              <div className="sticky top-0 z-20 bg-slate-50 pb-3">
                <ChartStickyHeader
                  selectedAttribute={selectedAttribute}
                  attributes={attributes}
                  attributeLabels={attributeLabels}
                  onAttributeChange={setSelectedAttribute}
                  stats={stats}
                  wqiMean={wqiMean}
                  wqiInfo={wqiInfo}
                  onDownloadRaster={handleRasterDownload}
                  isRasterDownloadAvailable={isRasterDownloadAvailable}
                  isRasterDownloading={isRasterDownloading}
                />

                <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-md backdrop-blur-md">
                  <div className="relative grid grid-cols-5 items-center rounded-lg bg-gradient-to-r from-slate-50 via-white to-slate-50 p-1">
                    {/* Animated glowing underline */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0.5 z-0 h-[3px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{
                        left: `calc(${activeTabIndex * tabWidthPercent}% + 12px)`,
                        width: `calc(${tabWidthPercent}% - 24px)`,
                        background: `linear-gradient(90deg, rgba(${activeTabGlow}, 0.7), rgba(${activeTabGlow}, 1), rgba(${activeTabGlow}, 0.7))`,
                        boxShadow: `0 0 14px rgba(${activeTabGlow}, 0.8), 0 0 6px rgba(${activeTabGlow}, 0.5)`,
                      }}
                    />
                    {/* Active background highlight */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1 z-0 rounded-lg shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      style={{
                        left: `calc(${activeTabIndex * tabWidthPercent}% + 4px)`,
                        width: `calc(${tabWidthPercent}% - 8px)`,
                        height: "calc(100% - 8px)",
                        background: `linear-gradient(135deg, rgba(${activeTabGlow}, 0.08), rgba(${activeTabGlow}, 0.03))`,
                      }}
                    />
                    {analysisTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveAnalysisTab(tab.key)}
                        className={`group relative z-10 flex min-h-[46px] items-center justify-center gap-1.5 rounded-lg px-1.5 text-center text-[13px] font-semibold transition-all duration-200 cursor-pointer ${activeAnalysisTab === tab.key
                          ? "text-slate-900 scale-[1.03]"
                          : "text-slate-500 hover:text-slate-700 hover:scale-[1.01]"
                          }`}
                      >
                        <span className={`text-sm transition-transform duration-200 ${activeAnalysisTab === tab.key ? "scale-110" : "group-hover:scale-105"
                          }`}>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && (
                          <span
                            className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all duration-200 ${activeAnalysisTab === tab.key
                              ? "text-white shadow-sm"
                              : "text-slate-400"
                              }`}
                            style={activeAnalysisTab === tab.key ? { background: `rgba(${tab.glow}, 0.75)` } : undefined}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {activeAnalysisTab === "sampling" && (
                  <SamplingLocationsTab
                    data={rechartsData}
                    selectedAttribute={selectedAttribute}
                    selectedAttributeLabel={selectedAttributeLabel}
                    selectedAttributeUnit={selectedAttributeUnit}
                    qualityThreshold={qualityThresholds[selectedAttribute]}
                    borderColors={borderColors}
                  />
                )}

                {activeAnalysisTab === "summary" && (
                  <LocationTypeSummaryTab
                    filteredData={filteredData}
                    selectedAttribute={selectedAttribute}
                    selectedAttributeLabel={selectedAttributeLabel}
                    borderColors={borderColors}
                    parseValue={parseValue}
                  />
                )}

                {activeAnalysisTab === "seasonal" && (
                  <SeasonalComparisonTab
                    comparisonTableData={comparisonTableData}
                    selectedAttribute={selectedAttribute}
                    selectedAttributeLabel={selectedAttributeLabel}
                    isLoadingAllSeasons={isLoadingAllSeasons}
                    allSeasonsError={allSeasonsError}
                    borderColors={borderColors}
                  />
                )}

                {activeAnalysisTab === "graph" && (
                  <GraphTab
                    filteredData={filteredData}
                    selectedAttribute={selectedAttribute}
                    selectedAttributeLabel={selectedAttributeLabel}
                    selectedAttributeUnit={WQ_PARAMETERS.find(p => p.key === selectedAttribute)?.unit || ""}
                    borderColors={borderColors}
                    parseValue={parseValue}
                    currentInterpolationLayerName={currentInterpolationLayerName}
                    riverBufferData={fetchedData?.riverBufferData || null}
                  />
                )}

                {activeAnalysisTab === "report" && <PdfReportSection />}
              </div>
            </div>
          )}
        {/* Show message when no data is available */}
        {(!confirmedSubDistricts.length || !areaConfirmed) && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Water Quality Analysis
              </h3>
              <p className="text-gray-500 max-w-md">
                Please select districts and confirm your area selection to view
                water quality charts and analysis.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Chart;
