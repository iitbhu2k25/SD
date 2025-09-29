"use client";
import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke, Circle, Text } from "ol/style";
import Image from "next/image";
import { fromLonLat } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { GISCompass } from "@/components/MapComponents";
import { useMap } from "@/contexts/groundwaterIdent/MapContext";
import { useCategory } from "@/contexts/groundwaterIdent/CategoryContext";
import "ol/ol.css";
import { useLocation } from "@/contexts/groundwaterIdent/LocationContext";
import { baseMaps } from "@/components/MapComponents";

const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;

const Mapping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});

  const [loading, setLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({ primary: 0, secondary: 0, result: 0 });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [showResultLayer, setShowResultLayer] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedSubDistricts, displayRaster, selectedvillages, setdisplay_raster } = useLocation();
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    stpOperation,
    setstpOperation,
    resultLayer,
    setResultLayer,
  } = useMap();
  const { selectedCategory, setTableData, setRasterLayerInfo, rasterLayerInfo } = useCategory();

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

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

  const createVectorStyle = (color: string, width: number) => (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name");
    const styles = [];

    if (geometryType.includes("Polygon")) {
      styles.push(new Style({
        stroke: new Stroke({ color, width }),
        fill: new Fill({ color: `${color}1A` })
      }));
    }

    if (geometryType.includes("LineString")) {
      styles.push(new Style({ stroke: new Stroke({ color, width: width + 2 }) }));
    }

    if (geometryType.includes("Point")) {
      styles.push(new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: `${color}B3` }),
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
        })
      }));
    }

    return styles;
  };

  // Initialize map
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
          const [longitude, latitude] = coordinate;
          return `Lat: ${latitude.toFixed(6)}° | Long: ${longitude.toFixed(6)}°`;
        },
        projection: "EPSG:4326",
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
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    mapInstanceRef.current = map;
    setTimeout(() => setLoading(false), 500);

    return () => {
      if (map) map.setTarget("");
    };
  }, []);

  // Handle primary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) return;

    const wfsUrl = `/geoserver/api/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${defaultWorkspace}:${primaryLayer}&outputFormat=application/json&srsname=EPSG:3857`;

    const vectorSource = new VectorSource({
      format: new GeoJSON(),
      url: wfsUrl,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle("#3b82f6", 2),
      zIndex: 1,
      visible: true,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features?.length || 0;
      setFeatureCounts(prev => ({ ...prev, primary: numFeatures }));

      const extent = vectorSource.getExtent();
      if (extent && extent.some(val => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };

    vectorSource.on("featuresloadend", handleFeaturesLoaded);
    vectorSource.on("featuresloaderror", () => setError("Failed to load primary layer"));

    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    primaryLayerRef.current = vectorLayer;

    return () => {
      vectorSource.un("featuresloadend", handleFeaturesLoaded);
    };
  }, [primaryLayer, defaultWorkspace, showTitles]);

  // Handle secondary layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (secondaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(secondaryLayerRef.current);
      secondaryLayerRef.current = null;
    }

    if (!secondaryLayer) {
      setFeatureCounts(prev => ({ ...prev, secondary: 0 }));
      return;
    }

    const values = Array.isArray(LayerFilterValue)
      ? LayerFilterValue.map(v => `'${v}'`).join(",")
      : `'${LayerFilterValue}'`;

    const wfsUrl = `/geoserver/api/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${defaultWorkspace}:${secondaryLayer}&outputFormat=application/json&srsname=EPSG:3857&CQL_FILTER=${LayerFilter} IN (${values})`;

    const vectorSource = new VectorSource({
      url: wfsUrl,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle("#5E1520", 3),
      zIndex: 10,
      visible: showSecondaryLayer,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features?.length || 0;
      setFeatureCounts(prev => ({ ...prev, secondary: numFeatures }));

      if (numFeatures > 0) {
        const extent = vectorSource.getExtent();
        if (extent && extent.every(val => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: 16,
          });
        }
      }
    };

    vectorSource.on("featuresloadend", handleFeaturesLoaded);
    vectorSource.on("featuresloaderror", () => setError("Failed to load secondary layer"));

    mapInstanceRef.current.addLayer(vectorLayer);
    secondaryLayerRef.current = vectorLayer;

    return () => {
      vectorSource.un("featuresloadend", handleFeaturesLoaded);
    };
  }, [secondaryLayer, LayerFilter, LayerFilterValue, showTitles, showSecondaryLayer, defaultWorkspace]);

  // Handle result layer
  useEffect(() => {
    if (!mapInstanceRef.current || !resultLayer) return;

    const wfsUrl = `/geoserver/api/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=${defaultWorkspace}:${resultLayer}&outputFormat=application/json&srsname=EPSG:3857`;

    const vectorSource = new VectorSource({
      format: new GeoJSON(),
      url: wfsUrl,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle("#3b82f6", 2),
      zIndex: 10,
      visible: true,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features?.length || 0;
      setFeatureCounts(prev => ({ ...prev, result: numFeatures }));

      const extent = vectorSource.getExtent();
      if (extent && extent.some(val => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };

    vectorSource.on("featuresloadend", handleFeaturesLoaded);

    if (resultLayerRef.current) {
      mapInstanceRef.current.removeLayer(resultLayerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    resultLayerRef.current = vectorLayer;

    return () => {
      vectorSource.un("featuresloadend", handleFeaturesLoaded);
    };
  }, [resultLayer, defaultWorkspace]);

  // Handle raster layer and STP operation
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    const performSTP = async () => {
      setLoading(true);
      try {
        const resp = await fetch("/api/stp_operation/stp_sutability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: selectedCategory, clip: selectedvillages }),
        });

        if (!resp.ok) throw new Error(`STP operation failed: ${resp.status}`);

        const result = await resp.json();
        if (result.status === "success") {
          const layerData = {
            file_name: "STP_Sutability",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };

          setTableData(result.csv_details);
          const index = displayRaster.findIndex(item => item.file_name === "STP_Sutability");

          if (result.vector_name && result.vector_name !== "none") {
            setResultLayer(result.vector_name);
          }

          const newData = index !== -1
            ? [...displayRaster.slice(0, index), layerData, ...displayRaster.slice(index + 1)]
            : [...displayRaster, layerData];

          setdisplay_raster(newData);
          setTimeout(() => setRasterLayerInfo(result), 500);
        }
      } catch (error: any) {
        setError(`STP error: ${error.message}`);
      } finally {
        setstpOperation(false);
        setLoading(false);
      }
    };

    if (stpOperation) {
      performSTP();
      return;
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      map.removeLayer(layer);
      delete layersRef.current[id];
    });

    if (!rasterLayerInfo) {
      setLegendUrl(null);
      return;
    }

    try {
      const { workspace, layer_name } = rasterLayerInfo;
      const fullLayerName = workspace ? `${workspace}:${layer_name}` : layer_name;
      const layerUrl = "/geoserver/api/wms";

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

      setLegendUrl(`${layerUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=`);

      setTimeout(() => {
        const newLayer = new ImageLayer({
          source: wmsSource,
          visible: true,
          opacity: layerOpacity / 100,
          zIndex: 2,
        });

        const layerId = `raster-${layer_name}-${Date.now()}`;
        layersRef.current[layerId] = newLayer;
        map.addLayer(newLayer);
        map.renderSync();
      }, 100);
    } catch (error: any) {
      setError(`Raster error: ${error.message}`);
    }
  }, [rasterLayerInfo, layerOpacity, stpOperation, selectedCategory]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  return (
    <div className="relative w-full h-[600px] flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200" ref={containerRef}>
        <div ref={mapRef} className="w-full h-full bg-blue-50" />
        
        <div className="hidden md:block">
          <GISCompass />
        </div>

        {/* Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 flex items-center space-x-4">
          <span className="font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            GIS Viewer
          </span>

          <div className="flex space-x-2">
            {["layers", "basemap", "tools"].map(panel => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${
                  activePanel === panel ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={panel === "layers" ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" :
                      panel === "basemap" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945" :
                      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37"} />
                </svg>
              </button>
            ))}

            <button onClick={toggleFullScreen} className="p-2.5 rounded-full hover:bg-gray-100 text-gray-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={!isFullScreen ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" : "M6 18L18 6M6 6l12 12"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Base Map Panel */}
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
                  className={`flex flex-col items-center p-4 rounded-xl transition-all border-2 ${
                    selectedBaseMap === key ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-medium">{baseMap.name}</span>
                </button>
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
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-800">Primary Layer</span>
                    <span className="text-xs bg-blue-200/80 text-blue-800 px-3 py-1 rounded-full">{featureCounts.primary} features</span>
                  </div>
                </div>
              )}

              {featureCounts.secondary > 0 && (
                <div className={`p-4 rounded-xl border ${showSecondaryLayer ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${showSecondaryLayer ? "text-green-800" : "text-gray-600"}`}>Secondary Layer</span>
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
                        className={`w-12 h-6 rounded-full ${showSecondaryLayer ? "bg-green-500" : "bg-gray-300"} relative`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform ${showSecondaryLayer ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-purple-800">Raster Layer</span>
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
                      className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-purple-500"
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
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]));
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100"
              >
                <span className="text-sm font-medium">Home View</span>
              </button>

              <button
                onClick={() => setShowTitles(!showTitles)}
                className={`flex flex-col items-center p-4 rounded-xl border ${showTitles ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}
              >
                <span className="text-lg font-semibold mb-2">{showTitles ? "ON" : "OFF"}</span>
                <span className="text-sm font-medium">Display Titles</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {legendUrl && rasterLayerInfo && (
          <div className="absolute bottom-16 right-16 z-20 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl">
            <span className="text-sm font-bold text-gray-700 block mb-3">Legend</span>
            <img src={legendUrl} alt="Legend" className="max-w-full h-auto rounded-lg" />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-4 bottom-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-lg">
          <div id="mouse-position" className="text-xs font-medium text-gray-800 font-mono"></div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {stpOperation ? "Processing River Analysis" : "Loading Resources"}
                </h3>
              </div>
            </div>
          </div>
        )}


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

export default Mapping;