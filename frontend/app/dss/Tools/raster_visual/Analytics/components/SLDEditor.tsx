"use client";
import React, { useState, useEffect } from "react";
import { ColorStop } from "@/interface/raster_operations";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import { SLDGenerator, CLASSIFICATION_METHODS } from "@/interface/sldGenerator";
import { toast } from "react-toastify";

// ─────────────────────────────────────────────────────────────────────────────
// SLDEditor — TerraOps Light Theme
// ─────────────────────────────────────────────────────────────────────────────

interface ColorSchemeOption {
  id: string;
  name: string;
  preview: string[];
  scheme: string;
}

const COLOR_SCHEMES: ColorSchemeOption[] = [
  {
    id: "sequential-blue",
    name: "Blues",
    scheme: "sequential",
    preview: ["#f7fbff", "#6baed6", "#08306b"],
  },
  {
    id: "sequential-red",
    name: "Reds",
    scheme: "sequential_red",
    preview: ["#fff5f0", "#fb6a4a", "#67000d"],
  },
  {
    id: "sequential-green",
    name: "Greens",
    scheme: "sequential_green",
    preview: ["#f7fcf5", "#74c476", "#00441b"],
  },
  {
    id: "diverging-red-blue",
    name: "RdBu",
    scheme: "diverging",
    preview: ["#d73027", "#ffffbf", "#4575b4"],
  },
  {
    id: "diverging-purple-green",
    name: "PuGn",
    scheme: "diverging_purple_green",
    preview: ["#8e0152", "#fde0ef", "#4d9221"],
  },
  {
    id: "rainbow",
    name: "Spectral",
    scheme: "rainbow",
    preview: ["#9e0142", "#fee08b", "#5e4fa2"],
  },
  {
    id: "terrain",
    name: "Terrain",
    scheme: "terrain",
    preview: ["#333399", "#FFFF99", "#993333"],
  },
  {
    id: "viridis",
    name: "Viridis",
    scheme: "viridis",
    preview: ["#440154", "#31688e", "#fde724"],
  },
  {
    id: "plasma",
    name: "Plasma",
    scheme: "plasma",
    preview: ["#0d0887", "#d8576b", "#f0f921"],
  },
];

type RenderMode = "singleband_pseudocolor" | "singleband_gray";

interface SLDEditorProps {
  onApply: (sldXml: string | null) => void;
  onClose: () => void;
}

// ── Classification break calculators ─────────────────────────────────────────

function equalIntervalBreaks(min: number, max: number, n: number): number[] {
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + step * i);
}

/**
 * Rational approximation of the inverse normal CDF (probit).
 * Gives the z-score for a given probability p ∈ (0, 1).
 * Source: Beasley-Springer-Moro algorithm.
 */
function probit(p: number): number {
  const a = [ 2.50662823884, -18.61500062529,  41.39119773534, -25.44106049637];
  const b = [-8.47351093090,  23.08336743743, -21.06224101826,   3.13082909833];
  const c = [
     0.3374754822726147,  0.9761690190917186,  0.1607979714918209,
     0.0276438810333863,  0.0038405729373609,  0.0003951896511349,
     0.0000321767881768,  0.0000002888167364,  0.0000003960315187,
  ];
  const y = p - 0.5;
  if (Math.abs(y) < 0.42) {
    const r = y * y;
    return y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) /
              ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1);
  }
  const r    = y < 0 ? p : 1 - p;
  const s    = Math.log(-Math.log(r));
  const sign = y < 0 ? -1 : 1;
  return sign * (c[0] + s * (c[1] + s * (c[2] + s * (c[3] + s * (c[4] +
    s * (c[5] + s * (c[6] + s * (c[7] + s * c[8]))))))));
}

