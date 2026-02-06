'use client'
import React, { useMemo } from 'react';
import { MultiSelect } from './Multiselect';
import { useLocation } from '@/contexts/stp_priority/admin/LocationContext';
import { useMap } from '@/contexts/stp_priority/admin/MapContext';
import { SubDistrict } from '@/interface/raster_context';
import WholeLoading from "@/components/app_layout/newLoading";

interface LocationSelectorProps {
  onConfirm?: (selectedData: {
    subDistricts: SubDistrict[];
    totalPopulation: number;
  }) => void;
  onReset?: () => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ onConfirm }) => {
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelections,
    resetSelections
  } = useLocation();
  const { resetMapView } = useMap();

  // Filter subdistricts based on selected districts
  const filteredSubDistricts = useMemo(() => {
    if (selectedDistricts.length === 0) {
      return [];
    }
    return subDistricts.filter(subDistrict => 
      selectedDistricts.includes(Number(subDistrict.districtId))
    );
  }, [subDistricts, selectedDistricts]);

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      handleStateChange(parseInt(e.target.value));
    }
  };

  const handleDistrictsChange = (selectedIds: number[]): void => {
  if (!selectionsLocked) {
    setSelectedDistricts(selectedIds);
    
    // Only clean up subdistricts that belong to deselected districts
    // Keep subdistricts whose parent district is still selected
    const validSubdistricts = selectedSubDistricts.filter(subId => {
      const subdistrict = subDistricts.find(sub => Number(sub.id) === Number(subId));
      // Keep the subdistrict if its parent district is in the new selection
      return subdistrict && selectedIds.includes(Number(subdistrict.districtId));
    });
    
    // Only update if there's actually a change
    if (validSubdistricts.length !== selectedSubDistricts.length) {
      setSelectedSubDistricts(validSubdistricts);
    }
  }
};
  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) {
      setSelectedSubDistricts(selectedIds);
    }
  };

  const handleConfirm = (): void => {
    if (selectedSubDistricts.length > 0 && !selectionsLocked) {
      const selectedData = confirmSelections();

      if (onConfirm && selectedData) {
        onConfirm(selectedData);
      }
    }
  };

  const handleReset = (): void => {
    resetSelections();
    resetMapView();
  }

  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return `${subDistrict.name}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

        {/* Sub-District Multiselect - NOW USING FILTERED LIST */}
        <MultiSelect
          items={filteredSubDistricts}
          selectedItems={selectedSubDistricts}
          onSelectionChange={handleSubDistrictsChange}
          label="Sub-District"
          placeholder="--Choose SubDistricts--"
          disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading}
          displayPattern={formatSubDistrictDisplay}
        />
      </div>

      {/* Display selected values */}
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
            ? (selectedSubDistricts.length === filteredSubDistricts.length && filteredSubDistricts.length > 0
              ? 'All Sub-Districts'
              : filteredSubDistricts.filter(sd => selectedSubDistricts.includes(Number(sd.id))).map(sd => sd.name).join(', '))
            : 'None'}</p>
          {selectionsLocked && (
            <p className="mt-2 text-green-600 font-medium">Selections confirmed and locked</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex space-x-4 mt-4">
        <button
          className={`${selectedSubDistricts.length > 0 && !selectionsLocked
              ? 'bg-blue-500 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
            } text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
          onClick={handleConfirm}
          disabled={selectedSubDistricts.length === 0 || selectionsLocked || isLoading}
        >
          Confirm
        </button>

        <button
          className={`bg-red-500 hover:bg-red-700 text-white py-2 px-4 rounded
    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50
    disabled:bg-red-300 disabled:cursor-not-allowed disabled:hover:bg-red-300`}
          onClick={handleReset}
          disabled={selectedState === null}
        >
          Reset
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