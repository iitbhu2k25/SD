"use client";

import { useEffect } from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { MultiSelect } from "@/components/dss_common/MultiSelect";
import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserUiStore } from "../stores/userUiStore";

export default function RiverSelector() {
  const {
    rivers,
    stretches,
    drains,
    catchments,
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
    unlockSelections,
  } = useUserRiverStore();
  const syncLayersWithRiverSystem = useUserMapStore(
    (state) => state.syncLayersWithRiverSystem,
  );
  const setRightPanelOpen = useUserUiStore((state) => state.setRightPanelOpen);

  useEffect(() => {
    syncLayersWithRiverSystem();
  }, [
    selectedRiver,
    selectedStretches,
    selectedDrains,
    selectedCatchments,
    syncLayersWithRiverSystem,
  ]);

  return (
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-emerald-400 bg-[linear-gradient(180deg,#faf8f5_0%,#f0f4f2_100%)] p-2.5 shadow-sm sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <div>
          <label
            htmlFor="river-dropdown"
            className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm"
          >
            River:
          </label>
          <select
            id="river-dropdown"
            className="w-full rounded-lg border border-stone-300 bg-white/90 p-2 text-xs transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:p-2.5 sm:text-sm"
            value={selectedRiver ?? ""}
            onChange={(event) =>
              handleRiverChange(
                event.target.value === "" ? Number.NaN : Number(event.target.value),
              )
            }
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

        <div className="space-y-3">
          <button
            onClick={() => void setShowCatchment(true)}
            disabled={selectedDrains.length === 0 || selectionsLocked || isLoading}
            className={`${selectedDrains.length > 0 && !selectionsLocked && !isLoading
              ? "bg-linear-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-200 transition duration-200 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02]"
              : "cursor-not-allowed bg-stone-300"
              } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 sm:px-4 sm:text-sm`}
          >
            {isLoading && selectedDrains.length > 0 ? "Loading Catchments..." : "Load Catchments"}
          </button>

          <MultiSelect
            items={catchments}
            selectedItems={selectedCatchments}
            onSelectionChange={setSelectedCatchments}
            label="Catchment Village"
            placeholder="--Choose Catchments--"
            disabled={selectedDrains.length === 0 || selectionsLocked || isLoading}
            displayPattern={(catchment) => catchment.village_name}
          />
        </div>
      </div>

      {!selectionsLocked && selectedCatchments.length > 0 && (
        <p className="text-xs font-medium text-sky-600 sm:text-sm">
          Catchments loaded. Confirm selections to unlock analysis.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          onClick={() => void confirmSelections()}
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading}
          className={`${selectedCatchments.length > 0 && !selectionsLocked && !isLoading
            ? "bg-linear-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-200 transition duration-200 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.02]"
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
