"use client";
import React from "react";
import { RiverMultiSelect } from "./Multiselect";
import {
  useRiverSystem,
  Stretch,
  Drain,
  Catchment,
} from "@/contexts/stp_priority/users/DrainContext";
import WholeLoading from "@/components/app_layout/newLoading";
interface RiverSelectorProps {
  onConfirm?: (selectedData: {
    stretches: Stretch[];
    drains: Drain[];
    catchments: Catchment[];
    totalArea: number;
    totalCatchments: number;
  }) => void;
  onReset?: () => void;
}

const RiverSelector: React.FC<RiverSelectorProps> = ({
  onConfirm,
  onReset,
}) => {
  // Use the river system context instead of local state
  const {
    rivers,
    stretches,
    drains,
    catchments,
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    totalArea,
    totalCatchments,
    selectionsLocked,
    isLoading,
    handleRiverChange,
    setSelectedStretches,
    setSelectedDrains,
    setSelectedCatchments,
    confirmSelections,
    resetSelections,
  } = useRiverSystem();

  // Handle river selection from select input
  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      handleRiverChange(parseInt(e.target.value));
    }
  };

  // Handle multi-select changes
  const handleStretchesChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedStretches(selectedIds);
    }
  };

  const handleDrainsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedDrains(selectedIds);
    }
  };

  const handleCatchmentsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedCatchments(selectedIds);
    }
  };

  // Handle confirm button click
  const handleConfirm = (): void => {
    if (selectedCatchments.length > 0 && !selectionsLocked) {
      const selectedData = confirmSelections();
      
      if (onConfirm && selectedData) {
        onConfirm({
          stretches: selectedData.stretches,
          drains: selectedData.drains,
          catchments: selectedData.catchments,
          totalArea: selectedData.totalArea,
          totalCatchments,
        });
      }
    }
  };

  // Handle reset button click
  const handleReset = (): void => {
    resetSelections();

    // Call the onReset prop to notify parent component
    if (onReset) {
      onReset();
    }
  };

  // Format stretch display
  const formatStretchDisplay = (stretch: Stretch): string => {
    return stretch.name
      ? `${stretch.name} (ID: ${stretch.Stretch_ID})`
      : `Stretch ${stretch.Stretch_ID}`;
  };

  // Format drain display
  const formatDrainDisplay = (drain: Drain): string => {
    return drain.name
      ? `${drain.name} (No: ${drain.Drain_No})`
      : `Drain ${drain.Drain_No}`;
  };

  // Format catchment display
  const formatCatchmentDisplay = (catchment: Catchment): string => {
    return catchment.village_name;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* River Dropdown */}
          <div>
            <label
              htmlFor="river-dropdown"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              River:
            </label>
            <select
              id="river-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedRiver || ""}
              onChange={handleRiverSelect}
              disabled={selectionsLocked || isLoading}
            >
              <option value="">--Choose a River--</option>
              {rivers.map((river) => (
                <option key={river.River_Code} value={river.River_Code}>
                  {river.River_Name}
                </option>
              ))}
            </select>
          </div>

          {/* Stretch Multiselect */}
          <RiverMultiSelect
            items={stretches}
            selectedItems={selectedStretches}
            onSelectionChange={handleStretchesChange}
            label="Stretch"
            placeholder="--Choose Stretches--"
            disabled={!selectedRiver || selectionsLocked || isLoading}
            displayPattern={formatStretchDisplay}
          />

          {/* Drain Multiselect */}
          <RiverMultiSelect
            items={drains}
            selectedItems={selectedDrains}
            onSelectionChange={handleDrainsChange}
            label="Drain"
            placeholder="--Choose Drains--"
            disabled={
              selectedStretches.length === 0 || selectionsLocked || isLoading
            }
            displayPattern={formatDrainDisplay}
          />

          {/* Catchment Multiselect */}
          <RiverMultiSelect
            items={catchments}
            selectedItems={selectedCatchments}
            onSelectionChange={handleCatchmentsChange}
            label="Catchment Villages"
            placeholder="--Choose Catchments--"
            disabled={
              selectedDrains.length === 0 || selectionsLocked || isLoading
            }
            displayPattern={formatCatchmentDisplay}
          />
        </div>

        {/* Display selected values for demonstration */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-2">
            Selected River System
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">River:</span>{" "}
              {rivers.find((r) => r.River_Code === selectedRiver)?.River_Name ||
                "None"}
            </p>
            <p>
              <span className="font-medium">Stretches:</span>{" "}
              {selectedStretches.length > 0
                ? selectedStretches.length === stretches.length
                  ? "All Stretches"
                  : stretches
                      .filter((s) => selectedStretches.includes(Number(s.id)))
                      .map((s) => formatStretchDisplay(s))
                      .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-medium">Drains:</span>{" "}
              {selectedDrains.length > 0
                ? selectedDrains.length === drains.length
                  ? "All Drains"
                  : drains
                      .filter((d) => selectedDrains.includes(Number(d.id)))
                      .map((d) => formatDrainDisplay(d))
                      .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-medium">Catchments:</span>{" "}
              {selectedCatchments.length > 0
                ? selectedCatchments.length === catchments.length
                  ? "All Catchments"
                  : catchments
                      .filter((c) => selectedCatchments.includes(Number(c.id)))
                      .map((c) => formatCatchmentDisplay(c))
                      .join(", ")
                : "None"}
            </p>

            {selectedCatchments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p>
                  <span className="font-medium">Total Area:</span>{" "}
                  {totalArea.toFixed(2)} sq Km
                </p>
                <p>
                  <span className="font-medium">Total Catchments:</span>{" "}
                  {totalCatchments}
                </p>
              </div>
            )}

            {selectionsLocked && (
              <p className="mt-2 text-green-600 font-medium">
                Selections confirmed and locked
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-4 mt-4">
          <button
            className={`${
              selectedCatchments.length > 0 && !selectionsLocked
                ? "bg-blue-500 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
            onClick={handleConfirm}
            disabled={
              selectedCatchments.length === 0 || selectionsLocked || isLoading
            }
          >
            Confirm Selection
          </button>
         
        </div>

      {isLoading && (
        <WholeLoading visible={true} title="Connecting to server" message="Working on preparing data" />
      )}
    </div>
  );
};

export default RiverSelector;
