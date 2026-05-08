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
import { doubleClick, pointerMove } from "ol/events/condition";
import Image from "next/image";
import { createWFSVectorSource } from "@/components/utils/geoserver_url";
import { fromLonLat } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";

import { Style, Fill, Stroke, Circle, Text } from "ol/style";
import { useMap } from "@/contexts/water/users/DrainMapContext";
import { useRiverSystem } from "@/contexts/water/users/DrainContext";
import "ol/ol.css";
import { baseMaps } from "@/components/MapComponents";
import {
  INDIA_CENTER,
  INITIAL_ZOOM,
  LAYER_COLORS,
} from "@/interface/openlayer";

const createVectorStyle =
  (layerType: string, showLabels: boolean = false) =>
    (feature: any, resolution: number) => {
      const geometry = feature.getGeometry();
      const geometryType = geometry.getType();
      const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
      const featureName =
        feature.get("name") || feature.get("Name") || feature.get("NAME");
      const colorConfig = LAYER_COLORS[layerType] || LAYER_COLORS.primary;
      const styles = [];

      if (geometryType.includes("Polygon")) {
        styles.push(
          new Style({
            stroke: new Stroke({ color: colorConfig.color, width: 2 }),
            fill: new Fill({ color: "transparent" }),
          }),
        );
      }

      if (geometryType.includes("LineString")) {
        styles.push(
          new Style({
            stroke: new Stroke({ color: colorConfig.color, width: 3 }),
          }),
        );
      }

      if (geometryType.includes("Point")) {
        styles.push(
          new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: colorConfig.color + "80" }),
              stroke: new Stroke({ color: colorConfig.color, width: 4 }),
            }),
          }),
        );
      }

      if (showLabels && zoom > 8 && featureName) {
        styles.push(
          new Style({
            text: new Text({
              text: featureName.toString(),
              font: "12px Arial, sans-serif",
              fill: new Fill({ color: colorConfig.color }),
              stroke: new Stroke({ color: "#ffffff", width: 3 }),
              offsetY: geometryType.includes("Point") ? -20 : 0,
              textAlign: "center",
              textBaseline: "middle",
            }),
          }),
        );
      }

      return styles;
    };

