'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { toLonLat } from 'ol/proj';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import VectorSource from 'ol/source/Vector';
import { useMap } from '@/contexts/groundwater_assessment/admin/MapContext';
import { useLocation } from '@/contexts/groundwater_assessment/admin/LocationContext';
import MapHeaderControls from '@/components/dss_common/MapHeaderControls';
import BaseMaps from '@/components/dss_common/BaseMaps';
import CloseIcon from '@/components/dss_common/CloseIcon';
import { baseMaps } from '@/components/MapComponents';


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

  const { selectedSubDistricts } = useLocation();

  // UI State
  const [activePanel, setActivePanel] = useState<string | null>(null);
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
    setActivePanel(null);
  };

  const togglePanel = (panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel);
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

  const getOpacityPercentage = (value: number) => `${value * 10}%`;

  const renderLayerPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className="rounded-xl border border-white/50 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Map Layers</h3>
          <button onClick={() => setActivePanel(null)} className="text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {getCurrentLayers().map((layer) => (
            <div key={layer.id} className={`rounded-xl border p-3 ${layer.visible ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100' : 'border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${layer.visible ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <span className={`text-sm font-semibold truncate ${layer.visible ? 'text-blue-800' : 'text-gray-600'}`}>{layer.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {layer.id === 'gsr' && <button onClick={zoomToGsr} className="p-1 text-gray-500 hover:text-blue-600" title="Zoom to GSR"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>}
                  {(layer.type === 'boundary' || layer.type === 'village-overlay') && selectedSubDistricts.length > 0 && <button onClick={zoomToVillages} className="p-1 text-gray-500 hover:text-blue-600" title="Zoom to extent"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>}
                  {layer.type === 'raster' && <button onClick={zoomToRaster} className="p-1 text-gray-500 hover:text-blue-600" title="Zoom to raster"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>}
                  {layer.type === 'contour' && <><button onClick={zoomToContours} className="p-1 text-gray-500 hover:text-blue-600" title="Zoom to contours"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button><button onClick={removeContours} className="p-1 text-gray-500 hover:text-red-600" title="Remove contours"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></>}
                  {layer.type === 'wells' && layer.id === 'trend-wells' && <button onClick={() => { removeTrendLayer(); setLayerVisibility(prev => ({ ...prev, 'trend-wells': false })); }} className="p-1 text-gray-500 hover:text-red-600" title="Remove trend wells"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                  <button
                    onClick={() => handleLayerToggle(layer.id)}
                    className={`relative h-5 w-10 rounded-full transition-all duration-300 ${layer.visible ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${layer.visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBasemapPanel = () => (
    <BaseMaps
      baseMaps={baseMaps}
      selectedBaseMap={selectedBaseMap}
      onChangeBaseMap={handleBaseMapChange}
      onClose={() => setActivePanel(null)}
    />
  );

  const renderToolsPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className="rounded-xl border border-white/50 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Map Tools</h3>
          <button onClick={() => setActivePanel(null)} className="text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {/* Opacity controls */}
          <div className="rounded-xl border border-gray-200 bg-white/70 px-3 py-3 text-sm text-gray-700">
            <div className="mb-2 font-medium text-gray-800">Layer Opacity</div>
            <div className="space-y-3 max-h-52 overflow-y-auto">
              {opacityLayerConfig.filter(l => l.visible).map((layer) => (
                <div key={layer.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium">{layer.label}</span>
                    <span className="text-blue-600 font-semibold">{getOpacityPercentage(layerOpacities[layer.key])}</span>
                  </div>
                  <input type="range" min="1" max="10" step="1" value={layerOpacities[layer.key]}
                    onChange={(e) => setLayerOpacity(layer.key, parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(layerOpacities[layer.key] - 1) * 11.11}%, #E5E7EB ${(layerOpacities[layer.key] - 1) * 11.11}%, #E5E7EB 100%)` }}
                  />
                </div>
              ))}
            </div>
            <button onClick={resetAllOpacities} className="mt-2 w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded py-1 transition-colors">Reset All</button>
          </div>
        </div>
      </div>
    </div>
  );

  const hasLegend = !!(legendData?.raster || legendData?.contour || legendData?.trend || legendData?.gsr);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);

  // Auto-show legend when new legend data arrives
  useEffect(() => {
    if (hasLegend) setIsLegendOpen(true);
  }, [hasLegend]);

  return (
    <div
      ref={mapContainerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'}`}
    >
      <div className="relative w-full h-full" ref={mapRef} />

      {/* STP-style GIS Viewer header controls */}
      <MapHeaderControls
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        onToggleFullScreen={toggleFullscreen}
        isFullScreen={isFullscreen}
      />

      {/* Panel content */}
      {activePanel === 'layers' && renderLayerPanel()}
      {activePanel === 'basemap' && renderBasemapPanel()}
      {activePanel === 'tools' && renderToolsPanel()}

      {/* LEGEND — bottom-right */}
      {hasLegend && isLegendOpen && (
        <div className="absolute right-3 bottom-10 z-20">
          <div className="rounded-xl border border-stone-200 bg-white/90 shadow-xl backdrop-blur-sm w-52">
            <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Legend</span>
              <button onClick={() => setIsLegendOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
              {legendData?.raster && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">{legendData.raster.parameter}</div>
                  <div className="space-y-1">
                    {legendData.raster.colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-700">{legendData.raster!.labels[i] ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {legendData?.gsr && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">GSR Classification</div>
                  <div className="space-y-1">
                    {legendData.gsr.classes.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-slate-700">{entry.label}{typeof entry.count === 'number' ? ` (${entry.count})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {legendData?.trend && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Trend Wells</div>
                  <div className="space-y-1">
                    {[['bg-red-500', 'Increasing'], ['bg-green-500', 'Decreasing'], ['bg-gray-500', 'No Trend'], ['bg-yellow-500', 'Insufficient Data']].map(([cls, label]) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${cls}`} />
                        <span className="text-xs text-slate-700">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {legendData?.contour && (() => {
                const { minElevation, maxElevation, interval } = legendData.contour;
                const steps = Math.min(6, Math.floor((maxElevation - minElevation) / interval) + 1);
                return (
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Contours (m)</div>
                    <div className="space-y-1">
                      {Array.from({ length: steps }, (_, i) => minElevation + i * Math.ceil((maxElevation - minElevation) / (steps - 1 || 1))).map((elev, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: getContourColor(elev, minElevation, maxElevation) }} />
                          <span className="text-xs text-slate-700">{elev.toFixed(0)} m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Legend toggle (i) button — bottom-right, only when legend data exists */}
      {hasLegend && (
        <button
          onClick={() => setIsLegendOpen(o => !o)}
          className={`absolute bottom-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold shadow transition-colors ${
            isLegendOpen
              ? 'border-blue-400 bg-blue-500 text-white'
              : 'border-stone-300 bg-white/90 text-slate-600 hover:border-blue-300 hover:text-blue-600'
          }`}
          title={isLegendOpen ? 'Hide legend' : 'Show legend'}
        >
          i
        </button>
      )}

      {/* Coordinates display */}
      {coordinates && (
        <div className="absolute bottom-3 left-3 z-10">
          <div className="rounded-lg bg-white/80 px-2 py-1 text-[10px] text-slate-600 backdrop-blur-sm shadow">
            {coordinates.lat.toFixed(6)}° N, {coordinates.lon.toFixed(6)}° E
            {scale && <span className="ml-2 text-slate-400">| {scale}</span>}
          </div>
        </div>
      )}

    </div>
  );
};

export default MapComponent;