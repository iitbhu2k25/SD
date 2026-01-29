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
import Select from "ol/interaction/Select";
import dynamic from 'next/dynamic';
import { toLonLat } from 'ol/proj';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { MarLayerInfo, MarSuitabilityResponse } from "@/interface/raster_context";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { useMap } from "@/contexts/mar_suitability/admin/MapContext";
import { useCategory } from "@/contexts/mar_suitability/admin/CategoryContext";
import { useLocation } from "@/contexts/mar_suitability/admin/LocationContext";
import "ol/ol.css";
import { baseMaps, GISCompass, HoverTooltip } from "@/components/MapComponents";
import { api } from "@/services/api";
import { toast } from "react-toastify";

const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;
const SubsurfaceBorehole = dynamic(
  () => import("@/app/dss/gwm/mar_suitability/component/layerDetails"),
  { ssr: false }
);
const Mapping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);

  // **NEW STATE** for vector interaction control
  const [vectorInteractionEnabled, setVectorInteractionEnabled] = useState(true);

  // Simplified state management
  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({ primary: 0, secondary: 0, result: 0 });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [showPrimaryLayer, setShowPrimaryLayer] = useState(true);
  const [showResultLayer, setShowResultLayer] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  // layer details
  const [boreholeData, setBoreholeData] = useState<MarLayerInfo[] | null>(null);
  const [boreholePosition, setBoreholePosition] = useState<{ x: number; y: number } | null>(null);
  const [isLoadingBorehole, setIsLoadingBorehole] = useState(false);
  const pinMarkerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const [pinCoordinate, setPinCoordinate] = useState<[number, number] | null>(null);
  // Context hooks
  const { displayRaster, selectionsLocked } = useLocation();
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    handleLayerSelection,
    resultLayer,
    selectedradioLayer,
    setMarSuitabilityData
  } = useMap();
  const { selectedCategory, setRasterLayerInfo, rasterLayerInfo, tableData } = useCategory();

  // **NEW FUNCTION** - Toggle vector interactions
  const toggleVectorInteraction = () => {
    const newState = !vectorInteractionEnabled;
    setVectorInteractionEnabled(newState);

    // Toggle interactions
    if (selectInteractionRef.current) {
      selectInteractionRef.current.setActive(newState);
    }
    if (hoverInteractionRef.current) {
      hoverInteractionRef.current.setActive(newState);
    }

    // Clear current selections when disabling
    if (!newState) {
      setHoveredFeature(null);
      selectInteractionRef.current?.getFeatures().clear();
      hoverInteractionRef.current?.getFeatures().clear();
    }

    console.log(`Vector interactions ${newState ? 'ENABLED' : 'DISABLED'}`);
  };

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

  const createVectorStyle = (isSecondary = false, isResult = false) => (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name") || feature.get("area_m2");
    const styles = [];

    let color = "#3b82f6"; // Primary blue
    if (isSecondary) color = "#5E1520"; // Secondary red
    if (isResult) color = "#10b981"; // Result green;

    const width = isSecondary ? 3 : 2;

    if (geometryType.includes("Polygon")) {
      styles.push(new Style({
        stroke: new Stroke({ color, width }),
        fill: new Fill({ color: isResult ? `${color}20` : "transparent" })
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

  // Rest of your existing useEffects remain the same...
  useEffect(() => {
    if (primaryLayerRef.current && featureCounts.secondary > 0) {
      primaryLayerRef.current.setVisible(!showSecondaryLayer);
    } else if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(true);
    }
  }, [showSecondaryLayer, featureCounts.secondary]);

  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current) return;
    if (selectionsLocked) {
      selectInteractionRef.current.setActive(false);
    }
  }, [selectionsLocked]);

  // **UPDATED** - Initialize map with interaction state management
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
          return `${latitude.toFixed(6)}°N, ${Longitude.toFixed(6)}°E`;
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

    // **UPDATED** - Interactions respect initial state
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

    // Set initial interaction state
    selectInteraction.setActive(vectorInteractionEnabled);
    hoverInteraction.setActive(vectorInteractionEnabled);

    hoverInteraction.on('select', (event) => {
      if (!vectorInteractionEnabled) return; // Skip when disabled
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

  // **NEW** - Sync interaction state changes
  useEffect(() => {
    if (selectInteractionRef.current) {
      selectInteractionRef.current.setActive(vectorInteractionEnabled);
    }
    if (hoverInteractionRef.current) {
      hoverInteractionRef.current.setActive(vectorInteractionEnabled);
    }
    if (!vectorInteractionEnabled) {
      setHoveredFeature(null);
    }
  }, [vectorInteractionEnabled]);

  // Handle layers with simplified logic
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
      zIndex: type === 'primary' ? 1 : type === 'secondary' ? 4 : 10,
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

  // Handle pin marker visualization
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove existing pin marker
    if (pinMarkerRef.current) {
      map.removeLayer(pinMarkerRef.current);
      pinMarkerRef.current = null;
    }

    // Add new pin marker if coordinate exists
    if (pinCoordinate) {
      const pinFeature = new Feature({
        geometry: new Point(pinCoordinate),
        name: 'Subsurface Analysis Point',
      });

      const pinSource = new VectorSource({
        features: [pinFeature],
      });

      const pinLayer = new VectorLayer({
        source: pinSource,
        style: new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 3
            }),
          }),
          // Optional: Add a label
          text: new Text({
            text: '📍',
            font: '24px serif',
            offsetY: -20,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({
              color: '#ffffff',
              width: 2
            }),
          }),
        }),
        zIndex: 1000, // Ensure it's on top
      });

      map.addLayer(pinLayer);
      pinMarkerRef.current = pinLayer;
    }

    return () => {
      if (pinMarkerRef.current) {
        map.removeLayer(pinMarkerRef.current);
        pinMarkerRef.current = null;
      }
    };
  }, [pinCoordinate]);
  // Handle raster layer and STP operation
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;


    // Clear existing raster layers
    Object.entries(layersRef.current).forEach(([id, layer]: [string, any]) => {
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
  }, [rasterLayerInfo, layerOpacity]);
  useEffect(() => {
    displayRaster.forEach((item: any) => {
      if (item.file_name === selectedradioLayer) {
        setRasterLayerInfo(item);
      }
    });
  }, [selectedradioLayer, displayRaster]);
  // Fullscreen event listener

  // Handle map clicks when vector interaction is disabled
  // Handle map clicks when vector interaction is disabled
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleMapClick = async (event: any) => {
      // Only handle clicks when vector interaction is disabled
      if (vectorInteractionEnabled) return;

      const coordinate = event.coordinate;
      const lonLat = toLonLat(coordinate);
      const [lon, lat] = lonLat;

      console.log('Map clicked at:', { lat, lon });

      // Store the coordinate for the pin marker
      setPinCoordinate(coordinate);

      // Calculate position for borehole (offset to the right of pin)
      const offsetX = 200; // pixels to the right of pin
      const offsetY = -130; // center vertically with pin

      setBoreholePosition({
        x: event.pixel[0] + offsetX,
        y: event.pixel[1] + offsetY
      });

      setIsLoadingBorehole(true);

      try {
        // Make API call to your backend
        const response = await api.post("/gwz_operation/mar_raster_details", {
          body: {
            lat: lat,
            lon: lon
          }
        })
        if (response.status > 201) {
          toast.error("No subsurface data found", { position: "top-center" });
        }

        const data = await response.message as MarSuitabilityResponse
        setBoreholeData(data.layers);
        setMarSuitabilityData(data.validation);
      } catch (error) {
        console.error('Error fetching raster values:', error);
        setError('Failed to load subsurface data');
        setBoreholeData(null);
        setPinCoordinate(null);
      } finally {
        setIsLoadingBorehole(false);
      }
    };

    const map = mapInstanceRef.current;
    map.on('singleclick', handleMapClick);

    return () => {
      map.un('singleclick', handleMapClick);
    };
  }, [vectorInteractionEnabled]);

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
        {/* The Map */}
        <div ref={mapRef} className="w-full h-full bg-blue-50" />

        {/* Components */}
        <div className="hidden md:block">
          <GISCompass />
        </div>
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

        {/* Header Panel - **UPDATED** with new button */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 flex items-center space-x-4">
          <span className="font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            GIS Viewer
          </span>

          <div className="flex space-x-1 sm:space-x-2">
            {/* **NEW BUTTON** - Disable Vector Interaction */}
            {tableData.length > 0 && (
              <button
                onClick={toggleVectorInteraction}
                className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 relative ${vectorInteractionEnabled
                  ? "bg-green-100 hover:bg-green-200 text-green-700"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-700"
                  }`}
                title={
                  vectorInteractionEnabled
                    ? "Switch to Subsurface Analysis Mode"
                    : "Switch to Vector Selection Mode (Click map to clear pin)"
                }
              >
                {!vectorInteractionEnabled && pinCoordinate && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                )}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {vectorInteractionEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
              </button>
            )}

            {["layers", "basemap", "tools"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`relative group p-2.5 rounded-full transition-all duration-200 hover:scale-110
    ${activePanel === panel
                    ? "bg-blue-100 text-blue-600 shadow-inner"
                    : "hover:bg-gray-100 text-gray-700"
                  }`}
              >
                {/* Icon */}
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={panel === "layers" ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" :
                      panel === "basemap" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" :
                        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"} />
                </svg>

                {/* Tooltip */}
                <span
                  className="absolute -bottom-9 left-1/2 -translate-x-1/2
      whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white
      opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {panel.charAt(0).toUpperCase() + panel.slice(1)}
                </span>
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

        {/* Layer Selection Button */}
        <div className="absolute right-4 top-3 group">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="hover:opacity-80 transition-all duration-200 hover:scale-110 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20 relative"
          >
            <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
            {/* Tooltip */}
            <span className="absolute  -bottom-10 -left-1 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              Raster Layers
            </span>
          </button>
        </div>

        {/* Base Map Panel */}
        {activePanel === "basemap" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-6 max-w-md w-full mx-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Base Maps</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => changeBaseMap(key)}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 border-2 ${selectedBaseMap === key ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                    }`}
                >
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                  </svg>
                  <span className="text-sm text-gray-700 font-medium">{baseMap.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Layer Panel */}
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
              <h3 className="font-bold text-gray-800">Map Layers</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              {featureCounts.primary > 0 && (
                <div
                  className={`p-4 rounded-xl border ${showPrimaryLayer
                    ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                    : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${showPrimaryLayer ? "bg-blue-500" : "bg-gray-400"
                          } rounded-full mr-3`}
                      ></div>
                      <span
                        className={`font-semibold ${showPrimaryLayer ? "text-blue-800" : "text-gray-600"
                          }`}
                      >
                        Primary Layer
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${showPrimaryLayer
                          ? "bg-blue-200/80 text-blue-800"
                          : "bg-gray-200/80 text-gray-700"
                          }`}
                      >
                        {featureCounts.primary} features
                      </span>

                      <button
                        onClick={() => {
                          const newPrimaryState = !showPrimaryLayer;
                          setShowPrimaryLayer(newPrimaryState);

                          // If turning primary ON, turn secondary OFF
                          if (newPrimaryState && showSecondaryLayer) {
                            setShowSecondaryLayer(false);
                            if (secondaryLayerRef.current) {
                              secondaryLayerRef.current.setVisible(false);
                            }
                          }

                          if (primaryLayerRef.current) {
                            primaryLayerRef.current.setVisible(newPrimaryState);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showPrimaryLayer ? "bg-blue-500" : "bg-gray-300"
                          } relative transition-all duration-300`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showPrimaryLayer ? "translate-x-6" : ""
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {featureCounts.secondary > 0 && (
                <div
                  className={`p-4 rounded-xl border ${showSecondaryLayer
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                    : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${showSecondaryLayer ? "bg-green-500" : "bg-gray-400"
                          } rounded-full mr-3`}
                      ></div>
                      <span
                        className={`font-semibold ${showSecondaryLayer ? "text-green-800" : "text-gray-600"
                          }`}
                      >
                        Secondary Layer
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${showSecondaryLayer
                          ? "bg-green-200/80 text-green-800"
                          : "bg-gray-200/80 text-gray-700"
                          }`}
                      >
                        {featureCounts.secondary} features
                      </span>

                      <button
                        onClick={() => {
                          const newSecondaryState = !showSecondaryLayer;
                          setShowSecondaryLayer(newSecondaryState);

                          // If turning secondary ON, turn primary OFF
                          if (newSecondaryState && showPrimaryLayer) {
                            setShowPrimaryLayer(false);
                            if (primaryLayerRef.current) {
                              primaryLayerRef.current.setVisible(false);
                            }
                          }

                          if (secondaryLayerRef.current) {
                            secondaryLayerRef.current.setVisible(newSecondaryState);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showSecondaryLayer ? "bg-green-500" : "bg-gray-300"
                          } relative transition-all duration-300`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showSecondaryLayer ? "translate-x-6" : ""
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Result Layer */}
              {featureCounts.result > 0 && (
                <div className={`p-4 rounded-xl border ${showResultLayer
                  ? "bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200"
                  : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${showResultLayer ? "bg-purple-500" : "bg-gray-400"
                        }`}></div>
                      <span className={`font-semibold ${showResultLayer ? "text-purple-800" : "text-gray-600"
                        }`}>Result Layer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${showResultLayer
                        ? "bg-purple-200/80 text-purple-800"
                        : "bg-gray-200/80 text-gray-700"
                        }`}>
                        {featureCounts.result} features
                      </span>
                      <button
                        onClick={() => {
                          setShowResultLayer(!showResultLayer);
                          if (resultLayerRef.current) {
                            resultLayerRef.current.setVisible(!showResultLayer);
                          }
                        }}
                        className={`w-12 h-6 rounded-full ${showResultLayer ? "bg-purple-500" : "bg-gray-300"
                          } relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showResultLayer ? "translate-x-6" : ""
                          }`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-purple-800">Raster Layer</span>
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
                <span className="text-sm font-medium">Display Labels</span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a2 2 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium">Home View</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {legendUrl && rasterLayerInfo && (
          <div
            className={`
              absolute bottom-16 right-16 z-20
              bg-white/95 backdrop-blur-md
              p-2 rounded-xl shadow-2xl
              transition-all duration-200
              ${isFullScreen ? "w-[250px]" : "w-[150px]"}
            `}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-bold text-gray-700">Legend</span>
              <button
                onClick={() => setLegendUrl(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <Image
              src={legendUrl}
              alt="Layer Legend"
              width={200}     // max expected size
              height={300}
              className="w-full h-auto object-contain rounded-lg border border-gray-200"
              onErrorCapture={() => setError("Failed to load legend")}
              unoptimized
            />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            </svg>
            <div className="text-xs font-mono text-slate-100 " id="mouse-position"></div>
          </div>
        </div>
        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-xl flex items-center">
            <svg className="w-5 h-5 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium pr-8">{error}</span>
            <button onClick={() => setError(null)} className="absolute right-2 top-2 text-red-400 hover:text-red-600">×</button>
          </div>
        )}
        {/* Subsurface Borehole Visualization with Connection Line */}
        {!vectorInteractionEnabled && boreholePosition && boreholeData && pinCoordinate && (
          <>
            {/* Connection Line from Pin to Borehole */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 99,
              }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#3b82f6"
                  />
                </marker>
              </defs>
              <line
                x1={mapInstanceRef.current?.getPixelFromCoordinate(pinCoordinate)?.[0]}
                y1={mapInstanceRef.current?.getPixelFromCoordinate(pinCoordinate)?.[1]}
                x2={boreholePosition.x}
                y2={boreholePosition.y + 130}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            </svg>

            {/* Borehole Component */}
            <div
              style={{
                position: 'absolute',
                left: boreholePosition.x - 70,
                top: boreholePosition.y,
                zIndex: 100,
                pointerEvents: 'none',
              }}
            >
              <div
                className="rounded-xl shadow-2xl border-2 border-blue-400/60 overflow-hidden backdrop-blur-sm"
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(255, 255, 255, 0.1)', // Very transparent background
                }}
              >
                {/* Header */}
                <div
                  className="px-3 py-2 flex items-center justify-between backdrop-blur-md"
                  style={{
                    background: 'rgba(59, 130, 246, 0.3)', // Semi-transparent blue
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-white font-semibold text-sm drop-shadow-lg">Subsurface Data</span>
                  </div>
                  <button
                    onClick={() => {
                      setBoreholeData(null);
                      setBoreholePosition(null);
                      setPinCoordinate(null);
                    }}
                    className="bg-white/30 hover:bg-white/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors backdrop-blur-sm"
                  >
                    ×
                  </button>
                </div>

                {/* Borehole Visualization - Fully transparent background */}
                <div
                  className="p-2"

                >
                  <SubsurfaceBorehole
                    data={boreholeData}
                    width={240}
                    height={260}
                    depthStep={0.3}
                  />
                </div>

                {/* Footer with coordinates */}
                <div
                  className="px-3 py-2 border-t border-white/30 backdrop-blur-md"
                  style={{
                    background: 'rgba(249, 250, 251, 0.3)', // Semi-transparent gray
                  }}
                >
                  <div className="text-xs text-white drop-shadow-lg">
                    <div className="font-mono font-semibold">
                      {toLonLat(pinCoordinate).map((coord, i) => (
                        <div key={i}>
                          {i === 1 ? 'Lat' : 'Lon'}: {coord.toFixed(6)}°
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Loading indicator for borehole data */}
        {isLoadingBorehole && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-md rounded-xl p-5 shadow-2xl border border-blue-200">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-600 absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-800">Analyzing Subsurface</div>
                <div className="text-xs text-gray-500 mt-1">Fetching raster data...</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Mapping;
