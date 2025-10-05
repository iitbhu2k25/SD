import React, { use, useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import Select from "ol/interaction/Select";
import { doubleClick, pointerMove, singleClick } from "ol/events/condition";
import Image from "next/image";

import { fromLonLat } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";

import { Style, Fill, Stroke, Circle, Text } from "ol/style";
import { useMap } from "@/contexts/groundwaterzone/admin/MapContext";
import "ol/ol.css";
import { useLocation } from "@/contexts/groundwaterzone/admin/LocationContext";

import { baseMaps, GISCompass, HoverTooltip } from "@/components/MapComponents";

const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;

const Maping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({ primary: 0, secondary: 0 });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Context hooks
  const { displayRaster, setSelectedState, setSelectedDistricts, setSelectedSubDistricts, selectionsLocked } = useLocation();
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    setShowLegend,
    handleLayerSelection,
    rasterLoading,
    setRasterLoading,
    setError,
    error,
    selectedradioLayer,
    setLoading,
    rasterLayerInfo,
    setRasterLayerInfo,
    showLegend
  } = useMap();

  // Helper functions
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };
  useEffect(() => {
    if (primaryLayerRef.current && featureCounts.secondary > 0) {
      primaryLayerRef.current.setVisible(!showSecondaryLayer);
    } else if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(true);
    }
  }, [showSecondaryLayer, featureCounts.secondary]);
  const togglePanel = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;

    mapInstanceRef.current.removeLayer(baseLayerRef.current);
    const newBaseLayer = new TileLayer({
      source: baseMaps[baseMapKey].source(),
      zIndex: 0,
      properties: { type: "base" },
    });

    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
    setSelectedBaseMap(baseMapKey);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value);
    setLayerOpacity(newOpacity);
    Object.values(layersRef.current).forEach((layer: any) => {
      layer.setOpacity(newOpacity / 100);
    });
  };

  const createVectorStyle = (isSecondary = false) => (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name") || feature.get("NAME");
    const styles = [];

    const color = isSecondary ? "#5E1520" : "#3b82f6";
    const width = isSecondary ? 3 : 2;

    if (geometryType.includes("Polygon")) {
      styles.push(new Style({
        stroke: new Stroke({ color, width }),
        fill: new Fill({ color: 'transparent' })
      }));
    }

    if (geometryType.includes("LineString")) {
      styles.push(new Style({
        stroke: new Stroke({ color, width: width + 2 })
      }));
    }

    if (geometryType.includes("Point")) {
      styles.push(new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: color + "80" }),
          stroke: new Stroke({ color, width: 2 })
        })
      }));
    }

    if (showTitles && zoom > 5 && featureName) {
      styles.push(new Style({
        text: new Text({
          text: featureName.toString(),
          font: "12px Arial, sans-serif",
          fill: new Fill({ color }),
          stroke: new Stroke({ color: "#ffffff", width: 3 }),
          offsetY: geometryType.includes("Point") ? -20 : 0,
          textAlign: "center",
          textBaseline: "middle",
        })
      }));
    }

    return styles;
  };

  // Add this useEffect to handle interaction disabling based on selectionsLocked
  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current) return;
    if (selectionsLocked) {
      selectInteractionRef.current.setActive(false);
    }
  }, [selectionsLocked]);
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
      properties: { type: "base" },
    });

    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls().extend([
      new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
      new MousePosition({
        coordinateFormat: (coordinate) => {
          if (!coordinate) return "No coordinates";
          const [Longitude, latitude] = coordinate;
          return `Lat: ${latitude.toFixed(6)}° | Long: ${Longitude.toFixed(6)}°`;
        },
        projection: "EPSG:4326",
        className: "custom-mouse-position",
        target: document.getElementById("mouse-position") as HTMLElement,
      }),
      new ZoomSlider(),
      new ZoomToExtent({
        tipLabel: "Zoom to India",
        extent: fromLonLat([68, 7]).concat(fromLonLat([97, 37])),
      }),
    ]);

    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls: controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 18,
        constrainResolution: true,
        smoothExtentConstraint: true,
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    // Add Select interaction for double-clicks to select state
    const selectInteraction = new Select({
      condition: doubleClick,
      style: new Style({
        stroke: new Stroke({ color: '#ff0000', width: 3 }),
        fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' })
      }),

    });

    selectInteraction.on('select', (event) => {
      const selectedFeatures = event.selected;
      if (selectedFeatures.length > 0) {
        const feature = selectedFeatures[0];
        const geometry = feature.getGeometry();
        if (geometry && geometry.getType().includes('Polygon')) {
          const stateCode = feature.get("State_Code")
          const districtCode = feature.get("district_c")
          const subdistrictCode = feature.get("subdis_cod")


          if (subdistrictCode as number) {
            setSelectedSubDistricts([subdistrictCode]);
          }
          else if (districtCode as number) {
            setSelectedDistricts([districtCode]);
          }
          else if (stateCode) {
            setSelectedState(stateCode);
          } else {
            console.log("No state code found in polygon properties:", feature.getProperties());
          }
        }

        // Clear selection after processing
        setTimeout(() => {
          selectInteraction.getFeatures().clear();
        }, 500);
      }
    });

    // Add Select interaction for hover

    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: '#ffaa00', width: 2 }),
        fill: new Fill({ color: 'transparent' })
      }),
    });
    hoverInteraction.on('select', (event) => {
      const hoveredFeatures = event.selected;
      if (hoveredFeatures.length > 0) {
        setHoveredFeature(hoveredFeatures[0]);
      } else {
        setHoveredFeature(null);
      }
    });

    // Track mouse position for tooltip
    const handleMouseMove = (event: any) => {
      setMousePosition({
        x: event.pixel[0],
        y: event.pixel[1]
      });
    };

    map.on('pointermove', handleMouseMove);
    map.addInteraction(selectInteraction);
    map.addInteraction(hoverInteraction);
    selectInteractionRef.current = selectInteraction;
    hoverInteractionRef.current = hoverInteraction;
    mapInstanceRef.current = map;

    setTimeout(() => {
      setLoading(false);
      setIsLoading(false);
    }, 500);

    return () => {
      if (map) {
        map.un('pointermove', handleMouseMove);
        map.setTarget("");
      }
    };
  }, []);

  // Handle primary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) return;

    setIsLoading(true);
    setError(null);

    const primaryWfsUrl = `/geoserver/api/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${primaryLayer}&outputFormat=application/json&srsname=EPSG:3857`;

    const primaryVectorSource = new VectorSource({
      format: new GeoJSON(),
      url: primaryWfsUrl,
    });

    const primaryVectorLayer = new VectorLayer({
      source: primaryVectorSource,
      style: createVectorStyle(false),
      zIndex: 1,
      visible: true,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts(prev => ({ ...prev, primary: numFeatures }));
      setIsLoading(false);

      const primaryExtent = primaryVectorSource.getExtent();
      if (primaryExtent && primaryExtent.some((val) => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(primaryExtent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };

    const handleFeaturesError = () => {
      setIsLoading(false);
      setError("Failed to load primary features");
    };

    primaryVectorSource.on("featuresloadend", handleFeaturesLoaded);
    primaryVectorSource.on("featuresloaderror", handleFeaturesError);

    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
    }

    mapInstanceRef.current.addLayer(primaryVectorLayer);
    primaryLayerRef.current = primaryVectorLayer;

    return () => {
      primaryVectorSource.un("featuresloadend", handleFeaturesLoaded);
      primaryVectorSource.un("featuresloaderror", handleFeaturesError);
    };
  }, [primaryLayer, defaultWorkspace]);


  useEffect(() => {
    if (!mapInstanceRef.current || !secondaryLayer) {
      setFeatureCounts(prev => ({ ...prev, secondary: 0 }));
      if (secondaryLayerRef.current) {
        mapInstanceRef.current?.removeLayer(secondaryLayerRef.current);
        secondaryLayerRef.current = null;
      }
      return;
    }

    setIsLoading(true);

    const secondaryWfsUrl = `/geoserver/api/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${secondaryLayer}&outputFormat=application/json&srsname=EPSG:3857&CQL_FILTER=${LayerFilter} IN (${Array.isArray(LayerFilterValue)
      ? LayerFilterValue.map((v) => `'${v}'`).join(",")
      : `'${LayerFilterValue}'`
      })`;

    const secondaryVectorSource = new VectorSource({
      url: secondaryWfsUrl,
      format: new GeoJSON(),
    });

    const secondaryVectorLayer = new VectorLayer({
      source: secondaryVectorSource,
      style: createVectorStyle(true),
      zIndex: 4,
      visible: showSecondaryLayer,
    });

    const handleSecondaryFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts(prev => ({ ...prev, secondary: numFeatures }));
      setIsLoading(false);

      const secondaryExtent = secondaryVectorSource.getExtent();
      if (secondaryExtent && secondaryExtent.some((val) => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(secondaryExtent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };

    secondaryVectorSource.on("featuresloadend", handleSecondaryFeaturesLoaded);

    if (secondaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(secondaryLayerRef.current);
    }

    mapInstanceRef.current.addLayer(secondaryVectorLayer);
    secondaryLayerRef.current = secondaryVectorLayer;

    return () => {
      secondaryVectorSource.un("featuresloadend", handleSecondaryFeaturesLoaded);
    };
  }, [secondaryLayer, LayerFilter, LayerFilterValue, showTitles, showSecondaryLayer]);

  // Handle raster layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing raster layers
    Object.entries(layersRef.current).forEach(([id, layer]: [string, any]) => {
      map.removeLayer(layer);
      delete layersRef.current[id];
    });

    if (!rasterLayerInfo) {
      setRasterLoading(false);
      setLegendUrl(null);
      setShowLegend(false);
      return;
    }

    try {
      const layerUrl = "/geoserver/api//wms";
      const workspace = rasterLayerInfo.workspace;
      const layerName = rasterLayerInfo.layer_name;
      const fullLayerName = workspace ? `${workspace}:${layerName}` : layerName;

      const wmsSource = new ImageWMS({
        url: layerUrl,
        params: {
          LAYERS: fullLayerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        ratio: 1,
        serverType: "geoserver",
      });

      const legendUrlString = `${layerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000;bgColor:0xFFFFFF;dpi:96`;
      setLegendUrl(legendUrlString);

      setTimeout(() => {
        const newLayer = new ImageLayer({
          source: wmsSource,
          visible: true,
          opacity: layerOpacity / 100,
          zIndex: 3,
        });

        const layerId = `raster-${layerName}-${Date.now()}`;
        layersRef.current[layerId] = newLayer;

        map.addLayer(newLayer);
        map.renderSync();
        setRasterLoading(false);
      }, 100);
    } catch (error: any) {
      setError(`Error setting up raster layer: ${error.message}`);
      setRasterLoading(false);
    }
  }, [rasterLayerInfo, layerOpacity]);

  // Update raster layer info when selection changes
  useEffect(() => {
    displayRaster.forEach((item: any) => {
      if (item.file_name === selectedradioLayer) {
        setRasterLayerInfo(item);
      }
    });
  }, [selectedradioLayer, displayRaster]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  return (
    <div className="relative w-full h-[600px] flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200" ref={containerRef}>
        {/* The Map */}
        <div ref={mapRef} className="w-full h-full bg-blue-50" />

        <div className="hidden md:block">
            <div className="hidden md:block">
          <GISCompass />
        </div>
        </div>


        <HoverTooltip
          hoveredFeature={hoveredFeature}
          mousePosition={mousePosition}
        />

        {/* Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 flex items-center space-x-4">
          <span className="font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            GIS Viewer
          </span>

          <div className="flex space-x-2">
            {["layers", "basemap", "tools"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${activePanel === panel
                  ? "bg-blue-100 text-blue-600 shadow-inner"
                  : "hover:bg-gray-100 text-gray-700"
                  }`}
                title={panel.charAt(0).toUpperCase() + panel.slice(1)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={panel === "layers" ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" :
                      panel === "basemap" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" :
                        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"} />
                </svg>
              </button>
            ))}

            <button
              onClick={toggleFullScreen}
              className="p-2.5 rounded-full hover:bg-gray-100 text-gray-700 transition-all duration-200 hover:scale-110"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={!isFullScreen ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" : "M6 18L18 6M6 6l12 12"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Layer Selection Button */}
        <div className="absolute right-4 top-3">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="hover:opacity-80 transition-all duration-200 hover:scale-110 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20"
          >
            <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
          </button>
        </div>

        {/* Panels */}
        {activePanel === "basemap" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-6 max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Base Maps</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => changeBaseMap(key)}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 border-2 ${selectedBaseMap === key
                    ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 text-blue-700"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                >
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                  </svg>
                  <span className="text-sm font-medium">{baseMap.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Layer Dropdown Panel */}
        {isPanelOpen && displayRaster.length > 0 && (
          <div className="absolute right-4 top-20 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl p-6 w-80 z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Select Layer</h3>
              <button onClick={() => setIsPanelOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {displayRaster.map((layer, index) => (
                <div key={index} className="flex items-center mb-3 p-3 hover:bg-blue-50 rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    id={`layer-${index}`}
                    name="layerSelection"
                    value={layer.file_name}
                    checked={selectedradioLayer === layer.file_name}
                    onChange={() => handleLayerSelection(layer.file_name)}
                    className="mr-3 h-4 w-4 text-blue-600"
                  />
                  <label htmlFor={`layer-${index}`} className="text-sm text-gray-700 cursor-pointer">
                    {layer.file_name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Layers Panel */}
        {activePanel === "layers" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-6 max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Map Layers</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              {featureCounts.primary > 0 && (
                <div className={`p-4 rounded-xl border ${featureCounts.secondary > 0 && showSecondaryLayer
                  ? "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 ${featureCounts.secondary > 0 && showSecondaryLayer ? "bg-gray-400" : "bg-blue-500"
                        } rounded-full mr-3`}></div>
                      <span className={`font-semibold ${featureCounts.secondary > 0 && showSecondaryLayer ? "text-gray-600" : "text-blue-800"
                        }`}>Primary Layer</span>
                      {featureCounts.secondary > 0 && showSecondaryLayer && (
                        <span className="text-xs text-gray-500 ml-2">(Hidden when secondary shown)</span>
                      )}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full ${featureCounts.secondary > 0 && showSecondaryLayer
                      ? "bg-gray-200/80 text-gray-700"
                      : "bg-blue-200/80 text-blue-800"
                      }`}>
                      {featureCounts.primary} features
                    </span>
                  </div>
                </div>
              )}

              {featureCounts.secondary > 0 && (
                <div className={`p-4 rounded-xl border ${showSecondaryLayer ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 ${showSecondaryLayer ? "bg-green-500" : "bg-gray-400"} rounded-full mr-3`}></div>
                      <span className={`font-semibold ${showSecondaryLayer ? "text-green-800" : "text-gray-600"}`}>Secondary Layer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${showSecondaryLayer ? "bg-green-200/80 text-green-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.secondary} features
                      </span>
                      <button
                        onClick={() => {
                          setShowSecondaryLayer(!showSecondaryLayer);
                          if (secondaryLayerRef.current) {
                            secondaryLayerRef.current.setVisible(!showSecondaryLayer);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showSecondaryLayer ? "bg-green-500" : "bg-gray-300"} relative transition-all duration-300`}
                        title={showSecondaryLayer ? "Hide secondary layer (show primary)" : "Show secondary layer (hide primary)"}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showSecondaryLayer ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-purple-800">Raster Layer</span>
                    </div>

                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-700 mb-2">
                      <span>Opacity</span>
                      <span>{layerOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      step={10}
                      value={layerOpacity}
                      onChange={handleOpacityChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Panel */}
        {activePanel === "tools" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-6 max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-lg">Map Tools</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTitles(!showTitles)}
                className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 border ${showTitles
                  ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                  }`}
              >
                <span className="text-lg font-semibold mb-2">{showTitles ? "ON" : "OFF"}</span>
                <span className="text-sm font-medium">Display Titles</span>
              </button>

              <button
                onClick={() => {
                  setHoveredFeature(null);
                  selectInteractionRef.current?.getFeatures().clear();
                  hoverInteractionRef.current?.getFeatures().clear();
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
              >
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm font-medium">Clear Selection</span>
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]));
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
              >
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium">Home View</span>
              </button>


            </div>
          </div>
        )}


        {/* Legend */}
        {showLegend && legendUrl && rasterLayerInfo && (
          <div className="absolute bottom-16 right-16 z-20 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-700">Legend</span>

            </div>
            <img src={legendUrl} alt="Layer Legend" className="max-w-full h-auto rounded-lg border border-gray-200" />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-4 bottom-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <div className="text-xs font-medium text-gray-800 font-mono" id="mouse-position"></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50/95 backdrop-blur-md border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-2xl flex items-center">
            <svg className="w-5 h-5 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium pr-8">{error}</span>
            <button onClick={() => setError(null)} className="absolute right-2 top-2 text-red-400 hover:text-red-600">×</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Maping;