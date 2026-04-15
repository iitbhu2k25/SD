"use client";
import React from "react";
import { RiverMultiSelect } from "./Multiselect";
import { useRiverSystem } from "@/contexts/stp/stp_suitability/users/DrainContext";
import { Stretch, Drain, Catchment } from "@/interface/raster_context";
import WholeLoading from "@/components/app_layout/newLoading";
import { useMap } from "@/contexts/stp/stp_suitability/users/DrainMapContext";

interface RiverSelectorProps {
  onConfirm?: (selectedData: {
    stretches: Stretch[];
    drains: Drain[];
  }) => void;
  onReset?: () => void;
}

const RiverSelector: React.FC<RiverSelectorProps> = ({ onConfirm, onReset }) => {
  const {
    rivers,
    stretches,
    drains,
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    selectionsLocked,
    isLoading,
    handleRiverChange,
    setSelectedStretches,
    setSelectedDrains,
    setSelectedCatchments,
    setShowCatchment,
    confirmSelections,
    resetSelections,
  } = useRiverSystem();

  const { resetMapView,catchmentLayer } = useMap();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) handleRiverChange(parseInt(e.target.value));
  };

  const handleStretchesChange = (ids: number[]): void => {
    if (!selectionsLocked) setSelectedStretches(ids);
  };

  const handleDrainsChange = (ids: number[]): void => {
    if (!selectionsLocked) setSelectedDrains(ids);
  };


  const handleConfirm = (): void => {
    if (!selectionsLocked) {
      const selectedData = confirmSelections();
      if (onConfirm && selectedData) {
        onConfirm({
          stretches: selectedData.stretches,
          drains: selectedData.drains,
        });
      }
    }
  };

  const handleReset = (): void => {
    resetSelections();
    resetMapView();
    onReset?.();
  };

  // ── Display helpers ────────────────────────────────────────────────────────

  const formatStretch = (s: Stretch): string =>
    s.name ? `${s.name} (ID: ${s.Stretch_ID})` : `Stretch ${s.Stretch_ID}`;

  const formatDrain = (d: Drain): string =>
    d.name ? `${d.name}` : `Drain ${d.Drain_No}`;

 
  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 bg-white rounded-lg shadow-md relative">
      <div className={isLoading ? "pointer-events-none opacity-50" : ""}>

        {/* ── 4-column grid: River → Stretch → Drain → Catchment ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

          {/* River */}
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
              value={selectedRiver ?? ""}
              onChange={handleRiverSelect}
              disabled={selectionsLocked || isLoading}
            >
              <option value="">-- Choose a River --</option>
              {rivers.map(r => (
                <option key={r.River_Code} value={r.River_Code}>
                  {r.River_Name}
                </option>
              ))}
            </select>
          </div>

          {/* Stretch */}
          <RiverMultiSelect
            items={stretches}
            selectedItems={selectedStretches}
            onSelectionChange={handleStretchesChange}
            label="Stretch"
            placeholder="-- Choose Stretches --"
            disabled={!selectedRiver || selectionsLocked || isLoading}
            displayPattern={formatStretch}
          />

          {/* Drain */}
          <RiverMultiSelect
            items={drains}
            selectedItems={selectedDrains}
            onSelectionChange={handleDrainsChange}
            label="Drain"
            placeholder="-- Choose Drains --"
            disabled={selectedStretches.length === 0 || selectionsLocked || isLoading}
            displayPattern={formatDrain}
          />
        </div>

        {/* ── Summary panel ── */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-2">
            Selected River System
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">River:</span>{" "}
              {rivers.find(r => r.River_Code === selectedRiver)?.River_Name ?? "None"}
            </p>
            <p>
              <span className="font-medium">Stretches:</span>{" "}
              {selectedStretches.length > 0
                ? selectedStretches.length === stretches.length
                  ? "All Stretches"
                  : stretches
                      .filter(s => selectedStretches.includes(Number(s.id)))
                      .map(formatStretch)
                      .join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-medium">Drains:</span>{" "}
              {selectedDrains.length > 0
                ? selectedDrains.length === drains.length
                  ? "All Drains"
                  : drains
                      .filter(d => selectedDrains.includes(Number(d.id)))
                      .map(formatDrain)
                      .join(", ")
                : "None"}
            </p>
            

            

            {selectionsLocked && (
              <p className="mt-2 text-green-600 font-medium">
                Selections confirmed and locked
              </p>
            )}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex space-x-4 mt-4">
          <button
            onClick={handleConfirm}
            disabled={catchmentLayer === null || selectionsLocked || isLoading}
            className={`py-2 px-4 rounded text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
              catchmentLayer !== null && !selectionsLocked
                ? "bg-blue-500 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Confirm Selection
          </button>

          <button
            onClick={handleReset}
            disabled={selectedRiver === null}
            className="py-2 px-4 rounded text-white text-sm font-medium bg-red-500 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-red-300 disabled:cursor-not-allowed"
          >
            Edit
          </button>
        </div>
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
};

export default RiverSelector;