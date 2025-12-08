"use client";

import React, { useMemo } from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation, SubDistrict } from "@/contexts/groundwater_assessment/admin/LocationContext";

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

  // Allowed district IDs
  const allowedDistrictIds = [179,152, 120, 174, 187];

  // Check if a state is selectable (only id 9)
  const isStateSelectable = (stateId: string | number): boolean => {
    return Number(stateId) === 9;
  };

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const stateId = parseInt(e.target.value);
      if (stateId === 9 || e.target.value === "") {
        console.log("Selected state ID:", stateId);
        handleStateChange(stateId);
      }
    }
  };

  // Sort and enhance districts: Available first, then unavailable, with gray styling
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

      if (isAllowed) {
        available.push(enhanced);
      } else {
        unavailable.push(enhanced);
      }
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
      const validIds = selectedIds.filter(id => allowedDistrictIds.includes(id));
      console.log("Selected districts:", validIds);
      setSelectedDistricts(validIds);
    }
  };

  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      console.log("Selected sub-districts:", selectedIds);
      setSelectedSubDistricts(selectedIds);
    }
  };

  const handleConfirmArea = () => {
    handleAreaConfirm();
    if (onAreaConfirmed) {
      onAreaConfirmed();
    }
  };

  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return `${subDistrict.name}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Area Selection</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* STATE DROPDOWN */}
          <div>
            <label htmlFor="state-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              State:
            </label>
            <select
              id="state-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedState || ""}
              onChange={handleStateSelect}
              disabled={selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a State--</option>
              {sortedStates.map((state) => {
                const selectable = isStateSelectable(state.id);
                return (
                  <option
                    key={state.id}
                    value={state.id}
                    disabled={!selectable}
                    className={!selectable ? "text-gray-400 bg-gray-100" : ""}
                  >
                    {state.name} {!selectable ? "(Not Available)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* DISTRICT MULTISELECT - GRAY + DISABLED FOR UNAVAILABLE */}
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

          {/* SUB-DISTRICT MULTISELECT */}
          <MultiSelect
            items={subDistricts}
            selectedItems={selectedSubDistricts}
            onSelectionChange={handleSubDistrictsChange}
            label="Sub-District"
            placeholder="--Choose SubDistricts--"
            disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading || areaConfirmed}
            displayPattern={formatSubDistrictDisplay}
          />
        </div>

        {/* SELECTED LOCATIONS SUMMARY */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">State:</span>{" "}
              {states.find((s) => s.id === selectedState)?.name || "None"}
            </p>
            <p>
              <span className="font-medium">Districts:</span>{" "}
              {selectedDistricts.length > 0
                ? selectedDistricts.length === allowedDistrictIds.length
                  ? "All Available Districts"
                  : districts
                      .filter((d) => selectedDistricts.includes(Number(d.id)))
                      .map((d) => d.name)
                      .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-medium">Sub-Districts:</span>{" "}
              {selectedSubDistricts.length > 0
                ? selectedSubDistricts.length === subDistricts.length
                  ? "All Sub-Districts"
                  : subDistricts
                      .filter((sd) => selectedSubDistricts.includes(Number(sd.id)))
                      .map((sd) => sd.name)
                      .join(", ")
                : "None"}
            </p>

            {areaConfirmed && (
              <p className="mt-2 text-green-600 font-medium">Area selection confirmed</p>
            )}
          </div>
        </div>

        {/* CONFIRM BUTTON */}
        {selectedSubDistricts.length > 0 && !areaConfirmed && (
          <div className="mt-4">
            <button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 
               text-white font-semibold py-3 px-6 rounded-full shadow-lg 
               transform hover:scale-105 transition duration-300 ease-in-out 
               focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"
              onClick={handleConfirmArea}
              disabled={isLoading}
            >
              Confirm Area Selection
            </button>
          </div>
        )}

        {/* RESET BUTTON */}
        <div className="mt-4">
          <button
            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 
             text-white font-semibold py-3 px-6 rounded-full shadow-lg 
             transform hover:scale-105 transition duration-300 ease-in-out 
             focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50"
            onClick={resetSelections}
            disabled={isLoading}
          >
            Reset Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default AreaSelection;