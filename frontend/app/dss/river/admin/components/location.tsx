"use client";

import React, { useState } from "react";
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

interface SeasonCardProps {
  season: "premonsoon" | "monsoon" | "postmonsoon";
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color: string;
  description: string;
}

export const SeasonCard: React.FC<SeasonCardProps> = ({
  season,
  isSelected,
  onClick,
  icon,
  color,
  description,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative pt-3 pb-4 px-4 rounded-xl cursor-pointer transition-all duration-300 transform ${
        isSelected
          ? `${color} shadow-xl scale-105 ring-2 ring-white`
          : "bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:scale-102"
      } ${isHovered ? "shadow-2xl" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center space-x-3">
        <div
          className={`text-2xl transition-transform duration-300 ${
            isSelected || isHovered ? "scale-125" : "scale-100"
          }`}
        >
          {icon}
        </div>
        <div>
          <h3
            className={`font-semibold capitalize transition-colors duration-300 ${
              isSelected ? "text-white" : "text-gray-700"
            }`}
          >
            {season.replace("monsoon", "-monsoon")}
          </h3>
          <p
            className={`text-xs transition-colors duration-300 ${
              isSelected ? "text-white/80" : "text-gray-500"
            }`}
          >
            {description}
          </p>
        </div>
      </div>

      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
          <svg
            className="w-4 h-4 text-green-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// ADD season configuration
export const seasonConfig = {
  premonsoon: {
    icon: <span>☀️</span>,
    color: "bg-gradient-to-r from-orange-400 to-red-500",
    description: "Hot & dry conditions",
  },
  monsoon: {
    icon: <span>🌧️</span>,
    color: "bg-gradient-to-r from-green-400 to-blue-500",
    description: "Rainfall period",
  },
  postmonsoon: {
    icon: <span>🍂</span>,
    color: "bg-gradient-to-r from-blue-400 to-purple-500",
    description: "Cool & pleasant weather",
  },
};

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
    resetSelections,
    selectedSeason, // ADD THIS
    setSelectedSeason,
  } = useLocation();

  const { handleGlobalReset } = useApp();
  const { resetView, removeInterpolationLayer } = useMap();
  const handleReset = (): void => {
    handleGlobalReset(); // This handles both location reset AND interpolation removal
    resetView();
    setSelectedSeason("premonsoon");

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
          selectedDistricts.includes(Number(d.id))
        );
        const selectedSubDistrictObjects = subDistricts.filter((sd) =>
          selectedSubDistricts.includes(Number(sd.id))
        );
        onConfirm({
          state,
          districts: selectedDistrictObjects,
          subDistricts: selectedSubDistrictObjects,
        });
      }
    }
  };

  // Format sub-district display to include district name for clarity
  const formatSubDistrictDisplay = (sd: SubDistrict): string => {
    return `${sd.districtName} - ${sd.name}`;
  };

  const allowedDistrictCodes = [179, 152, 120, 174, 187];

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
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

      <div className="mb-6">
        <h3 className="block text-sm font-semibold text-gray-700 mb-3">
          Select Season:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(seasonConfig).map(([season, config]) => (
            <SeasonCard
              key={season}
              season={season as "premonsoon" | "monsoon" | "postmonsoon"}
              isSelected={selectedSeason === season}
              onClick={() =>
                setSelectedSeason(
                  season as "premonsoon" | "monsoon" | "postmonsoon"
                )
              }
              icon={config.icon}
              color={config.color}
              description={config.description}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* State Selection */}
        <div>
          <label
            htmlFor="state-dropdown"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            State:
          </label>
          <select
            id="state-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={selectedState || ""}
            onChange={handleStateSelect}
            disabled={selectionsLocked || isLoading}
          >
            <option value="">--Choose a State--</option>
            {states
              .slice() // avoid mutating original
              .sort((a, b) => {
                if (a.id === 9) return -1; // UP goes top
                if (b.id === 9) return 1;
                return 0;
              })
              .map((state: State) => (
                <option
                  key={state.id}
                  value={state.id}
                  disabled={state.id !== 9}
                >
                  {state.name}
                </option>
              ))}
          </select>
        </div>

        {/* Districts Multi-Select */}
        <MultiSelect
          options={districts
            .slice() // avoid mutating original array
            .sort((a, b) => {
              const aAllowed = allowedDistrictCodes.includes(Number(a.id));
              const bAllowed = allowedDistrictCodes.includes(Number(b.id));

              // Allowed districts go to the top
              if (aAllowed && !bAllowed) return -1;
              if (!aAllowed && bAllowed) return 1;
              return 0;
            })
            .map((district: District) => ({
              value: district.id.toString(),
              label: district.name,
              disabled: !allowedDistrictCodes.includes(Number(district.id)), // disable others
            }))}
          selectedValues={selectedDistricts.map(String)}
          onChange={handleDistrictsChange}
          disabled={!selectedState || selectionsLocked || isLoading}
          label="District"
          placeholder="--Choose Districts--"
        />

        {/* Sub-Districts Multi-Select */}
        <MultiSelect
          options={subDistricts.map((sd: SubDistrict) => ({
            value: sd.id.toString(),
            label: formatSubDistrictDisplay(sd),
          }))}
          selectedValues={selectedSubDistricts.map(String)}
          onChange={handleSubDistrictsChange}
          disabled={
            selectedDistricts.length === 0 || selectionsLocked || isLoading
          }
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
        />
      </div>

      {/* Selection Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-3 flex items-center">
          {/* ...SVG... */} Selected Locations
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-800">State:</span>
            <span
              className={selectedState ? "text-green-700" : "text-gray-500"}
            >
              {states.find((s) => s.id === selectedState)?.name ||
                "None selected"}
            </span>
          </p>
          <p>
            <span className="font-medium text-gray-800">Districts:</span>{" "}
            <span
              className={
                selectedDistricts.length > 0
                  ? "text-green-700"
                  : "text-gray-500"
              }
            >
              {selectedDistricts.length > 0
                ? selectedDistricts.length === districts.length
                  ? `All Districts (${districts.length})`
                  : districts
                      .filter((d) => selectedDistricts.includes(Number(d.id)))
                      .map((d) => d.name)
                      .join(", ")
                : "None selected"}
            </span>
          </p>
          <p>
            <span className="font-medium text-gray-800">Sub-Districts:</span>{" "}
            <span
              className={
                selectedSubDistricts.length > 0
                  ? "text-green-700"
                  : "text-gray-500"
              }
            >
              {selectedSubDistricts.length > 0
                ? selectedSubDistricts.length === subDistricts.length
                  ? `All Sub-Districts (${subDistricts.length})`
                  : `${selectedSubDistricts.length} selected`
                : "None selected"}
            </span>
          </p>
          {selectionsLocked && (
            <div className="mt-3 p-2 bg-green-100 text-green-800 rounded-md flex items-center">
              {/* ...SVG... */}
              <span className="font-medium">
                Selections confirmed and locked
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 mt-6">
        <button
          className={`flex items-center px-6 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            selectedState && selectedDistricts.length > 0 && !selectionsLocked
              ? "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500"
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
          className="flex items-center px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
