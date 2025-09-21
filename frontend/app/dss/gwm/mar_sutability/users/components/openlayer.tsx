import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import GeoJSON from "ol/format/GeoJSON";
import Image from "next/image";
import { Circle as CircleStyle, Icon } from "ol/style";
import Feature from "ol/Feature";
import { FeatureLike } from "ol/Feature";
import Geometry from "ol/geom/Geometry";
import { fromLonLat, transform } from "ol/proj";
import Overlay from "ol/Overlay";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { GISCompass } from "@/components/MapComponents";
import { Style, Fill, Stroke, Text } from "ol/style";
import { useMap } from "@/contexts/mar_sutability/users/DrainMapContext";
import { useCategory } from "@/contexts/mar_sutability/admin/CategoryContext";
import "ol/ol.css";
import { useRiverSystem } from "@/contexts/mar_sutability/users/DrainContext";
import { baseMaps } from "@/components/MapComponents";
interface LayerColorConfig {
  color: string;
  name: string;
  fill: string;
}

interface LayerColorsType {
  [key: string]: LayerColorConfig;
}



const LAYER_COLORS: LayerColorsType = {
  primary: {
    color: "#3b82f6",
    name: "India Layer",
    fill: "rgba(59, 130, 246, 0.3)",
  },
  river: { color: "#1E40AF", name: "Rivers", fill: "rgba(30, 64, 175, 0.3)" },
  stretch: {
    color: "#059669",
    name: "Stretches",
    fill: "rgba(5, 150, 105, 0.3)",
  },
  drain: { color: "#DC2626", name: "Drains", fill: "rgba(220, 38, 38, 0.3)" },
  catchment: {
    color: "#7C2D12",
    name: "Catchments",
    fill: "rgba(124, 45, 18, 0.3)",
  },
  raster: {
    color: "#7C3AED",
    name: "Raster Layer",
    fill: "rgba(124, 58, 237, 0.3)",
  },
};


const createGeometryBasedStyle = (
  feature: Feature<Geometry>,
  layerType: string,
  showLabels: boolean = false
): Style => {
  const geometry = feature.getGeometry();
  const geometryType = geometry?.getType();
  const colorConfig = LAYER_COLORS[layerType] || LAYER_COLORS.primary;

  // Get feature name for labeling
  const featureName = feature.get("Name");

  const baseStyle = (() => {
    switch (geometryType) {
      case "Point":
      case "MultiPoint":
        return new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({
              color: colorConfig.color,
            }),
            stroke: new Stroke({
              color: "#ffffff",
              width: 2,
            }),
          }),
        });

      case "LineString":
      case "MultiLineString":
        return new Style({
          stroke: new Stroke({
            color: colorConfig.color,
            width: 3,
            lineDash: geometryType === "MultiLineString" ? [5, 5] : undefined,
          }),
        });

      case "Polygon":
      case "MultiPolygon":
        return new Style({
          fill: new Fill({
            color: colorConfig.fill,
          }),
          stroke: new Stroke({
            color: colorConfig.color,
            width: 2,
          }),
        });

      default:
        return new Style({
          fill: new Fill({
            color: colorConfig.fill,
          }),
          stroke: new Stroke({
            color: colorConfig.color,
            width: 2,
          }),
        });
    }
  })();

  // Add text style if labels should be shown and feature has a name
  if (showLabels && featureName) {
    baseStyle.setText(
      new Text({
        text: featureName.toString(),
        font: "12px Calibri,sans-serif",
        fill: new Fill({
          color: "#000000",
        }),
        stroke: new Stroke({
          color: "#ffffff",
          width: 3,
        }),
        offsetY: -15,
        textAlign: "center",
      })
    );
  }

  return baseStyle;
};

