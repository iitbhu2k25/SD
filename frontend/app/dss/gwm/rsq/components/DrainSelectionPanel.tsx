"use client";

import MultiSelect from "./MultiSelect";
import { useRsqDrain } from "./RsqState";

interface DrainSelectionPanelProps {
  locked: boolean;
  onConfirm: () => void;
}

export default function DrainSelectionPanel({ locked, onConfirm }: DrainSelectionPanelProps) {
  const {
    rivers,
    stretches,
    drains,
    catchments,
    villages,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    isLoading,
    error,
    areaConfirmed,
    setSelectedRiver,
    setSelectedStretch,
    setSelectedDrain,
    setSelectedVillages,
    confirmArea,
    reset,
  } = useRsqDrain();

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-800">Drain Location</div>
          <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-blue-600">
            Reset
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">River</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedRiver || ""}
              onChange={(event) => setSelectedRiver(Number(event.target.value))}
              disabled={locked || isLoading || areaConfirmed}
            >
              <option value="">Select river...</option>
              {rivers.map((river) => (
                <option key={river.code} value={river.code}>
                  {river.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Stretch</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedStretch || ""}
              onChange={(event) => setSelectedStretch(Number(event.target.value))}
              disabled={!selectedRiver || locked || isLoading || areaConfirmed}
            >
              <option value="">Select stretch...</option>
              {stretches.map((stretch) => (
                <option key={stretch.stretchId} value={stretch.stretchId}>
                  {stretch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Drain</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedDrain || ""}
              onChange={(event) => setSelectedDrain(Number(event.target.value))}
              disabled={!selectedStretch || locked || isLoading || areaConfirmed}
            >
              <option value="">Select drain...</option>
              {drains.map((drain) => (
                <option key={drain.drainNo} value={drain.drainNo}>
                  Drain {drain.drainNo}
                </option>
              ))}
            </select>
          </div>

          <MultiSelect
            items={villages.map((village) => ({ id: village.code, name: village.name }))}
            selectedItems={selectedVillages}
            onSelectionChange={(ids) => setSelectedVillages(ids.map((id) => Number(id)))}
            label="Village(s)"
            placeholder="Select village(s)..."
            disabled={(!selectedDrain || catchments.length === 0) || locked || isLoading || areaConfirmed}
          />

          {selectedDrain && catchments.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {selectedCatchments.length} catchments auto-selected for Drain {selectedDrain}.
            </div>
          )}

          <button
            type="button"
            disabled={selectedVillages.length === 0}
            onClick={() => {
              confirmArea();
              onConfirm();
            }}
            className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 transition enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
