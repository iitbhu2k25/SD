"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "@/contexts/water_quality_assesment/drain/LocationContext";
import { useWell, WellData } from "@/contexts/water_quality_assesment/drain/WellContext";
import { useMap } from "@/contexts/water_quality_assesment/drain/MapContext";

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
    selectedYear,
    availableYears,
    yearSelected,
    setSelectedYear,
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
    existingWellsModified,
    handleWellsModeChange,
    handleCellChange,
    addNewRow,
    removeRow,
    addNewColumn,
    removeColumn,
    saveWellTable,
    exportToCSV,
    setNewColumnName,
    getDisplayColumns,
    confirmWellSelections,
    resetWellSelections,
    fetchWellsData,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCSVUpload,
    setWellsData,
    setSelectedFile,
    setCsvUploadSuccess,
    setCsvUploadMessage,
  } = useWell();

  const {
    addWellPointsLayer,
    removeWellPointsLayer,
    enableWellAddMode,
    disableWellAddMode,
    isWellAddModeActive,
    forceRemoveWellPointsLayer,
    getSelectedAreaBounds,
  } = useMap();

  const [isMapAddModeEnabled, setIsMapAddModeEnabled] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form popup states
  const [isAddRowPopupOpen, setIsAddRowPopupOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState<WellData>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedRegionBounds, setSelectedRegionBounds] = useState<[number, number, number, number] | null>(null);

  // Fetch existing wells data when mode is 'existing_and_new' and year is selected
  useEffect(() => {
    if (wellSelectionMode === 'existing_and_new' && selectedVillages.length > 0 && areaConfirmed && selectedYear) {
      console.log(`[DRAIN] Fetching wells data for year ${selectedYear}`);
      fetchWellsData(selectedVillages, selectedYear);
    }
  }, [wellSelectionMode, selectedVillages, areaConfirmed, selectedYear]);

  // Auto-select existing wells when year is selected
  useEffect(() => {
    if (yearSelected && selectedYear && !wellSelectionMode && !isWellTableSaved) {
      console.log("[DRAIN] Auto-selecting existing wells mode after year selection");
      handleRadioChange('existing_and_new');
    }
  }, [yearSelected, selectedYear, wellSelectionMode, isWellTableSaved]);

  // Add effect to plot wells when data changes
  useEffect(() => {
    if (areaConfirmed && wellsData.length > 0) {
      plotWellsOnMap();
    } else {
      removeWellPointsLayer();
    }
  }, [wellsData, areaConfirmed]);

  // Get region bounds when area is confirmed
  useEffect(() => {
    if (areaConfirmed && selectedVillages.length > 0) {
      const timer = setTimeout(() => {
        const bounds = getSelectedAreaBounds();
        if (bounds) {
          setSelectedRegionBounds(bounds);
          console.log('[DRAIN BOUNDS] Region bounds set:', bounds);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    } else {
      setSelectedRegionBounds(null);
    }
  }, [areaConfirmed, selectedVillages, getSelectedAreaBounds]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      removeWellPointsLayer();
    };
  }, []);

  // Function to extract and plot coordinates
  const plotWellsOnMap = () => {
    if (wellsData.length === 0) {
      removeWellPointsLayer();
      return;
    }

    const wellPoints = wellsData.map((well, index) => {
      const latitude = parseFloat(well.Latitude as string) || parseFloat(well.Latitude as string);
      const longitude = parseFloat(well.Longitude as string) || parseFloat(well.Longitude as string);

      if (!isNaN(latitude) && !isNaN(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180) {
        return {
          id: index,
          latitude,
          longitude,
          hydrographCode: String(well.HYDROGRAPH || well.LOCATION || well.Location || `WELL_${index + 1}`),
          block: String(well.BLOCK || well.VILLAGE_CODE || well.village_code || 'Unknown'),
          properties: well
        };
      }
      return null;
    }).filter(point => point !== null);

    console.log(`[DRAIN] Plotting ${wellPoints.length} wells on map from ${wellsData.length} total wells`);

    if (wellPoints.length > 0) {
      addWellPointsLayer(wellPoints);
    } else {
      console.warn(`[DRAIN] No valid coordinates found`);
      removeWellPointsLayer();
    }
  };

  const handleWellAddFromMap = (wellData: WellData, coordinates: [number, number]) => {
    console.log("[DRAIN] handleWellAddFromMap called");

    if (isWellTableSaved) {
      console.log("[DRAIN] Cannot add well: table is saved");
      alert("Cannot add wells: table is already saved");
      return;
    }

    const allTableColumns = getDisplayColumns();
    const completeWellData: WellData = {};

    allTableColumns.forEach(column => {
      completeWellData[column] = '';
    });

    Object.keys(wellData).forEach(key => {
      completeWellData[key] = wellData[key];
    });

    completeWellData['Latitude'] = coordinates[1].toFixed(6);
    completeWellData['Longitude'] = coordinates[0].toFixed(6);

    if (selectedYear) {
      completeWellData['YEAR'] = selectedYear;
    }

    console.log("[DRAIN] Complete well data for table:", completeWellData);

    addNewRow(completeWellData);

    // alert(`Well added successfully!\nCoordinates: ${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}\nYear: ${selectedYear}`);
  };

  const toggleMapAddMode = () => {
    console.log("[DRAIN] toggleMapAddMode called");

    if (!areaConfirmed || isWellTableSaved || !selectedYear) {
      console.log("[DRAIN] Cannot toggle map add mode");
      return;
    }

    if (isMapAddModeEnabled) {
      console.log("[DRAIN] Disabling map add mode");
      disableWellAddMode();
      setIsMapAddModeEnabled(false);
    } else {
      console.log("[DRAIN] Enabling map add mode");

      const allColumns = getDisplayColumns();
      const popupColumns = allColumns.filter(col => 
      col !== 'Latitude' &&        // Remove with capital L
      col !== 'Longitude' &&       // Remove with capital L
      col !== 'LATITUDE' &&        // Remove uppercase version
      col !== 'LONGITUDE' &&       // Remove uppercase version
      col !== 'YEAR' &&            // Remove YEAR
      col !== 'Year'               // Remove Year
    );

      console.log("[DRAIN] Popup columns for map add:", popupColumns);
      enableWellAddMode(popupColumns, handleWellAddFromMap);
      setIsMapAddModeEnabled(true);
    }
  };

  useEffect(() => {
    setIsMapAddModeEnabled(isWellAddModeActive);
  }, [isWellAddModeActive]);

  useEffect(() => {
    if (!areaConfirmed || isWellTableSaved || !selectedYear) {
      if (isMapAddModeEnabled) {
        disableWellAddMode();
        setIsMapAddModeEnabled(false);
      }
    }
  }, [areaConfirmed, isWellTableSaved, selectedYear]);

  useEffect(() => {
    return () => {
      disableWellAddMode();
      removeWellPointsLayer();
    };
  }, []);

  // Manual form handlers
  const handleOpenAddRowPopup = () => {
    if (isWellTableSaved) {
      alert("Cannot add wells: table is already saved");
      return;
    }

    const allColumns = getDisplayColumns();
    const initialData: WellData = {};
    
    allColumns.forEach(column => {
      if (column === 'YEAR') {
        initialData[column] = selectedYear || '';
      } else {
        initialData[column] = '';
      }
    });

    setManualFormData(initialData);
    setFormErrors({});
    setIsAddRowPopupOpen(true);
  };

  const handleManualFormChange = (column: string, value: string) => {
    setManualFormData(prev => ({
      ...prev,
      [column]: value
    }));

    if (formErrors[column]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[column];
        return newErrors;
      });
    }
  };

  const validateManualForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate LATITUDE (uppercase for drain system)
    const lat = manualFormData['Latitude'];
    if (!lat || lat === '') {
      errors['Latitude'] = 'Latitude is required';
    } else {
      const latNum = parseFloat(lat as string);
      if (isNaN(latNum)) {
        errors['LATITUDE'] = 'Latitude must be a valid number';
      } else if (latNum < -90 || latNum > 90) {
        errors['LATITUDE'] = 'Latitude must be between -90 and 90';
      } else if (selectedRegionBounds) {
        const [minLon, minLat, maxLon, maxLat] = selectedRegionBounds;
        if (latNum < minLat || latNum > maxLat) {
          errors['LATITUDE'] = `Latitude must be within selected region (${minLat.toFixed(4)}° to ${maxLat.toFixed(4)}°)`;
        }
      }
    }

    // Validate LONGITUDE (uppercase for drain system)
    const lon = manualFormData['Longitude'];
    if (!lon || lon === '') {
      errors['Longitude'] = 'Longitude is required';
    } else {
      const lonNum = parseFloat(lon as string);
      if (isNaN(lonNum)) {
        errors['LONGITUDE'] = 'Longitude must be a valid number';
      } else if (lonNum < -180 || lonNum > 180) {
        errors['LONGITUDE'] = 'Longitude must be between -180 and 180';
      } else if (selectedRegionBounds) {
        const [minLon, minLat, maxLon, maxLat] = selectedRegionBounds;
        if (lonNum < minLon || lonNum > maxLon) {
          errors['LONGITUDE'] = `Longitude must be within selected region (${minLon.toFixed(4)}° to ${maxLon.toFixed(4)}°)`;
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualFormSubmit = () => {
    if (!validateManualForm()) {
      return;
    }

    console.log("[DRAIN] Adding manual well row:", manualFormData);
    addNewRow(manualFormData);
    setIsAddRowPopupOpen(false);
    setManualFormData({});
    setFormErrors({});
    
    // alert('Well added successfully to drain system!');
  };

  const handleManualFormCancel = () => {
    setIsAddRowPopupOpen(false);
    setManualFormData({});
    setFormErrors({});
  };

  // UPDATED: Combined Save & Confirm Handler
  const handleSaveAndConfirm = async (): Promise<void> => {
    if (!areaConfirmed || !selectedYear) {
      console.log("[DRAIN] Cannot proceed: Area not confirmed or year not selected");
      alert("Please confirm area and select year first");
      return;
    }

    setIsConfirming(true);
    console.log("[DRAIN] Starting Save & Confirm process...");

    try {
      if (!isWellTableSaved) {
        console.log("[DRAIN] Saving wells table...");
        saveWellTable();
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log("[DRAIN] Confirming final selections and posting to backend...");
      const selectedData = await confirmWellSelections(
        selectedVillages,
        villages,
        0
      );

      if (onWellsConfirmed && selectedData) {
        onWellsConfirmed(selectedData);
      }

      console.log("[DRAIN] Save & Confirm completed successfully!");
    } catch (error: any) {
     console.log("[DRAIN] Error during Save & Confirm:", error);
      alert(`Error during Save & Confirm: ${error.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = (): void => {
    console.log("[DRAIN] Resetting well selections...");
    resetWellSelections();
    setIsConfirming(false);
    if (onReset) {
      onReset();
    }
  };

  const handleRadioChange = (mode: 'existing_and_new' | 'upload_csv') => {
    console.log("[DRAIN] Selected mode:", mode);

    if (!yearSelected) {
      alert("Please select a year first before choosing any well selection option.");
      return;
    }

    try {
      handleWellsModeChange(mode, forceRemoveWellPointsLayer);
    } catch (error) {
     console.log("[DRAIN] Error changing mode:", error);
    }
  };

  const handleYearChange = (year: string) => {
    console.log("[DRAIN] Year selected:", year);
    setSelectedYear(year);
  };

  const handleChangeCSV = () => {
    console.log("[DRAIN] Changing CSV file - clearing current data");
    setWellsData([]);
    setSelectedFile(null);
    setCsvUploadSuccess(false);
    setCsvUploadMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadCSVTemplate = () => {
    const templateHeaders = [
      'Location',
      'Latitude',
      'Longitude',
      'ph_level',
      'electrical_conductivity',
      'carbonate',
      'bicarbonate',
      'chloride',
      'fluoride',
      'sulfate',
      'nitrate',
      'Hardness',
      'calcium',
      'magnesium',
      'sodium',
      'potassium',
      'iron'
    ];
    
    const csvContent = templateHeaders.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drain_wells_template_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!areaConfirmed) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-md">
        <div className="text-center text-gray-500">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Well Selection (Drain System)</h2>
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
            {isConfirming ? 'Saving & Confirming and posting to backend...' : 'Loading wells data...'}
          </div>
        )}

        {/* YEAR SELECTION SECTION */}
        <div className="mb-6">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 bg-purple-500 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-800">Select Year for Analysis</h3>
                <p className="text-sm text-purple-600 mt-1">
                  Available years: 2019 to {new Date().getFullYear()}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => handleYearChange(year)}
                  className={`p-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${
                    selectedYear === year
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                      : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            {selectedYear && (
              <div className="mt-4 p-3 bg-green-100 border-l-4 border-green-500 rounded">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-800 font-semibold">
                    Year {selectedYear} selected for drain system analysis
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WELL SELECTION SECTION */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Step 2: Well Selection Method</h2>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-4">
              <div className="flex space-x-6">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="existing-wells"
                    name="wellSelection"
                    value="existing_and_new"
                    checked={wellSelectionMode === 'existing_and_new'}
                    onChange={() => handleRadioChange('existing_and_new')}
                    disabled={!yearSelected}
                    className={`mr-2 ${!yearSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  />
                  <label
                    htmlFor="existing-wells"
                    className={`text-md font-medium ${
                      !yearSelected 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-gray-800 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (yearSelected) {
                        handleRadioChange('existing_and_new');
                      }
                    }}
                  >
                    Select Existing Wells
                  </label>
                  {!yearSelected && (
                    <span className="ml-2 text-xs text-red-500">(Select year first)</span>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="radio"
                    id="upload-csv"
                    name="wellSelection"
                    value="upload_csv"
                    checked={wellSelectionMode === 'upload_csv'}
                    onChange={() => handleRadioChange('upload_csv')}
                    disabled={!yearSelected}
                    className={`mr-2 ${!yearSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  />
                  <label
                    htmlFor="upload-csv"
                    className={`text-md font-medium ${
                      !yearSelected 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-gray-800 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (yearSelected) {
                        handleRadioChange('upload_csv');
                      }
                    }}
                  >
                    Upload CSV
                  </label>
                  {!yearSelected && (
                    <span className="ml-2 text-xs text-red-500">(Select year first)</span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Current mode: {wellSelectionMode || 'None'} | Year: {selectedYear || 'Not selected'} | Table saved: {isWellTableSaved ? 'Yes' : 'No'}
                {existingWellsModified && !isWellTableSaved && wellSelectionMode === 'existing_and_new' && (
                  <span className="ml-2 text-orange-600 font-bold">| Modified (IDW mode will be used)</span>
                )}
              </div>

              {/* CHANGE CSV BUTTON */}
              {wellSelectionMode === 'upload_csv' && yearSelected && wellsData.length > 0 && !isWellTableSaved && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500 rounded-xl">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-900">CSV File Uploaded Successfully</p>
                        <p className="text-sm text-blue-700 font-medium mt-1">
                          {wellsData.length} wells loaded from CSV for year {selectedYear}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleChangeCSV}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Change CSV File
                    </button>
                  </div>
                </div>
              )}

              {/* CSV UPLOAD SECTION */}
              {wellSelectionMode === 'upload_csv' && yearSelected && wellsData.length === 0 && (
                <div className="space-y-4">
                  <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-4 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-indigo-900">
                        Your CSV data will be automatically associated with year <span className="font-bold text-indigo-700">{selectedYear}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">Upload CSV File</h3>
                          <p className="text-sm text-blue-100">Drag & drop or browse to upload</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={downloadCSVTemplate}
                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-indigo-600 font-bold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Template
                      </button>
                    </div>

                    <div className="p-8">
                      <div
                        className={`relative border-3 rounded-2xl p-12 text-center transition-all duration-300 ${isDragging
                          ? 'border-indigo-500 bg-indigo-50 border-dashed scale-[1.02] shadow-lg'
                          : 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 border-dashed hover:border-indigo-400 hover:bg-indigo-50/50'
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

                        <div className="space-y-6">
                          <div className="flex justify-center">
                            <div className="relative">
                              {isDragging && (
                                <div className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                              )}
                              <svg className={`relative w-24 h-24 transition-colors duration-300 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-lg font-bold text-gray-800">
                              {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
                            </p>
                            <p className="text-sm text-gray-500 font-medium">or</p>
                          </div>

                          <div className="flex items-center justify-center gap-4">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className={`px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-200 ${isConfirming || csvUploading || isWellTableSaved
                                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                                }`}
                              disabled={isConfirming || csvUploading || isWellTableSaved}
                            >
                              Browse Files
                            </button>

                            {selectedFile && !isWellTableSaved && (
                              <button
                                onClick={handleCSVUpload}
                                disabled={csvUploading || isConfirming}
                                className={`px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-200 ${csvUploading || isConfirming
                                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                                  }`}
                              >
                                {csvUploading ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Uploading...
                                  </span>
                                ) : 'Upload CSV'}
                              </button>
                            )}
                          </div>

                          {selectedFile && (
                            <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-base font-bold text-blue-900 truncate">{selectedFile.name}</p>
                                  <p className="text-sm text-blue-700 font-medium">Year: {selectedYear}</p>
                                </div>
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {csvUploading && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-100 border-2 border-blue-400 rounded-xl p-5 shadow-md">
                      <div className="flex items-center gap-4">
                        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <div>
                          <p className="text-base font-bold text-blue-900">Processing your CSV file...</p>
                          <p className="text-sm text-blue-700">Validating data for year {selectedYear}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {csvUploadMessage && !csvUploadSuccess && (
                    <div className="rounded-xl p-5 border-2 shadow-md bg-gradient-to-r from-red-50 to-rose-50 border-red-400">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-red-500">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold mb-1 text-red-900">Upload Failed</p>
                          <p className="text-sm font-medium text-red-800">{csvUploadMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wellSelectionMode === 'existing_and_new' && yearSelected && (
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-green-800 text-sm">
                    <strong>Loading existing wells for year {selectedYear}...</strong> 
                    Wells data from the selected villages and year will be displayed in the table below.
                  </p>
                </div>
              )}

              {wellsLoading && (
                <div className="p-2 bg-blue-100 text-blue-700 rounded">
                  Loading wells data for year {selectedYear}...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WELLS TABLE SECTION */}
      {wellsData.length > 0 && (
        <div className="flex-1 mt-4 p-4 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h4 className="text-lg font-medium text-gray-800">
              Wells Data - Year {selectedYear} ({wellSelectionMode === 'existing_and_new' ? 'Existing Wells' : 'Uploaded CSV'})
              {isWellTableSaved && <span className="ml-2 text-green-600 text-sm">[SAVED]</span>}
              {existingWellsModified && !isWellTableSaved && wellSelectionMode === 'existing_and_new' && (
                <span className="ml-2 text-orange-600 text-sm font-bold">[MODIFIED - IDW MODE]</span>
              )}
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
                ? existingWellsModified
                  ? ` These are modified existing wells from year ${selectedYear}. IDW interpolation will be used during GWQI generation.`
                  : ` These are existing wells from year ${selectedYear} in the selected villages. You can edit the data and add rows/columns if needed.`
                : ` This is your uploaded CSV data for year ${selectedYear}. You can edit the data and add rows/columns if needed.`
              }
              {isWellTableSaved && <span className="block mt-1 text-green-700 font-medium">Wells have been saved successfully for year {selectedYear}.</span>}
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
                onClick={handleOpenAddRowPopup}
                disabled={isWellTableSaved || isConfirming}
                className={`px-3 py-1 rounded text-sm ${isWellTableSaved || isConfirming
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
              >
                Add Row
              </button>
              
              {!isWellTableSaved && wellSelectionMode && selectedYear && (
                <button
                  onClick={toggleMapAddMode}
                  disabled={isConfirming || !areaConfirmed || !selectedYear}
                  className={`px-3 py-1 rounded text-sm ${isMapAddModeEnabled
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : isConfirming || !areaConfirmed || !selectedYear
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
                            className={`w-full p-1 text-xs border-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0 ${
                              isWellTableSaved || isConfirming ? 'bg-gray-100 cursor-not-allowed' : ''
                            } ${column === 'YEAR' ? 'bg-purple-50 font-semibold' : ''}`}
                            disabled={isWellTableSaved || isConfirming || column === 'YEAR'}
                            readOnly={isWellTableSaved || isConfirming || column === 'YEAR'}
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

          {/* FINAL ACTIONS - COMBINED SAVE & CONFIRM BUTTON */}
          <div className="flex justify-center space-x-4 mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleSaveAndConfirm}
              disabled={isConfirming || !selectedYear || !areaConfirmed}
              className={`py-3 px-10 rounded-xl text-white font-bold text-base shadow-lg transition-all duration-200 ${
                isConfirming || !selectedYear || !areaConfirmed
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl transform hover:scale-105'
              }`}
              title={!selectedYear ? "Please select a year first" : !areaConfirmed ? "Please confirm area first" : "Save wells and confirm to proceed"}
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving & Confirming...
                </span>
              ) : (
                `Save & Confirm Wells (${selectedYear})`
              )}
            </button>
            
            <button
              className="bg-red-500 hover:bg-red-700 text-white py-3 px-8 rounded-xl font-bold text-base focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              onClick={handleReset}
              disabled={wellsLoading || isConfirming}
            >
              Reset Wells
            </button>
          </div>
        </div>
      )}

      {/* ADD ROW POPUP FORM - DRAIN SYSTEM */}
      {isAddRowPopupOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4"
          onClick={handleManualFormCancel}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Add New Well (Drain System)</h3>
                  <p className="text-sm text-green-100">Fill in the groundwater quality well details</p>
                </div>
              </div>
              <button
                onClick={handleManualFormCancel}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info Banner */}
            <div className="px-6 py-4 bg-green-50 border-b border-green-200">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-green-800">
                  <strong className="font-semibold">Required fields:</strong> LATITUDE and LONGITUDE must be filled with valid coordinates within the selected village region.
                </p>
              </div>
            </div>

            {/* Valid Region Info */}
            {selectedRegionBounds && (
              <div className="px-6 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-emerald-900">Valid Village Region:</span>
                  <span className="text-emerald-700 font-mono text-xs">
                    Lat: {selectedRegionBounds[1].toFixed(4)}° to {selectedRegionBounds[3].toFixed(4)}° | 
                    Lon: {selectedRegionBounds[0].toFixed(4)}° to {selectedRegionBounds[2].toFixed(4)}°
                  </span>
                </div>
              </div>
            )}

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getDisplayColumns().map((column) => {
                  const isRequired = column === 'LATITUDE' || column === 'LONGITUDE';
                  const isYearField = column === 'YEAR';
                  const hasError = formErrors[column];

                  return (
                    <div key={column} className={isYearField ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {column}
                        {isRequired && <span className="text-red-500 ml-1">*</span>}
                        {isYearField && <span className="text-gray-500 text-xs ml-2">(Auto-filled)</span>}
                      </label>
                      <input
                        type="text"
                        value={manualFormData[column] || ''}
                        onChange={(e) => handleManualFormChange(column, e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-lg border-2 text-sm transition-all ${
                          hasError
                            ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-2 focus:ring-red-200'
                            : isYearField
                            ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                            : 'border-gray-300 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-200'
                        } ${hasError ? '' : 'focus:outline-none'}`}
                        placeholder={
                          column === 'LATITUDE' ? 'e.g., 25.5397' :
                          column === 'LONGITUDE' ? 'e.g., 82.3789' :
                          isYearField ? selectedYear || '' :
                          `Enter ${column.toLowerCase()}`
                        }
                        disabled={isYearField}
                        readOnly={isYearField}
                      />
                      {hasError && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {hasError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleManualFormSubmit}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Well to Drain System
              </button>
              <button
                onClick={handleManualFormCancel}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WellSelection;