'use client';

import { Check, GitBranch } from "lucide-react";

import { useDrainSelection } from "../hooks/useDrainSelection";
import MultiSelect from "./MultiSelect";
import SelectionPanelHeader from "./SelectionPanelHeader";

export default function DrainAreaSelector() {
  const {
    drainSelection,
    rivers,
    stretches,
    drains,
    loadingRivers,
    loadingStretches,
    loadingDrains,
    loadingVillages,
    error,
    canConfirm,
    selectRiver,
    selectStretch,
    selectDrains,
    toggleVillage,
    selectAllVillages,
    clearAllVillages,
    handleReset,
    handleConfirm,
  } = useDrainSelection();

  return (
    <div className="flex flex-col gap-3">
      <SelectionPanelHeader
        icon={<GitBranch className="h-4 w-4" />}
        title="Drain Area"
        subtitle="River to Stretch to Drains to Villages"
        onReset={handleReset}
      />

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            River
          </label>
          <MultiSelect
            options={rivers.map((item) => ({ value: item.id, label: item.name }))}
            value={drainSelection.river ? [drainSelection.river.id] : []}
            onChange={(values) => selectRiver(values[0])}
            placeholder="Select river..."
            loading={loadingRivers}
            singleSelect
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Stretch
          </label>
          <MultiSelect
            options={stretches.map((item) => ({ value: item.id, label: item.name }))}
            value={drainSelection.stretch ? [drainSelection.stretch.id] : []}
            onChange={(values) => selectStretch(values[0])}
            placeholder="Select stretch..."
            loading={loadingStretches}
            disabled={!drainSelection.river}
            singleSelect
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Drain(s)
          </label>
          <MultiSelect
            options={drains.map((item) => ({ value: item.id, label: item.name }))}
            value={drainSelection.drains.map((item) => item.id)}
            onChange={selectDrains}
            placeholder="Select drain(s)..."
            loading={loadingDrains}
            disabled={!drainSelection.stretch}
          />
        </div>

        {drainSelection.villages.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Villages
                </div>
                <div className="text-xs text-slate-500">
                  {drainSelection.selectedVillageIds.length} of {drainSelection.villages.length} selected
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllVillages}
                  className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={clearAllVillages}
                  className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                >
                  None
                </button>
              </div>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto p-2">
              {drainSelection.villages.map((village) => {
                const checked = drainSelection.selectedVillageIds.includes(village.shapeID);
                return (
                  <label
                    key={village.shapeID}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                      checked ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                      checked={checked}
                      onChange={() => toggleVillage(village.shapeID)}
                    />
                    <div className="min-w-0">
                      <div className={checked ? "font-medium text-blue-700" : "text-slate-700"}>
                        {village.shapeName}
                      </div>
                      {typeof village.population === "number" && village.population > 0 && (
                        <div className="text-xs text-slate-500">
                          Population: {village.population.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loadingVillages && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Loading villages...
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm}
        className={`mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
          canConfirm
            ? "bg-blue-600 text-white shadow-md hover:bg-blue-700"
            : "cursor-not-allowed bg-slate-100 text-slate-400"
        }`}
      >
        <Check className="h-4 w-4" />
        Confirm Area
      </button>
    </div>
  );
}
