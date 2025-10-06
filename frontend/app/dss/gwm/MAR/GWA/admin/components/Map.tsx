'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { toLonLat } from 'ol/proj';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import VectorSource from 'ol/source/Vector';
import { useMap } from '@/contexts/groundwater_assessment/admin/MapContext';
import { useLocation } from '@/contexts/groundwater_assessment/admin/LocationContext';

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
  type: 'boundary' | 'raster' | 'wells' | 'village-overlay' | 'contour';
}

const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedBaseMap,
    setMapContainer,
    changeBaseMap,
    isRasterDisplayed,
    isContourDisplayed,
    mapInstance,
    zoomToCurrentExtent,
    isVillageOverlayVisible,
    toggleVillageOverlay,
    removeContourLayer,
    isTrendDisplayed,
    removeTrendLayer,
    legendData,
    isGsrDisplayed,
    // NEW: Opacity controls
    layerOpacities,
    setLayerOpacity,
    resetAllOpacities
  } = useMap();

  const { selectedState, selectedDistricts, selectedSubDistricts } = useLocation();

  // UI State
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState<boolean>(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState<boolean>(false);
  const [isLegendPanelOpen, setIsLegendPanelOpen] = useState<boolean>(false);
  const [isOpacityPanelOpen, setIsOpacityPanelOpen] = useState<boolean>(false); // NEW: Opacity panel
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [scale, setScale] = useState<string>('');

  // Layer visibility state
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    india: true,
    state: true,
    district: true,
    villages: true,
    'manual-wells': true,
    raster: true,
    'village-overlay': true,
    contours: true,
    gsr: true,
    'trend-wells': true
  });

  const basemapPanelRef = useRef<HTMLDivElement>(null);
  const layerPanelRef = useRef<HTMLDivElement>(null);
  const legendPanelRef = useRef<HTMLDivElement>(null);
  const opacityPanelRef = useRef<HTMLDivElement>(null); // NEW: Opacity panel ref

  // Set map container when ref is available
  useEffect(() => {
    if (mapRef.current) {
      setMapContainer(mapRef.current);
    }
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // Sync layer visibility with MapContext
  useEffect(() => {
    setLayerVisibility(prev => ({
      ...prev,
      'village-overlay': isVillageOverlayVisible,
      contours: isContourDisplayed
    }));

    if (mapInstance && isRasterDisplayed) {
      const layers = mapInstance.getAllLayers();
      const rasterLayer = layers.find(layer => layer.get('type') === 'raster');
      if (rasterLayer) {
        setLayerVisibility(prev => ({ ...prev, raster: rasterLayer.getVisible() }));
      }
    }
  }, [isVillageOverlayVisible, isRasterDisplayed, isContourDisplayed, mapInstance]);

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
      // NEW: Close opacity panel
      if (opacityPanelRef.current && !opacityPanelRef.current.contains(event.target as Node)) {
        setIsOpacityPanelOpen(false);
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

  // Auto-hide other layers when trend layer loads
  useEffect(() => {
    if (isTrendDisplayed) {
      setLayerVisibility(prev => ({
        ...prev,
        india: false,
        state: false,
        district: false,
        villages: false,
        'manual-wells': false,
        raster: false,
        'village-overlay': false,
        contours: false,
        gsr: false,
        'trend-wells': true
      }));
    }
  }, [isTrendDisplayed]);

  // Auto-hide other layers when GSR layer loads
  useEffect(() => {
    if (isGsrDisplayed) {
      setLayerVisibility(prev => ({
        ...prev,
        india: false,
        state: false,
        district: false,
        villages: false,
        'manual-wells': false,
        raster: false,
        'village-overlay': false,
        contours: false,
        'trend-wells': false,
        gsr: true
      }));
    }
  }, [isGsrDisplayed]);


  useEffect(() => {
    if (!mapInstance) return;

    // When raster is displayed, hide other layers including GSR
    if (isRasterDisplayed) {
      console.log("Raster layer loaded - hiding other layers including GSR");
      setLayerVisibility(prev => ({
        ...prev,
        'basin-boundary': false,
        rivers: false,
        stretches: false,
        drains: false,
        catchments: false,
        villages: false,
        'manual-wells': false,
        'village-overlay': false,
        contours: true,
        'trend-wells': false,
        gsr: false,  // Hide GSR when raster loads
        raster: true, // Show raster
      }));
    }
  }, [isRasterDisplayed, mapInstance]);

  // Sync layer visibility changes with the map
  useEffect(() => {
    if (!mapInstance) return;

    const layers = mapInstance.getAllLayers();

    Object.entries(layerVisibility).forEach(([layerId, visible]) => {
      let targetLayer;

      switch (layerId) {
        case 'india':
          targetLayer = layers.find(layer => layer.get('name') === 'india');
          break;
        case 'state':
          targetLayer = layers.find(layer => layer.get('name') === 'state');
          break;
        case 'district':
          targetLayer = layers.find(layer => layer.get('name') === 'district');
          break;
        case 'villages':
          targetLayer = layers.find(layer => layer.get('name') === 'villages');
          break;
        case 'manual-wells':
          targetLayer = layers.find(layer => layer.get('name') === 'manual-wells');
          break;
        case 'raster':
          targetLayer = layers.find(layer => layer.get('type') === 'raster');
          break;
        case 'contours':
          targetLayer = layers.find(layer => layer.get('type') === 'contour');
          break;
        case 'trend-wells':
          targetLayer = layers.find(layer => layer.get('type') === 'trend');
          break;
        case 'gsr':
          targetLayer = layers.find(layer => layer.get('type') === 'gsr');
          break;
      }

      if (targetLayer && targetLayer.getVisible() !== visible) {
        targetLayer.setVisible(visible);
      }
    });

    if (layerVisibility['village-overlay'] !== isVillageOverlayVisible) {
      const villageOverlayLayer = layers.find(layer => layer.get('name') === 'village-overlay');
      if (villageOverlayLayer) {
        villageOverlayLayer.setVisible(layerVisibility['village-overlay']);
      }
    }

    mapInstance.render();
  }, [layerVisibility, mapInstance, isVillageOverlayVisible]);

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
    setLayerVisibility(prev => ({ ...prev, [layerId]: newVisibility }));

    const layers = mapInstance.getAllLayers();

    switch (layerId) {
      case 'raster':
        const rasterLayer = layers.find(layer => layer.get('type') === 'raster');
        if (rasterLayer) {
          rasterLayer.setVisible(newVisibility);
          console.log(`Raster layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'contours':
        const contourLayer = layers.find(layer => layer.get('type') === 'contour');
        if (contourLayer) {
          contourLayer.setVisible(newVisibility);
          console.log(`Contour layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'india':
        const indiaLayer = layers.find(layer => layer.get('name') === 'india');
        if (indiaLayer) {
          indiaLayer.setVisible(newVisibility);
          console.log(`India layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'state':
        const stateLayer = layers.find(layer => layer.get('name') === 'state');
        if (stateLayer) {
          stateLayer.setVisible(newVisibility);
          console.log(`State layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'district':
        const districtLayer = layers.find(layer => layer.get('name') === 'district');
        if (districtLayer) {
          districtLayer.setVisible(newVisibility);
          console.log(`District layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'villages':
        const villageLayer = layers.find(layer => layer.get('name') === 'villages');
        if (villageLayer) {
          villageLayer.setVisible(newVisibility);
          console.log(`Villages layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'manual-wells':
        const manualWellLayer = layers.find(layer => layer.get('name') === 'manual-wells');
        if (manualWellLayer) {
          manualWellLayer.setVisible(newVisibility);
          console.log(`Manual wells layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'village-overlay':
        if (newVisibility !== isVillageOverlayVisible) {
          toggleVillageOverlay();
        }
        console.log(`Village overlay toggled to: ${newVisibility}`);
        break;
      case 'trend-wells':
        const trendLayer = layers.find(layer => layer.get('type') === 'trend');
        if (trendLayer) {
          trendLayer.setVisible(newVisibility);
          console.log(`Trend wells layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'gsr':
        const gsrLayer = layers.find(layer => layer.get('type') === 'gsr');
        if (gsrLayer) {
          gsrLayer.setVisible(newVisibility);
          console.log(`GSR layer visibility set to: ${newVisibility}`);
        }
        break;
    }

    mapInstance.render();
  };

  const zoomToVillages = () => {
    if (zoomToCurrentExtent) {
      zoomToCurrentExtent();
    }
  };

  const zoomToGsr = () => {
    if (!mapInstance || !isGsrDisplayed) return;
    const layers = mapInstance.getAllLayers();
    const gsrLayer = layers.find(layer => layer.get('type') === 'gsr');
    if (gsrLayer) {
      const source = gsrLayer.getSource() as VectorSource;
      if (source) {
        const extent = source.getExtent();
        if (extent) {
          mapInstance.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
        }
      }
    }
  };

  const zoomToRaster = () => {
    if (mapInstance && isRasterDisplayed) {
      const layers = mapInstance.getAllLayers();
      const rasterLayer = layers.find(layer => layer.get('type') === 'raster');
      if (rasterLayer) {
        const extent = rasterLayer.getExtent();
        if (extent) {
          mapInstance.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000
          });
        }
      }
    }
  };

  const zoomToContours = () => {
    if (mapInstance && isContourDisplayed) {
      const layers = mapInstance.getAllLayers();
      const contourLayer = layers.find(layer => layer.get('type') === 'contour');
      if (contourLayer) {
        const source = contourLayer.getSource() as VectorSource;
        if (source) {
          const extent = source.getExtent();
          if (extent) {
            mapInstance.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000
            });
          }
        }
      }
    }
  };

  const getContourColor = (elevation: number, minElevation: number, maxElevation: number) => {
    const normalizedElevation = (elevation - minElevation) / (maxElevation - minElevation);
    const red = Math.round(255 * normalizedElevation);
    const blue = Math.round(255 * (1 - normalizedElevation));
    const green = Math.round(128 * (1 - Math.abs(normalizedElevation - 0.5) * 2));
    return `rgb(${red}, ${green}, ${blue})`;
  };

  const removeContours = () => {
    if (removeContourLayer) {
      removeContourLayer();
      setLayerVisibility(prev => ({ ...prev, contours: false }));
    }
  };

  const getCurrentLayers = (): LayerInfo[] => {
    const layers: LayerInfo[] = [
      { id: 'india', name: 'India Boundary', visible: layerVisibility.india, type: 'boundary' }
    ];

    if (selectedSubDistricts.length > 0) {
      layers.push({ id: 'villages', name: 'Villages', visible: layerVisibility.villages, type: 'boundary' });
      layers.push({ id: 'manual-wells', name: 'Manual Wells', visible: layerVisibility['manual-wells'], type: 'wells' });
    }

    if (isRasterDisplayed) {
      layers.push({ id: 'raster', name: 'Raster Layer', visible: layerVisibility.raster, type: 'raster' });
      if (selectedSubDistricts.length > 0) {
        layers.push({ id: 'village-overlay', name: 'Village Overlay', visible: layerVisibility['village-overlay'], type: 'village-overlay' });
      }
    }

    if (isContourDisplayed) {
      layers.push({ id: 'contours', name: 'Contour Lines', visible: layerVisibility.contours, type: 'contour' });
    }

    if (isTrendDisplayed) {
      layers.push({ id: 'trend-wells', name: 'Trend Wells', visible: layerVisibility['trend-wells'], type: 'wells' });
    }
    if (isGsrDisplayed) {
      layers.push({ id: 'gsr', name: 'GSR Polygons', visible: layerVisibility.gsr, type: 'boundary' });
    }

    return layers;
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'boundary':
        return 'M4 4h16v16H4V4zm2 2v12h12V6H6z';
      case 'raster':
        return 'M3 3h18v18H3V3zm2 2v14h14V5H5z';
      case 'wells':
        return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
      case 'village-overlay':
        return 'M4 4h16v16H4V4zm2 2v12h12V6H6z';
      case 'contour':
        return 'M3 12h18m-9-9v18';
      default:
        return 'M4 4h16v16H4V4z';
    }
  };

  // NEW: Opacity control configuration
  const opacityLayerConfig = [
    {
      key: 'basemap' as const,
      label: 'Base Map',
      visible: true,
      description: 'Background map layer'
    },
    {
      key: 'boundaries' as const,
      label: 'Boundaries',
      visible: true,
      description: 'Administrative boundaries'
    },
    {
      key: 'raster' as const,
      label: 'Raster Data',
      visible: isRasterDisplayed,
      description: 'Raster overlay data'
    },
    {
      key: 'contour' as const,
      label: 'Contours',
      visible: isContourDisplayed,
      description: 'Contour lines'
    },
    {
      key: 'trend' as const,
      label: 'Trend Analysis',
      visible: isTrendDisplayed,
      description: 'Trend analysis data'
    },
    {
      key: 'gsr' as const,
      label: 'GSR Classification',
      visible: isGsrDisplayed,
      description: 'Groundwater resource classification'
    },
    {
      key: 'wellPoints' as const,
      label: 'Well Points',
      visible: true,
      description: 'Well point locations'
    },
    {
      key: 'villageOverlay' as const,
      label: 'Village Overlay',
      visible: isVillageOverlayVisible,
      description: 'Village boundaries overlay'
    }
  ];

  // NEW: Helper function to get opacity percentage
  const getOpacityPercentage = (value: number) => `${value * 10}%`;

  return (
    <div
      ref={mapContainerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'}`}
    >
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
      <div className="absolute top-2 left-9 z-[10]" ref={layerPanelRef}>
        <button
          onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
          title="Layer Controls"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Layers</span>
        </button>

        {isLayerPanelOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001]">
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Map Layers</h3>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {getCurrentLayers().map((layer) => (
                  <div key={layer.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLayerIcon(layer.type)} />
                      </svg>
                      <span className="text-sm text-gray-700">{layer.name}</span>
                    </div>
                    {layer.id === 'gsr' && (
                      <button
                        onClick={zoomToGsr}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Zoom to GSR extent"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      {(layer.type === 'boundary' || layer.type === 'village-overlay') && selectedSubDistricts.length > 0 && (
                        <button
                          onClick={zoomToVillages}
                          className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Zoom to extent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      )}
                      {layer.type === 'raster' && (
                        <button
                          onClick={zoomToRaster}
                          className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                          title="Zoom to raster extent"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      )}
                      {layer.type === 'contour' && (
                        <>
                          <button
                            onClick={zoomToContours}
                            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Zoom to contour extent"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={removeContours}
                            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                            title="Remove contour layer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      {layer.type === 'wells' && layer.id === 'trend-wells' && (
                        <button
                          onClick={() => {
                            removeTrendLayer();
                            setLayerVisibility(prev => ({ ...prev, 'trend-wells': false }));
                          }}
                          className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                          title="Remove trend wells"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={() => handleLayerToggle(layer.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Opacity Control Panel */}
      <div className="absolute top-16 left-9 z-[10]" ref={opacityPanelRef}>
        <button
          onClick={() => setIsOpacityPanelOpen(!isOpacityPanelOpen)}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
          title="Layer Opacity Controls"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Opacity</span>
        </button>

        {isOpacityPanelOpen && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001]">
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Layer Opacity</h3>
                <button
                  onClick={resetAllOpacities}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                  title="Reset all opacities to default"
                >
                  Reset All
                </button>
              </div>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {opacityLayerConfig
                  .filter(layer => layer.visible)
                  .map((layer) => (
                    <div key={layer.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <label className="text-sm font-medium text-gray-700">
                              {layer.label}
                            </label>
                            <p className="text-xs text-gray-500">{layer.description}</p>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {getOpacityPercentage(layerOpacities[layer.key])}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-4">1</span>
                        <div className="flex-1 relative">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={layerOpacities[layer.key]}
                            onChange={(e) => setLayerOpacity(layer.key, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(layerOpacities[layer.key] - 1) * 11.11}%, #E5E7EB ${(layerOpacities[layer.key] - 1) * 11.11}%, #E5E7EB 100%)`
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-6">10</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend Control Panel */}
      <div className="absolute bottom-20 right-4 z-[10]" ref={legendPanelRef}>
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

        {isLegendPanelOpen && (legendData?.raster || legendData?.contour || legendData?.trend) && (
          <div className="absolute bottom-full right-0 mb-2 w-72 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001] max-h-80 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Map Legend</h3>

              {legendData?.raster && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">
                    Raster: {legendData.raster.parameter.toUpperCase()}
                  </h4>
                  <div className="space-y-1">
                    {legendData.raster.colors.map((color, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-gray-700">
                          {legendData?.raster && legendData.raster.colors.length === legendData.raster.labels.length && (
                            legendData.raster.labels[index]
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {legendData?.contour && (
                <div>
                  <h4 className="text-xs font-medium text-gray-600 mb-2">
                    Contours (Elevation)
                  </h4>
                  <div className="space-y-1">
                    {(() => {
                      const { minElevation, maxElevation, interval } = legendData.contour;
                      const steps = Math.floor((maxElevation - minElevation) / interval) + 1;
                      const elevationLevels = Array.from(
                        { length: steps },
                        (_, i) => minElevation + i * interval
                      ).filter((elev) => elev <= maxElevation);

                      return elevationLevels.map((elevation, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{
                              backgroundColor: getContourColor(
                                elevation,
                                minElevation,
                                maxElevation
                              ),
                            }}
                          />
                          <span className="text-xs text-gray-700">
                            {elevation.toFixed(2)} m
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {legendData?.gsr && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">GSR Classification</h4>
                  <div className="space-y-1">
                    {legendData.gsr.classes.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-gray-700">{entry.label}{typeof entry.count === 'number' ? ` (${entry.count})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {legendData?.trend && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-600 mb-2">Trend Wells</h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <span className="text-xs text-gray-700">Increasing Trend</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-700">Decreasing Trend</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gray-500" />
                      <span className="text-xs text-gray-700">No Trend</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-yellow-500" />
                      <span className="text-xs text-gray-700">Insufficient Data</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Total Wells: {legendData.trend.totalWells}</p>
                    <p>Significant: {legendData.trend.significant}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 z-[10] flex flex-col gap-2">
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
  );
};

export default MapComponent;