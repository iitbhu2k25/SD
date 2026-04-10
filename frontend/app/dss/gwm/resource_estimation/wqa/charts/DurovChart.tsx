"use client";

import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Grid3x3, X, Layers, Crosshair, FlaskConical,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { Layout, Config, Data, PlotMouseEvent } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ══════════════════════════════════════════════════════════════════
   GEOMETRY
   ══════════════════════════════════════════════════════════════════ */

const S3_2 = Math.sqrt(3) / 2;
const CAT_APEX_X = -S3_2 * 100;
const AN_APEX_Y  =  100 + S3_2 * 100;

/* ══════════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════════ */

const T = {
  bg:       "#080d1a",
  panel:    "rgba(15,23,42,0.7)",
  card:     "rgba(15,23,42,0.6)",
  border:   "rgba(255,255,255,0.08)",
  muted:    "#64748b",
  display:  "'DM Sans', ui-sans-serif, sans-serif",
  mono:     "'JetBrains Mono', ui-monospace, monospace",
  sqFill:   "rgba(56,189,248,0.05)",
  sqStroke: "rgba(56,189,248,0.4)",
  catFill:  "rgba(52,211,153,0.07)",
  catClr:   "rgba(52,211,153,0.7)",
  anFill:   "rgba(244,114,182,0.07)",
  anClr:    "rgba(244,114,182,0.7)",
  grid:     "rgba(148,163,184,0.1)",
} as const;

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

export interface IonPct {
  Ca_pct: number;  Mg_pct: number;
  Na_pct: number;  K_pct:  number;
  HCO3_pct: number; CO3_pct?: number;
  SO4_pct:  number; Cl_pct:   number;
}

export interface DurovPoint {
  location:   string;
  year?:      number;
  latitude?:  number;
  longitude?: number;
  ion_pct:    IonPct;
  cation_tri: { x: number; y: number };
  anion_tri:  { x: number; y: number };
  square:     { x: number; y: number };
}

export interface DurovResponse { points: DurovPoint[] }

interface MappedDurov extends DurovPoint {
  wt: { type: string; color: string; bg: string };
}

/* ══════════════════════════════════════════════════════════════════
   WATER-TYPE
   ══════════════════════════════════════════════════════════════════ */

