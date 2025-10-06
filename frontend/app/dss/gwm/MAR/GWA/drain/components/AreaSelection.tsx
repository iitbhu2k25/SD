'use client';
import React from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    rivers, stretches, drains, catchments, villages,
    selectedRiver, selectedStretch, selectedDrain,
    selectedCatchments, selectedVillages,
    selectionsLocked, isLoading, error, areaConfirmed,
    handleRiverChange, handleStretchChange, handleDrainChange,
    setSelectedCatchments, setSelectedVillages,
    handleAreaConfirm, resetSelections
  } = useLocation();

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleRiverChange(Number(e.target.value));
  };
  const handleStretchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleStretchChange(Number(e.target.value));
  };
  const handleDrainSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectionsLocked) handleDrainChange(Number(e.target.value));
  };
  const handleCatchmentsChange = (ids: (number | string)[]) => {
    if (!selectionsLocked) {
      const numericIds = ids.map(id => Number(id)); // convert all to numbers
      setSelectedCatchments(numericIds);
    }
  };

  const handleVillagesChange = (ids: (number | string)[]) => {
    if (!selectionsLocked) {
      const numericIds = ids.map(id => Number(id)); // convert all to numbers
      setSelectedVillages(numericIds);
    }
  };

  const handleConfirmArea = () => { handleAreaConfirm(); onAreaConfirmed?.(); };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}

      <h2 className="text-xl font-bold text-gray-800 mb-4">Area Selection</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">River:</label>
          <select
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedRiver || ""} onChange={handleRiverSelect} disabled={selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a River--</option>
            {rivers.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Stretch:</label>
          <select
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedStretch || ""} onChange={handleStretchSelect} disabled={!selectedRiver || selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a Stretch--</option>
            {stretches.map(s => <option key={s.stretchId} value={s.stretchId}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Drain:</label>
          <select
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedDrain || ""} onChange={handleDrainSelect} disabled={!selectedStretch || selectionsLocked || isLoading || areaConfirmed}
          >
            <option value="">--Choose a Drain--</option>
            {drains.map(d => <option key={d.drainNo} value={d.drainNo}>Drain {d.drainNo}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <MultiSelect
          items={catchments.map(c => ({ id: c.objectId, name: c.name }))}
          selectedItems={selectedCatchments}
          onSelectionChange={handleCatchmentsChange}
          label="Catchments"
          placeholder="--Choose Catchments--"
          disabled={!selectedDrain || selectionsLocked || isLoading || areaConfirmed}
        />
        <MultiSelect
          items={villages.map(v => ({ id: v.code, name: v.name }))}
          selectedItems={selectedVillages}
          onSelectionChange={handleVillagesChange}
          label="Villages"
          placeholder="--Choose Villages--"
          disabled={selectedCatchments.length === 0 || selectionsLocked || isLoading || areaConfirmed}
        />
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">River:</span> {rivers.find(r => r.code === selectedRiver)?.name || "None"}</p>
          <p><span className="font-medium">Stretch:</span> {stretches.find(s => s.stretchId === selectedStretch)?.name || "None"}</p>
          <p><span className="font-medium">Drain:</span> {selectedDrain ? `Drain ${selectedDrain}` : "None"}</p>
          <p><span className="font-medium">Catchments:</span> {selectedCatchments.length > 0 ? selectedCatchments.length === catchments.length ? "All Catchments" : catchments.filter(c => selectedCatchments.includes(c.objectId)).map(c => c.name).join(", ") : "None"}</p>
          <p><span className="font-medium">Villages:</span> {selectedVillages.length > 0 ? selectedVillages.length === villages.length ? "All Villages" : villages.filter(v => selectedVillages.includes(v.code)).map(v => v.name).join(", ") : "None"}</p>
          {areaConfirmed && <p className="mt-2 text-green-600 font-medium">✓ Area selection confirmed</p>}
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        {(selectedVillages.length > 0 || selectedCatchments.length > 0) && !areaConfirmed && (
          <button
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50"
            onClick={handleConfirmArea} disabled={isLoading}
          >
            Confirm Area Selection
          </button>
        )}
        <button
          className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50"
          onClick={resetSelections} disabled={isLoading}
        >
          Reset Selection
        </button>
      </div>
    </div>
  );
};

export default AreaSelection;
