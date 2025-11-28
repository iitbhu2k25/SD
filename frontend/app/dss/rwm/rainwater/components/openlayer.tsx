import React, { use, useEffect, useRef, useState } from "react";
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

import { fromLonLat, transform } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";

import { Style, Fill, Stroke, Circle, Text, Icon } from "ol/style";
import { useMap } from "@/contexts/rainwater/MapContext";
import { useCategory } from "@/contexts/rainwater/CategoryContext";
import "ol/ol.css";
import { useLocation } from "@/contexts/rainwater/LocationContext";

import { Draw } from "ol/interaction";
import { Polygon } from "ol/geom";
import { getArea } from "ol/sphere";
import { reset } from "ol/transform";
// Define base map type interface
interface BaseMapDefinition {
  name: string;
  source: () => OSM | XYZ;
  thumbnail?: string;
  icon?: string;
}
interface MapingProps {
  isDrawing: boolean;
  setIsDrawing: (value: boolean) => void;
  coordinates: number[][] | null;
  setCoordinates: (coords: number[][] | null) => void;
  resetPolygon: boolean;
  setResetPolygon: (value: boolean) => void;
}

// Define baseMaps with appropriate TypeScript typing
const baseMaps: Record<string, BaseMapDefinition> = {
  osm: {
    name: "OpenStreetMap",
    source: () =>
      new OSM({
        crossOrigin: "anonymous",
      }),
    icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions: "Tiles © Esri",
        crossOrigin: "anonymous",
      }),
    icon: "M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.78 4.11 2.34 5.67 3.61 2.35 5.66 2.35 4.1-.79 5.66-2.35S20 15.64 20 13.64 19.22 9.56 17.66 8z",
  },
  terrain: {
    name: "Terrain",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions: "Tiles © Esri",
        crossOrigin: "anonymous",
      }),
    icon: "M14 11l4-8H6l4 8H6l6 10 6-10h-4z",
  },
  dark: {
    name: "Dark Mode",
    source: () =>
      new XYZ({
        url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions: "© CARTO",
        crossOrigin: "anonymous",
      }),
    icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  },
  light: {
    name: "Light Mode",
    source: () =>
      new XYZ({
        url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions: "© CARTO",
        crossOrigin: "anonymous",
      }),
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
};

