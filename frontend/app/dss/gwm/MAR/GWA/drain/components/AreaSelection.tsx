"use client";

import React from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    rivers,
    stretches,
    drains,
    catchments,
    villages,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,
    handleRiverChange,
    handleStretchChange,
    handleDrainChange,
    setSelectedCatchments,
    setSelectedVillages,
    handleAreaConfirm,
    resetSelections,
  } = useLocation();

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const riverCode = parseInt(e.target.value);
      console.log("Selected river code:", riverCode);
      handleRiverChange(riverCode);
    }
  };

  const handleStretchSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const stretchId = parseInt(e.target.value);
      console.log("Selected stretch ID:", stretchId);
      handleStretchChange(stretchId);
    }
  };

  const handleDrainSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const drainNo = parseInt(e.target.value);
      console.log("Selected drain number:", drainNo);
      handleDrainChange(drainNo);
    }
  };

  const handleCatchmentsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      console.log("Selected catchments:", selectedIds);
      setSelectedCatchments(selectedIds);
    }
  };

  const handleVillagesChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      console.log("Selected villages:", selectedIds);
      setSelectedVillages(selectedIds);
    }
  };

  const handleConfirmArea = () => {
    handleAreaConfirm();
    if (onAreaConfirmed) {
      onAreaConfirmed();
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      {/* {isLoading && (
        <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">
          Loading data...
        </div>
      )} */}

      {/* AREA SELECTION SECTION */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Area Selection</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* River Selection */}
          <div>
            <label htmlFor="river-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              River:
            </label>
            <select
              id="river-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedRiver || ""}
              onChange={handleRiverSelect}
              disabled={selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a River--</option>
              {rivers.map((river) => (
                <option key={river.code} value={river.code}>
                  {river.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stretch Selection */}
          <div>
            <label htmlFor="stretch-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              Stretch:
            </label>
            <select
              id="stretch-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedStretch || ""}
              onChange={handleStretchSelect}
              disabled={!selectedRiver || selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a Stretch--</option>
              {stretches.map((stretch) => (
                <option key={stretch.stretchId} value={stretch.stretchId}>
                  {stretch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Drain Selection */}
          <div>
            <label htmlFor="drain-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              Drain:
            </label>
            <select
              id="drain-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedDrain || ""}
              onChange={handleDrainSelect}
              disabled={!selectedStretch || selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a Drain--</option>
              {drains.map((drain) => (
                <option key={drain.drainNo} value={drain.drainNo}>
                  Drain {drain.drainNo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row for Catchments and Villages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Catchments Multi-Selection */}
          <MultiSelect
            items={catchments.map(c => ({ id: c.objectId, name: c.name }))}
            selectedItems={selectedCatchments}
            onSelectionChange={handleCatchmentsChange}
            label="Catchments"
            placeholder="--Choose Catchments--"
            disabled={!selectedDrain || selectionsLocked || isLoading || areaConfirmed}
          />

          {/* Villages Multi-Selection */}
          <MultiSelect
            items={villages.map(v => ({ id: v.code, name: v.name }))}
            selectedItems={selectedVillages}
            onSelectionChange={handleVillagesChange}
            label="Villages"
            placeholder="--Choose Villages--"
            disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading || areaConfirmed}
          />
        </div>

        {/* Selection Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">River:</span>{" "}
              {rivers.find((r) => r.code === selectedRiver)?.name || "None"}
              {/* {selectedRiver && <span className="text-gray-500 ml-1">(Code: {selectedRiver})</span>} */}
            </p>
            <p>
              <span className="font-medium">Stretch:</span>{" "}
              {stretches.find((s) => s.stretchId === selectedStretch)?.name || "None"}
              {selectedStretch && <span className="text-gray-500 ml-1">(ID: {selectedStretch})</span>}
            </p>
            <p>
              <span className="font-medium">Drain:</span>{" "}
              {selectedDrain ? `Drain ${selectedDrain}` : "None"}
              {selectedDrain && <span className="text-gray-500 ml-1">(No: {selectedDrain})</span>}
            </p>
            <p>
              <span className="font-medium">Catchments:</span>{" "}
              {selectedCatchments.length > 0
                ? selectedCatchments.length === catchments.length
                  ? "All Catchments"
                  : catchments
                    .filter((c) => selectedCatchments.includes(Number(c.objectId)))
                    .map((c) => c.name)
                    .join(", ")
                : "None"}
              {selectedCatchments.length > 0 && (
                <span className="text-gray-500 ml-1">
                  (Object IDs: {selectedCatchments.join(", ")})
                </span>
              )}
            </p>
            <p className="flex">
              <span className="font-medium flex-shrink-0">Villages:</span>{" "}
              <span
                className={`ml-1 ${selectedVillages.length > 0 &&
                  selectedVillages.length !== villages.length &&
                  villages.filter((v) => selectedVillages.includes(Number(v.code))).length > 4
                  ? "max-h-40 overflow-y-auto border border-gray-200 rounded px-2 py-1 bg-gray-50"
                  : ""
                  }`}
              >
                {selectedVillages.length > 0
                  ? selectedVillages.length === villages.length
                    ? "All Villages"
                    : villages
                      .filter((v) => selectedVillages.includes(Number(v.code)))
                      .map((v) => v.name)
                      .join(", ")
                  : "None"}
              </span>
            </p>


            {areaConfirmed && (
              <p className="mt-2 text-green-600 font-medium">✓ Area selection confirmed</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-4">
          {/* Confirm Area Button */}
          {(selectedVillages.length > 0 || selectedCatchments.length > 0) && !areaConfirmed && (
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

          )}

          {/* Reset Button */}
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