// app/vector/components/IntersectionModal.tsx
'use client';

import React, { useState, useRef } from 'react';

interface IntersectionModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  managedLayers: Array<{
    id: string;
    name: string;
    layer: any;
    visible: boolean;
    type: 'geojson' | 'uploaded' | 'drawn';
  }>;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onIntersectionComplete: (geojson: any) => void;
}

export default function IntersectionModal({
  isOpen,
  onOpenChange,
  managedLayers,
  showNotification,
  onIntersectionComplete,
}: IntersectionModalProps) {
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLayerToggle = (layerId: string) => {
    const newSelected = new Set(selectedLayers);
    if (newSelected.has(layerId)) {
      newSelected.delete(layerId);
    } else {
      newSelected.add(layerId);
    }
    setSelectedLayers(newSelected);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setSelectedLayers(new Set());
    setUploadedFiles([]);
    setProcessing(false);
    onOpenChange(false);
  };

  const performIntersection = async () => {
    // Validate we have at least 2 items
    const totalItems = selectedLayers.size + uploadedFiles.length;
    if (totalItems < 2) {
      showNotification('Error', 'Please select at least 2 layers or files', 'error');
      return;
    }

    setProcessing(true);

    try {
      const formData = new FormData();

      // Convert selected layers to GeoJSON and create File objects
      for (const layerId of selectedLayers) {
        const managedLayer = managedLayers.find((ml) => ml.id === layerId);
        if (managedLayer?.layer) {
          const L = require('leaflet');
          let geojson;

          // Extract GeoJSON from the layer
          if (typeof managedLayer.layer.toGeoJSON === 'function') {
            geojson = managedLayer.layer.toGeoJSON();
          } else if (managedLayer.layer.getLayers) {
            // For layer groups
            const features: any[] = [];
            managedLayer.layer.eachLayer((l: any) => {
              if (l.toGeoJSON) {
                const gj = l.toGeoJSON();
                if (gj.type === 'FeatureCollection') {
                  features.push(...gj.features);
                } else if (gj.type === 'Feature') {
                  features.push(gj);
                }
              }
            });
            geojson = {
              type: 'FeatureCollection',
              features,
            };
          }

          if (geojson) {
            // Create a GeoJSON file from the layer
            const geojsonBlob = new Blob([JSON.stringify(geojson)], {
              type: 'application/geo+json',
            });
            const geojsonFile = new File([geojsonBlob], `${managedLayer.name}.geojson`, {
              type: 'application/geo+json',
            });
            formData.append('files', geojsonFile);
          }
        }
      }

      // Add uploaded files
      uploadedFiles.forEach((file) => {
        formData.append('files', file);
      });

      // Call the intersection API
      const response = await fetch('http://localhost:9000/django/mapplot/intersection/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.message) {
        // No intersection found
        showNotification('Info', result.message, 'info');
      } else {
        // Intersection found, plot it
        onIntersectionComplete(result);
        showNotification('Success', 'Intersection computed successfully', 'success');
        handleClose();
      }
    } catch (error: any) {
      console.error('Intersection error:', error);
      showNotification('Error', error.message || 'Failed to compute intersection', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col z-[100000] pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <i className="fas fa-object-group text-blue-600 text-xl"></i>
            <h2 className="text-xl font-semibold text-gray-800">Intersection Analysis</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <i className="fas fa-info-circle mr-2"></i>
              Select at least 2 layers from the map or upload shapefiles to compute their intersection.
            </p>
          </div>

          {/* Existing Layers Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
              <i className="fas fa-layer-group mr-2 text-blue-600"></i>
              Existing Layers
            </h3>

            {managedLayers.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">
                No layers available on the map
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {managedLayers.map((ml) => (
                  <label
                    key={ml.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-blue-50 transition-colors border border-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLayers.has(ml.id)}
                      onChange={() => handleLayerToggle(ml.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{ml.name}</div>
                      <div className="text-xs text-gray-500">
                        {ml.type === 'geojson' && 'GeoJSON Layer'}
                        {ml.type === 'uploaded' && 'Uploaded Shapefile'}
                        {ml.type === 'drawn' && 'Drawn Feature'}
                      </div>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        ml.visible ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={ml.visible ? 'Visible' : 'Hidden'}
                    ></div>
                  </label>
                ))}
              </div>
            )}

            {selectedLayers.size > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <i className="fas fa-check-circle text-green-600 mr-1"></i>
                {selectedLayers.size} layer(s) selected
              </div>
            )}
          </div>

          {/* Upload Files Section
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
              <i className="fas fa-upload mr-2 text-blue-600"></i>
              Upload Files
            </h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-600 mb-1">Click to upload shapefiles</p>
              <p className="text-xs text-gray-500">Accepts .zip, .shp, .geojson, .json</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.shp,.dbf,.shx,.prj,.cpg,.geojson,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <i className="fas fa-file text-blue-600"></i>
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="Remove"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div> */}

          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-700">
              <strong>Total items selected:</strong> {selectedLayers.size + uploadedFiles.length}
              <span className="ml-2 text-gray-500">
                ({selectedLayers.size} existing + {uploadedFiles.length} uploaded)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-5 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={processing}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={performIntersection}
            disabled={processing || selectedLayers.size + uploadedFiles.length < 2}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Processing...
              </>
            ) : (
              <>
                <i className="fas fa-object-group"></i>
                Compute Intersection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}