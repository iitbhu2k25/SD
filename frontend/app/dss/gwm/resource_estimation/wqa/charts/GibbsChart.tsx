"use client";

import { useState, useMemo, useRef, type FC } from "react";
import dynamic from "next/dynamic";
import { Activity, Layers, Crosshair, X, ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import type { GibbsResponse, GibbsPoint } from "@/interface/charts";
import type { Data, Layout, Annotations, PlotMouseEvent } from "plotly.js";
import { THEME, buildColorMap, LOCATION_PALETTE } from "@/lib/hydro-utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ── theme alias (mirrors PiperChart's T object) ─────────────── */
const T = {
  bg:     THEME.bg,
  panel:  THEME.panelBg,
  card:   THEME.cardBg,
  border: THEME.panelBorder,
  muted:  "#64748b",
  mono:   THEME.fontMono,
  display: THEME.fontDisplay,
} as const;

/* ── boundary helpers ─────────────────────────────────────────── */
function logLine(
  x1: number, y1: number,
  x2: number, y2: number,
  n = 40,
): { x: number[]; y: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const ly1 = Math.log10(y1);
  const ly2 = Math.log10(y2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    xs.push(x1 + (x2 - x1) * t);
    ys.push(10 ** (ly1 + (ly2 - ly1) * t));
  }
  return { x: xs, y: ys };
}

const upperLeft  = logLine(0.13, 100000, 0.25,  1200, 15);
const upperRight = logLine(0.25,   1200, 0.96, 90000, 35);
const UPPER_X = [...upperLeft.x,  ...upperRight.x];
const UPPER_Y = [...upperLeft.y,  ...upperRight.y];

const lowerLine = logLine(0.00, 150, 1.00, 1.5, 40);
const LOWER_X = lowerLine.x;
const LOWER_Y = lowerLine.y;

function boundTrace(
  x: number[],
  y: number[],
  xaxis: string,
  yaxis: string,
): Data {
  return {
    x, y,
    type:       "scatter",
    mode:       "lines",
    showlegend: false,
    hoverinfo:  "skip",
    xaxis,
    yaxis,
    line: { color: "#38bdf8", width: 1.5, dash: "dash" },
  } as Data;
}

/* ── zone annotations ─────────────────────────────────────────── */
function makeAnnotations(
  xref: string,
  yref: string,
): Partial<Annotations>[] {
  return [
    {
      xref: xref as any,
      yref: yref as any,
      x:    0.68,
      y:    Math.log10(9000) as unknown as string,
      ax:   -50,
      ay:    50,
      text:       "Evaporation<br>Dominance",
      textangle:  "-45",
      showarrow:   true,
      arrowhead:   2,
      arrowsize:   0.9,
      arrowwidth:  1.3,
      arrowside:  "end+start" as any,
      arrowcolor: "#0ea5e9",
      font:       { color: "#0ea5e9", size: 10, family: "ui-monospace, monospace" },
      xanchor:    "left",
      yanchor:    "bottom",
    },
    {
      xref: xref as any,
      yref: yref as any,
      x:    0.08,
      y:    Math.log10(320) as unknown as string,
      ax:   55,
      ay:   0,
      text:       "Rock-Water<br>Interaction",
      textangle:  "0",
      showarrow:   true,
      arrowhead:   2,
      arrowsize:   0.9,
      arrowwidth:  1.1,
      arrowside:  "end" as any,
      arrowcolor: "#0ea5e9",
      font:       { color: "#0ea5e9", size: 10, family: "ui-monospace, monospace" },
      xanchor:    "left",
      yanchor:    "middle",
    },
    {
      xref: xref as any,
      yref: yref as any,
      x:    0.55,
      y:    Math.log10(9) as unknown as string,
      ax:   -50,
      ay:   -50,
      text:       "Precipitation<br>Dominance",
      textangle:  "45",
      showarrow:   true,
      arrowhead:   2,
      arrowsize:   0.9,
      arrowwidth:  1.3,
      arrowside:  "end+start" as any,
      arrowcolor: "#0ea5e9",
      font:       { color: "#0ea5e9", size: 10, family: "ui-monospace, monospace" },
      xanchor:    "left",
      yanchor:    "top",
    },
  ];
}

/* ── axis base configs ────────────────────────────────────────── */
const XAXIS_BASE = {
  gridcolor:  "rgba(255,255,255,0.06)",
  linecolor:  "rgba(255,255,255,0.18)",
  tickcolor:  "rgba(255,255,255,0.18)",
  tickfont:   { size: 9, color: "#64748b", family: "ui-monospace, monospace" },
  zeroline:   false,
  showgrid:   true,
  range:      [0, 1] as [number, number],
  dtick:      0.2,
};

const YAXIS_BASE = {
  gridcolor:  "rgba(255,255,255,0.06)",
  linecolor:  "rgba(255,255,255,0.18)",
  tickcolor:  "rgba(255,255,255,0.18)",
  tickfont:   { size: 9, color: "#64748b", family: "ui-monospace, monospace" },
  zeroline:   false,
  type:       "log"          as const,
  range:      [0, 5]         as [number, number],
  dtick:      1,
  tickvals:   [1, 10, 100, 1000, 10000, 100000],
  ticktext:   ["1", "10", "100", "1,000", "10,000", "100,000"],
};

/* ── section header (mirrors PiperChart) ──────────────────────── */
const SectionHeader: FC<{ dot: string; title: string; badge?: string }> = ({
  dot, title, badge,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <div className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
    <span
      className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
      style={{ fontFamily: T.mono }}
    >
      {title}
    </span>
    {badge && (
      <span className="ml-auto text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
        {badge}
      </span>
    )}
  </div>
);

/* ── selected-point detail card ───────────────────────────────── */
const GibbsDetail: FC<{ point: GibbsPoint | null; color: string; onClose: () => void }> = ({
  point, color, onClose,
}) => {
  if (!point)
    return (
      <div
        className="rounded-xl border border-dashed p-8 text-center"
        style={{ borderColor: T.border, background: "rgba(8,13,26,0.3)" }}
      >
        <Crosshair className="w-5 h-5 text-slate-700 mx-auto mb-2" />
        <p className="text-[11px] text-slate-600" style={{ fontFamily: T.mono }}>
          Click any data point to inspect
        </p>
      </div>
    );

  const mechColor = (m: string) =>
    m.toLowerCase().includes("evaporation")
      ? "#fbbf24"
      : m.toLowerCase().includes("precipitation")
        ? "#38bdf8"
        : "#34d399";

  return (
    <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
      {/* header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100" style={{ fontFamily: T.display }}>
            {point.location}
          </h4>
          <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontFamily: T.mono }}>
            {point.latitude.toFixed(4)}°N, {point.longitude.toFixed(4)}°E · {point.year}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-slate-600 hover:text-slate-300 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* TDS stat */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {([
          { label: "TDS",      value: point.tds.toFixed(1),          unit: "mg/L", color: "#34d399" },
          { label: "Na/(Na+Ca)", value: point.cation_ratio.toFixed(3), unit: "",    color: "#fbbf24" },
          { label: "Cl/(Cl+HCO₃)", value: point.anion_ratio.toFixed(3), unit: "",  color: "#f472b6" },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="rounded-lg border px-2.5 py-1.5 text-center"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: T.border }}
          >
            <div className="text-[9px] text-slate-600 uppercase tracking-wider" style={{ fontFamily: T.mono }}>
              {s.label}
            </div>
            <div className="text-xs font-bold mt-0.5" style={{ color: s.color, fontFamily: T.mono }}>
              {s.value}
              {s.unit && <span className="text-[8px] text-slate-600 ml-0.5">{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* mechanisms */}
      <div className="space-y-2">
        {([
          { label: "Cation mechanism", value: point.mechanism_cation },
          { label: "Anion mechanism",  value: point.mechanism_anion  },
        ] as const).map((m) => (
          <div key={m.label} className="rounded-lg border px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", borderColor: T.border }}>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1" style={{ fontFamily: T.mono }}>
              {m.label}
            </div>
            <div className="text-[11px] font-semibold" style={{ color: mechColor(m.value), fontFamily: T.mono }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── main component ───────────────────────────────────────────── */
interface GibbsChartProps {
  data: GibbsResponse;
}

const GibbsChart: FC<GibbsChartProps> = ({ data }) => {
  const [selected, setSelected]         = useState<GibbsPoint | null>(null);
  const [panelOpen, setPanelOpen]       = useState(true);
  const [hoverLoc, setHoverLoc]         = useState<string | null>(null);
  const togglePanel = () => { setPanelOpen((p) => !p); setTimeout(() => window.dispatchEvent(new Event("resize")), 320); };
  const [locationsOpen, setLocationsOpen] = useState(true);
  const graphDivRef = useRef<HTMLElement | null>(null);

  /* unique locations + colour map */
  const locations = useMemo(
    () => [...new Set(data.points.map((p) => p.location))],
    [data.points],
  );
  const colorMap = useMemo(() => buildColorMap(locations), [locations]);

  /* scatter traces by location (enables per-location highlight) */
  const makeScatterTraces = (
    mode: "cation" | "anion",
    xaxis: string,
    yaxis: string,
    showLegend: boolean,
  ): Data[] =>
    locations.map((loc, li) => {
      const pts   = data.points.filter((p) => p.location === loc);
      const color = colorMap[loc] ?? LOCATION_PALETTE[li % LOCATION_PALETTE.length];
      const isHL  = hoverLoc === null || hoverLoc === loc;
      const xLabel = mode === "cation"
        ? "Na\u207a/(Na\u207a+Ca\u00b2\u207a)"
        : "Cl\u207b/(Cl\u207b+HCO\u2083\u207b)";
      return {
        type:        "scatter",
        mode:        "markers",
        name:        loc,
        x:           pts.map((p) => mode === "cation" ? p.cation_ratio : p.anion_ratio),
        y:           pts.map((p) => Math.max(p.tds, 1)),
        xaxis,
        yaxis,
        legendgroup: loc,
        showlegend:  showLegend,
        customdata:  pts.map((p) => data.points.indexOf(p)),
        text:        pts.map((p) => {
          const r = mode === "cation" ? p.cation_ratio : p.anion_ratio;
          return (
            `<b>${p.location}</b><br>` +
            `Year: ${p.year}<br>` +
            `TDS: ${p.tds.toFixed(1)} mg/L<br>` +
            `${xLabel}: ${r.toFixed(3)}<br>` +
            `<i>${mode === "cation" ? p.mechanism_cation : p.mechanism_anion}</i>`
          );
        }),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          symbol: "circle",
          size:   selected?.location === loc ? 11 : 8,
          color,
          opacity: isHL ? 0.88 : 0.12,
          line:   { color: selected?.location === loc ? "#fff" : "rgba(255,255,255,0.35)", width: selected?.location === loc ? 2 : 0.8 },
        },
      } as Data;
    });

  const traces = useMemo((): Data[] => [
    boundTrace(UPPER_X, UPPER_Y, "x",  "y"),
    boundTrace(LOWER_X, LOWER_Y, "x",  "y"),
    ...makeScatterTraces("cation", "x",  "y",  false),
    boundTrace(UPPER_X, UPPER_Y, "x2", "y2"),
    boundTrace(LOWER_X, LOWER_Y, "x2", "y2"),
    ...makeScatterTraces("anion",  "x2", "y2", false),
  ], [data.points, hoverLoc, selected, locations, colorMap]);

  const layout = useMemo((): Partial<Layout> => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor:  "rgba(0,0,0,0)",
    font: {
      family: "ui-monospace, SFMono-Regular, monospace",
      color:  "#64748b",
      size:   10,
    },
    xaxis: {
      ...XAXIS_BASE,
      domain: [0, 0.46],
      title: {
        text:     "Na\u207a/\uff08Na\u207a+Ca\u00b2\u207a\uff09",
        font:     { color: "rgba(248,250,252,0.8)", size: 12 },
        standoff: 10,
      },
    },
    yaxis: {
      ...YAXIS_BASE,
      anchor: "x",
      title: {
        text:     "TDS\uff08mg/L\uff09",
        font:     { color: "rgba(248,250,252,0.8)", size: 12 },
        standoff: 6,
      },
    },
    xaxis2: {
      ...XAXIS_BASE,
      domain: [0.54, 1],
      anchor: "y2",
      title: {
        text:     "Cl\u207b/\uff08Cl\u207b+HCO\u2083\u207b\uff09",
        font:     { color: "rgba(248,250,252,0.8)", size: 12 },
        standoff: 10,
      },
    },
    yaxis2: {
      ...YAXIS_BASE,
      anchor: "x2",
      title: {
        text:     "TDS\uff08mg/L\uff09",
        font:     { color: "rgba(248,250,252,0.8)", size: 12 },
        standoff: 6,
      },
    },
    annotations: [
      ...makeAnnotations("x",  "y"),
      ...makeAnnotations("x2", "y2"),
    ],
    
    shapes: [
      {
        type: "rect", xref: "paper", yref: "paper",
        x0: 0,    y0: 0, x1: 0.46, y1: 1,
        fillcolor: "rgba(8,13,26,0.55)",
        line: { width: 0 }, layer: "below",
      },
      {
        type: "rect", xref: "paper", yref: "paper",
        x0: 0.54, y0: 0, x1: 1,    y1: 1,
        fillcolor: "rgba(8,13,26,0.55)",
        line: { width: 0 }, layer: "below",
      },
    ],
    margin:   { t: 24, r: 24, b: 64, l: 76 },
    autosize: true,
    dragmode: "zoom",
    hoverlabel: {
      bgcolor:     "rgba(8,13,26,0.92)",
      bordercolor: "rgba(56,189,248,0.3)",
      font:        { size: 11, color: "#e2e8f0" },
    },
  }), []);

  const handleClick = (ev: Readonly<PlotMouseEvent>) => {
    if (!ev.points.length) return;
    const idx = ev.points[0].customdata as number | undefined;
    if (idx != null && idx >= 0 && idx < data.points.length)
      setSelected(data.points[idx]);
  };

  return (
    <div
      className="flex w-full h-full overflow-hidden"
      style={{
        background: T.bg,
        backgroundImage:
          "radial-gradient(ellipse at 25% 40%, rgba(251,146,60,0.04) 0%, transparent 50%)," +
          "radial-gradient(ellipse at 75% 60%, rgba(244,63,94,0.04) 0%, transparent 50%)",
      }}
    >
      {/* ═══ LEFT CHART AREA ═══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-hidden">
        {/* top bar */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: T.display }}>
                <span className="text-amber-400">Gibbs Diagram</span>
              </h1>
              <p className="text-[11px] text-slate-500 -mt-0.5" style={{ fontFamily: T.mono }}>
                Hydrochemical source mechanism · {data.points.length} samples
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* reset view */}
            <button
              title="Reset view"
              onClick={async () => {
                if (!graphDivRef.current) return;
                const Plotly = (await import("plotly.js-dist-min")).default;
                Plotly.relayout(graphDivRef.current, {
                  "xaxis.autorange": true,
                  "yaxis.autorange": true,
                } as any);
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
                fontFamily: T.mono,
              }}
            >
              Reset View
            </button>
            {/* panel toggle */}
            <button
              title="Toggle panel"
              onClick={togglePanel}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* chart glass panel */}
        <div
          className="flex-1 relative rounded-2xl overflow-hidden"
          style={{
            background:     T.panel,
            border:         `1px solid ${T.border}`,
            backdropFilter: "blur(20px)",
            boxShadow:      "0 24px 64px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
            minHeight:      420,
          }}
        >
          <div className="absolute top-0 left-0 w-14 h-14 border-l-2 border-t-2 border-amber-500/10 rounded-tl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-14 h-14 border-r-2 border-b-2 border-rose-500/10 rounded-br-2xl pointer-events-none" />
          <Plot
            data={traces}
            layout={layout}
            config={{
              responsive:             true,
              displaylogo:            false,
              modeBarButtonsToRemove: [
                "zoom2d", "pan2d", "zoomIn2d", "zoomOut2d",
                "autoScale2d", "resetScale2d",
                "toImage", "select2d", "lasso2d",
              ] as any,
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onClick={handleClick}
            onInitialized={(_fig, graphDiv) => {
              graphDivRef.current = graphDiv;
            }}
          />
        </div>
      </div>

      {/* ═══ RIGHT PANEL ═══════════════════════════════════════ */}
      <aside
        className="shrink-0 transition-all duration-300 overflow-hidden"
        style={{
          width:      panelOpen ? 340 : 0,
          borderLeft: `1px solid ${T.border}`,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="w-[340px] h-full flex flex-col p-5 gap-5 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}
        >
          {/* ── Plot Intelligence ── */}
          <section>
            <SectionHeader dot="bg-amber-400" title="Plot Intelligence" />
            <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400" style={{ fontFamily: T.display }}>
                  Gibbs Diagram
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Identifies dominant hydrochemical processes controlling groundwater
                chemistry — precipitation, rock–water interaction, or evaporation —
                by plotting TDS against ionic ratios.
              </p>
              <div className="space-y-2">
                {([
                  ["🔵", "Left plot — Cation ratio Na/(Na+Ca) vs TDS"],
                  ["🔴", "Right plot — Anion ratio Cl/(Cl+HCO₃) vs TDS"],
                  ["☁️", "Lower zone — Precipitation dominance"],
                  ["🪨", "Middle band — Rock–water interaction"],
                  ["☀️", "Upper zone — Evaporation dominance"],
                  ["👆", "Click any point to inspect details"],
                ] as const).map(([emoji, text]) => (
                  <div key={text} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                    <span className="text-[10px] mt-px shrink-0">{emoji}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Locations ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500" style={{ fontFamily: T.mono }}>
                Locations
              </span>
              <span className="text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
                {locations.length}
              </span>
              <button
                onClick={() => setLocationsOpen((p) => !p)}
                className="ml-auto p-0.5 rounded text-slate-600 hover:text-slate-300 transition-colors"
              >
                {locationsOpen
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            {locationsOpen && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  background:    "rgba(8,13,26,0.4)",
                  borderColor:   T.border,
                  maxHeight:     210,
                  overflowY:     "auto",
                  scrollbarWidth: "thin",
                  scrollbarColor: `${T.border} transparent`,
                }}
              >
                {locations.map((loc) => {
                  const cnt  = data.points.filter((p) => p.location === loc).length;
                  const isH  = hoverLoc === loc;
                  const isS  = selected?.location === loc;
                  return (
                    <div
                      key={loc}
                      onMouseEnter={() => setHoverLoc(loc)}
                      onMouseLeave={() => setHoverLoc(null)}
                      onClick={() => {
                        const first = data.points.find((p) => p.location === loc);
                        if (first) setSelected(first);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-b last:border-0"
                      style={{
                        borderColor: T.border,
                        background:  isH ? "rgba(255,255,255,0.04)" : "transparent",
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0 transition-shadow duration-200"
                        style={{
                          background: colorMap[loc],
                          boxShadow:  isH ? `0 0 10px ${colorMap[loc]}90` : "none",
                        }}
                      />
                      <span className="text-[11px] text-slate-400 truncate flex-1" style={{ fontFamily: T.mono }}>
                        {loc}
                      </span>
                      {isS && <Crosshair className="w-3 h-3 text-amber-400 shrink-0" />}
                      <span className="text-[10px] text-slate-600 tabular-nums shrink-0" style={{ fontFamily: T.mono }}>
                        {cnt}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Well Detail ── */}
          <section>
            <SectionHeader dot="bg-rose-400" title="Sample Detail" />
            <GibbsDetail
              point={selected}
              color={selected ? (colorMap[selected.location] ?? "#94a3b8") : "#94a3b8"}
              onClose={() => setSelected(null)}
            />
          </section>
        </div>
      </aside>
    </div>
  );
};

export default GibbsChart;
