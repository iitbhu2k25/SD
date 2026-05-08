"use client";

import React from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUiModeService } from "../../services/uiModeService";

export default function RiverSelector() {
  const rivers = useUserRiverStore((state) => state.rivers);
  const stretches = useUserRiverStore((state) => state.stretches);
  const drains = useUserRiverStore((state) => state.drains);
  const catchments = useUserRiverStore((state) => state.catchments);
  const selectedRiver = useUserRiverStore((state) => state.selectedRiver);
  const selectedStretches = useUserRiverStore((state) => state.selectedStretches);
  const selectedDrains = useUserRiverStore((state) => state.selectedDrains);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const isLoading = useUserRiverStore((state) => state.isLoading);
  const totalArea = useUserRiverStore((state) => state.totalArea);
  const totalCatchments = useUserRiverStore((state) => state.totalCatchments);
  const setSelectedRiver = useUserRiverStore((state) => state.setSelectedRiver);
  const setSelectedStretches = useUserRiverStore((state) => state.setSelectedStretches);
  const setSelectedDrains = useUserRiverStore((state) => state.setSelectedDrains);
  const setSelectedCatchments = useUserRiverStore((state) => state.setSelectedCatchments);
  const setShowCatchment = useUserRiverStore((state) => state.setShowCatchment);
  const setAnalysisCatchment = useUserRiverStore((state) => state.setAnalysisCatchment);
  const confirmSelections = useUserRiverStore((state) => state.confirmSelections);
  const resetSelections = useUserRiverStore((state) => state.resetSelections);
  const isDark = useUiModeService((state) => state.isDark);

  const handleConfirm = async () => {
    if (selectedCatchments.length === 0 || selectionsLocked) {
      return;
    }
    await confirmSelections();
  };

  const canAnalyzeCatchment =
    selectedDrains.length > 0 && !selectionsLocked && !isLoading;

  const handleCatchmentAnalyze = async () => {
    if (!canAnalyzeCatchment) {
      return;
    }
    setAnalysisCatchment(true);
    await setShowCatchment(true);
  };

  return (
    <div
      className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
        isDark
          ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
          : "border border-t-2 border-stone-200 border-t-emerald-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)]"
      }`}
    >
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <SingleSelect
          items={rivers.map((river) => ({ id: river.River_Code, name: river.River_Name }))}
          selectedValue={selectedRiver}
          onValueChange={(id) => void setSelectedRiver(id === null ? null : Number(id))}
          label="River"
          placeholder="--Choose a River--"
          disabled={selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={stretches.map((stretch) => ({ id: stretch.id, name: `Stretch ${stretch.Stretch_ID}` }))}
          selectedItems={selectedStretches}
          onSelectionChange={(ids) => void setSelectedStretches(ids)}
          label="Stretch"
          placeholder="--Choose Stretches--"
          disabled={!selectedRiver || selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={drains.map((drain) => ({ id: drain.id, name: drain.name ?? `Drain ${drain.Drain_No}` }))}
          selectedItems={selectedDrains}
          onSelectionChange={(ids) => void setSelectedDrains(ids)}
          label="Drain"
          placeholder="--Choose Drains--"
          disabled={selectedStretches.length === 0 || selectionsLocked || isLoading}
          isDark={isDark}
        />

        <MultiSelect
          items={catchments.map((catchment) => ({ id: catchment.id, name: catchment.village_name }))}
          selectedItems={selectedCatchments}
          onSelectionChange={setSelectedCatchments}
          label="Catchment"
          placeholder="--Choose Catchments--"
          disabled={selectedDrains.length === 0 || selectionsLocked || isLoading}
          isDark={isDark}
          labelAction={
            <button
              type="button"
              onClick={handleCatchmentAnalyze}
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

      {/* <div className="rounded-xl border border-stone-200 bg-white/65 p-2 text-[11px] text-slate-600">
        <p>Total catchments: {totalCatchments}</p>
        <p>Total area: {totalArea.toFixed(2)} sq km</p>
      </div> */}

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${
            selectedCatchments.length > 0 && !selectionsLocked
              ? "bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02] shadow-emerald-200"
              : "bg-stone-300 cursor-not-allowed"
          } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={() => void handleConfirm()}
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>

        <button
          className="w-full rounded-full border border-transparent bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-slate-400 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300 sm:w-auto sm:px-4 sm:text-sm"
          onClick={resetSelections}
          disabled={!selectedRiver}
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
    </div>
  );
}
