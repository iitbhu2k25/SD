'use client'
import React from 'react';
import { MultiSelect } from './Multiselect';
import { useLocation, SubDistrict } from '@/contexts/stp_suitability/admin/LocationContext';
import WholeLoading from "@/components/app_layout/newLoading";
interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
    totalPopulation: number;
  }) => void;
  onReset?: () => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ onConfirm, onReset }) => {
  // Use the location context instead of local state
  const { 
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    towns,
    selectedTowns,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setSelectedTowns,
    confirmSelections,
    resetSelections
  } = useLocation();
  
  // Handle state selection from select input
  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      handleStateChange(Number(e.target.value));
    }
  };
  
  // Handle multi-select changes
  const handleDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedDistricts(selectedIds);
    }
  };
  
  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(selectedIds);
    }
  };
  
  const handleTownsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedTowns(selectedIds);
    }
  };

  
  // Handle confirm button click (now requires towns to be selected)
  const handleConfirm = (): void => {
    // Changed: Now requires towns to be selected, not just sub-districts
    if (selectedTowns.length > 0 && !selectionsLocked) {
      const selectedData = confirmSelections();
      
      // Call the onConfirm prop to notify parent component
      if (onConfirm && selectedData) {
        onConfirm(selectedData);
      }
    }
  };
  
  // Handle reset button click
  const handleReset = (): void => {
    resetSelections();
    
    // Call the onReset prop to notify parent component
    if (onReset) {
      onReset();
    }
  };
  
  // Format sub-district display to include population
  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return `${subDistrict.name}`;
  };
  
  // Format town display to include population
  const formatTownDisplay = (town: any): string => {
    return `${town.name} (Pop: ${town.population?.toLocaleString() || 'N/A'})`;
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* State Dropdown */}
        <div>
          <label htmlFor="state-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
            State:
          </label>
          <select
            id="state-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedState || ''}
            onChange={handleStateSelect}
            disabled={selectionsLocked || isLoading}
          >
            <option value="">--Choose a State--</option>
            {states.map(state => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        {/* District Multiselect */}
        <MultiSelect
          items={districts}
          selectedItems={selectedDistricts}
          onSelectionChange={handleDistrictsChange}
          label="District"
          placeholder="--Choose Districts--"
          disabled={!selectedState || selectionsLocked || isLoading}
        />

        {/* Sub-District Multiselect */}
        <MultiSelect
          items={subDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose SubDistricts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatSubDistrictDisplay}
        />
        
        {/* Towns Multiselect */}
        <MultiSelect
          items={towns}
          selectedItems={selectedTowns}
          onSelectionChange={handleTownsChange}
          label="Towns"
          placeholder="--Choose Towns--"
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatTownDisplay}
        />
      </div>

      {/* Display selected values for demonstration */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">State:</span> {states.find(s => s.id === selectedState)?.name || 'None'}</p>
          <p><span className="font-medium">Districts:</span> {selectedDistricts.length > 0 
            ? (selectedDistricts.length === districts.length 
              ? 'All Districts' 
              : districts.filter(d => selectedDistricts.includes(Number(d.id))).map(d => d.name).join(', '))
            : 'None'}</p>
          <p><span className="font-medium">Sub-Districts:</span> {selectedSubDistricts.length > 0 
            ? (selectedSubDistricts.length === subDistricts.length 
              ? 'All Sub-Districts' 
              : subDistricts.filter(sd => selectedSubDistricts.includes(Number(sd.id))).map(sd => sd.name).join(', '))
            : 'None'}</p>
          <p><span className="font-medium">Towns:</span> {selectedTowns.length > 0 
            ? (selectedTowns.length === towns.length 
              ? 'All Towns' 
              : towns.filter(t => selectedTowns.includes(Number(t.id))).map(t => t.name).join(', '))
            : 'None'}</p>
          {selectedTowns.length > 0 && (
            <p><span className="font-medium">Total Population (from selected towns):</span> {towns.filter(t => selectedTowns.includes(Number(t.id))).reduce((sum, town) => sum + (town.population || 0), 0).toLocaleString()}</p>
          )}
          {selectionsLocked && (
            <p className="mt-2 text-green-600 font-medium">Selections confirmed and locked</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex space-x-4 mt-4">
        <button 
          className={`${
            selectedTowns.length > 0 && !selectionsLocked 
              ? 'bg-blue-500 hover:bg-blue-700' 
              : 'bg-gray-400 cursor-not-allowed'
          } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={handleConfirm}
          disabled={selectedTowns.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>
       
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <WholeLoading visible={true} title="Connecting to server" message="Working on preparing data" />
      )}
    </div>
  );
};

export default LocationSelector;