'use client'
import React from 'react';
import { MultiSelect } from './Multiselect';
import { useLocation } from '@/contexts/gwm/water_quality_assesment/admin/LocationContext';
import { SubDistrict } from '@/interface/raster_context';
import WholeLoading from "@/components/app_layout/newLoading";

interface LocationSelectorProps {
  onConfirm?: (selectedData: { subDistricts: SubDistrict[]; totalPopulation: number }) => void;
  onReset?: () => void;
}

/* ── Step indicator dot ──────────────────────────────────── */
const StepDot: React.FC<{ step: number; done: boolean; active: boolean }> = ({ step, done, active }) => (
  <div className={`
    relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
    transition-all duration-200
    ${done
      ? 'bg-blue-600 text-white'
      : active
        ? 'bg-white border-2 border-blue-500 text-blue-600'
        : 'bg-white border-2 border-slate-200 text-slate-400'
    }
  `}>
    {done
      ? <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      : step
    }
  </div>
);

/* ── Field wrapper with step connector ───────────────────── */
const StepRow: React.FC<{
  step: number;
  done: boolean;
  active: boolean;
  last?: boolean;
  children: React.ReactNode;
}> = ({ step, done, active, last, children }) => (
  <div className="flex gap-3">
    {/* Left: dot + line */}
    <div className="flex flex-col items-center">
      <StepDot step={step} done={done} active={active} />
      {!last && (
        <div className={`w-px flex-1 mt-1 transition-colors duration-300 ${done ? 'bg-blue-200' : 'bg-slate-100'}`} style={{ minHeight: 20 }} />
      )}
    </div>
    {/* Right: content */}
    <div className={`flex-1 ${last ? '' : 'pb-4'}`}>{children}</div>
  </div>
);

/* ── Main component ──────────────────────────────────────── */
const LocationSelector: React.FC<LocationSelectorProps> = ({ onConfirm }) => {
  const {
    states, districts, subDistricts,
    selectedState, selectedDistricts, selectedSubDistricts,
    selectionsLocked, isLoading,
    handleStateChange, setSelectedDistricts, setSelectedSubDistricts,
    confirmSelections,
  } = useLocation();

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleStateChange(parseInt(e.target.value));
  };
  const handleDistrictsChange = (ids: number[]) => { if (!selectionsLocked) setSelectedDistricts(ids); };
  const handleSubDistrictsChange = (ids: number[]) => { if (!selectionsLocked) setSelectedSubDistricts(ids); };
  const handleConfirm = () => {
    if (selectedSubDistricts.length > 0 && !selectionsLocked) {
      const data = confirmSelections();
      if (onConfirm && data) onConfirm(data);
    }
  };

  const stateDone = !!selectedState;
  const districtDone = selectedDistricts.length > 0;
  const subDistrictDone = selectedSubDistricts.length > 0;
  const selectedStateName = states.find(s => s.id === selectedState)?.name;

  return (
    <div>
      {/* ── Step 1: State ──────────────────────────────────── */}
      <StepRow step={1} done={stateDone} active={!stateDone}>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-1.5">State</p>
        {selectionsLocked && stateDone ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-slate-700">{selectedStateName}</span>
          </div>
        ) : (
          <div className="relative">
            <select
              className={`
                w-full appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                transition-all duration-150
                ${selectionsLocked
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
                  : 'border-slate-300 text-slate-700 hover:border-slate-400 cursor-pointer'
                }
              `}
              value={selectedState || ''}
              onChange={handleStateSelect}
              disabled={selectionsLocked || isLoading}
            >
              <option value="">Select state…</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </StepRow>

      {/* ── Step 2: District ──────────────────────────────── */}
      <StepRow step={2} done={districtDone} active={stateDone && !districtDone}>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">District</p>
          {districtDone && (
            <span className="text-xs font-semibold text-blue-600">
              {selectedDistricts.length === districts.length ? 'All' : selectedDistricts.length} selected
            </span>
          )}
        </div>
        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder={stateDone ? "Select districts…" : "Choose state first"}
          disabled={!stateDone || selectionsLocked || isLoading}
        />
      </StepRow>

      {/* ── Step 3: Sub-District ─────────────────────────── */}
      <StepRow step={3} done={subDistrictDone} active={districtDone && !subDistrictDone} last>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sub-District</p>
          {subDistrictDone && (
            <span className="text-xs font-semibold text-blue-600">
              {selectedSubDistricts.length === subDistricts.length ? 'All' : selectedSubDistricts.length} selected
            </span>
          )}
        </div>
        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder={districtDone ? "Select sub-districts…" : "Choose districts first"}
          disabled={!districtDone || selectionsLocked || isLoading}
          displayPattern={(sd: SubDistrict) => sd.name}
        />
      </StepRow>

      {/* ── Confirm / Locked ─────────────────────────────── */}
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
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {selectedSubDistricts.length} sub-district{selectedSubDistricts.length !== 1 ? 's' : ''} locked in
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={!subDistrictDone || isLoading}
            className={`
              w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg
              transition-all duration-150
              ${subDistrictDone
                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {subDistrictDone && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            Confirm Selection
          </button>
        )}
      </div>

      {isLoading && <WholeLoading visible title="Connecting to server" message="Preparing data…" />}
    </div>
  );
};

export default LocationSelector;
