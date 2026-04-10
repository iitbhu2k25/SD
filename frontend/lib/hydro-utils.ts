/* ═══════════════════════════════════════════════════════════════
   lib/hydro-utils.ts — Shared utilities for HydroGeoViz charts
   ═══════════════════════════════════════════════════════════════ */

import type { IonPercent, WaterTypeInfo } from "@/interface/charts";

/* ── Colour palette ───────────────────────────────────────── */
export const LOCATION_PALETTE = [
  "#38bdf8", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb923c",
  "#22d3ee", "#e879f9", "#f87171", "#4ade80", "#facc15", "#818cf8",
] as const;

export function buildColorMap(locations: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  locations.forEach((loc, i) => {
    map[loc] = LOCATION_PALETTE[i % LOCATION_PALETTE.length];
  });
  return map;
}

/* ── Water type classification ────────────────────────────── */
export function classifyWaterType(ion: IonPercent): WaterTypeInfo {
  const ca = ion.Ca_pct;
  const mg = ion.Mg_pct;
  const nak = ion.Na_pct + ion.K_pct;
  const hco3 = ion.HCO3_pct + (ion.CO3_pct || 0);
  const cl = ion.Cl_pct;
  const so4 = ion.SO4_pct;

  if (ca > 50 && hco3 > 50)
    return { type: "Ca–HCO₃", color: "#34d399", bg: "rgba(52,211,153,0.12)" };
  if (nak > 50 && cl > 50)
    return { type: "Na–Cl", color: "#f472b6", bg: "rgba(244,114,182,0.12)" };
  if (nak > 50 && hco3 > 50)
    return { type: "Na–HCO₃", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" };
  if (ca > 50 && cl > 50)
    return { type: "Ca–Cl", color: "#fb923c", bg: "rgba(251,146,60,0.12)" };
  if (mg > 40)
    return { type: "Mg–type", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" };
  if (so4 > 40)
    return { type: "SO₄–type", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  return { type: "Mixed", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
}

/* ── SVG constants for dark theme ─────────────────────────── */
export const THEME = {
  bg: "#080d1a",
  panelBg: "rgba(15,23,42,0.65)",
  panelBorder: "rgba(255,255,255,0.08)",
  cardBg: "rgba(8,13,26,0.7)",

  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "rgba(148,163,184,0.6)",

  gridLine: "rgba(148,163,184,0.12)",
  triStroke: "rgba(148,163,184,0.35)",
  tickLabel: "rgba(148,163,184,0.55)",

  axisLine: "rgba(148,163,184,0.25)",
  axisText: "rgba(203,213,225,0.65)",
  zeroLine: "rgba(148,163,184,0.2)",

  cationColor: "#34d399",
  anionColor: "#f472b6",
  diamondColor: "#38bdf8",

  cationFill: "rgba(52,211,153,0.06)",
  anionFill: "rgba(244,114,182,0.06)",
  diamondFill: "rgba(56,189,248,0.06)",

  fontDisplay: "'Syne', sans-serif",
  fontMono: "'DM Mono', monospace",
  fontBody: "'DM Sans', sans-serif",
} as const;

/* ── D3 SVG helpers ───────────────────────────────────────── */
export function appendGlow(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, id: string): void {
  const glow = defs
    .append("filter")
    .attr("id", id)
    .attr("x", "-100%")
    .attr("y", "-100%")
    .attr("width", "300%")
    .attr("height", "300%");
  glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "b");
  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in", "b");
  merge.append("feMergeNode").attr("in", "SourceGraphic");
}

/* ── Triangle gridlines ───────────────────────────────────── */
export function drawTernaryGrid(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  bl: { x: number; y: number },
  br: { x: number; y: number },
  top: { x: number; y: number },
  tx: (x: number) => number,
  ty: (y: number) => number,
  strokeColor = THEME.gridLine,
): void {
  [25, 50, 75].forEach((pct) => {
    const t = pct / 100;
    // Parallel to base
    const a = { x: bl.x + (top.x - bl.x) * t, y: bl.y + (top.y - bl.y) * t };
    const b = { x: br.x + (top.x - br.x) * t, y: br.y + (top.y - br.y) * t };
    g.append("line")
      .attr("x1", tx(a.x)).attr("y1", ty(a.y))
      .attr("x2", tx(b.x)).attr("y2", ty(b.y))
      .attr("stroke", strokeColor).attr("stroke-width", 0.7);
    // Parallel to left edge
    const c = { x: bl.x + (br.x - bl.x) * t, y: bl.y };
    const d = { x: top.x + (br.x - top.x) * t, y: top.y + (br.y - top.y) * t };
    g.append("line")
      .attr("x1", tx(c.x)).attr("y1", ty(c.y))
      .attr("x2", tx(d.x)).attr("y2", ty(d.y))
      .attr("stroke", strokeColor).attr("stroke-width", 0.7);
    // Parallel to right edge
    const e = { x: br.x + (bl.x - br.x) * t, y: br.y };
    const f = { x: top.x + (bl.x - top.x) * t, y: top.y + (bl.y - top.y) * t };
    g.append("line")
      .attr("x1", tx(e.x)).attr("y1", ty(e.y))
      .attr("x2", tx(f.x)).attr("y2", ty(f.y))
      .attr("stroke", strokeColor).attr("stroke-width", 0.7);
  });
}