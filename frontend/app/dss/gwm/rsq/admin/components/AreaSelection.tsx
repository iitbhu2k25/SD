// frontend/app/dss/rsq/admin/components/AreaSelection.tsx
"use client";

import React, { useMemo, useState } from "react";
import MultiSelect from "./Multiselect";
import { useLocation } from "@/contexts/rsq/admin/LocationContext";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    states,
    districts,
    blocks,
    villages,
    selectedState,
    selectedDistricts,
    selectedBlocks,
    selectedVillages,           // From Context
    isLoading,
    error,
    handleStateChange,
    setSelectedDistricts,
    setSelectedBlocks,
    setSelectedVillages,        // From Context - THIS WAS MISSING!
    resetSelections,
  } = useLocation();

  const [areaConfirmed, setAreaConfirmed] = useState(false);
  const selectionsLocked = areaConfirmed;

  // Sort states - State ID 9 first
  const sortedStates = useMemo(() => {
    const copy = [...states];
    const idx = copy.findIndex((s) => Number(s.id) === 9);
    if (idx !== -1) {
      const [state9] = copy.splice(idx, 1);
      copy.unshift(state9);
    }
    return copy;
  }, [states]);

  const allowedDistrictIds = [179, 152, 120, 174, 187];

  const isStateSelectable = (id: string | number): boolean => Number(id) === 9;

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectionsLocked) return;
    const value = e.target.value;
    if (value === "" || Number(value) === 9) {
      handleStateChange(value as string);
    }
  };

  // Enhanced districts with availability
const sortedEnhancedDistricts = useMemo(() => {
  return [...districts]
    .map((d) => {
      const id = Number(d.id);
      const allowed = allowedDistrictIds.includes(id);
      return {
        ...d,
        isAllowed: allowed,
        name: allowed ? d.name : `${d.name} (Not Available)`,
        disabled: !allowed,
        className: !allowed ? "text-gray-400 italic" : "",
      };
    })
    .sort((a, b) => {
      // Allowed districts first
      return Number(b.isAllowed) - Number(a.isAllowed);
    });
}, [districts]);


  const handleDistrictsChange = (ids: (string | number)[]) => {
    if (selectionsLocked) return;
    const valid = ids
      .map(String)
      .filter((id) => allowedDistrictIds.includes(Number(id)));
    setSelectedDistricts(valid);
  };

  const handleBlocksChange = (ids: (string | number)[]) => {
    if (selectionsLocked) return;
    setSelectedBlocks(ids.map(String));
  };

  const handleVillagesChange = (ids: (string | number)[]) => {
    if (selectionsLocked) return;
    const stringIds = ids.map(String);
    console.log("Villages selected → Map will now load:", stringIds);
    setSelectedVillages(stringIds); // This triggers village layer instantly
  };

  const handleConfirm = () => {
    setAreaConfirmed(true);
    onAreaConfirmed?.();
  };

  const handleReset = () => {
    resetSelections();
    setAreaConfirmed(false);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4">Area Selection</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* State */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            State:
          </label>
          <select
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedState || ""}
            onChange={handleStateSelect}
            disabled={isLoading || selectionsLocked}
          >
            <option value="">-- Choose a State --</option>
            {sortedStates.map((state) => (
              <option
                key={state.id}
                value={state.id}
                disabled={!isStateSelectable(state.id)}
              >
                {state.name}
                {!isStateSelectable(state.id) && ""}
              </option>
            ))}
          </select>
        </div>

        {/* District */}
        <MultiSelect
          items={sortedEnhancedDistricts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="-- Choose Districts --"
          disabled={!selectedState || isLoading || selectionsLocked}
          itemDisabled={(item: any) => item.disabled}
          itemClassName={(item: any) => item.className}
        />

        {/* Block */}
        <MultiSelect
          items={blocks}
          selectedItems={selectedBlocks}
          onSelectionChange={handleBlocksChange}
          label="Block"
          placeholder="-- Choose Blocks --"
          disabled={selectedDistricts.length === 0 || isLoading || selectionsLocked}
        />
      </div>

      {/* Villages */}
      <MultiSelect
        items={villages}
        selectedItems={selectedVillages}
        onSelectionChange={handleVillagesChange}
        label="Village"
        placeholder="-- Choose Villages --"
        disabled={selectedBlocks.length === 0 || isLoading || selectionsLocked}
      />

      {/* Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        {selectedVillages.length > 0 && !areaConfirmed && (
          <button
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded transition"
          >
            Confirm Selection ({selectedVillages.length})
          </button>
        )}

        <button
          onClick={handleReset}
          className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2 rounded transition"
        >
          Reset Selection
        </button>
      </div>

      {/* Optional Debug
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 text-xs font-mono text-gray-500">
          Villages in context: [{selectedVillages.join(", ")}]
        </div>
      )} */}
    </div>
  );
};

export default AreaSelection;