"use client";
import React from "react";
import { RiverMultiSelect } from "./Multiselect";
import { useRiverSystem } from "@/contexts/gwm/water_quality_assesment/users/DrainContext";
import { Stretch, Drain, Catchment } from "@/interface/raster_context";
import WholeLoading from "@/components/app_layout/newLoading";

interface RiverSelectorProps {
  onConfirm?: (selectedData: {
    stretches: Stretch[];
    drains: Drain[];
    catchments: Catchment[];
    totalArea: number;
    totalCatchments: number;
  }) => void;
  onReset?: () => void;
}

/* ── Step dot ────────────────────────────────────────────── */
const StepDot: React.FC<{ step: number; done: boolean; active: boolean }> = ({ step, done, active }) => (
  <div className={`
    relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
    transition-all duration-200
    ${done
      ? "bg-emerald-600 text-white"
      : active
        ? "bg-white border-2 border-emerald-500 text-emerald-600"
        : "bg-white border-2 border-slate-200 text-slate-400"
    }
  `}>
    {done
      ? <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      : step
    }
  </div>
);

const StepRow: React.FC<{
  step: number; done: boolean; active: boolean; last?: boolean; children: React.ReactNode;
}> = ({ step, done, active, last, children }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <StepDot step={step} done={done} active={active} />
      {!last && (
        <div className={`w-px flex-1 mt-1 transition-colors duration-300 ${done ? "bg-emerald-200" : "bg-slate-100"}`} style={{ minHeight: 20 }} />
      )}
    </div>
    <div className={`flex-1 ${last ? "" : "pb-4"}`}>{children}</div>
  </div>
);

/* ── Main component ──────────────────────────────────────── */
const RiverSelector: React.FC<RiverSelectorProps> = ({ onConfirm, onReset }) => {
  const {
    rivers, stretches, drains, catchments,
    selectedRiver, selectedStretches, selectedDrains, selectedCatchments,
    totalArea, totalCatchments,
    selectionsLocked, isLoading,
    handleRiverChange, setSelectedStretches, setSelectedDrains, setSelectedCatchments,
    confirmSelections, resetSelections,
  } = useRiverSystem();

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleRiverChange(parseInt(e.target.value));
  };
  const handleStretchesChange = (ids: number[]) => { if (!selectionsLocked) setSelectedStretches(ids); };
  const handleDrainsChange = (ids: number[]) => { if (!selectionsLocked) setSelectedDrains(ids); };
  const handleCatchmentsChange = (ids: number[]) => { if (!selectionsLocked) setSelectedCatchments(ids); };

  const handleConfirm = () => {
    if (selectedCatchments.length > 0 && !selectionsLocked) {
      const data = confirmSelections();
      if (onConfirm && data) onConfirm({ ...data, totalCatchments });
    }
  };

  const fmtStretch = (s: Stretch) => s.name ? `${s.name} (${s.Stretch_ID})` : `Stretch ${s.Stretch_ID}`;
  const fmtDrain   = (d: Drain)   => d.name ? `${d.name} (${d.Drain_No})` : `Drain ${d.Drain_No}`;
  const fmtCatch   = (c: Catchment) => c.village_name;

  const riverDone   = !!selectedRiver;
  const stretchDone = selectedStretches.length > 0;
  const drainDone   = selectedDrains.length > 0;
  const catchDone   = selectedCatchments.length > 0;
  const selectedRiverName = rivers.find(r => r.River_Code === selectedRiver)?.River_Name;

  return (
    <div>
      {/* Step 1: River */}
      <StepRow step={1} done={riverDone} active={!riverDone}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1.5">River</p>
        {selectionsLocked && riverDone ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-slate-700">{selectedRiverName}</span>
          </div>
        ) : (
          <div className="relative">
            <select
              className={`
                w-full appearance-none pl-3 pr-8 py-2 text-xs rounded-lg border bg-white
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500
                transition-all duration-150
                ${selectionsLocked
                  ? "border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50"
                  : "border-slate-300 text-slate-700 hover:border-slate-400 cursor-pointer"
                }
              `}
              value={selectedRiver || ""}
              onChange={handleRiverSelect}
              disabled={selectionsLocked || isLoading}
            >
              <option value="">Select river…</option>
              {rivers.map(r => <option key={r.River_Code} value={r.River_Code}>{r.River_Name}</option>)}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </StepRow>

      {/* Step 2: Stretch */}
      <StepRow step={2} done={stretchDone} active={riverDone && !stretchDone}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Stretch</p>
          {stretchDone && <span className="text-[10px] font-semibold text-emerald-600">{selectedStretches.length === stretches.length ? "All" : selectedStretches.length} selected</span>}
        </div>
        <RiverMultiSelect
          items={stretches} selectedItems={selectedStretches}
          onSelectionChange={handleStretchesChange}
          label="Stretch" placeholder={riverDone ? "Select stretches…" : "Choose river first"}
          disabled={!riverDone || selectionsLocked || isLoading}
          displayPattern={fmtStretch}
        />
      </StepRow>

      {/* Step 3: Drain */}
      <StepRow step={3} done={drainDone} active={stretchDone && !drainDone}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Drain</p>
          {drainDone && <span className="text-[10px] font-semibold text-emerald-600">{selectedDrains.length === drains.length ? "All" : selectedDrains.length} selected</span>}
        </div>
        <RiverMultiSelect
          items={drains} selectedItems={selectedDrains}
          onSelectionChange={handleDrainsChange}
          label="Drain" placeholder={stretchDone ? "Select drains…" : "Choose stretch first"}
          disabled={!stretchDone || selectionsLocked || isLoading}
          displayPattern={fmtDrain}
        />
      </StepRow>

      {/* Step 4: Catchment */}
      <StepRow step={4} done={catchDone} active={drainDone && !catchDone} last>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Catchment</p>
          {catchDone && <span className="text-[10px] font-semibold text-emerald-600">{selectedCatchments.length === catchments.length ? "All" : selectedCatchments.length} selected</span>}
        </div>
        <RiverMultiSelect
          items={catchments} selectedItems={selectedCatchments}
          onSelectionChange={handleCatchmentsChange}
          label="Catchment" placeholder={drainDone ? "Select catchments…" : "Choose drain first"}
          disabled={!drainDone || selectionsLocked || isLoading}
          displayPattern={fmtCatch}
        />
      </StepRow>

      {/* Stats */}
      {catchDone && (
        <div className="flex gap-3 mt-3">
          <div className="flex-1 flex flex-col items-center py-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700">{totalCatchments}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">Catchments</span>
          </div>
          <div className="flex-1 flex flex-col items-center py-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700">{totalArea.toFixed(1)}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">km²</span>
          </div>
        </div>
      )}

      {/* Confirm / Locked */}
      <div className="mt-4">
        {selectionsLocked ? (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-800">Selection confirmed</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">{totalCatchments} catchment{totalCatchments !== 1 ? "s" : ""} locked in</p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!catchDone || isLoading}
            className={`
              w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg
              transition-all duration-150
              ${catchDone
                ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }
            `}
          >
            {catchDone && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            Confirm Selection
          </button>
        )}
      </div>

      {isLoading && <WholeLoading visible title="Connecting to server" message="Preparing data…" />}
    </div>
  );
};

export default RiverSelector;
