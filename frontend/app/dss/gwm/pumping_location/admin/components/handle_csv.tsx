import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { Upload, AlertCircle, MapPin, Trash2 } from "lucide-react";
import { CsvRow } from "@/interface/table";
import { useLocation } from "@/contexts/pumping_location/admin/LocationContext";

const REQUIRED_HEADERS = ["Well_id", "Longitude", "Latitude"];

const CsvUploader: React.FC = () => {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [manuallyAddedCount, setManuallyAddedCount] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<'manual' | 'csv'>('csv'); // Default to manual section

  const { setwell_points, well_points } = useLocation();

  // Track how many points were manually added vs from CSV
  useEffect(() => {
    if (well_points) {
      const manualCount = well_points.length - csvData.filter((_, idx) => selectedRows.has(idx)).length;
      setManuallyAddedCount(Math.max(0, manualCount));
    }
  }, [well_points, csvData, selectedRows]);

  // Automatically save selected rows whenever selection changes
  useEffect(() => {
    const selectedData = csvData.filter((_, idx) => selectedRows.has(idx));    
    // Verify data structure
    selectedData.forEach((point, idx) => {
      console.log(`Point ${idx}:`, {
        Well_id: point.Well_id,
        Longitude: point.Longitude,
        Latitude: point.Latitude
      });
    });
    
    // Get existing manually added points (those not from current CSV)
    const existingManualPoints = (well_points || []).filter(point => 
      !csvData.some(csvRow => csvRow.Well_id === point.Well_id)
    );
    
    // Combine manual points with selected CSV points
    const combinedPoints = [...existingManualPoints, ...selectedData];
    console.log("Combined points:", combinedPoints.length, "(", existingManualPoints.length, "manual +", selectedData.length, "CSV)");
    
    setwell_points(combinedPoints);
  }, [selectedRows, csvData]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");
    setSelectedRows(new Set()); // Reset selection on new upload

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];

        // Validate headers
        const isValid = REQUIRED_HEADERS.every((col) => headers.includes(col));
        if (!isValid) {
          setCsvData([]);
          setError(
            `Invalid CSV. Required columns: ${REQUIRED_HEADERS.join(", ")}`
          );
          return;
        }

        setCsvData(result.data);
      },
      error: (err) => {
        console.log(err);
        setError("Error parsing CSV file.");
      },
    });
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedRows(new Set(csvData.map((_, idx) => idx)));
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  const removeManualPoint = (wellId: string) => {
    if (!well_points) return;
    
    const confirmed = window.confirm(`Remove well point "${wellId}"?`);
    if (!confirmed) return;

    const updatedPoints = well_points.filter(point => point.Well_id !== wellId);
    setwell_points(updatedPoints);
    console.log("Removed well point:", wellId);
  };

  // Get manually added points (not from current CSV)
  const manualPoints = (well_points || []).filter(point => 
    !csvData.some(csvRow => csvRow.Well_id === point.Well_id)
  );

  return (
    <div className="bg-gray-50 flex items-center justify-center">
      <div className="w-full bg-white rounded-xl shadow-lg p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Well Points Manager</h2>

        {/* Upload Button */}
        <label className="inline-flex items-center space-x-2 cursor-pointer px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-medium rounded-full shadow-md hover:from-indigo-700 hover:to-blue-600 transition-all duration-200 ease-in-out transform hover:scale-105">
          <Upload className="w-4 h-4" />
          <span className="text-sm">Upload CSV</span>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Show selected file */}
        {fileName && (
          <p className="mt-2 text-xs text-gray-500">
            <span className="font-medium">Selected:</span> {fileName}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-2 flex items-center text-red-700 bg-red-100 border-l-4 border-red-500 rounded-md p-3">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium">{error}</span>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">CSV Points</p>
                <p className="text-2xl font-bold text-blue-800">{selectedRows.size}</p>
              </div>
              <Upload className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-medium">Manual Points</p>
                <p className="text-2xl font-bold text-orange-800">{manualPoints.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-orange-400" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Total Points</p>
                <p className="text-2xl font-bold text-green-800">{(well_points || []).length}</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center bg-green-200 rounded-full">
                <span className="text-green-700 font-bold">Σ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Manually Added Points Section - Always visible, collapsible */}
        <div className="mt-4">
          <button
            onClick={() => setActiveSection(activeSection === 'manual' ? 'csv' : 'manual')}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
              activeSection === 'manual'
                ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300'
                : 'bg-gray-100 border-2 border-gray-300 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center">
              <MapPin className={`w-5 h-5 mr-2 ${
                activeSection === 'manual' ? 'text-orange-600' : 'text-gray-500'
              }`} />
              <h3 className={`text-sm font-semibold ${
                activeSection === 'manual' ? 'text-orange-800' : 'text-gray-700'
              }`}>
                Manually Added Points
              </h3>
              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                activeSection === 'manual'
                  ? 'bg-orange-200 text-orange-800'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {manualPoints.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 transition-transform ${
                activeSection === 'manual' ? 'rotate-180 text-orange-600' : 'text-gray-500'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {activeSection === 'manual' && (
            <div className="mt-2 bg-orange-50 rounded-lg border border-orange-200 p-3">
              {manualPoints.length > 0 ? (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {manualPoints.map((point, idx) => (
                    <div
                      key={`manual-${idx}`}
                      className="flex items-center justify-between bg-white rounded-md p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-orange-700">
                            {point.Well_id}
                          </span>
                          <span className="text-sm font-semibold text-orange-700 px-14">
                            {point?.Name}
                          </span>
                          
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Lat: {parseFloat(point.Latitude).toFixed(6)}°, 
                          Lon: {parseFloat(point.Longitude).toFixed(6)}°
                        </div>
                      </div>
                      <button
                        onClick={() => removeManualPoint(point.Well_id)}
                        className="ml-2 p-2 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                        title="Remove this point"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-orange-300 mx-auto mb-2" />
                  <p className="text-sm text-orange-600 font-medium">No manual points yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Click "Add Well" in the map tools to add points manually
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CSV Data Section - Collapsible */}
        {csvData.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setActiveSection(activeSection === 'csv' ? 'manual' : 'csv')}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                activeSection === 'csv'
                  ? 'bg-gradient-to-r from-indigo-50 to-indigo-100 border-2 border-indigo-300'
                  : 'bg-gray-100 border-2 border-gray-300 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center">
                <Upload className={`w-5 h-5 mr-2 ${
                  activeSection === 'csv' ? 'text-indigo-600' : 'text-gray-500'
                }`} />
                <h3 className={`text-sm font-semibold ${
                  activeSection === 'csv' ? 'text-indigo-800' : 'text-gray-700'
                }`}>
                  CSV Data
                </h3>
                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                  activeSection === 'csv'
                    ? 'bg-indigo-200 text-indigo-800'
                    : 'bg-gray-300 text-gray-700'
                }`}>
                  {selectedRows.size}/{csvData.length}
                </span>
                {selectedRows.size > 0 && (
                  <span className="ml-2 text-green-600 text-xs">
                    ✓ Auto-saved
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 transition-transform ${
                  activeSection === 'csv' ? 'rotate-180 text-indigo-600' : 'text-gray-500'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {activeSection === 'csv' && (
              <div className="mt-2">
                <div className="flex space-x-2 mb-3">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors border border-indigo-200"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors border border-gray-300"
                  >
                    Deselect All
                  </button>
                </div>

                {/* CSV Table */}
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-xs text-left text-gray-700">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-gray-800 uppercase tracking-wider border-b border-gray-200 w-24">
                            Action
                          </th>
                          {REQUIRED_HEADERS.map((key) => (
                            <th
                              key={key}
                              className="px-4 py-2 font-semibold text-gray-800 uppercase tracking-wider border-b border-gray-200"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.map((row, idx) => {
                          const isSelected = selectedRows.has(idx);
                          return (
                            <tr
                              key={idx}
                              className={`${
                                isSelected
                                  ? "bg-indigo-100 border-l-4 border-indigo-500"
                                  : idx % 2 === 0
                                  ? "bg-white"
                                  : "bg-gray-50"
                              } hover:bg-indigo-50 transition-colors duration-200`}
                            >
                              <td className="px-4 py-2 border-b border-gray-200">
                                <button
                                  onClick={() => toggleRowSelection(idx)}
                                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                                    isSelected
                                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  }`}
                                >
                                  {isSelected ? "Unselect" : "Select"}
                                </button>
                              </td>
                              {REQUIRED_HEADERS.map((col) => (
                                <td
                                  key={col}
                                  className="px-4 py-2 border-b border-gray-200"
                                >
                                  {row[col as keyof CsvRow]}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Helpful Instructions */}
        {csvData.length === 0 && manualPoints.length === 0 && (
          <div className="mt-4 text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="flex flex-col items-center">
              <div className="flex space-x-4 mb-3">
                <Upload className="w-10 h-10 text-gray-400" />
                <MapPin className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-2">No well points yet</p>
              <p className="text-xs text-gray-500 max-w-md">
                Upload a CSV file with well point data, or click on the map to add points manually
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvUploader;