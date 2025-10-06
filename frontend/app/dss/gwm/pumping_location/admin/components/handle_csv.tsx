import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { Upload, AlertCircle } from "lucide-react";
import { CsvRow } from "@/interface/table";
import { useLocation } from "@/contexts/groundwaterIdent/admin/LocationContext";

const REQUIRED_HEADERS = ["Well_id", "Longitude", "Latitude"];

const CsvUploader: React.FC = () => {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const { setwell_points } = useLocation();

  // Automatically save selected rows whenever selection changes
  useEffect(() => {
    const selectedData = csvData.filter((_, idx) => selectedRows.has(idx));
    
    console.log("Auto-saving well points:", selectedData.length, "points");
    
    // Verify data structure
    selectedData.forEach((point, idx) => {
      console.log(`Point ${idx}:`, {
        Well_id: point.Well_id,
        Longitude: point.Longitude,
        Latitude: point.Latitude
      });
    });
    
    setwell_points(selectedData);
  }, [selectedRows, csvData, setwell_points]);

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

  return (
    <div className="bg-gray-50 flex items-center justify-center ">
      <div className="w-full bg-white rounded-xl shadow-lg p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-3">CSV Uploader</h2>

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

        {/* Selection Info - now shows auto-save status */}
        {csvData.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{selectedRows.size}</span> of{" "}
              <span className="font-semibold">{csvData.length}</span> rows selected
              {selectedRows.size > 0 && (
                <span className="ml-2 text-green-600 text-xs">
                  ✓ Auto-saved to map
                </span>
              )}
            </p>
            <div className="space-x-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* CSV Table */}
        {csvData.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
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
        )}
      </div>
    </div>
  );
};

export default CsvUploader;