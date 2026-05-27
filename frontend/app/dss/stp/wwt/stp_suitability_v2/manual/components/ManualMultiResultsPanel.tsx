"use client";

import { useState } from "react";
import { useManualMultiStore } from "../stores/manualMultiStore";
import type { ClusterInfo } from "../../services/stpSuitabilityTypes";

function DistanceRow({ drain }: { drain: { Drain_No: number; distance_m: number } }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pl-3 pr-2 text-xs text-slate-600">Drain {drain.Drain_No}</td>
      <td className="py-1.5 pr-3 text-right text-xs font-medium text-slate-700">
        {(drain.distance_m / 1000).toFixed(2)} km
      </td>
    </tr>
  );
}

function ClusterCard({ cluster, rank }: { cluster: ClusterInfo; rank: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Cluster #{rank}</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
          {cluster.area_ha.toFixed(2)} ha
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="pb-1 pl-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Drain
            </th>
            <th className="pb-1 pr-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Distance
            </th>
          </tr>
        </thead>
        <tbody>
          {cluster.drains.map((d) => (
            <DistanceRow key={d.Drain_No} drain={d} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolygonResultSection({ index }: { index: number }) {
  const result = useManualMultiStore((s) => s.polygonResults.find((r) => r.index === index));
  const entry = useManualMultiStore((s) => s.polygonEntries.find((e) => e.index === index));
  const [collapsed, setCollapsed] = useState(false);

  if (!result) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-emerald-50"
      >
        <span className="text-sm font-semibold text-emerald-800">
          Polygon {index + 1}
          {entry ? ` — ${entry.areaHa.toFixed(2)} ha` : ""}
        </span>
        <svg
          className={`h-4 w-4 text-emerald-600 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="space-y-2 px-4 pb-4">
          {result.clusterDistances && result.clusterDistances.length > 0 ? (
            result.clusterDistances.map((cluster) => (
              <ClusterCard key={cluster.cluster_rank} cluster={cluster} rank={cluster.cluster_rank} />
            ))
          ) : result.clusterLayer ? (
            <p className="text-xs text-slate-400 italic">Cluster found but no distance data available.</p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No suitable area found in this polygon. The area may not meet the minimum suitability threshold or required land size.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManualMultiResultsPanel() {
  const polygonResults = useManualMultiStore((s) => s.polygonResults);
  const [isOpen, setIsOpen] = useState(true);

  if (polygonResults.length === 0) return null;

  return (
    <section className="relative z-20 shrink-0 overflow-hidden border-t border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_100%)] transition-[height] duration-300 ease-in-out">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-2">
        <h3 className="text-xs font-semibold text-emerald-800">
          Multi-Area Results — {polygonResults.length} polygon(s)
        </h3>
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="rounded-full p-1 text-emerald-600 hover:bg-emerald-100"
        >
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="max-h-80 space-y-3 overflow-y-auto p-4">
          {polygonResults.map((r) => (
            <PolygonResultSection key={r.index} index={r.index} />
          ))}
        </div>
      )}
    </section>
  );
}