const LocalHoverTooltip = ({
  hoveredFeature,
  mousePosition,
}: {
  hoveredFeature: any;
  mousePosition: { x: number; y: number };
}) => {
  if (!hoveredFeature) return null;

  // Check for the name property based on the layer type
  let displayName = "Unknown Feature";
  // 1. Check for River
  if (hoveredFeature.get("River_Name")) {
    displayName = hoveredFeature.get("River_Name");
  }
  // 2. Check for Catchment (often has village_name or village_id)
  else if (hoveredFeature.get("village_name")) {
    displayName = hoveredFeature.get("village_name");
  }
  // 3. Check for Drain
  else if (hoveredFeature.get("Drain_No")) {
    const name = hoveredFeature.get("name") || hoveredFeature.get("Name");
    // If it has a name, show "Name (No: 123)", otherwise just "Drain 123"
    displayName = name
      ? `${name} (No: ${hoveredFeature.get("Drain_No")})`
      : `Drain ${hoveredFeature.get("Drain_No")}`;
  }
  // 4. Check for Stretch
  else if (hoveredFeature.get("Stretch_ID")) {
    const name = hoveredFeature.get("name") || hoveredFeature.get("Name");
    displayName = name
      ? `${name} (ID: ${hoveredFeature.get("Stretch_ID")})`
      : `Stretch ${hoveredFeature.get("Stretch_ID")}`;
  }
  // 5. Fallback for generic layers (Primary, Boundary, etc.)
  else {
    displayName =
      hoveredFeature.get("name") ||
      hoveredFeature.get("Name") ||
      hoveredFeature.get("NAME") ||
      hoveredFeature.get("area_ha") ||
      "Unknown";
  }

  return (
    <div
      className="absolute z-50 bg-gray-900/90 text-white text-sm px-3 py-2 rounded-lg shadow-lg pointer-events-none transition-all duration-200 backdrop-blur-sm border border-gray-700"
      style={{
        left: `${mousePosition.x + 15}px`,
        top: `${mousePosition.y - 35}px`,
        transform:
          mousePosition.x > window.innerWidth - 200
            ? "translateX(-100%)"
            : "none",
      }}
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          <svg
            className="w-3 h-3 mr-2 text-blue-400 flex-shrink-0"
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
          </svg>
          <span className="font-medium whitespace-nowrap">{displayName}</span>
        </div>
      </div>

      {/* Tooltip arrow */}
      <div className="absolute bottom-0 left-4 transform translate-y-full">
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/90"></div>
      </div>
    </div>
  );
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
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});

  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    river: 0,
    stretch: 0,
    drain: 0,
    catchment: 0,
  });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showHeaderButtons, setShowHeaderButtons] = useState<boolean>(false);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [legendData, setLegendData] = useState<any>(null);

  const [showRiverLayer, setShowRiverLayer] = useState<boolean>(true);
  const [showStretchLayer, setShowStretchLayer] = useState<boolean>(true);
  const [showDrainLayer, setShowDrainLayer] = useState<boolean>(true);
  const [showCatchmentLayer, setShowCatchmentLayer] = useState<boolean>(true);

  const {
    selectedDrain,
    displayRaster,
    setShowCatchment,
    setSelectedRiver,
    setSelectedCatchments,
    selectedStretch,
    setSelectedStretch,
    setSelectedDrain,
    selectionsLocked,
    resetTrigger,
    selectedRiver,
    setDisplayRaster,
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
    defaultWorkspace,
    setLoading,
    hasSelections,
    showLegend,
    setShowLegend,
    setRasterLayerInfo,
    rasterLayerInfo,
    error,
    setError,
    setRasterLoading,
    rasterLoading,
    handleLayerSelection,
    selectedradioLayer,
    setSelectedradioLayer,
  } = useMap();

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

  useEffect(() => {
    // 0 is initial state, don't zoom on load.
    // Only zoom if trigger > 0 (meaning button was clicked).
    if (resetTrigger > 0 && mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([82.385997, 25.572011]),
        zoom: 10,
        duration: 1000,
      });
    }
  }, [resetTrigger]);

  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current) return;
    if (selectionsLocked) {
      selectInteractionRef.current.setActive(false);
    }
  }, [selectionsLocked]);

  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.osm.source(),
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
          return `${latitude.toFixed(6)} N, ${longitude.toFixed(6)} E`;
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

    // Add Select interaction for double-clicks (excluding boundary layer)
    const selectInteraction = new Select({
      condition: doubleClick,
      style: new Style({
        stroke: new Stroke({ color: "#ff0000", width: 3 }),
        fill: new Fill({ color: "rgba(255, 0, 0, 0.3)" }),
      }),
      filter: (feature, layer) => {
        // Exclude boundary layer from selection interactions
        return (
          layer !== boundaryLayerRef.current &&
          layer !== primaryLayerRef.current
        );
      },
    });

    selectInteraction.on("select", (event) => {
      const selectedFeatures = event.selected;
      if (selectedFeatures.length > 0) {
        const feature = selectedFeatures[0];
        const geometry = feature.getGeometry();

        if (geometry) {
          const River_code = feature.get("River_Code");
          const Stretch_id = feature.get("Stretch_ID");
          const Drain_no = feature.get("Drain_No");

          console.log("selected stretch", River_code, Stretch_id, Drain_no);

          if (Drain_no as number) {
            setSelectedDrain(Drain_no);
          } else if (Stretch_id as number) {
            setSelectedStretch(Stretch_id);
          } else if (River_code as number) {
            setSelectedRiver(River_code);
          }
        }

        // Clear selection after processing
        setTimeout(() => {
          selectInteraction.getFeatures().clear();
        }, 500);
      }
    });

    // Add Select interaction for hover (excluding boundary layer)
    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: "#ffaa00", width: 2 }),
        fill: new Fill({ color: "transparent" }),
      }),
      filter: (feature, layer) => {
        return (
          layer !== boundaryLayerRef.current &&
          layer !== primaryLayerRef.current
        );
      },
    });

    hoverInteraction.on("select", (event) => {
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
        y: event.pixel[1],
      });
    };

    map.on("pointermove", handleMouseMove);
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
        map.un("pointermove", handleMouseMove);
        map.setTarget("");
      }
    };
  }, []);

  useEffect(() => {
    if (!displayRaster || displayRaster.length === 0) {
      setRasterLayerInfo(null);
      setSelectedradioLayer(null);
      setShowLegend(false);
      setActiveYear(null);
      setLegendData(null);
      return;
    }

    if (displayRaster && displayRaster.length > 0) {
      // Find the most recent year if not set
      if (!activeYear) {
        const years = [...new Set(displayRaster.map((r: any) => r.year))].sort();
        if (years.length > 0) {
          setActiveYear(years[years.length - 1]);
        }
      }
    }
  }, [displayRaster]);

  // Handle active year change to update selected raster
  useEffect(() => {
    if (activeYear && displayRaster.length > 0) {
      const rasterForYear = displayRaster.find((r: any) => r.year === activeYear);
      if (rasterForYear) {
        setRasterLayerInfo(rasterForYear);
        setSelectedradioLayer(rasterForYear.layer_name);
        setShowLegend(true);
        setLegendData(rasterForYear.legend_data ?? null);
      }
    }
  }, [activeYear, displayRaster]);

  // Handle primary layer and boundary layer independently
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    setError(null);

    if (primaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(primaryLayerRef.current);
      primaryLayerRef.current = null;
    }
    if (boundaryLayerRef.current) {
      mapInstanceRef.current.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    if (!primaryLayer && !boundarylayer) {
      setFeatureCounts((prev) => ({ ...prev, primary: 0 }));
      return;
    }

    setIsLoading(true);

    const cleanups: Array<() => void> = [];

    if (boundarylayer) {
      const boundaryVectorSource = new VectorSource({
        format: new GeoJSON(),
        url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${boundarylayer}&outputFormat=application/json&srsname=EPSG:3857`,
      });

      const boundaryVectorLayer = new VectorLayer({
        source: boundaryVectorSource,
        style: new Style({
          stroke: new Stroke({
            color: "#301934",
            width: 2,
          }),
          fill: new Fill({
            color: "rgba(48, 25, 52, 0.1)",
          }),
        }),
        zIndex: 2,
        visible: true,
      });

      const handleBoundaryLoaded = () => {
        if (!primaryLayer && !hasSelections) {
          const boundaryExtent = boundaryVectorSource.getExtent();
          if (boundaryExtent && boundaryExtent.some((val) => isFinite(val))) {
            mapInstanceRef.current?.getView().fit(boundaryExtent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }
      };

      boundaryVectorSource.on("featuresloadend", handleBoundaryLoaded);
      cleanups.push(() =>
        boundaryVectorSource.un("featuresloadend", handleBoundaryLoaded),
      );

      mapInstanceRef.current.addLayer(boundaryVectorLayer);
      boundaryLayerRef.current = boundaryVectorLayer;
    }

    if (primaryLayer) {
      const primaryWfsUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${primaryLayer}&outputFormat=application/json&srsname=EPSG:3857`;

      const primaryVectorSource = new VectorSource({
        format: new GeoJSON(),
        url: primaryWfsUrl,
      });

      const primaryVectorLayer = new VectorLayer({
        source: primaryVectorSource,
        style: createVectorStyle("primary", showTitles),
        zIndex: 1,
        visible: true,
      });

      const handlePrimaryLoaded = (event: any) => {
        const numFeatures = event.features ? event.features.length : 0;
        setFeatureCounts((prev) => ({ ...prev, primary: numFeatures }));
        setIsLoading(false);

        const primaryExtent = primaryVectorSource.getExtent();
        if (primaryExtent && primaryExtent.some((val) => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(primaryExtent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      };

      const handlePrimaryError = () => {
        setIsLoading(false);
        setError("Failed to load primary features");
      };

      primaryVectorSource.on("featuresloadend", handlePrimaryLoaded);
      primaryVectorSource.on("featuresloaderror", handlePrimaryError);
      cleanups.push(() => {
        primaryVectorSource.un("featuresloadend", handlePrimaryLoaded);
        primaryVectorSource.un("featuresloaderror", handlePrimaryError);
      });

      mapInstanceRef.current.addLayer(primaryVectorLayer);
      primaryLayerRef.current = primaryVectorLayer;
    } else {
      setIsLoading(false);
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [primaryLayer, boundarylayer, defaultWorkspace, showTitles, hasSelections]);

  // Create river system layer helper
  const createRiverSystemLayer = (
    layerName: string | null,
    layerRef: React.MutableRefObject<VectorLayer<VectorSource> | null>,
    layerType: string,
    zIndex: number,
    isVisible: boolean,
    layerFilter: {
      filterField: string | null;
      filterValue: number[] | string[] | null;
    },
    customStyle?: any,
    activeRiverId?: number | null,
    activeStretchId?: number | null,
  ): (() => void) | void => {
    if (!mapInstanceRef.current || !layerName) {
      // Clean up existing layer if it exists
      if (layerRef.current) {
        console.log(`Cleaning up ${layerType} layer (Condition met)`);
        mapInstanceRef.current?.removeLayer(layerRef.current);
        layerRef.current = null;
        setFeatureCounts((prev) => ({ ...prev, [layerType]: 0 }));
      }
      return () => { }; // No cleanup needed for this run
    }

    if (
      layerType === "catchment" &&
      (layerFilter.filterValue === null || layerFilter.filterValue.length === 0)
    ) {
      if (layerRef.current) {
        mapInstanceRef.current?.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return () => { };
    }

    const vectorSource = createWFSVectorSource({
      workspace: defaultWorkspace,
      layerName: layerName,
      layerFilter,
    });
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: customStyle || createVectorStyle(layerType, showTitles),
      zIndex: zIndex,
      visible: isVisible,
    });

    const handleFeaturesLoaded = (event: any) => {
      const numFeatures = event.features ? event.features.length : 0;
      setFeatureCounts((prev) => ({ ...prev, [layerType]: numFeatures }));

      if (hasSelections && numFeatures > 0) {
        if (layerType === "stretch" && activeStretchId) {
          const features = event.features;
          const targetFeature = features.find(
            (f: any) => f.get("Stretch_ID") === activeStretchId,
          );

          if (targetFeature) {
            const extent = targetFeature.getGeometry().getExtent();
            mapInstanceRef.current?.getView().fit(extent, {
              padding: [100, 100, 100, 100],
              duration: 1000,
            });
            return; // Stop here, don't do the general zoom
          }
        }

        // Check if we need to zoom to a specific RIVER
        if (layerType === "river" && activeRiverId && !activeStretchId) {
          const features = event.features;
          const targetFeature = features.find(
            (f: any) => f.get("River_Code") === activeRiverId,
          );

          if (targetFeature) {
            const extent = targetFeature.getGeometry().getExtent();
            mapInstanceRef.current?.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
            return;
          }
        }

        const extent = vectorSource.getExtent();
        if (extent && extent.some((val: number) => isFinite(val))) {
          mapInstanceRef.current?.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }
    };

    const handleFeaturesError = () => {
      console.log(`Error loading ${layerName} features`);
    };

    vectorSource.on("featuresloadend", handleFeaturesLoaded);
    vectorSource.on("featuresloaderror", handleFeaturesError);

    if (layerRef.current) {
      mapInstanceRef.current.removeLayer(layerRef.current);
    }

    mapInstanceRef.current.addLayer(vectorLayer);
    layerRef.current = vectorLayer;

    return () => {
      vectorSource.un("featuresloadend", handleFeaturesLoaded);
      vectorSource.un("featuresloaderror", handleFeaturesError);
    };
  };

  // Handle river system layers
  useEffect(() => {
    return createRiverSystemLayer(
      riverLayer,
      riverLayerRef,
      "river",
      10,
      showRiverLayer,
      riverFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      },
    );
  }, [
    riverLayer,
    riverFilter.filterField,
    riverFilter.filterValue,
    showRiverLayer,
    showTitles,
  ]);

  // Handle Stretch Layer
  useEffect(() => {
    // 1. Create a Custom Style Function just for this hook
    const stretchStyleFunction = (feature: any, resolution: number) => {
      // Get the ID of the feature being drawn
      const id = feature.get("Stretch_ID");

      // Check if it matches the selected one
      const isSelected = selectedStretch !== null && id === selectedStretch;

      // Get the base style from your existing helper
      // We call it to get the default array of styles
      const baseStyles = createVectorStyle("stretch", showTitles)(
        feature,
        resolution,
      );

      // If selected, modify the style
      if (isSelected) {
        // We know baseStyles is an array of Style objects.
        // For a LineString, usually the first one is the stroke.
        baseStyles.forEach((style: any) => {
          const stroke = style.getStroke();
          if (stroke) {
            stroke.setColor("#FFA500"); // Yellow Highlight
            stroke.setWidth(5); // Thicker
          }
          // Ensure it draws on top
          style.setZIndex(100);
        });
      }
      return baseStyles;
    };

    // 2. We need to pass this custom style to createRiverSystemLayer.
    // BUT createRiverSystemLayer uses 'createVectorStyle' internally hardcoded?
    // IF SO, we need to pass the style function as an argument.

    return createRiverSystemLayer(
      stretchLayer,
      stretchLayerRef,
      "stretch",
      5,
      showStretchLayer,
      stretchFilter as any,
      stretchStyleFunction, // <--- Pass this new argument
    );
  }, [
    stretchLayer,
    stretchFilter.filterField,
    stretchFilter.filterValue,
    showStretchLayer,
    showTitles,
    selectedStretch, // <--- Add this dependency so it updates when selection changes
  ]);

  useEffect(() => {
    return createRiverSystemLayer(
      drainLayer,
      drainLayerRef,
      "drain",
      6,
      showDrainLayer,
      drainFilter as {
        filterField: string | null;
        filterValue: number[] | string[] | null;
      },
    );
  }, [
    drainLayer,
    drainFilter.filterField,
    drainFilter.filterValue,
    showDrainLayer,
    showTitles,
  ]);

  // NEW: Dedicated Catchment Layer Logic
  useEffect(() => {
    // 1. Exit if map not ready or no drain selected
    if (!mapInstanceRef.current || selectedDrain === null) {
      // Ensure we clean up if we are in a Reset state
      if (catchmentLayerRef.current) {
        mapInstanceRef.current?.removeLayer(catchmentLayerRef.current);
        catchmentLayerRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;

    // 2. Define the Catchment Source (Direct CQL Filter)
    const catchmentSource = new VectorSource({
      format: new GeoJSON(),
      url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:Catchment&outputFormat=application/json&srsname=EPSG:3857&cql_filter=Drain_No=${selectedDrain}`,
    });

    // 3. Define the Catchment Layer
    const catchmentLayer = new VectorLayer({
      source: catchmentSource,
      style: new Style({
        stroke: new Stroke({
          color: "#FF5722", // Distinct Orange Color
          width: 2,
          lineDash: [10, 10], // Dashed line to distinguish it
        }),
        fill: new Fill({
          color: "rgba(255, 87, 34, 0.1)", // Light transparent fill
        }),
      }),
      zIndex: 20, // High z-index to sit on top
    });

    // 4. Add Layer to Map
    map.addLayer(catchmentLayer);
    catchmentLayerRef.current = catchmentLayer;

    // 5. Optional: Zoom to Catchment when loaded
    const handleSourceLoad = () => {
      const extent = catchmentSource.getExtent();
      if (extent && !extent.every((val) => val === Infinity)) {
        map.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
        });
      }
    };
    catchmentSource.once("featuresloadend", handleSourceLoad);

    // 6. Cleanup Function (Removes layer when drain changes/resets)
    return () => {
      map.removeLayer(catchmentLayer);
      if (catchmentLayerRef.current === catchmentLayer) {
        catchmentLayerRef.current = null;
      }
    };
  }, [selectedDrain, defaultWorkspace]); // Only depends on the ID

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
      setLegendData(null);
      setShowLegend(false);
      return;
    }

    try {
      const layerUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
      const workspace = rasterLayerInfo.workspace || "raster_work";
      const layerName =
        rasterLayerInfo.layer_name || "Clipped_STP_Priority_Map";
      const fullLayerName = workspace ? `${workspace}:${layerName}` : layerName;

      const wmsSource = new ImageWMS({
        url: layerUrl,
        params: {
          LAYERS: fullLayerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
          STYLES: rasterLayerInfo.style,
        },
        ratio: 1,
        serverType: "geoserver",
      });

      const legendUrlString = `${layerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000;bgColor:0xFFFFFF;dpi:96`;
      setLegendUrl(legendUrlString);
      setLegendData(rasterLayerInfo.legend_data ?? null);

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

  // ---------------------------------------------------------
  // DEDICATED ZOOM EFFECT
  // Runs whenever selectedRiver or selectedStretch changes
  // ---------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Helper to attempt zooming
    const tryZoomToFeature = (
      layerRef: any,
      idField: string,
      idValue: number,
    ) => {
      if (!layerRef.current) return false;

      const source = layerRef.current.getSource();
      if (!source) return false;

      // Check if features are ready
      const features = source.getFeatures();
      if (features.length === 0) return false; // Not loaded yet

      // Find feature
      const targetFeature = features.find(
        (f: any) => f.get(idField) === idValue,
      );

      if (targetFeature) {
        console.log(`Zooming to ${idField}: ${idValue}`);
        const extent = targetFeature.getGeometry().getExtent();
        map.getView().fit(extent, {
          padding: [100, 100, 100, 100],
          duration: 1000,
        });
        return true; // Success
      }
      return false; // Feature not found in current source
    };

    // 1. Try Zooming to Stretch
    if (selectedStretch) {
      // Try immediately
      const success = tryZoomToFeature(
        stretchLayerRef,
        "Stretch_ID",
        selectedStretch,
      );

      // If failed (maybe loading?), we can rely on the 'featuresloadend' listener
      // in createRiverSystemLayer OR set a small retry.
      // But since createRiverSystemLayer handles the "Load" case,
      // this effect handles the "Already Loaded" case.
      if (!success) {
        // Optional: Check River layer just in case it's there
      }
    }
    // 2. Try Zooming to River
    else if (selectedRiver) {
      tryZoomToFeature(riverLayerRef, "River_Code", selectedRiver);
    }
  }, [selectedRiver, selectedStretch, featureCounts]);
  // Added featureCounts as dependency -> Triggers effect when layers finish loading!

  return (
    <div className="relative w-full h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div
        className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200"
        ref={containerRef}
      >
        {/* The Map */}
        <div ref={mapRef} className="w-full h-full bg-blue-50" />

        {/* Hover Tooltip */}
        <LocalHoverTooltip
          hoveredFeature={hoveredFeature}
          mousePosition={mousePosition}
        />

        {/* Header Panel */}
        <div
          onClick={() => setShowHeaderButtons(!showHeaderButtons)}
          className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/10 hover:bg-white/90 transition-all duration-300 rounded-2xl shadow-xl px-2 py-1 flex items-center space-x-4 group cursor-pointer"
        >
          <span className="font-bold text-gray-400 group-hover:text-gray-900 flex items-center transition-colors duration-300">
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
            <span className="text-sm text-gray-900">GIS Viewer</span>
          </span>

          <div
            className={`flex space-x-2 transition-opacity duration-300 ${showHeaderButtons ? "opacity-100" : ""}`}
          >
            {["layers", "basemap" ].map((panel) => (
              <button
                key={panel}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePanel(panel);
                }}
                className={`p-2 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${activePanel === panel
                  ? "bg-blue-100 text-blue-600 shadow-inner"
                  : "hover:bg-gray-200 text-gray-700"
                  }`}
                title={panel.charAt(0).toUpperCase() + panel.slice(1)}
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
                    d={
                      panel === "layers"
                        ? "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        : panel === "basemap"
                          ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z"
                          : "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    }
                  />
                </svg>
              </button>
            ))}

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullScreen();
              }}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-700 transition-all duration-200 hover:scale-110 cursor-pointer"
              title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
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
                  d={
                    !isFullScreen
                      ? "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                      : "M6 18L18 6M6 6l12 12"
                  }
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="absolute right-4 top-3">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg"
          >
            <Image
              src="/openlayerslogo.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          </button>
        </div>

        {/* Panels */}
        {activePanel === "basemap" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-300">
            {/* Glass Dock Container */}
            <div className="flex items-center gap-4 px-5 py-3 bg-gray-500/20 hover:bg-gray-500/40 rounded-full shadow-2xl border border-white/10">
              {Object.entries(baseMaps).map(([key, baseMap]) => {
                const isSelected = selectedBaseMap === key;

                // 1. Get unique, real map previews for each type
                const getMapImage = (k: string) => {
                  if (k.includes("satellite"))
                    return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/5"; // Real Satellite
                  if (k.includes("dark"))
                    return "https://a.basemaps.cartocdn.com/dark_all/3/5/3.png"; // Dark Matter
                  if (k.includes("terrain") || k.includes("topo"))
                    return "https://c.tile.opentopomap.org/3/5/3.png"; // Terrain
                  if (k.includes("gray") || k.includes("light"))
                    return "https://a.basemaps.cartocdn.com/light_all/3/5/3.png"; // Light Gray
                  return "https://c.tile.openstreetmap.org/3/5/3.png"; // Standard OSM
                };

                return (
                  <div
                    key={key}
                    className="relative group flex flex-col items-center"
                  >
                    <button
                      onClick={() => changeBaseMap(key)}
                      style={{
                        backgroundImage: `url(${getMapImage(key)})`,
                        backgroundSize: "120%",
                        backgroundPosition: "85% 40%",
                        backgroundRepeat: "no-repeat",
                      }}
                      className={`
                        relative w-10 h-10 rounded-full transition-all duration-300 ease-out shadow-lg cursor-pointer 
                        ${isSelected
                          ? "ring-4 ring-white scale-110 z-10 shadow-blue-500/50" // Selected: White Ring + Glow
                          : "opacity-80 hover:opacity-100 hover:scale-105 hover:ring-2 hover:ring-white/50 grayscale hover:grayscale-0" // Unselected: Grayscale until hover
                        }
                      `}
                      aria-label={baseMap.name}
                    >
                      {/* Optional: Glossy Shine on top half for glass effect */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full pointer-events-none" />
                    </button>

                    {/* Floating Label (Appears on Hover) */}
                    <div
                      className={`
                      absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0
                      bg-black/80 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap pointer-events-none backdrop-blur-md border border-white/10
                    `}
                    >
                      {baseMap.name}
                    </div>

                    {/* Active Dot Indicator */}
                    {isSelected && (
                      <div className="absolute -bottom-3 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Layer Dropdown Panel */}
        {isPanelOpen && displayRaster.length > 0 && (
          <div className="absolute right-4 top-20 bg-white/50 backdrop-blur-md border border-gray-200/80 rounded-xl shadow-2xl p-4 w-72 z-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-800">
                Select Year
              </h3>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="text-gray-400 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-full cursor-pointer transition-all duration-200"
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
            <div className="max-h-56 overflow-y-auto">
              {[...new Set(displayRaster.map((r: any) => r.year))]
                .sort()
                .map((year: any) => (
                  <div
                    key={year}
                    className="flex items-center mb-2 p-2 hover:bg-blue-50/70 rounded-lg cursor-pointer"
                  >
                    <input
                      type="radio"
                      id={`year-${year}`}
                      name="yearSelection"
                      value={year}
                      checked={activeYear === year}
                      onChange={() => setActiveYear(year)}
                      className="mr-2 h-4 w-4 text-blue-600"
                    />
                    <label
                      htmlFor={`year-${year}`}
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      {year}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Layers Panel */}
        {activePanel === "layers" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/10 rounded-xl shadow-2xl p-3 max-w-xs w-full mx-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-sm">
                River System Layers
              </h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
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
            <div className="space-y-2">
              {
                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50/60 to-blue-100/60 border border-blue-200/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <span className="font-semibold text-blue-800 text-sm">
                        India Layer
                      </span>
                    </div>
                  </div>
                </div>
              }

              {Object.entries(featureCounts).map(([layerType, count]) => {
                if (layerType === "primary") return null;

                const colorConfig = LAYER_COLORS[layerType];
                const isVisible =
                  layerType === "river"
                    ? showRiverLayer
                    : layerType === "stretch"
                      ? showStretchLayer
                      : layerType === "drain"
                        ? showDrainLayer
                        : layerType === "catchment"
                          ? showCatchmentLayer
                          : true;

                const toggleFunction =
                  layerType === "river"
                    ? toggleRiverLayer
                    : layerType === "stretch"
                      ? toggleStretchLayer
                      : layerType === "drain"
                        ? toggleDrainLayer
                        : layerType === "catchment"
                          ? toggleCatchmentLayer
                          : () => { };

                return (
                  <div
                    key={layerType}
                    className={`p-3 rounded-lg border transition-all duration-300 ${isVisible
                      ? `bg-gradient-to-r from-${colorConfig.color.includes("blue")
                        ? "blue"
                        : colorConfig.color.includes("green")
                          ? "green"
                          : colorConfig.color.includes("red")
                            ? "red"
                            : "yellow"
                      }-50/60 to-${colorConfig.color.includes("blue")
                        ? "blue"
                        : colorConfig.color.includes("green")
                          ? "emerald"
                          : colorConfig.color.includes("red")
                            ? "red"
                            : "yellow"
                      }-50/60 border-${colorConfig.color.includes("blue")
                        ? "blue"
                        : colorConfig.color.includes("green")
                          ? "green"
                          : colorConfig.color.includes("red")
                            ? "red"
                            : "yellow"
                      }-200/80`
                      : "bg-gradient-to-r from-gray-50/60 to-gray-100/60 border-gray-200/80"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full mr-2 ${isVisible
                            ? colorConfig.color.replace("#", "bg-[") + "]"
                            : "bg-gray-400"
                            }`}
                          style={{
                            backgroundColor: isVisible
                              ? colorConfig.color
                              : "#9CA3AF",
                          }}
                        ></div>
                        <span
                          className={`font-semibold text-sm ${isVisible
                            ? colorConfig.color.includes("DC2626")
                              ? "text-red-800"
                              : colorConfig.color.includes("059669")
                                ? "text-green-800"
                                : colorConfig.color.includes("7C2D12")
                                  ? "text-yellow-800"
                                  : "text-blue-800"
                            : "text-gray-600"
                            }`}
                        >
                          {colorConfig.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={toggleFunction}
                          className={`w-10 h-5 rounded-full relative transition-all duration-300 ${isVisible
                            ? colorConfig.color.includes("DC2626")
                              ? "bg-red-500"
                              : colorConfig.color.includes("059669")
                                ? "bg-green-500"
                                : colorConfig.color.includes("7C2D12")
                                  ? "bg-yellow-500"
                                  : "bg-blue-500"
                            : "bg-gray-300"
                            }`}
                        >
                          <span
                            className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isVisible ? "translate-x-5" : ""
                              }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50/60 to-violet-50/60 border border-purple-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                      <span className="font-semibold text-purple-800 text-sm">
                        Raster Layer
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-700 mb-1">
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
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Panel */}
        {/* {activePanel === "tools" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/10 rounded-xl shadow-2xl p-3 max-w-xs w-full mx-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-sm">Map Tools</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
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
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowTitles(!showTitles)}
                className={`flex flex-col items-center p-2 rounded-lg transition-all duration-200 border ${showTitles
                  ? "bg-gradient-to-br from-green-50/70 to-green-100/70 border-green-200/80 text-green-700"
                  : "bg-gradient-to-br from-gray-50/60 to-gray-100/60 border-gray-200/80 text-gray-700"
                  }`}
              >
                <span className="text-sm font-semibold mb-0.5">
                  {showTitles ? "ON" : "OFF"}
                </span>
                <span className="text-xs font-medium">Display Labels</span>
              </button>

              <button
                onClick={() => {
                  setHoveredFeature(null);
                  selectInteractionRef.current?.getFeatures().clear();
                  hoverInteractionRef.current?.getFeatures().clear();
                }}
                className="flex flex-col items-center p-2 rounded-lg bg-gradient-to-br from-gray-50/60 to-gray-100/60 border border-gray-200/80 text-gray-700 hover:bg-gray-200/80"
              >
                <svg
                  className="w-5 h-5 mb-0.5"
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
                <span className="text-xs font-medium">Clear Selection</span>
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    const view = mapInstanceRef.current.getView();
                    view.setCenter(
                      fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
                    );
                    view.setZoom(INITIAL_ZOOM);
                  }
                }}
                className="flex flex-col items-center p-2 rounded-lg bg-gradient-to-br from-gray-50/60 to-gray-100/60 border border-gray-200/80 text-gray-700 hover:bg-gray-200/80"
              >
                <svg
                  className="w-5 h-5 mb-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a2 2 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-xs font-medium">Home View</span>
              </button>
            </div>
          </div>
        )} */}

        {(legendUrl || legendData) && rasterLayerInfo && (
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="absolute bottom-4 right-4 z-20 bg-white/80 p-2.5 rounded-xl shadow-lg border border-white/50 hover:bg-white transition-all duration-200 flex items-center gap-2 text-sm font-semibold text-gray-700 group cursor-pointer backdrop-blur-sm"
            title={showLegend ? "Hide Legend" : "Show Legend"}
          >
            <div
              className={`transition-transform duration-300 ${showLegend ? "rotate-180" : ""}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600"
              >
                <path d="M2 3h20" />
                <path d="M2 12h20" />
                <path d="M2 21h20" />
              </svg>
            </div>
            <span className="group-hover:text-blue-700">Legend</span>
          </button>
        )}

        {showLegend && (legendData || legendUrl) && rasterLayerInfo && (
          <div className="absolute bottom-16 right-4 z-20 bg-white/95 p-0 rounded-xl shadow-2xl border border-gray-100 w-[240px] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
            <div className="flex justify-between items-center p-3 bg-gray-50/80 border-b border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Legend
                </span>
                <span
                  className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[180px]"
                  title={rasterLayerInfo?.layer_name || "Layer Info"}
                >
                  {legendData?.display_name || rasterLayerInfo?.layer_name || "Layer Info"}
                </span>
                {legendData?.product_type !== "index_class" ? (
                  <span className="text-[11px] text-red-500 font-semibold mt-0.5">
                    Unit: MLD
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-full p-1 transition-all cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-4 bg-white max-h-[300px] overflow-y-auto custom-scrollbar">
              {legendData ? (
                <div className="flex flex-col space-y-1">
                  {legendData.classes.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start"
                      style={{ gap: "4pt" }}
                    >
                      <div
                        style={{
                          backgroundColor: item.color,
                          width: "20px",
                          height: "20px",
                          border: "0.5px solid #000000",
                          minWidth: "20px",
                        }}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-700 font-medium">
                          {item.swci_range || item.label}
                        </span>
                        {item.swci_range && item.label ? (
                          <span className="text-[11px] text-gray-500">
                            {item.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                legendUrl && (
                  <div className="flex justify-center">
                    <Image
                      src={legendUrl}
                      alt="Layer Legend"
                      className="max-w-full h-auto rounded-lg border border-gray-200 object-contain"
                      width={100}
                      height={100}
                      onErrorCapture={() => setError("Failed to load legend")}
                      unoptimized
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z" />
              <circle cx="12" cy="11" r="2" />
            </svg>
            <div
              className="text-xs font-mono text-slate-100 flex text-center items-center"
              id="mouse-position"
            ></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50/95 backdrop-blur-md border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-2xl flex items-center">
            <svg
              className="w-5 h-5 mr-3 text-red-500"
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
              className="absolute right-2 top-2 text-red-400 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Maping;
