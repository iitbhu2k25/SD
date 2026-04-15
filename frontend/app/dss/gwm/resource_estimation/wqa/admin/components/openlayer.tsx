import React, { useEffect, useRef, useState } from "react";
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
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { toLonLat } from "ol/proj";

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
import { useMap } from "@/contexts/gwm/water_quality_assesment/admin/MapContext";
import { useLocation } from "@/contexts/gwm/water_quality_assesment/admin/LocationContext";
import { baseMaps, GISCompass, HoverTooltip } from "@/components/MapComponents";
import { useYear } from "@/contexts/gwm/water_quality_assesment/admin/yearContext";
import { WQIInterface } from "@/interface/table";
import { toast } from "react-toastify";

// ── LegendEntry ───────────────────────────────────────────────────────────────
interface LegendEntry {
  label: string;
  color: string;
  opacity: number;
}

// ── NativeLegend ──────────────────────────────────────────────────────────────
const NativeLegend: React.FC<{
  entries: LegendEntry[];
  interpolation: "linear" | "discrete";
  onClose: () => void;
}> = ({ entries, interpolation, onClose }) => {
  const isContinuous = interpolation === "linear";

  const gradientStops = entries
    .map((e, i) => {
      const pct = entries.length <= 1 ? 50 : (i / (entries.length - 1)) * 100;
      return `${e.color} ${pct.toFixed(1)}%`;
    })
    .join(", ");

  const header = (
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Legend
        </span>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
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
  );

  if (entries.length === 0) {
    return (
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
        style={{ minWidth: 150, maxWidth: 260 }}
      >
        {header}
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-slate-400">No legend data</p>
        </div>
      </div>
    );
  }

  if (isContinuous) {
    const ROW_HEIGHT = 30;
    const RAMP_HEIGHT = Math.max(entries.length * ROW_HEIGHT, 40);
    return (
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
        style={{ minWidth: 150, maxWidth: 220 }}
      >
        {header}
        <div
          className="px-3 pb-3 pt-2 flex gap-2"
          style={{ height: RAMP_HEIGHT + 80 }}
        >
          <div
            className="flex-shrink-0 rounded-full border border-slate-200"
            style={{
              width: 30,
              background:
                entries.length > 1
                  ? `linear-gradient(to bottom, ${gradientStops})`
                  : entries[0].color,
            }}
          />
          <div className="flex flex-col justify-between flex-1 min-w-0">
            {entries.map((entry, i) => (
              <span
                key={i}
                className="text-[11px] font-mono text-slate-600 leading-none truncate"
                title={entry.label}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const barHeight = Math.max(entries.length * 24, 180);
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
      style={{ minWidth: 150, maxWidth: 260 }}
    >
      {header}
      <div className="px-3 pb-3 pt-2 flex gap-3 items-stretch w-full">
        <div
          className="flex-shrink-0 rounded border border-slate-200 overflow-hidden flex flex-col"
          style={{ width: 16, height: barHeight }}
        >
          {entries.map((e, i) => (
            <div
              key={i}
              style={{ flex: 1, background: e.color, opacity: e.opacity }}
            />
          ))}
        </div>
        <div
          className="flex flex-col justify-between"
          style={{ height: barHeight, flex: 1, minWidth: 0 }}
        >
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5 min-h-0">
              <span
                className="flex-shrink-0 rounded-sm border border-white shadow-sm"
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  background: entry.color,
                  opacity: entry.opacity,
                }}
              />
              <span
                className="text-[11px] font-mono text-slate-700 leading-tight truncate"
                title={entry.label}
              >
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  const pointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    secondary: 0,
  });
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [legendInterpolation] = useState<"linear" | "discrete">("discrete");
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showSecondaryLayer, setShowSecondaryLayer] = useState(true);
  const [showPrimaryLayer, setShowPrimaryLayer] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [selectedWellPoint, setSelectedWellPoint] = useState<any | null>(null);
  const [popupPixel, setPopupPixel] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [addedPoints, setAddedPoints] = useState<any[]>([]);
  const [showPointModal, setShowPointModal] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{
    id: number;
    coordinate: [number, number];
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showPointsList] = useState(false);
  const [showPointsLayer, setShowPointsLayer] = useState(true);
  const [formData, setFormData] = useState<WQIInterface>({
    Hardness: 0,
    Latitude: 0,
    Longitude: 0,
    Location: "",
    Arsenic: 0,
    Bicarbonate: 0,
    Calcium: 0,
    Carbonate: 0,
    Chloride: 0,
    Electrical_Conductivity: 0,
    Fluoride: 0,
    Iron: 0,
    Magnesium: 0,
    Nitrate: 0,
    pH_Level: 0,
    Potassium: 0,
    Sodium: 0,
    Sulfate: 0,
    Uranium: 0,
  });

  const { setWqiData, wqi_data, focusedWellPoint, setFocusedWellPoint } =
    useYear();

  // Context hooks
  const {
    displayRaster,
    setSelectedState,
    setSelectedDistricts,
    setSelectedSubDistricts,
    selectedSubDistricts,
    selectionsLocked,
  } = useLocation();
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
    showLegend,
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

  // Toggle add point mode
  const toggleAddPointMode = () => {
    setIsAddingPoint(!isAddingPoint);
    if (!isAddingPoint) {
      // Entering add point mode
      if (selectInteractionRef.current) {
        selectInteractionRef.current.setActive(false);
      }
    } else {
      // Exiting add point mode
      if (selectInteractionRef.current) {
        selectInteractionRef.current.setActive(!selectionsLocked);
      }
    }
  };

  // Save point with user details
  const savePoint = () => {
    if (!pendingPoint || wqi_data == null) return;

    // Validate required fields
    if (!formData.Location.trim()) {
      alert("Please enter a location name");
      return;
    }

    const finalData: WQIInterface = {
      ...formData,
      Latitude: pendingPoint.latitude,
      Longitude: pendingPoint.longitude,
    };

    const pointFeature = new Feature({
      geometry: new Point(pendingPoint.coordinate),
      pointData: {
        id: wqi_data.length + 1, // Use wqi_data length for consistent ID
        name: formData.Location,
        ...finalData,
      },
      wqiData: finalData,
    });

    if (pointsLayerRef.current) {
      pointsLayerRef.current.getSource()?.addFeature(pointFeature);
    }

    // Store in added points array
    setAddedPoints((prev) => [
      ...prev,
      {
        id: pendingPoint.id,
        name: formData.Location,
        coordinate: pendingPoint.coordinate,
        latitude: pendingPoint.latitude,
        longitude: pendingPoint.longitude,
        ...finalData,
      },
    ]);

    setWqiData((prev) => {
      if (prev === null) {
        return [finalData];
      } else {
        return [...prev, finalData];
      }
    });

    console.log("WQI Point Saved:", finalData);

    // Reset form and close modal
    setFormData({
      Hardness: 0,
      Latitude: 0,
      Longitude: 0,
      Location: "",
      Arsenic: 0,
      Bicarbonate: 0,
      Calcium: 0,
      Carbonate: 0,
      Chloride: 0,
      Electrical_Conductivity: 0,
      Fluoride: 0,
      Iron: 0,
      Magnesium: 0,
      Nitrate: 0,
      pH_Level: 7,
      Potassium: 0,
      Sodium: 0,
      Sulfate: 0,
      Uranium: 0,
    });
    setPendingPoint(null);
    setShowPointModal(false);
    setIsAddingPoint(false); // Exit add point mode after saving
  };

  useEffect(() => {
    if (pendingPoint) {
      setFormData((prev) => ({
        ...prev,
        Latitude: pendingPoint.latitude,
        Longitude: pendingPoint.longitude,
      }));
    }
  }, [pendingPoint]);
  // Cancel adding point
  const cancelPoint = () => {
    setShowPointModal(false);
    setPendingPoint(null);
  };

  // Zoom to fit all layers
  const zoomToLayers = () => {
    if (!mapInstanceRef.current) return;

    const layers = [];
    if (primaryLayerRef.current) layers.push(primaryLayerRef.current);
    if (secondaryLayerRef.current && showSecondaryLayer)
      layers.push(secondaryLayerRef.current);

    if (layers.length === 0) return;

    let combinedExtent: any = null;

    layers.forEach((layer) => {
      const source = layer.getSource();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.every((val: number) => isFinite(val))) {
          if (!combinedExtent) {
            combinedExtent = [...extent];
          } else {
            // Extend the combined extent
            combinedExtent[0] = Math.min(combinedExtent[0], extent[0]);
            combinedExtent[1] = Math.min(combinedExtent[1], extent[1]);
            combinedExtent[2] = Math.max(combinedExtent[2], extent[2]);
            combinedExtent[3] = Math.max(combinedExtent[3], extent[3]);
          }
        }
      }
    });

    if (combinedExtent) {
      mapInstanceRef.current.getView().fit(combinedExtent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
      });
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

  const createVectorStyle =
    (isSecondary = false) =>
    (feature: any, resolution: number) => {
      const geometry = feature.getGeometry();
      const geometryType = geometry.getType();
      const zoom = Math.round(
        Math.log(156543.03392 / resolution) / Math.log(2),
      );
      const featureName =
        feature.get("name") ||
        feature.get("Name") ||
        feature.get("NAME") ||
        feature.get("Location");
      const styles = [];

      const color = isSecondary ? "#5E1520" : "#3b82f6";
      const width = isSecondary ? 3 : 2;

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
  useEffect(() => {
    if (!mapInstanceRef.current || !pointsLayerRef.current) return;

    const source = pointsLayerRef.current.getSource();
    if (!source) return;

    // Clear existing features first
    source.clear();

    wqi_data?.forEach((data, index) => {
      const coordinate = fromLonLat([data.Longitude, data.Latitude]);
      const pointFeature = new Feature({
        geometry: new Point(coordinate),
        pointData: {
          id: index + 1,
          name: data.Location,
          ...data,
        },
        wqiData: data,
      });

      source.addFeature(pointFeature);
    });

    // Update addedPoints state to match
    const mappedPoints = wqi_data?.map((data, index) => ({
      id: index + 1,
      name: data.Location,
      coordinate: fromLonLat([data.Longitude, data.Latitude]),
      latitude: data.Latitude,
      longitude: data.Longitude,
      ...data,
    }));

    setAddedPoints(mappedPoints || []);
  }, [wqi_data]);
  // Style for added points
  const createPointStyle = (pointData: any) => {
    return new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: "#ffffff" }),
        stroke: new Stroke({ color: "#10b981", width: 2.5 }),
      }),
      text: new Text({
        text: pointData.name || `Point ${pointData.id}`,
        font: "bold 11px Arial, sans-serif",
        fill: new Fill({ color: "#064e3b" }),
        stroke: new Stroke({ color: "#ffffff", width: 3 }),
        offsetY: -16,
        textAlign: "center",
        textBaseline: "middle",
      }),
    });
  };

  // Add this useEffect to handle interaction disabling based on selectionsLocked
  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current) return;
    if (selectionsLocked) {
      selectInteractionRef.current.setActive(false);
    }
  }, [selectionsLocked]);

  // Separate useEffect to handle click events based on isAddingPoint state
  // Replace the existing click handler useEffect with this:
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    const handleMapClick = (event: any) => {
      if (!isAddingPoint) return;

      const coordinate = event.coordinate;
      const pixel = event.pixel;

      // Check if click is on a polygon feature
      let clickedOnPolygon = false;
      let clickedFeature: any = null;

      map.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          const geometry = feature.getGeometry();
          if (geometry && geometry.getType().includes("Polygon")) {
            clickedOnPolygon = true;
            clickedFeature = feature;
            return true; // Stop iteration
          }
        },
        {
          layerFilter: (layer) => {
            // Only check primary and secondary vector layers, not points layer
            return (
              layer === primaryLayerRef.current ||
              layer === secondaryLayerRef.current
            );
          },
        },
      );

      if (!clickedOnPolygon) {
        toast.error("Please click on a polygon feature to add a point", {
          position: "top-right",
        });

        return;
      }

      const lonLat = toLonLat(coordinate);
      const pointId = addedPoints.length + 1;

      // Optionally, you can get the polygon's name/properties
      const polygonName =
        clickedFeature?.get("name") ||
        clickedFeature?.get("Name") ||
        clickedFeature?.get("NAME") ||
        "Unknown Location";

      // Store pending point data and show modal
      setPendingPoint({
        id: pointId,
        coordinate: coordinate,
        longitude: lonLat[0],
        latitude: lonLat[1],
      });

      // Optionally pre-fill location with polygon name
      setFormData((prev) => ({
        ...prev,
        Location: polygonName,
        Latitude: lonLat[1],
        Longitude: lonLat[0],
      }));

      setShowPointModal(true);
    };

    map.on("singleclick", handleMapClick);

    return () => {
      map.un("singleclick", handleMapClick);
    };
  }, [isAddingPoint, addedPoints.length]);

  // Fly to focused well point and show popup
  useEffect(() => {
    if (!focusedWellPoint || !mapInstanceRef.current) return;

    const coordinate = fromLonLat([
      focusedWellPoint.Longitude,
      focusedWellPoint.Latitude,
    ]);
    const map = mapInstanceRef.current;

    // Fly to the point
    map
      .getView()
      .animate({ center: coordinate, zoom: 14, duration: 800 }, () => {
        // After animation, compute pixel and show popup
        const pixel = map.getPixelFromCoordinate(coordinate);
        if (pixel) {
          setSelectedWellPoint(focusedWellPoint);
          setPopupPixel([pixel[0], pixel[1]]);
        }
        setFocusedWellPoint(null);
      });
  }, [focusedWellPoint]);

  // Click handler for well point popup (non-add-point mode)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handlePointClick = (event: any) => {
      if (isAddingPoint) return;
      let found = false;
      map.forEachFeatureAtPixel(event.pixel, (feature: any, layer: any) => {
        if (!found && layer === pointsLayerRef.current) {
          const data = feature.get("wqiData");
          if (data) {
            setSelectedWellPoint(data);
            setPopupPixel([event.pixel[0], event.pixel[1]]);
            found = true;
          }
          return true;
        }
      });
      if (!found) setSelectedWellPoint(null);
    };

    map.on("singleclick", handlePointClick);
    return () => map.un("singleclick", handlePointClick);
  }, [isAddingPoint, mapReady]);

  // Initialize map only once
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
          if (!coordinate) return "";
          const [longitude, latitude] = coordinate;
          return `${latitude.toFixed(6)}°N, ${longitude.toFixed(6)}°E`;
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

    // Create a vector layer for added points
    const pointsSource = new VectorSource();
    const pointsLayer = new VectorLayer({
      source: pointsSource,
      zIndex: 10,
      style: (feature) => createPointStyle(feature.get("pointData")),
    });

    map.addLayer(pointsLayer);
    pointsLayerRef.current = pointsLayer;

    // Add Select interaction for double-clicks to select state
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

          if (subdistrictCode as number) {
            setSelectedSubDistricts([subdistrictCode]);
          } else if (districtCode as number) {
            setSelectedDistricts([districtCode]);
          } else if (stateCode) {
            setSelectedState(stateCode);
          } else {
            console.log(
              "No state code found in polygon properties:",
              feature.getProperties(),
            );
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
    setMapReady(true);

    setTimeout(() => {
      map.updateSize();
      setLoading(false);
      setIsLoading(false);
    }, 500);

    return () => {
      if (map) {
        map.un("pointermove", handleMouseMove);
        map.setTarget("");
      }
    };
  }, []); // Empty dependency array - map initializes only once

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
      setFeatureCounts((prev) => ({ ...prev, secondary: 0 }));
      if (secondaryLayerRef.current) {
        mapInstanceRef.current?.removeLayer(secondaryLayerRef.current);
        secondaryLayerRef.current = null;
      }
      return;
    }

    setIsLoading(true);

    const secondaryWfsUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${defaultWorkspace}:${secondaryLayer}&outputFormat=application/json&srsname=EPSG:3857&CQL_FILTER=${LayerFilter} IN (${
      Array.isArray(LayerFilterValue)
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
  ]);

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
      const layerUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
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

      setLegendUrl(fullLayerName);
      setShowLegend(true);
      setLegendEntries([]);
      // Fetch rich JSON legend entries
      (async () => {
        try {
          const jsonLegendUrl = `${layerUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=application/json&LAYER=${encodeURIComponent(fullLayerName)}`;
          const res = await fetch(jsonLegendUrl);
          if (!res.ok) {
            setLegendEntries([]);
            return;
          }
          const json = await res.json();
          const rules: any[] = json?.Legend?.[0]?.rules ?? [];
          const entries: LegendEntry[] = [];
          for (const rule of rules) {
            const sym = rule.symbolizers?.[0];
            const raster = sym?.Raster ?? sym?.raster;
            if (raster?.colormap?.entries) {
              for (const ce of raster.colormap.entries) {
                entries.push({
                  label: ce.label ?? ce.quantity ?? "",
                  color: ce.color,
                  opacity: parseFloat(ce.opacity ?? "1"),
                });
              }
            } else {
              const poly = sym?.Polygon ?? sym?.polygon;
              const color = poly?.fill ?? rule.fill ?? "#888";
              entries.push({
                label: rule.name ?? rule.title ?? "",
                color,
                opacity: 1,
              });
            }
          }
          setLegendEntries(entries);
        } catch {
          setLegendEntries([]);
        }
      })();

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
    <div className="relative w-full h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div
        className="relative w-full h-full flex-grow overflow-hidden rounded-xl shadow-2xl border border-gray-200"
        ref={containerRef}
      >
        {/* The Map */}
        <div
          ref={mapRef}
          className={`w-full h-full bg-blue-50 ${isAddingPoint ? "cursor-crosshair" : ""}`}
        />

        <div className="hidden md:block">
          <GISCompass />
        </div>

        <HoverTooltip
          hoveredFeature={hoveredFeature}
          mousePosition={mousePosition}
        />

        {/* Well Point Popup */}
        {selectedWellPoint &&
          popupPixel &&
          (() => {
            const containerW = containerRef.current?.clientWidth ?? 800;
            const containerH = containerRef.current?.clientHeight ?? 600;
            const popupW = 290;
            const popupH = 320;
            const offset = 14;
            const margin = 8;
            const flipX = popupPixel[0] + popupW + offset > containerW;
            const flipY = popupPixel[1] + popupH + offset > containerH;
            const rawLeft = flipX
              ? popupPixel[0] - popupW - offset
              : popupPixel[0] + offset;
            const rawTop = flipY
              ? popupPixel[1] - popupH - offset
              : popupPixel[1] + offset;
            const left = Math.max(
              margin,
              Math.min(rawLeft, containerW - popupW - margin),
            );
            const top = Math.max(
              margin,
              Math.min(rawTop, containerH - popupH - margin),
            );

            const params = [
              { label: "pH", val: selectedWellPoint.pH_Level, unit: "" },
              {
                label: "EC",
                val: selectedWellPoint.Electrical_Conductivity,
                unit: "µS/cm",
              },
              {
                label: "Hardness",
                val: selectedWellPoint.Hardness,
                unit: "mg/L",
              },
              { label: "As", val: selectedWellPoint.Arsenic, unit: "mg/L" },
              { label: "F⁻", val: selectedWellPoint.Fluoride, unit: "mg/L" },
              { label: "Fe", val: selectedWellPoint.Iron, unit: "mg/L" },
              { label: "NO₃", val: selectedWellPoint.Nitrate, unit: "mg/L" },
              { label: "Cl⁻", val: selectedWellPoint.Chloride, unit: "mg/L" },
              { label: "SO₄", val: selectedWellPoint.Sulfate, unit: "mg/L" },
              { label: "Ca²⁺", val: selectedWellPoint.Calcium, unit: "mg/L" },
              { label: "Mg²⁺", val: selectedWellPoint.Magnesium, unit: "mg/L" },
              { label: "Na⁺", val: selectedWellPoint.Sodium, unit: "mg/L" },
              { label: "K⁺", val: selectedWellPoint.Potassium, unit: "mg/L" },
              {
                label: "HCO₃",
                val: selectedWellPoint.Bicarbonate,
                unit: "mg/L",
              },
              { label: "CO₃", val: selectedWellPoint.Carbonate, unit: "mg/L" },
              { label: "U", val: selectedWellPoint.Uranium, unit: "µg/L" },
            ];

            return (
              <div
                className="absolute z-50 pointer-events-auto"
                style={{ left, top, width: popupW }}
              >
                {/* Callout arrow stub */}
                <div className="bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
                  {/* Header */}
                  <div className="flex items-start justify-between px-3.5 py-2.5 bg-slate-800 border-b border-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">
                          {selectedWellPoint.Location}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedWellPoint(null)}
                      className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2 mt-0.5"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Coordinates */}
                  <div className="flex gap-3 px-3.5 py-2 border-b border-slate-700/60">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-semibold text-slate-500 uppercase">
                        Lat
                      </span>
                      <span className="text-[11px] font-mono text-slate-300">
                        {Number(selectedWellPoint.Latitude).toFixed(4)}°
                      </span>
                    </div>
                    <div className="w-px bg-slate-700" />
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-semibold text-slate-500 uppercase">
                        Lon
                      </span>
                      <span className="text-[11px] font-mono text-slate-300">
                        {Number(selectedWellPoint.Longitude).toFixed(4)}°
                      </span>
                    </div>
                  </div>

                  {/* Parameters grid */}
                  <div className="px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[260px] overflow-y-auto">
                    {params.map((p) => (
                      <div
                        key={p.label}
                        className="flex items-center justify-between gap-1"
                      >
                        <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                          {p.label}
                        </span>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-[11px] font-mono font-semibold text-slate-200 tabular-nums">
                            {typeof p.val === "number"
                              ? p.val.toFixed(2)
                              : p.val}
                          </span>
                          {p.unit && (
                            <span className="text-[9px] text-slate-500">
                              {p.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Header Panel */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-6 py-3 flex items-center space-x-4">
          <span className="font-bold text-gray-800 flex items-center">
            <svg
              className="w-6 h-6 mr-2 text-blue-600"
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
            GIS Viewer
          </span>

          <div className="flex space-x-1 sm:space-x-2">
            {["layers", "basemap", "tools"].map((panel) => (
              <button
                key={panel}
                onClick={() => togglePanel(panel)}
                className={`relative group p-1.5 rounded-full transition-all duration-200 hover:scale-110
    ${
      activePanel === panel
        ? "bg-blue-100 text-blue-600 shadow-inner"
        : "hover:bg-gray-100 text-gray-700"
    }`}
              >
                {/* Icon */}
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

            <button
              onClick={toggleFullScreen}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 transition-all duration-200 hover:scale-110"
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

        {/* Layer Selection Button */}
        <div className="absolute right-4 top-3 group">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="hover:opacity-80 transition-all duration-200 hover:scale-110 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20 relative"
          >
            <Image
              src="/openlayerslogo.svg"
              alt="Logo"
              width={32}
              height={32}
            />
            {/* Tooltip */}
            <span className="absolute  -bottom-10 -left-1 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              Raster Layers
            </span>
          </button>
        </div>

        {/* Panels */}
        {activePanel === "basemap" && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100 px-3 py-2 flex items-center gap-1.5">
            {Object.entries(baseMaps).map(([key, baseMap]) => (
              <button
                key={key}
                onClick={() => {
                  changeBaseMap(key);
                  setActivePanel(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                  selectedBaseMap === key
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
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
                {baseMap.name}
              </button>
            ))}
          </div>
        )}

        {/* Layer Dropdown Panel */}
        {isPanelOpen && displayRaster.length > 0 && (
          <div className="absolute right-4 top-20 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl p-6 w-80 z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Select Layer</h3>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {displayRaster.map((layer, index) => (
                <div
                  key={index}
                  className="flex items-center mb-3 p-3 hover:bg-blue-50 rounded-lg cursor-pointer"
                >
                  <input
                    type="radio"
                    id={`layer-${index}`}
                    name="layerSelection"
                    value={layer.file_name}
                    checked={selectedradioLayer === layer.file_name}
                    onChange={() => handleLayerSelection(layer.file_name)}
                    className="mr-3 h-4 w-4 text-blue-600"
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

        {activePanel === "layers" && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-3 min-w-[240px] max-w-xs">
            {/* Header */}
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Layers
              </span>
              <button
                onClick={() => setActivePanel(null)}
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
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

            <div className="space-y-1.5">
              {/* Primary Layer */}
              {featureCounts.primary > 0 && (
                <div
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors ${
                    showPrimaryLayer
                      ? "bg-blue-50 border-blue-300"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        showPrimaryLayer ? "bg-blue-500" : "bg-slate-400"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        showPrimaryLayer ? "text-blue-600" : "text-slate-600"
                      }`}
                    >
                      Primary
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        showPrimaryLayer
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {featureCounts.primary}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const next = !showPrimaryLayer;
                      setShowPrimaryLayer(next);
                      if (next && showSecondaryLayer) {
                        setShowSecondaryLayer(false);
                        secondaryLayerRef.current?.setVisible(false);
                      }
                      primaryLayerRef.current?.setVisible(next);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      showPrimaryLayer ? "bg-blue-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        showPrimaryLayer ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Secondary Layer */}
              {featureCounts.secondary > 0 && (
                <div
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors ${
                    showSecondaryLayer
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        showSecondaryLayer ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        showSecondaryLayer
                          ? "text-emerald-600"
                          : "text-slate-600"
                      }`}
                    >
                      Secondary
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        showSecondaryLayer
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {featureCounts.secondary}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      const next = !showSecondaryLayer;
                      setShowSecondaryLayer(next);
                      if (next && showPrimaryLayer) {
                        setShowPrimaryLayer(false);
                        primaryLayerRef.current?.setVisible(false);
                      }
                      secondaryLayerRef.current?.setVisible(next);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      showSecondaryLayer ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                        showSecondaryLayer ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}

              {addedPoints.length > 0 && (
  <div
    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border transition-colors ${
      showPointsLayer
        ? "bg-amber-50 border-amber-300"
        : "bg-slate-100 border-slate-200"
    }`}
  >
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          showPointsLayer ? "bg-amber-500" : "bg-slate-400"
        }`}
      />
      <span
        className={`text-xs font-semibold ${
          showPointsLayer ? "text-amber-600" : "text-slate-600"
        }`}
      >
        Points
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
          showPointsLayer
            ? "bg-amber-100 text-amber-600"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {addedPoints.length}
      </span>
    </div>

    <button
      onClick={() => {
        const next = !showPointsLayer;
        setShowPointsLayer(next);
        pointsLayerRef.current?.setVisible(next);
      }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        showPointsLayer ? "bg-amber-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          showPointsLayer ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  </div>
)}
              {/* Raster Layer */}
              {rasterLayerInfo && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-2.5 py-1.5 bg-purple-50 border-b border-slate-200 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-slate-700 truncate flex-1">
                      {rasterLayerInfo.layer_name}
                    </span>
                  </div>

                  <div className="px-2.5 py-2 bg-slate-50 space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Opacity</span>
                        <span className="text-purple-600 font-medium">
                          {layerOpacity}%
                        </span>
                      </div>

                      <input
                        type="range"
                        min="5"
                        max="95"
                        step={5}
                        value={layerOpacity}
                        onChange={handleOpacityChange}
                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${
                            ((layerOpacity - 5) / 90) * 100
                          }%, #cbd5f5 ${
                            ((layerOpacity - 5) / 90) * 100
                          }%, #cbd5f5 100%)`,
                        }}
                      />
                    </div>

                    {legendUrl && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          Legend
                        </span>
                        <button
                          onClick={() => setShowLegend(!showLegend)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            showLegend ? "bg-purple-500" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                              showLegend ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activePanel === "tools" && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-100 px-3 py-2 flex items-center gap-1.5">
            <button
              onClick={() => setShowTitles(!showTitles)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                showTitles
                  ? "bg-green-600 text-white border-green-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-green-400 hover:text-green-600"
              }`}
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              Labels {showTitles ? "On" : "Off"}
            </button>

            <button
              onClick={() => {
                setHoveredFeature(null);
                selectInteractionRef.current?.getFeatures().clear();
                hoverInteractionRef.current?.getFeatures().clear();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-600 transition-all duration-150"
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
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
              Clear
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
                setActivePanel(null);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all duration-150"
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
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
              Home
            </button>
          </div>
        )}

        {legendUrl && rasterLayerInfo && showLegend && (
          <div className="absolute bottom-16 right-16 z-20">
            <NativeLegend
              entries={legendEntries}
              interpolation={legendInterpolation}
              onClose={() => {
                setLegendUrl(null);
                setShowLegend(false);
              }}
            />
          </div>
        )}

        {/* Coordinates */}
        <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            ></svg>
            <div
              className="text-xs font-mono text-slate-100 "
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
