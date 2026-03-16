import React, { useState } from 'react';
import {
  GeoJSONResponse,
  AnalysisMode,
  CoordinateInput,
  WatershedFeature,
} from './type';
import { getCurrentLocation, formatCoordinate } from './utils';
import { Navigation, MapPin, Droplets, TrendingDown, AlertCircle } from 'lucide-react';

interface SelectionPanelProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  clickedPoint: [number, number] | null;
  onCoordinateSubmit: (coords: CoordinateInput) => void;
  watershedData: GeoJSONResponse | null;
  riversData: GeoJSONResponse | null;
  flowpathData: GeoJSONResponse | null;
  flowpathMessage: string | null;
  error: string | null;
  indiaBaseMap: GeoJSONResponse | null;
  onClearData: () => void;
  onTriggerDelineation?: () => void; // New prop to trigger delineation
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({
  mode,
  onModeChange,
  clickedPoint,
  onCoordinateSubmit,
  watershedData,
  riversData,
  flowpathData,
  flowpathMessage,
  error,
  indiaBaseMap,
  onClearData,
  onTriggerDelineation,
}) => {
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [locationLoading, setLocationLoading] = useState<boolean>(false);

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Coordinates out of range');
      return;
    }

    onCoordinateSubmit({ latitude: lat, longitude: lng });
    setManualLat('');
    setManualLng('');
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await getCurrentLocation();
      onCoordinateSubmit({ latitude: location.lat, longitude: location.lng });
    } catch (error) {
      alert('Unable to get your location. Please check your browser permissions.');
    } finally {
      setLocationLoading(false);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <span>Analysis Controls</span>
        </h2>
        <p className="text-xs text-slate-600 mt-1">
          Click on the map to get started
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mode Selection */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Analysis Mode
          </label>
          <div className="space-y-2">
            <button
              onClick={() => onModeChange('upstream')}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                mode === 'upstream'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
              }`}
            >
              <Droplets className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">Upstream</div>
                <div className={`text-xs ${mode === 'upstream' ? 'text-blue-100' : 'text-slate-500'}`}>
                  Delineate watershed
                </div>
              </div>
            </button>

            <button
              onClick={() => onModeChange('downstream')}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                mode === 'downstream'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
              }`}
            >
              <TrendingDown className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">Downstream</div>
                <div className={`text-xs ${mode === 'downstream' ? 'text-blue-100' : 'text-slate-500'}`}>
                  Trace flow path
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mode Information */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-900">
              {mode === 'upstream' ? (
                <div>
                  <strong>Upstream Analysis:</strong> Delineates the watershed
                  (drainage basin) contributing flow to the selected point. Shows
                  all upstream river networks and calculates drainage area.
                </div>
              ) : (
                <div>
                  <strong>Downstream Analysis:</strong> Traces the flow path from
                  the selected point downstream to the outlet. Useful for tracking
                  water movement and potential pollution pathways.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Location */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Quick Actions
          </label>
          <button
            onClick={handleGetCurrentLocation}
            disabled={locationLoading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Navigation className={`w-5 h-5 ${locationLoading ? 'animate-spin' : ''}`} />
            <span className="font-medium">
              {locationLoading ? 'Getting Location...' : 'Use My Location'}
            </span>
          </button>
        </div>

        {/* Manual Coordinate Input */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Enter Coordinates
          </label>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="e.g., 22.9734"
                step="any"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="e.g., 78.6569"
                step="any"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={handleManualSubmit}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow font-medium text-sm"
            >
              Set Point
            </button>
          </div>
        </div>

        {/* Selected Point Info */}
        {clickedPoint && (
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">
              Selected Point
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Latitude:</span>
                <span className="font-mono font-medium text-slate-800">
                  {formatCoordinate(clickedPoint[0], 'lat')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Longitude:</span>
                <span className="font-mono font-medium text-slate-800">
                  {formatCoordinate(clickedPoint[1], 'lng')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        {/* Results Summary
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Data Summary
          </h3>
          <div className="space-y-2 text-sm">
            {indiaBaseMap && (
              <div className="flex justify-between">
                <span className="text-slate-600">India Base Map:</span>
                <span className="font-medium text-green-600">
                  ✓ Loaded ({indiaBaseMap.features?.length} features)
                </span>
              </div>
            )}
            {mode === 'upstream' && watershedData && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Watershed:</span>
                  <span className="font-medium text-green-600">
                    ✓ {watershedData.features?.length} features
                  </span>
                </div>
                {watershedData.features[0] && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Drainage Area:</span>
                    <span className="font-medium text-blue-600">
                      {(watershedData.features[0] as WatershedFeature)?.properties
                        ?.area_km2 || 'N/A'}{' '}
                      km²
                    </span>
                  </div>
                )}
              </>
            )}
            {mode === 'upstream' && riversData && (
              <div className="flex justify-between">
                <span className="text-slate-600">River Network:</span>
                <span className="font-medium text-green-600">
                  ✓ {riversData.features?.length} features
                </span>
              </div>
            )}
            {mode === 'downstream' && flowpathData && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Flowpath:</span>
                  <span className="font-medium text-green-600">
                    ✓ {flowpathData.features?.length} features
                  </span>
                </div>
                {flowpathMessage && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Length:</span>
                    <span className="font-medium text-blue-600">
                      {flowpathMessage.match(/Total length: (\d+ km)/)?.[1] || 'N/A'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {(watershedData || flowpathData) && (
            <button
              onClick={onClearData}
              className="w-full mt-3 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200 border border-red-200 font-medium text-sm"
            >
              Clear Analysis
            </button>
          )}
        </div> */}

        {/* Data Source */}
        <div className="text-xs text-slate-500 text-center py-2 border-t border-slate-200">
          Data source: MERIT-Hydro & GeoServer
        </div>
      </div>
    </div>
  );
};

export default SelectionPanel;