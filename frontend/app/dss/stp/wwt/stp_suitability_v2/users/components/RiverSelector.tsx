"use client";

import { useEffect } from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserUiStore } from "../stores/userUiStore";

export default function RiverSelector() {
  const {
    rivers,
    stretches,
    drains,
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    catchmentLayerName,
    selectionsLocked,
    isLoading,
    handleRiverChange,
    setSelectedStretches,
    setSelectedDrains,
    setShowCatchment,
    confirmSelections,
    unlockSelections,
  } = useUserRiverStore();
  const syncLayersWithRiverSystem = useUserMapStore(
    (state) => state.syncLayersWithRiverSystem,
  );
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);

  const handleRiverSelect = (value: number | string | null) => {
    handleRiverChange(value === null ? Number.NaN : Number(value));
  };

  const handleConfirmSelection = async () => {
    await confirmSelections();
    syncLayersWithRiverSystem();
  };

  useEffect(() => {
    syncLayersWithRiverSystem();
  }, [
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    syncLayersWithRiverSystem,
  ]);

  useEffect(() => {
    if (selectionsLocked || selectedDrains.length === 0 || catchmentLayerName) {
      return;
    }

    void setShowCatchment(true).then(syncLayersWithRiverSystem);
  }, [
    catchmentLayerName,
    selectedDrains,
    selectionsLocked,
    setShowCatchment,
    syncLayersWithRiverSystem,
  ]);

  return (
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-emerald-400 bg-[linear-gradient(180deg,#faf8f5_0%,#f0f4f2_100%)] p-2.5 shadow-sm sm:p-4">
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
        />

        <MultiSelect
          items={stretches}
          selectedItems={selectedStretches}
          onSelectionChange={setSelectedStretches}
          label="Stretch"
          placeholder="--Choose Stretches--"
          disabled={!selectedRiver || selectionsLocked || isLoading}
          displayPattern={(stretch) =>
            stretch.name
              ? `${stretch.name} (ID: ${stretch.Stretch_ID})`
              : `Stretch ${stretch.Stretch_ID}`
          }
        />

        <MultiSelect
          items={drains}
          selectedItems={selectedDrains}
          onSelectionChange={setSelectedDrains}
          label="Drain"
          placeholder="--Choose Drains--"
          disabled={selectedStretches.length === 0 || selectionsLocked || isLoading}
          displayPattern={(drain) => drain.name ?? `Drain ${drain.Drain_No}`}
        />

        {selectedDrains.length > 0 && !selectionsLocked && !catchmentLayerName && (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Catchments are loading automatically for the selected drain(s).
          </p>
        )}
      </div>

      {!selectionsLocked && selectedCatchments.length > 0 && (
        <p className="text-xs font-medium text-sky-600 sm:text-sm">
          Catchments loaded. Confirm selections to unlock analysis.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          onClick={() => void handleConfirmSelection()}
          disabled={!catchmentLayerName || selectionsLocked || isLoading}
          className={`${catchmentLayerName && !selectionsLocked && !isLoading
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-200 transition duration-200 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02]"
            : "cursor-not-allowed bg-stone-300"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
        >
          Confirm Selection
        </button>
        <button
          onClick={() => {
            unlockSelections();
            setRightPanelOpen(false);
          }}
          disabled={selectedRiver === null}
          className="w-full rounded-full bg-slate-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-slate-400 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300 disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm"
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
