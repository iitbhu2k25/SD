"use client";

import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import {
  Catchment,
  Drain,
  Stretch,
} from "@/interface/raster_context";
import { MultiSelect } from "../../shared/ui/MultiSelect";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";

interface RiverSelectorProps {
  onConfirm?: (selectedData: {
    stretches: Stretch[];
    drains: Drain[];
    catchments: Catchment[];
    totalArea: number;
    totalCatchments: number;
  }) => void;
}

export default function RiverSelector({ onConfirm }: RiverSelectorProps) {
  const rivers = useUserRiverStore((state) => state.rivers);
  const stretches = useUserRiverStore((state) => state.stretches);
  const drains = useUserRiverStore((state) => state.drains);
  const catchments = useUserRiverStore((state) => state.catchments);
  const selectedRiver = useUserRiverStore((state) => state.selectedRiver);
  const selectedStretches = useUserRiverStore((state) => state.selectedStretches);
  const selectedDrains = useUserRiverStore((state) => state.selectedDrains);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const totalArea = useUserRiverStore((state) => state.totalArea);
  const totalCatchments = useUserRiverStore((state) => state.totalCatchments);
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const isLoading = useUserRiverStore((state) => state.isLoading);
  const handleRiverChange = useUserRiverStore((state) => state.handleRiverChange);
  const setSelectedStretches = useUserRiverStore(
    (state) => state.setSelectedStretches,
  );
  const setSelectedDrains = useUserRiverStore((state) => state.setSelectedDrains);
  const setSelectedCatchments = useUserRiverStore(
    (state) => state.setSelectedCatchments,
  );
  const confirmSelections = useUserRiverStore((state) => state.confirmSelections);
  const resetSelections = useUserRiverStore((state) => state.resetSelections);
  const resetMapView = useUserMapStore((state) => state.resetMapView);

  const handleRiverSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) {
      handleRiverChange(parseInt(event.target.value, 10));
    }
  };

  const handleConfirm = async () => {
    if (selectedCatchments.length > 0 && !selectionsLocked) {
      const selectedData = await confirmSelections();
      if (selectedData && onConfirm) {
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

  const handleReset = () => {
    resetMapView();
    resetSelections();
  };

  const formatStretchDisplay = (stretch: Stretch) =>
    stretch.name
      ? `${stretch.name} (ID: ${stretch.Stretch_ID})`
      : `Stretch ${stretch.Stretch_ID}`;

  const formatDrainDisplay = (drain: Drain) =>
    drain.name ? `${drain.name} (No: ${drain.Drain_No})` : `Drain ${drain.Drain_No}`;

  const formatCatchmentDisplay = (catchment: Catchment) => catchment.village_name;

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label htmlFor="river-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
            River:
          </label>
          <select
            id="river-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedRiver ?? ""}
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

        <MultiSelect
          items={stretches}
          selectedItems={selectedStretches}
          onSelectionChange={setSelectedStretches}
          label="Stretch"
          placeholder="--Choose Stretches--"
          disabled={!selectedRiver || selectionsLocked || isLoading}
          displayPattern={formatStretchDisplay}
        />

        <MultiSelect
          items={drains}
          selectedItems={selectedDrains}
          onSelectionChange={setSelectedDrains}
          label="Drain"
          placeholder="--Choose Drains--"
          disabled={selectedStretches.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatDrainDisplay}
        />

        <MultiSelect
          items={catchments}
          selectedItems={selectedCatchments}
          onSelectionChange={setSelectedCatchments}
          label="Catchment Village"
          placeholder="--Choose Catchments--"
          disabled={selectedDrains.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatCatchmentDisplay}
        />
      </div>

      <div className="flex space-x-4 mt-4">
        <button
          className={`${
            selectedCatchments.length > 0 && !selectionsLocked
              ? "bg-blue-500 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={handleConfirm}
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading}
        >
          Confirm Selection
        </button>
        <button
          className="bg-red-500 hover:bg-red-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:bg-red-300 disabled:cursor-not-allowed disabled:hover:bg-red-300"
          onClick={handleReset}
          disabled={selectedRiver === null}
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

      {selectedCatchments.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <div>Total Area: {totalArea.toFixed(2)} sq Km</div>
          <div>Total Catchments: {totalCatchments}</div>
        </div>
      )}
    </div>
  );
}