// GIS Compass component - static version
const GISCompass = () => {
  return (
    <div className="absolute left-20 top-4 z-20   p-3 rounded-lg  transition-all duration-300 ease-in-out animate-fade-in">
      <div className="flex flex-col items-center">
        <svg width="80" height="80" viewBox="0 0 100 100">
          {/* Outer circle */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="white"
            stroke="#ddd"
            strokeWidth="1"
          />

          {/* Compass rose */}
          <g>
            {/* North pointer (blue) */}
            <path d="M50 10 L55 50 L50 45 L45 50 Z" fill="#3b82f6" />

            {/* South pointer */}
            <path d="M50 90 L45 50 L50 55 L55 50 Z" fill="#606060" />

            {/* East pointer */}
            <path d="M90 50 L50 45 L55 50 L50 55 Z" fill="#606060" />

            {/* West pointer */}
            <path d="M10 50 L50 55 L45 50 L50 45 Z" fill="#606060" />

            {/* Direction markers - cardinal */}
            <text
              x="50"
              y="20"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#3b82f6"
            >
              N
            </text>
            <text
              x="50"
              y="85"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              S
            </text>
            <text
              x="85"
              y="52"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              E
            </text>
            <text
              x="15"
              y="52"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              W
            </text>

            {/* Direction markers - ordinal */}
            <text x="32" y="32" textAnchor="middle" fontSize="10" fill="#888">
              NW
            </text>
            <text x="68" y="32" textAnchor="middle" fontSize="10" fill="#888">
              NE
            </text>
            <text x="68" y="72" textAnchor="middle" fontSize="10" fill="#888">
              SE
            </text>
            <text x="32" y="72" textAnchor="middle" fontSize="10" fill="#888">
              SW
            </text>

            {/* Crosshairs */}
            <line
              x1="50"
              y1="10"
              x2="50"
              y2="90"
              stroke="#ddd"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              stroke="#ddd"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Inner circle */}
            <circle
              cx="50"
              cy="50"
              r="5"
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth="1"
            />

            {/* Outer ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeOpacity="0.3"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

const Maping: React.FC<MapingProps> = ({
  isDrawing,
  setIsDrawing,
  coordinates,
  setCoordinates,
  resetPolygon,
  setResetPolygon,
}) => {
  const drawInteractionRef = useRef<Draw | null>(null);
  const drawLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const [showdefault, setshowdefault] = useState<boolean>(false); // default raster layer

  // Set initial loading state to true independent of any selection

  const [primaryLayerLoading, setPrimaryLayerLoading] = useState<boolean>(true);
  const [secondaryLayerLoading, setSecondaryLayerLoading] =
    useState<boolean>(false);
  const [rasterLoading, setRasterLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [primaryFeatureCount, setPrimaryFeatureCount] = useState<number>(0);
  const [secondaryFeatureCount, setSecondaryFeatureCount] = useState<number>(0);
  const [layerOpacity, setLayerOpacity] = useState<number>(70);
  const [rasterLayerInfo, setRasterLayerInfo] = useState<any>(null);
  const [wmsDebugInfo, setWmsDebugInfo] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showTitles, setshowTitles] = useState<boolean>(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showLayerList, setShowLayerList] = useState<boolean>(false);

  // Add state for vector layer visibility - only secondary can be toggled
  const [showSecondaryLayer, setShowSecondaryLayer] = useState<boolean>(true);

  const [isPanelOpen, setIsPanelOpen] = useState(false); //default raster layer
  const [selectedradioLayer, setSelectedradioLayer] = useState("");
  const { selectedSubDistricts, display_raster, setdisplay_raster } =
    useLocation();

  useEffect(() => {
    setCoordinates(coordinates);
  }, [coordinates, setCoordinates]);

  useEffect(() => {
    if (isDrawing) startDrawing();
    else stopDrawing();
    setIsDrawing(isDrawing);
  }, [isDrawing, setIsDrawing]);

  useEffect(() => {
    if (resetPolygon) {
      clearDrawings();
      setResetPolygon(false);
    }
  }, [resetPolygon]);
  const startDrawing = () => {
    if (!mapInstanceRef.current) return;

    if (!drawLayerRef.current) {
      const drawSource = new VectorSource();
      const drawLayer = new VectorLayer({
        source: drawSource,
        style: new Style({
          fill: new Fill({ color: "rgba(0, 128, 255, 0.2)" }),
          stroke: new Stroke({ color: "#0080ff", width: 2 }),
        }),
        zIndex: 10,
      });
      mapInstanceRef.current.addLayer(drawLayer);
      drawLayerRef.current = drawLayer;
    }

    const draw = new Draw({
      source: drawLayerRef.current.getSource()!,
      type: "Polygon",
    });

    draw.on("drawend", (event) => {
      const polygon = event.feature.getGeometry() as Polygon;
      const geojson = new GeoJSON().writeFeature(event.feature, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      const feature = JSON.parse(geojson);
      const coords = feature.geometry.coordinates[0]; // Extract [[lon, lat], ...]
      setCoordinates(coords);
      console.log("Polygon Coordinates:", coords);
      setIsDrawing(false);
    });

    mapInstanceRef.current.addInteraction(draw);
    drawInteractionRef.current = draw;
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    if (!mapInstanceRef.current || !drawInteractionRef.current) return;
    mapInstanceRef.current.removeInteraction(drawInteractionRef.current);
    drawInteractionRef.current = null;
    setIsDrawing(false);
  };

  const clearDrawings = () => {
    if (drawLayerRef.current) {
      drawLayerRef.current.getSource()?.clear();
    }
    stopDrawing();
    setCoordinates(null);
  };

  useEffect(() => {
    console.log("selectedSubDistricts", isPanelOpen);
  }, [isPanelOpen]);
  // Use the map context
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    geoServerUrl,
    defaultWorkspace,
    isMapLoading,
    setstpOperation,
    stpOperation,
    loading,
    setLoading,
  } = useMap();

  const { selectedCategories, setStpProcess, setShowTable, setTableData } =
    useCategory();

  const INDIA_CENTER_LON = 78.9629;
  const INDIA_CENTER_LAT = 20.5937;
  const INITIAL_ZOOM = 6;

  const [wtkpoly, setwtkpoly] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  // Toggle active panel function
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
  const handleLayerSelection = (layerName: string) => {
    setSelectedradioLayer(layerName);
    console.log("Selected layer:", layerName);
    // Add your layer selection logic here
  };

  // Toggle secondary layer visibility
  const toggleSecondaryLayer = () => {
    if (secondaryLayerRef.current) {
      const newVisibility = !showSecondaryLayer;
      secondaryLayerRef.current.setVisible(newVisibility);
      setShowSecondaryLayer(newVisibility);
    }
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

  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;

    // Remove current base layer
    mapInstanceRef.current.removeLayer(baseLayerRef.current);

    // Create and add new base layer
    const baseMapConfig = baseMaps[baseMapKey];
    const newBaseLayer = new TileLayer({
      source: baseMapConfig.source(),
      zIndex: 0,
      properties: {
        type: "base",
      },
    });

    // Update reference and add to map
    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);

    // Update state
    setSelectedBaseMap(baseMapKey);
  };

  // Add this function inside the Maping component
  const captureMap = async (): Promise<string | null> => {
    if (!mapInstanceRef.current) {
      console.warn("Map instance not available");
      return null;
    }

    const map = mapInstanceRef.current;

    return new Promise((resolve) => {
      try {
        // Force a map render and wait for it to complete
        map.once("rendercomplete", () => {
          try {
            const mapCanvas = document.createElement("canvas");
            const size = map.getSize() || [0, 0];
            if (size[0] === 0 || size[1] === 0) {
              console.warn("Invalid map size:", size);
              resolve(null);
              return;
            }

            mapCanvas.width = size[0];
            mapCanvas.height = size[1];
            const mapContext = mapCanvas.getContext("2d");

            if (!mapContext) {
              console.warn("Failed to get 2D context for canvas");
              resolve(null);
              return;
            }

            // Collect all canvas elements from the map
            const canvases = map
              .getViewport()
              .querySelectorAll(".ol-layer canvas, canvas.ol-layer");

            let renderedLayers = 0;
            canvases.forEach((element: Element) => {
              if (element instanceof HTMLCanvasElement && element.width > 0) {
                const canvas = element; // Type narrowing to HTMLCanvasElement
                const opacity =
                  canvas.parentNode instanceof HTMLElement
                    ? canvas.parentNode.style.opacity || canvas.style.opacity
                    : "";
                mapContext.globalAlpha = opacity === "" ? 1 : Number(opacity);

                let matrix: number[] = [1, 0, 0, 1, 0, 0]; // Default identity matrix
                const transform = canvas.style.transform;
                if (transform && transform.includes("matrix")) {
                  const transformValues = transform
                    .match(/^matrix\(([^\(]*)\)$/)?.[1]
                    ?.split(",")
                    ?.map(Number);
                  if (transformValues && transformValues.length === 6) {
                    matrix = transformValues;
                  }
                }

                // Apply transform with individual arguments
                mapContext.setTransform(
                  matrix[0], // a
                  matrix[1], // b
                  matrix[2], // c
                  matrix[3], // d
                  matrix[4], // e
                  matrix[5] // f
                );
                mapContext.drawImage(canvas, 0, 0);
                renderedLayers++;
              }
            });

            mapContext.globalAlpha = 1;
            mapContext.setTransform(1, 0, 0, 1, 0, 0);

            if (renderedLayers === 0) {
              console.warn("No valid layers rendered for capture");
              resolve(null);
              return;
            }

            const imageData = mapCanvas.toDataURL("image/png");
            resolve(imageData);
          } catch (error) {
            console.log("Error during map capture:", error);
            resolve(null);
          }
        });

        // Trigger map rendering
        map.renderSync();
      } catch (error) {
        console.log("Error initiating map capture:", error);
        resolve(null);
      }
    });
  };

  useEffect(() => {
    // Expose the capture function globally
    if (typeof window !== "undefined") {
      (window as any).captureMapImage = captureMap;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).captureMapImage;
      }
    };
  }, []); // Remove the dependency to avoid recreation

  // Initialize the map once with all controls
  useEffect(() => {
    if (!mapRef.current) return;

    // Create base OSM layer
    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
      properties: {
        type: "base",
      },
    });

    baseLayerRef.current = initialBaseLayer;
    const css = `
  /* C

  
  /* Animation classes */
  .animate-fade-in {
    animation: fadeIn 0.5s ease-in-out;
  }
  
  .animate-slide-in-right {
    animation: slideInRight 0.5s ease-in-out;
  }
  
  .animate-slide-up {
    animation: slideUp 0.5s ease-in-out;
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  .animate-fade-in-down {
    animation: fadeInDown 0.5s ease-in-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
    100% { transform: translateY(0px); }
  }
  
  @keyframes fadeInDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

    // Create a style element and add it to the document head
    const styleElement = document.createElement("style");
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    // Configure controls
    const controls = defaultControls().extend([
      // Scale line (distance indicator)
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

      // Overview map (small map in corner)

      // Zoom slider
      new ZoomSlider(),

      // Zoom to extent button
      new ZoomToExtent({
        tipLabel: "Zoom to India",
        extent: fromLonLat([68, 7]).concat(fromLonLat([97, 37])),
      }),
    ]);

    <button>helosasd</button>;
    // Create the map with controls
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
    setTimeout(() => {
      setLoading(false);
      setPrimaryLayerLoading(false);
    }, 500);

    // Clean up on unmount
    return () => {
      if (map) {
        map.setTarget("");
      }
    };
  }, []);

  // Load and manage the primary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) return;

    setPrimaryLayerLoading(true);
    setError(null);

    // Construct WFS URL for primary layer with filters_value
    let primaryWfsUrl =
      `/geoserver/api/wfs?` +
      "service=WFS&" +
      "version=1.1.0&" +
      "request=GetFeature&" +
      `typeName=${defaultWorkspace}:${primaryLayer}&` +
      "outputFormat=application/json&" +
      "srsname=EPSG:3857";

    // Define primary vector style (blue)
    const primaryVectorStyle = new Style({
      stroke: new Stroke({
        color: "#3b82f6",
        width: 2,
      }),
    });

    // Create primary vector source and layer
    const primaryVectorSource = new VectorSource({
      format: new GeoJSON(),
      url: primaryWfsUrl,
    });

    const primaryVectorLayer = new VectorLayer({
      source: primaryVectorSource,
      style: primaryVectorStyle,
      zIndex: 1,
      visible: true, // Primary layer is always visible
    });

    // Handle primary layer loading
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

      // Zoom to the extent of the primary layer
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

    // Remove previous primary layer if it exists
    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
    }

    // Add the new primary layer to the map
    mapInstanceRef.current.addLayer(primaryVectorLayer);
    primaryLayerRef.current = primaryVectorLayer;

    return () => {
      primaryVectorSource.un("featuresloaderror", handleFeaturesError);
      primaryVectorSource.un("featuresloadend", handleFeaturesLoaded);
    };
  }, [geoServerUrl, defaultWorkspace, primaryLayer]);

  // Handle the secondary layer
  useEffect(() => {
    setLoading(true);

    if (!mapInstanceRef.current || !secondaryLayer) {
      // Reset secondary layer states
      setSecondaryFeatureCount(0);
      setSecondaryLayerLoading(false);
      // Remove any existing secondary layer
      if (secondaryLayerRef.current) {
        mapInstanceRef.current?.removeLayer(secondaryLayerRef.current);
        secondaryLayerRef.current = null;
      }
      updateLoadingState();
      return;
    }
    setLoading(true);
    setSecondaryLayerLoading(true);
    // Construct WFS URL for secondary layer
    const secondaryWfsUrl =
      `/geoserver/api/wfs?` +
      "service=WFS&" +
      "version=1.1.0&" +
      "request=GetFeature&" +
      `typeName=${defaultWorkspace}:${secondaryLayer}&` +
      "outputFormat=application/json&" +
      "srsname=EPSG:3857&" +
      `CQL_FILTER=${LayerFilter} IN (${
        Array.isArray(LayerFilterValue)
          ? LayerFilterValue.map((v) => `'${v}'`).join(",")
          : `'${LayerFilterValue}'`
      })`;

    const secondaryVectorStyle = (feature: any, resolution: number) => {
      const geometry = feature.getGeometry();
      const geometryType = geometry.getType();
      const zoom = Math.round(
        Math.log(156543.03392 / resolution) / Math.log(2)
      );
      const featureName = feature.get("name") || feature.get("Name");

      const styles = [];

      if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
        styles.push(
          new Style({
            stroke: new Stroke({
              color: "#5E1520",
              width: 3,
            }),
          })
        );
      }

      if (geometryType === "LineString" || geometryType === "MultiLineString") {
        styles.push(
          new Style({
            stroke: new Stroke({
              color: "#5E1520",
              width: 5,
            }),
          })
        );
      }

      if (geometryType === "Point" || geometryType === "MultiPoint") {
        styles.push(
          new Style({
            image: new Circle({
              radius: 4,
              fill: new Fill({
                color: "rgba(224, 3, 3, 0.3)",
              }),
              stroke: new Stroke({
                color: "rgba(43, 1, 142, 0.3)",
                width: 1,
              }),
            }),
          })
        );
      }

      if (showTitles && zoom > 5 && featureName) {
        const labelStyle = new Style({
          text: new Text({
            text: featureName.toString(),
            font: "12px Arial, sans-serif",
            stroke: new Stroke({
              color: "#ffffff",
              width: 3,
            }),
            offsetY: geometryType === "Point" ? -20 : 0,
            textAlign: "center",
            textBaseline: "middle",
            overflow: true,
            maxAngle: Math.PI / 4,

            scale: zoom > 15 ? 1.2 : 1,
          }),
        });
        styles.push(labelStyle);
      }

      return styles;
    };

    // Vector source loading GeoJSON from WFS
    const secondaryVectorSource = new VectorSource({
      url: secondaryWfsUrl,
      format: new GeoJSON(),
    });

    // Create and style the vector layer
    const secondaryVectorLayer = new VectorLayer({
      source: secondaryVectorSource,
      style: secondaryVectorStyle,
      zIndex: 4, // Higher zIndex to display above raster layer
      visible: showSecondaryLayer, // Set initial visibility based on state
    });

    // Handle secondary layer loading
    const handleSecondaryFeaturesError = (err: any) => {
      console.log("Error loading secondary layer features:", err);
      setSecondaryLayerLoading(false);
      updateLoadingState();
    };

    const handleSecondaryFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      const secondaryExtent = secondaryVectorSource.getExtent();
      if (secondaryExtent && secondaryExtent.some((val) => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(secondaryExtent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
      setSecondaryFeatureCount(numFeatures);
      setSecondaryLayerLoading(false);
      updateLoadingState();
    };

    // Store the source reference for cleanup
    let sourceCleanedUp = false;

    secondaryVectorSource.on("featuresloaderror", handleSecondaryFeaturesError);
    secondaryVectorSource.on("featuresloadend", handleSecondaryFeaturesLoaded);

    // Remove any existing secondary layer
    if (secondaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(secondaryLayerRef.current);
    }

    // Add secondary layer to map
    mapInstanceRef.current.addLayer(secondaryVectorLayer);
    secondaryLayerRef.current = secondaryVectorLayer;

    secondaryVectorSource.once("change", function () {
      if (secondaryVectorSource.getState() === "ready") {
        // Get all features
        const features = secondaryVectorSource.getFeatures();

        // Filter for polygon features if needed
        const polygonFeatures = features.filter((feature) => {
          const geometry = feature.getGeometry();
          return geometry && geometry.getType().includes("Polygon");
        });
        setwtkpoly(polygonFeatures);
      }
    });

    // Cleanup function
    return () => {
      if (!sourceCleanedUp) {
        sourceCleanedUp = true;
        // Remove event listeners
        secondaryVectorSource.un(
          "featuresloaderror",
          handleSecondaryFeaturesError
        );
        secondaryVectorSource.un(
          "featuresloadend",
          handleSecondaryFeaturesLoaded
        );

        // Clear the source to prevent further loading
        secondaryVectorSource.clear();

        // Remove the layer from the map if it exists
        if (secondaryLayerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(secondaryLayerRef.current);
          secondaryLayerRef.current = null;
        }
      }
    };
  }, [secondaryLayer, LayerFilter, LayerFilterValue, showTitles]);

  // Combined useEffect for STP operation and raster layer display
  useEffect(() => {
    if (!mapInstanceRef.current || !stpOperation) return;

    const performSTP = async () => {
      setRasterLoading(true);
      setError(null);
      setWmsDebugInfo(null);
      setStpProcess(true);

      const bodyPayload = JSON.stringify({
        data: selectedCategories,
        clip: selectedSubDistricts,
        place: "sub_district",
      });

      console.log("Sending STP request for:", bodyPayload);

      try {
        const resp = await fetch("/api/stp_operation/stp_priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyPayload,
        });

        if (!resp.ok) {
          throw new Error(`STP operation failed with status: ${resp.status}`);
        }

        const result = await resp.json();

        if (result && result.status === "success") {
          const append_data = {
            file_name: "STP_Priority_output",
            workspace: result.workspace,
            layer_name: result.layer_name,
          };
          setTableData(result.csv_details);

          // Check if file_name already exists
          const index = display_raster.findIndex(
            (item) => item.file_name === "STP_Priority_output"
          );

          let newData;
          if (index !== -1) {
            // Update existing entry
            newData = [...display_raster];
            newData[index] = append_data;
          } else {
            // Append new entry
            newData = display_raster.concat(append_data);
          }

          setdisplay_raster(newData);
          setRasterLayerInfo(result);
          setShowTable(true);
          handleLayerSelection(append_data.file_name);
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
        setStpProcess(false);
      }
    };

    performSTP();
  }, [stpOperation, selectedCategories, selectedSubDistricts]);

  useEffect(() => {
    console.log("rasterLayerInfo", rasterLayerInfo);

    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove all WMS/raster layers
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

  useEffect(() => {
    display_raster.map((item: any) => {
      if (item.file_name == selectedradioLayer) {
        console.log("selected items", item);
        setRasterLayerInfo(item);
      }
    });
    console.log("new update data", display_raster);
  }, [selectedradioLayer]);

  // Handle opacity change
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseInt(e.target.value);
    setLayerOpacity(newOpacity);
    Object.values(layersRef.current).forEach((layer: any) => {
      layer.setOpacity(newOpacity / 100);
    });
  };

  // Update opacity of all raster layers

  // Helper function to update overall loading state
  function updateLoadingState() {
    setLoading(secondaryLayerLoading || rasterLoading);
  }

  // Generate the correct position class for the legend
  const getLegendPositionClass = () => {
    return "bottom-16 right-16";
  };
  useEffect(() => {
    console.log("rasterLayerInfo", rasterLayerInfo);

    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove all WMS/raster layers
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
  }, [display_raster]);
  // Move legend position

  return (
    <div className="relative w-full h-[600px] flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Modern Map Container */}
      <div
        className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200"
        ref={containerRef}
      >
        {/* The Map */}
        <div ref={mapRef} className="w-full h-full bg-blue-50" />
        <GISCompass />

        {/* Enhanced Floating Header Panel - Responsive */}
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
            <span className="hidden sm:inline">GIS Viewer</span>
            <span className="sm:hidden">GIS</span>
          </span>

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

        {/* Enhanced Layer Selection Panel - Top Right */}
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

        {/* Enhanced Layer Selection Dropdown */}
        {isPanelOpen && display_raster.length > 0 && (
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
              {display_raster.map((layer, index) => (
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

        {/* Enhanced Base Map Panel */}
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

        {/* Enhanced Layers Panel */}
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
                Map Layers
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
              {/* Primary Layer - Enhanced */}
              {primaryFeatureCount > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                      <span className="font-semibold text-blue-800">
                        Primary Layer
                      </span>
                    </div>
                    <span className="text-xs bg-blue-200/80 text-blue-800 px-3 py-1 rounded-full font-medium">
                      {primaryFeatureCount} features
                    </span>
                  </div>
                </div>
              )}

              {/* Secondary Layer with Enhanced Toggle */}
              {secondaryFeatureCount > 0 && (
                <div
                  className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                    showSecondaryLayer
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${
                          showSecondaryLayer ? "bg-green-500" : "bg-gray-400"
                        } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                      ></div>
                      <span
                        className={`font-semibold ${
                          showSecondaryLayer
                            ? "text-green-800"
                            : "text-gray-600"
                        }`}
                      >
                        Secondary Layer
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          showSecondaryLayer
                            ? "bg-green-200/80 text-green-800"
                            : "bg-gray-200/80 text-gray-700"
                        }`}
                      >
                        {secondaryFeatureCount} features
                      </span>
                      <button
                        onClick={toggleSecondaryLayer}
                        className={`w-12 h-6 rounded-full ${
                          showSecondaryLayer ? "bg-green-500" : "bg-gray-300"
                        } relative transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 hover:scale-105`}
                      >
                        <span
                          className={`block w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                            showSecondaryLayer ? "translate-x-6" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Raster Layer with Opacity Control */}
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

              {/* Enhanced No Layers Message */}
              {primaryFeatureCount === 0 &&
                secondaryFeatureCount === 0 &&
                !rasterLayerInfo && (
                  <div className="p-6 text-center text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <svg
                      className="w-12 h-12 mx-auto mb-3 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <p className="font-medium">
                      No layers are currently active
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add layers to get started
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Enhanced Tools Panel */}
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

              <button
                onClick={() => {
                  setshowTitles(!showTitles);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:scale-105 hover:shadow-md"
                style={{
                  backgroundColor: showTitles ? "#10b981" : "#f3f4f6",
                }}
              >
                <div className="text-lg font-semibold">
                  {showTitles ? "ON" : "OFF"}
                </div>
                <svg
                  className="w-8 h-8 mb-2 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke={showTitles ? "green" : "currentColor"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2 8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8zM6 12h12"
                  />
                </svg>
                <span className="text-sm font-medium text-center">
                  Display Title
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Fixed Side Panel for Layer List - Mobile Responsive */}
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
              {/* Enhanced Primary Layer in Layer List */}
              {primaryFeatureCount > 0 && (
                <div className="flex items-center p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                  <span className="text-xs font-semibold text-blue-800 flex-grow">
                    Primary Layer
                  </span>
                  <span className="text-xs bg-blue-200/80 text-blue-800 px-2 py-1 rounded-full font-medium">
                    {primaryFeatureCount}
                  </span>
                </div>
              )}

              {/* Enhanced Secondary Layer Toggle in Layer List */}
              {secondaryFeatureCount > 0 && (
                <div
                  className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
                    showSecondaryLayer
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-3 h-3 ${
                      showSecondaryLayer ? "bg-green-500" : "bg-gray-400"
                    } rounded-full mr-3 shadow-sm transition-colors duration-300`}
                  ></div>
                  <span
                    className={`text-xs font-semibold flex-grow ${
                      showSecondaryLayer ? "text-green-800" : "text-gray-600"
                    }`}
                  >
                    Secondary Layer
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        showSecondaryLayer
                          ? "bg-green-200/80 text-green-800"
                          : "bg-gray-200/80 text-gray-700"
                      }`}
                    >
                      {secondaryFeatureCount}
                    </span>
                    <button
                      onClick={toggleSecondaryLayer}
                      className={`w-10 h-5 rounded-full ${
                        showSecondaryLayer ? "bg-green-500" : "bg-gray-300"
                      } relative transition-all duration-300 ease-in-out focus:outline-none hover:scale-105`}
                    >
                      <span
                        className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ease-in-out ${
                          showSecondaryLayer ? "translate-x-5" : ""
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
