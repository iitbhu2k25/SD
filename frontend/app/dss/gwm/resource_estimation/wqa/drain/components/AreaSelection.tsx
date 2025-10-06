"use client";

import React, { useState } from "react";
import { MultiSelect } from "./Multiselect";
import { useLocation } from "@/contexts/water_quality_assesment/drain/LocationContext";

interface AreaSelectionProps {
  onAreaConfirmed?: () => void;
}

const AreaSelection: React.FC<AreaSelectionProps> = ({ onAreaConfirmed }) => {
  const {
    rivers,
    stretches,
    drains,
    catchments,
    villages,
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    selectionsLocked,
    isLoading,
    error,
    areaConfirmed,
    handleRiverChange,
    handleStretchChange,
    handleDrainChange,
    setSelectedCatchments,
    setSelectedVillages,
    handleAreaConfirm,
    resetSelections,
  } = useLocation();

  // State for village manager
  const [showVillageManager, setShowVillageManager] = useState(false);
  const [villageSearchTerm, setVillageSearchTerm] = useState("");

  const handleRiverSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const riverCode = parseInt(e.target.value);
      console.log("Selected river code:", riverCode);
      handleRiverChange(riverCode);
    }
  };

  const handleStretchSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const stretchId = parseInt(e.target.value);
      console.log("Selected stretch ID:", stretchId);
      handleStretchChange(stretchId);
    }
  };

  const handleDrainSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const drainNo = parseInt(e.target.value);
      console.log("Selected drain number:", drainNo);
      handleDrainChange(drainNo);
    }
  };

  const handleCatchmentsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      console.log("Selected catchments:", selectedIds);
      setSelectedCatchments(selectedIds);
    }
  };

  const handleVillagesChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      console.log("Selected villages:", selectedIds);
      setSelectedVillages(selectedIds);
    }
  };

  const handleConfirmArea = () => {
    handleAreaConfirm();
    if (onAreaConfirmed) {
      onAreaConfirmed();
    }
  };

  // Helper function to get selection status text
  const getSelectionStatus = () => {
    if (selectedRiver && selectedStretch && selectedDrain && selectedCatchments.length > 0 && selectedVillages.length > 0) {
      return "✓ Complete selection ready for confirmation";
    } else if (selectedRiver && selectedStretch && selectedDrain && selectedCatchments.length > 0) {
      return "→ Select villages to complete area selection";
    } else if (selectedRiver && selectedStretch && selectedDrain) {
      return "→ Select catchments to proceed";
    } else if (selectedRiver && selectedStretch) {
      return "→ Select a drain to view catchments";
    } else if (selectedRiver) {
      return "→ Select a stretch to proceed";
    } else {
      return "→ Start by selecting a river";
    }
  };

  const getStatusColor = () => {
    if (selectedRiver && selectedStretch && selectedDrain && selectedCatchments.length > 0 && selectedVillages.length > 0) {
      return "text-green-600";
    } else if (selectedRiver) {
      return "text-blue-600";
    } else {
      return "text-gray-500";
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {/* Status Message */}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {isLoading && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Loading data...
          </div>
        </div>
      )}

      {/* AREA SELECTION SECTION */}
      <div className="mb-6">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* River Selection */}
          <div>
            <label htmlFor="river-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              River:
            </label>
            <select
              id="river-dropdown"
              className={`w-full p-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                selectedRiver 
                  ? 'border-blue-500 bg-blue-50 focus:ring-blue-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              value={selectedRiver || ""}
              onChange={handleRiverSelect}
              disabled={selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a River--</option>
              {rivers.map((river) => (
                <option key={river.code} value={river.code}>
                  {river.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stretch Selection */}
          <div>
            <label htmlFor="stretch-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              Stretch:
            </label>
            <select
              id="stretch-dropdown"
              className={`w-full p-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                selectedStretch 
                  ? 'border-purple-500 bg-purple-50 focus:ring-purple-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              value={selectedStretch || ""}
              onChange={handleStretchSelect}
              disabled={!selectedRiver || selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a Stretch--</option>
              {stretches.map((stretch) => (
                <option key={stretch.stretchId} value={stretch.stretchId}>
                  {stretch.name}
                </option>
              ))}
            </select>
            {selectedRiver && stretches.length === 0 && !isLoading && (
              <p className="text-xs text-gray-500 mt-1">No stretches found for selected river</p>
            )}
          </div>

          {/* Drain Selection */}
          <div>
            <label htmlFor="drain-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              Drain:
            </label>
            <select
              id="drain-dropdown"
              className={`w-full p-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                selectedDrain 
                  ? 'border-orange-500 bg-orange-50 focus:ring-orange-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              value={selectedDrain || ""}
              onChange={handleDrainSelect}
              disabled={!selectedStretch || selectionsLocked || isLoading || areaConfirmed}
            >
              <option value="">--Choose a Drain--</option>
              {drains.map((drain) => (
                <option key={drain.drainNo} value={drain.drainNo}>
                  Drain {drain.drainNo}
                </option>
              ))}
            </select>
            {selectedStretch && drains.length === 0 && !isLoading && (
              <p className="text-xs text-gray-500 mt-1">No drains found for selected stretch</p>
            )}
          </div>
        </div>

        {/* Villages Selection - Compact Display */}
        {selectedDrain && villages.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Villages:
            </label>
            
            {/* Compact Display */}
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-2-4h6m-8-4h6m-8-4h6m-6-4h4m2 12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                </svg>
                <span className="text-sm font-medium text-green-800">
                  {selectedVillages.length} of {villages.length} villages selected
                </span>
              </div>
              
              {!areaConfirmed && (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setSelectedVillages(villages.map(v => Number(v.code)))}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    disabled={selectionsLocked || isLoading}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedVillages([])}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    disabled={selectionsLocked || isLoading}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowVillageManager(!showVillageManager)}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Manage
                  </button>
                </div>
              )}
            </div>

            {/* Expandable Village Manager */}
            {showVillageManager && !areaConfirmed && (
              <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-800">Village Selection</h4>
                  <button
                    onClick={() => setShowVillageManager(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Search Box */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search villages..."
                    value={villageSearchTerm}
                    onChange={(e) => setVillageSearchTerm(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Village Grid */}
                <div className="max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {villages
                      .filter(village => 
                        village.name.toLowerCase().includes(villageSearchTerm.toLowerCase())
                      )
                      .map((village) => (
                        <label
                          key={village.code}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVillages.includes(Number(village.code))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVillages(prev => [...prev, Number(village.code)]);
                              } else {
                                setSelectedVillages(prev => prev.filter(code => code !== Number(village.code)));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 truncate">{village.name}</span>
                        </label>
                      ))
                    }
                  </div>
                </div>
                
                <div className="mt-3 text-xs text-gray-500 text-center">
                  Showing {villages.filter(village => 
                    village.name.toLowerCase().includes(villageSearchTerm.toLowerCase())
                  ).length} of {villages.length} villages
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selection Summary - Updated to be more compact */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Selection Summary
          </h3>
          
          {/* Compact Grid Layout */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="flex flex-col items-center p-2 bg-blue-50 rounded border border-blue-200">
              <span className="text-xs font-medium text-blue-600 mb-1">River</span>
              <span className={`text-center text-xs ${selectedRiver ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {rivers.find((r) => r.code === selectedRiver)?.name || "None"}
              </span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-purple-50 rounded border border-purple-200">
              <span className="text-xs font-medium text-purple-600 mb-1">Stretch</span>
              <span className={`text-center text-xs ${selectedStretch ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {selectedStretch ? `Stretch ${selectedStretch}` : "None"}
              </span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-orange-50 rounded border border-orange-200">
              <span className="text-xs font-medium text-orange-600 mb-1">Drain</span>
              <span className={`text-center text-xs ${selectedDrain ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {selectedDrain ? `Drain ${selectedDrain}` : "None"}
              </span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-red-50 rounded border border-red-200">
              <span className="text-xs font-medium text-red-600 mb-1">Catchments</span>
              <span className={`text-center text-xs ${selectedCatchments.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {selectedCatchments.length > 0 ? `${selectedCatchments.length}` : "None"}
              </span>
            </div>
            
            <div className="flex flex-col items-center p-2 bg-green-50 rounded border border-green-200">
              <span className="text-xs font-medium text-green-600 mb-1">Villages</span>
              <span className={`text-center text-xs ${selectedVillages.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                {selectedVillages.length > 0 ? `${selectedVillages.length}` : "None"}
              </span>
            </div>
          </div>

          {areaConfirmed && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
              <p className="text-green-700 font-medium flex items-center gap-2 justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Area selection confirmed and locked
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-4">
          {/* Confirm Area Button */}
          {(selectedVillages.length > 0 || selectedCatchments.length > 0) && !areaConfirmed && (
            <button
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2 px-4 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              onClick={handleConfirmArea}
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Area Selection
            </button>
          )}

          {/* Reset Button */}
          <button
            className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2 px-4 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            onClick={resetSelections}
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default AreaSelection;