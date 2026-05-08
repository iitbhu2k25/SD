"use client";

import React, { useMemo } from "react";
import WholeLoading from "@/components/app_layout/newLoading";
import { SingleSelect } from "@/components/dss_common/SingleSelect";
import { RiverMultiSelect } from "../../components/RiverMultiSelect";
import { useAdminViewModel } from "../hooks/useAdminViewModel";
import { useUiModeStore } from "../../services/uiModeService";

const ALLOWED_DISTRICT_CODES = new Set([179, 152, 120, 174, 187]);

export default function AdminLocationSelector() {
  const { location, handleConfirmArea, handleReset, handleStateSelection, handleDistrictSelection } = useAdminViewModel();
  const isDark = useUiModeStore((s) => s.isDark);

  const {
    states, districts, subDistricts,
    selectedState, selectedDistricts, selectedSubDistricts, selectedSeason, selectedYear,
    selectionsLocked, isLoading
  } = location;

  const canConfirm =
    selectedSubDistricts.length > 0 &&
    selectedSeason !== "" &&
    selectedYear !== "" &&
    !selectionsLocked &&
    !isLoading;

  const seasonOptions = [
    { id: "premonsoon", name: "Pre-Monsoon" },
    { id: "monsoon", name: "Monsoon" },
    { id: "postmonsoon", name: "Post-Monsoon" }
  ];

  const yearOptions = [
    { id: "2025", name: "2025" }
  ];

  const districtItems = useMemo(
    () =>
      districts
        .slice()
        .sort((a, b) => {
          const aAllowed = ALLOWED_DISTRICT_CODES.has(Number(a.id));
          const bAllowed = ALLOWED_DISTRICT_CODES.has(Number(b.id));
          if (aAllowed && !bAllowed) return -1;
          if (!aAllowed && bAllowed) return 1;
          return 0;
        })
        .map((district) => ({
          ...district,
          disabled: !ALLOWED_DISTRICT_CODES.has(Number(district.id)),
        })),
    [districts],
  );

  return (
    <div className={`rounded-2xl border p-2.5 shadow-sm sm:p-4 ${
      isDark
        ? "border-[#1e3a5f]/50 bg-[#06101e]/80"
        : "border border-t-2 border-stone-200 border-t-blue-400 bg-[linear-gradient(180deg,#faf8f5_0%,#eef4fb_100%)]"
    }`}>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:mb-4 sm:gap-4">
        
        <SingleSelect
          items={states}
          selectedValue={selectedState}
          onValueChange={(val) => { if (!selectionsLocked && val) handleStateSelection(val as number); }}
          label="State"
          placeholder="--Choose a State--"
          disabled={selectionsLocked || isLoading}
          isDark={isDark}
        />

        <RiverMultiSelect
          items={districtItems}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictSelection}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading}
          isDark={isDark}
        />

        <RiverMultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={(ids) => !selectionsLocked && location.setSelectedSubDistricts(ids)}
          label="Sub-District"
          placeholder="--Choose Sub-Districts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
          isDark={isDark}
        />

        <SingleSelect
          items={seasonOptions}
          selectedValue={selectedSeason || null}
          onValueChange={(val) => { if (val) location.setSelectedSeason(val as "premonsoon" | "monsoon" | "postmonsoon"); }}
          label="Season"
          placeholder="--Choose Season--"
          disabled={isLoading}
          isDark={isDark}
        />

        <SingleSelect
          items={yearOptions}
          selectedValue={selectedYear || null}
          onValueChange={(val) => { if (val) location.setSelectedYear(val as "2025"); }}
          label="Year"
          placeholder="--Choose Year--"
          disabled={isLoading}
          isDark={isDark}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 sm:mt-4 sm:flex-row sm:gap-3">
        <button
          className={`${
            canConfirm
              ? isDark
                ? "border border-[#1e3a5f] bg-[#0c2e63]/70 hover:bg-[#0c2e63] shadow-[0_0_15px_rgba(12,46,99,0.5)] hover:scale-[1.02]"
                : "bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 hover:scale-[1.02] shadow-blue-200"
              : isDark
                ? "border border-[#1e3a5f]/50 bg-[#080e1c]/80 text-[#1e3a5f] cursor-not-allowed"
                : "bg-stone-300 cursor-not-allowed"
            } w-full rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 sm:w-auto sm:px-4 sm:text-sm`}
          onClick={handleConfirmArea}
          disabled={!canConfirm}
        >
          Confirm
        </button>

        <button
          className={`w-full rounded-full border px-3.5 py-2 text-xs font-semibold shadow-md transition duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:hover:scale-100 sm:w-auto sm:px-4 sm:text-sm ${
            isDark
              ? "border-[#1e3a5f] bg-[#0c182b] text-slate-300 hover:bg-[#12233f] hover:text-white focus:ring-[#1e3a5f] disabled:border-[#1e3a5f]/50 disabled:bg-[#080e1c] disabled:text-[#1e3a5f]"
              : "border-transparent bg-slate-500 text-white hover:bg-slate-400 focus:ring-slate-500 disabled:bg-stone-300 disabled:hover:bg-stone-300"
          }`}
          onClick={handleReset}
          disabled={selectedState === null}
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