function computeClassBreaks(
  method: string,
  min: number,
  max: number,
  mean: number,
  std: number,
  n: number,
): number[] {
  switch (method) {
    case "equal_interval":
      return equalIntervalBreaks(min, max, n);

    case "quantile": {
      // Assuming roughly normal distribution: space breaks by equal probability
      // using the inverse normal CDF (probit).  Dense near mean, wide at tails.
      const clamp = (v: number) => Math.max(min, Math.min(max, v));
      const raw: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = (i + 0.5) / n;
        raw.push(clamp(parseFloat((mean + std * probit(p)).toFixed(6))));
      }
      // Deduplicate, always keep min and max, then re-interpolate to n unique values
      let unique = Array.from(new Set([min, ...raw, max])).sort((a, b) => a - b);
      while (unique.length < n) {
        // Fill gaps by splitting the largest interval
        let maxGap = -1, splitIdx = 0;
        for (let i = 0; i < unique.length - 1; i++) {
          const gap = unique[i + 1] - unique[i];
          if (gap > maxGap) { maxGap = gap; splitIdx = i; }
        }
        const mid = parseFloat(((unique[splitIdx] + unique[splitIdx + 1]) / 2).toFixed(6));
        unique.splice(splitIdx + 1, 0, mid);
      }
      // Trim to n if over (remove values closest to each other)
      while (unique.length > n) {
        let minGap = Infinity, removeIdx = 1;
        for (let i = 1; i < unique.length - 1; i++) {
          const gap = unique[i + 1] - unique[i - 1];
          if (gap < minGap) { minGap = gap; removeIdx = i; }
        }
        unique.splice(removeIdx, 1);
      }
      return unique;
    }

    case "natural_breaks": {
      // Jenks requires actual pixel data; approximate with a log-spaced distribution
      // that clusters breaks near the lower end of the range (common in natural data).
      const breaks: number[] = [];
      const range = max - min;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        // Logarithmic compression — more breaks near min
        const compressed = Math.log1p(t * (Math.E - 1)); // maps [0,1] → [0,1] log-style
        breaks.push(parseFloat((min + range * compressed).toFixed(6)));
      }
      breaks[0]     = min;
      breaks[n - 1] = max;
      return breaks;
    }

    case "standard_deviation": {
      // Break points centred on mean, spaced 1 std-dev apart, clamped to [min, max]
      const half = Math.floor(n / 2);
      const raw: number[] = [];
      for (let i = -half; i <= half; i++) {
        const v = mean + i * std;
        if (v >= min && v <= max) raw.push(parseFloat(v.toFixed(6)));
      }
      if (!raw.includes(min)) raw.unshift(min);
      if (!raw.includes(max)) raw.push(max);
      const unique = Array.from(new Set(raw)).sort((a, b) => a - b);
      while (unique.length > n) unique.splice(Math.floor(unique.length / 2), 1);
      while (unique.length < n) {
        const mid = parseFloat(((unique[0] + unique[1]) / 2).toFixed(6));
        unique.splice(1, 0, mid);
      }
      return unique;
    }

    case "pretty_breaks": {
      // Human-friendly rounded numbers between min and max
      const range     = max - min;
      const roughStep = range / (n - 1);
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const niceStep  = Math.round(roughStep / magnitude) * magnitude || magnitude;
      const values: number[] = [min];
      let v = Math.ceil(min / niceStep) * niceStep;
      while (v < max && values.length < n - 1) {
        values.push(parseFloat(v.toFixed(8)));
        v = parseFloat((v + niceStep).toFixed(8));
      }
      values.push(max);
      return values;
    }

    default:
      return equalIntervalBreaks(min, max, n);
  }
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <span
    className="text-[9px] font-bold uppercase block mb-2"
    style={{
      color: "var(--text-muted)",
      letterSpacing: "1.5px",
      fontFamily: "var(--font-mono)",
    }}
  >
    {children}
  </span>
);

