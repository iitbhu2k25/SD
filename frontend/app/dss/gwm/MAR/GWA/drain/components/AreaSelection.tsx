'use client';
import React, { useEffect } from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { useUiModeService } from "../../services/uiModeService";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    rivers, stretches, drains, catchments, villages,
    selectedRiver, selectedStretch, selectedDrain,
    selectedCatchments, selectedVillages,
    selectionsLocked, isLoading, error, areaConfirmed,
    handleRiverChange, handleStretchChange, handleDrainChange,
    setSelectedCatchments, setSelectedVillages,
    handleAreaConfirm, resetSelections
  } = useLocation();

  const isDark = useUiModeService((s) => s.isDark);

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleRiverChange(Number(e.target.value));
  };
  const handleStretchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleStretchChange(Number(e.target.value));
  };
  const handleDrainSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleDrainChange(Number(e.target.value));
  };

  useEffect(() => {
    if (selectedDrain && catchments.length > 0 && selectedCatchments.length === 0) {
      const allCatchmentIds = catchments.map(c => Number(c.objectId));
      setSelectedCatchments(allCatchmentIds);
    }
  }, [selectedDrain, catchments.length, selectedCatchments.length]);

  const handleCatchmentsChange = (ids: (number | string)[]) => {
    if (!selectionsLocked) setSelectedCatchments(ids.map(id => Number(id)));
  };

  const handleVillagesChange = (ids: (number | string)[]) => {
    if (!selectionsLocked) setSelectedVillages(ids.map(id => Number(id)));
  };

  const handleConfirmArea = () => {
    handleAreaConfirm();
    onAreaConfirmed?.();
  };

  const selectClass = (disabled: boolean) =>
    `w-full rounded-lg border px-2.5 py-2 text-xs transition duration-200 sm:px-3 sm:py-2.5 sm:text-sm focus:outline-none focus:ring-2 ${
      disabled
        ? isDark
          ? "cursor-not-allowed border-[#1e3a5f]/50 bg-[#060c15] text-[#1e3a5f]"
          : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
        : isDark
          ? "border-[#1e3a5f]/80 bg-[#080e1c] text-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20"
          : "border-stone-300 bg-[#fdfcfa] hover:border-stone-400 focus:border-blue-500 focus:ring-blue-500/20"
    }`;

  const labelClass = `block text-xs font-semibold mb-1.5 sm:text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
      isDark
        ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
        : "border border-t-2 border-stone-200 border-t-emerald-400 bg-[linear-gradient(180deg,#f5faf7_0%,#eef4fb_100%)]"
    }`}>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        {/* River */}
        <div>
          <label className={labelClass}>River:</label>
          <select
            className={selectClass(selectionsLocked || isLoading || areaConfirmed)}
            value={selectedRiver || ""}
            onChange={handleRiverSelect}
            disabled={selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a River--</option>
            {rivers.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>

        {/* Stretch */}
        <div>
          <label className={labelClass}>Stretch:</label>
          <select
            className={selectClass(!selectedRiver || selectionsLocked || isLoading || areaConfirmed)}
            value={selectedStretch || ""}
            onChange={handleStretchSelect}
            disabled={!selectedRiver || selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a Stretch--</option>
            {stretches.map(s => <option key={s.stretchId} value={s.stretchId}>{s.name}</option>)}
          </select>
        </div>

        {/* Drain */}
        <div>
          <label className={labelClass}>Drain:</label>
          <select
            className={selectClass(!selectedStretch || selectionsLocked || isLoading || areaConfirmed)}
            value={selectedDrain || ""}
            onChange={handleDrainSelect}
            disabled={!selectedStretch || selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a Drain--</option>
            {drains.map(d => <option key={d.drainNo} value={d.drainNo}>Drain {d.drainNo}</option>)}
          </select>
        </div>

        {/* Villages */}
        <MultiSelect
          items={villages.map(v => ({ id: v.code, name: v.name }))}
          selectedItems={selectedVillages}
          onSelectionChange={handleVillagesChange}
          label="Villages"
          placeholder="--Choose Villages--"
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading || areaConfirmed}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm ${
            (selectedVillages.length > 0 || selectedCatchments.length > 0) && !areaConfirmed && !selectionsLocked
              ? isDark
                ? "border border-[#1e3a5f] bg-[#0c2e63]/70 hover:bg-[#0c2e63] shadow-[0_0_15px_rgba(12,46,99,0.5)] hover:scale-[1.02]"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02] shadow-emerald-200"
              : isDark
                ? "border border-[#1e3a5f]/50 bg-[#080e1c]/80 text-[#1e3a5f] cursor-not-allowed"
                : "bg-stone-300 cursor-not-allowed"
          }`}
          onClick={handleConfirmArea}
          disabled={(selectedVillages.length === 0 && selectedCatchments.length === 0) || areaConfirmed || selectionsLocked || isLoading}
        >
          {areaConfirmed ? "Confirmed ✓" : "Confirm Area"}
        </button>

        <button
          className={`w-full rounded-full border px-3.5 py-2 text-xs font-semibold shadow-md transition duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm ${
            isDark
              ? "border-[#1e3a5f] bg-[#0c182b] text-slate-300 hover:bg-[#12233f] hover:text-white focus:ring-[#1e3a5f] disabled:border-[#1e3a5f]/50 disabled:bg-[#080e1c] disabled:text-[#1e3a5f]"
              : "border-transparent bg-slate-500 text-white hover:bg-slate-400 focus:ring-slate-500 disabled:bg-stone-300 disabled:hover:bg-stone-300"
          }`}
          onClick={resetSelections}
          disabled={!selectedRiver || isLoading}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default AreaSelection;
