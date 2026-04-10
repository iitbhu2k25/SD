"use client";

import { useState, useMemo, useRef, type FC } from "react";
import dynamic from "next/dynamic";
import {
  Atom, X, Layers, Crosshair, FlaskConical,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { Layout, Config, Data, PlotMouseEvent } from "plotly.js";
import type { PCAScore, PCALoading, PCAResponse } from "@/interface/charts";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ══════════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════════ */

const T = {
  bg:       "#080d1a",
  panel:    "rgba(15,23,42,0.7)",
  card:     "rgba(15,23,42,0.6)",
  border:   "rgba(255,255,255,0.08)",
  muted:    "#64748b",
  grid:     "rgba(148,163,184,0.09)",
  display:  "'DM Sans', ui-sans-serif, sans-serif",
  mono:     "'JetBrains Mono', ui-monospace, monospace",
  arrow:    "#f97316",
  arrowLbl: "#fb923c",
} as const;

export type { PCAScore, PCALoading, PCAResponse };

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

const PCAChartPlotly: FC<{ data: PCAResponse }> = ({ data }) => {
  const { scores, loadings, explained_variance_pct: ev, cumulative_variance_pct: cv } = data;

  const [selected,     setSelected]     = useState<PCAScore | null>(null);
  const [hoverLoc,     setHoverLoc]     = useState<string | null>(null);
  const [showScores,   setShowScores]   = useState(true);
  const [showLoadings, setShowLoadings] = useState(true);
  const [panelOpen,    setPanelOpen]    = useState(true);
  const togglePanel = () => { setPanelOpen((p) => !p); setTimeout(() => window.dispatchEvent(new Event("resize")), 320); };
  const [locsOpen,     setLocsOpen]     = useState(true);

  const graphDivRef = useRef<HTMLElement | null>(null);

  const locations     = useMemo(() => [...new Set(scores.map(s => s.location))], [scores]);
  const colorMap      = useMemo(() => buildColorMap(locations), [locations]);
  const sortedLoadings = useMemo(
    () => [...loadings].sort((a, b) => Math.sqrt(b.PC1 ** 2 + b.PC2 ** 2) - Math.sqrt(a.PC1 ** 2 + a.PC2 ** 2)),
    [loadings],
  );

  /* ── Arrow scale ── */
  const { LS, pc1Range, pc2Range } = useMemo(() => {
    if (!scores.length || !loadings.length)
      return { LS: 1, pc1Range: [-3, 3] as [number, number], pc2Range: [-3, 3] as [number, number] };
    const PAD = 0.5;
    const p1Min = Math.min(...scores.map(s => s.PC1)) - PAD;
    const p1Max = Math.max(...scores.map(s => s.PC1)) + PAD;
    const p2Min = Math.min(...scores.map(s => s.PC2)) - PAD;
    const p2Max = Math.max(...scores.map(s => s.PC2)) + PAD;
    const maxMag = Math.max(...loadings.map(l => Math.sqrt(l.PC1 ** 2 + l.PC2 ** 2)), 1e-6);
    const ls = Math.min(p1Max - p1Min, p2Max - p2Min) * 0.4 / maxMag;
    return { LS: ls, pc1Range: [p1Min, p1Max] as [number, number], pc2Range: [p2Min, p2Max] as [number, number] };
  }, [scores, loadings]);

  /* ── Traces ── */
  const traces = useMemo((): Data[] => {
    const list: Data[] = [];

    if (showScores) {
      locations.forEach(loc => {
        const pts   = scores.filter(s => s.location === loc);
        const color = colorMap[loc] ?? "#38bdf8";
        const isHL  = hoverLoc === null || hoverLoc === loc;
        const isSel = (s: PCAScore) => selected?.location === s.location && selected?.year === s.year;

        list.push({
          type: "scatter", mode: "markers",
          name: loc,
          x: pts.map(s => s.PC1),
          y: pts.map(s => s.PC2),
          customdata: pts.map((_, i) => scores.indexOf(pts[i])),
          text: pts.map(s =>
            `<b style="color:${color}">${s.location}</b>` +
            (s.year ? `<br><span style="color:${T.muted}">${s.year}</span>` : "") +
            `<br>PC1: <b>${s.PC1.toFixed(3)}</b>` +
            `<br>PC2: <b>${s.PC2.toFixed(3)}</b>`,
          ),
          hovertemplate: "%{text}<extra></extra>",
          marker: {
            color:   pts.map(s => isSel(s) ? "#ffffff" : color),
            size:    pts.map(s => isSel(s) ? 11 : isHL ? 7 : 4),
            opacity: pts.map(s => isSel(s) ? 1 : isHL ? 0.85 : 0.1),
            line: {
              color: pts.map(s => isSel(s) ? "#fff" : "rgba(255,255,255,0.35)"),
              width: pts.map(s => isSel(s) ? 2.5 : 1),
            },
          },
          legendgroup: loc,
          showlegend: false,
        } as Data);
      });
    }

    if (showLoadings && loadings.length) {
      list.push({
        type: "scatter", mode: "markers",
        x: loadings.map(l => l.PC1 * LS),
        y: loadings.map(l => l.PC2 * LS),
        text: loadings.map(l =>
          `<b style="color:${T.arrow}">${l.feature}</b>` +
          `<br>PC1: ${l.PC1.toFixed(3)}  PC2: ${l.PC2.toFixed(3)}`
        ),
        hovertemplate: "%{text}<extra></extra>",
        marker: { color: "transparent", size: 12, line: { width: 0 } },
        showlegend: false,
        name: "",
      } as Data);
    }

    return list;
  }, [scores, loadings, locations, colorMap, hoverLoc, selected, showScores, showLoadings, LS]);

  /* ── Layout ── */
  const layout = useMemo((): Partial<Layout> => {
    type Ann = NonNullable<Layout["annotations"]>[number];

    const arrowAnns: Partial<Ann>[] = showLoadings ? loadings.flatMap(l => {
      const tx = l.PC1 * LS, ty = l.PC2 * LS;
      const lx = tx * 1.14,  ly = ty * 1.14;
      return [
        {
          ax: 0, ay: 0, axref: "x", ayref: "y",
          x: tx, y: ty, xref: "x", yref: "y",
          showarrow: true, arrowhead: 2, arrowsize: 1.1, arrowwidth: 1.5,
          arrowcolor: T.arrow, text: "",
        },
        {
          x: lx, y: ly, xref: "x", yref: "y",
          text: `<b>${l.feature}</b>`,
          showarrow: false,
          font: { color: T.arrowLbl, size: 9, family: T.mono },
          xanchor: l.PC1 >= 0 ? "left" : "right",
          yanchor: l.PC2 >= 0 ? "bottom" : "top",
          bgcolor: "rgba(8,13,26,0.0)",
        },
      ] as Partial<Ann>[];
    }) : [];

    return {
      paper_bgcolor: "transparent",
      plot_bgcolor:  "transparent",
      margin: { t: 20, r: 20, b: 64, l: 68 },
      xaxis: {
        title: {
          text:     `PC1 (${ev[0]?.toFixed(1) ?? 0}% variance)`,
          font:     { color: "rgba(248,250,252,0.75)", size: 11, family: T.mono },
          standoff: 14,
        },
        range:     pc1Range,
        zeroline:  false,
        gridcolor: T.grid,
        linecolor: "rgba(56,189,248,0.2)",
        tickfont:  { color: T.muted, size: 9, family: T.mono },
        ticks:     "outside",
        tickcolor: "rgba(148,163,184,0.2)",
        showgrid:  true,
      },
      yaxis: {
        title: {
          text:     `PC2 (${ev[1]?.toFixed(1) ?? 0}% variance)`,
          font:     { color: "rgba(248,250,252,0.75)", size: 11, family: T.mono },
          standoff: 16,
        },
        range:     pc2Range,
        zeroline:  false,
        gridcolor: T.grid,
        linecolor: "rgba(56,189,248,0.2)",
        tickfont:  { color: T.muted, size: 9, family: T.mono },
        ticks:     "outside",
        tickcolor: "rgba(148,163,184,0.2)",
        showgrid:  true,
      },
      shapes: [
        {
          type: "line",
          x0: pc1Range[0], x1: pc1Range[1], y0: 0, y1: 0,
          xref: "x", yref: "y",
          line: { color: "rgba(148,163,184,0.22)", width: 1, dash: "dash" },
        },
        {
          type: "line",
          x0: 0, x1: 0, y0: pc2Range[0], y1: pc2Range[1],
          xref: "x", yref: "y",
          line: { color: "rgba(148,163,184,0.22)", width: 1, dash: "dash" },
        },
      ],
      annotations: arrowAnns as Layout["annotations"],
      hovermode: "closest",
      hoverlabel: {
        bgcolor:     "rgba(8,13,26,0.97)",
        bordercolor: "rgba(249,115,22,0.35)",
        font:        { color: "#e2e8f0", size: 11, family: T.mono },
        align:       "left",
      },
    };
  }, [loadings, ev, pc1Range, pc2Range, showLoadings, LS]);

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
    if (idx != null && idx >= 0 && idx < scores.length) setSelected(scores[idx]);
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
          "radial-gradient(ellipse at 20% 30%,rgba(249,115,22,0.04) 0%,transparent 50%)," +
          "radial-gradient(ellipse at 80% 70%,rgba(244,63,94,0.04) 0%,transparent 50%)",
      }}
    >
      {/* ═══ LEFT CHART AREA ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-hidden">

        {/* top bar */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Atom className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: T.display }}>
                <span className="text-orange-400">Factor Analysis (PCA Biplot)</span>
              </h1>
              <p className="text-[11px] text-slate-500 -mt-0.5" style={{ fontFamily: T.mono }}>
                {scores.length} samples · {loadings.length} variables · Cumul: {cv[1]?.toFixed(1)}%
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
                { key: "scores",   on: showScores,   set: setShowScores,   c: "#38bdf8", label: "Scores"   },
                { key: "loadings", on: showLoadings, set: setShowLoadings, c: T.arrow,   label: "Loadings" },
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
          <div className="absolute top-0 left-0 w-14 h-14 border-l-2 border-t-2 border-orange-500/10 rounded-tl-2xl pointer-events-none" />
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
            <SectionHeader dot="bg-orange-400" title="Plot Intelligence" />
            <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-orange-400" style={{ fontFamily: T.display }}>
                  PCA Biplot
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Principal Component Analysis reduces hydrochemical dimensionality.
                Scores show site similarity; loading arrows show variable contributions.
              </p>
              <div className="space-y-2">
                {([
                  ["🟠", "Orange arrows — variable loadings (PC1 / PC2)"],
                  ["🔵", "Coloured dots — sample scores per location"],
                  ["📐", "Arrow length = variable influence"],
                  ["📐", "Arrow angle = correlation between variables"],
                  ["👆", "Click any dot to see PC scores"],
                  ["🖱️", "Hover location list to highlight samples"],
                ] as const).map(([emoji, text]) => (
                  <div key={text} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                    <span className="text-[10px] mt-px shrink-0">{emoji}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Variance Explained ── */}
          <section>
            <SectionHeader dot="bg-amber-400" title="Variance Explained" />
            <div className="rounded-xl border p-4" style={{ background: T.card, borderColor: T.border }}>
              <div className="space-y-2">
                {ev.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-8 text-right shrink-0" style={{ fontFamily: T.mono }}>
                      PC{i + 1}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width:     `${v}%`,
                        background: i === 0 ? "#f97316" : i === 1 ? "#fb923c" : "rgba(251,146,60,0.35)",
                        boxShadow:  i < 2 ? "0 0 6px rgba(249,115,22,0.3)" : "none",
                      }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-12 text-right tabular-nums" style={{ fontFamily: T.mono }}>
                      {v.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <span className="text-[9px] text-slate-600 uppercase" style={{ fontFamily: T.mono }}>Cumulative PC1+PC2</span>
                <span className="text-xs font-bold text-orange-400 tabular-nums" style={{ fontFamily: T.mono }}>
                  {cv[1]?.toFixed(1)}%
                </span>
              </div>
            </div>
          </section>

          {/* ── Variable Loadings ── */}
          <section>
            <SectionHeader dot="bg-rose-400" title="Variable Loadings" badge={String(loadings.length)} />
            <div className="rounded-xl border p-3" style={{ background: T.card, borderColor: T.border }}>
              <div className="space-y-1 max-h-[180px] overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}>
                {sortedLoadings.map(l => (
                  <div key={l.feature} className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-white/[0.02] transition-colors">
                    <span className="text-[10px] text-orange-400 font-semibold w-20 truncate shrink-0" style={{ fontFamily: T.mono }}>
                      {l.feature}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto shrink-0" style={{ fontFamily: T.mono }}>
                      <span className="text-[9px] text-slate-500">PC1:</span>
                      <span className="text-[10px] text-slate-300 tabular-nums">{l.PC1.toFixed(3)}</span>
                      <span className="text-[8px] text-slate-700 mx-0.5">|</span>
                      <span className="text-[9px] text-slate-500">PC2:</span>
                      <span className="text-[10px] text-slate-300 tabular-nums">{l.PC2.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Locations ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
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
                  maxHeight:      180,
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
                        const first = scores.find(s => s.location === loc);
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
                      {isS && <Crosshair className="w-3 h-3 text-orange-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Selected Sample ── */}
          <section>
            <SectionHeader dot="bg-amber-400" title="Selected Sample" />
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
                    { label: "PC1", value: selected.PC1.toFixed(4), color: "#f97316" },
                    { label: "PC2", value: selected.PC2.toFixed(4), color: "#fbbf24" },
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
                  Click any sample to inspect
                </p>
              </div>
            )}
          </section>

        </div>
      </aside>
    </div>
  );
};

export default PCAChartPlotly;
