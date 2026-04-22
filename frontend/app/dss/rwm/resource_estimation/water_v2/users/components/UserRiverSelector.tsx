"use client";

// Owns the full basin selection workflow:
// river → stretch → drain → year / season / product → confirm / edit / reset.
// Reads from and writes to userRiverStore (Zustand, not Context).
import React from "react";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import WholeLoading from "@/components/app_layout/newLoading";
import { useUserRiverStore } from "../stores/userRiverStore";

const YEARS = Array.from({ length: 10 }, (_, i) => 2015 + i);
const SEASONS = ["Pre-Monsoon", "Monsoon", "Post-Monsoon", "Winter"];
const PRODUCT_TYPES = ["Water Budget", "Surplus", "Deficit", "Index"];

interface UserRiverSelectorProps {
  onConfirm: () => void | Promise<void>;
  onReset: () => void;
}

export default function UserRiverSelector({
  onConfirm,
  onReset,
}: UserRiverSelectorProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const {
    rivers,
    allStretchIds,
    allDrainIds,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectionsLocked,
    isLoading,
    error,
    timeScale,
    selectedYears,
    selectedSeason,
    selectedProductType,
    handleRiverChange,
    setSelectedStretch,
    setSelectedDrain,
    setTimeScale,
    setSelectedYears,
    setSelectedSeason,
    setSelectedProductType,
    editSelections,
  } = useUserRiverStore();

  const yearItems = React.useMemo(
    () => YEARS.map((y) => ({ id: y, name: y.toString() })),
    [],
  );

  const stretchItems = allStretchIds.map((id) => ({ id, name: `Stretch ${id}` }));
  const drainItems = allDrainIds.map((id) => ({ id, name: `Drain ${id}` }));

  const isConfirmDisabled =
    isLoading ||
    isSubmitting ||
    selectedDrain === null ||
    selectedYears.length === 0 ||
    !selectedProductType ||
    !timeScale ||
    (timeScale === "seasonal" && !selectedSeason);

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

     

      {/* River */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          River
        </label>
        <select
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 ${
            selectedRiver !== null
              ? "border-green-400 bg-white text-slate-900 ring-1 ring-green-300"
              : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
          value={selectedRiver ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            handleRiverChange(val ? parseInt(val) : null);
          }}
          disabled={isLoading || selectionsLocked}
        >
          <option value="">— Choose a River —</option>
          {rivers.map((r) => (
            <option key={r.River_Code} value={r.River_Code}>
              {r.River_Name}
            </option>
          ))}
        </select>
      </div>

      {/* Stretch */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Stretch
        </label>
        <select
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedStretch !== null
              ? "border-green-400 bg-white text-slate-900"
              : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
          value={selectedStretch ?? ""}
          onChange={(e) =>
            setSelectedStretch(e.target.value ? parseInt(e.target.value) : null)
          }
          disabled={selectionsLocked || allStretchIds.length === 0}
        >
          <option value="">{allStretchIds.length === 0 ? "— Select a river first —" : "— Choose Stretch —"}</option>
          {stretchItems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Drain */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
          Drain
        </label>
        <select
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedDrain !== null
              ? "border-green-400 bg-white text-slate-900"
              : "border-slate-300 bg-slate-50 text-slate-500"
          }`}
          value={selectedDrain ?? ""}
          onChange={(e) =>
            setSelectedDrain(e.target.value ? parseInt(e.target.value) : null)
          }
          disabled={selectionsLocked || allDrainIds.length === 0}
        >
          <option value="">{allDrainIds.length === 0 ? "— Select a stretch first —" : "— Choose Drain —"}</option>
          {drainItems.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

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
              disabled={selectionsLocked || selectedDrain === null}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition disabled:opacity-40 disabled:cursor-not-allowed ${
                timeScale === scale
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-green-300"
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
            className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 ${
              selectedSeason
                ? "border-green-400 bg-white text-slate-900"
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
          className={`w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedProductType
              ? "border-green-400 bg-white text-slate-900"
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
            onClick={editSelections}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            Edit Selection
          </button>
        ) : (
          <button
            onClick={handleConfirmClick}
            disabled={isConfirmDisabled}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
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
