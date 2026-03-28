'use client';

import { MapPin, RotateCcw, Check, ChevronRight } from 'lucide-react';
import { useLocationSelection } from '../hooks/useLocationSelection';
import MultiSelect from './MultiSelect';

export default function LocationSelector() {
  const {
    stateOptions,
    districtOptions,
    subDistrictOptions,
    villageOptions,
    loadingStates,
    loadingDistricts,
    loadingSubDistricts,
    loadingVillages,
    adminSelection,
    handleStateChange,
    handleDistrictChange,
    handleSubDistrictChange,
    handleVillageChange,
    resetAdminSelection,
    handleConfirm,
    confirmedLocation,
    error,
  } = useLocationSelection();

  const isConfirmed = !!confirmedLocation;
  const canConfirm = !!adminSelection.state && adminSelection.villages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-blue-100 rounded-lg">
            <MapPin size={14} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-xs">Administrative Location</h3>
        </div>
        <button
          onClick={resetAdminSelection}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* Breadcrumb */}
      {adminSelection.state && (
        <div className="flex flex-wrap items-center gap-1 mb-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          <span className="font-medium text-blue-700">{adminSelection.state.state_name}</span>
          {adminSelection.districts.length > 0 && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <span>{adminSelection.districts.length} district(s)</span>
            </>
          )}
          {adminSelection.subDistricts.length > 0 && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <span>{adminSelection.subDistricts.length} sub-district(s)</span>
            </>
          )}
          {adminSelection.villages.length > 0 && (
            <>
              <ChevronRight size={12} className="text-slate-400" />
              <span>{adminSelection.villages.length} village(s)</span>
            </>
          )}
        </div>
      )}

      {/* Selectors */}
      <div className="flex flex-col gap-2 flex-1">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
            State <span className="text-red-400">*</span>
          </label>
          <MultiSelect
            options={stateOptions}
            value={adminSelection.state ? [adminSelection.state.state_code] : []}
            onChange={handleStateChange}
            placeholder="Select state..."
            loading={loadingStates}
            maxDisplay={1}
            singleSelect
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
            District(s)
          </label>
          <MultiSelect
            options={districtOptions}
            value={adminSelection.districts.map((d) => d.district_code)}
            onChange={handleDistrictChange}
            placeholder="Select district(s)..."
            disabled={!adminSelection.state}
            loading={loadingDistricts}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
            Sub-District(s)
          </label>
          <MultiSelect
            options={subDistrictOptions}
            value={adminSelection.subDistricts.map((s) => s.subdistrict_code)}
            onChange={handleSubDistrictChange}
            placeholder="Select sub-district(s)..."
            disabled={adminSelection.districts.length === 0}
            loading={loadingSubDistricts}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
            Village(s)
          </label>
          <MultiSelect
            options={villageOptions}
            value={adminSelection.villages.map((v) => v.village_code)}
            onChange={handleVillageChange}
            placeholder="Select village(s)..."
            disabled={adminSelection.subDistricts.length === 0}
            loading={loadingVillages}
          />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className={`
          mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold
          transition-all duration-200
          ${canConfirm
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-[0.98]'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }
        `}
      >
        <Check size={16} />
        {isConfirmed ? 'Update Location' : 'Confirm Location'}
      </button>

      {isConfirmed && (
        <p className="mt-2 text-center text-xs text-emerald-600 font-medium">
          ✓ Location confirmed — modules are active
        </p>
      )}
    </div>
  );
}
