import React from 'react';
import { X, Palette } from 'lucide-react';
import { MapSettings, BaseMapType } from './type';

interface SettingsPanelProps {
  settings: MapSettings;
  onSettingsChange: (settings: Partial<MapSettings>) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onClose,
}) => {
  const baseMapOptions: { value: BaseMapType; label: string; preview: string }[] = [
    { value: 'osm', label: 'OpenStreetMap', preview: 'Standard street map with labels' },
    { value: 'satellite', label: 'Satellite', preview: 'High-resolution satellite imagery' },
    { value: 'terrain', label: 'Terrain', preview: 'Topographic relief map' },
    { value: 'dark', label: 'Dark Mode', preview: 'Dark themed base map' },
  ];

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Customize View</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">Adjust map appearance</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Base Map Selection */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Base Map</h3>
          <div className="space-y-2">
            {baseMapOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onSettingsChange({ baseMap: option.value })}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  settings.baseMap === option.value
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-slate-200 hover:border-purple-300 bg-white'
                }`}
              >
                <div className="font-medium text-slate-800">{option.label}</div>
                <div className="text-xs text-slate-500 mt-1">{option.preview}</div>
              </button>
            ))}
          </div>
        </div>

        {/* River Styling */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
            </div>
            <span>River Network</span>
          </h3>
          
          <div className="space-y-4">
            {/* Color */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                River Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={settings.riverColor}
                  onChange={(e) => onSettingsChange({ riverColor: e.target.value })}
                  className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.riverColor}
                  onChange={(e) => onSettingsChange({ riverColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Opacity: {(settings.riverOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.riverOpacity}
                onChange={(e) => onSettingsChange({ riverOpacity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Thickness */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Line Thickness: {settings.riverThickness.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={settings.riverThickness}
                onChange={(e) => onSettingsChange({ riverThickness: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <div className="text-xs font-medium text-slate-600 mb-2">Preview:</div>
              <svg width="100%" height="40" className="bg-slate-50 rounded">
                <line
                  x1="10"
                  y1="20"
                  x2="90%"
                  y2="20"
                  stroke={settings.riverColor}
                  strokeWidth={settings.riverThickness * 2}
                  opacity={settings.riverOpacity}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Watershed Styling */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center space-x-2">
            <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <span>Watershed Boundary</span>
          </h3>
          
          <div className="space-y-4">
            {/* Color */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Boundary Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={settings.watershedColor}
                  onChange={(e) => onSettingsChange({ watershedColor: e.target.value })}
                  className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.watershedColor}
                  onChange={(e) => onSettingsChange({ watershedColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Line Opacity: {(settings.watershedOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.watershedOpacity}
                onChange={(e) => onSettingsChange({ watershedOpacity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            {/* Fill Opacity */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Fill Opacity: {(settings.watershedFillOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={settings.watershedFillOpacity}
                onChange={(e) => onSettingsChange({ watershedFillOpacity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg p-3 border border-red-200">
              <div className="text-xs font-medium text-slate-600 mb-2">Preview:</div>
              <svg width="100%" height="60" viewBox="0 0 100 60" className="bg-slate-50 rounded">
                <polygon
                  points="20,10 80,10 90,50 10,50"
                  stroke={settings.watershedColor}
                  strokeWidth="4"
                  fill="white"
                  opacity={settings.watershedOpacity}
                  fillOpacity={settings.watershedFillOpacity}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => {
            onSettingsChange({
              riverColor: '#3b82f6',
              riverOpacity: 0.9,
              riverThickness: 2,
              watershedColor: '#ef4444',
              watershedOpacity: 0.7,
              watershedFillOpacity: 0.1,
              baseMap: 'osm',
            });
          }}
          className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300 font-medium"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;