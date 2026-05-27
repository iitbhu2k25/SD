"use client";

import React, { useMemo } from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation, SubDistrict } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { useUiModeService } from "../../services/uiModeService";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    handleAreaConfirm,
    resetSelections,
  } = useLocation();

  const isDark = useUiModeService((s) => s.isDark);

  // Sort states to put state with id 9 first
  const sortedStates = useMemo(() => {
    const statesCopy = [...states];
    const targetStateIndex = statesCopy.findIndex(s => Number(s.id) === 9);
    if (targetStateIndex !== -1) {
      const [targetState] = statesCopy.splice(targetStateIndex, 1);
      return [targetState, ...statesCopy];
    }
    return statesCopy;
  }, [states]);

  const allowedDistrictIds = [179, 152, 120, 174, 187];

  const isStateSelectable = (stateId: string | number): boolean => Number(stateId) === 9;

  const handleStateSelect = (value: number | string | null) => {
    if (!selectionsLocked && !areaConfirmed) {
      const stateId = value === null ? NaN : Number(value);
      if (stateId === 9 || isNaN(stateId)) {
        handleStateChange(stateId);
      }
    }
  };

  const sortedEnhancedDistricts = useMemo(() => {
    const available: any[] = [];
    const unavailable: any[] = [];
    districts.forEach(district => {
      const id = Number(district.id);
      const isAllowed = allowedDistrictIds.includes(id);
      const enhanced = {
        ...district,
        name: `${district.name}${!isAllowed ? " (Not Available)" : ""}`,
        __isUnavailable: !isAllowed,
        __itemClass: !isAllowed ? "text-gray-400" : "",
      };
      if (isAllowed) available.push(enhanced);
      else unavailable.push(enhanced);
    });
    available.sort((a, b) => {
      const indexA = allowedDistrictIds.indexOf(Number(a.id));
      const indexB = allowedDistrictIds.indexOf(Number(b.id));
      return indexA - indexB;
    });
    return [...available, ...unavailable];
  }, [districts]);

  const handleDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedDistricts(selectedIds.filter(id => allowedDistrictIds.includes(id)));
    }
  };

  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) setSelectedSubDistricts(selectedIds);
  };

  const handleConfirmArea = () => {
    handleAreaConfirm();
    onAreaConfirmed?.();
  };

  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => subDistrict.name;

  return (
    <div className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
      isDark
        ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
        : "border border-t-2 border-stone-200 border-t-blue-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)]"
    }`}>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <div>
          <label className={`block text-sm font-semibold mb-2 ${isDark ? "text-slate-300" : "text-gray-700"}`}>State:</label>
          <select
            className={`w-full p-2 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              selectionsLocked || isLoading || areaConfirmed
                ? "bg-gray-100 cursor-not-allowed border-gray-300 text-gray-400"
                : "bg-white border-blue-500"
            }`}
            value={selectedState ?? ""}
            onChange={(e) => handleStateSelect(e.target.value === "" ? null : e.target.value)}
            disabled={selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a State--</option>
            {sortedStates.filter(s => isStateSelectable(s.id)).map((state) => (
              <option key={state.id} value={state.id}>{state.name}</option>
            ))}
          </select>
        </div>

        <MultiSelect
          items={sortedEnhancedDistricts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading || areaConfirmed}
          itemClassName={(item: any) => item.__itemClass}
          itemDisabled={(item: any) => item.__isUnavailable}
        />

        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading || areaConfirmed}
          displayPattern={formatSubDistrictDisplay}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm ${
            selectedSubDistricts.length > 0 && !areaConfirmed && !selectionsLocked
              ? isDark
                ? "border border-[#1e3a5f] bg-[#0c2e63]/70 hover:bg-[#0c2e63] shadow-[0_0_15px_rgba(12,46,99,0.5)] hover:scale-[1.02]"
                : "bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 hover:scale-[1.02] shadow-blue-200"
              : isDark
                ? "border border-[#1e3a5f]/50 bg-[#080e1c]/80 text-[#1e3a5f] cursor-not-allowed"
                : "bg-stone-300 cursor-not-allowed"
          }`}
          onClick={handleConfirmArea}
          disabled={selectedSubDistricts.length === 0 || areaConfirmed || selectionsLocked || isLoading}
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
          disabled={!selectedState || isLoading}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default AreaSelection;
