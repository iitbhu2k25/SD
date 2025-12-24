'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { toLonLat } from 'ol/proj';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import VectorSource from 'ol/source/Vector';
import { FaTimes, FaLayerGroup, FaEye, FaEyeSlash } from "react-icons/fa";

import { useMap } from '@/contexts/rsq/drain/MapContext';
import { useLocation } from '@/contexts/rsq/drain/LocationContext';

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

interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  type: 'drainage';
}

// RSQ Legend data based on CGWB classification
const RSQ_LEGEND = [
  { label: 'Safe', color: '#27ae60', range: '≤ 70%' },
  { label: 'Semi-Critical', color: '#f39c12', range: '70-90%' },
  { label: 'Critical', color: '#e74c3c', range: '90-100%' },
  { label: 'Over-Exploited', color: '#c0392b', range: '> 100%' },
  { label: 'No Data', color: '#95a5a6', range: 'N/A' },
];

const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedBaseMap,
    setMapContainer,
    changeBaseMap,
    mapInstance,
    zoomToCurrentExtent,
    showLabels,
    toggleLabels,
  } = useMap();

  // Get drainage system selections from LocationContext
  const {
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedVillages,
  } = useLocation();

  // UI State
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState<boolean>(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState<boolean>(false);
  const [isLegendPanelOpen, setIsLegendPanelOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [scale, setScale] = useState<string>('');
  const [isGroundwaterDisplayed, setIsGroundwaterDisplayed] = useState<boolean>(false);

  // Layer visibility state for drainage system
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    'basin-boundary': true,
    rivers: true,
    stretches: true,
    drains: true,
    catchments: true,
    villages: true,
    groundwater: true
  });

  const basemapPanelRef = useRef<HTMLDivElement>(null);
  const layerPanelRef = useRef<HTMLDivElement>(null);
  const legendPanelRef = useRef<HTMLDivElement>(null);

  // Set map container when ref is available
  useEffect(() => {
    if (mapRef.current) {
      setMapContainer(mapRef.current);
    }
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // Check for groundwater layer
  useEffect(() => {
    if (!mapInstance) return;

    const layers = mapInstance.getAllLayers();
    const groundwaterLayer = layers.find(layer => layer.get('name') === 'groundwater-layer');

    if (groundwaterLayer) {
      setIsGroundwaterDisplayed(true);
      setLayerVisibility(prev => ({ ...prev, groundwater: groundwaterLayer.getVisible() }));
    } else {
      setIsGroundwaterDisplayed(false);
    }
  }, [mapInstance]);

  // Mouse move handler for coordinates
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

  // Close panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (basemapPanelRef.current && !basemapPanelRef.current.contains(event.target as Node)) {
        setIsBasemapPanelOpen(false);
      }
      if (layerPanelRef.current && !layerPanelRef.current.contains(event.target as Node)) {
        setIsLayerPanelOpen(false);
      }
      if (legendPanelRef.current && !legendPanelRef.current.contains(event.target as Node)) {
        setIsLegendPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sync map layer visibility with state changes
  useEffect(() => {
    if (!mapInstance) return;

    const layers = mapInstance.getAllLayers();

    Object.entries(layerVisibility).forEach(([layerId, visible]) => {
      let targetLayer;

      switch (layerId) {
        case 'basin-boundary':
          targetLayer = layers.find(layer => layer.get('name') === 'basin-boundary');
          break;
        case 'rivers':
          targetLayer = layers.find(layer => layer.get('name') === 'rivers');
          break;
        case 'stretches':
          targetLayer = layers.find(layer => layer.get('name') === 'stretches');
          break;
        case 'drains':
          targetLayer = layers.find(layer => layer.get('name') === 'drains');
          break;
        case 'catchments':
          targetLayer = layers.find(layer => layer.get('name') === 'catchments');
          break;
        case 'villages':
          targetLayer = layers.find(layer => layer.get('name') === 'villages');
          break;
        case 'groundwater':
          targetLayer = layers.find(layer => layer.get('name') === 'groundwater-layer');
          break;
      }

      if (targetLayer && targetLayer.getVisible() !== visible) {
        targetLayer.setVisible(visible);
        console.log(`${layerId} layer visibility synced to: ${visible}`);
      }
    });

    mapInstance.render();
  }, [layerVisibility, mapInstance]);

  const handleBaseMapChange = (baseMapKey: string) => {
    changeBaseMap(baseMapKey);
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

  const handleLayerToggle = (layerId: string) => {
    if (!mapInstance) return;

    const newVisibility = !layerVisibility[layerId];
    console.log(`User toggling ${layerId} to: ${newVisibility}`);

    setLayerVisibility(prev => ({ ...prev, [layerId]: newVisibility }));

    const layers = mapInstance.getAllLayers();

    switch (layerId) {
      case 'basin-boundary':
        const basinBoundaryLayer = layers.find(layer => layer.get('name') === 'basin-boundary');
        if (basinBoundaryLayer) {
          basinBoundaryLayer.setVisible(newVisibility);
          console.log(`Basin boundary layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'rivers':
        const riversLayer = layers.find(layer => layer.get('name') === 'rivers');
        if (riversLayer) {
          riversLayer.setVisible(newVisibility);
          console.log(`Rivers layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'stretches':
        const stretchesLayer = layers.find(layer => layer.get('name') === 'stretches');
        if (stretchesLayer) {
          stretchesLayer.setVisible(newVisibility);
          console.log(`Stretches layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'drains':
        const drainsLayer = layers.find(layer => layer.get('name') === 'drains');
        if (drainsLayer) {
          drainsLayer.setVisible(newVisibility);
          console.log(`Drains layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'catchments':
        const catchmentsLayer = layers.find(layer => layer.get('name') === 'catchments');
        if (catchmentsLayer) {
          catchmentsLayer.setVisible(newVisibility);
          console.log(`Catchments layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'villages':
        const villagesLayer = layers.find(layer => layer.get('name') === 'villages');
        if (villagesLayer) {
          villagesLayer.setVisible(newVisibility);
          console.log(`Villages layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'groundwater':
        const groundwaterLayer = layers.find(layer => layer.get('name') === 'groundwater-layer');
        if (groundwaterLayer) {
          groundwaterLayer.setVisible(newVisibility);
          console.log(`Groundwater layer visibility set to: ${newVisibility}`);
        }
        break;
    }

    mapInstance.render();
  };

  const zoomToCurrentLayer = () => {
    if (zoomToCurrentExtent) {
      zoomToCurrentExtent();
    }
  };

  const zoomToGroundwater = () => {
    if (!mapInstance) return;
    const layers = mapInstance.getAllLayers();
    const groundwaterLayer = layers.find(layer => layer.get('name') === 'groundwater-layer');
    if (groundwaterLayer) {
      const source = groundwaterLayer.getSource() as VectorSource;
      if (source) {
        const extent = source.getExtent();
        if (extent) {
          mapInstance.getView().fit(extent, {
            padding: [60, 60, 60, 60],
            duration: 1000,
            maxZoom: 17
          });
        }
      }
    }
  };

  // Get current layers for display
  const getCurrentLayers = (): LayerInfo[] => {
    const layers: LayerInfo[] = [];

    // Always show basin boundary
    layers.push({ id: 'basin-boundary', name: 'Basin Boundary', visible: layerVisibility['basin-boundary'], type: 'drainage' });

    // Always show rivers
    layers.push({ id: 'rivers', name: 'Rivers', visible: layerVisibility.rivers, type: 'drainage' });

    // Show stretches if river is selected
    if (selectedRiver) {
      layers.push({ id: 'stretches', name: 'Stretches', visible: layerVisibility.stretches, type: 'drainage' });
    }

    // Show drains if stretch is selected
    if (selectedStretch) {
      layers.push({ id: 'drains', name: 'Drains', visible: layerVisibility.drains, type: 'drainage' });
    }

    // Show catchments if drain is selected
    if (selectedDrain) {
      layers.push({ id: 'catchments', name: 'Catchments', visible: layerVisibility.catchments, type: 'drainage' });
    }

    // Show villages if villages are chosen
    if (selectedVillages.length > 0) {
      layers.push({ id: 'villages', name: 'Villages', visible: layerVisibility.villages, type: 'drainage' });
    }

    // Show RSQ/Groundwater layer if present
    if (mapInstance) {
      const mapLayers = mapInstance.getAllLayers();
      const groundwaterLayer = mapLayers.find(layer => layer.get('name') === 'groundwater-layer');
      if (groundwaterLayer) {
        layers.push({ id: 'groundwater', name: 'RSQ Analysis', visible: layerVisibility.groundwater, type: 'drainage' });
      }
    }

    return layers;
  };

  const getLayerIcon = (type: string) => {
    return 'M4 4h16v16H4V4zm2 2v12h12V6H6z';
  };

  return (
    <div
      ref={mapContainerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 rounded-lg mr-4 mb-4 overflow-hidden' : 'w-full h-full'}`}
    >
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white shadow-lg">
      <div className="relative w-full h-full" ref={mapRef} />

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

      {/* Layer Control Panel */}
<div className="absolute top-2 left-3 ml-7 z-[10]" ref={layerPanelRef}>
  
  {/* Toggle Button */}
  <button
    onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
    className="bg-white rounded-lg shadow-xl px-3 py-2
               border border-gray-200
               flex items-center gap-2
               hover:bg-gray-50 transition-all"
    title="Layer Controls"
  >
    <FaLayerGroup className="text-blue-600 text-sm" />
    <span className="text-xs font-semibold text-gray-800">Layers</span>
  </button>

  {/* Panel */}
  {isLayerPanelOpen && (
    <div className="absolute top-full left-0 mt-2 w-64
                    bg-white rounded-lg shadow-xl p-2 z-[1001]">

      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <FaLayerGroup className="text-blue-600 text-base" />
          <h3 className="font-semibold text-sm text-gray-800">
            Active Layers
          </h3>
        </div>

        <button
          onClick={() => setIsLayerPanelOpen(false)}
          className="text-gray-500 hover:text-red-600 p-1 transition-colors"
          title="Close panel"
        >
          <FaTimes className="text-sm" />
        </button>
      </div>

      {/* Layers List */}
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {getCurrentLayers().length > 0 ? (
          getCurrentLayers().map((layer) => (
            <div
              key={layer.id}
              className="flex items-center justify-between
                         px-2 py-1 rounded-md
                         hover:bg-gray-100 transition-all"
            >
              {/* Layer Name */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-gray-700">
                  {layer.name}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {(layer.id === "groundwater" ? (
                  <button
                    onClick={zoomToGroundwater}
                    className="p-1 text-gray-500 hover:text-blue-600"
                    title="Zoom"
                  >
                    🔍
                  </button>
                ) : (
                  <button
                    onClick={zoomToCurrentLayer}
                    className="p-1 text-gray-500 hover:text-blue-600"
                    title="Zoom"
                  >
                    🔍
                  </button>
                ))}

                <button
                  onClick={() => handleLayerToggle(layer.id)}
                  className={`p-1 rounded-full transition-all text-xs ${
                    layer.visible
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                  }`}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
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
</div>


      {/* Legend Control Panel */}
      <div className="absolute bottom-27 right-4 z-[10]" ref={legendPanelRef}>
        <button
          onClick={() => setIsLegendPanelOpen(!isLegendPanelOpen)}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
          title="Toggle Legend"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Legend</span>
        </button>

        {isLegendPanelOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-72 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001] max-h-80 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Map Legend</h3>

              {/* RSQ Legend */}
              {mapInstance && (() => {
                const layers = mapInstance.getAllLayers();
                const groundwaterLayer = layers.find(layer => layer.get('name') === 'groundwater-layer');
                return groundwaterLayer && layerVisibility.groundwater !== false;
              })() && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">RSQ Classification</h4>
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

              {/* Drainage system legend */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-gray-600 mb-2">Drainage System</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-black bg-gray-100" />
                    <span className="text-xs text-gray-700">Basin Boundary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-blue-700" />
                    <span className="text-xs text-gray-700">Rivers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-purple-600" />
                    <span className="text-xs text-gray-700">Stretches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-green-600" />
                    <span className="text-xs text-gray-700">Drains</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-red-600 bg-red-100" />
                    <span className="text-xs text-gray-700">Catchments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-orange-500 bg-orange-100" />
                    <span className="text-xs text-gray-700">Villages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                    <span className="text-xs text-gray-700">Selected Stretch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white" />
                    <span className="text-xs text-gray-700">Selected Drain</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 z-[10] flex flex-col gap-2">
        {/* Labels Toggle Button */}
        <button
          onClick={toggleLabels}
          className={`bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200 ${showLabels ? 'bg-blue-50 border-blue-300' : ''}`}
          title={showLabels ? "Hide Labels" : "Show Labels"}
        >
          <svg className={`w-5 h-5 ${showLabels ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isFullscreen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            )}
          </svg>
        </button>
      </div>

      {/* Coordinates and Scale Display */}
      <div className="absolute bottom-4 left-4 z-[10] bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg p-3 shadow-lg">
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
    </div>
    </div>
  );
};

export default MapComponent;