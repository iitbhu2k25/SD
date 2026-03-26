"use client";

import { useMemo, useState } from "react";
import type { Stp_area } from "../../services/stpSuitabilityTypes";

export interface TreatmentSubmitValues {
  areaId: number | null;
  mldCapacity: number;
  customLand: number;
}

interface SuitabilityTreatmentCardProps {
  areaOptions: Stp_area[];
  selectedAreaId: number | null;
  onSelectAreaId: (areaId: number | null) => void;
  onSubmit: (values: TreatmentSubmitValues) => void | Promise<void>;
  isSubmitting: boolean;
}

export default function SuitabilityTreatmentCard({
  areaOptions,
  selectedAreaId,
  onSelectAreaId,
  onSubmit,
  isSubmitting,
}: SuitabilityTreatmentCardProps) {
  const [mldCapacity, setMldCapacity] = useState(20);
  const [customLand, setCustomLand] = useState(0);

  const computedRows = useMemo(
    () =>
      areaOptions.map((option) => ({
        ...option,
        computedArea: Number(option.tech_value) * Number(mldCapacity || 0),
      })),
    [areaOptions, mldCapacity],
  );

  return (
    <section className="rounded-3xl border border-stone-200 bg-white/72 p-4 shadow-[0_16px_34px_rgba(148,163,184,0.12)]">
      <div className="mb-3">
        <h3 className="border-l-2 border-l-amber-400 pl-2 text-sm font-semibold text-slate-900">
          Treatment Area Finder
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Estimate required land and request the treatment cluster layer.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            MLD Capacity
          </span>
          <input
            type="number"
            min={1}
            max={200}
            value={mldCapacity}
            onChange={(event) => setMldCapacity(Number(event.target.value))}
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Available Technologies</span>
            <span>{computedRows.length}</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="min-w-full bg-white text-left text-xs text-slate-600">
              <thead className="bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Technology</th>
                  <th className="px-3 py-2 font-semibold">Area (ha)</th>
                </tr>
              </thead>
              <tbody>
                {computedRows.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100">
                    <td className="px-3 py-2">{row.tech_name}</td>
                    <td className="px-3 py-2">{row.computedArea.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Treatment Technology
          </span>
          <select
            value={selectedAreaId ?? ""}
            onChange={(event) =>
              onSelectAreaId(
                event.target.value ? Number.parseInt(event.target.value, 10) : null,
              )
            }
            className="w-full cursor-pointer rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:bg-white"
          >
            <option value="">Select a technology</option>
            {areaOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.tech_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Custom Land Area</span>
            <span>{customLand.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={customLand}
            onChange={(event) => setCustomLand(Number(event.target.value))}
            className="w-full cursor-pointer accent-fuchsia-600"
          />
        </label>

        <button
          type="button"
          onClick={() =>
            onSubmit({
              areaId: selectedAreaId,
              mldCapacity,
              customLand,
            })
          }
          disabled={isSubmitting || areaOptions.length === 0}
          className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold transition ${
            isSubmitting || areaOptions.length === 0
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200 hover:from-amber-400 hover:to-orange-400"
          }`}
        >
          {isSubmitting ? "Finding Cluster..." : "Find Treatment Cluster"}
        </button>
      </div>
    </section>
  );
}
