'use client';

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Plotly from 'plotly.js-dist-min';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LegendClass {
  class: number;
  color: string;
  min: number;
  max: number;
  label: string;
}

interface LegendData {
  layer_name: string;
  product_type: string;
  region_min: number;
  region_max: number;
  region_mean: number;
  num_classes: number;
  classes: LegendClass[];
}

interface ClassPixelCount {
  class: number;
  color: string;
  label: string;
  swci_range?: string;
  min?: number;
  max?: number;
  pixel_count: number;
  percentage?: number;
}

interface ClippedRaster {
  year: number;
  layer_name?: string;
  workspace?: string;
  original_name?: string;
  volume_MLD?: number;
  pixel_count?: number;
  invalid_count?: number;
  legend_data?: LegendData;
  class_pixel_counts?: ClassPixelCount[];
  season?: string;
  aggregation?: string;
}

interface RasterResponse {
  status: string;
  clipped_rasters: ClippedRaster[];
  metadata?: {
    product_type?: string;
    time_scale?: string;
    season?: string;
  };
}

interface IndexChartProps {
  rasterResponse: RasterResponse | null;
  activeYear?: number | null;
  onYearChange?: (year: number) => void;
  timeScale?: string;
  currentRaster?: Partial<ClippedRaster> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PIXEL_COUNT_MULTIPLIER = 0.25;
const FAST_M_BASE_URL = process.env.NEXT_PUBLIC_FAST_URL || '/fastapi';

const getAdjustedPixelCount = (pixelCount?: number) =>
  (pixelCount ?? 0) * PIXEL_COUNT_MULTIPLIER;

const computeClassShares = (
  raster: ClippedRaster
): { label: string; color: string; pct: number }[] => {
  const classCounts = (raster.class_pixel_counts ?? [])
    .filter(
      (item) =>
        item.class >= 1 &&
        item.class <= 10 &&
        Number.isFinite(item.pixel_count) &&
        (item.pixel_count ?? 0) > 0
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
    (c) => c.min !== 9999 && c.max !== 9999
  );
  if (validClasses.length === 0) return [];

  const mean       = legendData.region_mean;
  const totalRange = legendData.region_max - legendData.region_min || 1;
  const sigma      = totalRange / 3;

  const weights = validClasses.map((c) => {
    const mid        = (c.min + c.max) / 2;
    const rangeWidth = c.max - c.min;
    const gaussian   = Math.exp(-0.5 * Math.pow((mid - mean) / sigma, 2));
    return rangeWidth * gaussian;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

  return validClasses.map((c, i) => ({
    label: c.label,
    color: c.color,
    pct:   (weights[i] / totalWeight) * 100,
  }));
};

// ─── CSV Download ─────────────────────────────────────────────────────────────

const escapeCSVCell = (value: string | number) => {
  const stringValue = String(value ?? '');
  const escapedValue = stringValue.replace(/"/g, '""');
  return `"${escapedValue}"`;
};

const toExcelSafeText = (value?: string) => {
  if (!value) return '';
  return `'${value}`;
};

const getClassPercentageMap = (raster: ClippedRaster) => {
  const classCounts = (raster.class_pixel_counts ?? []).filter(
    (item) =>
      item.class >= 1 &&
      item.class <= 10 &&
      Number.isFinite(item.pixel_count) &&
      (item.pixel_count ?? 0) > 0
  );

  const totalPixelCount =
    classCounts.reduce((sum, item) => sum + (item.pixel_count ?? 0), 0) || 1;

  return new Map(
    classCounts.map((item) => [
      item.class,
      ((item.pixel_count ?? 0) / totalPixelCount) * 100,
    ])
  );
};

const downloadCSV = (raster: ClippedRaster | null) => {
  if (!raster) return;

  const classPercentageMap = getClassPercentageMap(raster);
  const metaLines = [
    `Product: Index`,
    `Exported on: ${new Date().toLocaleDateString('en-IN')}`,
    `Year: ${raster.year}`,
    `*SWCI: Soil Water Content Index`,
    '',
  ];
  const header = 'Class,Class Name,SWCI Range,Area (Km\u00B2),Area(%)';
  const rows   = (raster.class_pixel_counts ?? []).map((item) =>
    [
      item.class,
      escapeCSVCell(item.label),
      escapeCSVCell(toExcelSafeText(item.swci_range)),
      getAdjustedPixelCount(item.pixel_count),
      escapeCSVCell(`${(classPercentageMap.get(item.class) ?? 0).toFixed(2)}%`),
    ].join(',')
  );
  const csvContent = [...metaLines, header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF', csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `Index_Class_Pixel_Count_${raster.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'clipped_raster';

const buildTiffFilename = (productType: string, raster: ClippedRaster) =>
  sanitizeFilename(
    [productType, raster.season && raster.season !== 'Annual' ? raster.season : null, raster.year]
      .filter(Boolean)
      .join('_')
  );

const downloadTIFF = async (
  raster: ClippedRaster | null,
  productType: string
) => {
  if (!raster?.layer_name || !raster.workspace) return;

  const fileName = buildTiffFilename(productType, raster);
  const query = new URLSearchParams({
    layer_name: raster.layer_name,
    workspace: raster.workspace,
    filename: fileName,
    format: 'tiff',
  });
  const response = await fetch(
    `${FAST_M_BASE_URL}/water/download_raster?${query.toString()}`,
    {
      credentials: 'include',
    }
  );

  if (!response.ok) {
    let errorMessage = `TIFF download failed (${response.status})`;

    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.error === 'string') {
        errorMessage = errorPayload.error;
      }
    } catch {
      // Keep fallback message if JSON parsing fails.
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${fileName}.tif`;
  link.click();
  URL.revokeObjectURL(blobUrl);
};

// ─── Donut Chart ──────────────────────────────────────────────────────────────

const DonutChart: React.FC<{
  raster: ClippedRaster | null;
  year: number | null;
}> = ({ raster, year }) => {
  const plotRef = useRef<HTMLDivElement>(null);

  const shares = useMemo(() => {
    if (!raster) return [];
    return computeClassShares(raster);
  }, [raster]);

  const visibleShares = useMemo(
    () => shares.filter((share) => share.pct > 0.05),
    [shares]
  );

  useEffect(() => {
    if (!plotRef.current || visibleShares.length === 0) return;

    const trace: Plotly.Data = {
      type: 'pie',
      hole: 0.56,
      values: visibleShares.map((s) => parseFloat(s.pct.toFixed(2))),
      labels: visibleShares.map((s) => s.label),
      marker: {
        colors: visibleShares.map((s) => s.color),
        line:   { color: '#f8fafc', width: 2.4 },
      },
      textinfo:       'percent',
      textposition:   'outside',
      textfont:       { size: 11, color: '#334155' },
      automargin:     true,
      hovertemplate:
        '<b>%{label}</b><br>Share: <b>%{percent}</b><extra></extra>',
      hoverlabel: {
        bgcolor: '#ffffff',
        bordercolor: '#cbd5e1',
        font: { color: '#0f172a', size: 12 },
      },
      sort:      false,
      direction: 'clockwise',
    };

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor:  'rgba(0,0,0,0)',
      margin:        { t: 18, r: 28, b: 18, l: 28 },
      showlegend:    false,
      annotations: [
        {
          text: year ? `<b>${year}</b>` : '',
          x:        0.5,
          y:        0.5,
          xanchor:  'center',
          yanchor:  'middle',
          showarrow: false,
          font:     { size: 15, color: '#0f172a' },
        },
      ],
    };

    Plotly.newPlot(plotRef.current, [trace], layout, {
      responsive:      true,
      displayModeBar:  false,
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  }, [visibleShares, year]);

  if (visibleShares.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-gray-400 text-xs">
        No legend data for {year}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Donut */}
      <div ref={plotRef} className="w-full h-48" />
    </div>
  );
};

// ─── Histogram ────────────────────────────────────────────────────────────────

const IndexHistogram: React.FC<{
  year:          number | null;
  data:          ClassPixelCount[];
}> = ({ year, data }) => {
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
      type: 'bar',
      marker: {
        color: classMeta.map((item) => item.color),
        line: { color: '#ffffff', width: 1 },
      },
      hovertext: classMeta.map((item) => {
        const adjustedPixelCount = getAdjustedPixelCount(item.pixel_count);
        return `<b>Year:</b> ${year ?? ''}<br><b>Class:</b> ${item.class}<br><b>${item.label}</b><br><b>Area (km²):</b> ${adjustedPixelCount.toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        })}`;
      }),
      hoverinfo: 'text',
    };

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor:  'rgba(0,0,0,0)',
      font:          { family: 'IBM Plex Sans, sans-serif', color: '#374151' },
      margin:        { t: 30, r: 20, b: 112, l: 60 },
      xaxis: {
        title:    { text: 'Class', font: { size: 11 } },
        showgrid: false,
        tickfont: { size: 10 },
      },
      yaxis: {
        title:     { text: 'Area (km²)', font: { size: 11 } },
        showgrid:  true,
        gridcolor: '#e5e7eb',
        tickfont:  { size: 10 },
        zeroline:  false,
        rangemode: 'tozero',
      },
      annotations: year
        ? [{
            x: 1,
            y: 1.08,
            xref: 'paper',
            yref: 'paper',
            text: `Selected Year ${year}`,
            showarrow: false,
            xanchor: 'right',
            font: { size: 10, color: '#1d4ed8' },
          }]
        : [],
      bargap:     0.3,
      showlegend: false,
    };

    Plotly.newPlot(plotRef.current, [trace], layout, {
      responsive:     true,
      displayModeBar: false,
    });

    return () => { if (plotRef.current) Plotly.purge(plotRef.current); };
  }, [data, year]);

  return <div ref={plotRef} className="w-full h-72" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const IndexChart: React.FC<IndexChartProps> = ({
  rasterResponse,
  activeYear,
  onYearChange,
  timeScale = 'yearly',
  currentRaster = null,
}) => {
  const allData = useMemo(() => {
    if (!rasterResponse?.clipped_rasters?.length) return [];
    return [...rasterResponse.clipped_rasters].sort((a, b) => a.year - b.year);
  }, [rasterResponse]);

  const availableYears = useMemo(
    () => allData.map((r) => r.year),
    [allData]
  );

  // Active raster driven by activeYear prop (controlled from parent)
  const activeRaster = useMemo(
    () =>
      activeYear
        ? allData.find((r) => r.year === activeYear) ?? allData[0] ?? null
        : allData[0] ?? null,
    [allData, activeYear]
  );
  const downloadRaster = useMemo(
    () =>
      currentRaster?.layer_name && currentRaster?.workspace
        ? ({ ...(activeRaster ?? {}), ...currentRaster } as ClippedRaster)
        : activeRaster,
    [activeRaster, currentRaster]
  );

  const displayYear = activeRaster?.year ?? null;
  const histogramData = useMemo(
    () => activeRaster?.class_pixel_counts ?? [],
    [activeRaster]
  );
  const [isTiffDownloading, setIsTiffDownloading] = useState(false);

  const handleCSV = useCallback(() => downloadCSV(activeRaster), [activeRaster]);
  const handleTIFF = useCallback(async () => {
    if (isTiffDownloading) return;

    try {
      setIsTiffDownloading(true);
      await downloadTIFF(downloadRaster, 'Index');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to download TIFF file.';
      console.error(message);
      window.alert(message);
    } finally {
      setIsTiffDownloading(false);
    }
  }, [downloadRaster, isTiffDownloading]);

  if (!rasterResponse || allData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 flex items-center justify-center h-40 text-gray-400 text-sm">
        No index data available — process a raster first.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>📊</span>
            Index Analysis
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {timeScale === 'seasonal'
              ? `Seasonal · ${rasterResponse.metadata?.season ?? ''}`
              : 'Annual'} · {allData[0]?.year}–{allData[allData.length - 1]?.year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTIFF}
            disabled={
              !downloadRaster?.layer_name ||
              !downloadRaster?.workspace ||
              isTiffDownloading
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
                       bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:bg-blue-300 disabled:cursor-not-allowed
                       transition-all duration-150 shadow-sm whitespace-nowrap"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {isTiffDownloading ? 'Downloading TIF...' : 'Download TIF'}
          </button>

          <button
            onClick={handleCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer
                       bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95
                       transition-all duration-150 shadow-sm whitespace-nowrap"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Download CSV
          </button>
        </div>
      </div>

      {/* ── Two Column: Donut | Histogram ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT — Donut + Radio Buttons */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">

          {/* Section title */}
          <div className="mb-2">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Class Distribution
            </p>
            <p className="text-[10px] text-blue-400 mt-0.5">
              Showing Year {displayYear}
            </p>
          </div>

          {/* Donut */}
          <DonutChart raster={activeRaster} year={displayYear} />

          {/* ── Year Radio Buttons ── */}
          {availableYears.length > 1 && onYearChange && (
            <div className="pt-3 mt-1 border-t border-blue-200">
              <p className="text-[10px] font-semibold text-blue-500 mb-2 uppercase tracking-widest">
                Select Year
              </p>
              <div className="grid grid-cols-5 gap-x-2 gap-y-2">
                {availableYears.map((y) => {
                  const isActive = (activeYear ?? displayYear) === y;
                  return (
                    <label
                      key={y}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
                      {/* Hidden native radio */}
                      <input
                        type="radio"
                        name="index-year"
                        value={y}
                        checked={isActive}
                        onChange={() => onYearChange(y)}
                        className="sr-only"
                      />

                      {/* Custom circle */}
                      <span
                        className={`
                          w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center
                          transition-all duration-150 flex-shrink-0
                          ${isActive
                            ? 'border-blue-600 bg-white'
                            : 'border-blue-300 bg-white group-hover:border-blue-500'}
                        `}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 block" />
                        )}
                      </span>

                      {/* Year label */}
                      <span
                        className={`
                          text-[11px] font-medium transition-colors duration-150
                          ${isActive
                            ? 'text-blue-700 font-semibold'
                            : 'text-blue-400 group-hover:text-blue-600'}
                        `}
                      >
                        {y}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Histogram */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Selected Year Class Area (km²)
            </p>
            
          </div>
          <IndexHistogram
            year={displayYear}
            data={histogramData}
          />
        </div>
      </div>
    </div>
  );
};

export default IndexChart;