const Maping: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const boundarylayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  // Individual layer refs for river system
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drainLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const catchmentLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});

  // Popup overlay ref for showing feature names
  const popupOverlayRef = useRef<Overlay | null>(null);
  const popupElementRef = useRef<HTMLDivElement | null>(null);

  // Loading states
  const [primaryLayerLoading, setPrimaryLayerLoading] = useState<boolean>(true);
  const [riverLayerLoading, setRiverLayerLoading] = useState<boolean>(false);
  const [stretchLayerLoading, setStretchLayerLoading] =
    useState<boolean>(false);
  const [drainLayerLoading, setDrainLayerLoading] = useState<boolean>(false);
  const [catchmentLayerLoading, setCatchmentLayerLoading] =
    useState<boolean>(false);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [showTitles, setshowTitles] = useState<boolean>(false);
  // Feature counts
  const [primaryFeatureCount, setPrimaryFeatureCount] = useState<number>(0);
  const [riverFeatureCount, setRiverFeatureCount] = useState<number>(0);
  const [stretchFeatureCount, setStretchFeatureCount] = useState<number>(0);
  const [drainFeatureCount, setDrainFeatureCount] = useState<number>(0);
  const [catchmentFeatureCount, setCatchmentFeatureCount] = useState<number>(0);

  // UI states
  const [error, setError] = useState<string | null>(null);
  const [layerOpacity, setLayerOpacity] = useState<number>(70);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<any>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showLayerList, setShowLayerList] = useState<boolean>(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedradioLayer, setSelectedradioLayer] = useState("");

  // Layer visibility states
  const [showRiverLayer, setShowRiverLayer] = useState<boolean>(true);
  const [showStretchLayer, setShowStretchLayer] = useState<boolean>(true);
  const [showDrainLayer, setShowDrainLayer] = useState<boolean>(true);
  const [showCatchmentLayer, setShowCatchmentLayer] = useState<boolean>(true);
  const [buttonClicked, setButtonClicked] = useState(false);
  // Label and zoom states
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(6);

    const captureMapImage = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mapInstanceRef.current) {
        reject(new Error('Map instance not available'));
        return;
      }

      const map = mapInstanceRef.current;
      
      // Wait for map to finish rendering
      map.once('rendercomplete', () => {
        try {
          // Get the map canvas
          const mapCanvas = document.createElement('canvas');
          const mapContext = mapCanvas.getContext('2d');
          
          if (!mapContext) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Set canvas size to match map size
          const mapSize = map.getSize();
          if (!mapSize) {
            reject(new Error('Could not get map size'));
            return;
          }

          mapCanvas.width = mapSize[0];
          mapCanvas.height = mapSize[1];

          // Get all canvas elements from the map
          const mapContainer = map.getTargetElement();
          if (!mapContainer) {
            reject(new Error('Could not get map container'));
            return;
          }

          const canvases = mapContainer.querySelectorAll('canvas');
          
          // Composite all canvases
          Array.from(canvases).forEach((canvas) => {
            if (canvas.width > 0 && canvas.height > 0) {
              const opacity = canvas.style.opacity || canvas.getAttribute('style')?.match(/opacity:\s*([\d.]+)/)?.[1] || '1';
              const previousAlpha = mapContext.globalAlpha;
              mapContext.globalAlpha = parseFloat(opacity);
              
              try {
                mapContext.drawImage(canvas, 0, 0);
              } catch (error) {
                console.warn('Could not draw canvas:', error);
              }
              
              mapContext.globalAlpha = previousAlpha;
            }
          });

          // Convert to base64
          const imageData = mapCanvas.toDataURL('image/png', 0.9);
          resolve(imageData);
        } catch (error) {
          reject(error);
        }
      });

      // Trigger a render to ensure all layers are drawn
      map.renderSync();
    });
  };

  useEffect(() => {
    // Make the capture function available globally or through context
    if (typeof window !== 'undefined') {
      (window as any).captureMapImage = captureMapImage;
    }
  }, []);

  // Context hooks
  const {
    selectedRiver,
    selectedStretches,
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
    boundarylayer,
    stretchLayer,
    drainLayer,
    catchmentLayer,
    riverFilter,
    stretchFilter,
    drainFilter,
    catchmentFilter,
    geoServerUrl,
    defaultWorkspace,
    isMapLoading,
    setstpOperation,
    stpOperation,
    loading,
    setLoading,
    shouldLoadAllLayers,
    hasSelections,
  } = useMap();

  const { selectedCategory } = useCategory();

  // Constants
  const INDIA_CENTER_LON = 78.9629;
  const INDIA_CENTER_LAT = 20.5937;
  const INITIAL_ZOOM = 6;
  const LABEL_ZOOM_THRESHOLD = 20;

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper functions
  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    if (!isFullScreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  const handleClick = () => {
  setButtonClicked(true);  // Hide the button
  opencatchment();         
};
  const togglePanel = (panelName: string) => {
    if (activePanel === panelName) {
      setActivePanel(null);
    } else {
      setActivePanel(panelName);
    }
  };

  const openlayertoggle = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const opencatchment = () => {
    setButtonClicked(true);
    if (selectedDrains.length > 0) {
      setShowCatchment(true);
    }
  };

  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
    console.log("Selected layer:", layerName);
  };

  // Layer toggle functions
  const toggleRiverLayer = () => {
    if (riverLayerRef.current) {
      const newVisibility = !showRiverLayer;
      riverLayerRef.current.setVisible(newVisibility);
      setShowRiverLayer(newVisibility);
    }
  };

  const toggleStretchLayer = () => {
    if (stretchLayerRef.current) {
      const newVisibility = !showStretchLayer;
      stretchLayerRef.current.setVisible(newVisibility);
      setShowStretchLayer(newVisibility);
    }
  };

  const toggleDrainLayer = () => {
    if (drainLayerRef.current) {
      const newVisibility = !showDrainLayer;
      drainLayerRef.current.setVisible(newVisibility);
      setShowDrainLayer(newVisibility);
    }
  };

  const toggleCatchmentLayer = () => {
    if (catchmentLayerRef.current) {
      const newVisibility = !showCatchmentLayer;
      catchmentLayerRef.current.setVisible(newVisibility);
      setShowCatchmentLayer(newVisibility);
    }
  };

  // Setup popup overlay for feature names
  const setupPopupOverlay = () => {
    if (!mapInstanceRef.current) return;

    // Create popup element
    const popupElement = document.createElement("div");
    popupElement.className = "ol-popup";
    popupElement.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      max-width: 200px;
      word-wrap: break-word;
      z-index: 1000;
    `;
    popupElementRef.current = popupElement;

    // Create overlay
    const overlay = new Overlay({
      element: popupElement,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    });

    mapInstanceRef.current.addOverlay(overlay);
    popupOverlayRef.current = overlay;

    // Add click handler to show feature info
    mapInstanceRef.current.on("click", (event) => {
      const feature = mapInstanceRef.current!.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature,
        {
          layerFilter: (layer) => {
            return (
              layer === riverLayerRef.current ||
              layer === stretchLayerRef.current ||
              layer === drainLayerRef.current ||
              layer === catchmentLayerRef.current
            );
          },
        }
      );

      if (feature) {
        const featureName =
          feature.get("name") ||
          feature.get("Name")
        popupElement.innerHTML = featureName.toString();
        overlay.setPosition(event.coordinate);
      } else {
        overlay.setPosition(undefined);
      }
    });

    // Add pointer cursor on hover
    mapInstanceRef.current.on("pointermove", (event) => {
      const pixel = mapInstanceRef.current!.getEventPixel(event.originalEvent);
      const hit = mapInstanceRef.current!.hasFeatureAtPixel(pixel, {
        layerFilter: (layer) => {
          return (
            layer === riverLayerRef.current ||
            layer === stretchLayerRef.current ||
            layer === drainLayerRef.current ||
            layer === catchmentLayerRef.current
          );
        },
      });

      (mapInstanceRef.current!.getTarget() as HTMLElement).style.cursor = hit
        ? "pointer"
        : "";
    });
  };

  // Change base map
  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;

    mapInstanceRef.current.removeLayer(baseLayerRef.current);

    const baseMapConfig = baseMaps[baseMapKey];
    const newBaseLayer = new TileLayer({
      source: baseMapConfig.source(),
      zIndex: 0,
      properties: {
        type: "base",
      },
    });

    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
    setSelectedBaseMap(baseMapKey);
  };

  // Helper function to update overall loading state
  const updateLoadingState = () => {
    setLoading(
      riverLayerLoading ||
        stretchLayerLoading ||
        drainLayerLoading ||
        catchmentLayerLoading ||
        rasterLoading
    );
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
      properties: {
        type: "base",
      },
    });

    baseLayerRef.current = initialBaseLayer;

    // Add CSS for animations and popup
    const css = `
      .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
      .animate-slide-in-right { animation: slideInRight 0.5s ease-in-out; }
      .animate-slide-up { animation: slideUp 0.5s ease-in-out; }
      .animate-float { animation: float 3s ease-in-out infinite; }
      .animate-fade-in-down { animation: fadeInDown 0.5s ease-in-out; }
      
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideInRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
      @keyframes fadeInDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      
      .ol-popup { position: relative; }
      .ol-popup:after, .ol-popup:before {
        top: 100%; border: solid transparent; content: " "; height: 0; width: 0; position: absolute; pointer-events: none;
      }
      .ol-popup:after {
        border-color: rgba(255, 255, 255, 0); border-top-color: rgba(255, 255, 255, 0.95); border-width: 10px; left: 48px; margin-left: -10px;
      }
      .ol-popup:before {
        border-color: rgba(0, 0, 0, 0); border-top-color: rgba(0, 0, 0, 0.1); border-width: 11px; left: 48px; margin-left: -11px;
      }
    `;

    const styleElement = document.createElement("style");
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    const controls = defaultControls().extend([
      new ScaleLine({
        units: "metric",
        bar: true,
        steps: 4,
        minWidth: 140,
      }),
      new MousePosition({
        coordinateFormat: (coordinate) => {
          if (!coordinate) return "No coordinates";
          const [longitude, latitude] = coordinate;
          return `Lat: ${latitude.toFixed(6)}° | Long: ${longitude.toFixed(
            6
          )}°`;
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
        center: fromLonLat([INDIA_CENTER_LON, INDIA_CENTER_LAT]),
        zoom: INITIAL_ZOOM,
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    mapInstanceRef.current = map;
    setupPopupOverlay();

    // Listen for zoom changes to toggle labels
    map.getView().on("change:resolution", () => {
      const zoom = map.getView().getZoom() || 0;
      setCurrentZoom(zoom);
      const shouldShowLabels = zoom > LABEL_ZOOM_THRESHOLD;

      if (shouldShowLabels !== showLabels) {
        setShowLabels(shouldShowLabels);

        [
          riverLayerRef,
          stretchLayerRef,
          drainLayerRef,
          catchmentLayerRef,
        ].forEach((layerRef, index) => {
          if (layerRef.current) {
            const layerTypes = ["river", "stretch", "drain", "catchment"];
            const layerType = layerTypes[index];

            layerRef.current.setStyle((feature: FeatureLike) => {
              return createGeometryBasedStyle(
                feature as Feature<Geometry>,
                layerType,
                shouldShowLabels
              );
            });
          }
        });
      }
    });

    setTimeout(() => {
      setLoading(false);
      setPrimaryLayerLoading(false);
    }, 500);

    return () => {
      if (map) {
        map.setTarget("");
      }
    };
  }, []);

  // Load primary layer (India layer)
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) return;

    setPrimaryLayerLoading(true);
    setError(null);

    const primaryWfsUrl =
      `/geoserver/api/wfs?` +
      "service=WFS&" +
      "version=1.1.0&" +
      "request=GetFeature&" +
      `typeName=${defaultWorkspace}:${primaryLayer}&` +
      "outputFormat=application/json&" +
      "srsname=EPSG:3857";

    const boundarylayerurl =
      `/geoserver/api/wfs?` +
      "service=WFS&" +
      "version=1.1.0&" +
      "request=GetFeature&" +
      `typeName=${defaultWorkspace}:${boundarylayer}&` +
      "outputFormat=application/json&" +
      "srsname=EPSG:3857";

    const primaryVectorStyle = new Style({
      stroke: new Stroke({
        color: "#3b82f6",
        width: 2,
      }),
    });

    const boundaryVectorStyle = new Style({
      stroke: new Stroke({
        color: "#301934",
        width: 3,
      }),
    });

    const primaryVectorSource = new VectorSource({
      format: new GeoJSON(),
      url: primaryWfsUrl,
    });
    const boundaryVectorSource = new VectorSource({
      format: new GeoJSON(),
      url: boundarylayerurl,
    });

    const primaryVectorLayer = new VectorLayer({
      source: primaryVectorSource,
      style: primaryVectorStyle,
      zIndex: 1,
      visible: true,
    });

    const boundaryVectorLayer = new VectorLayer({
      source: boundaryVectorSource,
      style: boundaryVectorStyle,
      zIndex: 2,
      visible: true,
    });

    const handleFeaturesError = (err: any) => {
      console.log("Error loading primary features:", err);
      setPrimaryLayerLoading(false);
      setError("Failed to load primary features");
      updateLoadingState();
    };

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setPrimaryFeatureCount(numFeatures);
      setPrimaryLayerLoading(false);
      updateLoadingState();

      const primaryExtent = primaryVectorSource.getExtent();
      if (primaryExtent && primaryExtent.some((val) => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(primaryExtent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };

    primaryVectorSource.on("featuresloaderror", handleFeaturesError);
    primaryVectorSource.on("featuresloadend", handleFeaturesLoaded);

    mapInstanceRef.current.addLayer(boundaryVectorLayer);
    mapInstanceRef.current.addLayer(primaryVectorLayer);

    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
    }

    return () => {
      primaryVectorSource.un("featuresloaderror", handleFeaturesError);
      primaryVectorSource.un("featuresloadend", handleFeaturesLoaded);
    };
  }, [geoServerUrl, defaultWorkspace, primaryLayer, boundarylayer]);

  // Create river system layer helper
  const createRiverSystemLayer = (
    layerName: string | null,
    layerRef: React.MutableRefObject<VectorLayer<VectorSource> | null>,
    setFeatureCount: (count: number) => void,
    setLoading: (loading: boolean) => void,
    layerType: string,
    zIndex: number,
    isVisible: boolean,
    layerFilter: {
      filterField: string | null;
      filterValue: number[] | string[] | null;
    }
  ): (() => void) | void => {
    if (!mapInstanceRef.current || !layerName) {
      setFeatureCount(0);
      setLoading(false);
      if (layerRef.current) {
        mapInstanceRef.current?.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      updateLoadingState();
      return;
    }

    console.log("Creating layer with filter:", layerFilter);

    let wfsUrl =
      `/geoserver/api/wfs?` +
      "service=WFS&" +
      "version=1.1.0&" +
      "request=GetFeature&" +
      `typeName=${defaultWorkspace}:${layerName}&` +
      "outputFormat=application/json&" +
      "srsname=EPSG:3857";

    if (
      layerFilter.filterField &&
      layerFilter.filterValue &&
      layerFilter.filterValue.length > 0
    ) {
      wfsUrl += `&CQL_FILTER=${layerFilter.filterField} IN (${
        Array.isArray(layerFilter.filterValue)
          ? layerFilter.filterValue.map((v) => `'${v}'`).join(",")
          : `'${layerFilter.filterValue}'`
      })`;
      console.log(`Applied filter for ${layerName}:`, layerFilter);
    } else {
      console.log(`No filter applied for ${layerName} - showing all features`);
    }

    const vectorStyleFunction = (feature: FeatureLike): Style => {
      return createGeometryBasedStyle(
        feature as Feature<Geometry>,
        layerType,
        showLabels
      );
    };

    const vectorSource = new VectorSource({
      url: wfsUrl,
      format: new GeoJSON(),
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: vectorStyleFunction,
      zIndex: zIndex,
      visible: isVisible,
    });

    const handleFeaturesError = (err: any): void => {
      console.log(`Error loading ${layerName} features:`, err);
      setLoading(false);
      updateLoadingState();
    };

    const handleFeaturesLoaded = (event: any): void => {
      const numFeatures = event.features ? event.features.length : 0;
      console.log(`Loaded ${numFeatures} features for ${layerName}`);

      if (hasSelections && numFeatures > 0) {
        const extent = vectorSource.getExtent();
        if (extent && extent.some((val: number) => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }

      setFeatureCount(numFeatures);
      setLoading(false);
      updateLoadingState();
    };

    vectorSource.on("featuresloaderror", handleFeaturesError);
    vectorSource.on("featuresloadend", handleFeaturesLoaded);

    if (layerRef.current) {
      mapInstanceRef.current.removeLayer(layerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    layerRef.current = vectorLayer;

    return (): void => {
      vectorSource.un("featuresloaderror", handleFeaturesError);
      vectorSource.un("featuresloadend", handleFeaturesLoaded);
      vectorSource.clear();
      if (layerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      setLoading(false);
    };
  };

  // Handle river system layers
  useEffect(() => {
    return createRiverSystemLayer(
      riverLayer,
      riverLayerRef,
      setRiverFeatureCount,
      setRiverLayerLoading,
      "river",
      10,
      showRiverLayer,
      riverFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      }
    );
  }, [
    riverLayer,
    riverFilter.filterField,
    riverFilter.filterValue,
    showRiverLayer,
    showLabels,
  ]);

  useEffect(() => {
    return createRiverSystemLayer(
      stretchLayer,
      stretchLayerRef,
      setStretchFeatureCount,
      setStretchLayerLoading,
      "stretch",
      5,
      showStretchLayer,
      stretchFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      }
    );
  }, [
    stretchLayer,
    stretchFilter.filterField,
    stretchFilter.filterValue,
    showStretchLayer,
    showLabels,
  ]);

  useEffect(() => {
    return createRiverSystemLayer(
      drainLayer,
      drainLayerRef,
      setDrainFeatureCount,
      setDrainLayerLoading,
      "drain",
      6,
      showDrainLayer,
      drainFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      }
    );
  }, [
    drainLayer,
    drainFilter.filterField,
    drainFilter.filterValue,
    showDrainLayer,
    showLabels,
  ]);

  useEffect(() => {
    return createRiverSystemLayer(
      catchmentLayer,
      catchmentLayerRef,
      setCatchmentFeatureCount,
      setCatchmentLayerLoading,
      "catchment",
      7,
      showCatchmentLayer,
      catchmentFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      }
    );
  }, [
    catchmentLayer,
    catchmentFilter.filterField,
    catchmentFilter.filterValue,
    showCatchmentLayer,
    showLabels,
  ]);

  // Handle STP operation
  useEffect(() => {
    if (!mapInstanceRef.current || !stpOperation) return;

    const performSTP = async () => {
      setRasterLoading(true);
      setError(null);
      //setStpProcess(true);

      const bodyPayload = JSON.stringify({
        data: selectedCategory,
        clip: selectedCatchments,
        place: "Drain",
      });

      console.log("Sending STP request for:", bodyPayload);

      try {
        const resp = await fetch(
          "/api/gwz_operation/mar_sutability",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bodyPayload,
          }
        );

        if (!resp.ok) {
          throw new Error(`STP operation failed with status: ${resp.status}`);
        }

        const result = await resp.json();
        console.log("STP operation result:", result);

        if (result && result.status === "success") {
          const append_data = {
            file_name: "mar_sutability",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };
          setTableData(result.csv_details);

          const index = displayRaster.findIndex(
            (item) => item.file_name === "mar_sutability"
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
          setShowLegend(true);
        } else {
          console.log("STP operation did not return success:", result);
          setError(`STP operation failed: ${result.status || "Unknown error"}`);
          setRasterLoading(false);
        }
      } catch (error: any) {
        console.log("Error performing STP operation:", error);
        setError(`Error communicating with STP service: ${error.message}`);
        setRasterLoading(false);
        setShowTable(false);
      } finally {
        setstpOperation(false);
        //setStpProcess(false);
      }
    };

    performSTP();
  }, [
    stpOperation,
    selectedCategory,
    selectedCatchments,
    selectedDrains,
    selectedStretches,
    selectedRiver,
  ]);

  // Handle raster layer display
  useEffect(() => {
    console.log("rasterLayerInfo", rasterLayerInfo);

    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    Object.entries(layersRef.current).forEach(([id, layer]: [string, any]) => {
      map.removeLayer(layer);
      delete layersRef.current[id];
    });

    if (!rasterLayerInfo) {
      setRasterLoading(false);
      setLegendUrl(null);
      return;
    }

    try {
      const layerUrl = "/geoserver/api//wms";
      const workspace = rasterLayerInfo.workspace || "raster_work";
      const layerName =
        rasterLayerInfo.layer_name ||
        rasterLayerInfo.layerName ||
        rasterLayerInfo.id ||
        "Clipped_STP_Priority_Map";
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
        //crossOrigin: 'anonymous', // Add this
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
        setRasterLoading(false);
        console.log(`Raster layer added: ${fullLayerName}`);
      }, 100);
    } catch (error: any) {
      console.log("Error setting up raster layer:", error);
      setError(`Error setting up raster layer: ${error.message}`);
      setRasterLoading(false);
    }
  }, [rasterLayerInfo, layerOpacity]);

  // Handle radio layer selection
  useEffect(() => {
    console.log("traster name", displayRaster);
    displayRaster.map((item: any) => {
      if (item.file_name == selectedradioLayer) {
        console.log("selected items", item);
        setRasterLayerInfo(item);
      }
    });
    console.log("new update data", displayRaster);
  }, [selectedradioLayer]);

  // Handle opacity change
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value);
    setLayerOpacity(newOpacity);
    Object.values(layersRef.current).forEach((layer: any) => {
      layer.setOpacity(newOpacity / 100);
    });
  };

  // Clear raster layers when displayRaster changes
  useEffect(() => {
    console.log("rasterLayerInfo", rasterLayerInfo);

    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

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
  }, [displayRaster]);

  const getLegendPositionClass = () => {
    return "bottom-16 right-16";
  };

  return (
    <div className="relative w-full h-[600px] flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div
        className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200"
        ref={containerRef}
      >
        <div ref={mapRef} className="w-full h-full bg-blue-50" />
          <div className="hidden md:block">
          <GISCompass />
        </div>

        {/* Enhanced Floating Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-3 sm:px-6 py-3 flex items-center space-x-2 sm:space-x-4 transition-all duration-300 ease-in-out border border-white/20">
          <span className="font-bold text-gray-800 flex items-center text-sm sm:text-base">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <span className="hidden sm:inline">River System GIS</span>
            <span className="sm:hidden">River GIS</span>
          </span>

          {/* Zoom Level Indicator */}
          <div className="hidden sm:flex items-center bg-blue-50 px-3 py-1 rounded-lg">
            <span className="text-xs text-blue-700 font-medium">
              Zoom: {currentZoom.toFixed(1)}
            </span>
            {showLabels && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                Labels ON
              </span>
            )}
          </div>

          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => togglePanel("layers")}
              className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${
                activePanel === "layers"
                  ? "bg-blue-100 text-blue-600 shadow-inner"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
              title="Layers"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </button>

            <button
              onClick={() => togglePanel("basemap")}
              className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${
                activePanel === "basemap"
                  ? "bg-blue-100 text-blue-600 shadow-inner"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
              title="Base Maps"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z"
                />
              </svg>
            </button>

            <button
              onClick={() => togglePanel("tools")}
              className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 ${
                activePanel === "tools"
                  ? "bg-blue-100 text-blue-600 shadow-inner"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
              title="Tools"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            <button
              onClick={toggleFullScreen}
              className="p-2 sm:p-2.5 rounded-full hover:bg-gray-100 text-gray-700 transition-all duration-200 hover:scale-110"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            >
              {!isFullScreen ? (
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Layer Selection Panel - Top Right */}
        <div className="absolute right-2 sm:right-4 top-3">
          <button
            aria-label="Toggle panel"
            onClick={openlayertoggle}
            className="hover:opacity-80 transition-all duration-200 hover:scale-110 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20"
          >
            <Image
              src="/openlayerslogo.svg"
              alt="Logo"
              width={32}
              height={32}
              className="sm:w-10 sm:h-10"
            />
          </button>
        </div>

        {/* Layer Selection Dropdown */}
        {isPanelOpen && displayRaster.length > 0 && (
          <div className="absolute right-2 sm:right-4 top-16 sm:top-20 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl p-4 sm:p-6 w-72 sm:w-80 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-4a2 2 0 00-2-2H7m0-4h10a2 2 0 002-2V5a2 2 0 00-2-2H7m0 4V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Select Layer
              </h3>
              <button
                onClick={openlayertoggle}
                className="text-gray-400 hover:text-gray-600 text-xl rounded-full hover:bg-gray-100 p-2 transition-all duration-200"
                aria-label="Close panel"
              >
                ×
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {displayRaster.map((layer, index) => (
                <div
                  key={index}
                  className="flex items-center mb-3 p-3 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-200 transition-all duration-200 cursor-pointer"
                >
                  <input
                    type="radio"
                    id={`layer-${index}`}
                    name="layerSelection"
                    value={layer.file_name}
                    checked={selectedradioLayer === layer.file_name}
                    onChange={() => handleLayerSelection(layer.file_name)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 focus:ring-2"
                  />
                  <label
                    htmlFor={`layer-${index}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1 font-medium"
                  >
                    {layer.file_name}
                  </label>
                </div>
              ))}
            </div>

            {selectedradioLayer && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-blue-800 flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <strong>Selected:</strong>{" "}
                  <span className="ml-1 font-mono">{selectedradioLayer}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* catchment layer  */}
       {selectedDrains.length > 0 && !buttonClicked && (
  <button
    onClick={opencatchment}
    className="absolute left-2 sm:right-4 bottom-16 sm:bottom-20 flex items-center justify-center gap-2 text-gray-800 text-sm font-medium rounded-full bg-gray-100 px-3 py-2 w-48 sm:w-52 z-50 animate-in slide-in-from-top-2"
    aria-label="Open Catchment"
  >
    Analysis Catchment
  </button>
)}

        {/* Base Map Panel */}
        {activePanel === "basemap" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center text-lg">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Base Maps
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-2 hover:bg-gray-100 transition-all duration-200"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => changeBaseMap(key)}
                  className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all duration-200 border-2 ${
                    selectedBaseMap === key
                      ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 text-blue-700 transform scale-105 shadow-lg"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 hover:border-gray-300 hover:scale-102"
                  }`}
                >
                  <svg
                    className="w-6 h-6 sm:w-8 sm:h-8 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={baseMap.icon}
                    />
                  </svg>
                  <span className="text-xs sm:text-sm font-medium text-center leading-tight">
                    {baseMap.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Layers Panel */}
        {activePanel === "layers" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center text-lg">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-4a2 2 0 00-2-2H7m0-4h10a2 2 0 002-2V5a2 2 0 00-2-2H7m0 4V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                River System Layers
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-2 hover:bg-gray-100 transition-all duration-200"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* Primary Layer */}
              {primaryFeatureCount > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                      <span className="font-semibold text-blue-800">
                        India Layer
                      </span>
                    </div>
                    <span className="text-xs bg-blue-200/80 text-blue-800 px-3 py-1 rounded-full font-medium">
                      {primaryFeatureCount} features
                    </span>
                  </div>
                </div>
              )}

              {/* River Layer */}
              {riverFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showRiverLayer
                      ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showRiverLayer ? "bg-blue-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showRiverLayer ? "text-blue-800" : "text-gray-600"
                        }`}
                      >
                        Rivers{" "}
                        {hasSelections && riverFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showRiverLayer
                            ? "bg-blue-200/80 text-blue-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {riverFeatureCount} features
                      </span>
                      <button
                        onClick={toggleRiverLayer}
                        className={`w-12 h-6 rounded-full ${
                          showRiverLayer ? "bg-blue-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showRiverLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Stretch Layer */}
              {stretchFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showStretchLayer
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showStretchLayer ? "bg-green-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showStretchLayer ? "text-green-800" : "text-gray-600"
                        }`}
                      >
                        Stretches{" "}
                        {hasSelections && stretchFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showStretchLayer
                            ? "bg-green-200/80 text-green-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {stretchFeatureCount} features
                      </span>
                      <button
                        onClick={toggleStretchLayer}
                        className={`w-12 h-6 rounded-full ${
                          showStretchLayer ? "bg-green-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showStretchLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Drain Layer */}
              {drainFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showDrainLayer
                      ? "bg-gradient-to-r from-red-50 to-red-100 border-red-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showDrainLayer ? "bg-red-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showDrainLayer ? "text-red-800" : "text-gray-600"
                        }`}
                      >
                        Drains{" "}
                        {hasSelections && drainFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showDrainLayer
                            ? "bg-red-200/80 text-red-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {drainFeatureCount} features
                      </span>
                      <button
                        onClick={toggleDrainLayer}
                        className={`w-12 h-6 rounded-full ${
                          showDrainLayer ? "bg-red-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showDrainLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Catchment Layer */}
              {catchmentFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showCatchmentLayer
                      ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showCatchmentLayer ? "bg-yellow-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showCatchmentLayer
                            ? "text-yellow-800"
                            : "text-gray-600"
                        }`}
                      >
                        Catchments{" "}
                        {hasSelections && catchmentFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showCatchmentLayer
                            ? "bg-yellow-200/80 text-yellow-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {catchmentFeatureCount} features
                      </span>
                      <button
                        onClick={toggleCatchmentLayer}
                        className={`w-12 h-6 rounded-full ${
                          showCatchmentLayer ? "bg-yellow-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showCatchmentLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-purple-500 rounded-full mr-3 shadow-sm"></div>
                      <span className="font-semibold text-purple-800">
                        Raster Layer
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLegend(!showLegend)}
                      className={`text-xs px-3 py-2 rounded-full transition-all duration-200 font-medium ${
                        showLegend
                          ? "bg-purple-200/80 text-purple-800 shadow-inner"
                          : "bg-white/80 text-purple-700 hover:bg-purple-100/80"
                      }`}
                    >
                      {showLegend ? "Hide Legend" : "Show Legend"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-700 mb-2">
                      <span className="font-medium">Opacity</span>
                      <span className="font-semibold text-purple-700">
                        {layerOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      step={10}
                      value={layerOpacity}
                      onChange={handleOpacityChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Panel */}
        {activePanel === "tools" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center text-lg">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Map Tools
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-2 hover:bg-gray-100 transition-all duration-200"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleFullScreen}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:scale-105 hover:shadow-md"
              >
                <svg
                  className="w-8 h-8 mb-2 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Full Screen
                </span>
              </button>

              <button
                onClick={() => setShowLayerList(!showLayerList)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 border hover:scale-105 hover:shadow-md ${
                  showLayerList
                    ? "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border-blue-200"
                    : "bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 border-gray-200 hover:border-gray-300"
                }`}
              >
                <svg
                  className="w-8 h-8 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Layer List
                </span>
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(
                      fromLonLat([INDIA_CENTER_LON, INDIA_CENTER_LAT])
                    );
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:scale-105 hover:shadow-md"
              >
                <svg
                  className="w-8 h-8 mb-2 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Home View
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Layer List Panel */}
        {showLayerList && (
          <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-3 sm:p-4 w-64 sm:w-72 transition-all duration-300 ease-in-out animate-in slide-in-from-right-2 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-4a2 2 0 00-2-2H7m0-4h10a2 2 0 002-2V5a2 2 0 00-2-2H7m0 4V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Active Layers
              </h3>
              <button
                onClick={() => setShowLayerList(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100 transition-all duration-200"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {/* Primary Layer */}
              {primaryFeatureCount > 0 && (
                <div className="flex items-center p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                  <span className="text-xs font-semibold text-blue-800 flex-grow">
                    India Layer
                  </span>
                  <span className="text-xs bg-blue-200/80 text-blue-800 px-2 py-1 rounded-full font-medium">
                    {primaryFeatureCount}
                  </span>
                </div>
              )}

              {/* River System Layers in Layer List */}
              {riverFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showRiverLayer
                      ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showRiverLayer ? "bg-blue-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showRiverLayer ? "text-blue-800" : "text-gray-600"
                    }`}
                  >
                    Rivers{" "}
                    {hasSelections && riverFilter.filterValue
                      ? "(Filtered)"
                      : "(All)"}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showRiverLayer
                          ? "bg-blue-200/80 text-blue-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {riverFeatureCount}
                    </span>
                    <button
                      onClick={toggleRiverLayer}
                      className={`w-10 h-5 rounded-full ${
                        showRiverLayer ? "bg-blue-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showRiverLayer ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {stretchFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showStretchLayer
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showStretchLayer ? "bg-green-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showStretchLayer ? "text-green-800" : "text-gray-600"
                    }`}
                  >
                    Stretches{" "}
                    {hasSelections && stretchFilter.filterValue
                      ? "(Filtered)"
                      : "(All)"}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showStretchLayer
                          ? "bg-green-200/80 text-green-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {stretchFeatureCount}
                    </span>
                    <button
                      onClick={toggleStretchLayer}
                      className={`w-10 h-5 rounded-full ${
                        showStretchLayer ? "bg-green-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showStretchLayer ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Drain Layer */}
              {drainFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showDrainLayer
                      ? "bg-gradient-to-r from-red-50 to-red-100 border-red-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showDrainLayer ? "bg-red-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showDrainLayer ? "text-red-800" : "text-gray-600"
                        }`}
                      >
                        Drains{" "}
                        {hasSelections && drainFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showDrainLayer
                            ? "bg-red-200/80 text-red-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {drainFeatureCount} features
                      </span>
                      <button
                        onClick={toggleDrainLayer}
                        className={`w-12 h-6 rounded-full ${
                          showDrainLayer ? "bg-red-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showDrainLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Catchment Layer */}
              {catchmentFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showCatchmentLayer
                      ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showCatchmentLayer ? "bg-yellow-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showCatchmentLayer
                            ? "text-yellow-800"
                            : "text-gray-600"
                        }`}
                      >
                        Catchments{" "}
                        {hasSelections && catchmentFilter.filterValue
                          ? "(Filtered)"
                          : "(All)"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showCatchmentLayer
                            ? "bg-yellow-200/80 text-yellow-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {catchmentFeatureCount} features
                      </span>
                      <button
                        onClick={toggleCatchmentLayer}
                        className={`w-12 h-6 rounded-full ${
                          showCatchmentLayer ? "bg-yellow-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showCatchmentLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-purple-500 rounded-full mr-3 shadow-sm"></div>
                      <span className="font-semibold text-purple-800">
                        Raster Layer
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLegend(!showLegend)}
                      className={`text-xs px-3 py-2 rounded-full transition-all duration-200 font-medium ${
                        showLegend
                          ? "bg-purple-200/80 text-purple-800 shadow-inner"
                          : "bg-white/80 text-purple-700 hover:bg-purple-100/80"
                      }`}
                    >
                      {showLegend ? "Hide Legend" : "Show Legend"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-700 mb-2">
                      <span className="font-medium">Opacity</span>
                      <span className="font-semibold text-purple-700">
                        {layerOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      step={10}
                      value={layerOpacity}
                      onChange={handleOpacityChange}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Panel */}
        {activePanel === "tools" && (
          <div className="absolute top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm sm:max-w-md w-full mx-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 flex items-center text-lg">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Map Tools
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-2 hover:bg-gray-100 transition-all duration-200"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleFullScreen}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:scale-105 hover:shadow-md"
              >
                <svg
                  className="w-8 h-8 mb-2 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Full Screen
                </span>
              </button>

              <button
                onClick={() => setShowLayerList(!showLayerList)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 border hover:scale-105 hover:shadow-md ${
                  showLayerList
                    ? "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 border-blue-200"
                    : "bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 border-gray-200 hover:border-gray-300"
                }`}
              >
                <svg
                  className="w-8 h-8 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Layer List
                </span>
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(
                      fromLonLat([INDIA_CENTER_LON, INDIA_CENTER_LAT])
                    );
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:scale-105 hover:shadow-md"
              >
                <svg
                  className="w-8 h-8 mb-2 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Home View
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Layer List Panel */}
        {showLayerList && (
          <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-3 sm:p-4 w-64 sm:w-72 transition-all duration-300 ease-in-out animate-in slide-in-from-right-2 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-4a2 2 0 00-2-2H7m0-4h10a2 2 0 002-2V5a2 2 0 00-2-2H7m0 4V9a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Active Layers
              </h3>
              <button
                onClick={() => setShowLayerList(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100 transition-all duration-200"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {/* Primary Layer */}
              {primaryFeatureCount > 0 && (
                <div className="flex items-center p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                  <span className="text-xs font-semibold text-blue-800 flex-grow">
                    India Layer
                  </span>
                  <span className="text-xs bg-blue-200/80 text-blue-800 px-2 py-1 rounded-full font-medium">
                    {primaryFeatureCount}
                  </span>
                </div>
              )}

              {/* River System Layers in Layer List */}
              {riverFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showRiverLayer
                      ? "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showRiverLayer ? "bg-blue-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showRiverLayer ? "text-blue-800" : "text-gray-600"
                    }`}
                  >
                    Rivers{" "}
                    {hasSelections && riverFilter.filterValue
                      ? "(Filtered)"
                      : "(All)"}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showStretchLayer
                          ? "bg-green-200/80 text-green-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {stretchFeatureCount}
                    </span>
                    <button
                      onClick={toggleStretchLayer}
                      className={`w-10 h-5 rounded-full ${
                        showStretchLayer ? "bg-green-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showStretchLayer ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {drainFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showDrainLayer
                      ? "bg-gradient-to-r from-red-50 to-red-100 border-red-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showDrainLayer ? "bg-red-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showDrainLayer ? "text-red-800" : "text-gray-600"
                    }`}
                  >
                    Drains{" "}
                    {hasSelections && drainFilter.filterValue
                      ? "(Filtered)"
                      : "(All)"}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showDrainLayer
                          ? "bg-red-200/80 text-red-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {drainFeatureCount}
                    </span>
                    <button
                      onClick={toggleDrainLayer}
                      className={`w-10 h-5 rounded-full ${
                        showDrainLayer ? "bg-red-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showDrainLayer ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {catchmentFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showCatchmentLayer
                      ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showCatchmentLayer ? "bg-yellow-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showCatchmentLayer ? "text-yellow-800" : "text-gray-600"
                    }`}
                  >
                    Catchments{" "}
                    {hasSelections && catchmentFilter.filterValue
                      ? "(Filtered)"
                      : "(All)"}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showRiverLayer
                          ? "bg-blue-200/80 text-blue-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {riverFeatureCount}
                    </span>
                    <button
                      onClick={toggleCatchmentLayer}
                      className={`w-10 h-5 rounded-full ${
                        showCatchmentLayer ? "bg-yellow-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showCatchmentLayer ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Enhanced Raster Layer */}
              {rasterLayerInfo && (
                <div className="flex items-center p-3 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-3 shadow-sm"></div>
                  <span className="text-xs font-semibold text-purple-800 flex-grow">
                    Raster Layer
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    step={10}
                    value={layerOpacity}
                    onChange={handleOpacityChange}
                    className="w-16 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}

              {/* Enhanced Base Map Display */}
              <div className="flex items-center p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                <div className="w-3 h-3 bg-gray-500 rounded-full mr-3 shadow-sm"></div>
                <span className="text-xs font-semibold text-gray-800 flex-grow">
                  Base Map
                </span>
                <span className="text-xs bg-gray-200/80 text-gray-800 px-2 py-1 rounded-full font-medium">
                  {baseMaps[selectedBaseMap].name}
                </span>
              </div>
            </div>

            {/* Enhanced Quick Base Map Switcher */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                <svg
                  className="w-3 h-3 mr-1 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Quick Switch
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(baseMaps)
                  .slice(0, 3)
                  .map(([key, baseMap]) => (
                    <button
                      key={key}
                      onClick={() => changeBaseMap(key)}
                      className={`p-2 rounded-lg text-xs transition-all duration-200 border ${
                        selectedBaseMap === key
                          ? "bg-blue-500 text-white font-semibold border-blue-600 shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {baseMap.name.substring(0, 4)}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Legend Display - Mobile Responsive */}
        {showLegend && legendUrl && rasterLayerInfo && (
          <div
            className={`absolute z-20 bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-2xl ${getLegendPositionClass()} transition-all duration-500 ease-in-out transform hover:scale-105 animate-in fade-in-0 slide-in-from-bottom-2 border border-gray-200`}
            style={{ maxWidth: "280px" }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-700 flex items-center">
                <svg
                  className="h-4 w-4 mr-2 text-purple-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Legend
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none rounded-full hover:bg-gray-100 p-1.5 transition-all duration-200"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="legend-container overflow-hidden rounded-lg border border-gray-200">
              <img
                src={legendUrl}
                alt="Layer Legend"
                className="max-w-full h-auto hover:scale-105 transition-transform duration-300"
                onError={() => setError("Failed to load legend")}
              />
            </div>
          </div>
        )}

        {/* Enhanced Coordinates Display - Mobile Responsive */}
        <div className="absolute right-2 sm:right-4 bottom-2 sm:bottom-4 z-20 bg-white/95 backdrop-blur-md p-2 sm:p-3 rounded-lg shadow-lg border border-gray-200 transition-all duration-300 ease-in-out animate-in fade-in-0">
          <div className="flex items-center space-x-2">
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <div
              className="text-xs font-medium text-gray-800 font-mono"
              id="mouse-position"
            ></div>
          </div>
        </div>

        {/* Enhanced Error Message - Mobile Responsive */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50/95 backdrop-blur-md border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-2xl flex items-center transition-all duration-300 animate-in slide-in-from-bottom-2 max-w-sm mx-2">
            <svg
              className="w-5 h-5 mr-3 text-red-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-medium pr-8">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute right-2 top-2 text-red-400 hover:text-red-600 rounded-full p-1 transition-colors duration-200 hover:bg-red-100"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        @keyframes animate-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: animate-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Maping;
