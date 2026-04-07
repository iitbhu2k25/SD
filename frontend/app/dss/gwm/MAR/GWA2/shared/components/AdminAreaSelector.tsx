'use client';

import { Check, ChevronRight, Layers } from "lucide-react";

import { useAdminSelection } from "../hooks/useAdminSelection";
import MultiSelect from "./MultiSelect";
import SelectionPanelHeader from "./SelectionPanelHeader";

export default function AdminAreaSelector() {
  const {
    adminSelection,
    loadingStates,
    loadingDistricts,
    loadingSubDistricts,
    error,
    stateOptions,
    districtOptions,
    subDistrictOptions,
    canConfirm,
    handleStateChange,
    handleDistrictChange,
    handleSubDistrictChange,
    handleReset,
    handleConfirm,
  } = useAdminSelection();

  return (
    <div className="flex flex-col gap-3">
      <SelectionPanelHeader
        icon={<Layers className="h-4 w-4" />}
        title="Administrative Area"
        subtitle="State to District to Sub-district"
        onReset={handleReset}
      />

      {adminSelection.state && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-blue-700">{adminSelection.state.state_name}</span>
          {adminSelection.districts.length > 0 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span>{adminSelection.districts.length} district(s)</span>
            </>
          )}
          {adminSelection.subDistricts.length > 0 && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span>{adminSelection.subDistricts.length} sub-district(s)</span>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            State
          </label>
          <MultiSelect
            options={stateOptions}
            value={adminSelection.state ? [adminSelection.state.state_code] : []}
            onChange={handleStateChange}
            placeholder="Select state..."
            loading={loadingStates}
            singleSelect
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            District(s)
          </label>
          <MultiSelect
            options={districtOptions}
            value={adminSelection.districts.map((item) => item.district_code)}
            onChange={handleDistrictChange}
            placeholder="Select district(s)..."
            loading={loadingDistricts}
            disabled={!adminSelection.state}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Sub-District(s)
          </label>
          <MultiSelect
            options={subDistrictOptions}
            value={adminSelection.subDistricts.map((item) => item.subdistrict_code)}
            onChange={handleSubDistrictChange}
            placeholder="Select sub-district(s)..."
            loading={loadingSubDistricts}
            disabled={adminSelection.districts.length === 0}
          />
        </div>
      </div>

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
