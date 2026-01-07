'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'ol/ol.css';
import { useMap } from '@/contexts/surfacewater_assessment/admin/MapContext';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

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


const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { 
    selectedBaseMap,
    changeBaseMap,
    setMapContainer, 
    mapInstance, 
    isLoading, 
    error, 
    showLabels, 
    toggleLabels 
  } = useMap();
  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    states,
    selectionConfirmed, // updated: use admin flag
  } = useLocationContext();
  const [isFs, setIsFs] = useState(false);
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState<boolean>(false);
   const basemapPanelRef = useRef<HTMLDivElement>(null);
  
  // Hand off the container to MapContext
  useEffect(() => {
    if (mapRef.current) setMapContainer(mapRef.current);
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // Track fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as any);
    document.addEventListener('mozfullscreenchange', onFsChange as any);
    document.addEventListener('MSFullscreenChange', onFsChange as any);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as any);
      document.removeEventListener('mozfullscreenchange', onFsChange as any);
      document.removeEventListener('MSFullscreenChange', onFsChange as any);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      // @ts-ignore
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (!isFull) {
        // @ts-ignore
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        await req.call(el);
      } else {
        // @ts-ignore
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        await exit.call(document);
      }
    } catch {
      // no-op
    }
  }, []);

  // Optional status line about current selection
  const getSelectionStatus = () => {
    const stateName = states.find((s) => s.id === selectedState)?.name || 'Unknown';
    if (selectedSubDistricts.length > 0) {
      return `${stateName} • ${selectedDistricts.length} Districts • ${selectedSubDistricts.length} Subdistricts`;
    }
    if (selectedDistricts.length > 0) {
      return `${stateName} • ${selectedDistricts.length} Districts`;
    }
    if (selectedState) {
      return stateName;
    }
    return 'No selection';
  };

  const handleBaseMapChange = (baseMapKey: string) => {
    changeBaseMap(baseMapKey);
    setIsBasemapPanelOpen(false);
  };

  return (
    <div ref={wrapRef} className="map-container relative w-full h-full bg-gray-100">
      {!mapInstance && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="text-gray-600 mb-2">
              {isLoading ? 'Loading map...' : error || 'Initializing...'}
            </div>
            {isLoading && (
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            )}
          </div>
        </div>
      )}
{/* Basemap Selector */}
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
            {baseMapNames[selectedBaseMap]?.name}
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
      {/* Controls */}
      <div className="absolute top-3 left-10 z-20 flex gap-2">
        <button
          onClick={toggleLabels}
          className={`bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200 ${
            showLabels ? 'bg-blue-50 border-blue-300' : ''
          }`}
          title={showLabels ? 'Hide Labels' : 'Show Labels'}
          disabled={!mapInstance}
        >
          <svg
            className={`w-5 h-5 ${showLabels ? 'text-blue-600' : 'text-gray-600'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
          title={isFs ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFs ? (
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7h4V3M17 7h-4V3M7 17h4v4M17 17h-4v4" />
            </svg>
          )}
        </button>
      </div>

      {/* Map target; minHeight guards zero-height cases */}
      <div ref={mapRef} className="relative w-full h-full" style={{ minHeight: '700px' }} />
    </div>
  );
};

export default MapComponent;