export const SLDEditor: React.FC<SLDEditorProps> = ({ onApply, onClose }) => {
  const { layer, details, setSldConfig, fetchLegendEntries, setLegendInterpolation } = useRaster();

  const band0 = details?.bands?.[0];
  const rasterMin = band0?.min ?? 0;
  const rasterMax = band0?.max ?? 100;
  const geoName = details?.layer_name ?? layer?.layer_name ?? "";

  const [renderMode, setRenderMode] = useState<RenderMode>(
    "singleband_pseudocolor",
  );
  const [colorStops, setColorStops] = useState<ColorStop[]>([]);
  const [numClasses, setNumClasses] = useState<number>(5);
  const [selectedScheme, setSelectedScheme] = useState<ColorSchemeOption>(
    COLOR_SCHEMES[0],
  );
  const [interpolation, setInterpolation] = useState<"linear" | "discrete">(
    "linear",
  );
  const [classificationMethod, setClassificationMethod] =
    useState<string>("equal_interval");

  const [minValue, setMinValue] = useState<number>(rasterMin);
  const [maxValue, setMaxValue] = useState<number>(rasterMax);
  const [autoMinMax, setAutoMinMax] = useState<boolean>(true);

  const [invertColors, setInvertColors] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(1);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    if (band0) {
      if (band0.min !== null) setMinValue(band0.min);
      if (band0.max !== null) setMaxValue(band0.max);
    }
  }, [band0?.min, band0?.max]);

  const regenerateStops = () => {
    const min = autoMinMax ? rasterMin : minValue;
    const max = autoMinMax ? rasterMax : maxValue;
    const mean = band0?.mean ?? (min + max) / 2;
    const std  = band0?.std  ?? (max - min) / 6;

    // Compute break values depending on classification method
    const breaks = computeClassBreaks(classificationMethod, min, max, mean, std, numClasses);

    // Get colors from the chosen scheme (generateColorStops gives us evenly spaced
    // colour entries — we reuse those colours but replace the values with our breaks)
    const baseStops = SLDGenerator.generateColorStops(
      min, max, breaks.length, selectedScheme.scheme, undefined,
    );

    let stops: ColorStop[] = breaks.map((val, i) => ({
      ...baseStops[i] ?? baseStops[baseStops.length - 1],
      id: `stop-${i}`,
      value: parseFloat(val.toFixed(6)),
      label: val.toFixed(2),
    }));

    if (invertColors) stops = SLDGenerator.invertColors(stops);
    setColorStops(stops);
  };

  useEffect(() => {
    regenerateStops();
  }, [
    numClasses,
    selectedScheme,
    autoMinMax,
    minValue,
    maxValue,
    interpolation,
    classificationMethod,
    invertColors,
    rasterMin,
    rasterMax,
  ]);

  const updateColorStop = (id: string, updates: Partial<ColorStop>) =>
    setColorStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );

  const addColorStop = () => {
    if (colorStops.length >= 15) {
      toast("Maximum 15 color stops");
      return;
    }
    const sorted = [...colorStops].sort((a, b) => a.value - b.value);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const val = last.value + (last.value - prev.value);
    setColorStops((p) => [
      ...p,
      {
        id: `stop-${Date.now()}`,
        value: parseFloat(val.toFixed(6)),
        color: last.color,
        label: val.toFixed(2),
      },
    ]);
  };

  const removeColorStop = (id: string) => {
    if (colorStops.length <= 2) {
      toast("Minimum 2 stops required");
      return;
    }
    setColorStops((p) => p.filter((s) => s.id !== id));
  };

  const handleApply = () => {
    if (!layer) {
      toast.error("No active layer");
      return;
    }
    const validation = SLDGenerator.validateColorStops(colorStops);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    let sldXml: string | null = null;
    if (renderMode === "singleband_pseudocolor") {
      sldXml = SLDGenerator.generateSLD({
        layerName: geoName,
        colorStops,
        interpolation,
        opacity,
      });
      setSldConfig({
        layerName: geoName,
        colorStops,
        interpolation,
        opacity,
        renderMode: "singleband_pseudocolor",
      });
    }
    if (renderMode === "singleband_gray") {
      sldXml = null;
      setSldConfig(null);
    }
    onApply(sldXml);
    setTimeout(() => fetchLegendEntries(), 900);
  };

  const handleExportSLD = () => {
    if (!layer) return;
    const validation = SLDGenerator.validateColorStops(colorStops);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    const sldXml = SLDGenerator.generateSLD({
      layerName: geoName,
      colorStops,
      interpolation,
      opacity,
    });
    const blob = new Blob([sldXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${geoName}_style.sld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("SLD exported");
  };

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-muted)",
          }}
        >
          <svg
            className="w-6 h-6"
            style={{ color: "var(--text-faint)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>
        <p
          className="text-[12px] font-semibold"
          style={{ color: "var(--text-tertiary)" }}
        >
          No Layer Selected
        </p>
        <p
          className="text-[10px] mt-1"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          Upload a raster to configure symbology
        </p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 animate-pulse">
        <div
          className="w-14 h-14 rounded-xl mb-3"
          style={{ background: "var(--surface-sunken)" }}
        />
        <div
          className="h-3 w-28 rounded"
          style={{ background: "var(--border-subtle)" }}
        />
        <div
          className="h-2.5 w-20 rounded mt-2"
          style={{ background: "var(--border-muted)" }}
        />
      </div>
    );
  }

  const sortedStops = [...colorStops].sort((a, b) => a.value - b.value);

  // Each stop row is 34px tall (24px content + 5px padding top + 5px padding bottom)
  const ROW_HEIGHT = 34;
  const VISIBLE_ROWS = 6;
  const listHeight = Math.min(colorStops.length, VISIBLE_ROWS) * ROW_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-4 pb-2">
        {/* ── Raster stats banner ─────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 gap-1"
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            padding: "10px 12px",
          }}
        >
          {[
            { label: "Min", value: band0?.min != null ? band0.min.toFixed(4) : "—" },
            { label: "Mean", value: band0?.mean != null ? band0.mean.toFixed(4) : "—" },
            { label: "Max", value: band0?.max != null ? band0.max.toFixed(4) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p
                className="text-[8px] uppercase font-semibold"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                }}
              >
                {label}
              </p>
              <p
                className="text-[11px] font-bold mt-0.5"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Render Type ─────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Render Type</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                key: "singleband_pseudocolor" as RenderMode,
                label: "Pseudocolor",
                desc: "Color ramp",
              },
              {
                key: "singleband_gray" as RenderMode,
                label: "Grayscale",
                desc: "Single band",
              },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setRenderMode(key)}
                className="p-2.5 text-left transition-all"
                style={{
                  borderRadius: "var(--radius-md)",
                  border: `1.5px solid ${renderMode === key ? "var(--accent)" : "var(--border-subtle)"}`,
                  background:
                    renderMode === key
                      ? "var(--accent-bg)"
                      : "var(--surface-card)",
                  boxShadow:
                    renderMode === key
                      ? "0 0 0 3px var(--accent-border)"
                      : "var(--shadow-sm)",
                }}
              >
                <p
                  className="text-[11px] font-semibold"
                  style={{
                    color:
                      renderMode === key
                        ? "var(--accent)"
                        : "var(--text-primary)",
                  }}
                >
                  {label}
                </p>
                <p
                  className="text-[9px] mt-0.5"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {renderMode === "singleband_pseudocolor" && (
          <>
            {/* ── Mode ──────────────────────────────────────────────── */}
            <div>
              <SectionLabel>Mode</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    key: "linear" as const,
                    label: "Continuous",
                    desc: "Smooth ramp",
                  },
                  {
                    key: "discrete" as const,
                    label: "Classified",
                    desc: "Intervals",
                  },
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => { setInterpolation(key); setLegendInterpolation(key); }}
                    className="p-2.5 text-left transition-all"
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: `1.5px solid ${interpolation === key ? "var(--blue)" : "var(--border-subtle)"}`,
                      background:
                        interpolation === key
                          ? "var(--blue-bg)"
                          : "var(--surface-card)",
                      boxShadow:
                        interpolation === key
                          ? "0 0 0 3px var(--blue-border)"
                          : "var(--shadow-sm)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold"
                      style={{
                        color:
                          interpolation === key
                            ? "var(--blue)"
                            : "var(--text-primary)",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-[9px] mt-0.5"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Classification method ──────────────────────────────── */}
            <div>
              <SectionLabel>Classification Method</SectionLabel>
              <div className="grid grid-cols-1 gap-1.5">
                {CLASSIFICATION_METHODS.map((m) => {
                  const isActive = classificationMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setClassificationMethod(m.id)}
                      className="flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150"
                      style={{
                        borderRadius: "var(--radius-md)",
                        border: `1.5px solid ${isActive ? "var(--purple)" : "var(--border-subtle)"}`,
                        background: isActive ? "var(--purple-bg)" : "var(--surface-card)",
                        boxShadow: isActive ? "0 0 0 3px var(--purple-border)" : "var(--shadow-sm)",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: isActive ? "var(--purple)" : "var(--border-strong)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[11px] font-semibold leading-none"
                          style={{ color: isActive ? "var(--purple)" : "var(--text-primary)" }}
                        >
                          {m.name}
                        </p>
                        <p
                          className="text-[9px] mt-0.5"
                          style={{
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {m.description}
                        </p>
                      </div>
                      {isActive && (
                        <svg
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: "var(--purple)" }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Classes slider ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Classes</SectionLabel>
                <span
                  className="text-[11px] font-bold px-2 py-0.5"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {numClasses}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                value={numClasses}
                onChange={(e) => setNumClasses(parseInt(e.target.value))}
                className="w-full terra-slider"
                style={{
                  background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((numClasses - 2) / 13) * 100}%, var(--border-subtle) ${((numClasses - 2) / 13) * 100}%, var(--border-subtle) 100%)`,
                }}
              />
            </div>

            {/* ── Value range ────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Value Range</SectionLabel>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    className="terra-toggle"
                    data-active={autoMinMax.toString()}
                    onClick={() => setAutoMinMax(!autoMinMax)}
                    style={{ width: 32, height: 18 }}
                  />
                  <span
                    className="text-[9px] font-medium"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Auto
                  </span>
                </label>
              </div>

              {autoMinMax ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Min", value: rasterMin },
                    { label: "Max", value: rasterMax },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span
                        className="text-[8px] font-medium uppercase block mb-1"
                        style={{
                          color: "var(--text-faint)",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "1px",
                        }}
                      >
                        {label}
                      </span>
                      <div
                        className="text-[11px] font-bold px-2.5 py-1.5"
                        style={{
                          background: "var(--surface-sunken)",
                          border: "1px solid var(--border-muted)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--accent)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {value.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Min", value: minValue, set: setMinValue },
                    { label: "Max", value: maxValue, set: setMaxValue },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <span
                        className="text-[8px] font-medium uppercase block mb-1"
                        style={{
                          color: "var(--text-faint)",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: "1px",
                        }}
                      >
                        {label}
                      </span>
                      <input
                        type="number"
                        value={value}
                        step="0.0001"
                        onChange={(e) => set(parseFloat(e.target.value))}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          background: "var(--surface-input)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          outline: "none",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Color ramp picker ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Color Ramp</SectionLabel>
                <button
                  onClick={() => setInvertColors(!invertColors)}
                  className="flex items-center gap-1 px-2 py-1 transition-all"
                  style={{
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${invertColors ? "var(--amber)" : "var(--border-subtle)"}`,
                    background: invertColors
                      ? "var(--amber-bg)"
                      : "var(--surface-card)",
                    color: invertColors ? "var(--amber)" : "var(--text-muted)",
                    fontSize: 9,
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <svg
                    className="w-2.5 h-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                  Invert
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => setSelectedScheme(scheme)}
                    className="p-2 transition-all"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      border: `1.5px solid ${selectedScheme.id === scheme.id ? "var(--accent)" : "var(--border-subtle)"}`,
                      background:
                        selectedScheme.id === scheme.id
                          ? "var(--accent-bg)"
                          : "var(--surface-card)",
                      boxShadow:
                        selectedScheme.id === scheme.id
                          ? "0 0 0 2px var(--accent-border)"
                          : "none",
                    }}
                  >
                    <p
                      className="text-[9px] font-semibold mb-1.5"
                      style={{
                        color:
                          selectedScheme.id === scheme.id
                            ? "var(--accent)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {scheme.name}
                    </p>
                    <div
                      className="flex h-3 overflow-hidden"
                      style={{ borderRadius: 3 }}
                    >
                      {scheme.preview.map((c, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Ramp preview ───────────────────────────────────────── */}
            <div>
              <SectionLabel>Preview</SectionLabel>
              <div
                className="p-3"
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  className="flex h-10 overflow-hidden"
                  style={{ borderRadius: "var(--radius-md)" }}
                >
                  {sortedStops.map((stop) => (
                    <div
                      key={stop.id}
                      className="flex-1 transition-all hover:opacity-80"
                      style={{ background: stop.color }}
                      title={`${stop.value.toFixed(4)} — ${stop.color}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span
                    className="text-[9px] font-bold"
                    style={{
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {sortedStops[0]?.value.toFixed(4)}
                  </span>
                  <span
                    className="text-[9px]"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {interpolation === "linear" ? "Continuous" : "Classified"} ·{" "}
                    {numClasses} classes
                  </span>
                  <span
                    className="text-[9px] font-bold"
                    style={{
                      color: "var(--purple)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {sortedStops[sortedStops.length - 1]?.value.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Advanced toggle ────────────────────────────────────── */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2.5 transition-all"
              style={{
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                background: showAdvanced
                  ? "var(--purple-bg)"
                  : "var(--surface-card)",
                color: showAdvanced ? "var(--purple)" : "var(--text-muted)",
              }}
            >
              <span
                className="flex items-center gap-1.5 text-[10px] font-semibold"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Advanced Options
              </span>
              <svg
                className="w-3 h-3 transition-transform"
                style={{ transform: showAdvanced ? "rotate(180deg)" : "" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* ── Advanced section ───────────────────────────────────── */}
            {showAdvanced && (
              <div
                className="space-y-3 p-3 terra-fade-in"
                style={{
                  background: "var(--surface-sunken)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-muted)",
                }}
              >
                {/* Color stops editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[9px] font-bold uppercase"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "1px",
                      }}
                    >
                      Color Stops ({colorStops.length})
                    </span>
                    <button
                      onClick={addColorStop}
                      disabled={colorStops.length >= 15}
                      className="px-2 py-1 text-[9px] font-bold transition-all"
                      style={{
                        borderRadius: "var(--radius-sm)",
                        background:
                          colorStops.length >= 15
                            ? "var(--border-subtle)"
                            : "var(--accent)",
                        color:
                          colorStops.length >= 15
                            ? "var(--text-faint)"
                            : "#fff",
                        fontFamily: "var(--font-mono)",
                        border: "none",
                        cursor:
                          colorStops.length >= 15 ? "not-allowed" : "pointer",
                      }}
                    >
                      + Add
                    </button>
                  </div>

                  <div
                    className="custom-scrollbar"
                    style={{
                      height: `${listHeight}px`,

                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {sortedStops.map((stop) => (
                      <div
                        key={stop.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 7px",
                          flexShrink: 0,
                          height: `${ROW_HEIGHT}px`,
                          boxSizing: "border-box",
                          background: "var(--surface-card)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-muted)",
                        }}
                      >
                        {/* Color swatch */}
                        <label
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            flexShrink: 0,
                            cursor: "pointer",
                            display: "block",
                            background: stop.color,
                            border: "2px solid var(--surface-card)",
                            boxShadow: "0 0 0 1px var(--border-subtle)",
                          }}
                        >
                          <input
                            type="color"
                            value={stop.color}
                            onChange={(e) =>
                              updateColorStop(stop.id, {
                                color: e.target.value,
                              })
                            }
                            className="sr-only"
                          />
                        </label>

                        {/* Value */}
                        <input
                          type="number"
                          value={stop.value}
                          step="0.0001"
                          onChange={(e) =>
                            updateColorStop(stop.id, {
                              value: parseFloat(e.target.value),
                            })
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "4px 6px",
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border-muted)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-primary)",
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            outline: "none",
                          }}
                        />

                        {/* Label */}
                        <input
                          type="text"
                          value={stop.label || ""}
                          placeholder="Label"
                          onChange={(e) =>
                            updateColorStop(stop.id, { label: e.target.value })
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "4px 6px",
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border-muted)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-secondary)",
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            outline: "none",
                          }}
                        />

                        {/* Delete — keep layout stable with a spacer when hidden */}
                        {colorStops.length > 2 ? (
                          <button
                            onClick={() => removeColorStop(stop.id)}
                            style={{
                              flexShrink: 0,
                              width: 20,
                              height: 20,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 4,
                              background: "transparent",
                              border: "none",
                              color: "var(--text-faint)",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--red)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color =
                                "var(--text-faint)")
                            }
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        ) : (
                          <div style={{ flexShrink: 0, width: 20 }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Subtle scroll hint when list overflows */}
                  {colorStops.length > VISIBLE_ROWS && (
                    <p
                      style={{
                        marginTop: 4,
                        fontSize: 8,
                        textAlign: "center",
                        color: "var(--text-faint)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      ↕ scroll · {colorStops.length - VISIBLE_ROWS} more below
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer actions ──────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-0 pt-3"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <button
          onClick={handleExportSLD}
          className="p-2.5 transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-card)",
            color: "var(--text-muted)",
          }}
          title="Export SLD file"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>

        <button
          onClick={regenerateStops}
          className="p-2.5 transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-card)",
            color: "var(--text-muted)",
          }}
          title="Reset to defaults"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        <button
          onClick={handleApply}
          className="flex-1 py-2.5 flex items-center justify-center gap-2 transition-all"
          style={{
            borderRadius: "var(--radius-md)",
            border: "none",
            background:
              "linear-gradient(135deg, var(--accent) 0%, #0a7a6a 100%)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.5px",
            textTransform: "uppercase" as const,
            boxShadow: "0 2px 8px rgba(13,155,122,0.3)",
            cursor: "pointer",
          }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Apply Style
        </button>
      </div>
    </div>
  );
};

export default SLDEditor;
