// frontend/app/dss/basic/indcatch/components/location.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'

interface Village {
  vlcode: string
  village: string
  population?: number
  subdis_cod?: string
  geometry?: any
}

interface WatershedProperties {
  area?: number | string
  [key: string]: any
}

interface WatershedInfo {
  features: number
  geometryType?: string
  properties?: WatershedProperties
}

interface IndCatchmentSelectorProps {
  watershedData: WatershedInfo | null
  selectedPoint: { lat: number; lng: number } | null
  villages: Village[]
  selectedVillages: string[]
  apiTotalPopulation: number
  onVillageToggle: (vlcode: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onConfirm: () => void
  onReset: () => void
  isMapLoading: boolean
}

const IndCatchmentSelector: React.FC<IndCatchmentSelectorProps> = ({
  watershedData,
  selectedPoint,
  villages,
  selectedVillages,
  apiTotalPopulation,
  onVillageToggle,
  onSelectAll,
  onDeselectAll,
  onConfirm,
  onReset,
  isMapLoading
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredVillages = villages.filter(v =>
    v.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vlcode.includes(searchTerm)
  )

  const getCurrentPopulation = () => {
    if (selectedVillages.length === villages.length && apiTotalPopulation > 0) {
      return apiTotalPopulation
    }
    return villages
      .filter(v => selectedVillages.includes(v.vlcode))
      .reduce((sum, v) => sum + (v.population || 0), 0)
  }

  if (!watershedData && !selectedPoint) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Select a Watershed</h3>
          <p className="text-gray-600 text-sm mb-4">
            Click anywhere on the India map to delineate the watershed catchment for that location.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Quick Guide:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Click on the map to select a point</li>
                  <li>Watershed boundary will be fetched automatically</li>
                  <li>Villages within the watershed will be loaded</li>
                  <li>Select villages and click "Confirm Selection"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Watershed Info Card */}
      {watershedData && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="bg-purple-600 rounded-lg p-2">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-purple-900">Watershed Location</h3>
                <p className="text-sm text-purple-700">
                  {selectedPoint?.lat.toFixed(6)}°, {selectedPoint?.lng.toFixed(6)}°
                </p>
              </div>
            </div>
            <button
              onClick={onReset}
              className="text-purple-600 hover:text-red-600 transition-colors"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          
        </div>
      )}

      {/* Village Selection */}
      {villages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">Village Selection</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={onSelectAll}
                disabled={selectedVillages.length === villages.length}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-md transition-colors"
              >
                Select All
              </button>
              <button
                onClick={onDeselectAll}
                disabled={selectedVillages.length === 0}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-md transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-blue-600 text-xs font-medium mb-1">Total Villages</div>
              <div className="font-bold text-blue-900 text-xl">{villages.length}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-green-600 text-xs font-medium mb-1">Selected</div>
              <div className="font-bold text-green-900 text-xl">{selectedVillages.length}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-purple-600 text-xs font-medium mb-1">Population</div>
              <div className="font-bold text-purple-900 text-xl">
                {getCurrentPopulation().toLocaleString()}
              </div>
              {selectedVillages.length === villages.length && apiTotalPopulation > 0 && (
                <div className="text-[10px] text-green-600 mt-1">✓ from API</div>
              )}
            </div>
          </div>

          {/* Multiselect Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-purple-400 transition-colors"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-700">
                  {selectedVillages.length === villages.length
                    ? 'All villages selected'
                    : selectedVillages.length === 0
                    ? 'No villages selected'
                    : `${selectedVillages.length} of ${villages.length} villages selected`}
                </div>
                {selectedVillages.length > 0 && selectedVillages.length < villages.length && (
                  <div className="text-xs text-gray-500 mt-1">
                    Click to view and modify selection
                  </div>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 flex flex-col">
                {/* Search */}
                <div className="p-3 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="Search villages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Village List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredVillages.map((village) => (
                    <label
                      key={village.vlcode}
                      className="flex items-center px-4 py-3 hover:bg-purple-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVillages.includes(village.vlcode)}
                        onChange={() => onVillageToggle(village.vlcode)}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900 text-sm">{village.village}</div>
                        <div className="text-xs text-gray-500 space-x-2">
                          {village.population && village.population > 0 && (
                            <span>Population: {village.population.toLocaleString()}</span>
                          )}
                          {village.subdis_cod && (
                            <span className="text-purple-600">• SubDist: {village.subdis_cod}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {filteredVillages.length === 0 && (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No villages found matching "{searchTerm}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Button */}
      {watershedData && villages.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onConfirm}
            disabled={selectedVillages.length === 0}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all transform ${
              selectedVillages.length > 0
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:scale-[1.02] shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {selectedVillages.length > 0
              ? `Confirm Selection (${selectedVillages.length} villages)`
              : 'Select at least one village'}
          </button>
        </div>
      )}
    </div>
  )
}

export default IndCatchmentSelector