"use client";

import React, { useContext, useEffect } from 'react';
import { GroundwaterContourContext } from "@/contexts/groundwater_assessment/admin/ContourContext";
import { useWell } from "@/contexts/groundwater_assessment/admin/WellContext";

interface GroundwaterContourProps {
  activeTab: string;
  step: number;
}

const GroundwaterContour: React.FC<GroundwaterContourProps> = ({ activeTab, step }) => {
  const {
    geoJsonData,
    rasterData,
    visualizationData,
    interpolationMethod,
    parameter,
    contourInterval,
    isLoading,
    error,
    setInterpolationMethod,
    setParameter,
    setContourInterval,
    handleGenerate,
  } = useContext(GroundwaterContourContext);

  const { wellsData, getDisplayColumns, csvFilename } = useWell();

  const getParameterOptions = () => {
    const allColumns = getDisplayColumns();
    const excludedColumns = ['LATITUDE', 'LONGITUDE', 'HYDROGRAPH', 'BLOCK'];
    return allColumns.filter(column => !excludedColumns.includes(column));
  };

  const isFormValid = () => {
    if (!interpolationMethod || !parameter || !contourInterval) {
      return false;
    }

    const intervalValue = parseFloat(contourInterval);
    if (isNaN(intervalValue) || intervalValue <= 0) {
      return false;
    }

    return true;
  };

  const handleDownloadPNG = () => {
    if (!visualizationData) return;

    try {
      let downloadUrl: string;
      let filename = visualizationData.png_filename || 'contour_visualization.png';

      if (visualizationData.png_base64) {
        // Create blob from base64 data
        const base64Data = visualizationData.png_base64.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        downloadUrl = URL.createObjectURL(blob);

        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

      } else if (visualizationData.download_url) {
        // Try to fetch the image from the URL and download it
        fetch(visualizationData.download_url)
          .then(response => {
            if (!response.ok) throw new Error('Failed to fetch image');
            return response.blob();
          })
          .then(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          })
          .catch(error => {
            console.log('Error downloading image:', error);
            alert('Failed to download image. Please try again.');
          });
      } else {
        alert('No image data available for download');
      }
    } catch (error) {
      console.log('Error preparing download:', error);
      alert('Failed to prepare download. Please try again.');
    }
  };

  return (
    <div className="h-full overflow-auto flex flex-col">
      {/* Contour Generation Loading Overlay */}
    {isLoading && (
      <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-2xl p-8">
          <div className="inline-block relative">
            <svg className="animate-spin h-20 w-20" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="spinner-gradient-contour" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="50%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="spinner-gradient-2-contour" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="url(#spinner-gradient-contour)" strokeWidth="3" />
              <path className="opacity-90" fill="url(#spinner-gradient-2-contour)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-xl font-semibold mt-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Generating Interpolation & Contours...
          </p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we process groundwater depth analysis</p>
        </div>
      </div>
    )}
      <h3 className="font-medium text-blue-600 mb-4">Groundwater Depth (Step {step})</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Generation Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!csvFilename && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Well Data Required</p>
              <p className="text-sm mt-1">Please confirm well selections or upload a CSV file with well data before generating contours.</p>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4 mb-6">


        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Choose Parameter <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={parameter}
            onChange={(e) => setParameter(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select Parameter...</option>
            {getParameterOptions().map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contour Interval (meters) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter interval (e.g., 5)"
            value={contourInterval}
            onChange={(e) => setContourInterval(e.target.value)}
            min="0.1"
            step="0.1"
            disabled={isLoading}
          />
          {/* <p className="text-xs text-gray-500 mt-1">
            💡 Recommended: 1-5m for groundwater levels, 5-20m for elevation
          </p> */}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Method of Interpolation <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={interpolationMethod}
            onChange={(e) => setInterpolationMethod(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select Method...</option>
            <option value="idw">Inverse Distance Weighted (IDW)</option>
            {/* <option value="kriging">Kriging</option>
            <option value="spline">Spline</option> */}
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !isFormValid() || !csvFilename}
        className={[
          "w-full inline-flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200 rounded-full py-3 px-5",
          isLoading || !isFormValid() || !csvFilename
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
        ].join(" ")}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Generating Interpolation & Contours...</span>
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>Generate Interpolation & Contours</span>
          </>
        )}
      </button>


      {/* Success Messages with PNG Preview */}
      {rasterData && !error && !isLoading && (
        <div className="mt-4 space-y-4">

          {/* Combined Success Message */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-base font-semibold text-gray-800">
                Generation Complete!
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Both raster surface and contour lines have been successfully generated and added to the map.
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="text-center p-2 bg-white rounded border">
                <p className="font-medium text-gray-700">Method</p>
                <p className="text-blue-600">{interpolationMethod?.toUpperCase()}</p>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <p className="font-medium text-gray-700">Contours</p>
                <p className="text-blue-600">{geoJsonData?.features?.length || 0} lines</p>
              </div>
              <div className="text-center p-2 bg-white rounded border">
                <p className="font-medium text-gray-700">Interval</p>
                <p className="text-blue-600">{contourInterval}m</p>
              </div>
            </div>
          </div>
          {/*PNG IMAGE*/}
          {visualizationData && (visualizationData.png_base64 || visualizationData.png_path) && (
            <div className="p-4 border border-gray-300 rounded-md bg-white mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-800">Raster and Contour Visualization</h4>
                <button
                  onClick={handleDownloadPNG}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PNG
                </button>
              </div>

              {/* <div className="relative">
                <img
                  src={
                    visualizationData.png_base64
                      ? `data:image/png;base64,${visualizationData.png_base64}`
                      : visualizationData.png_path || ''
                  }
                  alt="Contour Visualization"
                  className="max-w-full h-auto rounded-md shadow-sm border"
                  onError={(e) => {
                    console.log('Image failed to load');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div> */}
            </div>
          )}
          {/* Detailed Statistics */}
          {(geoJsonData?.properties?.statistics || rasterData) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-800 mb-2">Analysis Details</h4>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                {/* Contour Details */}
                {geoJsonData?.properties?.statistics && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Contour Details</p>
                    <p><span className="font-medium">Total Lines:</span> {geoJsonData.properties.statistics.total_contours}</p>
                    <p><span className="font-medium">Interval:</span> {geoJsonData.properties.statistics.contour_interval}m</p>
                    {geoJsonData.properties.statistics.contour_levels && geoJsonData.properties.statistics.contour_levels.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium text-gray-700 mb-1">Contour Levels (m):</p>
                        <div className="flex flex-wrap gap-1">
                          {geoJsonData.properties.statistics.contour_levels.slice(0, 6).map((level: number, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {level.toFixed(1)}
                            </span>
                          ))}
                          {geoJsonData.properties.statistics.contour_levels.length > 6 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                              +{geoJsonData.properties.statistics.contour_levels.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Raster Details */}
                {rasterData && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Raster Details</p>
                    <p><span className="font-medium">Resolution:</span> {rasterData.resolution || '30m'}</p>
                    <p><span className="font-medium">CRS:</span> {rasterData.crs || 'EPSG:32644'}</p>
                    <p><span className="font-medium">Villages:</span> {rasterData.villages_selected || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroundwaterContour;