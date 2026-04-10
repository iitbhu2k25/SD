"use client";
import { useState, useEffect, useRef, useMemo, type FC } from "react";
import * as d3 from "d3";
import dynamic from "next/dynamic";
import { Droplets, FlaskConical, Layers, Crosshair, X, ChevronDown, ChevronRight } from "lucide-react";
import type { Layout, Config, Data, PlotMouseEvent } from "plotly.js";
// Lazy-load Plotly — avoids SSR crash in Next.js
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const S3 = Math.sqrt(3);
const TRI = 200; // equilateral-triangle side (data units)
const TH = (TRI * S3) / 2; // height ≈ 173.2
const GAP = 44;
const OX = TRI + GAP; // anion x-offset = 244

const D_BOT: readonly [number, number] = [222, 22 * S3];
const D_LEFT: readonly [number, number] = [122, 122 * S3];
const D_RIGHT: readonly [number, number] = [322, 122 * S3];
const D_TOP: readonly [number, number] = [222, TH + 122 * S3];

const T = {
  bg: "#080d1a",
  panel: "rgba(15,23,42,0.65)",
  card: "rgba(15,23,42,0.6)",
  border: "rgba(255,255,255,0.06)",
  muted: "#64748b",
  grid: "rgba(148,163,184,0.08)",
  display: "'DM Sans', ui-sans-serif, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export interface IonPct {
  Ca_pct: number;
  Mg_pct: number;
  Na_pct: number;
  K_pct: number;
  HCO3_pct: number;
  CO3_pct?: number;
  SO4_pct: number;
  Cl_pct: number;
}

export interface PiperPoint {
  location: string;
  latitude?: number;
  longitude?: number;
  pH?: number;
  EC?: number;
  TDS?: number;
  Ca?: number;
  Mg?: number;
  Na?: number;
  K?: number;
  Cl?: number;
  SO4?: number;
  HCO3?: number;
  ion_pct: IonPct;
}

export interface PiperResponse {
  points: PiperPoint[];
}

interface MappedPoint extends PiperPoint {
  xy: {
    xc: number;
    yc: number;
    xa: number;
    ya: number;
    xd: number;
    yd: number;
  };
  wt: { type: string; color: string; bg: string };
}

/* ══════════════════════════════════════════════════════════════════
   WATER-TYPE
   ══════════════════════════════════════════════════════════════════ */

