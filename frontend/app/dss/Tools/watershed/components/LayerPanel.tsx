import React, { useState } from 'react';
import { X, Plus, Eye, EyeOff, Trash2, Upload } from 'lucide-react';
import { LayerData, GeoJSONResponse } from './type';
import { isValidGeoJSON } from './utils';

interface LayerPanelProps {
  customLayers: LayerData[];
  onAddLayer: (layer: LayerData) => void;
  onToggleLayer: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onClose: () => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  customLayers,
  onAddLayer,
  onToggleLayer,
  onRemoveLayer,
  onClose,
}) => {
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [layerName, setLayerName] = useState<string>('');
  const [layerColor, setLayerColor] = useState<string>('#8b5cf6');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'tif' || fileExtension === 'tiff') {
      // Handle GeoTIFF files
      setUploadError('GeoTIFF support coming soon. For now, please convert to GeoJSON format.');
      return;
      
      // TODO: Implement GeoTIFF reading with geotiff.js
      // This would require adding the geotiff library
      // import { fromBlob } from 'geotiff';
    } else {
      // Handle GeoJSON files
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!isValidGeoJSON(data)) {
            setUploadError('Invalid GeoJSON file');
            return;
          }

          const newLayer: LayerData = {
            id: `layer-${Date.now()}`,
            name: layerName || file.name.replace(/\.(geojson|json)$/, ''),
            data: data as GeoJSONResponse,
            visible: true,
            color: layerColor,
          };

          onAddLayer(newLayer);
          setLayerName('');
          setLayerColor('#8b5cf6');
          setShowUpload(false);
          setUploadError(null);
        } catch (error) {
          setUploadError('Error parsing GeoJSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const colorOptions = [
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#10b981', label: 'Green' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#ef4444', label: 'Red' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#a855f7', label: 'Violet' },
  ];

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Layer Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">Manage custom data layers</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Add Layer Button */}
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Custom Layer</span>
        </button>

        {/* Upload Form */}
        {showUpload && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Layer Name
              </label>
              <input
                type="text"
                value={layerName}
                onChange={(e) => setLayerName(e.target.value)}
                placeholder="My Custom Layer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Layer Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setLayerColor(color.value)}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      layerColor === color.value
                        ? 'border-slate-800 scale-110'
                        : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Upload GeoJSON or GeoTIFF
              </label>
              <label className="flex items-center justify-center space-x-2 px-4 py-3 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:border-green-500 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-slate-600" />
                <span className="text-sm text-slate-600">Choose file</span>
                <input
                  type="file"
                  accept=".geojson,.json,.tif,.tiff"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Supports: .geojson, .json, .tif, .tiff
              </p>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}
          </div>
        )}

        {/* Layer List */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Custom Layers</h3>
          {customLayers.length === 0 ? (
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500">No custom layers added yet</p>
            </div>
          ) : (
            customLayers.map((layer) => (
              <div
                key={layer.id}
                className="bg-white rounded-lg p-3 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {layer.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onToggleLayer(layer.id)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                    >
                      {layer.visible ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveLayer(layer.id)}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                      title="Remove layer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {layer.data.features?.length || 0} features
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-xs text-blue-900">
            <strong>Tip:</strong> Upload GeoJSON files to overlay your own data, 
            such as administrative boundaries, infrastructure, or field survey points.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LayerPanel;