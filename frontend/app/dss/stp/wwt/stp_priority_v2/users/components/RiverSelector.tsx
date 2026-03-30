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
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-emerald-400 bg-[linear-gradient(180deg,#faf8f5_0%,#f0f4f2_100%)] p-2.5 shadow-sm sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <div>
          <label htmlFor="river-dropdown" className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm">
            River:
          </label>
          <select
            id="river-dropdown"
            className="w-full rounded-lg border border-stone-300 bg-white/90 p-2 text-xs transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:p-2.5 sm:text-sm"
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

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${selectedCatchments.length > 0 && !selectionsLocked
            ? "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02] shadow-emerald-200"
            : "bg-stone-300 cursor-not-allowed"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={handleConfirm}
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading}
        >
          Confirm Selection
        </button>
        <button
          className="w-full rounded-full bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-slate-400 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm"
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
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-[11px] text-slate-600 sm:mt-4 sm:p-3 sm:text-sm">
          <div>Total Area: {totalArea.toFixed(2)} sq Km</div>
          <div>Total Catchments: {totalCatchments}</div>
        </div>
      )}
    </div>
  );
}
