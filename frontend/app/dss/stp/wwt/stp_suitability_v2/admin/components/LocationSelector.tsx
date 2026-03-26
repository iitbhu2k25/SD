"use client";

import { useEffect } from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminUiStore } from "../stores/adminUiStore";
import { MultiSelect } from "../../../stp_priority_v2/shared/ui/MultiSelect";

export default function LocationSelector() {
  const {
    states,
    districts,
    subDistricts,
    towns,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedTowns,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setSelectedTowns,
    confirmSelections,
    unlockSelections,
  } = useAdminLocationStore();
  const syncLayersWithLocation = useAdminMapStore((state) => state.syncLayersWithLocation);
  const setRightPanelOpen = useAdminUiStore((state) => state.setRightPanelOpen);

  useEffect(() => {
    syncLayersWithLocation();
  }, [
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedTowns,
    syncLayersWithLocation,
  ]);

  return (
    <div className="rounded-2xl border border-stone-200 border-t-2 border-t-blue-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)] p-2.5 shadow-sm sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        <div>
          <label
            htmlFor="state-dropdown"
            className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm"
          >
            State:
          </label>
          <select
            id="state-dropdown"
            className="w-full rounded-lg border border-stone-300 bg-white/90 p-2 text-xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:p-2.5 sm:text-sm"
            value={selectedState ?? ""}
            onChange={(event) =>
              handleStateChange(
                event.target.value === "" ? Number.NaN : Number(event.target.value),
              )
            }
            disabled={selectionsLocked || isLoading}
          >
            <option value="">--Choose a State--</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={setSelectedDistricts}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading}
        />

        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={setSelectedSubDistricts}
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
        />

        <MultiSelect
          items={towns}
          selectedItems={selectedTowns}
          onSelectionChange={setSelectedTowns}
          label="Town"
          placeholder="--Choose Towns--"
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
          displayPattern={(town) =>
            `${town.name} (Pop: ${Number(town.population ?? 0).toLocaleString()})`
          }
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          onClick={() => void confirmSelections()}
          disabled={selectedTowns.length === 0 || selectionsLocked || isLoading}
          className={`${selectedTowns.length > 0 && !selectionsLocked && !isLoading
            ? "bg-linear-to-r from-blue-600 to-sky-600 shadow-md shadow-blue-200 transition duration-200 hover:from-blue-500 hover:to-sky-500 hover:scale-[1.02]"
            : "cursor-not-allowed bg-stone-300"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
        >
          Confirm Selection
        </button>
        <button
          onClick={() => {
            unlockSelections();
            setRightPanelOpen(false);
          }}
          disabled={selectedState === null && selectedDistricts.length === 0}
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