const WT_META: Record<string, { color: string; bg: string }> = {
  "Ca-HCO₃": { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  "Ca-Cl": { color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  "Ca-SO₄": { color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  "Mg-HCO₃": { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  "Mg-Cl": { color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "Mg-SO₄": { color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
  "Na+K-HCO₃": { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  "Na+K-Cl": { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  "Na+K-SO₄": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

function classifyWaterType(ip: IonPct) {
  const nak = ip.Na_pct + ip.K_pct;
  const hco3 = ip.HCO3_pct + (ip.CO3_pct ?? 0);
  const cat =
    ip.Ca_pct >= ip.Mg_pct && ip.Ca_pct >= nak
      ? "Ca"
      : ip.Mg_pct >= nak
        ? "Mg"
        : "Na+K";
  const an =
    hco3 >= ip.SO4_pct && hco3 >= ip.Cl_pct
      ? "HCO₃"
      : ip.SO4_pct >= ip.Cl_pct
        ? "SO₄"
        : "Cl";
  const type = `${cat}-${an}`;
  return {
    type,
    ...(WT_META[type] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" }),
  };
}

/* ══════════════════════════════════════════════════════════════════
   COLOURS
   ══════════════════════════════════════════════════════════════════ */

const PALETTE = [
  "#38bdf8",
  "#818cf8",
  "#34d399",
  "#fb923c",
  "#f472b6",
  "#22d3ee",
  "#a78bfa",
  "#fbbf24",
  "#4ade80",
  "#f87171",
];

const buildColorMap = (locs: string[]) =>
  Object.fromEntries(locs.map((l, i) => [l, PALETTE[i % PALETTE.length]]));

/* ══════════════════════════════════════════════════════════════════
   PIPER COORDINATES  (corrected — no ×0.5)
   ══════════════════════════════════════════════════════════════════ */

function piperXY(pt: PiperPoint) {
  const ca = pt.ion_pct.Ca_pct;
  const mg = pt.ion_pct.Mg_pct;
  const hco3 = pt.ion_pct.HCO3_pct + (pt.ion_pct.CO3_pct ?? 0);
  const so4 = pt.ion_pct.SO4_pct;

  const xc = 200 - 2 * ca - mg; // = 2·NaK + Mg
  const yc = S3 * mg;
  const xr = 200 - 2 * hco3 - so4; // = 2·Cl + SO4
  const yr = S3 * so4;
  const xa = OX + xr;
  const ya = yr;
  const xd = 0.5 * (xc + xa + (yc - ya) / S3);
  const yd = yc + S3 * (xd - xc);
  return { xc, yc, xa, ya, xd, yd };
}

/* ══════════════════════════════════════════════════════════════════
   GRID HELPERS
   ══════════════════════════════════════════════════════════════════ */

function catGrid(p: number) {
  return [
    { x: [200 - 2 * p, 100 - p], y: [0, S3 * (100 - p)] }, // Ca = p %
    { x: [2 * p, 100 + p], y: [0, S3 * (100 - p)] }, // NaK = p %
    { x: [p, 200 - p], y: [S3 * p, S3 * p] }, // Mg = p %  (horizontal)
  ];
}
function anGrid(p: number) {
  return [
    { x: [OX + 200 - 2 * p, OX + 100 - p], y: [0, S3 * (100 - p)] },
    { x: [OX + 2 * p, OX + 100 + p], y: [0, S3 * (100 - p)] },
    { x: [OX + p, OX + 200 - p], y: [S3 * p, S3 * p] },
  ];
}
function diaGrid(f: number) {
  const ax = D_BOT[0] + f * (D_RIGHT[0] - D_BOT[0]),
    ay = D_BOT[1] + f * (D_RIGHT[1] - D_BOT[1]);
  const bx = D_LEFT[0] + f * (D_TOP[0] - D_LEFT[0]),
    by = D_LEFT[1] + f * (D_TOP[1] - D_LEFT[1]);
  const cx = D_BOT[0] + f * (D_LEFT[0] - D_BOT[0]),
    cy = D_BOT[1] + f * (D_LEFT[1] - D_BOT[1]);
  const dx = D_RIGHT[0] + f * (D_TOP[0] - D_RIGHT[0]),
    dy = D_RIGHT[1] + f * (D_TOP[1] - D_RIGHT[1]);
  return [
    { x: [ax, bx], y: [ay, by] },
    { x: [cx, dx], y: [cy, dy] },
  ];
}

/* ══════════════════════════════════════════════════════════════════
   SUB — SectionHeader
   ══════════════════════════════════════════════════════════════════ */

const SectionHeader: FC<{ dot: string; title: string; badge?: string }> = ({
  dot,
  title,
  badge,
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
      <span
        className="ml-auto text-[10px] text-slate-600 tabular-nums"
        style={{ fontFamily: T.mono }}
      >
        {badge}
      </span>
    )}
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   SUB — WellFingerprint
   ══════════════════════════════════════════════════════════════════ */

const WellFingerprint: FC<{
  point: MappedPoint | null;
  onClose: () => void;
}> = ({ point, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!point || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const ions = [
      { l: "Ca²⁺", v: point.Ca ?? 0, c: "#34d399" },
      { l: "Mg²⁺", v: point.Mg ?? 0, c: "#38bdf8" },
      { l: "Na⁺", v: point.Na ?? 0, c: "#fbbf24" },
      { l: "K⁺", v: point.K ?? 0, c: "#fb923c" },
      { l: "Cl⁻", v: point.Cl ?? 0, c: "#f472b6" },
      { l: "SO₄²⁻", v: point.SO4 ?? 0, c: "#818cf8" },
      { l: "HCO₃⁻", v: point.HCO3 ?? 0, c: "#22d3ee" },
    ];
    const W = 300,
      H = 130,
      ml = 44,
      mr = 8,
      mt = 6,
      mb = 24;
    const pw = W - ml - mr,
      ph = H - mt - mb;
    const maxV = d3.max(ions, (d) => d.v) ?? 1;
    const xSc = d3
      .scaleBand()
      .domain(ions.map((d) => d.l))
      .range([0, pw])
      .padding(0.32);
    const ySc = d3
      .scaleLinear()
      .domain([0, maxV * 1.2])
      .range([ph, 0]);
    const g = svg.append("g").attr("transform", `translate(${ml},${mt})`);

    g.append("g")
      .call(d3.axisLeft(ySc).ticks(3).tickSize(-pw))
      .call((a) => a.select(".domain").remove())
      .call((a) => a.selectAll(".tick line").attr("stroke", T.grid))
      .call((a) =>
        a.selectAll(".tick text").attr("fill", T.muted).attr("font-size", 8),
      );

    g.selectAll<SVGRectElement, (typeof ions)[number]>("rect")
      .data(ions)
      .join("rect")
      .attr("x", (d) => xSc(d.l)!)
      .attr("width", xSc.bandwidth())
      .attr("y", ph)
      .attr("height", 0)
      .attr("rx", 3)
      .attr("fill", (d) => d.c)
      .attr("opacity", 0.82)
      .transition()
      .duration(480)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => ySc(d.v))
      .attr("height", (d) => ph - ySc(d.v));

    g.selectAll<SVGTextElement, (typeof ions)[number]>(".vl")
      .data(ions)
      .join("text")
      .attr("class", "vl")
      .attr("x", (d) => xSc(d.l)! + xSc.bandwidth() / 2)
      .attr("y", (d) => ySc(d.v) - 3)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(248,250,252,0.5)")
      .attr("font-size", 7)
      .text((d) => d.v.toFixed(0));

    g.selectAll<SVGTextElement, (typeof ions)[number]>(".xl")
      .data(ions)
      .join("text")
      .attr("class", "xl")
      .attr("x", (d) => xSc(d.l)! + xSc.bandwidth() / 2)
      .attr("y", ph + 14)
      .attr("text-anchor", "middle")
      .attr("fill", T.muted)
      .attr("font-size", 8)
      .text((d) => d.l);
  }, [point]);

  /* empty state */
  if (!point)
    return (
      <div
        className="rounded-xl border border-dashed p-8 text-center"
        style={{ borderColor: T.border, background: "rgba(8,13,26,0.3)" }}
      >
        <Crosshair className="w-5 h-5 text-slate-700 mx-auto mb-2" />
        <p
          className="text-[11px] text-slate-600"
          style={{ fontFamily: T.mono }}
        >
          Click any data point to inspect
        </p>
      </div>
    );

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: T.card, borderColor: T.border }}
    >
      {/* header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4
            className="text-sm font-bold text-slate-100"
            style={{ fontFamily: T.display }}
          >
            {point.location}
          </h4>
          <p
            className="text-[10px] text-slate-500 mt-0.5"
            style={{ fontFamily: T.mono }}
          >
            {point.latitude?.toFixed(4) ?? "-"}°N,{" "}
            {point.longitude?.toFixed(4) ?? "-"}°E
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-md"
            style={{
              color: point.wt.color,
              background: point.wt.bg,
              fontFamily: T.mono,
            }}
          >
            {point.wt.type}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-600 hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {(
          [
            {
              label: "pH",
              value: point.pH?.toFixed(1) ?? "–",
              color: "#38bdf8",
            },
            {
              label: "EC",
              value: point.EC != null ? `${point.EC}` : "–",
              color: "#818cf8",
              unit: "µS",
            },
            {
              label: "TDS",
              value: point.TDS != null ? point.TDS.toFixed(0) : "–",
              color: "#34d399",
              unit: "mg/L",
            },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className="rounded-lg border px-2.5 py-1.5 text-center"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: T.border,
            }}
          >
            <div
              className="text-[9px] text-slate-600 uppercase tracking-wider"
              style={{ fontFamily: T.mono }}
            >
              {s.label}
            </div>
            <div
              className="text-xs font-bold mt-0.5"
              style={{ color: s.color, fontFamily: T.mono }}
            >
              {s.value}
              {"unit" in s && (
                <span className="text-[8px] text-slate-600 ml-0.5">
                  {s.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ion % bars */}
      <div className="space-y-1.5 mb-3">
        {(
          [
            { l: "Ca²⁺", v: point.ion_pct.Ca_pct, c: "#34d399" },
            { l: "Mg²⁺", v: point.ion_pct.Mg_pct, c: "#38bdf8" },
            {
              l: "Na⁺+K⁺",
              v: point.ion_pct.Na_pct + point.ion_pct.K_pct,
              c: "#fbbf24",
            },
            { l: "HCO₃⁻", v: point.ion_pct.HCO3_pct, c: "#f472b6" },
            { l: "SO₄²⁻", v: point.ion_pct.SO4_pct, c: "#818cf8" },
            { l: "Cl⁻", v: point.ion_pct.Cl_pct, c: "#fb923c" },
          ] as const
        ).map((ion) => (
          <div key={ion.l} className="flex items-center gap-2">
            <span
              className="text-[10px] text-slate-500 w-14 text-right shrink-0"
              style={{ fontFamily: T.mono }}
            >
              {ion.l}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${ion.v}%`,
                  background: ion.c,
                  boxShadow: `0 0 8px ${ion.c}55`,
                }}
              />
            </div>
            <span
              className="text-[10px] text-slate-400 w-10 text-right tabular-nums"
              style={{ fontFamily: T.mono }}
            >
              {ion.v.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function PiperChartPlotly({ data }: { data: PiperResponse }) {
  const [selected, setSelected] = useState<MappedPoint | null>(null);
  const [hoverLoc, setHoverLoc] = useState<string | null>(null);
  const [showCations, setShowCations] = useState(true);
  const [showAnions, setShowAnions] = useState(true);
  const [showDiamond, setShowDiamond] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [locationsOpen, setLocationsOpen] = useState(true);

  // Trigger Plotly resize after the panel slide transition (300 ms) completes
  const togglePanel = () => {
    setPanelOpen((p) => !p);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 320);
  };

  const mapped = useMemo<MappedPoint[]>(
    () =>
      data.points.map((pt) => ({
        ...pt,
        xy: piperXY(pt),
        wt: classifyWaterType(pt.ion_pct),
      })),
    [data.points],
  );

  const locations = useMemo(
    () => [...new Set(mapped.map((d) => d.location))],
    [mapped],
  );
  const colorMap = useMemo(() => buildColorMap(locations), [locations]);

  const wtStats = useMemo(() => {
    const acc: Record<string, { count: number; color: string; bg: string }> =
      {};
    mapped.forEach((d) => {
      if (!acc[d.wt.type])
        acc[d.wt.type] = { count: 0, color: d.wt.color, bg: d.wt.bg };
      acc[d.wt.type].count++;
    });
    return Object.entries(acc).sort((a, b) => b[1].count - a[1].count);
  }, [mapped]);

  const idxMap = useMemo(() => new Map(mapped.map((m, i) => [m, i])), [mapped]);

  /* ── traces ── */
  const traces = useMemo((): Data[] => {
    const list: Data[] = [];
    const ln = (
      x: number[],
      y: number[],
      color: string,
      dash: "solid" | "dot" = "solid",
      w = 1.3,
    ) =>
      list.push({
        type: "scatter",
        mode: "lines",
        x,
        y,
        showlegend: false,
        hoverinfo: "none",
        line: { color, width: w, dash },
      } as Data);

    const OL = "rgba(56,189,248,0.58)",
      DL = "rgba(129,140,248,0.58)",
      GR = "rgba(56,189,248,0.13)";

    // outlines
    ln([0, 200, 100, 0], [0, 0, TH, 0], OL);
    ln([OX, OX + 200, OX + 100, OX], [0, 0, TH, 0], OL);
    ln(
      [D_BOT[0], D_RIGHT[0], D_TOP[0], D_LEFT[0], D_BOT[0]],
      [D_BOT[1], D_RIGHT[1], D_TOP[1], D_LEFT[1], D_BOT[1]],
      DL,
    );

    // grids
    [25, 50, 75].forEach((p) => {
      catGrid(p).forEach((l) => ln(l.x, l.y, GR, "dot", 0.7));
      anGrid(p).forEach((l) => ln(l.x, l.y, GR, "dot", 0.7));
    });
    [0.25, 0.5, 0.75].forEach((f) =>
      diaGrid(f).forEach((l) => ln(l.x, l.y, GR, "dot", 0.7)),
    );

    // projection guides for selected point
    if (selected) {
      const gd = "rgba(56,189,248,0.32)";
      ln(
        [selected.xy.xc, selected.xy.xd],
        [selected.xy.yc, selected.xy.yd],
        gd,
        "dot",
        1,
      );
      ln(
        [selected.xy.xa, selected.xy.xd],
        [selected.xy.ya, selected.xy.yd],
        gd,
        "dot",
        1,
      );
    }

    // data points
    locations.forEach((loc) => {
      const pts = mapped.filter((d) => d.location === loc);
      const color = colorMap[loc] ?? "#38bdf8";
      const isHL = hoverLoc === null || hoverLoc === loc;
      const isSel = selected?.location === loc;
      const op = isHL ? 0.88 : 0.08;
      const sz = isSel ? 11 : 8;
      const stroke = isSel ? "#fff" : "rgba(255,255,255,0.38)";
      const sw = isSel ? 2 : 1;

      const htxt = (p: MappedPoint) =>
        `<b style="color:${color}">${p.location}</b>` +
        `<br><b>Type:</b> ${p.wt.type}` +
        `<br>Ca²⁺ ${p.ion_pct.Ca_pct.toFixed(1)}%` +
        `  Mg²⁺ ${p.ion_pct.Mg_pct.toFixed(1)}%` +
        `  Na⁺+K⁺ ${(p.ion_pct.Na_pct + p.ion_pct.K_pct).toFixed(1)}%` +
        `<br>HCO₃⁻ ${p.ion_pct.HCO3_pct.toFixed(1)}%` +
        `  SO₄²⁻ ${p.ion_pct.SO4_pct.toFixed(1)}%` +
        `  Cl⁻ ${p.ion_pct.Cl_pct.toFixed(1)}%` +
        (p.TDS != null ? `<br>TDS: ${p.TDS.toFixed(0)} mg/L` : "") +
        (p.pH != null ? `  pH: ${p.pH.toFixed(1)}` : "");

      const mk = (sz: number, extra = 0) => ({
        color,
        opacity: op,
        size: sz,
        line: { color: stroke, width: sw + extra },
      });
      const cx = {
        type: "scatter" as const,
        mode: "markers" as const,
        legendgroup: loc,
        hovertemplate: "%{text}<extra></extra>",
      };
      const cd = pts.map((d) => idxMap.get(d) ?? -1);
      const tx = pts.map(htxt);

      if (showCations)
        list.push({
          ...cx,
          name: loc,
          showlegend: false,
          x: pts.map((d) => d.xy.xc),
          y: pts.map((d) => d.xy.yc),
          text: tx,
          customdata: cd,
          marker: mk(sz),
        } as Data);

      if (showAnions)
        list.push({
          ...cx,
          name: loc,
          showlegend: false,
          x: pts.map((d) => d.xy.xa),
          y: pts.map((d) => d.xy.ya),
          text: tx,
          customdata: cd,
          marker: mk(sz),
        } as Data);

      if (showDiamond)
        list.push({
          ...cx,
          name: loc,
          showlegend: false,
          x: pts.map((d) => d.xy.xd),
          y: pts.map((d) => d.xy.yd),
          text: tx,
          customdata: cd,
          marker: mk(sz + 2, 0.5),
        } as Data);
    });

    return list;
  }, [
    mapped,
    locations,
    colorMap,
    hoverLoc,
    selected,
    showCations,
    showAnions,
    showDiamond,
    idxMap,
  ]);

  /* ── layout ── */
  const layout = useMemo((): Partial<Layout> => {
    type Ann = NonNullable<Layout["annotations"]>[number];
    const lbl = (
      x: number,
      y: number,
      text: string,
      color: string,
      size = 10,
    ): Partial<Ann> => ({
      x,
      y,
      text,
      showarrow: false,
      xanchor: "center",
      yanchor: "middle",
      font: { color, size, family: T.display },
    });
    const tick = (x: number, v: number): Partial<Ann> => ({
      x,
      y: -10,
      text: `${v}`,
      showarrow: false,
      xanchor: "center",
      yanchor: "top",
      font: { color: "#475569", size: 7, family: T.mono },
    });
    return {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      margin: { t: 16, r: 16, b: 52, l: 16 },
      xaxis: {
        visible: false,
        range: [-22, OX + 222],
        scaleanchor: "y",
        scaleratio: 1,
      },
      yaxis: { visible: false, range: [-35, D_TOP[1] + 32] },

      hovermode: "closest",
      hoverlabel: {
        bgcolor: "rgba(8,13,26,0.97)",
        bordercolor: "rgba(56,189,248,0.35)",
        font: { color: "#e2e8f0", size: 11, family: T.mono },
        align: "left",
      },
      annotations: [
        lbl(0, -22, "Ca²⁺", "#94a3b8"),
        lbl(200, -22, "Na⁺+K⁺", "#94a3b8"),
        lbl(100, TH + 15, "Mg²⁺", "#94a3b8"),
        lbl(100, TH + 32, "CATIONS", "rgba(52,211,153,0.9)", 8),
        lbl(OX, -22, "HCO₃⁻", "#94a3b8"),
        lbl(OX + 200, -22, "Cl⁻", "#94a3b8"),
        lbl(OX + 100, TH + 15, "SO₄²⁻", "#94a3b8"),
        lbl(OX + 100, TH + 32, "ANIONS", "rgba(244,114,182,0.9)", 8),
        lbl(D_TOP[0], D_TOP[1] + 18, "DIAMOND", "rgba(129,140,248,0.9)", 8),
        ...[0, 25, 50, 75, 100].flatMap((p) => [
          tick(2 * p, p),
          tick(OX + 2 * p, p),
        ]),
      ] as Layout["annotations"],
    };
  }, []);
  const graphDivRef = useRef<HTMLElement | null>(null);

  const cfg: Partial<Config> = {
    responsive: true,
    displaylogo: false,
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

  const handleClick = (ev: Readonly<PlotMouseEvent>) => {
    if (!ev.points.length) return;
    const idx = ev.points[0].customdata as number | undefined;
    if (idx != null && idx >= 0 && idx < mapped.length)
      setSelected(mapped[idx]);
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
          "radial-gradient(ellipse at 18% 50%,rgba(56,189,248,0.04) 0%,transparent 52%)," +
          "radial-gradient(ellipse at 82% 20%,rgba(129,140,248,0.04) 0%,transparent 52%)",
      }}
    >
      {/* ═══ LEFT CHART AREA ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-5 gap-4 overflow-hidden">
        {/* top bar */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: T.display }}
              >
                <span className="text-cyan-400"> Piper Diagram</span>
              </h1>
              <p
                className="text-[11px] text-slate-500 -mt-0.5"
                style={{ fontFamily: T.mono }}
              >
                Hydrochemical facies · {mapped.length} wells
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* layer toggles */}
            <div
              className="flex items-center gap-1 rounded-lg p-1"
              style={{
                background: "rgb(255, 255, 255)",
                border: `1px solid ${T.border}`,
              }}
            >
              {(
                [
                  {
                    key: "cat",
                    on: showCations,
                    set: setShowCations,
                    c: "rgba(52,211,153,0.9)",
                    label: "Cations",
                  },
                  {
                    key: "ani",
                    on: showAnions,
                    set: setShowAnions,
                    c: "rgba(244,114,182,0.9)",
                    label: "Anions",
                  },
                  {
                    key: "dia",
                    on: showDiamond,
                    set: setShowDiamond,
                    c: "rgba(129,140,248,0.9)",
                    label: "Diamond",
                  },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => btn.set((p) => !p)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${
                    btn.on ? "bg-white/[0.06]" : "opacity-35 hover:opacity-60"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: btn.on ? btn.c : "#334155" }}
                  />
                  <span className="text-xs">{btn.label}</span>
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
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${T.border}`,
              }}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* chart glass panel */}
        <div
          className="flex-1 relative rounded-2xl overflow-hidden"
          style={{
            background: T.panel,
            border: `1px solid ${T.border}`,
            backdropFilter: "blur(20px)",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-cyan-500/10 rounded-tl-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-indigo-500/10 rounded-br-2xl pointer-events-none" />
          <Plot
            data={traces}
            layout={layout}
            config={cfg}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
            onClick={handleClick}
            onInitialized={(_fig, graphDiv) => {
              graphDivRef.current = graphDiv;
            }}
          />
        </div>
        {/* facies chips */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <span
            className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mr-1"
            style={{ fontFamily: T.mono }}
          >
            Facies
          </span>
          {wtStats.map(([type, { count, color, bg }]) => (
            <div
              key={type}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all"
              style={{ background: bg, borderColor: T.border }}
            >
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color, fontFamily: T.mono }}
              >
                {count}
              </span>
              <span className="text-[11px] text-slate-400">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ RIGHT PANEL ══════════════════════════════════════ */}
      <aside
        className="shrink-0 transition-all duration-300 overflow-hidden"
        style={{
          width: panelOpen ? 340 : 0,
          borderLeft: `1px solid ${T.border}`,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="w-[340px] h-full flex flex-col p-5 gap-5 overflow-y-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: `${T.border} transparent`,
          }}
        >
          {/* ── Plot Intelligence ── */}
          <section>
            <SectionHeader dot="bg-cyan-400" title="Plot Intelligence" />
            <div
              className="rounded-xl border p-4"
              style={{ background: T.card, borderColor: T.border }}
            >
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-indigo-400" />
                <h3
                  className="text-sm font-semibold text-indigo-400"
                  style={{ fontFamily: T.display }}
                >
                  Classic Piper Plot
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Classifies groundwater chemistry using major cation &amp; anion
                concentrations projected onto ternary diagrams and a central
                diamond facies field.
              </p>
              <div className="space-y-2">
                {(
                  [
                    ["🟢", "Left triangle — Cations (Ca, Mg, Na+K)"],
                    ["🔴", "Right triangle — Anions (Cl, SO₄, HCO₃)"],
                    ["🔷", "Diamond — Mixed facies / dominant water type"],
                    ["👆", "Click any point to see well fingerprint"],
                    ["🖱️", "Hover location to highlight wells on chart"],
                  ] as const
                ).map(([emoji, text]) => (
                  <div
                    key={text}
                    className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug"
                  >
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
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500"
                style={{ fontFamily: T.mono }}
              >
                Locations
              </span>
              <span
                className="text-[10px] text-slate-600 tabular-nums"
                style={{ fontFamily: T.mono }}
              >
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
            {locationsOpen && <div
              className="rounded-xl border overflow-hidden"
              style={{
                background: "rgba(8,13,26,0.4)",
                borderColor: T.border,
                maxHeight: 210,
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: `${T.border} transparent`,
              }}
            >
              {locations.map((loc) => {
                const cnt = mapped.filter((d) => d.location === loc).length;
                const isH = hoverLoc === loc;
                const isS = selected?.location === loc;
                return (
                  <div
                    key={loc}
                    onMouseEnter={() => setHoverLoc(loc)}
                    onMouseLeave={() => setHoverLoc(null)}
                    onClick={() => {
                      const first = mapped.find((d) => d.location === loc);
                      if (first) setSelected(first);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-b last:border-0"
                    style={{
                      borderColor: T.border,
                      background: isH
                        ? "rgba(255,255,255,0.04)"
                        : "transparent",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0 transition-shadow duration-200"
                      style={{
                        background: colorMap[loc],
                        boxShadow: isH ? `0 0 10px ${colorMap[loc]}90` : "none",
                      }}
                    />
                    <span
                      className="text-[11px] text-slate-400 truncate flex-1"
                      style={{ fontFamily: T.mono }}
                    >
                      {loc}
                    </span>
                    {isS && (
                      <Crosshair className="w-3 h-3 text-cyan-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>}
          </section>

          {/* ── Well Fingerprint ── */}
          <section>
            <SectionHeader dot="bg-emerald-400" title="Well Fingerprint" />
            <WellFingerprint
              point={selected}
              onClose={() => setSelected(null)}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}
