"use client";

import { Calculator, Info, RotateCcw, Trophy, MapPin, ChevronRight, Zap } from "lucide-react";
import { toast } from "react-toastify";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Answer,
  CentralizedTechMap,
  DecentralizedTechMap,
  RankedResult,
  Screen,
  SystemType,
} from "@/interface/stp_suitability/stp";
import {
  BOD_SCORES,
  CENTRALIZED_TECH,
  COD_SCORES,
  COLIFORM_SCORES,
  DECENTRALIZED_TECH,
  WIZARD_STEPS,
  getBODIndex,
  getCODIndex,
  getColiformIndex,
} from "@/interface/stp_suitability/data";
import {
  getStepSequence,
  resolveRoute,
  scoreCentralized,
  scoreDecentralized,
  type CompatibilityScoreMaps,
  type SewageScoreMap,
} from "../utils/stpTechnologyScoring";
import DprCostEstimatorModal from "./ManualDprCostEstimatorModal";
import { useManualMapStore } from "../stores/manualMapStore";
import type { PolygonClusterGroup } from "../stores/manualMapStore";
import { useManualMultiStore } from "../stores/manualMultiStore";
import type { ClusterInfo } from "../services/manual_stpSuitabilityTypes";

// ── Cluster legend tooltip ────────────────────────────────────────────────────
function ClusterLegendTooltip({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-0 top-8 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-800 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white">How to read this table</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-2.5 p-3">
        {/* Cluster label */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">A</span>
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Cluster label</span> — same black circle as shown on the map. A = nearest to your polygon, B = second nearest, etc.
          </p>
        </div>
        {/* Area */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[9px] font-bold text-emerald-700">ha</span>
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-emerald-700">Area (ha)</span> — suitable land area available inside that cluster patch.
          </p>
        </div>
        {/* Distance from polygon */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[9px] font-bold text-amber-700">↔</span>
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-amber-700">Distance from polygon</span> — straight-line distance from this cluster to your drawn polygon centroid.
          </p>
        </div>
        {/* Drain number */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[9px] font-bold text-blue-700">#</span>
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-blue-700">Drain number</span> — the drain ID. Blue highlight = nearest drain to this cluster.
          </p>
        </div>
        {/* Drain distance */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[9px] font-bold text-violet-700">km</span>
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-violet-700">Road distance to drain</span> — road network distance from this cluster centroid to the drain outfall.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared cluster table body ─────────────────────────────────────────────────
function ClusterTableRows({
  clusters,
  selectedRank,
  onClusterClick,
}: {
  clusters: ClusterInfo[];
  selectedRank: number | null;
  onClusterClick: (rank: number) => void;
}) {
  return (
    <>
      {clusters.map((c, i) => {
        const label = String.fromCharCode(65 + i);
        const sortedDrains = [...c.drains].sort((a, b) => a.distance_m - b.distance_m);
        const distStr = c.dist_to_polygon_m >= 1000
          ? `${(c.dist_to_polygon_m / 1000).toFixed(2)} km`
          : `${Math.round(c.dist_to_polygon_m)} m`;
        const isSelected = selectedRank === c.cluster_rank;

        return (
          <tr key={c.cluster_rank} className="align-top">
            {/* Cluster info cell */}
            <td className="w-[100px] shrink-0 border-r border-slate-100 px-3 py-2.5">
              <div className="flex flex-col items-center gap-1">
                {/* Black circle — clickable to toggle road path on map */}
                <button
                  type="button"
                  title={isSelected ? "Click to hide road path" : "Click to show road path"}
                  onClick={() => onClusterClick(c.cluster_rank)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white transition-all duration-150 ${
                    isSelected
                      ? "bg-emerald-600 ring-2 ring-emerald-400 ring-offset-1 shadow-md scale-110"
                      : "bg-slate-800 hover:bg-slate-600 hover:scale-105"
                  }`}
                >
                  {label}
                </button>
                {/* Area + Distance from polygon — same line */}
                <div className="flex items-center gap-1">
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {c.area_ha.toFixed(2)} ha
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    {distStr}
                  </span>
                </div>
              </div>
            </td>

            {/* Drain chips — single scrollable row */}
            <td className="px-2 py-2.5">
              {sortedDrains.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  {sortedDrains.map((d, di) => (
                    <div
                      key={d.Drain_No}
                      className={`flex shrink-0 flex-col items-center rounded-lg border px-2 py-1 text-center ${
                        di === 0 ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      {/* Drain number — violet (matches map dot color) */}
                      <span className={`text-[11px] font-bold ${di === 0 ? "text-violet-700" : "text-violet-600"}`}>
                        #{d.Drain_No}
                      </span>
                      {/* Road distance — violet */}
                      <span className={`text-[10px] font-semibold ${di === 0 ? "text-violet-600" : "text-violet-400"}`}>
                        {d.distance_m >= 1000
                          ? `${(d.distance_m / 1000).toFixed(2)} km`
                          : `${Math.round(d.distance_m)} m`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">No drain data</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── Shared table shell with header + info button ──────────────────────────────
function ClusterTableShell({
  title,
  clusters,
  selectedRank,
  onClusterClick,
}: {
  title: string;
  clusters: ClusterInfo[];
  selectedRank?: number | null;
  onClusterClick?: (rank: number) => void;
}) {
  const [showLegend, setShowLegend] = useState(false);
  const hasPathLayer = Boolean(useManualMapStore((s) => s.resultPathVectorLayer));
  const effectiveSelectedRank = selectedRank ?? null;
  const handleClick = onClusterClick ?? (() => {});

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-slate-200 bg-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white">{title}</p>
        </div>
        {/* Info button */}
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          title="What do these values mean?"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
          </svg>
        </button>
        {showLegend && <ClusterLegendTooltip onClose={() => setShowLegend(false)} />}
      </div>

      {/* Column legend strip */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-800" />
          <span className="text-slate-600">Cluster</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-200" />
          <span className="text-emerald-700">Area</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-amber-200" />
          <span className="text-amber-700">From polygon</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
          <span className="text-violet-700">Drain #</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-violet-200" />
          <span className="text-violet-700">Road dist</span>
        </span>
        {hasPathLayer && onClusterClick && (
          <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-700">Click label to show path</span>
          </span>
        )}
      </div>

      {clusters.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-slate-400">No cluster data available.</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 bg-white text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="w-[100px] shrink-0 px-3 py-1.5">Cluster</th>
              <th className="px-3 py-1.5">Drains (nearest → farthest)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <ClusterTableRows
              clusters={clusters}
              selectedRank={effectiveSelectedRank}
              onClusterClick={handleClick}
            />
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Cluster distances result table (single polygon) ───────────────────────────
function ClusterDistancesTable({ clusters }: { clusters: ClusterInfo[] }) {
  const selectedClusterRank = useManualMapStore((s) => s.selectedClusterRank);
  const setSelectedClusterRank = useManualMapStore((s) => s.setSelectedClusterRank);
  const setResultPathVectorLayer = useManualMapStore((s) => s.setResultPathVectorLayer);

  // DSS mode: clusters have pre-computed path_layer — clicking toggles path on/off.
  // No-constraint mode: no path_layer — path is always visible, clicking does nothing.
  const isDssMode = clusters.some((c) => c.path_layer);

  const handleClusterClick = useCallback((clusterRank: number) => {
    const currentRank = useManualMapStore.getState().selectedClusterRank;

    // Toggle off — same cluster clicked again
    if (currentRank === clusterRank) {
      setSelectedClusterRank(clusterRank);
      setResultPathVectorLayer(null);
      return;
    }

    setSelectedClusterRank(clusterRank);
    const cluster = clusters.find((c) => c.cluster_rank === clusterRank);
    if (!cluster) return;
    setResultPathVectorLayer(cluster.path_layer ?? null);

  }, [clusters, setSelectedClusterRank, setResultPathVectorLayer]);

  return (
    <div className="mt-3">
      <ClusterTableShell
        title="Cluster Analysis & Approaching road network"
        clusters={clusters}
        selectedRank={isDssMode ? selectedClusterRank : null}
        onClusterClick={isDssMode ? handleClusterClick : undefined}
      />
    </div>
  );
}

// ── Multi-polygon cluster distances table (one section per polygon) ───────────
function MultiClusterDistancesTable({ groups }: { groups: PolygonClusterGroup[] }) {
  const selectedClusterRank = useManualMapStore((s) => s.selectedClusterRank);
  const setSelectedClusterRank = useManualMapStore((s) => s.setSelectedClusterRank);
  const setResultPathVectorLayer = useManualMapStore((s) => s.setResultPathVectorLayer);

  // Track which group is active (only one group's cluster can be selected at a time)
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  const handleClusterClick = useCallback((groupIndex: number, clusterRank: number, clusters: ClusterInfo[]) => {
    const isDssMode = clusters.some((c) => c.path_layer);
    if (!isDssMode) return;

    const currentRank = useManualMapStore.getState().selectedClusterRank;
    const isSameGroup = activeGroupIndex === groupIndex;

    // Toggle off — same cluster in same group clicked again
    if (isSameGroup && currentRank === clusterRank) {
      setSelectedClusterRank(clusterRank);
      setResultPathVectorLayer(null);
      setActiveGroupIndex(null);
      return;
    }

    setActiveGroupIndex(groupIndex);
    setSelectedClusterRank(clusterRank);
    const cluster = clusters.find((c) => c.cluster_rank === clusterRank);
    if (!cluster) return;
    setResultPathVectorLayer(cluster.path_layer ?? null);
  }, [activeGroupIndex, setSelectedClusterRank, setResultPathVectorLayer]);

  return (
    <div className="mt-3 space-y-3">
      {groups.map((group, gi) => {
        const isDssMode = group.clusters.some((c) => c.path_layer);
        const effectiveRank = activeGroupIndex === gi ? selectedClusterRank : null;
        return (
          <ClusterTableShell
            key={gi}
            title={`${group.label} — Cluster Analysis & Approaching road network`}
            clusters={group.clusters}
            selectedRank={isDssMode ? effectiveRank : null}
            onClusterClick={isDssMode ? (rank) => handleClusterClick(gi, rank, group.clusters) : undefined}
          />
        );
      })}
    </div>
  );
}

const progressByScreen: Record<Screen, number> = {
  wizard: 20,
  tech_select: 20,
  inputs: 40,
  perf_table: 60,
  results: 80,
  area: 100,
};

const screenLabels: { id: Screen; label: string }[] = [
  { id: "wizard", label: "Classification" },
  { id: "inputs", label: "Parameters" },
  { id: "perf_table", label: "Scores" },
  { id: "results", label: "Ranking" },
  { id: "area", label: "Area & Network" },
];

type ScoreReviewTab = "performance" | "cost" | "compatibility";

const scoreReviewTabs: { id: ScoreReviewTab; label: string }[] = [
  { id: "cost", label: "Cost Factors" },
  { id: "performance", label: "Performance" },
  { id: "compatibility", label: "Sewage Compatibility" },
];

export interface TechnologyAreaSubmitValues {
  landPerMld: number;
  mldCapacity: number;
  technologyName: string;
  numClusters?: number;
}

interface StpTechnologyDssProps {
  canFindArea?: boolean;
  enableDprCostEstimator?: boolean;
  isFindingArea?: boolean;
  drainCapacityMld?: number | null;
  drainCapacityRequired?: boolean;
  markedAreaHa?: number;
  initialValues?: TechnologyAreaSubmitValues | null;
  showClusterSelect?: boolean;
  onRedrawPolygon?: () => void;
  redrawPolygonLabel?: string;
  onApplyDss?: (values: TechnologyAreaSubmitValues) => void;
  onFindArea?: (values: TechnologyAreaSubmitValues) => void | boolean | Promise<void | boolean>;
}

const defaultParams = {
  Q: 5,
  Ce: 8,
  AL: 2,
  BOD: 200,
  COD: 400,
  Coliform: 500,
};

const parameterRules = {
  Q: {
    label: "STP Capacity",
    max: 1000,
    unit: "MLD",
  },
  Ce: {
    label: "Electricity",
    max: 20,
    unit: "₹/kWh",
  },
  BOD: {
    label: "BOD",
    max: 60000,
    unit: "mg/L",
  },
  COD: {
    label: "COD",
    max: 100000,
    unit: "mg/L",
  },
  Coliform: {
    label: "Coliform",
    max: 1000000000,
    unit: "MPN/100mL",
  },
} as const;

const technologyCostRules = {
  land: {
    label: "Land",
    max: 10,
    unit: "ha/MLD",
  },
  cap: {
    label: "Capital",
    max: 100,
    unit: "Cr/MLD",
  },
  om: {
    label: "O&M",
    max: 100,
    unit: "₹/m3",
  },
  energy: {
    label: "Energy",
    max: 10,
    unit: "kWh/m3",
  },
} as const;

const performanceScoreRules = {
  rel: {
    label: "Reliability",
    max: 10,
  },
  ease: {
    label: "Ease",
    max: 10,
  },
  track: {
    label: "Track",
    max: 10,
  },
} as const;

function cloneCentralizedTech(): CentralizedTechMap {
  return structuredClone(CENTRALIZED_TECH);
}

function cloneDecentralizedTech(): DecentralizedTechMap {
  return structuredClone(DECENTRALIZED_TECH);
}

function cloneCompatibilityScores(): CompatibilityScoreMaps {
  return {
    bod: structuredClone(BOD_SCORES),
    cod: structuredClone(COD_SCORES),
    coliform: structuredClone(COLIFORM_SCORES),
  };
}

function resolveInitialState(initial: TechnologyAreaSubmitValues | null | undefined) {
  if (!initial) return null;
  const cEntry = Object.entries(CENTRALIZED_TECH).find(([, t]) => t.name === initial.technologyName);
  const dEntry = Object.entries(DECENTRALIZED_TECH).find(([, t]) => t.name === initial.technologyName);
  if (!cEntry && !dEntry) return null;
  const systemType: SystemType = cEntry ? "centralized" : "decentralized";
  const key = (cEntry ?? dEntry)![0];
  return { systemType, key, Q: initial.mldCapacity };
}

interface ParamsState {
  Q: number;
  Ce: number;
  AL: number;
  BOD: number;
  COD: number;
  Coliform: number;
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  error?: string;
  onChange: (value: number) => void;
}

const getNumberInputDisplayValue = (value: number) => (value === 0 ? "" : value);

const parseNumberInputValue = (rawValue: string) => {
  if (rawValue === "" || rawValue === "0") {
    return 0;
  }

  const nextValue = Number(rawValue);
  return Number.isFinite(nextValue) ? nextValue : 0;
};

function NumberField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  unit,
  error,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={getNumberInputDisplayValue(value)}
          onChange={(event) => onChange(parseNumberInputValue(event.target.value))}
          className={`w-full rounded-xl border bg-white px-3 py-2 pr-16 text-sm text-slate-700 outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            error
              ? "border-rose-300 focus:border-rose-400"
              : "border-stone-200 focus:border-sky-300"
          }`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>}
    </label>
  );
}

function StepProgress({ screen }: { screen: Screen }) {
  const currentIndex = screenLabels.findIndex((s) => s.id === screen);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0">
        {screenLabels.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isActive = step.id === screen;
          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                    isDone
                      ? "bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                      : isActive
                        ? "border-2 border-cyan-500 bg-white text-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        : "border border-stone-300 bg-stone-50 text-slate-400"
                  }`}
                >
                  {isDone ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-[9px] font-semibold tracking-wide ${
                    isActive ? "text-cyan-600" : isDone ? "text-cyan-500" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < screenLabels.length - 1 && (
                <div
                  className={`mx-1 mb-4 h-0.5 flex-1 rounded-full transition-all ${
                    idx < currentIndex ? "bg-cyan-400" : "bg-stone-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const rankColors = [
  { bar: "from-emerald-600 to-teal-400",  badge: "bg-emerald-50 text-emerald-700 border-emerald-200", bg: "bg-emerald-50/40", selected: "border-emerald-300 bg-emerald-50/60 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]" },
  { bar: "from-sky-600 to-cyan-400",      badge: "bg-sky-50 text-sky-700 border-sky-200",             bg: "bg-sky-50/40",     selected: "border-sky-300 bg-sky-50/60 shadow-[0_0_0_1px_rgba(14,165,233,0.2)]"       },
  { bar: "from-amber-500 to-yellow-400",  badge: "bg-amber-50 text-amber-700 border-amber-200",       bg: "bg-amber-50/40",   selected: "border-amber-300 bg-amber-50/60 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]"    },
  { bar: "from-violet-600 to-fuchsia-400", badge: "bg-violet-50 text-violet-700 border-violet-200",   bg: "bg-violet-50/40",  selected: "border-violet-300 bg-violet-50/60 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]"  },
  { bar: "from-rose-500 to-pink-400",     badge: "bg-rose-50 text-rose-700 border-rose-200",          bg: "bg-rose-50/40",    selected: "border-rose-300 bg-rose-50/60 shadow-[0_0_0_1px_rgba(244,63,94,0.2)]"      },
  { bar: "from-orange-500 to-red-400",     badge: "bg-orange-50 text-orange-700 border-orange-200",    bg: "bg-orange-50/40",  selected: "border-orange-300 bg-orange-50/60 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]"   },
];

function RankingBars({
  ranked,
  selectedKey,
  onSelect,
}: {
  ranked: RankedResult[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const maxScore = ranked[0]?.total ?? 1;

  return (
    <div className="space-y-2">
      {ranked.map((item, index) => {
        const isSelected = item.key === selectedKey;
        const color = rankColors[index] ?? rankColors[rankColors.length - 1];
        const pct = Math.max(8, (item.total / maxScore) * 100);

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`w-full rounded-xl border p-2.5 text-left transition-all duration-150 ${
              isSelected
                ? color.selected
                : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${color.badge}`}>
                  #{index + 1}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{item.name}</span>
                {index === 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
                    Recommended
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-slate-500">{item.total.toFixed(1)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${color.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function StpTechnologyDss({
  canFindArea = false,
  enableDprCostEstimator = false,
  isFindingArea = false,
  drainCapacityMld,
  drainCapacityRequired = false,
  markedAreaHa = 0,
  initialValues = null,
  showClusterSelect = false,
  onRedrawPolygon,
  redrawPolygonLabel = "Redraw Polygon",
  onApplyDss,
  onFindArea,
}: StpTechnologyDssProps) {
  const resolved = resolveInitialState(initialValues);
  const [screen, setScreen] = useState<Screen>(resolved ? "area" : "wizard");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [systemType, setSystemType] = useState<SystemType | null>(resolved?.systemType ?? null);
  const [params, setParams] = useState<ParamsState>(resolved ? { ...defaultParams, Q: resolved.Q } : defaultParams);
  const [cTech, setCTech] = useState<CentralizedTechMap>(() => cloneCentralizedTech());
  const [dTech, setDTech] = useState<DecentralizedTechMap>(() => cloneDecentralizedTech());
  const [compatibilityScores, setCompatibilityScores] = useState<CompatibilityScoreMaps>(() =>
    cloneCompatibilityScores(),
  );
  const [selectedCTechs, setSelectedCTechs] = useState(Object.keys(CENTRALIZED_TECH));
  const [selectedDTechs, setSelectedDTechs] = useState(Object.keys(DECENTRALIZED_TECH));
  const [selectedResultKey, setSelectedResultKey] = useState<string | null>(resolved?.key ?? null);
  const [scoreReviewTab, setScoreReviewTab] = useState<ScoreReviewTab>("cost");
  const [parameterErrors, setParameterErrors] = useState<Partial<Record<keyof ParamsState, string>>>({});
  const [scoreInputErrors, setScoreInputErrors] = useState<Record<string, string>>({});
  const [latestScoreInputErrorKey, setLatestScoreInputErrorKey] = useState<string | null>(null);
  const [isAreaReadyForDpr, setIsAreaReadyForDpr] = useState(false);
  const [isDprEstimatorOpen, setIsDprEstimatorOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [numClusters, setNumClusters] = useState(5);
  const clusterDistances = useManualMapStore((s) => s.clusterDistances);
  const multiClusterDistances = useManualMapStore((s) => s.multiClusterDistances);

  const stepSequence = getStepSequence(answers);
  const nextStepId = stepSequence[answers.length];
  const currentStep = WIZARD_STEPS.find((step) => step.id === nextStepId);

  const isCentralized = systemType === "centralized";
  const technologyCostFields = isCentralized
    ? (["land", "cap", "om"] as const)
    : (["land", "cap", "om", "energy"] as const);
  const technologyCostFieldLabels: Record<string, string> = {
    land: "Land (ha/MLD)",
    cap: "Capital (Cr/MLD)",
    om: "O&M (₹/m3)",
    energy: "Energy (kWh/m3)",
  };
  const bodIndex = getBODIndex(params.BOD);
  const codIndex = getCODIndex(params.COD);
  const coliformIndex = getColiformIndex(params.Coliform);
  const latestScoreInputError = latestScoreInputErrorKey
    ? scoreInputErrors[latestScoreInputErrorKey]
    : null;

  const ranked = useMemo(() => {
    if (!systemType || systemType === "community") {
      return [];
    }

    return isCentralized
      ? scoreCentralized(
          params.Q,
          cTech,
          params.BOD,
          params.COD,
          params.Coliform,
          selectedCTechs,
          compatibilityScores,
        )
      : scoreDecentralized(
          params.Q,
          dTech,
          params.BOD,
          params.COD,
          params.Coliform,
          selectedDTechs,
          compatibilityScores,
        );
  }, [
    cTech,
    compatibilityScores,
    dTech,
    isCentralized,
    params,
    selectedCTechs,
    selectedDTechs,
    systemType,
  ]);

  const doResetAll = () => {
    setScreen("wizard");
    setAnswers([]);
    setSystemType(null);
    setParams(defaultParams);
    setParameterErrors({});
    setCTech(cloneCentralizedTech());
    setDTech(cloneDecentralizedTech());
    setCompatibilityScores(cloneCompatibilityScores());
    setSelectedCTechs(Object.keys(CENTRALIZED_TECH));
    setSelectedDTechs(Object.keys(DECENTRALIZED_TECH));
    setSelectedResultKey(null);
    setScoreReviewTab("cost");
    setScoreInputErrors({});
    setLatestScoreInputErrorKey(null);
    setIsAreaReadyForDpr(false);
    setIsDprEstimatorOpen(false);
    setIsConfirmResetOpen(false);
    // Clear result layers from map (single-file)
    useManualMapStore.getState().setResultVectorLayer(null);
    useManualMapStore.getState().setResultPathVectorLayer(null);
    useManualMapStore.getState().setClusterDistances(null);
    useManualMapStore.getState().setMultiClusterDistances(null);
    // Clear multi-polygon result layers from map
    useManualMultiStore.getState().setPolygonResults([]);
  };

  // Show confirmation dialog before resetting
  const resetAll = () => setIsConfirmResetOpen(true);

  const updateParameter = (field: keyof ParamsState, value: number) => {
    if (!Number.isFinite(value)) {
      setParameterErrors((current) => ({
        ...current,
        [field]: "Enter a valid number.",
      }));
      return;
    }

    const rule = parameterRules[field as keyof typeof parameterRules];
    if (!rule) {
      setParams((current) => ({ ...current, [field]: value }));
      return;
    }

    if (value > rule.max) {
      setParameterErrors((current) => ({
        ...current,
        [field]: `${rule.label} cannot exceed ${rule.max.toLocaleString()} ${rule.unit}.`,
      }));
      setParams((current) => ({ ...current, [field]: rule.max }));
      return;
    }

    setParameterErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setParams((current) => ({ ...current, [field]: value }));
  };

  const setScoreInputError = (key: string, message: string) => {
    setLatestScoreInputErrorKey(key);
    setScoreInputErrors((current) => ({
      ...current,
      [key]: message,
    }));
  };

  const clearScoreInputError = (key: string) => {
    setScoreInputErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
    setLatestScoreInputErrorKey((current) => (current === key ? null : current));
  };

  const getScoreInputClassName = (errorKey: string, widthClassName: string) =>
    `${widthClassName} rounded-lg border px-2 py-1 text-right text-xs text-slate-700 outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
      scoreInputErrors[errorKey]
        ? "border-rose-300 focus:border-rose-400"
        : "border-stone-200 focus:border-sky-300"
    }`;

  const clearScoreInputErrorsByPrefix = (prefix: string) => {
    setScoreInputErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(prefix))),
    );
    setLatestScoreInputErrorKey((current) => (current?.startsWith(prefix) ? null : current));
  };

  const updateTechnologyCostFactor = (
    key: string,
    field: string,
    value: number,
  ) => {
    const errorKey = `cost.${key}.${field}`;
    if (!Number.isFinite(value)) {
      setScoreInputError(errorKey, "Enter a valid number.");
      return;
    }

    const rule = technologyCostRules[field as keyof typeof technologyCostRules];
    const nextValue = rule && value > rule.max ? rule.max : value;

    if (rule && value > rule.max) {
      setScoreInputError(
        errorKey,
        `${rule.label} capped at ${rule.max.toLocaleString()} ${rule.unit}.`,
      );
    } else {
      clearScoreInputError(errorKey);
    }

    if (isCentralized) {
      setCTech((current) => {
        const techKey = key as keyof CentralizedTechMap;
        return {
          ...current,
          [techKey]: {
            ...current[techKey],
            [field]: nextValue,
          },
        };
      });
      return;
    }

    setDTech((current) => {
      const techKey = key as keyof DecentralizedTechMap;
      return {
        ...current,
        [techKey]: {
          ...current[techKey],
          [field]: nextValue,
        },
      };
    });
  };

  const updateTechnologyPerformanceScore = (
    key: string,
    field: keyof typeof performanceScoreRules,
    value: number,
  ) => {
    const errorKey = `performance.${key}.${field}`;
    if (!Number.isFinite(value)) {
      setScoreInputError(errorKey, "Enter a valid number.");
      return;
    }

    const rule = performanceScoreRules[field];
    const nextValue = value > rule.max ? rule.max : value;

    if (value > rule.max) {
      setScoreInputError(errorKey, `${rule.label} capped at ${rule.max}.`);
    } else {
      clearScoreInputError(errorKey);
    }

    if (isCentralized) {
      setCTech((current) => {
        const techKey = key as keyof CentralizedTechMap;
        return {
          ...current,
          [techKey]: {
            ...current[techKey],
            [field]: nextValue,
          },
        };
      });
      return;
    }

    setDTech((current) => {
      const techKey = key as keyof DecentralizedTechMap;
      return {
        ...current,
        [techKey]: {
          ...current[techKey],
          [field]: nextValue,
        },
      };
    });
  };

  const resetTechnologyCostFactors = () => {
    if (isCentralized) {
      setCTech((current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, tech]) => {
            const defaults = CENTRALIZED_TECH[key as keyof CentralizedTechMap];
            return [
              key,
              {
                ...tech,
                land: defaults.land,
                cap: defaults.cap,
                om: defaults.om,
              },
            ];
          }),
        ) as CentralizedTechMap,
      );
      clearScoreInputErrorsByPrefix("cost.");
      return;
    }

    setDTech((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, tech]) => {
          const defaults = DECENTRALIZED_TECH[key as keyof DecentralizedTechMap];
          return [
            key,
            {
              ...tech,
              land: defaults.land,
              cap: defaults.cap,
              om: defaults.om,
              energy: defaults.energy,
            },
          ];
        }),
      ) as DecentralizedTechMap,
    );
    clearScoreInputErrorsByPrefix("cost.");
  };

  const resetTechnologyPerformanceScores = () => {
    if (isCentralized) {
      setCTech((current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, tech]) => {
            const defaults = CENTRALIZED_TECH[key as keyof CentralizedTechMap];
            return [
              key,
              {
                ...tech,
                rel: defaults.rel,
                ease: defaults.ease,
                track: defaults.track,
              },
            ];
          }),
        ) as CentralizedTechMap,
      );
      clearScoreInputErrorsByPrefix("performance.");
      return;
    }

    setDTech((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, tech]) => {
          const defaults = DECENTRALIZED_TECH[key as keyof DecentralizedTechMap];
          return [
            key,
            {
              ...tech,
              rel: defaults.rel,
              ease: defaults.ease,
            },
          ];
        }),
      ) as DecentralizedTechMap,
    );
    clearScoreInputErrorsByPrefix("performance.");
  };

  const updateCompatibilityScore = (
    key: string,
    group: keyof CompatibilityScoreMaps,
    index: number,
    value: number,
  ) => {
    const errorKey = `compatibility.${key}.${group}.${index}`;
    if (!Number.isFinite(value)) {
      setScoreInputError(errorKey, "Enter a valid compatibility score.");
      return;
    }

    const nextValue = Math.min(10, Math.max(0, value));
    if (value > 10 || value < 0) {
      setScoreInputError(errorKey, "Compatibility scores must be between 0 and 10.");
    } else {
      clearScoreInputError(errorKey);
    }

    setCompatibilityScores((current) => {
      const currentRow = current[group][key] ?? [5, 5, 5, 5];
      const nextRow = [...currentRow] as [number, number, number, number];
      nextRow[index] = nextValue;

      return {
        ...current,
        [group]: {
          ...current[group],
          [key]: nextRow,
        } as SewageScoreMap,
      };
    });
  };

  const resetCompatibilityScores = () => {
    setCompatibilityScores(cloneCompatibilityScores());
    clearScoreInputErrorsByPrefix("compatibility.");
  };

  const resetActiveScoreTab = () => {
    if (scoreReviewTab === "performance") {
      resetTechnologyPerformanceScores();
      return;
    }

    if (scoreReviewTab === "compatibility") {
      resetCompatibilityScores();
      return;
    }

    resetTechnologyCostFactors();
  };

  const route = !currentStep ? resolveRoute(answers) : null;
  const routeTone =
    route?.type === "centralized"
      ? {
          panel: "border-blue-200 bg-blue-50",
          accent: "text-blue-700",
          button: "bg-blue-600 text-white hover:bg-blue-500",
          label: "Centralized STP",
        }
      : route?.type === "decentralized"
        ? {
            panel: "border-cyan-200 bg-cyan-50",
            accent: "text-cyan-800",
            button: "bg-cyan-700 text-white hover:bg-cyan-600",
            label: "Decentralized System",
          }
        : {
            panel: "border-amber-200 bg-amber-50",
            accent: "text-amber-800",
            button: "bg-amber-600 text-white hover:bg-amber-500",
            label: "Community / Onsite Solution",
          };
  const selectedRanked = ranked.find((item) => item.key === selectedResultKey) ?? ranked[0];
  const selectedRawTech =
    selectedRanked && systemType === "centralized"
      ? cTech[selectedRanked.key as keyof CentralizedTechMap]
      : selectedRanked && systemType === "decentralized"
        ? dTech[selectedRanked.key as keyof DecentralizedTechMap]
        : null;
  const stpTypeLabel =
    systemType === "centralized"
      ? "Centralized STP"
      : systemType === "decentralized"
        ? "Decentralized System"
        : "Community / Onsite Solution";
  const selectedEnergyPerDay =
    selectedRanked && "energy" in selectedRanked ? selectedRanked.energy : null;

  useEffect(() => {
    if (screen !== "results" || ranked.length === 0) {
      return;
    }

    if (!selectedResultKey || !ranked.some((item) => item.key === selectedResultKey)) {
      setSelectedResultKey(ranked[0].key);
    }
  }, [ranked, screen, selectedResultKey]);

  useEffect(() => {
    setIsAreaReadyForDpr(false);
    setIsDprEstimatorOpen(false);
  }, [params.Q, selectedRanked?.key, systemType]);

  const handleFindArea = async () => {
    if (!selectedRanked || !selectedRawTech || !onFindArea) {
      return;
    }

    setIsAreaReadyForDpr(false);
    const areaFound = await onFindArea({
      landPerMld: selectedRawTech.land,
      mldCapacity: params.Q,
      technologyName: selectedRanked.name,
      numClusters,
    });

    if (areaFound === true) {
      setIsAreaReadyForDpr(true);
    }
  };

  return (
    <>
    <section className="rounded-3xl border border-stone-200 bg-white/72 p-3 shadow-[0_16px_34px_rgba(148,163,184,0.12)] sm:p-4">
      <div className="mb-3">
        <h3 className="border-l-2 border-l-cyan-500 pl-2 text-xs font-semibold text-slate-900 sm:text-sm">
          STP Technology Selection
        </h3>
        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
          Classify the treatment system and rank suitable STP technologies.
        </p>
      </div>

      <StepProgress screen={screen} />

      {drainCapacityRequired && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Drain Capacity required.</span> Enter it in the Available Drains section on the left panel to proceed.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {screen === "wizard" && ranked.length > 0 && (
          <button
            type="button"
            onClick={() => setScreen("results")}
            className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-2.5 text-left transition hover:border-amber-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-800">Previous run: {ranked[0].name}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Jump to Results →</span>
          </button>
        )}
        {screen === "wizard" && currentStep && (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                {currentStep.label}
              </p>
              <h4 className="mt-1 text-sm font-semibold text-slate-800">
                {currentStep.question}
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {currentStep.opts.map((option) => (
                <button
                  key={option.val}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => [
                      ...current,
                      { id: currentStep.id, val: option.val, label: option.label },
                    ])
                  }
                  className="group flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:scale-[1.01] hover:border-cyan-300 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-sky-50 hover:shadow-md active:scale-[0.99]"
                >
                  <span>{option.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-cyan-500" />
                </button>
              ))}
            </div>
            {answers.length > 0 && (
              <button
                type="button"
                onClick={() => setAnswers((current) => current.slice(0, -1))}
                className="w-fit rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-stone-50"
              >
                ← Back
              </button>
            )}
          </div>
        )}

        {screen === "wizard" && !currentStep && route && (
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${routeTone.panel}`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${routeTone.accent}`}>Classification Complete</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-800">{routeTone.label}</p>
            </div>
            <div className="flex items-center gap-2">
              {route.type !== "community" && (
                <button
                  type="button"
                  disabled={drainCapacityRequired}
                  onClick={() => { setSystemType(route.type); setScreen("inputs"); }}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${drainCapacityRequired ? "cursor-not-allowed bg-stone-300 text-stone-400" : `hover:opacity-90 ${routeTone.button}`}`}
                >
                  Continue <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-stone-200 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-white"
              >
                Restart
              </button>
            </div>
          </div>
        )}

        {screen === "inputs" && systemType && systemType !== "community" && (
          <div className="space-y-3">
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                isCentralized
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-cyan-200 bg-cyan-50 text-cyan-800"
              }`}
            >
              {isCentralized ? "Centralized STP" : "Decentralized System"}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-3">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Project Setup</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NumberField
                  label={parameterRules.Q.label}
                  value={params.Q}
                  min={1}
                  max={parameterRules.Q.max}
                  unit={parameterRules.Q.unit}
                  error={parameterErrors.Q}
                  onChange={(Q) => updateParameter("Q", Q)}
                />
                <NumberField
                  label={parameterRules.Ce.label}
                  value={params.Ce}
                  min={1}
                  max={parameterRules.Ce.max}
                  step={0.5}
                  unit={parameterRules.Ce.unit}
                  error={parameterErrors.Ce}
                  onChange={(Ce) => updateParameter("Ce", Ce)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-3">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Influent Quality</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <NumberField
                  label={parameterRules.BOD.label}
                  value={params.BOD}
                  min={1}
                  max={parameterRules.BOD.max}
                  unit={parameterRules.BOD.unit}
                  error={parameterErrors.BOD}
                  onChange={(BOD) => updateParameter("BOD", BOD)}
                />
                <NumberField
                  label={parameterRules.COD.label}
                  value={params.COD}
                  min={1}
                  max={parameterRules.COD.max}
                  unit={parameterRules.COD.unit}
                  error={parameterErrors.COD}
                  onChange={(COD) => updateParameter("COD", COD)}
                />
                <NumberField
                  label={parameterRules.Coliform.label}
                  value={params.Coliform}
                  min={1}
                  max={parameterRules.Coliform.max}
                  unit={parameterRules.Coliform.unit}
                  error={parameterErrors.Coliform}
                  onChange={(Coliform) => updateParameter("Coliform", Coliform)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (
                    drainCapacityMld !== null &&
                    drainCapacityMld !== undefined &&
                    drainCapacityMld > 0 &&
                    params.Q < drainCapacityMld
                  ) {
                    toast.warn(
                      `STP Capacity (${params.Q} MLD) is less than Drain Capacity (${drainCapacityMld} MLD). Consider increasing STP Capacity.`,
                      { autoClose: 6000 }
                    );
                  }
                  setScreen("perf_table");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
              >
                Review Scores <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setScreen("wizard")}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-stone-50"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {screen === "perf_table" && systemType && systemType !== "community" && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="space-y-3 border-b border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      Review Technology Scoring
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Adjust scoring assumptions before calculating the final ranking.
                    </p>
                  </div>
                  {ranked[0] && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <span className="font-semibold">Current top:</span> {ranked[0].name}
                      <span className="ml-1 font-mono">({ranked[0].total.toFixed(1)})</span>
                    </div>
                  )}
                </div>

                <div className="flex border-b border-stone-200">
                  {scoreReviewTabs.map((tab) => {
                    const isActive = scoreReviewTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setScoreReviewTab(tab.id)}
                        className={`relative px-3 py-2 text-xs font-semibold transition-colors ${
                          isActive
                            ? "text-blue-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {tab.label}
                        {isActive && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {latestScoreInputError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {latestScoreInputError}
                  </div>
                )}
              </div>

              {scoreReviewTab === "performance" && (
                <div className="p-3">
                  <div className="max-h-72 overflow-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[34rem] bg-white text-left text-xs text-slate-600">
                      <thead className="sticky top-0 bg-stone-50 text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Technology</th>
                          <th className="px-3 py-2 font-semibold">Reliability</th>
                          <th className="px-3 py-2 font-semibold">Ease</th>
                          {isCentralized && <th className="px-3 py-2 font-semibold">Track</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(isCentralized ? cTech : dTech).map(([key, tech]) => (
                          <tr key={key} className="border-t border-stone-100 transition-colors hover:bg-slate-50/70">
                            <td className="px-3 py-2 font-semibold text-slate-700">{tech.name}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={performanceScoreRules.rel.max}
                                value={getNumberInputDisplayValue(tech.rel)}
                                onChange={(event) =>
                                  updateTechnologyPerformanceScore(key, "rel", parseNumberInputValue(event.target.value))
                                }
                                className={getScoreInputClassName(`performance.${key}.rel`, "w-14")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={performanceScoreRules.ease.max}
                                value={getNumberInputDisplayValue(tech.ease)}
                                onChange={(event) =>
                                  updateTechnologyPerformanceScore(key, "ease", parseNumberInputValue(event.target.value))
                                }
                                className={getScoreInputClassName(`performance.${key}.ease`, "w-14")}
                              />
                            </td>
                            {isCentralized && "track" in tech && (
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={performanceScoreRules.track.max}
                                  value={getNumberInputDisplayValue(tech.track)}
                                  onChange={(event) =>
                                    updateTechnologyPerformanceScore(key, "track", parseNumberInputValue(event.target.value))
                                  }
                                  className={getScoreInputClassName(`performance.${key}.track`, "w-14")}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scoreReviewTab === "cost" && (
                <div className="p-3">
                  <div className="max-h-72 overflow-auto rounded-2xl border border-stone-200">
                    <table className={`w-full bg-white text-left text-xs text-slate-600 ${
                      isCentralized ? "min-w-[34rem]" : "min-w-[42rem]"
                    }`}>
                      <thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        <tr>
                          <th className="min-w-40 px-3 py-2 font-semibold">Technology</th>
                          {technologyCostFields.map((field) => (
                            <th key={field} className="min-w-28 px-3 py-2 font-semibold">
                              {technologyCostFieldLabels[field]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(isCentralized ? cTech : dTech).map(([key, tech]) => (
                          <tr key={key} className="border-t border-stone-100 transition-colors hover:bg-slate-50/70">
                            <td className="px-3 py-2 font-semibold text-slate-700">
                              {tech.name}
                            </td>
                            {technologyCostFields.map((field) => {
                              const value = (tech as Record<string, string | number>)[field];
                              const rule = technologyCostRules[field];
                              const numVal = typeof value === "number" ? value : 0;
                              return (
                                <td key={field} className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={rule.max}
                                    step={0.01}
                                    value={getNumberInputDisplayValue(numVal)}
                                    onChange={(event) =>
                                      updateTechnologyCostFactor(key, field, parseNumberInputValue(event.target.value))
                                    }
                                    className={getScoreInputClassName(`cost.${key}.${field}`, "w-24 font-mono")}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scoreReviewTab === "compatibility" && (
                <div className="space-y-3 p-3">
                  <div className="flex items-start gap-2 rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Scores computed from your inputs: BOD <strong>{params.BOD} mg/L</strong>,
                      COD <strong>{params.COD} mg/L</strong>, Coliform{" "}
                      <strong>{params.Coliform.toLocaleString()} MPN/100mL</strong>.
                      Compatibility is the average of the three scores.
                    </span>
                  </div>

                  <div className="max-h-72 overflow-auto rounded-2xl border border-stone-200">
                    <table className="w-full min-w-[42rem] bg-white text-left text-xs text-slate-600">
                      <thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        <tr>
                          <th className="min-w-40 px-3 py-2 font-semibold">Technology</th>
                          <th className="px-3 py-2 text-center font-semibold">BOD Score</th>
                          <th className="px-3 py-2 text-center font-semibold">COD Score</th>
                          <th className="px-3 py-2 text-center font-semibold">Coliform Score</th>
                          <th className="px-3 py-2 text-center font-semibold">Compatibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(isCentralized ? cTech : dTech).map(([key, tech]) => {
                          const bodScore = (compatibilityScores.bod[key] ?? [5, 5, 5, 5])[bodIndex];
                          const codScore = (compatibilityScores.cod[key] ?? [5, 5, 5, 5])[codIndex];
                          const coliformScore =
                            (compatibilityScores.coliform[key] ?? [5, 5, 5, 5])[coliformIndex];
                          const compatibility = (
                            (bodScore + codScore + coliformScore) /
                            3
                          ).toFixed(1);

                          const compatNum = parseFloat(compatibility);
                          return (
                            <tr key={key} className="border-t border-stone-100 transition-colors hover:bg-slate-50/70">
                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {tech.name}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={getNumberInputDisplayValue(bodScore)}
                                  onChange={(event) =>
                                    updateCompatibilityScore(key, "bod", bodIndex, parseNumberInputValue(event.target.value))
                                  }
                                  className={getScoreInputClassName(`compatibility.${key}.bod.${bodIndex}`, "w-16 font-mono")}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={getNumberInputDisplayValue(codScore)}
                                  onChange={(event) =>
                                    updateCompatibilityScore(key, "cod", codIndex, parseNumberInputValue(event.target.value))
                                  }
                                  className={getScoreInputClassName(`compatibility.${key}.cod.${codIndex}`, "w-16 font-mono")}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={getNumberInputDisplayValue(coliformScore)}
                                  onChange={(event) =>
                                    updateCompatibilityScore(key, "coliform", coliformIndex, parseNumberInputValue(event.target.value))
                                  }
                                  className={getScoreInputClassName(`compatibility.${key}.coliform.${coliformIndex}`, "w-16 font-mono")}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                  compatNum >= 7 ? "bg-emerald-100 text-emerald-700" : compatNum >= 4 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                }`}>
                                  {compatibility}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end border-t border-stone-200 bg-stone-50 px-3 py-3">
                <button
                  type="button"
                  onClick={resetActiveScoreTab}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-stone-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to defaults
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScreen("results")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
              >
                <Zap className="h-4 w-4" /> Calculate Ranking
              </button>
              <button
                type="button"
                onClick={() => setScreen("inputs")}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-stone-50"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {screen === "results" && ranked.length > 0 && (
          <div className="space-y-3">
            <div className="hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top Recommendation</p>
              <h4 className="mt-1 text-base font-bold text-slate-900">{ranked[0].name}</h4>
              <p className="mt-1 text-xs text-slate-500">
                Score {ranked[0].total.toFixed(1)} · {params.Q} MLD
              </p>
            </div>

            <RankingBars
              ranked={ranked}
              selectedKey={selectedRanked?.key ?? ranked[0].key}
              onSelect={setSelectedResultKey}
            />

            {selectedRanked && (() => {
              const detailIdx = ranked.findIndex((r) => r.key === selectedRanked.key);
              const dc = rankColors[detailIdx] ?? rankColors[rankColors.length - 1];
              const dcText = dc.badge.split(" ").find((c) => c.startsWith("text-")) ?? "text-slate-600";
              const dcBorder = dc.badge.split(" ").find((c) => c.startsWith("border-")) ?? "border-slate-200";
              const dcBg = dc.badge.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-slate-50";
              return (
              <div className={`rounded-2xl border p-3 sm:p-4 ${dcBorder} ${dc.bg}`}>
                <div className="mb-3 flex flex-col gap-2">
                  <div className="min-w-0">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${dcText}`}>
                      Selected STP Details
                    </p>
                    <h4 className="mt-1 break-words text-sm font-bold leading-snug text-slate-900">
                      {selectedRanked.name}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${dcBorder} ${dcBg} ${dcText}`}>
                      {stpTypeLabel}
                    </span>
                    <span className="w-fit rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Score {selectedRanked.total.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(7.75rem,1fr))] gap-2">
                  {[
                    { label: "Capacity", value: `${params.Q.toLocaleString()} MLD` },
                    { label: "BOD", value: `${params.BOD.toLocaleString()} mg/L` },
                    { label: "COD", value: `${params.COD.toLocaleString()} mg/L` },
                    {
                      label: "Coliform",
                      value: `${params.Coliform.toLocaleString()} MPN/100mL`,
                    },
                    { label: "Electricity", value: `${params.Ce.toLocaleString()} Rs/kWh` },
                  ].map((item) => (
                    <div key={item.label} className="min-h-[4.35rem] min-w-0 rounded-xl border border-white/80 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-[13px] font-bold leading-snug text-slate-800">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(8.25rem,1fr))] gap-2">
                  {[
                    { label: "Land Required", value: `${selectedRanked.land.toFixed(2)} ha` },
                    { label: "Capital Cost", value: `${selectedRanked.cap.toFixed(1)} Cr` },
                    { label: "Annual O&M", value: `${selectedRanked.om.toFixed(2)} Cr/yr` },
                  ].map((item) => (
                    <div key={item.label} className="min-h-[4.35rem] min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-sm font-bold leading-snug text-slate-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                  {selectedEnergyPerDay !== null && (
                    <div className="min-h-[4.35rem] rounded-xl border border-stone-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-400">
                        Energy Requirement
                      </p>
                      <p className="mt-1 whitespace-nowrap text-sm font-bold text-slate-900">
                        {selectedEnergyPerDay.toFixed(0)} kWh/day
                      </p>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (markedAreaHa > 0 && selectedRanked && selectedRawTech) {
                    const landRequired = selectedRawTech.land * params.Q;
                    if (landRequired > markedAreaHa) {
                      toast.warn(
                        `Land Required (${landRequired.toFixed(2)} ha) is greater than the marked area (${markedAreaHa.toFixed(2)} ha). Consider decreasing STP Capacity or choosing a technology with lower land per MLD.`,
                        { autoClose: 8000 }
                      );
                    }
                  }
                  setScreen("area");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Area &amp; Network <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setScreen("inputs")}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-stone-50"
              >
                ← Edit Parameters
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
              >
                <RotateCcw className="mr-1 inline h-3 w-3" />New Analysis
              </button>
            </div>
          </div>
        )}

        {screen === "area" && (() => {
          const selectedIdx = ranked.findIndex((r) => r.key === (selectedRanked?.key ?? ranked[0]?.key));
          const areaColor = rankColors[selectedIdx] ?? rankColors[rankColors.length - 1];
          const landRequired = selectedRawTech ? selectedRawTech.land * params.Q : 0;
          const landViolation = markedAreaHa > 0 && landRequired > 0 && landRequired > markedAreaHa;
          return (
          <div className="space-y-3">
            <div className={`rounded-2xl border p-4 ${areaColor.selected}`}>
              <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${areaColor.badge.split(" ").find((c) => c.startsWith("text-"))}`}>Selected Technology</p>
              <p className="text-sm font-bold text-slate-800">
                {selectedRanked?.name ?? ranked[0]?.name ?? "—"}
              </p>
              {selectedRawTech && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedRawTech.land} ha/MLD · {params.Q} MLD
                </p>
              )}
            </div>

            {landViolation && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Land Required exceeds Marked Area</p>
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Land Required <strong>{landRequired.toFixed(2)} ha</strong> &gt; Marked Area <strong>{markedAreaHa.toFixed(2)} ha</strong>. Find Suitable Area is disabled.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {onRedrawPolygon && (
                    <button
                      type="button"
                      onClick={() => { doResetAll(); onRedrawPolygon(); }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 active:scale-[0.98]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      {redrawPolygonLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const vals: TechnologyAreaSubmitValues | undefined =
                        selectedRanked && selectedRawTech
                          ? { landPerMld: selectedRawTech.land, mldCapacity: params.Q, technologyName: selectedRanked.name }
                          : undefined;
                      doResetAll();
                      if (vals) onApplyDss?.(vals);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Find through DSS
                  </button>
                </div>
              </div>
            )}

            {!landViolation && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">Find Suitable Area</p>
                {showClusterSelect && (
                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Number of Clusters <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center overflow-hidden rounded-xl border border-stone-200 bg-white focus-within:border-sky-300">
                      <button
                        type="button"
                        onClick={() => setNumClusters((n) => Math.max(1, n - 1))}
                        disabled={numClusters <= 1}
                        className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-500 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                        </svg>
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={numClusters}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") { setNumClusters(1); return; }
                          const v = parseInt(raw, 10);
                          if (Number.isFinite(v)) setNumClusters(Math.min(10, Math.max(1, v)));
                        }}
                        className="w-full bg-transparent py-2 text-center text-sm font-semibold text-slate-700 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setNumClusters((n) => Math.min(10, n + 1))}
                        disabled={numClusters >= 10}
                        className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-500 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Top nearest clusters to show (1 – 10)</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleFindArea}
                  disabled={!canFindArea || !onFindArea || isFindingArea || !selectedRawTech}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    !canFindArea || !onFindArea || isFindingArea || !selectedRawTech
                      ? "cursor-not-allowed bg-slate-200 text-slate-400"
                      : "cursor-pointer bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm hover:opacity-90 active:scale-[0.98]"
                  }`}
                >
                  <MapPin className="h-4 w-4" />
                  {isFindingArea ? "Finding Area..." : "Find Suitable Area"}
                </button>
                {!canFindArea && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p className="text-[11px] font-medium text-amber-700">Run suitability analysis first to generate the STP raster.</p>
                  </div>
                )}
                {isAreaReadyForDpr && multiClusterDistances && multiClusterDistances.length > 0 && (
                  <MultiClusterDistancesTable groups={multiClusterDistances} />
                )}
                {isAreaReadyForDpr && !multiClusterDistances && clusterDistances && clusterDistances.length > 0 && (
                  <ClusterDistancesTable clusters={clusterDistances} />
                )}
              </div>
            )}

            {enableDprCostEstimator && isAreaReadyForDpr && selectedRanked && (
              <button
                type="button"
                onClick={() => setIsDprEstimatorOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98]"
              >
                <Calculator className="h-4 w-4" />
                DPR Cost Estimation
              </button>
            )}

            {!landViolation && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScreen("results")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-stone-50"
                >
                  ← Back to Ranking
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                >
                  <RotateCcw className="mr-1 inline h-3 w-3" />New Analysis
                </button>
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </section>
    {enableDprCostEstimator && selectedRanked && (
      <DprCostEstimatorModal
        isOpen={isDprEstimatorOpen}
        initialQMLD={params.Q}
        initialTechnologyKey={selectedRanked.key}
        initialTechnologyName={selectedRanked.name}
        onClose={() => setIsDprEstimatorOpen(false)}
      />
    )}

    {/* ── New Analysis confirmation dialog — portalled to body to escape stacking contexts ── */}
    {isConfirmResetOpen && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100">
              <RotateCcw className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Start New Analysis?</p>
              <p className="text-[11px] text-slate-500">This will clear the current analysis</p>
            </div>
          </div>
          {/* Body */}
          <div className="px-4 py-4">
            <p className="text-sm text-slate-600">
              All current results — including selected technology, clusters, and map layers — will be cleared. This action cannot be undone.
            </p>
          </div>
          {/* Actions */}
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setIsConfirmResetOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doResetAll}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 active:scale-[0.98]"
            >
              Yes, Clear & Restart
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
