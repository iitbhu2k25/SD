"use client";

// This lets the user choose state, district, and sub-district.
// After confirm, it locks the choice and loads data for the map.
import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { SubDistrict } from "@/interface/raster_context";
import { MultiSelect } from "../../shared/ui/MultiSelect";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

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

  const handleStateSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) {
      handleStateChange(parseInt(event.target.value, 10));
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
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label htmlFor="state-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
            State:
          </label>
          <select
            id="state-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedState ?? ""}
            onChange={handleStateSelect}
            disabled={selectionsLocked || isLoading}
          >
            <option value="">--Choose a State--</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
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
      </div>

      <div className="flex space-x-4 mt-4">
        <button
          className={`${
            selectedSubDistricts.length > 0 && !selectionsLocked
              ? "bg-blue-500 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={handleConfirm}
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>

        <button
          className="bg-red-500 hover:bg-red-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-red-300 disabled:cursor-not-allowed disabled:hover:bg-red-300"
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
