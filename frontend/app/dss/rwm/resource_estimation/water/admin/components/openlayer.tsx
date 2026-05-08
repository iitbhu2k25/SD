import React, { use, useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import TileWMS from "ol/source/TileWMS";
import GeoJSON from "ol/format/GeoJSON";
import Select from "ol/interaction/Select";
import { doubleClick, pointerMove } from "ol/events/condition";
import Image from "next/image";
import { fromLonLat } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { Style, Fill, Stroke, Circle, Text } from "ol/style";
import { useMap } from "@/contexts/water/admin/MapContext";
import { useLocation } from "@/contexts/water/admin/LocationContext";
import "ol/ol.css";
import { baseMaps, GISCompass, HoverTooltip } from "@/components/MapComponents";

interface MappingProps {
  rasterResponse?: any;
  activeYear?: number | null;
  onYearChange?: (year: number) => void;
}
const formatLayerTitle = (
  layerType: string,
  year: number,
  timeScale?: string,
  season?: string
) => {
  const typeMap: Record<string, string> = {
    "Water Budget": "Water_budget",
    "Surplus": "Surplus",
    "Deficit": "Deficit",
    "Index": "Index_class",
  };
  const prefix = typeMap[layerType] || layerType.replace(" ", "_");

  if (timeScale === "seasonal" && season) {
    return `${prefix}_${season}_${year}`;
  }
  return `${prefix}_${year}`;
};
const Maping: React.FC<MappingProps> = ({
  rasterResponse,
  activeYear,
  onYearChange,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const clippedRasterLayersRef = useRef<{ [key: string]: any }>({});

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    secondary: 0,
  });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("osm");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [clippedRasters, setClippedRasters] = useState<any[]>([]);
  const [activeLayerTitle, setActiveLayerTitle] = useState<string>("");
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [legendData, setLegendData] = useState<any>(null);

  // Context hooks
  const {
    displayRaster,
    setSelectedState,
    setSelectedDistricts,
    setSelectedSubDistricts,
    selectionsLocked,
  } = useLocation();
  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    handleLayerSelection,
    rasterLoading,
    setRasterLoading,
    setError,
    error,
    selectedradioLayer,
    setLoading,
    rasterLayerInfo,
    setRasterLayerInfo,
    shouldResetMap,
    setShouldResetMap,
  } = useMap();

  // ✅ RESET MAP FUNCTION
  const resetMapState = () => {
    console.log("🗺️ Resetting map state...");

    // Clear all clipped raster layers
    Object.keys(clippedRasterLayersRef.current).forEach((key) => {
      const layer = clippedRasterLayersRef.current[key];
      if (mapInstanceRef.current && layer) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    clippedRasterLayersRef.current = {};

    // Clear all other raster layers
    Object.keys(layersRef.current).forEach((key) => {
      const layer = layersRef.current[key];
      if (mapInstanceRef.current && layer) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    layersRef.current = {};

    // Reset map view to India center
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: 4.8,
        duration: 100,
      });
    }

    // Clear selections
    if (selectInteractionRef.current) {
      selectInteractionRef.current.getFeatures().clear();
    }
    if (hoverInteractionRef.current) {
      hoverInteractionRef.current.getFeatures().clear();
    }

    // Reset state
    setClippedRasters([]);
    setHoveredFeature(null);
    setLegendUrl(null);
    setLegendData(null); // Clear custom legend data
    setFeatureCounts({ primary: 0, secondary: 0 });
    setActivePanel(null);
    setActivePanel(null);
    setIsPanelOpen(false);


    console.log("✅ Map state reset complete");
  };

  // ✅ LISTEN FOR RESET SIGNAL
  useEffect(() => {
    if (shouldResetMap) {
      resetMapState();
      setShouldResetMap(false);
    }
  }, [shouldResetMap]);

  // Load clipped rasters function
  const loadClippedRasters = (rasterResponse: any) => {
    if (!mapInstanceRef.current || !rasterResponse) return;

    const { clipped_rasters, legend_data } = rasterResponse;

    if (!clipped_rasters || clipped_rasters.length === 0) {
      console.log("No clipped rasters to display");
      return;
    }

    // Clear previous raster layers
    Object.keys(clippedRasterLayersRef.current).forEach((key) => {
      const layer = clippedRasterLayersRef.current[key];
      mapInstanceRef.current?.removeLayer(layer);
    });
    clippedRasterLayersRef.current = {};

    // Add each clipped raster as a WMS layer
    clipped_rasters.forEach((raster: any, index: number) => {
      const {
        layer_name,
        workspace,
        style,
        original_name,
        layer_type,
        year,
        season,
      } = raster;

      const rasterSource = new ImageWMS({
        url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`,
        params: {
          SERVICE: "WMS",
          REQUEST: "GetMap",
          LAYERS: `${workspace}:${layer_name}`,
          STYLES: style || "",
          TRANSPARENT: true,
          VERSION: "1.1.1",
          FORMAT: "image/png",
        },
        ratio: 1,
        serverType: "geoserver",
      });

      const rasterLayer = new ImageLayer({
        source: rasterSource,
        zIndex: 5 + index,
        opacity: 0.75,
        visible: true,
        properties: {
          name: original_name,
          type: "clipped-raster",
          workspace,
          layerName: layer_name,
          style,
          layer_type,
          year,
          season,
        },
      });

      mapInstanceRef.current?.addLayer(rasterLayer);

      const layerId = `clipped_${layer_name}`;
      clippedRasterLayersRef.current[layerId] = rasterLayer;

      console.log(`✓ Loaded: ${original_name}`);
    });

    const activeRaster = clipped_rasters[clipped_rasters.length - 1];

    if (activeRaster) {
      // 1. Construct the full layer name (Workspace : LayerName)
      const fullLayerName = `${activeRaster.workspace}:${activeRaster.layer_name}`;

      // 2. Get the specific style ID from the response
      const styleId = activeRaster.style;

      // 3. Construct the GetLegendGraphic URL
      // We add LEGEND_OPTIONS to make it look cleaner (forceLabels, font, etc.)
      const legendRequestUrl =
        `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms?` +
        `REQUEST=GetLegendGraphic&` +
        `VERSION=1.0.0&` +
        `FORMAT=image/png&` +
        `WIDTH=20&HEIGHT=20&` +
        `LAYER=${fullLayerName}&` +
        `STYLE=${styleId}&` +
        `LEGEND_OPTIONS=forceLabels:on;fontName:Arial;fontSize:12;fontAntiAliasing:true`;

      setLegendUrl(legendRequestUrl);
      setShowLegend(true);
     setActiveLayerTitle(formatLayerTitle(
  activeRaster.layer_type,
  activeRaster.year,
  activeRaster.time_scale,
  activeRaster.season
));

      // ✅ Set custom legend data if available
      if (legend_data) {
        setLegendData(legend_data);
        console.log("✓ Custom Legend Data loaded:", legend_data);
      } else {
        setLegendData(null);
      }

      console.log("✓ Legend URL generated:", legendRequestUrl);
    }



    setClippedRasters(clipped_rasters);
    console.log(`✓ All ${clipped_rasters.length} clipped rasters loaded`);
  };

  // Effect to toggle layer visibility based on activeYear
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((layer: any) => {
      const layerYear = layer.get("year");
      if (layerYear === activeYear) {
        layer.setVisible(true);
        // Also update legend/title if this is the active layer
        const raster = clippedRasters.find((r) => r.year === activeYear);
        if (raster) {
          setActiveLayerTitle(formatLayerTitle(
  raster.layer_type,
  raster.year,
  raster.time_scale,
  raster.season
));
          const fullLayerName = `${raster.workspace}:${raster.layer_name}`;
          const styleId = raster.style;
          const legendRequestUrl =
            `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms?` +
            `REQUEST=GetLegendGraphic&` +
            `VERSION=1.0.0&` +
            `FORMAT=image/png&` +
            `WIDTH=20&HEIGHT=20&` +
            `LAYER=${fullLayerName}&` +
            `STYLE=${styleId}&` +
            `LEGEND_OPTIONS=forceLabels:on;fontName:Arial;fontSize:12;fontAntiAliasing:true`;
          setLegendUrl(legendRequestUrl);
          if (raster.legend_data) {
            setLegendData(raster.legend_data);
          } else {
            setLegendData(null);
          }
        }
      } else {
        layer.setVisible(false);
      }
    });
  }, [activeYear, clippedRasters]);

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

  const createVectorStyle =
    (isSecondary = false) =>
      (feature: any, resolution: number) => {
        const geometry = feature.getGeometry();
        const geometryType = geometry.getType();
        const zoom = Math.round(
          Math.log(156543.03392 / resolution) / Math.log(2),
        );
        const featureName =
          feature.get("name") || feature.get("Name") || feature.get("NAME");
        const styles = [];

        // Determine admin level based on properties
        const isSubDistrict = feature.get("subdis_cod");
        const isDistrict = feature.get("district_c") && !isSubDistrict;
        const isState =
          feature.get("State_Code") && !isDistrict && !isSubDistrict;

        // Default colors
        let color = "#404040"; // Fallback gray
        let width = 1.5;

        // Assign distinct colors based on administrative hierarchy
        if (isSubDistrict) {
          color = "#9932CC"; // Dark Orchid - Sub-district
          width = 1.8;
        } else if (isDistrict) {
          color = "#4169E1"; // Royal Blue - District
          width = 2.0;
        } else if (isState) {
          color = "#2F4F4F"; // Dark Slate Gray - State
          width = 2.5;
        } else if (isSecondary) {
          // Secondary selection highlight (if not covered by above)
          color = "#9932CC";
          width = 2.0;
        }

        // Override for simple primary/secondary logic if needed,
        // but prefer feature-based specific styling above.

        if (geometryType.includes("Polygon")) {
          styles.push(
            new Style({
              stroke: new Stroke({ color, width }),
              fill: new Fill({ color: "transparent" }),
            }),
          );
        }

        if (geometryType.includes("LineString")) {
          styles.push(
            new Style({
              stroke: new Stroke({ color, width: width + 2 }),
            }),
          );
        }

        if (geometryType.includes("Point")) {
          styles.push(
            new Style({
              image: new Circle({
                radius: 6,
                fill: new Fill({ color: color + "80" }),
                stroke: new Stroke({ color, width: 2 }),
              }),
            }),
          );
        }

        if (showTitles && zoom > 5 && featureName) {
          styles.push(
            new Style({
              text: new Text({
                text: featureName.toString(),
                font: "12px Arial, sans-serif",
                fill: new Fill({ color }),
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

  // Handle clipped rasters
  useEffect(() => {
    if (!rasterResponse || !mapInstanceRef.current) return;

    const { clipped_rasters } = rasterResponse;

    if (clipped_rasters && clipped_rasters.length > 0) {
      console.log("Loading clipped rasters from response...");
      loadClippedRasters(rasterResponse);
    }
  }, [rasterResponse]);

  // Main map initialization
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
        extent: [...fromLonLat([68, 7]), ...fromLonLat([97, 37])],
      }),
    ]);

    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls: controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: 7,
        minZoom: 4.8,
        maxZoom: 18,
        constrainResolution: true,
        smoothExtentConstraint: true,
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    // Add Select interaction for double-clicks
    const selectInteraction = new Select({
      condition: doubleClick,
      style: new Style({
        stroke: new Stroke({ color: "#ff0000", width: 3 }),
        fill: new Fill({ color: "rgba(255, 0, 0, 0.3)" }),
      }),
    });

    selectInteraction.on("select", (event) => {
      const selectedFeatures = event.selected;
      if (selectedFeatures.length > 0) {
        const feature = selectedFeatures[0];
        const geometry = feature.getGeometry();
        if (geometry && geometry.getType().includes("Polygon")) {
          const stateCode = feature.get("State_Code");
          const districtCode = feature.get("district_c");
          const subdistrictCode = feature.get("subdis_cod");

          if (subdistrictCode) {
            setSelectedSubDistricts([subdistrictCode]);
          } else if (districtCode) {
            setSelectedDistricts([districtCode]);
          } else if (stateCode) {
            setSelectedState(stateCode);
          }
        }

        setTimeout(() => {
          selectInteraction.getFeatures().clear();
        }, 500);
      }
    });

    // Add hover interaction
    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: "#ffaa00", width: 2 }),
        fill: new Fill({ color: "transparent" }),
      }),
    });

    hoverInteraction.on("select", (event) => {
      const hoveredFeatures = event.selected;
      if (hoveredFeatures.length > 0) {
        setHoveredFeature(hoveredFeatures[0]);
      } else {
        setHoveredFeature(null);
      }
    });

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

  // Handle primary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) return;

    setIsLoading(true);
    setError(null);

    const primaryWfsUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${primaryLayer}&outputFormat=application/json&srsname=EPSG:3857`;

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
      setFeatureCounts((prev) => ({ ...prev, primary: numFeatures }));
      setIsLoading(false);

      const primaryExtent = primaryVectorSource.getExtent();
      if (primaryExtent && primaryExtent.some((val) => isFinite(val))) {
        mapInstanceRef.current?.getView().fit(primaryExtent, {
          padding: [50, 50, 50, 50],
          duration: 100,
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

  // Handle secondary layer
  useEffect(() => {
    if (!mapInstanceRef.current || !secondaryLayer) {
      setFeatureCounts((prev) => ({ ...prev, secondary: 0 }));
      if (secondaryLayerRef.current) {
        mapInstanceRef.current?.removeLayer(secondaryLayerRef.current);
        secondaryLayerRef.current = null;
      }
      return;
    }

    setIsLoading(true);

    const secondaryWfsUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${secondaryLayer}&outputFormat=application/json&srsname=EPSG:3857&CQL_FILTER=${LayerFilter} IN (${Array.isArray(LayerFilterValue)
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
      setFeatureCounts((prev) => ({ ...prev, secondary: numFeatures }));
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
      secondaryVectorSource.un(
        "featuresloadend",
        handleSecondaryFeaturesLoaded,
      );
    };
  }, [
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    showTitles,
    showSecondaryLayer,
    defaultWorkspace,
  ]);

  // Update raster layer info
  useEffect(() => {
    displayRaster.forEach((item: any) => {
      if (item.file_name === selectedradioLayer) {
        setRasterLayerInfo(item);
      }
    });
  }, [selectedradioLayer, displayRaster]);

  // Toggle primary/secondary layer visibility
  useEffect(() => {
    if (primaryLayerRef.current && featureCounts.secondary > 0) {
      primaryLayerRef.current.setVisible(!showSecondaryLayer);
    } else if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(true);
    }
  }, [showSecondaryLayer, featureCounts.secondary]);

  // Handle interaction disabling
  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current) return;
    if (selectionsLocked) {
      selectInteractionRef.current.setActive(false);
    } else {
      selectInteractionRef.current.setActive(true);
    }
  }, [selectionsLocked]);

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

  // Update clipped raster opacity
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((layer: any) => {
      layer.setOpacity(layerOpacity / 100);
    });
  }, [layerOpacity]);

  return (
    <div className="relative w-full h-full flex flex-col bg-transparent">
      <div
        className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-transparent"
        ref={containerRef}
      >
        {/* The Map - Fully Transparent Background */}
        <div ref={mapRef} className="w-full h-full bg-transparent" />

        <HoverTooltip
          hoveredFeature={hoveredFeature}
          mousePosition={mousePosition}
        />

        {/* Header Panel - Always Visible */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/10  rounded-2xl shadow-xl px-3 py-2 flex items-center space-x-3">
          <span className="font-bold text-gray-900 flex items-center">
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

          <div className="flex space-x-2">
            {["layers", "basemap"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`p-2.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${activePanel === panel
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
              onClick={() => toggleFullScreen()}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-700 transition-all duration-200 hover:scale-110 cursor-pointer bg-gray-100"
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

        {/* Panels - All Always Visible with Transparent Backgrounds */}
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
          <div className="absolute right-4 top-20 bg-white/10  border-white/50 rounded-xl shadow-2xl p-4 w-72 z-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-800">
                Select Layer
              </h3>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="text-red-800 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-full cursor-pointer transition-all duration-200"
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
              {displayRaster.map((layer, index) => (
                <div
                  key={index}
                  className="flex items-center mb-2 p-2 hover:bg-blue-50/70 rounded-lg cursor-pointer"
                >
                  <input
                    type="radio"
                    id={`layer-${index}`}
                    name="layerSelection"
                    value={layer.file_name}
                    checked={selectedradioLayer === layer.file_name}
                    onChange={() => handleLayerSelection(layer.file_name)}
                    className="mr-2 h-4 w-4 text-blue-600"
                  />
                  <label
                    htmlFor={`layer-${index}`}
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    {layer.file_name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {isPanelOpen && (
          <div className="absolute right-4 top-16 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-4 w-60 z-50 border border-white/50 animate-in fade-in slide-in-from-top-4 duration-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-200 pb-1">
              Select Year
            </h3>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
              {[...new Set(clippedRasters.map((r: any) => r.year))].length > 0 ? (
                [...new Set(clippedRasters.map((r: any) => r.year))]
                  .sort()
                  .map((year: any) => (
                    <label
                      key={year}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-blue-50 p-1.5 rounded transition-colors"
                    >
                      <input
                        type="radio"
                        name="yearSelection"
                        value={year}
                        checked={activeYear === year}
                        onChange={() => onYearChange && onYearChange(year)}
                        className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">
                        {year}
                      </span>
                    </label>
                  ))
              ) : (
                <span className="text-xs text-gray-500 italic">
                  No years selected
                </span>
              )}
            </div>
          </div>
        )}

        <div className="absolute right-4 top-3 z-50">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:scale-110 transition-transform duration-200 border border-white/50"
            title="Toggle Years Panel"
          >
            <Image
              src="/openlayerslogo.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          </button>
        </div>

        {/* Layers Panel */}
        {activePanel === "layers" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/10  rounded-xl shadow-2xl p-3 max-w-xs w-full mx-2 border border-white/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-sm">Map Layers</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-red-800 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer "
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
              {/* Clipped Rasters Panel */}
              {clippedRasters.length > 0 && (
                <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                      <span className="font-semibold text-orange-800 text-sm">
                        Clipped Rasters ({clippedRasters.length})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                    {clippedRasters.map((raster: any) => (
                      <div
                        key={raster.layer_name}
                        className="p-1.5 bg-white/70 rounded border border-orange-100/80"
                      >
                        <p className="text-xs font-medium text-gray-700">
                          {raster.original_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {raster.year} • {raster.season}
                        </p>
                      </div>
                    ))}
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
                      onChange={(e) => {
                        const newOpacity = parseInt(e.target.value);
                        setLayerOpacity(newOpacity);
                        Object.values(clippedRasterLayersRef.current).forEach(
                          (layer: any) => {
                            layer.setOpacity(newOpacity / 100);
                          },
                        );
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              )}

              {featureCounts.primary > 0 && (
                <div
                  className={`p-4 rounded-xl border ${featureCounts.secondary > 0 && showSecondaryLayer
                    ? "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                    : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 ${featureCounts.secondary > 0 && showSecondaryLayer
                          ? "bg-gray-400"
                          : "bg-blue-500"
                          } rounded-full mr-3`}
                      ></div>
                      <span
                        className={`font-semibold ${featureCounts.secondary > 0 && showSecondaryLayer
                          ? "text-gray-600"
                          : "text-blue-800"
                          }`}
                      >
                        Primary Layer
                      </span>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full ${featureCounts.secondary > 0 && showSecondaryLayer
                        ? "bg-gray-200/80 text-gray-700"
                        : "bg-blue-200/80 text-blue-800"
                        }`}
                    >
                      {featureCounts.primary} features
                    </span>
                  </div>
                </div>
              )}

              {featureCounts.secondary > 0 && (
                <div
                  className={`p-3 rounded-lg border ${showSecondaryLayer ? "bg-green-50/70 border-green-200/80" : "bg-gray-50/70 border-gray-200/80"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 ${showSecondaryLayer ? "bg-green-500" : "bg-gray-400"} rounded-full mr-2`}
                      ></div>
                      <span
                        className={`font-semibold text-sm ${showSecondaryLayer ? "text-green-800" : "text-gray-600"}`}
                      >
                        Secondary Layer
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${showSecondaryLayer ? "bg-green-200/80 text-green-800" : "bg-gray-200/80 text-gray-700"}`}
                      >
                        {featureCounts.secondary} features
                      </span>
                      <button
                        onClick={() => {
                          setShowSecondaryLayer(!showSecondaryLayer);
                          if (secondaryLayerRef.current) {
                            secondaryLayerRef.current.setVisible(
                              !showSecondaryLayer,
                            );
                          }
                        }}
                        className={`w-10 h-5 rounded-full ${showSecondaryLayer ? "bg-green-500" : "bg-gray-300"} relative transition-all duration-300`}
                        title={
                          showSecondaryLayer
                            ? "Hide secondary layer"
                            : "Show secondary layer"
                        }
                      >
                        <span
                          className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showSecondaryLayer ? "translate-x-5" : ""}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {rasterLayerInfo && (
                <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200/80">
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
        {activePanel === "tools" && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-white/10 rounded-xl shadow-2xl p-3 max-w-xs w-full mx-2 border border-white/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-sm">Map Tools</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="text-red-800 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
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
                className={`flex flex-col items-center p-4 rounded-xl transition-all duration-200 border ${showTitles
                  ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700"
                  : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                  }`}
              >
                <span className="text-sm font-semibold mb-0.5">
                  {showTitles ? "ON" : "OFF"}
                </span>
                <span className="text-xs font-medium">Display Titles</span>
              </button>

              <button
                onClick={() => {
                  setHoveredFeature(null);
                  selectInteractionRef.current?.getFeatures().clear();
                  hoverInteractionRef.current?.getFeatures().clear();
                }}
                className="flex flex-col items-center p-2 rounded-lg bg-gray-100/80 border border-gray-200/80 text-gray-700 hover:bg-gray-200/80"
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
                    view.setZoom(4.8);
                  }
                }}
                className="flex flex-col items-center p-2 rounded-lg bg-gray-100/80 border border-gray-200/80 text-gray-700 hover:bg-gray-200/80"
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
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-xs font-medium">Home View</span>
              </button>
            </div>
          </div>
        )}

        {(legendUrl || legendData) && (
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

        {/* Custom HTML Legend */}
        {showLegend && (legendData || legendUrl) && (
          <div className="absolute bottom-16 right-4 z-20 bg-white/95 p-0 rounded-xl shadow-2xl border border-gray-100 w-[240px] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-3 bg-gray-50/80 border-b border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
  Legend
</span>
                <span
                  className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[180px]"
                  title={activeLayerTitle}
                >
                  {legendData?.display_name || activeLayerTitle || "Layer Info"}
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

            {/* Legend Content */}
            <div className="p-4 bg-white max-h-[300px] overflow-y-auto custom-scrollbar">
              {legendData ? (
                /* Custom HTML Legend from Backend Data */
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
                /* Fallback to WMS Image Legend */
                legendUrl && (
                  <div className="flex justify-center">
                    <Image
                      src={legendUrl}
                      alt="Layer Legend"
                      className="max-w-full h-auto rounded-lg border border-gray-200 object-contain"
                      width={100}
                      height={100}
                      onErrorCapture={() => setError("Failed to load legend")}
                      unoptimized // remove this if the image domain is configured in next.config.js
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Coordinates - Transparent Background */}
        <div className="absolute left-2 bottom-10 z-10 bg-slate-800/70 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600/50 shadow-lg">
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
              className="text-xs font-mono text-slate-100"
              id="mouse-position"
            ></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-red-50/80 backdrop-blur-md border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-2xl flex items-center">
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
