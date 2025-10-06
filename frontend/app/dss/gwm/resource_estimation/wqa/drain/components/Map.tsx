'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { toLonLat } from 'ol/proj';
import { METERS_PER_UNIT } from 'ol/proj/Units';
import VectorSource from 'ol/source/Vector';
import { useMap } from '@/contexts/water_quality_assesment/drain/MapContext';
import { useLocation } from '@/contexts/water_quality_assesment/drain/LocationContext';

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
  satellite: {
    name: 'Satellite',
    icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  },
};

interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  type: 'drainage' | 'raster' | 'wells' | 'village-overlay' | 'contour' | 'trend';
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
    showLabels,
    toggleLabels,
    availableRasters,
    selectedRaster,
    switchToRaster,
    removeAllRasterLayers,
    highlightSelectedFeatures,
    zoomToSelectedFeatures
  } = useMap();

  // Get drainage system selections from LocationContext
  const { 
    selectedRiver, 
    selectedStretch, 
    selectedDrain, 
    selectedCatchments, 
    selectedVillages,
    setSelectedVillages,
    handleStretchChange,
    handleRiverChange,
    handleDrainChange,
    areaConfirmed,
    rivers,
    stretches,
    drains
  } = useLocation();

  const legendItems = [
  { label: 'Basin', color: '#6f1119' },           // Basin boundary - dark red
  { label: 'Rivers', color: '#8001ffff' },          // Rivers - blue
  { label: 'Stretches', color: '#c4bc2b' },       // Stretches - yellow/gold
  { label: 'Sel. River', color: '#0d05f3' },      // Selected river - darker blue
  { label: 'Sel. Stretch', color: '#DC2626' },    // Selected stretch - red
  { label: 'Drains', color: '#FF6B35' },          // Drains - orange
  // { label: 'Catchments', color: '#DC2626' },      // Catchments - red (border)
  { label: 'Villages', color: '#F59E0B' }         // Villages - amber/orange
];

  // UI State
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState<boolean>(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState<boolean>(false);
  const [isLegendPanelOpen, setIsLegendPanelOpen] = useState<boolean>(false);
  const [isRasterSwitchOpen, setIsRasterSwitchOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [scale, setScale] = useState<string>('');

  // Layer visibility state for drainage system
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    'basin-boundary': true,
    rivers: true,
    stretches: true,
    drains: true,
    catchments: true,
    villages: true,
    'manual-wells': true,
    raster: true,
    'village-overlay': true,
    contours: true,
    'trend-wells': true
  });

  const basemapPanelRef = useRef<HTMLDivElement>(null);
  const layerPanelRef = useRef<HTMLDivElement>(null);
  const legendPanelRef = useRef<HTMLDivElement>(null);
  const rasterSwitchRef = useRef<HTMLDivElement>(null);

  // Set map container when ref is available
  useEffect(() => {
    if (mapRef.current) {
      setMapContainer(mapRef.current);
    }
    return () => setMapContainer(null);
  }, [setMapContainer]);

  // ENHANCED: Map click handler with village, drain, stretch, and river selection
  useEffect(() => {
    if (!mapInstance) return;

    const handleMapClick = (event: any) => {
      if (areaConfirmed) {
        return;
      }
      let featureFound = false;

      // Priority 1: Check if a village was clicked
      mapInstance.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (!featureFound && layer && layer.get('name') === 'villages') {
          featureFound = true;
          const villageCode = Number(feature.get('village_co'));
          if (!villageCode) return;

          console.log(`Village ${villageCode} clicked on map`);

          // Toggle village selection (both select AND deselect)
          setSelectedVillages(prevSelected => {
            if (prevSelected.includes(villageCode)) {
              console.log(`Deselecting village ${villageCode}`);
              return prevSelected.filter(code => code !== villageCode);
            } else {
              console.log(`Selecting village ${villageCode}`);
              return [...prevSelected, villageCode];
            }
          });
        }
      });

      if (featureFound) return;

      // Priority 2: Check for a drain
      mapInstance.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (featureFound || !layer || layer.get('name') !== 'drains') {
          return;
        }

        const drainNo = Number(feature.get('Drain_No'));
        const drainStretchId = Number(feature.get('Stretch_ID'));
        
        // Only allow drain selection if a stretch is already selected
        if (selectedStretch && drainStretchId === selectedStretch) {
          featureFound = true;
          if (drainNo) {
            console.log(`Drain ${drainNo} clicked for stretch ${selectedStretch}`);
            handleDrainChange(drainNo);
          }
        }
      });

      if (featureFound) return;

      // Priority 3: Check for a stretch
      mapInstance.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (featureFound || !layer || layer.get('name') !== 'stretches') {
          return;
        }

        const stretchId = Number(feature.get('Stretch_ID'));
        const stretchRiverCode = Number(feature.get('River_Code'));

        if (selectedRiver && stretchRiverCode === selectedRiver) {
          featureFound = true;
          if (stretchId) {
            console.log(`Correctly selected stretch ${stretchId} for river ${selectedRiver}`);
            handleStretchChange(stretchId);
          }
        }
      });

      if (featureFound) return;

      // Priority 4: Check for a river
      mapInstance.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (!featureFound && layer && layer.get('name') === 'rivers') {
          featureFound = true;
          const riverCode = Number(feature.get('River_Code'));
          
          if (riverCode) {
            console.log(`River clicked on map: ${riverCode}`);
            handleRiverChange(riverCode);
          }
        }
      });
    };

    mapInstance.on('singleclick', handleMapClick);

    return () => {
      mapInstance.un('singleclick', handleMapClick);
    };
  }, [mapInstance, selectedRiver, selectedStretch, setSelectedVillages, handleStretchChange, handleRiverChange, handleDrainChange]);

  // Enhanced mouse hover effect with cursor and title changes
  useEffect(() => {
    if (!mapInstance) return;

    const handlePointerMove = (event: any) => {
      const pixel = event.pixel;
      let isOverInteractiveFeature = false;
      let isOverVillage = false;
      let isOverRiver = false;
      let isOverStretch = false;
      let isOverDrain = false;

      mapInstance.forEachFeatureAtPixel(pixel, (feature, layer) => {
        if (!layer) return;

        const layerName = layer.get('name');
        
        // Villages are interactive when visible
        if (layerName === 'villages' && selectedVillages.length >= 0) {
          isOverVillage = true;
          isOverInteractiveFeature = true;
          return true;
        }
        
        // Rivers are always interactive
        if (layerName === 'rivers') {
          isOverRiver = true;
          isOverInteractiveFeature = true;
          return true;
        }
        
        // Stretches are interactive when a river is selected
        if (layerName === 'stretches' && selectedRiver) {
          const featureRiverCode = Number(feature.get('River_Code'));
          if (featureRiverCode === selectedRiver) {
            isOverStretch = true;
            isOverInteractiveFeature = true;
            return true;
          }
        }

        // Drains are interactive when a stretch is selected
        if (layerName === 'drains' && selectedStretch) {
          const featureStretchId = Number(feature.get('Stretch_ID'));
          if (featureStretchId === selectedStretch) {
            isOverDrain = true;
            isOverInteractiveFeature = true;
            return true;
          }
        }
      }, { hitTolerance: 8 });

      const targetElement = mapInstance.getTargetElement();
      if (targetElement) {
        if (isOverVillage) {
          targetElement.style.cursor = 'pointer';
          targetElement.title = 'Click to toggle village selection';
        } else if (isOverDrain) {
          targetElement.style.cursor = 'pointer';
          targetElement.title = 'Click to select drain';
        } else if (isOverStretch) {
          targetElement.style.cursor = 'pointer';
          targetElement.title = 'Click to select stretch';
        } else if (isOverRiver) {
          targetElement.style.cursor = 'pointer';
          targetElement.title = 'Click to select river';
        } else {
          targetElement.style.cursor = '';
          targetElement.title = '';
        }
      }
    };

    mapInstance.on('pointermove', handlePointerMove);

    return () => {
      mapInstance.un('pointermove', handlePointerMove);
      
      const targetElement = mapInstance.getTargetElement();
      if (targetElement) {
        targetElement.style.cursor = '';
        targetElement.title = '';
      }
    };
  }, [mapInstance, selectedRiver, selectedStretch, selectedVillages.length]);

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
      if (rasterSwitchRef.current && !rasterSwitchRef.current.contains(event.target as Node)) {
        setIsRasterSwitchOpen(false);
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
      case 'manual-wells':
        const manualWellLayer = layers.find(layer => layer.get('name') === 'manual-wells');
        if (manualWellLayer) {
          manualWellLayer.setVisible(newVisibility);
          console.log(`Manual wells layer visibility set to: ${newVisibility}`);
        }
        break;
      case 'village-overlay':
        if (toggleVillageOverlay) {
          toggleVillageOverlay();
        }
        console.log(`Village overlay toggled to: ${!isVillageOverlayVisible}`);
        break;
      case 'trend-wells':
        const trendLayer = layers.find(layer => layer.get('type') === 'trend');
        if (trendLayer) {
          trendLayer.setVisible(newVisibility);
          console.log(`Trend wells layer visibility set to: ${newVisibility}`);
        }
        break;
    }
  };

  const handleRasterSwitch = (raster: any) => {
    console.log(`Switching to raster: ${raster.display_name}`);
    switchToRaster(raster);
    setIsRasterSwitchOpen(false);
  };

  const handleClearAllRasters = () => {
    console.log('Clearing all rasters');
    removeAllRasterLayers();
    setIsRasterSwitchOpen(false);
  };

  const zoomToCurrentLayer = () => {
    if (zoomToCurrentExtent) {
      zoomToCurrentExtent();
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

  // Get current visible layers for layer panel
  const getCurrentLayers = (): LayerInfo[] => {
    const layers: LayerInfo[] = [];

    layers.push({ 
      id: 'basin-boundary', 
      name: 'Basin Boundary', 
      visible: layerVisibility['basin-boundary'], 
      type: 'drainage' 
    });

    layers.push({ 
      id: 'rivers', 
      name: `Rivers ${selectedRiver ? `(${selectedRiver} highlighted)` : '(All visible)'}`, 
      visible: layerVisibility.rivers, 
      type: 'drainage' 
    });

    layers.push({ 
      id: 'stretches', 
      name: `Stretches ${selectedStretch ? `(${selectedStretch} highlighted)` : '(All visible)'}`, 
      visible: layerVisibility.stretches, 
      type: 'drainage' 
    });

    layers.push({ 
      id: 'drains', 
      name: `Drains ${selectedDrain ? `(${selectedDrain} highlighted)` : '(All visible)'}`, 
      visible: layerVisibility.drains, 
      type: 'drainage' 
    });

    if (selectedDrain) {
      layers.push({ 
        id: 'catchments', 
        name: `Catchments (Drain ${selectedDrain})`, 
        visible: layerVisibility.catchments, 
        type: 'drainage' 
      });
    }

    if (selectedVillages.length > 0) {
      layers.push({ 
        id: 'villages', 
        name: `Villages (${selectedVillages.length} selected)`, 
        visible: layerVisibility.villages, 
        type: 'drainage' 
      });
    }

    if (areaConfirmed) {
      layers.push({ 
        id: 'manual-wells', 
        name: 'Manual Wells', 
        visible: layerVisibility['manual-wells'], 
        type: 'wells' 
      });
    }

    if (isRasterDisplayed) {
      layers.push({ 
        id: 'raster', 
        name: selectedRaster ? selectedRaster.display_name : 'GWQI Raster', 
        visible: layerVisibility.raster, 
        type: 'raster' 
      });
      
      if (selectedVillages.length > 0) {
        layers.push({ 
          id: 'village-overlay', 
          name: 'Village Overlay', 
          visible: layerVisibility['village-overlay'], 
          type: 'village-overlay' 
        });
      }
    }

    if (isContourDisplayed) {
      layers.push({ 
        id: 'contours', 
        name: 'Contour Lines', 
        visible: layerVisibility.contours, 
        type: 'contour' 
      });
    }

    if (isTrendDisplayed) {
      layers.push({ 
        id: 'trend-wells', 
        name: 'Trend Wells', 
        visible: layerVisibility['trend-wells'], 
        type: 'trend' 
      });
    }

    return layers;
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'drainage':
        return 'M4 4h16v16H4V4zm2 2v12h12V6H6z';
      case 'raster':
        return 'M3 3h18v18H3V3zm2 2v14h14V5H5z';
      case 'wells':
        return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
      case 'village-overlay':
        return 'M4 4h16v16H4V4zm2 2v12h12V6H6z';
      case 'contour':
        return 'M3 12h18m-9-9v18';
      case 'trend':
        return 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';
      default:
        return 'M4 4h16v16H4V4z';
    }
  };

  const getRasterTypeIcon = (type: 'gwqi' | 'parameter') => {
    switch (type) {
      case 'gwqi':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'parameter':
        return 'M13 10V3L4 14h7v7l9-11h-7z';
      default:
        return 'M3 3h18v18H3V3zm2 2v14h14V5H5z';
    }
  };

  const getParameterTypeBadge = (type: 'gwqi' | 'parameter') => {
    switch (type) {
      case 'gwqi':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'parameter':
        return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div
      ref={mapContainerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-[700px]'} border rounded-lg overflow-hidden shadow-lg bg-gradient-to-br from-gray-50 to-white`}
    >
      <div className="relative w-full h-full" ref={mapRef} />

      {/* Map Legend */}
      <div className="absolute top-3 left-9 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-lg">
        <div className="flex items-center space-x-4 px-2">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center space-x-1.5">
              <div
                className="w-4 h-4 rounded-sm border border-gray-400"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-sm font-semibold text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Raster Switching Dropdown */}
      {availableRasters.length > 0 && (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-[1000]" ref={rasterSwitchRef}>
          <button
            onClick={() => setIsRasterSwitchOpen(!isRasterSwitchOpen)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 flex items-center gap-3 backdrop-blur-sm transform hover:scale-105"
            title="Switch Raster Layer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getRasterTypeIcon(selectedRaster?.type || 'gwqi')} />
            </svg>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold">
                {selectedRaster?.display_name || 'Select Raster'}
              </span>
              {selectedRaster?.color_scheme?.unit && (
                <span className="text-xs opacity-75">
                  Unit: {selectedRaster.color_scheme.unit}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className={`px-2 py-1 rounded-full text-xs font-bold ${getParameterTypeBadge(selectedRaster?.type || 'gwqi')}`}>
                {selectedRaster?.type === 'gwqi' ? 'GWQI' : 'PARAM'}
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                {availableRasters.length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isRasterSwitchOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isRasterSwitchOpen && (
            <div className="absolute top-full left-0 mt-2 w-96 bg-white/95 backdrop-blur-md border-0 rounded-xl shadow-2xl z-[1001] overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-teal-600 p-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Select Layer
                </h3>
              </div>

              <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {/* GWQI Layers Section */}
                {availableRasters.filter(r => r.type === 'gwqi').length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      GWQI Composite
                    </h4>
                    {availableRasters.filter(r => r.type === 'gwqi').map((raster) => (
                      <button
                        key={raster.layer_name}
                        onClick={() => handleRasterSwitch(raster)}
                        className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-300 ${
                          selectedRaster?.layer_name === raster.layer_name
                            ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg transform scale-105'
                            : 'hover:bg-gradient-to-r hover:from-green-100 hover:to-teal-100 text-gray-700 hover:shadow-md'
                        }`}
                      >
                        <div className="p-2 bg-white/20 rounded-lg">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getRasterTypeIcon(raster.type)} />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{raster.display_name}</div>
                          <div className="text-xs opacity-75">{raster.description}</div>
                          <div className="text-xs opacity-75 mt-1">Unit: {raster.color_scheme?.unit || 'Index Score'}</div>
                        </div>
                        {selectedRaster?.layer_name === raster.layer_name && (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Parameter Layers Section */}
                {availableRasters.filter(r => r.type === 'parameter').length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Individual Parameters
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {availableRasters.filter(r => r.type === 'parameter').map((raster) => (
                        <button
                          key={raster.layer_name}
                          onClick={() => handleRasterSwitch(raster)}
                          className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all duration-300 ${
                            selectedRaster?.layer_name === raster.layer_name
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                              : 'hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 text-gray-700 hover:shadow-md'
                          }`}
                        >
                          <div className="p-2 bg-white/20 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getRasterTypeIcon(raster.type)} />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{raster.display_name}</div>
                            <div className="text-xs opacity-75">{raster.parameter}</div>
                            <div className="text-xs opacity-75 mt-1">Unit: {raster.color_scheme?.unit || 'N/A'}</div>
                          </div>
                          {selectedRaster?.layer_name === raster.layer_name && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear All Button */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleClearAllRasters}
                    className="w-full p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All Rasters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Basemap Selector */}
      <div className="absolute top-3 right-2 z-[1000]" ref={basemapPanelRef}>
        <button
          onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 flex items-center gap-2 backdrop-blur-sm transform hover:scale-105"
          title="Change Base Map"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMapNames[selectedBaseMap]?.icon} />
          </svg>
          <span className="text-sm font-semibold">
            {baseMapNames[selectedBaseMap]?.name}
          </span>
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${isBasemapPanelOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isBasemapPanelOpen && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white/95 backdrop-blur-md border-0 rounded-xl shadow-2xl z-[1001] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146" />
                </svg>
                Base Map Selection
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {Object.entries(baseMapNames).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => handleBaseMapChange(key)}
                  className={`flex items-center gap-3 w-full p-4 rounded-xl text-left transition-all duration-300 ${selectedBaseMap === key
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                    : 'hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 text-gray-700 hover:shadow-md'
                    }`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                  </svg>
                  <span className="font-medium">{baseMap.name}</span>
                  {selectedBaseMap === key && (
                    <svg className="w-5 h-5 ml-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Layer Control Panel */}
      <div className="absolute top-15 left-3 z-[1000]" ref={layerPanelRef}>
        <button
          onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 flex items-center gap-2 backdrop-blur-sm transform hover:scale-105"
          title="Layer Controls"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="font-semibold">Layers</span>
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-sm"></div>
        </button>

        {isLayerPanelOpen && (
          <div className="absolute top-full left-0 mt-2 w-96 bg-white/95 backdrop-blur-md border-0 rounded-xl shadow-2xl z-[1001] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Progressive Drainage Layers
              </h3>
              <p className="text-green-100 text-sm mt-1">
                All layers loaded • Progressive highlighting active
              </p>
            </div>

            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {getCurrentLayers().map((layer) => (
                <div key={layer.id} className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 transition-all duration-300 hover:shadow-md hover:from-gray-100 hover:to-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getLayerIcon(layer.type)} />
                        </svg>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">{layer.name}</span>
                        <div className="text-xs text-gray-500 capitalize font-medium bg-gray-200 px-2 py-1 rounded-full inline-block mt-1">
                          {layer.type}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {layer.type === 'drainage' && (
                        <button
                          onClick={zoomToCurrentLayer}
                          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all duration-200"
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
                          className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all duration-200"
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
                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                            title="Zoom to contour extent"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={removeContours}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Remove contour layer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      {layer.type === 'trend' && (
                        <button
                          onClick={() => {
                            if (removeTrendLayer) {
                              removeTrendLayer();
                            }
                            setLayerVisibility(prev => ({ ...prev, 'trend-wells': false }));
                          }}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
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
                        <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-teal-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {getCurrentLayers().length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <p className="font-medium">All drainage layers loaded</p>
                    <p className="text-sm mt-1">Make selections to see progressive highlighting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend Control Panel */}
      <div className="absolute bottom-5 right-16 z-[1000]" ref={legendPanelRef}>
        {(legendData?.raster || legendData?.contour) && (
          <button
            onClick={() => setIsLegendPanelOpen(!isLegendPanelOpen)}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 flex items-center gap-2 backdrop-blur-sm transform hover:scale-105"
            title="Toggle Legend"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold">Legend</span>
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce shadow-sm"></div>
          </button>
        )}

        {isLegendPanelOpen && (legendData?.raster || legendData?.contour) && (
          <div className="absolute bottom-full right-0 mb-3 w-96 bg-white/95 backdrop-blur-md border-0 rounded-xl shadow-2xl z-[1001] max-h-96 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Legend
              </h3>
              {selectedRaster && (
                <p className="text-purple-100 text-sm mt-1">
                  Current: {selectedRaster.display_name}
                </p>
              )}
            </div>

            <div className="p-4 overflow-y-auto max-h-80">
              {legendData?.raster && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        legendData.raster.type === 'gwqi' 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                      }`}></div>
                      {legendData.raster.parameter_name || legendData.raster.parameter.replace(/_/g, ' ')}
                    </h4>
                    {legendData.raster.unit && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                        Unit: {legendData.raster.unit}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {legendData.raster.colors.map((color, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100">
                        <div
                          className="w-6 h-6 rounded-lg border-2 border-white shadow-lg"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700">
                            {legendData?.raster && legendData.raster.colors.length === legendData.raster.labels.length && (
                              legendData.raster.labels[index]?.replace(/\s*(mg\/L|µS\/cm|pH units|mg\/L as CaCO₃|Index Score).*$/, '')
                            )}
                          </span>
                        </div>
                        {legendData.raster.type === 'gwqi' && (
                          <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                            Index
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {legendData?.contour && (
                <div>
                  <h4 className="font-bold text-gray-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-full"></div>
                    Contours (Elevation)
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      const { minElevation, maxElevation, interval } = legendData.contour;
                      const steps = Math.floor((maxElevation - minElevation) / interval) + 1;
                      const elevationLevels = Array.from(
                        { length: steps },
                        (_, i) => minElevation + i * interval
                      ).filter((elev) => elev <= maxElevation);

                      return elevationLevels.slice(0, 8).map((elevation, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-100">
                          <div
                            className="w-6 h-6 rounded-lg border-2 border-white shadow-lg"
                            style={{
                              backgroundColor: getContourColor(
                                elevation,
                                minElevation,
                                maxElevation
                              ),
                            }}
                          />
                          <span className="text-sm font-medium text-gray-700 flex-1">
                            {elevation.toFixed(1)} m
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-3">
        {/* Labels Toggle Button */}
        <button
          onClick={toggleLabels}
          className={`bg-gradient-to-r ${showLabels ? 'from-green-600 to-teal-600' : 'from-gray-700 to-gray-800'} hover:from-gray-800 hover:to-gray-900 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 backdrop-blur-sm transform hover:scale-110`}
          title={showLabels ? "Hide Labels" : "Show Labels"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white border-0 rounded-xl p-3 shadow-lg transition-all duration-300 backdrop-blur-sm transform hover:scale-110"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isFullscreen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            )}
          </svg>
        </button>
      </div>

      {/* Coordinates and Scale Display */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl p-4 shadow-xl backdrop-blur-sm">
        <div className="space-y-2 text-sm">
          {coordinates && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-mono font-semibold">
                {coordinates.lat.toFixed(6)}°, {coordinates.lon.toFixed(6)}°
              </span>
            </div>
          )}
          {scale && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-mono font-semibold">Scale: {scale}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;