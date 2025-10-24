"use client";
import React, { useState } from "react";
import { MultiSelect } from "./Multiselect";
import {
  useLocation,
  SubDistrict,
} from "@/contexts/rainwater/LocationContext";

interface LocationSelectorProps {
  onConfirm?: (selectedData: { subDistricts: SubDistrict[] }) => void;
  onReset?: () => void;
  setRainfall: (value: string) => void;
  setArea: (value: string) => void;
  setAreaUnit: (value: string) => void;
  isDrawing: boolean; // Add to track drawing state
  setIsDrawing: (value: boolean) => void; // Add to toggle drawing
  coordinates: number[][] | null; // Add to store drawn polygon coordinates
  setCoordinates: (coords: number[][] | null) => void;
  setResetPolygon: (value: boolean) => void;
  timeMode: "annually" | "monthly"; // "monthly" or "annually"
  setTimeMode: (value: "annually" | "monthly") => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onConfirm,
  onReset,
  setRainfall,
  setArea,
  setAreaUnit,
  isDrawing = false, // Default to false if undefined
  setIsDrawing = () => {}, // Default to no-op function if undefined
  coordinates = null, // Default to null if undefined
  setCoordinates,
  setResetPolygon,
  timeMode,
  setTimeMode,
}) => {
  // Use the location context instead of local state
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistrict,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistrict,
    setSelectedSubDistricts,
    confirmSelections,
    resetSelections,
  } = useLocation();

  const [selectedMonth, setSelectedMonth] = useState("0");

  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const selectedStateName = states.find((s) => s.id === selectedState)?.name;
  const isUttarPradesh = selectedStateName === "UTTAR PRADESH";

  const [mode, setMode] = useState<"select" | "draw">("select");

  // Add props for drawing and coordinates
  // const { isDrawing, setIsDrawing, coordinates } = props;

  // Modified areSelectionsComplete to account for Draw mode
  const areSelectionsComplete = (): boolean => {
    if (mode === "select") {
      if (!selectedState || !selectedDistrict) {
        return false;
      }
      if (isUttarPradesh && selectedSubDistricts.length === 0) {
        return false;
      }
      if (timeMode === "monthly" && selectedMonth === "0") {
        return false;
      }
      return true;
    } else {
      // Draw mode: require coordinates and year (and month if monthly)
      if (!coordinates || coordinates.length === 0) {
        return false;
      }
      if (timeMode === "monthly" && selectedMonth === "0") {
        return false;
      }
      return true;
    }
  };

  // Handle Confirm button for both modes
  const handleConfirm = async (): Promise<void> => {
    if (!areSelectionsComplete() || selectionsLocked) {
      return;
    }

    if (mode === "select") {
      const selectedData = confirmSelections();
      if (onConfirm && selectedData) {
        onConfirm(selectedData);
      }

      try {
        const payload = {
          layer_class: timeMode,
          // layer_date: selectedYear,
          district_id: selectedDistrict, // Integer
          subdistrict_id:
            isUttarPradesh && selectedSubDistricts[0] !== undefined
              ? selectedSubDistricts
              : [0], // Array Of Integers [342,568,659]
          month: timeMode === "monthly" ? selectedMonth : "0",
        };

        const response = await fetch("/api/rainwater/rainwater_raster", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        setRainfall(result.average_rainfall.toFixed(2));
        setArea(result.area.toFixed(2));
        setAreaUnit("m2");
        console.log("✅ Rainfall Data (Select):", result);
      } catch (error) {
        console.log("Error fetching select rainfall:", error);
      }
    } else {
      // Draw mode
      if (!coordinates) {
        console.log("No coordinates available for draw mode");
        return;
      }

      try {
        const payload = {
          coordinates,
          layer_class: timeMode,
          // layer_date: selectedYear,
          month: timeMode === "monthly" ? selectedMonth : null,
        };

        const response = await fetch(
          "/api/rainwater/polygon_rainfall",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );
        const result = await response.json();
        setRainfall(result.rainfall_avg_mm.toFixed(2));
        setArea(result.area_sqmeters.toFixed(2));
        setAreaUnit("m2");
        console.log("✅ Rainfall Data (Draw):", result);
      } catch (error) {
        console.log("Error fetching draw rainfall:", error);
      }
    }
  };

  // Handle Start/End Drawing
  const handleStartDrawing = () => {
    if (!selectionsLocked) {
      setIsDrawing(true);
    }
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  // Handle state selection from select input
  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      handleStateChange(parseInt(e.target.value));
    }
  };

  // Handle multi-select changes
  const handleDistrictSelect = (
    e: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    if (!selectionsLocked) {
      setSelectedDistrict(parseInt(e.target.value));
    }
  };

  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(selectedIds);
    }
  };

  // Handle reset button click
  const handleReset = (): void => {
    resetSelections();
    setTimeMode("annually");
    setSelectedMonth("0");
    setIsDrawing(false);
    setCoordinates(null);
    setResetPolygon(true);
    // Call the onReset prop to notify parent component
    if (onReset) {
      onReset();
    }
  };

  // Format sub-district display to include population
  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return `${subDistrict.name}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md w-full min-w-0">
      {/* Mode Toggle */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Mode:
        </label>
        <div className="flex space-x-4">
          <button
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
              mode === "select"
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            onClick={() => {
              setMode("select");
              setResetPolygon(true);
            }}
            disabled={selectionsLocked || isLoading}
          >
            Select
          </button>
          <button
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
              mode === "draw"
                ? "bg-green-500 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            onClick={() => setMode("draw")}
            disabled={selectionsLocked || isLoading}
          >
            Draw
          </button>
        </div>
      </div>

      {/* State/District Selectors (only for Select mode) */}
      {mode === "select" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label
              htmlFor="state-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              State:
            </label>
            <select
              id="state-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedState || ""}
              onChange={handleStateSelect}
              disabled={selectionsLocked || isLoading}
            >
              <option value="" className="h-40">
                --Choose a State--
              </option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="district-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              District:
            </label>
            <select
              id="district-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedDistrict ?? ""}
              onChange={handleDistrictSelect}
              disabled={!selectedState || selectionsLocked || isLoading}
            >
              <option value="">--Choose a District--</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </div>

          {isUttarPradesh && (
            <MultiSelect
              items={subDistricts}
              selectedItems={selectedSubDistricts}
              onSelectionChange={handleSubDistrictsChange}
              label="Sub-District"
              placeholder="--Choose SubDistricts--"
              disabled={!selectedDistrict || selectionsLocked || isLoading}
              displayPattern={formatSubDistrictDisplay}
            />
          )}
        </div>
      )}

      {/* Drawing Controls (only for Draw mode) */}
      {mode === "draw" && (
        <div className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <div className="flex space-x-4">
                <button
                  className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isDrawing
                      ? "bg-blue-500 text-white shadow-lg"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={handleStartDrawing}
                  disabled={selectionsLocked || isLoading || isDrawing}
                >
                  Start Drawing
                </button>
                <button
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer bg-gray-100 text-gray-600 hover:bg-gray-200"
                  onClick={handleStopDrawing}
                  disabled={selectionsLocked || isLoading || !isDrawing}
                >
                  End Drawing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Selection */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block font-medium">Time Mode</label>
          <select
            value={timeMode}
            onChange={(e) => {
              setTimeMode(e.target.value as "annually" | "monthly");
              setSelectedMonth("");
            }}
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={selectionsLocked || isLoading}
          >
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
          </select>
        </div>

        {timeMode === "monthly" && (
          <>
            <div className="flex-1 min-w-[150px]">
              <label className="block font-medium">Select Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={selectionsLocked || isLoading}
              >
                <option value="">Select Month</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Selected Values Display */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-2">
          Selected Values
        </h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-medium">Mode:</span> {mode}
          </p>
          {mode === "select" && (
            <>
              <p>
                <span className="font-medium">State:</span>{" "}
                {states.find((s) => s.id === selectedState)?.name || "None"}
              </p>
              <p>
                <span className="font-medium">District:</span>{" "}
                {selectedDistrict
                  ? districts.find((d) => d.id === selectedDistrict)?.name ||
                    "None"
                  : "None"}
              </p>
              <p>
                <span className="font-medium">Sub-Districts:</span>{" "}
                {selectedSubDistricts.length > 0
                  ? selectedSubDistricts.length === subDistricts.length
                    ? "All Sub-Districts"
                    : subDistricts
                        .filter((sd) =>
                          selectedSubDistricts.includes(Number(sd.id))
                        )
                        .map((sd) => sd.name)
                        .join(", ")
                  : "None"}
              </p>
            </>
          )}
          {mode === "draw" && (
            <p>
              <span className="font-medium">Polygon:</span>{" "}
              {coordinates ? "Drawn" : "Not drawn"}
            </p>
          )}
          <p>
            <span className="font-medium">Time Mode:</span> {timeMode}
          </p>
          {timeMode === "monthly" && (
            <p>
              <span className="font-medium">Month:</span>{" "}
              {months.find((m) => m.value === selectedMonth)?.label || "None"}
            </p>
          )}
          {/* <p>
            <span className="font-medium">Year:</span> {selectedYear || "None"}
          </p> */}
          {selectionsLocked && (
            <p className="mt-2 text-green-600 font-medium">
              Selections confirmed and locked
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 mt-4">
        {mode === "select" && (
          <button
            className={`${
              areSelectionsComplete() && !selectionsLocked
                ? "bg-blue-500 hover:bg-blue-700 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
            onClick={handleConfirm}
            disabled={!areSelectionsComplete() || selectionsLocked || isLoading}
          >
            Confirm Selection
          </button>
        )}
        {mode === "draw" && (
          <button
            className={`${
              areSelectionsComplete() && !selectionsLocked && !isDrawing
                ? "bg-green-500 hover:bg-green-700 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50`}
            onClick={handleConfirm}
            disabled={
              !areSelectionsComplete() ||
              selectionsLocked ||
              isDrawing ||
              isLoading
            }
          >
            Confirm Polygon
          </button>
        )}
        <button
          className="bg-red-500 hover:bg-red-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 cursor-pointer"
          onClick={handleReset}
          disabled={isLoading}
        >
          Reset
        </button>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mt-4 text-center">
          <p className="text-blue-600">Loading...</p>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
