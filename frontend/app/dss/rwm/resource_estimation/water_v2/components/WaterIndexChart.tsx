"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import { WaterRasterLayer, WaterRasterResponse } from "../services/waterApi";

interface WaterIndexChartProps {
  rasterResponse: WaterRasterResponse | null;
  activeYear?: number | null;
  onYearChange?: (year: number) => void;
  timeScale?: string;
  currentRaster?: WaterRasterLayer | null;
}

type ShareItem = {
  color: string;
  label: string;
  pct: number;
};

const PIXEL_COUNT_MULTIPLIER = 0.25;
const FAST_M_BASE_URL = process.env.NEXT_PUBLIC_FAST_URL || "/fastapi";

const getAdjustedPixelCount = (pixelCount?: number) =>
  (pixelCount ?? 0) * PIXEL_COUNT_MULTIPLIER;

const computeClassShares = (raster: WaterRasterLayer): ShareItem[] => {
  const classCounts = (raster.class_pixel_counts ?? [])
    .filter(
      (item) =>
        item.class >= 1 &&
        item.class <= 10 &&
        Number.isFinite(item.pixel_count) &&
        (item.pixel_count ?? 0) > 0,
    )
    .sort((a, b) => a.class - b.class);

  if (classCounts.length > 0) {
    const totalPixelCount =
      classCounts.reduce((sum, item) => sum + (item.pixel_count ?? 0), 0) || 1;

    return classCounts.map((item) => ({
      label: item.label,
      color: item.color,
      pct: ((item.pixel_count ?? 0) / totalPixelCount) * 100,
    }));
  }

  const legendData = raster.legend_data;
  if (!legendData) return [];

  const validClasses = legendData.classes.filter(
    (item) => item.min !== 9999 && item.max !== 9999,
  );
  if (validClasses.length === 0) return [];

  const mean = legendData.region_mean;
  const totalRange = legendData.region_max - legendData.region_min || 1;
  const sigma = totalRange / 3;

  const weights = validClasses.map((item) => {
    const mid = (item.min + item.max) / 2;
    const rangeWidth = item.max - item.min;
    const gaussian = Math.exp(-0.5 * Math.pow((mid - mean) / sigma, 2));
    return rangeWidth * gaussian;
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return validClasses.map((item, index) => ({
    label: item.label,
    color: item.color,
    pct: (weights[index] / totalWeight) * 100,
  }));
};

const escapeCSVCell = (value: string | number) => {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue.replace(/"/g, '""');
  return `"${escapedValue}"`;
};

const toExcelSafeText = (value?: string) => {
  if (!value) return "";
  return `'${value}`;
};

const getClassPercentageMap = (raster: WaterRasterLayer) => {
  const classCounts = (raster.class_pixel_counts ?? []).filter(
    (item) =>
      item.class >= 1 &&
      item.class <= 10 &&
      Number.isFinite(item.pixel_count) &&
      (item.pixel_count ?? 0) > 0,
  );

  const totalPixelCount =
    classCounts.reduce((sum, item) => sum + (item.pixel_count ?? 0), 0) || 1;

  return new Map(
    classCounts.map((item) => [
      item.class,
      ((item.pixel_count ?? 0) / totalPixelCount) * 100,
    ]),
  );
};

const downloadCSV = (raster: WaterRasterLayer | null) => {
  if (!raster) return;

  const classPercentageMap = getClassPercentageMap(raster);
  const metaLines = [
    "Product: Index",
    `Exported on: ${new Date().toLocaleDateString("en-IN")}`,
    `Year: ${raster.year}`,
    "*SWCI: Soil Water Content Index",
    "",
  ];
  const header = "Class,Class Name,SWCI Range,Area (Km2),Area(%)";
  const rows = (raster.class_pixel_counts ?? []).map((item) =>
    [
      item.class,
      escapeCSVCell(item.label),
      escapeCSVCell(toExcelSafeText(item.swci_range)),
      getAdjustedPixelCount(item.pixel_count),
      escapeCSVCell(`${(classPercentageMap.get(item.class) ?? 0).toFixed(2)}%`),
    ].join(","),
  );

  const csvContent = [...metaLines, header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Index_Class_Pixel_Count_${raster.year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "clipped_raster";

const buildTiffFilename = (productType: string, raster: WaterRasterLayer) =>
  sanitizeFilename(
    [
      productType,
      raster.season && raster.season !== "Annual" ? raster.season : null,
      raster.year,
    ]
      .filter(Boolean)
      .join("_"),
  );

const downloadTIFF = async (
  raster: WaterRasterLayer | null,
  productType: string,
) => {
  if (!raster?.layer_name || !raster.workspace) return;

  const fileName = buildTiffFilename(productType, raster);
  const query = new URLSearchParams({
    layer_name: raster.layer_name,
    workspace: raster.workspace,
    filename: fileName,
    format: "tiff",
  });

  const response = await fetch(
    `${FAST_M_BASE_URL}/water/download_raster?${query.toString()}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    let errorMessage = `TIFF download failed (${response.status})`;

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.error === "string") {
        errorMessage = errorPayload.error;
      }
    } catch {
      // Keep fallback message if JSON parsing fails.
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${fileName}.tif`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};

function DonutChart({
  raster,
  year,
}: {
  raster: WaterRasterLayer | null;
  year: number | null;
}) {
  const plotRef = useRef<HTMLDivElement>(null);

  const shares = useMemo(() => {
    if (!raster) return [];
    return computeClassShares(raster);
  }, [raster]);

  const visibleShares = useMemo(
    () => shares.filter((share) => share.pct > 0.05),
    [shares],
  );

  useEffect(() => {
    if (!plotRef.current || visibleShares.length === 0) return;

    const trace: Plotly.Data = {
      type: "pie",
      hole: 0.56,
      values: visibleShares.map((share) => parseFloat(share.pct.toFixed(2))),
      labels: visibleShares.map((share) => share.label),
      marker: {
        colors: visibleShares.map((share) => share.color),
        line: { color: "#f8fafc", width: 2.4 },
      },
      textinfo: "percent",
      textposition: "outside",
      textfont: { size: 11, color: "#334155" },
      automargin: true,
      hovertemplate: "<b>%{label}</b><br>Share: <b>%{percent}</b><extra></extra>",
      hoverlabel: {
        bgcolor: "#ffffff",
        bordercolor: "#cbd5e1",
        font: { color: "#0f172a", size: 12 },
      },
      sort: false,
      direction: "clockwise",
    };

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { t: 18, r: 28, b: 18, l: 28 },
      showlegend: false,
      annotations: [
        {
          text: year ? `<b>${year}</b>` : "",
          x: 0.5,
          y: 0.5,
          xanchor: "center",
          yanchor: "middle",
          showarrow: false,
          font: { size: 15, color: "#0f172a" },
        },
      ],
    };

    Plotly.newPlot(plotRef.current, [trace], layout, {
      responsive: true,
      displayModeBar: false,
    });

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [visibleShares, year]);

  if (visibleShares.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-xs text-gray-400">
        No legend data for {year}
      </div>
    );
  }

  return <div ref={plotRef} className="h-48 w-full" />;
}

function IndexHistogram({
  year,
  data,
}: {
  year: number | null;
  data: NonNullable<WaterRasterLayer["class_pixel_counts"]>;
}) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || data.length === 0) return;

    const classMeta = [...data]
      .filter((item) => item.class >= 1 && item.class <= 10)
      .sort((a, b) => a.class - b.class);
    const classLabels = classMeta.map((item) => item.label);

    const trace: Plotly.Data = {
      x: classLabels,
      y: classMeta.map((item) => getAdjustedPixelCount(item.pixel_count)),
      type: "bar",
      marker: {
        color: classMeta.map((item) => item.color),
        line: { color: "#ffffff", width: 1 },
      },
      hovertext: classMeta.map((item) => {
        const adjustedPixelCount = getAdjustedPixelCount(item.pixel_count);
        return `<b>Year:</b> ${year ?? ""}<br><b>Class:</b> ${item.class}<br><b>${item.label}</b><br><b>Area (km2):</b> ${adjustedPixelCount.toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        })}`;
      }),
      hoverinfo: "text",
    };

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "IBM Plex Sans, sans-serif", color: "#374151" },
      margin: { t: 30, r: 20, b: 150, l: 60 },
      xaxis: {
        title: { text: "Class", font: { size: 11 } },
        showgrid: false,
        tickfont: { size: 10 },
        tickangle: 35,
        automargin: true,
      },
      yaxis: {
        title: { text: "Area (km2)", font: { size: 11 } },
        showgrid: true,
        gridcolor: "#e5e7eb",
        tickfont: { size: 10 },
        zeroline: false,
        rangemode: "tozero",
        automargin: true,
      },
      annotations: year
        ? [
            {
              x: 1,
              y: 1.08,
              xref: "paper",
              yref: "paper",
              text: `Selected Year ${year}`,
              showarrow: false,
              xanchor: "right",
              font: { size: 10, color: "#0369a1" },
            },
          ]
        : [],
      bargap: 0.3,
      showlegend: false,
    };

    Plotly.newPlot(plotRef.current, [trace], layout, {
      responsive: true,
      displayModeBar: false,
    });

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [data, year]);

  return <div ref={plotRef} className="h-72 w-full" />;
}

export default function WaterIndexChart({
  rasterResponse,
  activeYear,
  onYearChange,
  timeScale = "yearly",
  currentRaster = null,
}: WaterIndexChartProps) {
  const [isTiffDownloading, setIsTiffDownloading] = useState(false);

  const allData = useMemo(() => {
    if (!rasterResponse?.clipped_rasters?.length) return [];
    return [...rasterResponse.clipped_rasters].sort((a, b) => a.year - b.year);
  }, [rasterResponse]);

  const availableYears = useMemo(() => allData.map((raster) => raster.year), [allData]);

  const activeRaster = useMemo(() => {
    if (activeYear) {
      return allData.find((raster) => raster.year === activeYear) ?? allData[0] ?? null;
    }

    return allData[0] ?? null;
  }, [activeYear, allData]);

  const downloadRaster = useMemo(() => {
    if (currentRaster?.layer_name && currentRaster?.workspace) {
      return { ...(activeRaster ?? {}), ...currentRaster } as WaterRasterLayer;
    }

    return activeRaster;
  }, [activeRaster, currentRaster]);

  const displayYear = activeRaster?.year ?? null;
  const histogramData = useMemo(() => activeRaster?.class_pixel_counts ?? [], [activeRaster]);

  const handleCSV = useCallback(() => {
    downloadCSV(activeRaster);
  }, [activeRaster]);

  const handleTIFF = useCallback(async () => {
    if (isTiffDownloading) return;

    try {
      setIsTiffDownloading(true);
      await downloadTIFF(downloadRaster, "Index");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download TIFF file.";
      console.error(message);
      window.alert(message);
    } finally {
      setIsTiffDownloading(false);
    }
  }, [downloadRaster, isTiffDownloading]);

  if (!rasterResponse || allData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-400 shadow-md">
        No index data available - process a raster first.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Index Analysis
            {displayYear ? (
              <span className="ml-2 text-base font-medium text-sky-600">— Year {displayYear}</span>
            ) : null}
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {timeScale === "seasonal"
              ? `Seasonal - ${rasterResponse.metadata?.season ?? ""}`
              : "Annual"}{" "}
            - {allData[0]?.year}-{allData[allData.length - 1]?.year}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTIFF}
            disabled={!downloadRaster?.layer_name || !downloadRaster?.workspace || isTiffDownloading}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-sky-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isTiffDownloading ? "Downloading TIF..." : "Download TIF"}
          </button>

          <button
            onClick={handleCSV}
            className="cursor-pointer whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition-all duration-150 hover:bg-sky-100 active:scale-95"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-4">
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Class Distribution
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">Showing Year {displayYear}</p>
          </div>

          <div className="mx-auto max-w-md">
            <DonutChart raster={activeRaster} year={displayYear} />
          </div>

          {availableYears.length > 1 && onYearChange && (
            <div className="mt-1 border-t border-sky-100 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Select Year
              </p>
              <div className="grid grid-cols-5 gap-x-2 gap-y-2">
                {availableYears.map((year) => {
                  const isActive = (activeYear ?? displayYear) === year;

                  return (
                    <label
                      key={year}
                      className="group flex cursor-pointer items-center gap-1.5"
                    >
                      <input
                        type="radio"
                        name="index-year"
                        value={year}
                        checked={isActive}
                        onChange={() => onYearChange(year)}
                        className="sr-only"
                      />

                      <span
                        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                          isActive
                            ? "border-sky-700 bg-white"
                            : "border-slate-300 bg-white group-hover:border-sky-500"
                        }`}
                      >
                        {isActive && <span className="block h-1.5 w-1.5 rounded-full bg-sky-700" />}
                      </span>

                      <span
                        className={`text-[11px] font-medium transition-colors duration-150 ${
                          isActive
                            ? "font-semibold text-sky-700"
                            : "text-slate-500 group-hover:text-sky-700"
                        }`}
                      >
                        {year}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Selected Year Class Area (km2)
            </p>
          </div>
          <IndexHistogram year={displayYear} data={histogramData} />
        </div>
      </div>
    </div>
  );
}
