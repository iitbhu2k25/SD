'use client'
import React from 'react';
import { MultiSelect } from './Multiselect';
import { useLocation, SubDistrict } from '@/contexts/groundwaterIdent/admin/LocationContext';
import WholeLoading from "@/components/app_layout/newLoading";

interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
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
    selectedDistricts, // This should be a single number, not array
    selectedSubDistricts, // This should be a single number, not array
    selectionsLocked,
    villages,
    selectedvillages, // This remains an array for multiple selection
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    setSelectedvillages,
    confirmSelections,
    resetSelections
  } = useLocation();
  
  // Handle state selection from select input
  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      handleStateChange(Number(e.target.value));
    }
  };
  
  // Handle district selection (single select)
  const handleDistrictsChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      setSelectedDistricts(Number(e.target.value));
    }
  };
  
  // Handle sub-district selection (single select)
  const handleSubDistrictsChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(Number(e.target.value));
    }
  };
  
  // Handle villages selection (multi-select)
  const handlevillagesChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedvillages(selectedIds);
    }
  };

  // Handle confirm button click (requires villages to be selected)
  const handleConfirm = (): void => {
    if (selectedvillages.length > 0 && !selectionsLocked) {
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
  
  // Format sub-district display

  // Format village display
  const formatVillageDisplay = (village: any): string => {
    return `${village.name}`;
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

        {/* District Dropdown */}
        <div>
          <label htmlFor="district-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
            District:
          </label>
          <select
            id="district-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedDistricts || ''}
            onChange={handleDistrictsChange}
            disabled={!selectedState || selectionsLocked || isLoading}
          >
            <option value="">--Choose a District--</option>
            {districts.map(district => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-District Dropdown */}
        <div>
          <label htmlFor="subdistrict-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
            Sub-District:
          </label>
          <select
            id="subdistrict-dropdown"
            className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedSubDistricts || ''}
            onChange={handleSubDistrictsChange}
            disabled={!selectedDistricts || selectionsLocked || isLoading}
          >
            <option value="">--Choose a Sub-District--</option>
            {subDistricts.map(subDistrict => (
              <option key={subDistrict.id} value={subDistrict.id}>
                {subDistrict.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Villages Multiselect */}
        <MultiSelect
          items={villages}
          selectedItems={selectedvillages}
          onSelectionChange={handlevillagesChange}
          label="Villages"
          placeholder="--Choose Villages--"
          disabled={!selectedSubDistricts || selectionsLocked || isLoading}
          displayPattern={formatVillageDisplay}
        />
      </div>

      {/* Display selected values for demonstration */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">State:</span> {states.find(s => s.id === selectedState)?.name || 'None'}</p>
          <p><span className="font-medium">District:</span> {districts.find(d => d.id === selectedDistricts)?.name || 'None'}</p>
          <p><span className="font-medium">Sub-District:</span> {subDistricts.find(sd => sd.id === selectedSubDistricts)?.name || 'None'}</p>
          <p><span className="font-medium">Villages:</span> {selectedvillages.length > 0 
            ? (selectedvillages.length === villages.length 
              ? 'All Villages' 
              : villages.filter(v => selectedvillages.includes(Number(v.id))).map(v => v.name).join(', '))
            : 'None'}</p>
          {selectionsLocked && (
            <p className="mt-2 text-green-600 font-medium">Selections confirmed and locked</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex space-x-4 mt-4">
        <button 
          className={`${
            selectedvillages.length > 0 && !selectionsLocked 
              ? 'bg-blue-500 hover:bg-blue-700' 
              : 'bg-gray-400 cursor-not-allowed'
          } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={handleConfirm}
          disabled={selectedvillages.length === 0 || selectionsLocked || isLoading}
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