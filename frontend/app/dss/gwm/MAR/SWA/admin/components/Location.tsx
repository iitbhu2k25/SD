'use client';

import React, { useEffect } from 'react';
import { MultiSelect } from './AdministrativeMultiSelect';
import { useLocationContext, SubDistrict } from '@/contexts/surfacewater_assessment/admin/LocationContext';

interface LocationPageProps {
  onAreaConfirmed?: () => void;
}

const LocationPage: React.FC<LocationPageProps> = ({ onAreaConfirmed }) => {
  const {
    states,
    districts,
    subDistricts,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectionsLocked,
    isLoading,
    error,
    selectionConfirmed,
    totalPopulation,
    handleStateChange,
    setSelectedDistricts,
    setSelectedSubDistricts,
    confirmSelection,
    resetSelections,
    initialDataLoaded, // NEW: Get from context
  } = useLocationContext();

  // NEW: Log when data is auto-filled
  useEffect(() => {
    if (initialDataLoaded && selectedState) {
      console.log('=== AUTO-FILLED LOCATION DATA ===');
      console.log('Selected State:', selectedState);
      console.log('Selected State Name:', states.find(s => s.id === selectedState)?.name);
      console.log('Selected Districts:', selectedDistricts);
      console.log('Selected District Names:', 
        districts.filter(d => selectedDistricts.includes(Number(d.id))).map(d => d.name)
      );
      console.log('Selected SubDistricts:', selectedSubDistricts);
      console.log('Selected SubDistrict Names:', 
        subDistricts.filter(sd => selectedSubDistricts.includes(Number(sd.id))).map(sd => sd.name)
      );
      console.log('Total Population:', totalPopulation);
      console.log('=================================');
    }
  }, [initialDataLoaded, selectedState, selectedDistricts, selectedSubDistricts, states, districts, subDistricts, totalPopulation]);

  const handleStateSelect = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    if (!selectionsLocked) {
      const stateId = parseInt(e.target.value);
      handleStateChange(stateId);
    }
  };

  const handleDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) setSelectedDistricts(selectedIds);
  };

  const handleSubDistrictsChange = (selectedIds: number[]): void => {
    if (!selectionsLocked) setSelectedSubDistricts(selectedIds);
  };

  const handleConfirmArea = () => {
    confirmSelection();
    onAreaConfirmed?.();
  };

  const formatSubDistrictDisplay = (subDistrict: SubDistrict): string => {
    return `${subDistrict.name}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {/* NEW: Banner showing data was auto-filled */}
      {initialDataLoaded && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-800">
              Location data auto-filled from Groundwater Assessment module
            </p>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      {isLoading && <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">Loading data...</div>}

      {/* AREA SELECTION */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Location Selection</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="state-dropdown" className="block text-sm font-semibold text-gray-700 mb-2">
              State:
            </label>
            <select
              id="state-dropdown"
              className="w-full p-2 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedState || ''}
              onChange={handleStateSelect}
              disabled={selectionsLocked || isLoading || selectionConfirmed}
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
            onSelectionChange={handleDistrictsChange}
            label="District"
            placeholder="--Choose Districts--"
            displayPattern={(district) => district.name}
            disabled={!selectedState || selectionsLocked || isLoading || selectionConfirmed}
          />

          <MultiSelect
            items={subDistricts}
            selectedItems={selectedSubDistricts}
            onSelectionChange={handleSubDistrictsChange}
            label="Sub-District"
            placeholder="--Choose SubDistricts--"
            displayPattern={formatSubDistrictDisplay}
            disabled={selectedDistricts.length === 0 || selectionsLocked || isLoading || selectionConfirmed}
          />
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-2">Selected Locations</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">State:</span>{' '}
              {states.find((s) => s.id === selectedState)?.name || 'None'}
            </p>
            <p>
              <span className="font-medium">Districts:</span>{' '}
              {selectedDistricts.length > 0
                ? selectedDistricts.length === districts.length
                  ? 'All Districts'
                  : districts
                      .filter((d) => selectedDistricts.includes(Number(d.id)))
                      .map((d) => d.name)
                      .join(', ')
                : 'None'}
            </p>
            <p>
              <span className="font-medium">Sub-Districts:</span>{' '}
              {selectedSubDistricts.length > 0
                ? selectedSubDistricts.length === subDistricts.length
                  ? 'All Sub-Districts'
                  : subDistricts
                      .filter((sd) => selectedSubDistricts.includes(Number(sd.id)))
                      .map((sd) => sd.name)
                      .join(', ')
                : 'None'}
            </p>

            {totalPopulation > 0 && (
              <p>
                <span className="font-medium">Total Population:</span> {totalPopulation.toLocaleString()}
              </p>
            )}

            {selectionConfirmed && (
              <p className="mt-2 text-green-600 font-medium">✓ Area selection confirmed</p>
            )}
          </div>
        </div>

        {selectedSubDistricts.length > 0 && !selectionConfirmed && (
          <div className="mt-4">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              onClick={handleConfirmArea}
              disabled={isLoading}
            >
              Confirm Area Selection
            </button>
          </div>
        )}

        <div className="mt-4">
          <button
            className="bg-red-500 hover:bg-red-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            onClick={resetSelections}
            disabled={isLoading}
          >
            Reset Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPage;