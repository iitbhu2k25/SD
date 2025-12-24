'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useMapContext } from '@/contexts/rsq/admin/MapContext';
import { FaEye, FaEyeSlash, FaLayerGroup, FaMapMarkerAlt, FaGlobe, FaTractor, FaBuilding, FaRegDotCircle, FaTint, FaTimes, FaExpand, FaCompress, FaMap } from 'react-icons/fa';
import { toLonLat } from 'ol/proj';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import 'ol/ol.css';

// Define a map for professional-looking icons
const layerIcons: Record<string, React.ReactElement> = {
  india: <FaGlobe className="text-red-500" />,
  state: <FaMapMarkerAlt className="text-blue-500" />,
  district: <FaRegDotCircle className="text-green-600" />,
  block: <FaBuilding className="text-yellow-600" />,
  village: <FaTractor className="text-gray-500" />,
  groundwater: <FaTint className="text-blue-600" />,
};

// Base maps configuration
const baseMapNames: Record<string, { name: string; icon: string }> = {
  osm: {
    name: 'OpenStreetMap',
    icon: 'M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146',
  },
  terrain: {
    name: 'Stamen Terrain',
    icon: 'M14 11l4-8H6l4 8H6l6 10 6-10h-4z',
  },
  cartoLight: {
    name: 'Carto Light',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
  satellite: {
    name: 'Satellite',
    icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  },
  topo: {
    name: 'Topographic',
    icon: 'M7 14l5-5 5 5',
  }
};

// RSQ Legend data based on CGWB classification
const RSQ_LEGEND = [
  { label: 'Safe', color: '#27ae60', range: '≤ 70%' },
  { label: 'Semi-Critical', color: '#f39c12', range: '70-90%' },
  { label: 'Critical', color: '#6006cd', range: '90-100%' },
  { label: 'Over-Exploited', color: '#c0392b', range: '> 100%' },
  { label: 'No Data', color: '#95a5a6', range: 'N/A' },
];

const Map: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const {
    setMapContainer,
    error,
    isLoading,
    showLabels,
    toggleLabels,
    toggleLayerVisibility,
    layerVisibility = {},
    activeLayers = {},
    selectedBaseMap = 'osm', // Default basemap
    changeBaseMap, // You'll need to add this to your MapContext
    mapInstance, // You'll need to expose this from MapContext
  } = useMapContext();

  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showLegendPanel, setShowLegendPanel] = useState(true);
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [scale, setScale] = useState<string>('');

  const basemapPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapRef.current) {
      setMapContainer(mapRef.current);
    }
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // Mouse move handler for coordinates and scale
  useEffect(() => {
    if (!mapInstance) return;

    const handlePointerMove = (event: any) => {
      const coordinate = mapInstance.getEventCoordinate(event.originalEvent);
      if (coordinate) {
        const lonLat = toLonLat(coordinate);
        setCoordinates({
          lon: parseFloat(lonLat[0].toFixed(6)),
          lat: parseFloat(lonLat[1].toFixed(6))
        });
      }
    };

    const handleMoveEnd = () => {
      const view = mapInstance.getView();
      const resolution = view.getResolution();
      if (resolution) {
        const units = view.getProjection().getUnits();
        const dpi = 25.4 / 0.28;
        const mpu = METERS_PER_UNIT[units as keyof typeof METERS_PER_UNIT];
        const scaleValue = Math.round(resolution * mpu * 39.37 * dpi);
        setScale(`1:${scaleValue.toLocaleString()}`);
      }
    };

    mapInstance.on('pointermove', handlePointerMove);
    mapInstance.on('moveend', handleMoveEnd);
    handleMoveEnd();

    return () => {
      mapInstance.un('pointermove', handlePointerMove);
      mapInstance.un('moveend', handleMoveEnd);
    };
  }, [mapInstance]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Close basemap panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (basemapPanelRef.current && !basemapPanelRef.current.contains(event.target as Node)) {
        setIsBasemapPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBaseMapChange = (baseMapKey: string) => {
    if (changeBaseMap) {
      changeBaseMap(baseMapKey);
    }
    setIsBasemapPanelOpen(false);
  };

  const toggleFullscreen = async () => {
    if (!mapContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log('Error toggling fullscreen:', error);
    }
  };

  // Define all possible layers with proper labels
  const allLayers = [
    { key: 'india', label: 'India Boundary' },
    { key: 'state', label: 'State Boundary' },
    { key: 'district', label: 'District Boundaries' },
    { key: 'block', label: 'Block Boundaries' },
    { key: 'village', label: 'Village Boundaries' },
    { key: 'groundwater', label: 'RSQ Analysis' },
  ];

  // Filter layers based on which ones are active on the map AND sort them for logical display
  const visibleLayers = allLayers
    .filter(layer => activeLayers[layer.key])
    .sort((a, b) => {
      const order = ['india', 'state', 'district', 'block', 'village', 'groundwater'];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });

  if (error) {
    return (
      <div className="w-full h-screen bg-red-50 border-2 border-red-200 rounded-xl shadow-lg flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️ Map Error</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg">
            Reload Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`relative w-full h-screen bg-gray-100 px-2 sm:px-3 py-3 ${isFullscreen ? 'fixed inset-0 z-50 rounded-lg mr-4 mb-4 overflow-hidden' : ''
        }`}
    >
      {/* MAP WRAPPER (adds margin + rounding) */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white shadow-lg">

        {/* Map Container */}
        <div ref={mapRef} className="w-full h-full" />

        {/* Basemap Selector - TOP RIGHT */}
        <div className="absolute top-2 right-4 z-[10]" ref={basemapPanelRef}>
          <button
            onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
            className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
            title="Change Base Map"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMapNames[selectedBaseMap]?.icon} />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {baseMapNames[selectedBaseMap]?.name ?? "OpenStreet"}
            </span>


            <svg
              className={`w-4 h-4 text-gray-600 transition-transform ${isBasemapPanelOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isBasemapPanelOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001]">
              <div className="p-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Select Base Map</h3>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(baseMapNames).map(([key, baseMap]) => (
                    <button
                      key={key}
                      onClick={() => handleBaseMapChange(key)}
                      className={`flex items-center gap-3 w-full p-3 rounded-md text-left transition-colors duration-200 ${selectedBaseMap === key
                        ? 'bg-blue-50 border border-blue-200 text-blue-700'
                        : 'hover:bg-gray-50 border border-transparent text-gray-700'
                        }`}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                      </svg>
                      <span className="text-sm font-medium">{baseMap.name}</span>
                      {selectedBaseMap === key && (
                        <svg className="w-4 h-4 text-blue-600 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer Control Panel - LEFT SIDE */}
        {showLayerPanel && (
          <div className="absolute top-2 left-3 ml-6 bg-white rounded-lg shadow-xl p-2 z-10 w-64">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <div className="flex items-center gap-2">
                <FaLayerGroup className="text-blue-600 text-base" />
                <h3 className="font-semibold text-sm text-gray-800">
                  Active Layers
                </h3>
              </div>
              <button
                onClick={() => setShowLayerPanel(false)}
                className="text-gray-500 hover:text-red-600 p-1 transition-colors"
                title="Close panel"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>

            {/* Layers List */}
            <div className="space-y-1">
              {visibleLayers.length > 0 ? (
                visibleLayers.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm">{layerIcons[key]}</span>
                      <span className="text-xs font-medium text-gray-700">
                        {label}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleLayerVisibility(key)}
                      className={`p-1 rounded-full transition-all text-xs ${layerVisibility[key] === undefined || layerVisibility[key] === true
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                        }`}
                      title={
                        layerVisibility[key] === undefined || layerVisibility[key] === true
                          ? "Hide layer"
                          : "Show layer"
                      }
                    >
                      {layerVisibility[key] === undefined || layerVisibility[key] === true ? <FaEye /> : <FaEyeSlash />}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-1">
                  No layers loaded
                </p>
              )}
            </div>
          </div>
        )}

        {/* RSQ Legend - BOTTOM LEFT */}
        {activeLayers.groundwater &&
          layerVisibility.groundwater !== false &&
          showLegendPanel && (
            <div className="absolute bottom-4 right-15 bg-white rounded-lg shadow-xl p-3 z-10 w-56">
              <div className="flex items-center justify-between mb-2 pb-2 border-b">
                <h3 className="font-semibold text-xs text-gray-800">
                  RSQ Classification
                </h3>
                <button
                  onClick={() => setShowLegendPanel(false)}
                  className="text-gray-500 hover:text-red-600 p-1 transition-colors"
                  title="Close legend"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>

              <div className="space-y-1.5">
                {RSQ_LEGEND.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-gray-300"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <div className="text-xs font-medium text-gray-800">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.range}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-gray-500 italic">
                  Stage of Ground Water Extraction
                </p>
              </div>
            </div>
          )}

        {/* Show Layers Button */}
        {!showLayerPanel && (
          <div className="absolute top-2 left-10 z-10">
            <button
              onClick={() => setShowLayerPanel(true)}
              className="bg-white rounded-lg shadow-xl p-2 hover:bg-blue-50 transition-all"
              title="Show layers panel"
            >
              <FaLayerGroup className="text-blue-600 text-base" />
            </button>
          </div>
        )}

        {/* Show Legend Box */}
        {activeLayers.groundwater &&
          layerVisibility.groundwater !== false &&
          !showLegendPanel && (
            <div className="absolute bottom-15 right-4 z-10">
              <div
                onClick={() => setShowLegendPanel(true)}
                className="
          cursor-pointer
          bg-white
          border border-blue-200
          rounded-xl
          shadow-lg
          px-4
          py-2
          flex items-center gap-2
          hover:bg-blue-50
          transition-all
        "
                title="Show Groundwater Legend"
              >
                {/* <FaTint className="text-blue-600 text-sm" /> */}
                <span className="text-sm font-semibold text-blue-700">
                  Legend
                </span>
              </div>
            </div>
          )}

        {/* Map Controls - BOTTOM RIGHT */}
        <div className="absolute bottom-4 right-4 z-[10] flex flex-col gap-2">

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <FaCompress className="w-5 h-5 text-gray-600" />
            ) : (
              <FaExpand className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Coordinates and Scale Display - BOTTOM LEFT */}
        <div className="absolute bottom-4 left-3 z-[10] bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg p-3 shadow-lg">
          <div className="space-y-1 text-xs">
            {coordinates && (
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700">
                  {coordinates.lat.toFixed(6)}°, {coordinates.lon.toFixed(6)}°
                </span>
              </div>
            )}
            {scale && (
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-gray-700">Scale: {scale}</span>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg z-20">
            <span className="text-sm font-medium">
              Loading layers...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Map;