"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import { WaterRasterLayer, WaterRasterResponse } from "../services/waterApi";

interface WaterMLDGraphProps {
  rasterResponse: WaterRasterResponse | null;
  timeScale: string;
  productType: string;
  activeYear?: number | null;
  currentRaster?: WaterRasterLayer | null;
}

const FAST_M_BASE_URL = process.env.NEXT_PUBLIC_FAST_URL || "/fastapi";

const downloadCSV = (
  data: { year: string; mld: number }[],
  productType: string,
  timeScale: string,
  season?: string,
) => {
  const metaLines = [
    `Product: ${productType}`,
    `Time Scale: ${timeScale === "seasonal" ? `Seasonal - ${season ?? ""}` : "Annual"}`,
    `Exported on: ${new Date().toLocaleDateString("en-IN")}`,
    `Range: ${data[0]?.year} - ${data[data.length - 1]?.year}`,
    "",
  ];
  const header = `Year,${productType} (MLD)`;
  const rows = data.map((item) => `${item.year},${item.mld.toFixed(4)}`);

  const blob = new Blob([[...metaLines, header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${productType.replace(/\s+/g, "_")}_MLD_${data[0]?.year}_${data[data.length - 1]?.year}.csv`;
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

export default function WaterMLDGraph({
  rasterResponse,
  timeScale,
  productType,
  activeYear = null,
  currentRaster = null,
}: WaterMLDGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [isTiffDownloading, setIsTiffDownloading] = useState(false);

  const data = useMemo(() => {
    if (!rasterResponse?.clipped_rasters?.length) return [];

    return [...rasterResponse.clipped_rasters]
      .filter(
        (raster) =>
          raster.volume_MLD !== null && raster.volume_MLD !== undefined,
      )
      .sort((a, b) => a.year - b.year)
      .map((raster) => ({
        year: String(raster.year),
        mld: raster.volume_MLD ?? 0,
      }));
  }, [rasterResponse]);

  const avg = useMemo(
    () => (data.length ? data.reduce((sum, item) => sum + item.mld, 0) / data.length : null),
    [data],
  );

  const peakVal = useMemo(
    () => (data.length ? Math.max(...data.map((item) => item.mld)) : 0),
    [data],
  );
  const lowestVal = useMemo(
    () => (data.length ? Math.min(...data.map((item) => item.mld)) : 0),
    [data],
  );
  const peakYear = useMemo(
    () => data.find((item) => item.mld === peakVal)?.year,
    [data, peakVal],
  );
  const lowestYear = useMemo(
    () => data.find((item) => item.mld === lowestVal)?.year,
    [data, lowestVal],
  );
  const isSinglePoint = data.length === 1;

  const activeRaster = useMemo(() => {
    if (activeYear !== null) {
      return (
        rasterResponse?.clipped_rasters?.find((raster) => raster.year === activeYear) ??
        rasterResponse?.clipped_rasters?.[0] ??
        null
      );
    }

    return rasterResponse?.clipped_rasters?.[0] ?? null;
  }, [activeYear, rasterResponse]);

  const downloadRaster = useMemo(() => {
    if (currentRaster?.layer_name && currentRaster?.workspace) {
      return { ...(activeRaster ?? {}), ...currentRaster } as WaterRasterLayer;
    }

    return activeRaster;
  }, [activeRaster, currentRaster]);

  useEffect(() => {
    if (!plotRef.current || data.length === 0) return;

    const years = data.map((item) => item.year);
    const mlds = data.map((item) => item.mld);

    const trace: Plotly.Data = {
      x: years,
      y: mlds,
      type: isSinglePoint ? "bar" : "scatter",
      mode: isSinglePoint ? undefined : "lines+markers",
      name: `${productType} (MLD)`,
      fill: isSinglePoint ? undefined : "tozeroy",
      fillcolor: isSinglePoint ? undefined : "rgba(14,116,144,0.10)",
      line: isSinglePoint ? undefined : { color: "#0e7490", width: 2.5, shape: "spline" },
      marker: isSinglePoint
        ? {
            color: "#0e7490",
            line: { color: "#ffffff", width: 1.5 },
          }
        : {
            size: mlds.map((value) => (value === peakVal || value === lowestVal ? 12 : 7)),
            color: mlds.map((value) =>
              value === peakVal ? "#0e7490" : value === lowestVal ? "#b45309" : "#0e7490",
            ),
            line: { color: "#ffffff", width: 2 },
          },
      text: isSinglePoint ? mlds.map((value) => `${value.toFixed(1)} MLD`) : undefined,
      textposition: isSinglePoint ? "outside" : undefined,
      hovertemplate: "<b>Year:</b> %{x}<br><b>Volume:</b> %{y:,.2f} MLD<extra></extra>",
    };

    const avgShape: Partial<Plotly.Shape> =
      avg !== null
        ? {
            type: "line",
            x0: years[0],
            x1: years[years.length - 1],
            y0: avg,
            y1: avg,
            line: { color: "#0f766e", width: 1.5, dash: "dash" },
          }
        : {};

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "IBM Plex Sans, sans-serif", color: "#374151" },
      margin: { t: 20, r: 20, b: 70, l: 60 },
      xaxis: {
        title: { text: "Year", font: { size: 12 } },
        showgrid: true,
        gridcolor: "#e5e7eb",
        tickfont: { size: 12 },
        zeroline: false,
        tickmode: "array",
        tickvals: years.map(Number),
        ticktext: years,
        dtick: 1,
      },
      yaxis: {
        title: { text: "Volume (MLD)", font: { size: 12 } },
        showgrid: true,
        gridcolor: "#e5e7eb",
        tickfont: { size: 12 },
        zeroline: false,
        rangemode: "tozero",
        range: isSinglePoint ? [0, (mlds[0] ?? 0) * 1.35] : undefined,
      },
      shapes: !isSinglePoint && avg !== null ? [avgShape as Plotly.Shape] : [],
      annotations: [
        ...(!isSinglePoint && avg !== null
          ? [
              {
                x: years[years.length - 1],
                y: avg,
                xanchor: "right" as const,
                yanchor: "bottom" as const,
                text: `Avg: ${avg.toFixed(1)} MLD`,
                showarrow: false,
                font: { size: 10, color: "#0f766e" },
              },
            ]
          : []),
        ...(!isSinglePoint && peakYear
          ? [
              {
                x: peakYear,
                y: peakVal,
                xanchor: "center" as const,
                yanchor: "bottom" as const,
                text: "Peak",
                showarrow: false,
                font: { size: 9, color: "#0e7490" },
                yshift: 6,
              },
            ]
          : []),
        ...(!isSinglePoint && lowestYear
          ? [
              {
                x: lowestYear,
                y: lowestVal,
                xanchor: "center" as const,
                yanchor: "top" as const,
                text: "Lowest",
                showarrow: false,
                font: { size: 9, color: "#b45309" },
                yshift: -6,
              },
            ]
          : []),
      ],
      showlegend: !isSinglePoint,
      legend: { orientation: "h", y: -0.28, x: 0.5, xanchor: "center" },
      bargap: isSinglePoint ? 0.6 : undefined,
    };

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toImage"],
      modeBarButtonsToAdd: [
        {
          name: "Download PNG",
          title: "Download PNG" as any,
          icon: Plotly.Icons.camera,
          click: async (gd: Plotly.PlotlyHTMLElement) => {
            await Plotly.relayout(gd, {
              paper_bgcolor: "#ffffff",
              plot_bgcolor: "#ffffff",
            });
            await Plotly.downloadImage(gd, {
              format: "png",
              width: 1200,
              height: 600,
              filename: `${productType.replace(/\s+/g, "_")}_MLD_chart`,
            });
            await Plotly.relayout(gd, {
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
            });
          },
        },
      ],
      displaylogo: false,
    };

    Plotly.newPlot(plotRef.current, [trace], layout, config);

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [avg, data, isSinglePoint, lowestVal, lowestYear, peakVal, peakYear, productType]);

  const handleCSVDownload = useCallback(() => {
    downloadCSV(data, productType, timeScale, rasterResponse?.metadata?.season);
  }, [data, productType, rasterResponse, timeScale]);

  const handleTiffDownload = useCallback(async () => {
    if (isTiffDownloading) return;

    try {
      setIsTiffDownloading(true);
      await downloadTIFF(downloadRaster, productType);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download TIFF file.";
      console.error(message);
      window.alert(message);
    } finally {
      setIsTiffDownloading(false);
    }
  }, [downloadRaster, isTiffDownloading, productType]);

  if (!rasterResponse || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-sm text-gray-400 shadow-sm">
        No data available - process a water raster first.
      </div>
    );
  }

  const rangeLabel =
    data.length === 1 ? data[0]?.year : `${data[0]?.year}-${data[data.length - 1]?.year}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            {productType} - Year-wise MLD
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {timeScale === "seasonal"
              ? `Seasonal - ${rasterResponse.metadata?.season ?? ""}`
              : "Annual"}{" "}
            - {rangeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTiffDownload}
            title="Download raster as TIF"
            disabled={!downloadRaster?.layer_name || !downloadRaster?.workspace || isTiffDownloading}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-sky-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isTiffDownloading ? "Downloading TIF..." : "Download TIF"}
          </button>

          <button
            onClick={handleCSVDownload}
            title="Download data as CSV"
            className="cursor-pointer whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition-all duration-150 hover:bg-sky-100 active:scale-95"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div ref={plotRef} className="mt-2 h-64 w-full" />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          {
            label: "Peak",
            value: peakVal,
            year: peakYear,
            bg: "bg-sky-50",
            border: "border-sky-200",
            labelColor: "text-sky-600",
            valueColor: "text-sky-800",
            unitColor: "text-sky-500",
            dot: "bg-sky-600",
          },
          {
            label: "Lowest",
            value: lowestVal,
            year: lowestYear,
            bg: "bg-amber-50",
            border: "border-amber-200",
            labelColor: "text-amber-600",
            valueColor: "text-amber-800",
            unitColor: "text-amber-500",
            dot: "bg-amber-500",
          },
          {
            label: "Average",
            value: avg ?? 0,
            year: undefined,
            bg: "bg-teal-50",
            border: "border-teal-200",
            labelColor: "text-teal-600",
            valueColor: "text-teal-800",
            unitColor: "text-teal-500",
            dot: "bg-teal-500",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`${item.bg} ${item.border} rounded-lg border px-3 py-2 text-center`}
          >
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${item.dot}`} />
              <p className={`text-xs font-semibold uppercase tracking-wide ${item.labelColor}`}>
                {item.label}
              </p>
            </div>
            <p className={`text-sm font-bold ${item.valueColor}`}>
              {item.value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
              <span className={`ml-1 text-xs font-normal ${item.unitColor}`}>MLD</span>
            </p>
            {item.year && <p className={`mt-0.5 text-xs ${item.labelColor}`}>({item.year})</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
