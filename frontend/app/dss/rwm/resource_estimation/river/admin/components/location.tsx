"use client";

import React, { useMemo } from "react";
import {
  useLocation,
  State,
  District,
  SubDistrict,
} from "@/contexts/riverwater_assessment/admin/LocationContext";
import MultiSelect from "./multiselect";
import { useApp } from "@/contexts/riverwater_assessment/admin/AppContext";
import { useMap } from "@/contexts/riverwater_assessment/admin/MapContext";

interface LocationProps {
  onConfirm?: (selectedData: {
    state: State | null;
    districts: District[];
    subDistricts: SubDistrict[];
  }) => void;
  onReset?: () => void;
}

const ALLOWED_DISTRICT_CODES = new Set([179, 152, 120, 174, 187]);

const Location: React.FC<LocationProps> = ({ onConfirm, onReset }) => {
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
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelections,
    selectedSeason, // ADD THIS
    setSelectedSeason,
  } = useLocation();

  const { handleGlobalReset } = useApp();
  const { resetView } = useMap();
  const handleReset = (): void => {
    handleGlobalReset(); // This handles both location reset AND interpolation removal
    resetView();
    setSelectedSeason("");

    if (onReset) {
      onReset();
    }
  };

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const stateId = parseInt(e.target.value);
      handleStateChange(stateId);
    }
  };

  const handleDistrictsChange = (selectedValues: string[]): void => {
    if (!selectionsLocked) {
      setSelectedDistricts(selectedValues.map((val) => parseInt(val)));
    }
  };

  const handleSubDistrictsChange = (selectedValues: string[]): void => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(selectedValues.map((val) => parseInt(val)));
    }
  };

  const handleConfirm = (): void => {
    if (selectedState && selectedDistricts.length > 0 && !selectionsLocked) {
      const confirmed = confirmSelections();
      if (confirmed && onConfirm) {
        const state = states.find((s) => s.id === selectedState) || null;
        const selectedDistrictObjects = districts.filter((d) =>
          selectedDistricts.includes(Number(d.id)),
        );
        const selectedSubDistrictObjects = subDistricts.filter((sd) =>
          selectedSubDistricts.includes(Number(sd.id)),
        );
        onConfirm({
          state,
          districts: selectedDistrictObjects,
          subDistricts: selectedSubDistrictObjects,
        });
      }
    }
  };

  const truncate = (text: string, max = 28) =>
  text.length > max ? text.slice(0, max) + "…" : text;


  // Format sub-district display to include district name for clarity
  const formatSubDistrictDisplay = (sd: SubDistrict): string => {
    return `${sd.districtName} - ${sd.name}`;
  };

  const stateOptions = useMemo(
    () =>
      states
        .slice()
        .sort((a, b) => {
          if (a.id === 9) return -1; // UP goes top
          if (b.id === 9) return 1;
          return 0;
        }),
    [states],
  );

  const districtOptions = useMemo(
    () =>
      districts
        .slice()
        .sort((a, b) => {
          const aAllowed = ALLOWED_DISTRICT_CODES.has(Number(a.id));
          const bAllowed = ALLOWED_DISTRICT_CODES.has(Number(b.id));

          // Allowed districts go to the top
          if (aAllowed && !bAllowed) return -1;
          if (!aAllowed && bAllowed) return 1;
          return 0;
        })
        .map((district: District) => ({
          value: district.id.toString(),
          label: district.name,
          disabled: !ALLOWED_DISTRICT_CODES.has(Number(district.id)),
        })),
    [districts],
  );

  const subDistrictOptions = useMemo(
    () =>
      subDistricts.map((sd: SubDistrict) => ({
        value: sd.id.toString(),
        label: formatSubDistrictDisplay(sd),
      })),
    [subDistricts],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-red-200">
          <div className="flex items-center">
            {/* ...your error SVG... */}
            {error}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-md border border-blue-200">
          <div className="flex items-center">
            {/* ...your loading SVG... */}
            Loading location data...
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* State Selection */}
        <div>
          <label
            htmlFor="state-dropdown"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            State:
          </label>
          <select
            id="state-dropdown"
            className="w-full rounded-md border border-blue-300 bg-white px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            value={selectedState || ""}
            onChange={handleStateSelect}
            disabled={selectionsLocked || isLoading}
          >
            <option value="">--Choose a State--</option>
            {stateOptions.map((state: State) => (
                <option
                  key={state.id}
                  value={state.id}
                  disabled={state.id !== 9}
                  title={state.name}
                >
                  {truncate(state.name, 20)}
                </option>
              ))}
          </select>
        </div>

        {/* Districts Multi-Select */}
        <MultiSelect
          options={districtOptions}
          selectedValues={selectedDistricts.map(String)}
          onChange={handleDistrictsChange}
          disabled={!selectedState || selectionsLocked || isLoading}
          label="District"
          placeholder="--Choose Districts--"
        />

        {/* Sub-Districts Multi-Select */}
        <MultiSelect
          options={subDistrictOptions}
          selectedValues={selectedSubDistricts.map(String)}
          onChange={handleSubDistrictsChange}
          disabled={
            selectedDistricts.length === 0 || selectionsLocked || isLoading
          }
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
        />

        <div>
          <label
            htmlFor="season-dropdown"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Season:
          </label>

          <select
            id="season-dropdown"
            className="w-full cursor-pointer rounded-md border border-blue-300 bg-white px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            value={selectedSeason}
            onChange={(e) =>
              setSelectedSeason(
                e.target.value as "premonsoon" | "monsoon" | "postmonsoon",
              )
            }
            disabled={isLoading}
          >
            <option value="" >--Choose a Season--</option>
            <option value="premonsoon">Pre Monsoon</option>
            <option value="monsoon">Monsoon</option>
            <option value="postmonsoon">Post Monsoon</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-2 flex items-center gap-3">
        <button
          className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            selectedState && selectedDistricts.length > 0 && !selectionsLocked
              ? "cursor-pointer bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          onClick={handleConfirm}
          disabled={
            !selectedState ||
            selectedDistricts.length === 0 ||
            selectionsLocked ||
            isLoading
          }
        >
          {/* ...SVG... */}
          Confirm Selection
        </button>
        <button
          className="inline-flex cursor-pointer items-center rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleReset}
          disabled={isLoading}
        >
          {/* ...SVG... */}
          Reset
        </button>
      </div>
    </div>
  );
};

export default Location;
