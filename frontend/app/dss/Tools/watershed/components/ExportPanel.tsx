import React, { useState } from 'react';
import { X, Download, FileImage, FileText, Map as MapIcon } from 'lucide-react';
import { GeoJSONResponse } from './type';
import { exportMapAsPNG, exportMapAsPDF, exportGeoJSON } from './utils';
import { Map as LeafletMap } from 'leaflet';

interface ExportPanelProps {
  watershedData: GeoJSONResponse | null;
  riversData: GeoJSONResponse | null;
  flowpathData: GeoJSONResponse | null;
  drawnItems: any[];
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onClose: () => void;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  watershedData,
  riversData,
  flowpathData,
  drawnItems,
  mapRef,
  onClose,
}) => {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPNG = async () => {
    setExporting('png');
    setExportError(null);
    try {
      const mapElement = mapRef.current?.getContainer();
      if (!mapElement) {
        throw new Error('Map not found');
      }
      await exportMapAsPNG(mapElement, 'watershed-analysis.png');
    } catch (error) {
      setExportError('Failed to export as PNG');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    setExportError(null);
    try {
      const mapElement = mapRef.current?.getContainer();
      if (!mapElement) {
        throw new Error('Map not found');
      }
      await exportMapAsPDF(mapElement, 'watershed-analysis.pdf');
    } catch (error) {
      setExportError('Failed to export as PDF');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportWatershed = () => {
    if (!watershedData) return;
    exportGeoJSON(watershedData, 'watershed.geojson');
  };

  const handleExportRivers = () => {
    if (!riversData) return;
    exportGeoJSON(riversData, 'rivers.geojson');
  };

  const handleExportFlowpath = () => {
    if (!flowpathData) return;
    exportGeoJSON(flowpathData, 'flowpath.geojson');
  };

  const handleExportDrawings = () => {
    if (drawnItems.length === 0) return;
    const data: GeoJSONResponse = {
      type: 'FeatureCollection',
      features: drawnItems,
    };
    exportGeoJSON(data, 'drawings.geojson');
  };

  const handleExportAll = () => {
    setExporting('all');
    setExportError(null);
    try {
      const allFeatures: any[] = [];

      if (watershedData?.features) {
        allFeatures.push(...watershedData.features);
      }
      if (riversData?.features) {
        allFeatures.push(...riversData.features);
      }
      if (flowpathData?.features) {
        allFeatures.push(...flowpathData.features);
      }
      if (drawnItems.length > 0) {
        allFeatures.push(...drawnItems);
      }

      if (allFeatures.length === 0) {
        setExportError('No data to export');
        return;
      }

      const data: GeoJSONResponse = {
        type: 'FeatureCollection',
        features: allFeatures,
      };

      exportGeoJSON(data, 'watershed-complete.geojson');
    } catch (error) {
      setExportError('Failed to export data');
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const hasData =
    watershedData || riversData || flowpathData || drawnItems.length > 0;

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Export Results</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">Download your analysis</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasData ? (
          <div className="bg-slate-50 rounded-lg p-6 text-center">
            <Download className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              No data to export yet. Run an analysis first.
            </p>
          </div>
        ) : (
          <>
            {/* GeoJSON Exports */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Export GeoJSON Data
              </h3>
              <div className="space-y-2">
                {watershedData && (
                  <button
                    onClick={handleExportWatershed}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <MapIcon className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-slate-800 text-sm">
                          Watershed Boundary
                        </div>
                        <div className="text-xs text-slate-500">
                          {watershedData.features?.length} features
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>
                )}

                {riversData && (
                  <button
                    onClick={handleExportRivers}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <MapIcon className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-slate-800 text-sm">
                          River Network
                        </div>
                        <div className="text-xs text-slate-500">
                          {riversData.features?.length} features
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>
                )}

                {flowpathData && (
                  <button
                    onClick={handleExportFlowpath}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <MapIcon className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-slate-800 text-sm">
                          Flow Path
                        </div>
                        <div className="text-xs text-slate-500">
                          {flowpathData.features?.length} features
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>
                )}

                {drawnItems.length > 0 && (
                  <button
                    onClick={handleExportDrawings}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <MapIcon className="w-5 h-5 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium text-slate-800 text-sm">
                          Drawn Annotations
                        </div>
                        <div className="text-xs text-slate-500">
                          {drawnItems.length} features
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Export All */}
            <button
              onClick={handleExportAll}
              disabled={exporting !== null}
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all shadow-md hover:shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting === 'all' ? (
                <span className="flex items-center justify-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Exporting...</span>
                </span>
              ) : (
                'Export All as GeoJSON'
              )}
            </button>

            {/* Error Display */}
            {exportError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{exportError}</p>
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-blue-900">
                <strong>GeoJSON files</strong> can be imported into QGIS, ArcGIS, 
                Google Earth Pro, and other GIS software for further analysis and visualization.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;