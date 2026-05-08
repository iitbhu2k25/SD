"use client";

// This lets the user choose state, district, and sub-district.
// After confirm, it locks the choice and loads data for the map.
import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { SubDistrict } from "@/interface/raster_context";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useUiModeService } from "../../services/uiModeService";

interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
    totalPopulation: number;
  }) => void;
}

export default function LocationSelector({ onConfirm }: LocationSelectorProps) {
  const states = useAdminLocationStore((state) => state.states);
  const districts = useAdminLocationStore((state) => state.districts);
  const subDistricts = useAdminLocationStore((state) => state.subDistricts);
  const selectedState = useAdminLocationStore((state) => state.selectedState);
  const selectedDistricts = useAdminLocationStore((state) => state.selectedDistricts);
  const selectedSubDistricts = useAdminLocationStore(
    (state) => state.selectedSubDistricts,
  );
  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const isLoading = useAdminLocationStore((state) => state.isLoading);
  const handleStateChange = useAdminLocationStore((state) => state.handleStateChange);
  const setSelectedDistricts = useAdminLocationStore(
    (state) => state.setSelectedDistricts,
  );
  const setSelectedSubDistricts = useAdminLocationStore(
    (state) => state.setSelectedSubDistricts,
  );
  const confirmSelections = useAdminLocationStore((state) => state.confirmSelections);
  const resetSelections = useAdminLocationStore((state) => state.resetSelections);
  const resetMapView = useAdminMapStore((state) => state.resetMapView);
  const isDark = useUiModeService((s) => s.isDark);

  const handleStateSelect = (value: number | string | null) => {
    if (!selectionsLocked) {
      handleStateChange(value === null ? Number.NaN : Number(value));
    }
  };

  const handleDistrictsChange = (selectedIds: number[]) => {
    if (!selectionsLocked) {
      setSelectedDistricts(selectedIds);
    }
  };

  const handleSubDistrictsChange = (selectedIds: number[]) => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(selectedIds);
    }
  };

  const handleConfirm = async () => {
    if (selectedSubDistricts.length > 0 && !selectionsLocked) {
      const selectedData = await confirmSelections();
      if (selectedData && onConfirm) {
        onConfirm(selectedData);
      }
    }
  };

  const handleReset = () => {
    resetSelections();
    resetMapView();
  };

  return (
    <div className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
      isDark
        ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
        : "border border-t-2 border-stone-200 border-t-blue-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)]"
    }`}>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">

        <SingleSelect
          items={states}
          selectedValue={selectedState}
          onValueChange={handleStateSelect}
          label="State"
          placeholder="--Choose a State--"
          disabled={selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
          isDark={isDark}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${
            selectedSubDistricts.length > 0 && !selectionsLocked
              ? isDark
                ? "border border-[#1e3a5f] bg-[#0c2e63]/70 hover:bg-[#0c2e63] shadow-[0_0_15px_rgba(12,46,99,0.5)] hover:scale-[1.02]"
                : "bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 hover:scale-[1.02] shadow-blue-200"
              : isDark
                ? "border border-[#1e3a5f]/50 bg-[#080e1c]/80 text-[#1e3a5f] cursor-not-allowed"
                : "bg-stone-300 cursor-not-allowed"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={handleConfirm}
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>

        <button
          className={`w-full rounded-full border px-3.5 py-2 text-xs font-semibold shadow-md transition duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm ${
            isDark
              ? "border-[#1e3a5f] bg-[#0c182b] text-slate-300 hover:bg-[#12233f] hover:text-white focus:ring-[#1e3a5f] disabled:border-[#1e3a5f]/50 disabled:bg-[#080e1c] disabled:text-[#1e3a5f]"
              : "border-transparent bg-slate-500 text-white hover:bg-slate-400 focus:ring-slate-500 disabled:bg-stone-300 disabled:hover:bg-stone-300"
          }`}
          onClick={handleReset}
          disabled={selectedState === null}
        >
          Edit
        </button>
      </div>

      {isLoading && (
        <WholeLoading
          visible={true}
          title="Connecting to server"
          message="Working on preparing data"
        />
      )}
    </div>
  );
}
