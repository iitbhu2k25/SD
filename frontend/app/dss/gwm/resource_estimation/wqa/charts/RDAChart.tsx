"use client";

import { useState, useMemo, useRef, type FC } from "react";
import dynamic from "next/dynamic";
import {
  GitBranch, X, Layers, Crosshair, FlaskConical,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { Layout, Config, Data, PlotMouseEvent } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ══════════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════════ */

const T = {
  bg:      "#080d1a",
  panel:   "rgba(15,23,42,0.7)",
  card:    "rgba(15,23,42,0.6)",
  border:  "rgba(255,255,255,0.08)",
  muted:   "#64748b",
  grid:    "rgba(255,255,255,0.05)",
  display: "'DM Sans', ui-sans-serif, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
  ion:     "#38bdf8",
  env:     "#f43f5e",
  well:    "#cbd5e1",
} as const;

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

export interface RDASiteScore {
  location: string;
  year?:    number;
  RDA1:     number;
  RDA2:     number;
}

export interface RDAResponseLoading {
  ion:  string;
  RDA1: number;
  RDA2: number;
}

export interface RDAExplanatoryLoading {
  variable: string;
  RDA1:     number;
  RDA2:     number;
}

export interface RDAResponse {
  site_scores:            RDASiteScore[];
  response_loadings:      RDAResponseLoading[];
  explanatory_loadings:   RDAExplanatoryLoading[];
  explained_variance_pct: number[];
}

/* ══════════════════════════════════════════════════════════════════
   SCALE HELPER
   ══════════════════════════════════════════════════════════════════ */

function computeScale(sites: RDASiteScore[], allLoadings: { r1: number; r2: number }[]) {
  const PAD = 0.5;
  const x1 = Math.min(...sites.map(s => s.RDA1)) - PAD;
  const x2 = Math.max(...sites.map(s => s.RDA1)) + PAD;
  const y1 = Math.min(...sites.map(s => s.RDA2)) - PAD;
  const y2 = Math.max(...sites.map(s => s.RDA2)) + PAD;
  const maxMag = Math.max(...allLoadings.map(l => Math.sqrt(l.r1 ** 2 + l.r2 ** 2)), 1e-6);
  return {
    LS: Math.min(x2 - x1, y2 - y1) * 0.38 / maxMag,
    xRange: [x1, x2] as [number, number],
    yRange: [y1, y2] as [number, number],
  };
}

/* ══════════════════════════════════════════════════════════════════
   SUB — SectionHeader
   ══════════════════════════════════════════════════════════════════ */

const SectionHeader: FC<{ dot: string; title: string; badge?: string }> = ({ dot, title, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500" style={{ fontFamily: T.mono }}>
      {title}
    </span>
    {badge && (
      <span className="ml-auto text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
        {badge}
      </span>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */

const RDAChartPlotly: FC<{ data: RDAResponse }> = ({ data }) => {
  const {
    site_scores: sites,
    response_loadings: resLoad,
    explanatory_loadings: expLoad,
    explained_variance_pct: ev,
  } = data;

  const [selected,    setSelected]    = useState<RDASiteScore | null>(null);
  const [hoverLoc,    setHoverLoc]    = useState<string | null>(null);
  const [showSites,   setShowSites]   = useState(true);
  const [showIons,    setShowIons]    = useState(true);
  const [showEnv,     setShowEnv]     = useState(true);
  const [panelOpen,   setPanelOpen]   = useState(true);
  const togglePanel = () => { setPanelOpen((p) => !p); setTimeout(() => window.dispatchEvent(new Event("resize")), 320); };
  const [sitesOpen,   setSitesOpen]   = useState(true);

  const graphDivRef = useRef<HTMLElement | null>(null);

  /* unique locations */
  const locations = useMemo(
    () => [...new Set(sites.map(s => s.location))],
    [sites],
  );

  /* ── Unified scale ── */
  const { LS, xRange, yRange } = useMemo(() => {
    const all = [
      ...resLoad.map(r => ({ r1: r.RDA1, r2: r.RDA2 })),
      ...expLoad.map(e => ({ r1: e.RDA1, r2: e.RDA2 })),
    ];
    if (!sites.length) return { LS: 1, xRange: [-3, 3] as [number, number], yRange: [-3, 3] as [number, number] };
    return computeScale(sites, all.length ? all : [{ r1: 1, r2: 0 }]);
  }, [sites, resLoad, expLoad]);

  /* ══════════════════════════════════════════════════════════
     TRACES
     ══════════════════════════════════════════════════════════ */
  const traces = useMemo((): Data[] => {
    const list: Data[] = [];

    if (showSites && sites.length) {
      const isSel = (s: RDASiteScore) =>
        selected?.location === s.location && selected?.year === s.year;

      list.push({
        type: "scatter", mode: "markers",
        name: "Wells",
        x: sites.map(s => s.RDA1),
        y: sites.map(s => s.RDA2),
        customdata: sites.map((_, i) => i),
        text: sites.map(s =>
          `<b>${s.location}</b>` +
          (s.year ? `<br><span style="color:${T.muted}">${s.year}</span>` : "") +
          `<br>RDA1: <b>${s.RDA1.toFixed(3)}</b>` +
          `<br>RDA2: <b>${s.RDA2.toFixed(3)}</b>`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          color:   T.well,
          opacity: sites.map(s => isSel(s) ? 1 : hoverLoc && hoverLoc !== s.location ? 0.12 : 0.65),
          size:    sites.map(s => isSel(s) ? 11 : 6),
          line: {
            color: sites.map(s => isSel(s) ? "#fff" : "rgba(255,255,255,0.2)"),
            width: sites.map(s => isSel(s) ? 2 : 1),
          },
        },
        showlegend: true,
      } as Data);
    }

    if (showIons && resLoad.length) {
      list.push({
        type: "scatter", mode: "markers+text",
        name: "Major Ions",
        x: resLoad.map(r => r.RDA1 * LS),
        y: resLoad.map(r => r.RDA2 * LS),
        text: resLoad.map(r => r.ion),
        textposition: resLoad.map(r => r.RDA2 >= 0 ? "top center" : "bottom center"),
        textfont: { color: T.ion, size: 10, family: T.mono },
        hovertemplate: resLoad.map(r =>
          `<b style="color:${T.ion}">${r.ion}</b>` +
          `<br>RDA1: ${r.RDA1.toFixed(3)}` +
          `  RDA2: ${r.RDA2.toFixed(3)}` +
          `<extra></extra>`,
        ),
        marker: {
          symbol:  "arrow-bar-up",
          size:    11,
          color:   T.ion,
          opacity: 0.9,
          angle:   resLoad.map(r => -(Math.atan2(r.RDA2, r.RDA1) * 180 / Math.PI) + 90),
          line:    { color: T.ion, width: 1 },
        },
        showlegend: true,
      } as unknown as Data);
    }

    if (showEnv && expLoad.length) {
      list.push({
        type: "scatter", mode: "markers+text",
        name: "Env Variables",
        x: expLoad.map(e => e.RDA1 * LS),
        y: expLoad.map(e => e.RDA2 * LS),
        text: expLoad.map(e => e.variable),
        textposition: expLoad.map(e => e.RDA2 >= 0 ? "top center" : "bottom center"),
        textfont: { color: T.env, size: 10, family: T.mono },
        hovertemplate: expLoad.map(e =>
          `<b style="color:${T.env}">${e.variable}</b>` +
          `<br>RDA1: ${e.RDA1.toFixed(3)}` +
          `  RDA2: ${e.RDA2.toFixed(3)}` +
          `<extra></extra>`,
        ),
        marker: {
          symbol:  "diamond",
          size:    10,
          color:   T.env,
          opacity: 0.9,
          line:    { color: T.env, width: 1 },
        },
        showlegend: true,
      } as unknown as Data);
    }

    return list;
  }, [sites, resLoad, expLoad, hoverLoc, selected, showSites, showIons, showEnv, LS]);

  /* ══════════════════════════════════════════════════════════
     LAYOUT
     ══════════════════════════════════════════════════════════ */
  const layout = useMemo((): Partial<Layout> => {
    const vectorShapes: NonNullable<Layout["shapes"]>[number][] = [
      ...(showIons ? resLoad.map(r => ({
        type:  "line" as const,
        xref:  "x" as const, yref: "y" as const,
        x0: 0, y0: 0,
        x1: r.RDA1 * LS, y1: r.RDA2 * LS,
        line: { color: T.ion, width: 1.4, dash: "dot" as const },
      })) : []),
      ...(showEnv ? expLoad.map(e => ({
        type:  "line" as const,
        xref:  "x" as const, yref: "y" as const,
        x0: 0, y0: 0,
        x1: e.RDA1 * LS, y1: e.RDA2 * LS,
        line: { color: T.env, width: 1.4, dash: "dot" as const },
      })) : []),
    ];

    return {
      paper_bgcolor: "transparent",
      plot_bgcolor:  "transparent",
      margin:        { t: 20, r: 40, b: 64, l: 68 },
      xaxis: {
        title: {
          text:     `RDA1 (${ev[0]?.toFixed(1) ?? 0}% constrained)`,
          font:     { color: "rgba(248,250,252,0.75)", size: 11, family: T.mono },
          standoff: 14,
        },
        range:         xRange,
        zeroline:      true,
        zerolinecolor: "rgba(148,163,184,0.25)",
        zerolinewidth: 1,
        gridcolor:     T.grid,
        linecolor:     "rgba(56,189,248,0.15)",
        tickfont:      { color: T.muted, size: 9, family: T.mono },
        ticks:         "outside",
        tickcolor:     "rgba(148,163,184,0.18)",
        showgrid:      true,
      },
      yaxis: {
        title: {
          text:     `RDA2 (${ev[1]?.toFixed(1) ?? 0}% constrained)`,
          font:     { color: "rgba(248,250,252,0.75)", size: 11, family: T.mono },
          standoff: 16,
        },
        range:         yRange,
        zeroline:      true,
        zerolinecolor: "rgba(148,163,184,0.25)",
        zerolinewidth: 1,
        gridcolor:     T.grid,
        linecolor:     "rgba(56,189,248,0.15)",
        tickfont:      { color: T.muted, size: 9, family: T.mono },
        ticks:         "outside",
        tickcolor:     "rgba(148,163,184,0.18)",
        showgrid:      true,
      },
      legend: {
        font:        { color: "#94a3b8", size: 11, family: T.mono },
        bgcolor:     "rgba(8,13,26,0.75)",
        bordercolor: T.border,
        borderwidth: 1,
        x: 0.01, y: 0.99,
        xanchor: "left", yanchor: "top",
        itemsizing: "constant",
        orientation: "h",
      },
      shapes:     vectorShapes,
      hovermode:  "closest",
      hoverlabel: {
        bgcolor:     "rgba(8,13,26,0.97)",
        bordercolor: "rgba(129,140,248,0.35)",
        font:        { color: "#e2e8f0", size: 11, family: T.mono },
        align:       "left",
      },
    };
  }, [resLoad, expLoad, ev, xRange, yRange, showIons, showEnv, LS]);

  const config: Partial<Config> = {
    responsive:   true,
    displaylogo:  false,
    modeBarButtonsToRemove: [
      "zoom2d",
      "pan2d",
      "zoomIn2d",
      "zoomOut2d",
      "autoScale2d",
      "resetScale2d",
      "toImage",
      "select2d",
      "lasso2d",
    ] as any,
  };

  const handleClick = (e: Readonly<PlotMouseEvent>) => {
    if (!e.points.length) return;
    const idx = e.points[0].customdata as number | undefined;
    if (idx != null && idx >= 0 && idx < sites.length) setSelected(sites[idx]);
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
          "radial-gradient(ellipse at 20% 50%,rgba(129,140,248,0.04) 0%,transparent 50%)," +
          "radial-gradient(ellipse at 80% 30%,rgba(249,115,22,0.04) 0%,transparent 50%)",
      }}
    >
      {/* ═══ LEFT CHART AREA ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-hidden">

        {/* top bar */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: T.display }}>
                <span className="text-indigo-400">RDA Biplot</span>
              </h1>
              <p className="text-[11px] text-slate-500 -mt-0.5" style={{ fontFamily: T.mono }}>
                {sites.length} sites · {resLoad.length} ions · {expLoad.length} env. vars
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
                { key: "sites", on: showSites, set: setShowSites, c: T.well, label: "Wells"       },
                { key: "ions",  on: showIons,  set: setShowIons,  c: T.ion,  label: "Ion vectors" },
                { key: "env",   on: showEnv,   set: setShowEnv,   c: T.env,  label: "Env vectors" },
              ] as const).map(btn => (
                <button
                  key={btn.key}
                  title={`Toggle ${btn.label.toLowerCase()}`}
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
                if (!graphDivRef.current || !(graphDivRef.current as any)._fullLayout) return;
                const Plotly = (await import("plotly.js-dist-min")).default;
                Plotly.relayout(graphDivRef.current, {
                  "xaxis.autorange": true,
                  "yaxis.autorange": true,
                });
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
            boxShadow:      "0 24px 64px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div className="absolute top-0 left-0 w-14 h-14 border-l-2 border-t-2 border-indigo-500/10 rounded-tl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-14 h-14 border-r-2 border-b-2 border-rose-500/10 rounded-br-2xl pointer-events-none" />
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

        {/* angle guide + vector legend */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold"
              style={{ fontFamily: T.mono }}>
              Angle Guide
            </span>
            {([
              { label: "< 90° = strong + correlation ", color: T.ion,     bg: "rgba(56,189,248,0.1)"   },
              { label: "≈ 90° = no correlation",     color: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
              { label: "> 90° = strong − correlation ", color: T.env,     bg: "rgba(244,63,94,0.1)"    },
            ]).map(item => (
              <span
                key={item.label}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/[0.04]"
                style={{ color: item.color, background: item.bg, fontFamily: T.mono }}
              >
                {item.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            {([
              { symbol: "↑", color: T.ion, label: "Ion response"     },
              { symbol: "◆", color: T.env, label: "Env. explanatory" },
            ]).map(v => (
              <div key={v.label} className="flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: v.color }}>{v.symbol}</span>
                <span className="text-[10px] text-slate-400" style={{ fontFamily: T.mono }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ═══ RIGHT PANEL ══════════════════════════════════════ */}
      <aside
        className="shrink-0 transition-all duration-300 overflow-hidden"
        style={{
          width:       panelOpen ? 340 : 0,
          borderLeft:  `1px solid ${T.border}`,
          background:  "rgba(15,23,42,0.55)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="w-[340px] h-full flex flex-col p-5 gap-5 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}
        >

          {/* ── Plot Intelligence ── */}
          <section>
            <SectionHeader dot="bg-indigo-400" title="Plot Intelligence" />
            <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-indigo-400" style={{ fontFamily: T.display }}>
                  RDA Biplot
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Redundancy Analysis (RDA) ordination showing the relationship between
                site hydrochemistry (response) and environmental drivers (explanatory).
              </p>
              <div className="space-y-2">
                {([
                  ["🔵", "Blue arrows — Major ion response loadings"],
                  ["🔴", "Rose arrows — Environmental explanatory loadings"],
                  ["⚪", "Grey dots — Site / well scores"],
                  ["📐", "Acute angle (< 90°) = positive correlation"],
                  ["👆", "Click any well to see RDA scores"],
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

          {/* ── Sites ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                style={{ fontFamily: T.mono }}
              >
                Sites
              </span>
              <span className="text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
                {locations.length}
              </span>
              <button
                onClick={() => setSitesOpen(p => !p)}
                className="ml-auto p-0.5 rounded text-slate-600 hover:text-slate-300 transition-colors"
              >
                {sitesOpen
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            {sitesOpen && (
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
                {locations.map(loc => {
                  const cnt = sites.filter(s => s.location === loc).length;
                  const isH = hoverLoc === loc;
                  const isS = selected?.location === loc;
                  return (
                    <div
                      key={loc}
                      onMouseEnter={() => setHoverLoc(loc)}
                      onMouseLeave={() => setHoverLoc(null)}
                      onClick={() => {
                        const first = sites.find(s => s.location === loc);
                        if (first) setSelected(first);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-b last:border-0"
                      style={{
                        borderColor: T.border,
                        background: isH ? "rgba(255,255,255,0.04)" : "transparent",
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0 transition-shadow duration-200"
                        style={{
                          background: T.well,
                          boxShadow:  isH ? `0 0 10px ${T.well}90` : "none",
                        }}
                      />
                      <span
                        className="text-[11px] text-slate-400 truncate flex-1"
                        style={{ fontFamily: T.mono }}
                      >
                        {loc}
                      </span>
                      <span className="text-[10px] text-slate-600 tabular-nums" style={{ fontFamily: T.mono }}>
                        {cnt}
                      </span>
                      {isS && <Crosshair className="w-3 h-3 text-indigo-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Selected Site ── */}
          <section>
            <SectionHeader dot="bg-rose-400" title="Selected Site" />
            {selected ? (
              <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100" style={{ fontFamily: T.display }}>
                      {selected.location}
                    </h4>
                    {selected.year && (
                      <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontFamily: T.mono }}>
                        Year: {selected.year}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-md text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: "RDA1", value: selected.RDA1.toFixed(4), color: "#38bdf8" },
                    { label: "RDA2", value: selected.RDA2.toFixed(4), color: "#f43f5e" },
                  ] as const).map(s => (
                    <div
                      key={s.label}
                      className="rounded-lg border px-3 py-2 text-center"
                      style={{ background: "rgba(255,255,255,0.02)", borderColor: T.border }}
                    >
                      <div className="text-[9px] text-slate-600 uppercase tracking-wider" style={{ fontFamily: T.mono }}>
                        {s.label}
                      </div>
                      <div className="text-sm font-bold mt-0.5 tabular-nums" style={{ color: s.color, fontFamily: T.mono }}>
                        {s.value}
                      </div>
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
};

export default RDAChartPlotly;
