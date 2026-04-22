"use client";

import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import {
  Catchment,
  Drain,
  Stretch,
} from "@/interface/raster_context";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";
import { useUiModeService } from "../../services/uiModeService";

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
  const setShowCatchment = useUserRiverStore((state) => state.setShowCatchment);
  const setAnalysisCachement = useUserRiverStore(
    (state) => state.setAnalysisCachement,
  );
  const confirmSelections = useUserRiverStore((state) => state.confirmSelections);
  const resetSelections = useUserRiverStore((state) => state.resetSelections);
  const resetMapView = useUserMapStore((state) => state.resetMapView);
  const isDark = useUiModeService((s) => s.isDark);

  const handleRiverSelect = (value: number | string | null) => {
    if (!selectionsLocked) {
      handleRiverChange(value === null ? Number.NaN : Number(value));
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
  const canAnalyzeCatchment =
    selectedDrains.length > 0 && !selectionsLocked && !isLoading;
  const handleAnalyzeCatchment = async () => {
    if (!canAnalyzeCatchment) {
      return;
    }
    setAnalysisCachement(true);
    await setShowCatchment(true);
  };

  const formatStretchDisplay = (stretch: Stretch) =>
    stretch.name
      ? `${stretch.name} (ID: ${stretch.Stretch_ID})`
      : `Stretch ${stretch.Stretch_ID}`;

  const formatDrainDisplay = (drain: Drain) =>
    drain.name ? `${drain.name} (No: ${drain.Drain_No})` : `Drain ${drain.Drain_No}`;

  const formatCatchmentDisplay = (catchment: Catchment) => catchment.village_name;

  return (
    <div className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
      isDark
        ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
        : "border border-t-2 border-stone-200 border-t-emerald-400 bg-[linear-gradient(180deg,#faf8f5_0%,#f0f4f2_100%)]"
    }`}>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <SingleSelect
          items={rivers.map((river) => ({
            id: river.River_Code,
            name: river.River_Name,
          }))}
          selectedValue={selectedRiver}
          onValueChange={handleRiverSelect}
          label="River"
          placeholder="--Choose a River--"
          disabled={selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={stretches}
          selectedItems={selectedStretches}
          onSelectionChange={setSelectedStretches}
          label="Stretch"
          placeholder="--Choose Stretches--"
          disabled={!selectedRiver || selectionsLocked || isLoading}
          displayPattern={formatStretchDisplay}
          isDark={isDark}
        />

        <MultiSelect
          items={drains}
          selectedItems={selectedDrains}
          onSelectionChange={setSelectedDrains}
          label="Drain"
          placeholder="--Choose Drains--"
          disabled={selectedStretches.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatDrainDisplay}
          isDark={isDark}
        />

        <MultiSelect
          items={catchments}
          selectedItems={selectedCatchments}
          onSelectionChange={setSelectedCatchments}
          label="Catchment Village"
          placeholder="--Choose Catchments--"
          disabled={selectedDrains.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatCatchmentDisplay}
          isDark={isDark}
          labelAction={
            <button
              type="button"
              onClick={handleAnalyzeCatchment}
              disabled={!canAnalyzeCatchment}
              className={`h-7 rounded-md border px-2.5 text-[11px] font-semibold shadow-sm transition sm:h-8 sm:text-xs ${
                canAnalyzeCatchment
                  ? isDark
                    ? "cursor-pointer border-cyan-800 bg-cyan-900/40 text-cyan-400 hover:bg-cyan-900/60"
                    : "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : isDark
                    ? "cursor-not-allowed border-[#1e3a5f]/60 bg-[#080e1c]/60 text-slate-500"
                    : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
              }`}
              title="Analyze selected drains to load catchment villages"
            >
              Analyse Catchments
            </button>
          }
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${
            selectedCatchments.length > 0 && !selectionsLocked
              ? isDark
                ? "border border-cyan-800 bg-cyan-900/60 hover:bg-cyan-800 shadow-[0_0_15px_rgba(8,145,178,0.3)] hover:scale-[1.02]"
                : "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02] shadow-emerald-200"
              : isDark
                ? "border border-[#1e3a5f]/50 bg-[#080e1c]/80 text-[#1e3a5f] cursor-not-allowed"
                : "bg-stone-300 cursor-not-allowed"
          } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={handleConfirm}
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading}
        >
          Confirm Selection
        </button>
        <button
          className={`w-full rounded-full border px-3.5 py-2 text-xs font-semibold shadow-md transition duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm ${
            isDark
              ? "border-[#1e3a5f] bg-[#0c182b] text-slate-300 hover:bg-[#12233f] hover:text-white focus:ring-[#1e3a5f] disabled:border-[#1e3a5f]/50 disabled:bg-[#080e1c] disabled:text-[#1e3a5f]"
              : "border-transparent bg-slate-500 text-white hover:bg-slate-400 focus:ring-slate-400 disabled:bg-stone-300 disabled:hover:bg-stone-300"
          }`}
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
        <div className={`mt-3 rounded-xl border p-2.5 text-[11px] sm:mt-4 sm:p-3 sm:text-sm ${
          isDark
            ? "border-cyan-900/50 bg-cyan-950/20 text-cyan-200"
            : "border-emerald-100 bg-emerald-50/60 text-slate-600"
        }`}>
          <div>Total Area: {totalArea.toFixed(2)} sq Km</div>
          <div>Total Catchments: {totalCatchments}</div>
        </div>
      )}
    </div>
  );
}
