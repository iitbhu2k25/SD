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
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { useMap } from "@/contexts/mar_suitability/users/DrainMapContext";
import { useCategory } from "@/contexts/mar_suitability/admin/CategoryContext";
import { useRiverSystem } from "@/contexts/mar_suitability/users/DrainContext";
import "ol/ol.css";
import { baseMaps, GISCompass, HoverTooltip } from "@/components/MapComponents";

const INDIA_CENTER = { lon: 78.9629, lat: 20.5937 };
const INITIAL_ZOOM = 6;

const LAYER_COLORS = {
  primary: { color: "#3b82f6", fill: "rgba(59, 130, 246, 0.3)" },
  river: { color: "#1E40AF", fill: "rgba(30, 64, 175, 0.3)" },
  stretch: { color: "#059669", fill: "rgba(5, 150, 105, 0.3)" },
  drain: { color: "#DC2626", fill: "rgba(220, 38, 38, 0.3)" },
  catchment: { color: "#7C2D12", fill: "rgba(124, 45, 18, 0.3)" },
};

const Maping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const boundaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drainLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const catchmentLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    river: 0,
    stretch: 0,
    drain: 0,
    catchment: 0,
  });
  const [layerVisibility, setLayerVisibility] = useState({
    river: true,
    stretch: true,
    drain: true,
    catchment: true,
  });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [buttonClicked, setButtonClicked] = useState(false);

  // Context hooks
  const {
    selectedDrains,
    selectedCatchments,
    displayRaster,
    setDisplayRaster,
    setShowTable,
    setTableData,
    setShowCatchment,
  } = useRiverSystem();

  const {
    primaryLayer,
    riverLayer,
    stretchLayer,
    drainLayer,
    catchmentLayer,
    riverFilter,
    stretchFilter,
    drainFilter,
    catchmentFilter,
    defaultWorkspace,
    setstpOperation,
    stpOperation,
    hasSelections,
  } = useMap();

  const { selectedCategory } = useCategory();

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
    setSelectedradioLayer(layerName);
    displayRaster.forEach((item: any) => {
      if (item.file_name === layerName) {
        setRasterLayerInfo(item);
      }
    });
  };

  const toggleLayerVisibility = (layerType: 'river' | 'stretch' | 'drain' | 'catchment') => {
    const layerRefs = {
      river: riverLayerRef,
      stretch: stretchLayerRef,
      drain: drainLayerRef,
      catchment: catchmentLayerRef,
    };

    const layerRef = layerRefs[layerType];
    if (layerRef.current) {
      const newVisibility = !layerVisibility[layerType];
      layerRef.current.setVisible(newVisibility);
      setLayerVisibility(prev => ({ ...prev, [layerType]: newVisibility }));
    }
  };

  const createVectorStyle = (layerType: string, isResult = false) => (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name");
    const styles = [];

    const colorConfig = LAYER_COLORS[layerType as keyof typeof LAYER_COLORS] || LAYER_COLORS.primary;

    if (geometryType.includes("Polygon")) {
      styles.push(new Style({
        stroke: new Stroke({ color: colorConfig.color, width: 2 }),
        fill: new Fill({ color: isResult ? colorConfig.fill : "transparent" })
      }));
    }

    if (geometryType.includes("LineString")) {
      styles.push(new Style({
        stroke: new Stroke({ color: colorConfig.color, width: 3 })
      }));
    }

    if (geometryType.includes("Point")) {
      styles.push(new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: colorConfig.color + "80" }),
          stroke: new Stroke({ color: colorConfig.color, width: 2 })
        })
      }));
    }

    if (showTitles && zoom > 8 && featureName) {
      styles.push(new Style({
        text: new Text({
          text: featureName.toString(),
          font: "12px Arial, sans-serif",
          fill: new Fill({ color: colorConfig.color }),
          stroke: new Stroke({ color: "#ffffff", width: 3 }),
          offsetY: geometryType.includes("Point") ? -20 : 0,
          textAlign: "center",
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
      filter: (feature, layer) => {
        // Exclude boundary layer from selection interactions
        return layer !== boundaryLayerRef.current && layer !== primaryLayerRef.current;
      }
    });

    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: '#ffaa00', width: 2 }),
        fill: new Fill({ color: 'transparent' })
      }),
      filter: (feature, layer) => {
        return layer !== boundaryLayerRef.current && layer !== primaryLayerRef.current;
      }
    });

    hoverInteraction.on('select', (event) => {
      setHoveredFeature(event.selected.length > 0 ? event.selected[0] : null);
    });

    map.on('pointermove', (event) => {
      setMousePosition({ x: event.pixel[0], y: event.pixel[1] });
    });

    map.addInteraction(selectInteraction);
    map.addInteraction(hoverInteraction);
    selectInteractionRef.current = selectInteraction;
    hoverInteractionRef.current = hoverInteraction;
    mapInstanceRef.current = map;

    setTimeout(() => setIsLoading(false), 500);

    return () => {
      if (map) map.setTarget("");
    };
  }, []);

  // Handle vector layers with simplified logic
  const handleVectorLayer = (
    layer: string | null,
    layerRef: React.MutableRefObject<VectorLayer<VectorSource> | null>,
    layerType: string,
    zIndex: number,
    isVisible: boolean,
    filter?: { filterField: string | null; filterValue: any }
  ) => {
    if (!mapInstanceRef.current || !layer) {
      setFeatureCounts(prev => ({ ...prev, [layerType]: 0 }));
      if (layerRef.current) {
        mapInstanceRef.current?.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    let wfsUrl = `/geoserver/api/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${layer}&outputFormat=application/json&srsname=EPSG:3857`;

    if (hasSelections && filter?.filterField && filter?.filterValue && filter.filterValue.length > 0) {
      wfsUrl += `&CQL_FILTER=${filter.filterField} IN (${Array.isArray(filter.filterValue)
        ? filter.filterValue.map((v) => `'${v}'`).join(",")
        : `'${filter.filterValue}'`
        })`;
    }

    const vectorSource = new VectorSource({
      url: wfsUrl,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle(layerType),
      zIndex: zIndex,
      visible: isVisible,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts(prev => ({ ...prev, [layerType]: numFeatures }));


      if (hasSelections && numFeatures > 0) {
        const extent = vectorSource.getExtent();
        if (extent && extent.every(val => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }
    };

    vectorSource.on("featuresloadend", handleFeaturesLoaded);
    vectorSource.on("featuresloaderror", () => setError(`Failed to load ${layerType} layer`));

    if (layerRef.current) {
      mapInstanceRef.current.removeLayer(layerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    layerRef.current = vectorLayer;
  };

  // Load layers
  useEffect(() => {
    handleVectorLayer(primaryLayer, primaryLayerRef, "primary", 1, true);
  }, [primaryLayer, defaultWorkspace]);

  useEffect(() => {
    handleVectorLayer(riverLayer, riverLayerRef, "river", 10, layerVisibility.river, riverFilter as any);
  }, [riverLayer, riverFilter, layerVisibility.river, showTitles]);

  useEffect(() => {
    handleVectorLayer(stretchLayer, stretchLayerRef, "stretch", 5, layerVisibility.stretch, stretchFilter as any);
  }, [stretchLayer, stretchFilter, layerVisibility.stretch, showTitles]);

  useEffect(() => {
    handleVectorLayer(drainLayer, drainLayerRef, "drain", 6, layerVisibility.drain, drainFilter as any);
  }, [drainLayer, drainFilter, layerVisibility.drain, showTitles]);

  useEffect(() => {
    handleVectorLayer(catchmentLayer, catchmentLayerRef, "catchment", 7, layerVisibility.catchment, catchmentFilter as any);
  }, [catchmentLayer, catchmentFilter, layerVisibility.catchment, showTitles]);

  // Load layers with initial zoom for primary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) {
      setFeatureCounts(prev => ({ ...prev, primary: 0 }));
      if (primaryLayerRef.current) {
        mapInstanceRef.current?.removeLayer(primaryLayerRef.current);
        primaryLayerRef.current = null;
      }
      return;
    }

    const wfsUrl = `/geoserver/api/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${primaryLayer}&outputFormat=application/json&srsname=EPSG:3857`;

    const vectorSource = new VectorSource({
      url: wfsUrl,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: createVectorStyle("primary"),
      zIndex: 1,
      visible: true,
    });

    vectorSource.once("featuresloadend", (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts(prev => ({ ...prev, primary: numFeatures }));

      if (numFeatures > 0) {
        const extent = vectorSource.getExtent();
        if (extent && extent.every(val => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }
    });

    vectorSource.on("featuresloaderror", () => setError("Failed to load primary layer"));

    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    primaryLayerRef.current = vectorLayer;
  }, [primaryLayer, defaultWorkspace]);
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    if (stpOperation) {
      const performSTP = async () => {
        const bodyPayload = JSON.stringify({
          data: selectedCategory,
          clip: selectedCatchments,
          place: "Drain",
        });
        try {
          const resp = await fetch(
            "/api/gwz_operation/mar_suitability",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: bodyPayload,
            }
          );

          if (!resp.ok) throw new Error(`Mar suitability operation failed: ${resp.status}`);

          const result = await resp.json();
          if (result && result.status === "success") {
            const append_data = {
              file_name: "mar_suitability",
              workspace: result.workspace,
              layer_name: result.layer_name,
            };
            setTableData(result.csv_details);

            const index = displayRaster.findIndex(
              (item) => item.file_name === "mar_suitability"
            );

            let newData;
            if (index !== -1) {
              newData = [...displayRaster];
              newData[index] = append_data;
            } else {
              newData = displayRaster.concat(append_data);
            }

            setDisplayRaster(newData);
            setRasterLayerInfo(result);
            handleLayerSelection(append_data.file_name);
            setShowTable(true);
          }
        } catch (error: any) {
          setError(`Mar suitability  failed: ${error.message}`);
        } finally {
          setstpOperation(false);
        }
      };

      performSTP();
      return;
    }

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
          zIndex: 3,
        });

        const layerId = `raster-${layerName}-${Date.now()}`;
        layersRef.current[layerId] = newLayer;
        map.addLayer(newLayer);
        map.renderSync();
      }, 100);
    } catch (error: any) {
      setError(`Error setting up raster layer: ${error.message}`);
    }
  }, [rasterLayerInfo, layerOpacity, stpOperation]);

  // Fullscreen event listener
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  const handleClick = () => {
    setButtonClicked(true);
    if (selectedDrains.length > 0) {
      setShowCatchment(true);
    }
  };



  return (
    <div className="relative w-full h-[600px] flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200" ref={containerRef}>
        <div ref={mapRef} className="w-full h-full bg-blue-50" />

        <div className="hidden md:block">
          <GISCompass />
        </div>
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

        {/* Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 flex items-center space-x-4">
          <span className="font-bold text-gray-800 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            River System GIS
          </span>

          <div className="flex space-x-2">
            {["layers", "basemap", "tools"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${activePanel === panel ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-700"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={panel === "layers" ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" :
                      panel === "basemap" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" :
                        "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"} />
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

        {/* Layer Selection Button */}
        <div className="absolute right-4 top-3">
          <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
            <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
          </button>
        </div>

        {/* Catchment Button */}
        {selectedDrains.length > 0 && !buttonClicked && (
          <button onClick={handleClick} className="absolute left-4 bottom-20 flex items-center justify-center gap-2 text-gray-800 text-sm font-medium rounded-full bg-gray-100 px-3 py-2 w-52 z-50">
            Analysis Catchment
          </button>
        )}

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
                  className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 border-2 ${selectedBaseMap === key ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-gray-50 hover:bg-gray-100 border-gray-200"}`}
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
              <h3 className="font-bold text-gray-800">River System Layers</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              {/* Primary Layer */}
              {featureCounts.primary > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-blue-800">India Layer</span>
                    </div>
                    <span className="text-xs bg-blue-200/80 text-blue-800 px-3 py-1 rounded-full">
                      {featureCounts.primary} features
                    </span>
                  </div>
                </div>
              )}

              {/* River Layer */}
              {featureCounts.river > 0 && (
                <div className={`p-4 rounded-xl border ${layerVisibility.river ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${layerVisibility.river ? "bg-blue-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${layerVisibility.river ? "text-blue-800" : "text-gray-600"}`}>
                        Rivers {hasSelections && riverFilter.filterValue ? "(Filtered)" : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${layerVisibility.river ? "bg-blue-200/80 text-blue-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.river} features
                      </span>
                      <button
                        onClick={() => toggleLayerVisibility('river')}
                        className={`w-12 h-6 rounded-full ${layerVisibility.river ? "bg-blue-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${layerVisibility.river ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stretch Layer */}
              {featureCounts.stretch > 0 && (
                <div className={`p-4 rounded-xl border ${layerVisibility.stretch ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${layerVisibility.stretch ? "bg-green-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${layerVisibility.stretch ? "text-green-800" : "text-gray-600"}`}>
                        Stretches {hasSelections && stretchFilter.filterValue ? "(Filtered)" : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${layerVisibility.stretch ? "bg-green-200/80 text-green-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.stretch} features
                      </span>
                      <button
                        onClick={() => toggleLayerVisibility('stretch')}
                        className={`w-12 h-6 rounded-full ${layerVisibility.stretch ? "bg-green-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${layerVisibility.stretch ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Drain Layer */}
              {featureCounts.drain > 0 && (
                <div className={`p-4 rounded-xl border ${layerVisibility.drain ? "bg-gradient-to-r from-red-50 to-red-100 border-red-200" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${layerVisibility.drain ? "bg-red-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${layerVisibility.drain ? "text-red-800" : "text-gray-600"}`}>
                        Drains {hasSelections && drainFilter.filterValue ? "(Filtered)" : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${layerVisibility.drain ? "bg-red-200/80 text-red-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.drain} features
                      </span>
                      <button
                        onClick={() => toggleLayerVisibility('drain')}
                        className={`w-12 h-6 rounded-full ${layerVisibility.drain ? "bg-red-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${layerVisibility.drain ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Catchment Layer */}
              {featureCounts.catchment > 0 && (
                <div className={`p-4 rounded-xl border ${layerVisibility.catchment ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${layerVisibility.catchment ? "bg-yellow-500" : "bg-gray-400"}`}></div>
                      <span className={`font-semibold ${layerVisibility.catchment ? "text-yellow-800" : "text-gray-600"}`}>
                        Catchments {hasSelections && catchmentFilter.filterValue ? "(Filtered)" : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs px-3 py-1 rounded-full ${layerVisibility.catchment ? "bg-yellow-200/80 text-yellow-800" : "bg-gray-200/80 text-gray-700"}`}>
                        {featureCounts.catchment} features
                      </span>
                      <button
                        onClick={() => toggleLayerVisibility('catchment')}
                        className={`w-12 h-6 rounded-full ${layerVisibility.catchment ? "bg-yellow-500" : "bg-gray-300"} relative transition-all duration-300`}
                      >
                        <span className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${layerVisibility.catchment ? "translate-x-6" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-purple-500 rounded-full mr-3"></div>
                      <span className="font-semibold text-purple-800">Raster Layer</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mb-2">
                    <span className="font-medium">Opacity</span>
                    <span className="font-semibold text-purple-700">{layerOpacity}%</span>
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
              <h3 className="font-bold text-gray-800">Map Tools</h3>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTitles(!showTitles)}
                className={`p-4 rounded-xl border ${showTitles ? "bg-green-100 border-green-200" : "bg-gray-100 border-gray-200"}`}
              >
                <span className="text-sm font-medium">Show Titles: {showTitles ? "ON" : "OFF"}</span>
              </button>
              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]));
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="p-4 rounded-xl bg-gray-100 border border-gray-200"
              >
                <span className="text-sm font-medium">Home View</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        {legendUrl && rasterLayerInfo && (
          <div className="absolute bottom-16 right-16 z-20 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-700">Legend</span>
              <button onClick={() => setLegendUrl(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <img src={legendUrl} alt="Layer Legend" className="max-w-full h-auto rounded-lg" />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-4 bottom-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <div className="text-xs font-medium text-gray-800 font-mono" id="mouse-position"></div>
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
      </div>
    </div>
  );
};

export default Maping;