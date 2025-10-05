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
import { doubleClick, pointerMove } from "ol/events/condition";
import { fromLonLat } from "ol/proj";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Select from "ol/interaction/Select";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { GISCompass, baseMaps, HoverTooltip } from "@/components/MapComponents";
import { useMap } from "@/contexts/groundwaterIdent/admin/MapContext";
import { useCategory } from "@/contexts/groundwaterIdent/admin/CategoryContext";
import "ol/ol.css";
import { useLocation } from "@/contexts/groundwaterIdent/admin/LocationContext";
import { CsvRow } from '@/interface/table'

const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;

const Mapping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellPointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  // Simplified state management
  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({ primary: 0, secondary: 0, result: 0, wells: 0 });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [showResultLayer, setShowResultLayer] = useState(true);
  const [showWellPoints, setShowWellPoints] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const [selectedRadioLayer, setSelectedRadioLayer] = useState("");

  const { displayRaster, selectedvillages, setdisplay_raster, well_points } = useLocation();
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    setstpOperation,
    stpOperation,
    resultLayer,
    setResultLayer,
  } = useMap();
  const { selectedCategory, setTableData, setRasterLayerInfo, rasterLayerInfo } = useCategory();

  // Helper functions
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

  const handleLayerSelection = (layerName: string) => {
    setSelectedRadioLayer(layerName);
    displayRaster.forEach((item: any) => {
      if (item.file_name === layerName) {
        setRasterLayerInfo(item);
      }
    });
  };

  const createVectorStyle = (isSecondary = false, isResult = false) => (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name");
    const styles = [];

    const color = isSecondary ? "#5E1520" : "#3b82f6";
    const width = isSecondary ? 3 : 2;

    if (geometryType.includes("Polygon")) {
      styles.push(new Style({
        stroke: new Stroke({ color, width }),
        fill: new Fill({ color: isSecondary ? "rgba(94, 21, 32, 0.1)" : "transparent" })
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
          radius: 8,
          fill: new Fill({ color: "rgba(24, 4, 244, 0.7)" }),
          stroke: new Stroke({ color: "#2000d7ff", width: 2 })
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

  // Create style for well points
  const createWellPointStyle = (feature: any, resolution: number) => {
    const wellId = feature.get("Well_id");
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const styles = [];

    // Main point style
    styles.push(new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: "rgba(255, 87, 34, 0.8)" }),
        stroke: new Stroke({ color: "#d84315", width: 2 })
      })
    }));

    // Label style
    if (showTitles && zoom > 8 && wellId) {
      styles.push(new Style({
        text: new Text({
          text: `Well ${wellId}`,
          font: "bold 11px Arial, sans-serif",
          fill: new Fill({ color: "#d84315" }),
          stroke: new Stroke({ color: "#ffffff", width: 3 }),
          offsetY: -15,
          textAlign: "center",
          textBaseline: "middle",
        })
      }));
    }

    return styles;
  };
  useEffect(() => {
    if (primaryLayerRef.current && featureCounts.secondary > 0) {
      primaryLayerRef.current.setVisible(!showSecondaryLayer);
    } else if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(true);
    }
  }, [showSecondaryLayer, featureCounts.secondary]);
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

    const selectInteraction = new Select({
      condition: doubleClick,
      style: new Style({
        stroke: new Stroke({ color: '#ff0000', width: 3 }),
        fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' })
      }),
    });

    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: '#ffaa00', width: 2 }),
        fill: new Fill({ color: 'transparent' })
      }),
    });

    hoverInteraction.on('select', (event) => {
      const hoveredFeatures = event.selected;
      setHoveredFeature(hoveredFeatures.length > 0 ? hoveredFeatures[0] : null);
    });

    const handleMouseMove = (event: any) => {
      setMousePosition({ x: event.pixel[0], y: event.pixel[1] });
    };

    map.on('pointermove', handleMouseMove);
    map.addInteraction(selectInteraction);
    map.addInteraction(hoverInteraction);
    selectInteractionRef.current = selectInteraction;
    hoverInteractionRef.current = hoverInteraction;
    mapInstanceRef.current = map;

    setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => {
      if (map) {
        map.setTarget("");
      }
    };
  }, []);



  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing well points layer
    if (wellPointsLayerRef.current) {
      mapInstanceRef.current.removeLayer(wellPointsLayerRef.current);
      wellPointsLayerRef.current = null;
    }

    // If no well points data, reset and return
    if (!well_points || well_points.length === 0) {
      setFeatureCounts(prev => ({ ...prev, wells: 0 }));
      return;
    }

    console.log("Creating well points layer with data:", well_points);

    // Create features from well_points data
    const features = well_points.map((well: CsvRow) => {
      const lon = parseFloat(well.Longitude);
      const lat = parseFloat(well.Latitude);
      console.log('lon', lon)
      // Validate coordinates
      if (isNaN(lon) || isNaN(lat)) {
        console.warn(`Invalid coordinates for well ${well.Well_id}:`, well);
        return null;
      }

      console.log(`Creating feature for well ${well.Well_id} at [${lon}, ${lat}]`);

      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        Well_id: well.Well_id,
        Longitude: lon,
        Latitude: lat,
      });
      return feature;
    }).filter(f => f !== null);

    if (features.length === 0) {
      console.warn("No valid well point features created");
      setFeatureCounts(prev => ({ ...prev, wells: 0 }));
      return;
    }

    // Create vector source and layer
    const wellSource = new VectorSource({
      features: features,
    });

    const wellLayer = new VectorLayer({
      source: wellSource,
      style: createWellPointStyle,
      zIndex: 15,
      visible: showWellPoints,
    });

    mapInstanceRef.current.addLayer(wellLayer);
    wellPointsLayerRef.current = wellLayer;
    setFeatureCounts(prev => ({ ...prev, wells: features.length }));

    console.log(`Successfully added ${features.length} well points to map`);

    // Fit map to well points
    setTimeout(() => {
      if (features.length > 0 && mapInstanceRef.current) {
        const extent = wellSource.getExtent();
        console.log("Well points extent:", extent);
        if (extent && extent.every(val => isFinite(val))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [100, 100, 100, 100],
            duration: 1000,
            maxZoom: 12,
          });
        }
      }
    }, 100);
  }, [well_points]); // Only depend on well_points data

  // Separate useEffect for visibility toggle
  useEffect(() => {
    if (wellPointsLayerRef.current) {
      wellPointsLayerRef.current.setVisible(showWellPoints);
    }
  }, [showWellPoints]);

  // Separate useEffect for style updates when showTitles changes
  useEffect(() => {
    if (wellPointsLayerRef.current) {
      wellPointsLayerRef.current.setStyle(createWellPointStyle);
      mapInstanceRef.current?.render(); // Force re-render
    }
  }, [showTitles]);

  // Handle vector layers with unified logic
  const handleVectorLayer = (layer: string | null, type: 'primary' | 'secondary' | 'result') => {
    if (!mapInstanceRef.current || !layer) return;

    const wfsUrl = `/geoserver/api/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${layer}&outputFormat=application/json&srsname=EPSG:3857${type === 'secondary' && LayerFilterValue && LayerFilter
      ? `&CQL_FILTER=${LayerFilter} IN (${Array.isArray(LayerFilterValue) ? LayerFilterValue.map(v => `'${v}'`).join(",") : `'${LayerFilterValue}'`})`
      : ''
      }`;

    const vectorSource = new VectorSource({
      format: new GeoJSON(),
      url: wfsUrl,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle(type === 'secondary', type === 'result'),
      zIndex: type === 'primary' ? 1 : type === 'secondary' ? 10 : 10,
      visible: type === 'primary' ? true : type === 'secondary' ? showSecondaryLayer : showResultLayer,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts(prev => ({ ...prev, [type]: numFeatures }));

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
    vectorSource.on("featuresloaderror", () => setError(`Failed to load ${type} layer`));

    const layerRef = type === 'primary' ? primaryLayerRef : type === 'secondary' ? secondaryLayerRef : resultLayerRef;

    if (layerRef.current) {
      mapInstanceRef.current.removeLayer(layerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    layerRef.current = vectorLayer;
  };

  // Layer effects
  useEffect(() => {
    handleVectorLayer(primaryLayer, 'primary');
  }, [primaryLayer, defaultWorkspace]);

  useEffect(() => {
    handleVectorLayer(secondaryLayer, 'secondary');
  }, [secondaryLayer, LayerFilter, LayerFilterValue, showTitles, showSecondaryLayer]);

  useEffect(() => {
    handleVectorLayer(resultLayer, 'result');
  }, [resultLayer, defaultWorkspace]);

  // Handle raster layer and GWPL operation
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    if (stpOperation) {
      const performGWPL = async () => {
        try {
          const resp = await fetch("/api/gwz_operation/gwli_operation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: selectedCategory, clip: selectedvillages }),
          });

          if (!resp.ok) throw new Error(` operation failed: ${resp.status}`);

          const result = await resp.json();
          if (result && result.status === "success") {
            const append_data = {
              file_name: "Pumping_location",
              workspace: result.workspace,
              layer_name: result.layer_name,
            };
            setTableData(result.csv_details);

            if (result.vector_name && result.vector_name !== "none") {
              setResultLayer(result.vector_name);
            }

            const newData = [...displayRaster];
            const index = newData.findIndex(item => item.file_name === "Pumping_location");
            if (index !== -1) {
              newData[index] = append_data;
            } else {
              newData.push(append_data);
            }

            setdisplay_raster(newData);
            handleLayerSelection(append_data.file_name);
            setTimeout(() => {
              setRasterLayerInfo(result);
              setShowLegend(true);
            }, 500);
          }
        } catch (error: any) {
          setError(`GWPL operation failed: ${error.message}`);
        } finally {
          setstpOperation(false);
        }
      };

      performGWPL();
      return;
    }

    // Clear existing raster layers
    Object.entries(layersRef.current).forEach(([id, layer]) => {
      map.removeLayer(layer);
      delete layersRef.current[id];
    });

    if (!rasterLayerInfo) {
      setLegendUrl(null);
      return;
    }

    try {
      const layerUrl = "/geoserver/api/wms";
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

      const legendUrlString = `${layerUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=`;
      setLegendUrl(legendUrlString);

      setTimeout(() => {
        const newLayer = new ImageLayer({
          source: wmsSource,
          visible: true,
          opacity: layerOpacity / 100,
          zIndex: 2,
        });

        const layerId = `raster-${layerName}-${Date.now()}`;
        layersRef.current[layerId] = newLayer;
        map.addLayer(newLayer);
        map.renderSync();
      }, 100);
    } catch (error: any) {
      setError(`Error setting up raster layer: ${error.message}`);
    }
  }, [rasterLayerInfo, layerOpacity, stpOperation, selectedCategory]);

  // Fullscreen event listener
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
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

        {/* Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-3 sm:px-6 py-3 flex items-center space-x-2 sm:space-x-4">
          <span className="font-bold text-gray-800 flex items-center text-sm sm:text-base">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="hidden sm:inline">GIS Viewer</span>
            <span className="sm:hidden">GIS</span>
          </span>

          <div className="flex space-x-1 sm:space-x-2">
            {["layers", "basemap", "tools"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${activePanel === panel ? "bg-blue-100 text-blue-600 shadow-inner" : "hover:bg-gray-100 text-gray-700"
                  }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={panel === "layers" ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" :
                      panel === "basemap" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" :
                        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"} />
                </svg>
              </button>
            ))}
            <button onClick={toggleFullScreen} className="p-2 sm:p-2.5 rounded-full hover:bg-gray-100 text-gray-700 transition-all duration-200 hover:scale-110">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={!isFullScreen ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" : "M6 18L18 6M6 6l12 12"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Layer Selection Button */}
        <div className="absolute right-2 sm:right-4 top-3">
          <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
            <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
          </button>
        </div>

        {/* Panels */}
        {activePanel === "basemap" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Base Maps</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => changeBaseMap(key)}
                  className={`flex flex-col items-center p-3 sm:p-4 rounded-xl transition-all duration-200 border-2 ${selectedBaseMap === key ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                    }`}
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                  </svg>
                  <span className="text-xs sm:text-sm font-medium">{baseMap.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Layer Selection Panel */}
        {isPanelOpen && displayRaster.length > 0 && (
          <div className="absolute right-2 sm:right-4 top-16 sm:top-20 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 w-72 sm:w-80 z-50">
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
                    checked={selectedRadioLayer === layer.file_name}
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
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Map Layers</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              {featureCounts.primary > 0 && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-blue-800">Primary Layer</span>
                    </div>
                    <span className="text-xs bg-blue-200/80 text-blue-800 px-3 py-1 rounded-full">
                      {featureCounts.primary} features
                    </span>
                  </div>
                </div>
              )}

              {featureCounts.secondary > 0 && (
                <div className={`p-4 rounded-xl border ${showSecondaryLayer ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${showSecondaryLayer ? "bg-green-500" : "bg-gray-400"}`}></div>
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
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showSecondaryLayer ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {featureCounts.result > 0 && (
                <div className={`p-4 rounded-xl border ${showResultLayer ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${showResultLayer ? "bg-green-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${showResultLayer ? "text-green-800" : "text-gray-600"}`}>Result Layer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${showResultLayer ? "bg-green-200/80 text-green-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.result} features
                      </span>
                      <button
                        onClick={() => {
                          setShowResultLayer(!showResultLayer);
                          if (resultLayerRef.current) {
                            resultLayerRef.current.setVisible(!showResultLayer);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showResultLayer ? "bg-green-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showResultLayer ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {featureCounts.wells > 0 && (
                <div className={`p-4 rounded-xl border ${showWellPoints ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${showWellPoints ? "bg-orange-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${showWellPoints ? "text-orange-800" : "text-gray-600"}`}>Well Points</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${showWellPoints ? "bg-orange-200/80 text-orange-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.wells} wells
                      </span>
                      <button
                        onClick={() => {
                          setShowWellPoints(!showWellPoints);
                          if (wellPointsLayerRef.current) {
                            wellPointsLayerRef.current.setVisible(!showWellPoints);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showWellPoints ? "bg-orange-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showWellPoints ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-purple-800">Raster Layer</span>
                    <button
                      onClick={() => setShowLegend(!showLegend)}
                      className={`text-xs px-3 py-2 rounded-full ${showLegend ? "bg-purple-200/80 text-purple-800" : "bg-white/80 text-purple-700"}`}
                    >
                      {showLegend ? "Hide Legend" : "Show Legend"}
                    </button>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
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
              )}
            </div>
          </div>
        )}

        {/* Tools Panel */}
        {activePanel === "tools" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Tools</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleFullScreen}
                className="flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200"
              >
                <svg className="w-8 h-8 mb-2 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                <span className="text-sm font-medium">Full Screen</span>
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.getView().setCenter(fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]));
                    mapInstanceRef.current.getView().setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200"
              >
                <svg className="w-8 h-8 mb-2 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium">Home View</span>
              </button>

              <button
                onClick={() => setShowTitles(!showTitles)}
                className={`flex flex-col items-center p-4 rounded-xl border ${showTitles ? "bg-green-100 border-green-200" : "bg-gray-50 hover:bg-gray-100 border-gray-200"}`}
              >
                <div className="text-lg font-semibold mb-2">{showTitles ? "ON" : "OFF"}</div>
                <span className="text-sm font-medium">Display Titles</span>
              </button>

              <button
                onClick={() => {
                  if (wellPointsLayerRef.current && well_points && well_points.length > 0) {
                    const extent = wellPointsLayerRef.current.getSource()?.getExtent();
                    if (extent && extent.every(val => isFinite(val))) {
                      mapInstanceRef.current?.getView().fit(extent, {
                        padding: [100, 100, 100, 100],
                        duration: 1000,
                        maxZoom: 12,
                      });
                    }
                  }
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200"
              >
                <svg className="w-8 h-8 mb-2 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="text-sm font-medium">Zoom to Wells</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {showLegend && legendUrl && rasterLayerInfo && (
          <div className="absolute bottom-16 right-16 z-20 bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-700">Legend</span>
              <button onClick={() => setShowLegend(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <img src={legendUrl} alt="Layer Legend" className="max-w-full h-auto rounded-lg" />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-2 sm:right-4 bottom-2 sm:bottom-4 z-20 bg-white/95 backdrop-blur-md p-2 sm:p-3 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <div className="text-xs font-medium text-gray-800 font-mono" id="mouse-position"></div>
          </div>
        </div>

        {/* Loading Overlay */}
        {(isLoading || stpOperation) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90 animate-spin" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200" />
                    <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="220" strokeDashoffset="60" className="text-blue-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {stpOperation ? "Processing Analysis" : "Loading Resources"}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {stpOperation ? "Analyzing data and generating results..." : "Fetching map data..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50/95 backdrop-blur-md border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-2xl flex items-center max-w-sm mx-2">
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