const WT_META: Record<string, { color: string; bg: string }> = {
  "Ca-HCO₃":   { color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  "Ca-Cl":     { color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  "Ca-SO₄":    { color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  "Mg-HCO₃":   { color: "#38bdf8", bg: "rgba(56,189,248,0.12)"  },
  "Mg-Cl":     { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "Mg-SO₄":    { color: "#22d3ee", bg: "rgba(34,211,238,0.12)"  },
  "Na+K-HCO₃": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  "Na+K-Cl":   { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "Na+K-SO₄":  { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

function classifyWaterType(ip: IonPct) {
  const nak  = ip.Na_pct + ip.K_pct;
  const hco3 = ip.HCO3_pct + (ip.CO3_pct ?? 0);
  const cat  = ip.Ca_pct >= ip.Mg_pct && ip.Ca_pct >= nak ? "Ca"
             : ip.Mg_pct >= nak ? "Mg" : "Na+K";
  const an   = hco3 >= ip.SO4_pct && hco3 >= ip.Cl_pct ? "HCO₃"
             : ip.SO4_pct >= ip.Cl_pct ? "SO₄" : "Cl";
  const type = `${cat}-${an}`;
  return { type, ...(WT_META[type] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" }) };
}

/* ══════════════════════════════════════════════════════════════════
   COLOURS
   ══════════════════════════════════════════════════════════════════ */

const PALETTE = [
  "#38bdf8","#818cf8","#34d399","#fb923c","#f472b6",
  "#22d3ee","#a78bfa","#fbbf24","#4ade80","#f87171",
];

const buildColorMap = (locs: string[]) =>
  Object.fromEntries(locs.map((l, i) => [l, PALETTE[i % PALETTE.length]]));

/* ══════════════════════════════════════════════════════════════════
   COORDINATE TRANSFORMS
   ══════════════════════════════════════════════════════════════════ */

const toCat = (p: { x: number; y: number }) => ({ px: p.x * S3_2, py: p.y });
const toAn  = (p: { x: number; y: number }) => ({ px: p.x, py: 100 + (p.y - 100) * S3_2 });
const toSq  = (p: { x: number; y: number }) => ({ px: p.x, py: p.y });

/* ══════════════════════════════════════════════════════════════════
   GRID HELPERS
   ══════════════════════════════════════════════════════════════════ */

function catGridLines() {
  const lines: { x: [number, number]; y: [number, number] }[] = [];
  [25, 50, 75].forEach(p => {
    lines.push({ x: [CAT_APEX_X * p / 100, CAT_APEX_X * p / 100], y: [p / 2, 100 - p / 2] });
    lines.push({ x: [CAT_APEX_X * (100 - p) / 100, 0], y: [(100 - p) / 2, 100 - p] });
    lines.push({ x: [CAT_APEX_X * (100 - p) / 100, 0], y: [50 + p / 2, p] });
  });
  return lines;
}

function anGridLines() {
  const lines: { x: [number, number]; y: [number, number] }[] = [];
  const H = S3_2 * 100;
  [25, 50, 75].forEach(p => {
    const yH = 100 + H * p / 100;
    lines.push({ x: [p / 2, 100 - p / 2], y: [yH, yH] });
    lines.push({ x: [p, 50 + p / 2], y: [100, 100 + H * (100 - p) / 100] });
    lines.push({ x: [100 - p, 50 - p / 2 + (100 - p) / 2], y: [100, 100 + H * (100 - p) / 100] });
  });
  return lines;
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function DurovChartPlotly({ data }: { data: DurovResponse }) {
  const [selected,   setSelected]   = useState<MappedDurov | null>(null);
  const [hoverLoc,   setHoverLoc]   = useState<string | null>(null);
  const [showCation, setShowCation] = useState(true);
  const [showAnion,  setShowAnion]  = useState(true);
  const [showSquare, setShowSquare] = useState(true);
  const [panelOpen,  setPanelOpen]  = useState(true);
  const togglePanel = () => { setPanelOpen((p) => !p); setTimeout(() => window.dispatchEvent(new Event("resize")), 320); };
  const [locsOpen,   setLocsOpen]   = useState(true);

  const graphDivRef = useRef<HTMLElement | null>(null);

  const mapped    = useMemo<MappedDurov[]>(() =>
    data.points.map(pt => ({ ...pt, wt: classifyWaterType(pt.ion_pct) })),
    [data.points],
  );
  const locations = useMemo(() => [...new Set(mapped.map(d => d.location))], [mapped]);
  const colorMap  = useMemo(() => buildColorMap(locations), [locations]);
  const idxMap    = useMemo(() => new Map(mapped.map((m, i) => [m, i])), [mapped]);

  /* ── Traces ── */
  const traces = useMemo((): Data[] => {
    const list: Data[] = [];

    const poly = (xs: number[], ys: number[], fill: string, stroke: string): Data => ({
      type: "scatter", mode: "lines", x: xs, y: ys,
      fill: "toself", fillcolor: fill,
      line: { color: stroke, width: 1.2 },
      hoverinfo: "none", showlegend: false,
    } as Data);

    const line = (xs: number[], ys: number[], color: string, dash: "solid" | "dot" = "solid", w = 0.7): Data => ({
      type: "scatter", mode: "lines", x: xs, y: ys,
      line: { color, width: w, dash },
      hoverinfo: "none", showlegend: false,
    } as Data);

    list.push(poly([0, 100, 100, 0, 0], [0, 0, 100, 100, 0], T.sqFill, T.sqStroke));
    [25, 50, 75].forEach(p => {
      list.push(line([0, 100], [p, p],   T.grid, "dot"));
      list.push(line([p, p],   [0, 100], T.grid, "dot"));
    });

    list.push(poly([0, 0, CAT_APEX_X, 0], [0, 100, 50, 0], T.catFill, T.catClr));
    catGridLines().forEach(l => list.push(line(l.x, l.y, T.grid, "dot")));

    list.push(poly([0, 100, 50, 0], [100, 100, AN_APEX_Y, 100], T.anFill, T.anClr));
    anGridLines().forEach(l => list.push(line(l.x, l.y, T.grid, "dot")));

    list.push({
      type: "scatter", mode: "text",
      x: [50], y: [50], text: ["CENTRAL"],
      textfont: { color: "rgba(56,189,248,0.22)", size: 11, family: T.display },
      textposition: "middle center",
      hoverinfo: "none", showlegend: false,
    } as Data);

    locations.forEach(loc => {
      const pts    = mapped.filter(d => d.location === loc);
      const color  = colorMap[loc] ?? "#38bdf8";
      const isHL   = hoverLoc === null || hoverLoc === loc;
      const isSel  = selected?.location === loc;
      const op     = isHL ? 0.88 : 0.08;
      const sz     = isSel ? 10 : 7;
      const sw     = isSel ? 2 : 1;
      const stroke = isSel ? "#fff" : "rgba(255,255,255,0.35)";

      const htxt = (p: MappedDurov) =>
        `<b style="color:${color}">${p.location}</b>` +
        `<br><span style="color:${p.wt.color}">${p.wt.type}</span>` +
        `<br>Na⁺+K⁺ <b>${(p.ion_pct.Na_pct + p.ion_pct.K_pct).toFixed(1)}%</b>` +
        `  Mg²⁺ <b>${p.ion_pct.Mg_pct.toFixed(1)}%</b>` +
        `<br>Cl⁻ <b>${p.ion_pct.Cl_pct.toFixed(1)}%</b>` +
        `  SO₄²⁻ <b>${p.ion_pct.SO4_pct.toFixed(1)}%</b>`;

      const mk = (s: number) => ({ color, opacity: op, size: s, line: { color: stroke, width: sw } });
      const cx = { type: "scatter" as const, mode: "markers" as const, legendgroup: loc, hovertemplate: "%{text}<extra></extra>" };
      const cd = pts.map(d => idxMap.get(d) ?? -1);

      if (showCation) list.push({ ...cx, name: loc, showlegend: false,
        x: pts.map(p => toCat(p.cation_tri).px), y: pts.map(p => toCat(p.cation_tri).py),
        text: pts.map(htxt), customdata: cd, marker: mk(sz - 1),
      } as Data);

      if (showAnion) list.push({ ...cx, name: loc, showlegend: false,
        x: pts.map(p => toAn(p.anion_tri).px), y: pts.map(p => toAn(p.anion_tri).py),
        text: pts.map(htxt), customdata: cd, marker: mk(sz - 1),
      } as Data);

      if (showSquare) list.push({ ...cx, name: loc, showlegend: false,
        x: pts.map(p => toSq(p.square).px), y: pts.map(p => toSq(p.square).py),
        text: pts.map(htxt), customdata: cd, marker: mk(sz + 1),
      } as Data);
    });

    return list;
  }, [mapped, locations, colorMap, hoverLoc, selected, showCation, showAnion, showSquare, idxMap]);

  /* ── Layout ── */
  const layout = useMemo((): Partial<Layout> => {
    type Ann = NonNullable<Layout["annotations"]>[number];
    const lbl = (x: number, y: number, text: string, color: string, size = 10, anchor: "center" | "left" | "right" = "center"): Partial<Ann> =>
      ({ x, y, text, showarrow: false, xanchor: anchor, yanchor: "middle", font: { color, size, family: T.display } });

    return {
      paper_bgcolor: "transparent",
      plot_bgcolor:  "transparent",
      margin: { t: 20, r: 20, b: 20, l: 20 },
      xaxis: { visible: false, range: [CAT_APEX_X - 16, 116], scaleanchor: "y", scaleratio: 1 },
      yaxis: { visible: false, range: [-14, AN_APEX_Y + 14] },
      legend: {
        font: { color: "#94a3b8", size: 10, family: T.mono },
        bgcolor: "rgba(8,13,26,0.75)", bordercolor: T.border, borderwidth: 1,
        x: 1.01, y: 0.98, xanchor: "left", yanchor: "top", itemsizing: "constant",
      },
      hovermode: "closest",
      hoverlabel: {
        bgcolor: "rgba(8,13,26,0.97)", bordercolor: "rgba(129,140,248,0.35)",
        font: { color: "#e2e8f0", size: 11, family: T.mono }, align: "left",
      },
      annotations: [
        lbl(3,    -3,           "Ca²⁺",   "rgba(248,250,252,0.85)", 10, "left"),
        lbl(3,    103,          "Mg²⁺",   "rgba(248,250,252,0.85)", 10, "left"),
        lbl(CAT_APEX_X - 4, 50, "Na⁺+K⁺","rgba(248,250,252,0.85)", 10, "right"),
        lbl(CAT_APEX_X / 2, 50 + S3_2 * 10 + 16, "CATIONS", "rgba(52,211,153,0.85)", 8),
        lbl(-4,   100,          "HCO₃⁻",  "rgba(248,250,252,0.85)", 10, "right"),
        lbl(104,  100,          "Cl⁻",    "rgba(248,250,252,0.85)", 10, "left"),
        lbl(50,   AN_APEX_Y + 8,  "SO₄²⁻","rgba(248,250,252,0.85)", 10),
        lbl(50,   AN_APEX_Y + 22, "ANIONS","rgba(244,114,182,0.85)", 8),
        ...[0, 25, 50, 75, 100].map(p => ({
          x: p, y: -7, text: `${p}`, showarrow: false,
          xanchor: "center" as const, yanchor: "top" as const,
          font: { color: "#475569", size: 7, family: T.mono },
        })),
        ...[0, 25, 50, 75, 100].map(p => ({
          x: -4, y: p, text: `${p}`, showarrow: false,
          xanchor: "right" as const, yanchor: "middle" as const,
          font: { color: "#475569", size: 7, family: T.mono },
        })),
      ] as Layout["annotations"],
    };
  }, []);

  const config: Partial<Config> = {
    responsive:  true,
    displaylogo: false,
    modeBarButtonsToRemove: [
      "zoom2d", "pan2d", "zoomIn2d", "zoomOut2d",
      "autoScale2d", "resetScale2d", "toImage", "select2d", "lasso2d",
    ] as any,
  };

  const handleClick = (e: Readonly<PlotMouseEvent>) => {
    if (!e.points.length) return;
    const idx = e.points[0].customdata as number | undefined;
    if (idx != null && idx >= 0 && idx < mapped.length) setSelected(mapped[idx]);
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div
      className="flex w-full h-full overflow-hidden"
      style={{
        background: T.bg,
        backgroundImage:
          "radial-gradient(ellipse at 30% 60%,rgba(129,140,248,0.04) 0%,transparent 50%)," +
          "radial-gradient(ellipse at 70% 20%,rgba(244,114,182,0.04) 0%,transparent 50%)",
      }}
    >
      {/* ═══ LEFT CHART AREA ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-hidden">

        {/* top bar */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Grid3x3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: T.display }}>
                <span className="text-violet-400">Durov Diagram</span>
              </h1>
              <p className="text-[11px] text-slate-500 -mt-0.5" style={{ fontFamily: T.mono }}>
                Geochemical process classification · {mapped.length} wells
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* layer toggles */}
            <div
              className="flex items-center gap-1 rounded-lg p-1"
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}` }}
            >
              {([
                { key: "cat", on: showCation, set: setShowCation, c: T.catClr,   label: "Cations" },
                { key: "ani", on: showAnion,  set: setShowAnion,  c: T.anClr,    label: "Anions"  },
                { key: "sq",  on: showSquare, set: setShowSquare, c: T.sqStroke, label: "Square"  },
              ] as const).map(btn => (
                <button
                  key={btn.key}
                  title={btn.label}
                  onClick={() => btn.set(p => !p)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    btn.on ? "bg-white/[0.08] text-slate-200" : "text-slate-600 hover:text-slate-400"
                  }`}
                  style={{ fontFamily: T.mono }}
                >
                  <div className="w-2 h-2 rounded-full"
                    style={{ background: btn.on ? btn.c : "rgba(148,163,184,0.3)" }} />
                  {btn.label}
                </button>
              ))}
            </div>

            {/* reset view */}
            <button
              title="Reset view"
              onClick={async () => {
                if (!graphDivRef.current) return;
                const Plotly = (await import("plotly.js-dist-min")).default;
                Plotly.relayout(graphDivRef.current, {
                  "xaxis.autorange": true,
                  "yaxis.autorange": true,
                });
              }}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-100 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, fontFamily: T.mono }}
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
            boxShadow:      "0 24px 64px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div className="absolute top-0 left-0 w-14 h-14 border-l-2 border-t-2 border-violet-500/10 rounded-tl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-14 h-14 border-r-2 border-b-2 border-pink-500/10 rounded-br-2xl pointer-events-none" />
          <Plot
            data={traces}
            layout={layout}
            config={config}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onClick={handleClick}
            onInitialized={(_fig, graphDiv) => { graphDivRef.current = graphDiv; }}
          />
        </div>

      </div>

      {/* ═══ RIGHT PANEL ══════════════════════════════════════ */}
      <aside
        className="shrink-0 transition-all duration-300 overflow-hidden"
        style={{
          width:          panelOpen ? 340 : 0,
          borderLeft:     `1px solid ${T.border}`,
          background:     "rgba(15,23,42,0.55)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="w-[340px] h-full flex flex-col p-5 gap-5 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}
        >

          {/* ── Plot Intelligence ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500" style={{ fontFamily: T.mono }}>
                Plot Intelligence
              </span>
            </div>
            <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-violet-400" style={{ fontFamily: T.display }}>
                  Durov Diagram
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Extended Durov diagram combines cation and anion ternary triangles
                with a central square to classify geochemical processes and water types.
              </p>
              <div className="space-y-2">
                {([
                  ["🟢", "Left triangle — Cations (Ca, Mg, Na+K)"],
                  ["🔴", "Top triangle — Anions (HCO₃, Cl, SO₄)"],
                  ["🔷", "Central square — Mg vs SO₄ geochemical field"],
                  ["👆", "Click any point to inspect well chemistry"],
                  ["🖱️", "Hover location list to highlight wells"],
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
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500" style={{ fontFamily: T.mono }}>
                Locations
              </span>
              <span className="text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
                {locations.length}
              </span>
              <button
                onClick={() => setLocsOpen(p => !p)}
                className="ml-auto p-0.5 rounded text-slate-600 hover:text-slate-300 transition-colors"
              >
                {locsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            {locsOpen && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  background:     "rgba(8,13,26,0.4)",
                  borderColor:    T.border,
                  maxHeight:      210,
                  overflowY:      "auto",
                  scrollbarWidth: "thin",
                  scrollbarColor: `${T.border} transparent`,
                }}
              >
                {locations.map(loc => {
                  const isH = hoverLoc === loc;
                  const isS = selected?.location === loc;
                  return (
                    <div
                      key={loc}
                      onMouseEnter={() => setHoverLoc(loc)}
                      onMouseLeave={() => setHoverLoc(null)}
                      onClick={() => {
                        const first = mapped.find(d => d.location === loc);
                        if (first) setSelected(first);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-b last:border-0"
                      style={{ borderColor: T.border, background: isH ? "rgba(255,255,255,0.04)" : "transparent" }}
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
                      <span className="text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
                       
                      </span>
                      {isS && <Crosshair className="w-3 h-3 text-violet-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Selected Well ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500" style={{ fontFamily: T.mono }}>
                Selected Well
              </span>
            </div>
            {selected ? (
              <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100" style={{ fontFamily: T.display }}>
                      {selected.location}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ color: selected.wt.color, background: selected.wt.bg, fontFamily: T.mono }}
                      >
                        {selected.wt.type}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-md text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {([
                    { l: "Na⁺+K⁺", v: selected.ion_pct.Na_pct + selected.ion_pct.K_pct, c: "#fbbf24" },
                    { l: "Mg²⁺",   v: selected.ion_pct.Mg_pct,    c: "#38bdf8" },
                    { l: "Ca²⁺",   v: selected.ion_pct.Ca_pct,    c: "#34d399" },
                    { l: "Cl⁻",    v: selected.ion_pct.Cl_pct,    c: "#f472b6" },
                    { l: "SO₄²⁻",  v: selected.ion_pct.SO4_pct,   c: "#818cf8" },
                    { l: "HCO₃⁻",  v: selected.ion_pct.HCO3_pct,  c: "#22d3ee"
                     },
                  ] as const).map(ion => (
                    <div key={ion.l} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-14 text-right shrink-0" style={{ fontFamily: T.mono }}>
                        {ion.l}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${ion.v}%`, background: ion.c, boxShadow: `0 0 8px ${ion.c}55` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 w-10 text-right tabular-nums" style={{ fontFamily: T.mono }}>
                        {ion.v.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl border border-dashed p-8 text-center"
                style={{ borderColor: T.border, background: "rgba(8,13,26,0.3)" }}
              >
                <Crosshair className="w-5 h-5 text-slate-700 mx-auto mb-2" />
                <p className="text-[11px] text-slate-600" style={{ fontFamily: T.mono }}>
                  Click any well to inspect
                </p>
              </div>
            )}
          </section>

        </div>
      </aside>
    </div>
  );
}
