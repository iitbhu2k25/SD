"use client";

import React, { useCallback } from "react";
import { useStretch } from "@/contexts/riverwater_assessment/drain/LocationContext";
import { useStretchMap } from "@/contexts/riverwater_assessment/drain/MapContext";
import MultiSelect from "../../admin/components/multiselect";
import { AlertCircle, Loader2 } from "lucide-react";

const StretchLocation: React.FC = () => {
  const {
    stretches,
    selectedStretches,
    selectedYear,
    selectedSeason,
    selectionsLocked,
    isLoading,
    error,
    isLoadingMapLayers,
    mapLayersError,
    isLoadingWaterQuality,
    waterQualityError,
    setSelectedStretches,
    setSelectedSeason,
    setSelectedYear,
    confirmSelections,
    resetSelections,
  } = useStretch();
  const { removeInterpolationLayer, resetView } = useStretchMap();

  const handleStretchesChange = useCallback(
    (stretchIds: string[]) => {
      if (!selectionsLocked) {
        setSelectedStretches(stretchIds);
      }
    },
    [selectionsLocked, setSelectedStretches],
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

      {/* River Stretch + Season Selection — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] items-end gap-4">
        {/* River Stretch */}
        <div>
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
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No stretches available.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="year-dropdown"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Year:
          </label>
          <select
            id="year-dropdown"
            className="w-full cursor-pointer rounded-md border border-blue-300 px-2 py-2 text-sm shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value as "" | "2025")}
            disabled={isLoading}
          >
            <option value="">Select Year</option>
            <option value="2025">2025</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="season-dropdown"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Season:
          </label>
          <select
            id="season-dropdown"
            className="w-full cursor-pointer rounded-md border border-blue-300 px-2 py-2 text-sm shadow-sm hover:border-blue-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 bg-white"
            value={selectedSeason}
            onChange={(e) =>
              setSelectedSeason(
                e.target.value as "premonsoon" | "monsoon" | "postmonsoon" | "",
              )
            }
            disabled={isLoading}
          >
            <option value="">--Choose a Season--</option>
            <option value="premonsoon">Pre Monsoon</option>
            <option value="monsoon">Monsoon</option>
            <option value="postmonsoon">Post Monsoon</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={
              selectedStretches.length === 0 || isLoading || selectionsLocked
            }
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-700 hover:to-blue-800 cursor-pointer disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Confirm
          </button>
          <button
            onClick={handleReset}
            disabled={selectedStretches.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-medium rounded-md hover:from-red-700 hover:to-red-800 cursor-pointer disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Reset
          </button>
        </div>
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

      {/* Selection Summary */}
    </div>
  );
};

export default StretchLocation;
