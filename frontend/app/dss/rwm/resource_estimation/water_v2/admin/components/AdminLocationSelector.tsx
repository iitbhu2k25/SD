"use client";

// Owns the full admin selection workflow:
// state → district → sub-district → year / season / product → confirm / edit / reset.
// Reads from and writes to adminLocationStore (Zustand, not Context).
import React from "react";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import WholeLoading from "@/components/app_layout/newLoading";
import { useAdminLocationStore } from "../stores/adminLocationStore";

const ALLOWED_STATE_ID = 36;
const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const SEASONS = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
const PRODUCT_TYPES = ["Water Budget", "Surplus", "Deficit", "Index"];

interface AdminLocationSelectorProps {
  onConfirm: () => void | Promise<void>;
  onEdit: () => void;
  onReset: () => void;
}

export default function AdminLocationSelector({
  onConfirm,
  onEdit,
  onReset,
}: AdminLocationSelectorProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    yearSeasonLocked,
    isLoading,
    error,
    timeScale,
    selectedYears,
    selectedSeason,
    selectedProductType,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setTimeScale,
    setSelectedYears,
    setSelectedSeason,
    setSelectedProductType,
  } = useAdminLocationStore();

  const sortedStates = React.useMemo(() => {
    const allowed = states.find((s) => s.id === ALLOWED_STATE_ID);
    const others = states
      .filter((s) => s.id !== ALLOWED_STATE_ID)
      .sort((a, b) => a.name.localeCompare(b.name));
    return allowed ? [allowed, ...others] : others;
  }, [states]);

  const yearItems = React.useMemo(
    () => YEARS.map((y) => ({ id: y, name: y.toString() })),
    [],
  );

  const districtItems = districts.map((d) => ({ id: d.id, name: d.name }));
  const subDistrictItems = subDistricts.map((sd) => ({ id: sd.id, name: sd.name }));

  const isConfirmDisabled =
    isLoading ||
    isSubmitting ||
    selectedSubDistricts.length === 0 ||
    selectedYears.length === 0 ||
    !selectedProductType ||
    !timeScale ||
    (timeScale === "seasonal" && !selectedSeason) ||
    yearSeasonLocked;

  const handleConfirmClick = React.useCallback(async () => {
    if (isConfirmDisabled) return;

    setIsSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setIsSubmitting(false);
    }
  }, [isConfirmDisabled, onConfirm]);

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      

      {/* State */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          State
        </label>
        <select
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${
            selectedState !== null
              ? "border-blue-400 bg-white text-slate-900 ring-1 ring-blue-300"
              : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
          value={selectedState ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              handleStateChange(null);
            } else {
              const id = parseInt(val);
              if (id === ALLOWED_STATE_ID) handleStateChange(id);
            }
          }}
          disabled={isLoading || selectionsLocked}
        >
          <option value="">— Choose State —</option>
          {sortedStates.map((s) => (
            <option
              key={s.id}
              value={s.id}
              disabled={s.id !== ALLOWED_STATE_ID}
              className={
                s.id === ALLOWED_STATE_ID
                  ? "bg-emerald-50 text-black font-bold"
                  : "text-slate-400"
              }
            >
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Districts */}
      <MultiSelect
        items={districtItems}
        selectedItems={selectedDistricts}
        onSelectionChange={setSelectedDistricts}
        label="Districts"
        placeholder={selectedState === null ? "Select a state first…" : "Select districts…"}
        disabled={isLoading || selectionsLocked || selectedState === null}
      />

      {/* Sub-Districts */}
      <MultiSelect
        items={subDistrictItems}
        selectedItems={selectedSubDistricts}
        onSelectionChange={setSelectedSubDistricts}
        label="Sub-Districts"
        placeholder={selectedDistricts.length === 0 ? "Select districts first…" : "Select sub-districts…"}
        disabled={isLoading || selectionsLocked || selectedDistricts.length === 0}
      />

      {/* Time Scale */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Time Scale
        </label>
        <div className="flex gap-2">
          {(["yearly", "seasonal"] as const).map((scale) => (
            <button
              key={scale}
              onClick={() => setTimeScale(scale)}
              disabled={selectionsLocked || selectedSubDistricts.length === 0}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition disabled:opacity-40 disabled:cursor-not-allowed ${
                timeScale === scale
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {scale}
            </button>
          ))}
        </div>
      </div>

      {/* Years */}
      <MultiSelect
        items={yearItems}
        selectedItems={selectedYears}
        onSelectionChange={setSelectedYears}
        label="Year(s)"
        placeholder={!timeScale ? "Select time scale first…" : "Select year(s)…"}
        disabled={selectionsLocked || !timeScale}
      />

      {/* Season */}
      {timeScale === "seasonal" && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Season
          </label>
          <select
            className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              selectedSeason
                ? "border-blue-400 bg-white text-slate-900"
                : "border-slate-300 bg-slate-50 text-slate-500"
            }`}
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            disabled={selectionsLocked}
          >
            <option value="">— Choose Season —</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Product Type */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Product Type
        </label>
        <select
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedProductType
              ? "border-blue-400 bg-white text-slate-900"
              : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
          value={selectedProductType}
          onChange={(e) => setSelectedProductType(e.target.value)}
          disabled={selectionsLocked || !timeScale}
        >
          <option value="">— Choose Product —</option>
          {PRODUCT_TYPES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {selectionsLocked ? (
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Edit Selection
          </button>
        ) : (
          <button
            onClick={handleConfirmClick}
            disabled={isConfirmDisabled}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Processing…" : "Confirm Selection"}
          </button>
        )}
        <button
          onClick={onReset}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <WholeLoading
        visible={isSubmitting}
        title="Processing Data"
        message="Preparing raster output for your selected parameters..."
      />
    </div>
  );
}
