"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { useWell, WellData } from "@/contexts/groundwater_assessment/drain/WellContext";
import { useMap } from "@/contexts/groundwater_assessment/drain/MapContext";

interface WellSelectionProps {
  onWellsConfirmed?: (data: any) => void;
  onReset?: () => void;
}

const WellSelection: React.FC<WellSelectionProps> = ({ onWellsConfirmed, onReset }) => {
  const {
    selectedVillages,
    villages,
    areaConfirmed,
  } = useLocation();

  const {
    wellSelectionMode,
    wellsData,
    wellsLoading,
    wellsError,
    isWellTableSaved,
    isSavingWells,
    customColumns,
    newColumnName,
    isDragging,
    csvUploading,
    csvUploadSuccess,
    csvUploadMessage,
    selectedFile,
    handleWellsModeChange,
    handleCellChange,
    addNewRow,
    removeRow,
    addNewColumn,
    removeColumn,
    saveWellTable,
    exportToCSV,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCSVUpload,
    setNewColumnName,
    getDisplayColumns,
    confirmWellSelections,
    resetWellSelections,
    fetchWellsData,
  } = useWell();

  const {
    addWellPointsLayer,
    removeWellPointsLayer,
    enableWellAddMode,
    disableWellAddMode,
    isWellAddModeActive,
    forceRemoveWellPointsLayer
  } = useMap();

  const [isMapAddModeEnabled, setIsMapAddModeEnabled] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing wells data when mode is 'existing_and_new'
  useEffect(() => {
    if (wellSelectionMode === 'existing_and_new' && selectedVillages.length > 0 && areaConfirmed) {
      fetchWellsData(selectedVillages);
    }
  }, [wellSelectionMode, selectedVillages, areaConfirmed]);

  // Add effect to plot wells when data changes
  useEffect(() => {
    if (areaConfirmed && wellsData.length > 0) {
      plotWellsOnMap();
    } else {
      removeWellPointsLayer();
    }
  }, [wellsData, areaConfirmed]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      removeWellPointsLayer();
    };
  }, []);

  // Add function to extract and plot coordinates
  const plotWellsOnMap = () => {
    if (wellsData.length === 0) {
      removeWellPointsLayer();
      return;
    }

    const wellPoints = wellsData.map((well, index) => {
      const latitude = parseFloat(well.LATITUDE as string);
      const longitude = parseFloat(well.LONGITUDE as string);

      // Only include wells with valid coordinates
      if (!isNaN(latitude) && !isNaN(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180) {
        return {
          id: index,
          latitude,
          longitude,
          hydrographCode: String(well.HYDROGRAPH || `WELL_${index + 1}`),
          block: String(well.BLOCK || 'Unknown'),
          properties: well
        };
      }
      return null;
    }).filter(point => point !== null);

    console.log(`Plotting ${wellPoints.length} wells on map from ${wellsData.length} total wells`);

    if (wellPoints.length > 0) {
      addWellPointsLayer(wellPoints);
    } else {
      removeWellPointsLayer();
    }
  };

  const handleWellAddFromMap = (wellData: WellData, coordinates: [number, number]) => {
    console.log("handleWellAddFromMap called");
    console.log("Received popup data:", wellData);
    console.log("coordinates:", coordinates);

    if (isWellTableSaved) {
      console.log("Cannot add well: table is saved");
      alert("Cannot add wells: table is already saved");
      return;
    }

    // Use the wellData as received from popup (already contains all columns)
    const completeWellData: WellData = { ...wellData };

    // Ensure coordinates are properly set
    completeWellData['LATITUDE'] = wellData['LATITUDE'] || coordinates[1].toString();
    completeWellData['LONGITUDE'] = wellData['LONGITUDE'] || coordinates[0].toString();

    if (!completeWellData['BLOCK'] || completeWellData['BLOCK']?.toString().trim() === '') {
      completeWellData['BLOCK'] = 'Unknown';
    }


    console.log("Complete well data for table:", completeWellData);
    console.log("Adding well with", Object.keys(completeWellData).length, "total columns");

    // Add to table using WellContext method
    addNewRow(completeWellData);

    console.log(`Well added: ${wellData['HYDROGRAPH']} at ${coordinates[1]}, ${coordinates[0]}`);

    // Show success message
    const wellName = wellData['HYDROGRAPH'] || 'New Well';
    alert(`Well Added Successfully!\nName: ${wellName}\nLocation: ${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`);
  };

  // Function to toggle map add mode
  const toggleMapAddMode = () => {
    console.log("toggleMapAddMode called");
    console.log("Current state - areaConfirmed:", areaConfirmed, "isWellTableSaved:", isWellTableSaved);
    console.log("isMapAddModeEnabled:", isMapAddModeEnabled);

    if (!areaConfirmed || isWellTableSaved) {
      console.log("Cannot toggle map add mode: area not confirmed or table saved");
      return;
    }

    if (isMapAddModeEnabled) {
      // Disable mode
      console.log("Disabling map add mode");
      disableWellAddMode();
      setIsMapAddModeEnabled(false);
      console.log("Map add mode disabled");
    } else {
      // Enable mode - pass ALL display columns to popup instead of just 3
      console.log("Enabling map add mode");

      // Get all available columns from the current table structure
      const allColumns = getDisplayColumns();
      console.log("All display columns for popup:", allColumns);

      enableWellAddMode(allColumns, handleWellAddFromMap);
      setIsMapAddModeEnabled(true);
      console.log("Map add mode enabled with all columns in popup");
    }
  };

  // Effect to sync map add mode state
  useEffect(() => {
    setIsMapAddModeEnabled(isWellAddModeActive);
  }, [isWellAddModeActive]);

  // Effect to disable map add mode when table is saved or area not confirmed
  useEffect(() => {
    if (!areaConfirmed || isWellTableSaved) {
      if (isMapAddModeEnabled) {
        disableWellAddMode();
        setIsMapAddModeEnabled(false);
      }
    }
  }, [areaConfirmed, isWellTableSaved]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      disableWellAddMode();
      removeWellPointsLayer();
    };
  }, []);

  // UPDATED: Combined handleFinalConfirm function that saves and confirms
  const handleFinalConfirm = async (): Promise<void> => {
    if (!areaConfirmed || wellsData.length === 0) {
      console.log("Cannot confirm: Area not confirmed or no wells data");
      return;
    }

    setIsConfirming(true);
    console.log("Starting combined save and confirm process...");

    try {
      // Step 1: Save wells if not already saved
      if (!isWellTableSaved) {
        console.log("Saving wells table...");
        const saveSuccess = await saveWellTable();

        if (!saveSuccess) {
          console.log("Failed to save wells table");
          alert("Failed to save wells table. Please try again.");
          return;
        }

        console.log("Wells table saved successfully");
      }

      // Step 2: Confirm and post to backend
      console.log("Confirming final selections...");
      const selectedData = await confirmWellSelections(
        selectedVillages,
        villages,
        0,
      );

      if (onWellsConfirmed && selectedData) {
        onWellsConfirmed(selectedData);
        console.log("Wells confirmed and posted to backend successfully");
      } else {
        throw new Error("Failed to confirm well selections");
      }

    } catch (error: any) {
      console.log("Error during save and confirm process:", error);
      alert(`Error during confirmation: ${error.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = (): void => {
    console.log("Resetting well selections...");
    resetWellSelections();
    setIsConfirming(false);
    if (onReset) {
      onReset();
    }
  };

  // Handle radio button change with better logging
  const handleRadioChange = (mode: 'existing_and_new' | 'upload_csv') => {
    console.log("=== Radio button clicked ===");
    console.log("Selected mode:", mode);

    try {
      // Pass the force removal function to handle mode changes
      handleWellsModeChange(mode, forceRemoveWellPointsLayer);
      console.log("Mode change successful");
    } catch (error) {
      console.log("Error changing mode:", error);
    }
  };

  if (!areaConfirmed) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-center text-gray-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Well Selection</h2>
          <p>Please confirm area selection first to proceed with well selection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-4 bg-white rounded-lg shadow-md">
        {wellsError && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {wellsError}
          </div>
        )}
        {(wellsLoading || isConfirming) && (
          <div className="mb-4 p-2 bg-blue-100 text-blue-700 rounded">
            {isConfirming ? 'Saving and confirming wells...' : 'Loading wells data...'}
          </div>
        )}

        {/* WELL SELECTION SECTION */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Well Selection</h2>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-4">
              <div className="flex space-x-6">
                <div className="flex items-center">
                  <input
                    type="radio"
                    value="existing_and_new"
                    checked={wellSelectionMode === 'existing_and_new'}
                    onChange={() => handleWellsModeChange('existing_and_new')}
                    disabled={isWellTableSaved} // disable instead of blocking change
                  />
                  <label
                    htmlFor="existing-wells"
                    className="text-md font-medium text-gray-800 cursor-pointer ml-2"
                    onClick={() => {
                      console.log("Existing wells label clicked");
                      handleRadioChange('existing_and_new');
                    }}
                  >
                    Select Existing Wells
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="radio"
                    value="upload_csv"
                    checked={wellSelectionMode === 'upload_csv'}
                    onChange={() => handleWellsModeChange('upload_csv')}
                    disabled={isWellTableSaved} // disable instead of blocking change
                  />
                  <label
                    htmlFor="upload-csv"
                    className="text-md font-medium text-gray-800 cursor-pointer ml-2"
                    onClick={() => {
                      console.log("Upload CSV label clicked");
                      handleRadioChange('upload_csv');
                    }}
                  >
                    Upload CSV
                  </label>
                </div>
              </div>

              {/* Show current mode for debugging */}
              <div className="text-xs text-gray-500">
                Current mode: {wellSelectionMode || 'None'} | Table saved: {isWellTableSaved ? 'Yes' : 'No'}
              </div>

              {wellSelectionMode === 'upload_csv' && (
                <div className="space-y-4">
                  <div
                    className={`border-2 p-6 rounded-lg text-center transition-colors ${isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-gray-50'
                      }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isConfirming || csvUploading || isWellTableSaved}
                    />

                    <div className="space-y-3">
                      <div className="text-4xl text-gray-400">📄</div>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={`px-6 py-3 rounded-lg font-medium ${isConfirming || csvUploading || isWellTableSaved
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                          disabled={isConfirming || csvUploading || isWellTableSaved}
                        >
                          Choose CSV File
                        </button>

                        {selectedFile && !isWellTableSaved && (
                          <button
                            onClick={handleCSVUpload}
                            disabled={csvUploading || isConfirming}
                            className={`px-6 py-3 rounded-lg font-medium ${csvUploading || isConfirming
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                              }`}
                          >
                            {csvUploading ? 'Uploading...' : 'Upload CSV'}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        or drag and drop a CSV file here
                      </p>

                      {selectedFile && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-sm text-blue-800">
                            <strong>Selected File:</strong> {selectedFile.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {csvUploading && (
                    <div className="p-3 bg-blue-100 text-blue-700 rounded">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                        <span>Validating and uploading CSV...</span>
                      </div>
                    </div>
                  )}

                  {csvUploadMessage && (
                    <div className={`p-3 rounded ${csvUploadSuccess
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                      }`}>
                      <div className="flex items-center space-x-2">
                        <span>{csvUploadSuccess ? '✅' : '❌'}</span>
                        <span>{csvUploadMessage}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wellsLoading && (
                <div className="p-2 bg-blue-100 text-blue-700 rounded">
                  Loading wells data...
                </div>
              )}

              {wellsError && (
                <div className="p-2 bg-red-100 text-red-700 rounded">
                  {wellsError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WELLS TABLE SECTION - Fixed height container */}
      {wellsData.length > 0 && (
        <div className="flex-1 mt-4 p-4 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h4 className="text-lg font-medium text-gray-800">
              Wells Data ({wellSelectionMode === 'existing_and_new' ? 'Existing Wells' : 'Uploaded CSV'})
              {isWellTableSaved && <span className="ml-2 text-green-600 text-sm">[SAVED]</span>}
            </h4>
            <div className="flex space-x-2">
              <button
                onClick={exportToCSV}
                disabled={isConfirming}
                className={`px-3 py-1 rounded text-white ${isConfirming
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600'
                  }`}
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-4 flex-shrink-0">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong>
              {wellSelectionMode === 'existing_and_new'
                ? ' These are existing wells in the selected area. You can edit the data and add rows/columns if needed.'
                : ' This is your uploaded CSV data. You can edit the data and add rows/columns if needed.'
              }
              {isWellTableSaved && <span className="block mt-1 text-green-700 font-medium">Wells have been saved successfully.</span>}
            </p>
          </div>

          {!isWellTableSaved && (
            <div className="flex items-center space-x-4 flex-wrap gap-2 mb-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="New column name"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  className="p-1 border border-gray-300 rounded text-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addNewColumn();
                    }
                  }}
                  disabled={isConfirming}
                />
                <button
                  onClick={addNewColumn}
                  disabled={!newColumnName.trim() || isConfirming}
                  className={`px-3 py-1 rounded text-white text-sm ${!newColumnName.trim() || isConfirming
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                  Add Column
                </button>
              </div>
              <button
                onClick={() => addNewRow()}
                disabled={isWellTableSaved || isConfirming}
                className={`px-3 py-1 rounded text-sm ${isWellTableSaved || isConfirming
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
              >
                Add Row
              </button>
              {!isWellTableSaved && wellSelectionMode && (
                <button
                  onClick={toggleMapAddMode}
                  disabled={isConfirming || !areaConfirmed}
                  className={`px-3 py-1 rounded text-sm ${isMapAddModeEnabled
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : isConfirming || !areaConfirmed
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  title={isMapAddModeEnabled ? 'Click to disable map add mode' : 'Click to enable map add mode'}
                >
                  {isMapAddModeEnabled ? 'Exit Map Add Mode' : 'Add Wells from Map'}
                </button>
              )}
            </div>
          )}

          {/* Table container with fixed height and scrolling */}
          <div className="flex-1 overflow-auto border border-gray-300 rounded max-h-96">
            <div className="min-w-max">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700 sticky left-0 bg-gray-100 z-20 min-w-[40px]">
                      #
                    </th>
                    {getDisplayColumns().map((column) => (
                      <th key={column} className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700 min-w-[120px] whitespace-nowrap">
                        <div className="flex items-center justify-between">
                          <span>{column}</span>
                          {customColumns.includes(column) && !isWellTableSaved && !isConfirming && (
                            <button
                              onClick={() => removeColumn(column)}
                              className="ml-1 text-red-500 hover:text-red-700 flex-shrink-0"
                              title="Remove column"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    {!isWellTableSaved && (
                      <th className="border border-gray-300 px-2 py-1 text-left text-xs font-medium text-gray-700 sticky right-0 bg-gray-100 z-20 min-w-[80px]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {wellsData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-1 text-xs sticky left-0 bg-white z-10 min-w-[40px]">
                        {index + 1}
                      </td>
                      {getDisplayColumns().map((column) => (
                        <td key={column} className="border border-gray-300 px-1 py-1 min-w-[120px]">
                          <input
                            type="text"
                            value={row[column] || ''}
                            onChange={(e) => handleCellChange(index, column, e.target.value)}
                            className={`w-full p-1 text-xs border-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 ${isWellTableSaved || isConfirming ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                            disabled={isWellTableSaved || isConfirming}
                            readOnly={isWellTableSaved || isConfirming}
                          />
                        </td>
                      ))}
                      {!isWellTableSaved && (
                        <td className="border border-gray-300 px-2 py-1 sticky right-0 bg-white z-10 min-w-[80px]">
                          <button
                            onClick={() => removeRow(index)}
                            disabled={isConfirming || wellsData.length <= 1}
                            className={`text-xs whitespace-nowrap ${isConfirming || wellsData.length <= 1
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-500 hover:text-red-700'
                              }`}
                            title="Remove row"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* UPDATED FINAL ACTIONS - Single combined button */}
          <div className="flex justify-center space-x-4 mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
            <button
              className={`${areaConfirmed && wellsData.length > 0
                ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg transform hover:scale-105 transition duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 rounded-full py-3 px-6"
                : "bg-gray-400 cursor-not-allowed text-white rounded-full py-3 px-6"
                }`}
              onClick={handleFinalConfirm}
              disabled={!areaConfirmed || wellsData.length === 0 || wellsLoading || isConfirming}
            >
              {isConfirming
                ? (isWellTableSaved ? "Confirming & Posting..." : "Saving & Confirming...")
                : "Confirm Wells"}
            </button>

            <button
              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 
             text-white font-semibold py-3 px-6 rounded-full shadow-lg 
             transform hover:scale-105 transition duration-300 ease-in-out 
             focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50"
              onClick={handleReset}
              disabled={wellsLoading || isConfirming}
            >
              Reset Wells
            </button>

          </div>
        </div>
      )}
    </div>
  );
};

export default WellSelection;
