"use client";

import React, { useState, useCallback } from "react";
import { useStretch } from "@/contexts/riverwater_assessment/drain/LocationContext";
import { useStretchMap } from "@/contexts/riverwater_assessment/drain/MapContext";
import MultiSelect from "../../admin/components/multiselect";
import { Lock, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { SeasonCard, seasonConfig } from "../../admin/components/location";

const StretchLocation: React.FC = () => {
  const {
    stretches,
    selectedStretches,
    selectedSeason,
    selectionsLocked,
    isLoading,
    error,
    isLoadingMapLayers,
    mapLayersError,
    waterQualityData,
    isLoadingWaterQuality,
    waterQualityError,
    areaConfirmed,
    setSelectedStretches,
    setSelectedSeason,
    confirmSelections,
    resetSelections,
  } = useStretch();

  // Season options - same as admin
  const seasonOptions = [
    {
      value: "premonsoon",
      label: "Pre-Monsoon",
      description: "March to May - Summer season data",
    },
    {
      value: "monsoon",
      label: "Monsoon",
      description: "June to September - Rainy season data",
    },
    {
      value: "postmonsoon",
      label: "Post-Monsoon",
      description: "October to February - Winter season data",
    },
  ];
  const { removeInterpolationLayer, resetView } = useStretchMap();

  const handleStretchesChange = useCallback(
    (stretchIds: string[]) => {
      if (!selectionsLocked) {
        setSelectedStretches(stretchIds);
      }
    },
    [selectionsLocked, setSelectedStretches]
  );

  const handleSeasonChange = useCallback(
    (season: "premonsoon" | "monsoon" | "postmonsoon") => {
      setSelectedSeason(season);
    },
    [setSelectedSeason]
  );

  const handleConfirm = useCallback(() => {
    confirmSelections();
  }, [confirmSelections]);

  const handleReset = useCallback(() => {
    resetSelections();
    removeInterpolationLayer();
    resetView();
  }, [resetSelections, removeInterpolationLayer, resetView]);

  // Convert stretches to options for MultiSelect
  const stretchOptions = stretches.map((stretch) => ({
    value: stretch.Stretch_ID.toString(), // Use Stretch_ID as value
    label: `${stretch.stretch_name}`,
  }));

  const selectedSeasonDetails = seasonOptions.find(
    (s) => s.value === selectedSeason
  );

  return (
    <div className="p-4 bg-white rounded-lg shadow-md space-y-6">
      {/* Loading indicators */}
      {(isLoading || isLoadingMapLayers) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <div className="text-sm text-blue-800">
              {isLoading && "Loading stretches..."}
              {isLoadingMapLayers && "Loading map layers..."}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {(error || mapLayersError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div className="text-sm text-red-800">
              {error && <div>Stretches Error: {error}</div>}
              {mapLayersError && <div>Map Layers Error: {mapLayersError}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Select Season */}
      <div>
        <h3 className="block text-sm font-semibold text-gray-700 mb-3">
          Select Season:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(seasonConfig).map(([season, config]) => (
            <SeasonCard
              key={season}
              season={season as "premonsoon" | "monsoon" | "postmonsoon"}
              isSelected={selectedSeason === season}
              onClick={() =>
                handleSeasonChange(
                  season as "premonsoon" | "monsoon" | "postmonsoon"
                )
              }
              icon={config.icon}
              color={config.color}
              description={config.description}
            />
          ))}
        </div>
      </div>

      {/* River Stretch Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-700">
          Select River Stretches:
        </label>

        <MultiSelect
          options={stretchOptions}
          selectedValues={selectedStretches}
          onChange={handleStretchesChange}
          disabled={selectionsLocked || isLoading}
          label="River Stretch"
          placeholder={
            isLoading
              ? "Loading Stretches..."
              : stretches.length === 0
              ? "No stretches available"
              : "Choose River Stretches"
          }
        />

        {stretches.length === 0 && !isLoading && (
          <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            No stretches available. Please check your connection.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={
            selectedStretches.length === 0 || isLoading || selectionsLocked
          }
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-700 hover:to-blue-800 cursor-pointer disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Confirm ({selectedStretches.length})
        </button>
        <button
          onClick={handleReset}
          disabled={selectedStretches.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-medium rounded-md hover:from-red-700 hover:to-red-800 cursor-pointer disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Reset
        </button>
      </div>

      {/* Water Quality Data Status */}
      {isLoadingWaterQuality && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <div className="text-sm text-blue-800">
              Loading water quality data...
            </div>
          </div>
        </div>
      )}

      {waterQualityError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div className="text-sm text-red-800">
              Water Quality Error: {waterQualityError}
            </div>
          </div>
        </div>
      )}

      {waterQualityData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-800">
            <div className="font-medium">Water Quality Data Loaded</div>
            <div className="text-xs">
              {waterQualityData.features.length} sampling points available
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">
          Selection Summary:
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Season:</span>
            <span className="font-medium text-gray-800">
              {selectedSeasonDetails?.label || "None selected"}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-gray-600">River Stretches:</span>
            <span
              className={`font-medium text-right ${
                selectedStretches.length > 0
                  ? "text-green-700"
                  : "text-gray-500"
              }`}
            >
              {selectedStretches.length > 0
                ? selectedStretches.length === stretches.length
                  ? `All Stretches (${stretches.length})`
                  : `${selectedStretches.length} selected`
                : "None selected"}
            </span>
          </div>

          {/* Show selected stretch names if any are selected */}
          {selectedStretches.length > 0 && selectedStretches.length <= 5 && (
            <div className="mt-2">
              <div className="text-xs text-gray-600 mb-1">
                Selected stretches:
              </div>
              <div className="flex flex-wrap gap-1">
                {stretches
                  .filter((stretch) =>
                    selectedStretches.includes(stretch.Stretch_ID.toString())
                  )
                  .map((stretch) => (
                    <span
                      key={stretch.Stretch_ID}
                      className="px-2 py-1 bg-white text-gray-700 text-xs rounded-lg border border-gray-200"
                    >
                      {stretch.stretch_name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StretchLocation;
