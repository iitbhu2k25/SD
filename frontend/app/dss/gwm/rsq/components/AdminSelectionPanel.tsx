"use client";

import { useMemo } from "react";
import MultiSelect from "./MultiSelect";
import { useRsqAdmin } from "./RsqState";

interface AdminSelectionPanelProps {
  locked: boolean;
  onConfirm: () => void;
}

export default function AdminSelectionPanel({ locked, onConfirm }: AdminSelectionPanelProps) {
  const {
    sortedStates,
    allowedDistrictIds,
    districts,
    blocks,
    villages,
    selectedState,
    selectedDistricts,
    selectedBlocks,
    selectedVillages,
    isLoading,
    error,
    setSelectedState,
    setSelectedDistricts,
    setSelectedBlocks,
    setSelectedVillages,
    reset,
  } = useRsqAdmin();

  const districtOptions = useMemo(
    () =>
      districts
        .map((district) => {
          const allowed = allowedDistrictIds.includes(Number(district.id));
          return {
            ...district,
            disabled: !allowed,
            name: allowed ? district.name : `${district.name} (Not Available)`,
          };
        })
        .sort((a, b) => Number(b.disabled === false) - Number(a.disabled === false)),
    [districts]
  );

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-800">Administrative Location</div>
          </div>
          <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-blue-600">
            Reset
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">State</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedState || ""}
              onChange={(event) => setSelectedState(event.target.value || null)}
              disabled={locked || isLoading}
            >
              <option value="">Select state...</option>
              {sortedStates.map((state) => (
                <option key={state.id} value={state.id} disabled={Number(state.id) !== 9}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          <MultiSelect
            items={districtOptions}
            selectedItems={selectedDistricts}
            onSelectionChange={(ids) => setSelectedDistricts(ids.map(String).filter((id) => allowedDistrictIds.includes(Number(id))))}
            label="District(s)"
            placeholder="Select district(s)..."
            disabled={!selectedState || locked || isLoading}
            itemDisabled={(item) => Boolean((item as any).disabled)}
          />

          <MultiSelect
            items={blocks}
            selectedItems={selectedBlocks}
            onSelectionChange={(ids) => setSelectedBlocks(ids.map(String))}
            label="Sub-District(s)"
            placeholder="Select sub-district(s)..."
            disabled={selectedDistricts.length === 0 || locked || isLoading}
          />

          <MultiSelect
            items={villages}
            selectedItems={selectedVillages}
            onSelectionChange={(ids) => setSelectedVillages(ids.map(String))}
            label="Village(s)"
            placeholder="Select village(s)..."
            disabled={selectedBlocks.length === 0 || locked || isLoading}
          />

          <button
            type="button"
            disabled={selectedVillages.length === 0}
            onClick={onConfirm}
            className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 transition enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
