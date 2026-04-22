"use client";

// This lets the user choose state, district, sub-district, and village.
// After confirm, it locks the choice and loads data for the map.
import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { SubDistrict, villages } from "@/interface/raster_context";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
    villages: villages[];
  }) => void;
}

export default function LocationSelector({ onConfirm }: LocationSelectorProps) {
  const states = useAdminLocationStore((state) => state.states);
  const districts = useAdminLocationStore((state) => state.districts);
  const subDistricts = useAdminLocationStore((state) => state.subDistricts);
  const villagesList = useAdminLocationStore((state) => state.villagesList);
  const selectedState = useAdminLocationStore((state) => state.selectedState);
  const selectedDistricts = useAdminLocationStore((state) => state.selectedDistricts);
  const selectedSubDistricts = useAdminLocationStore((state) => state.selectedSubDistricts);
  const selectedVillages = useAdminLocationStore((state) => state.selectedVillages);
  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const isLoading = useAdminLocationStore((state) => state.isLoading);
  const handleStateChange = useAdminLocationStore((state) => state.handleStateChange);
  const setSelectedDistricts = useAdminLocationStore((state) => state.setSelectedDistricts);
  const setSelectedSubDistricts = useAdminLocationStore((state) => state.setSelectedSubDistricts);
  const setSelectedVillages = useAdminLocationStore((state) => state.setSelectedVillages);
  const confirmSelections = useAdminLocationStore((state) => state.confirmSelections);
  const resetSelections = useAdminLocationStore((state) => state.resetSelections);
  const resetMapView = useAdminMapStore((state) => state.resetMapView);

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

  const handleVillagesChange = (selectedIds: number[]) => {
    if (!selectionsLocked) {
      setSelectedVillages(selectedIds);
    }
  };

  const handleConfirm = async () => {
    // Strict parity with old module: village selection is required before confirm.
    if (selectedVillages.length > 0 && !selectionsLocked) {
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
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-blue-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)] p-2.5 shadow-sm sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <div>
          <SingleSelect
            items={states}
            selectedValue={selectedState}
            onValueChange={(id) => handleStateChange(id === null ? Number.NaN : Number(id))}
            label="State"
            placeholder="--Choose a State--"
            disabled={selectionsLocked || isLoading}
          />
        </div>

        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading}
        />

        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
        />

        <MultiSelect
          items={villagesList}
          selectedItems={selectedVillages}
          onSelectionChange={handleVillagesChange}
          label="Village"
          placeholder="--Choose Villages--"
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${selectedVillages.length > 0 && !selectionsLocked
            ? "bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 hover:scale-[1.02] shadow-blue-200"
            : "bg-stone-300 cursor-not-allowed"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={handleConfirm}
          disabled={selectedVillages.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>

        <button
          className="w-full rounded-full bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-slate-400 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm"
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
