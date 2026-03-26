"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileWMS from "ol/source/TileWMS";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent } from "ol/proj";
import { useStretch } from "./LocationContext";
import { useStretchApp } from "./AppContext";
import {
  WQ_PARAMETERS,
  BACKEND_PARAMETER_MAPPING,
  getBackendAttributeName,
  getParameterDefinition,
} from "@/app/dss/rwm/resource_estimation/river/components/waterQualityParameters";


export type WaterQualityParameter = (typeof WQ_PARAMETERS)[number];
export { WQ_PARAMETERS, BACKEND_PARAMETER_MAPPING };

// Base maps configuration
interface BaseMapDefinition {
  name: string;
  source: () => OSM | XYZ;
  icon: string;
}

const baseMaps: Record<string, BaseMapDefinition> = {
  osm: {
    name: "OpenStreetMap",
    source: () => new OSM({ crossOrigin: "anonymous" }),
    icon: "M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146",
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
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  terrain: {
    name: "Stamen Terrain",
    source: () =>
      new XYZ({
        url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
        maxZoom: 17,
        attributions:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        crossOrigin: "anonymous",
      }),
    icon: "M14 11l-4-8H6l4 8H6l6 10 6-10h-4z",
  },

  topo: {
    name: "Topographic",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions: "Tiles © Esri",
        crossOrigin: "anonymous",
      }),
    icon: "M7 14l5-5 5 5",
  },
  cartoLight: {
    name: "Carto Light",
    source: () =>
      new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions: "© OpenStreetMap contributors, © CARTO",
        crossOrigin: "anonymous",
      }),
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
};

interface LegendData {
  mean: number;
  max: number;
  min: number;
  parameter: string;
  colors?: Array<{ value: number, color: string, label: string }>;
  interpolation?: {
    parameter: string;
    parameterKey: string;
    analysisType: string;
    season: string;
    unit?: string;
    range?: string;
  };
}

interface StretchMapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  isInterpolationDisplayed: boolean;
  isInterpolationLoading: boolean;
  interpolationError: string | null;
  legendData: LegendData | null;

  // Map functions
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  zoomToCurrentExtent: () => void;

  // Interpolation functions
  addInterpolationLayer: (
    parameter: string,
    analysisType: string,
    season: string
  ) => void;
  removeInterpolationLayer: () => void;
  currentInterpolationParam: string | null;
  interpolationOpacity: number;
  setInterpolationOpacity: (opacity: number) => void;

  // Data fetching
  interpolationData: any;
  selectedDropdownParam: string | null;
  setSelectedDropdownParam: (param: string | null) => void;
  fetchWaterQualityData: (stretchIds: string[], season: string) => Promise<any>;
  generateInterpolation: (
    stretchIds: string[],
    season: string,
    parameter: string
  ) => Promise<void>;
  isProcessing: boolean;
  setCurrentInterpolationParam: (param: string) => void;
  dataError: string | null;
  selectedStretches: string[];

  // Layer controls
  isWaterQualityDisplayed: boolean;
  isStretchLinesDisplayed: boolean;
  toggleWaterQualityPoints: () => void;
  toggleStretchLines: () => void;

  // Configuration
  baseMaps: Record<string, BaseMapDefinition>;
  waterQualityParameters: typeof WQ_PARAMETERS;
  getParameterByKey: (key: string) => WaterQualityParameter | undefined;
  getBackendParameterName: (key: string) => string;

  isBasinDisplayed: boolean;
  isRiverDisplayed: boolean;
  isRiverBufferDisplayed: boolean;
  toggleBasinLayer: () => void;
  toggleRiverLayer: () => void;
  toggleRiverBufferLayer: () => void;
  toggleInterpolationLayer: () => void;
  resetView: () => void;
  showLayerPanel: boolean;
  setShowLayerPanel: (show: boolean) => void;
}

interface StretchMapProviderProps {
  children: ReactNode;
}

const StretchMapContext = createContext<StretchMapContextType>({
  mapInstance: null,
  selectedBaseMap: "satellite",
  isInterpolationDisplayed: false,
  isInterpolationLoading: false,
  interpolationError: null,
  legendData: null,
  setMapContainer: () => { },
  changeBaseMap: () => { },
  zoomToCurrentExtent: () => { },
  addInterpolationLayer: () => { },
  removeInterpolationLayer: () => { },
  currentInterpolationParam: null,
  interpolationOpacity: 0.8,
  setInterpolationOpacity: () => { },
  interpolationData: null,
  selectedDropdownParam: null,
  setSelectedDropdownParam: () => { },
  fetchWaterQualityData: async () => null,
  generateInterpolation: async () => { },
  isProcessing: false,
  setCurrentInterpolationParam: () => { },
  dataError: null,
  selectedStretches: [],
  isWaterQualityDisplayed: false,
  isStretchLinesDisplayed: false,
  toggleWaterQualityPoints: () => { },
  toggleStretchLines: () => { },
  baseMaps: baseMaps,
  waterQualityParameters: WQ_PARAMETERS,
  getParameterByKey: () => undefined,
  getBackendParameterName: () => "",

  isBasinDisplayed: true,
  isRiverDisplayed: true,
  isRiverBufferDisplayed: true,
  toggleBasinLayer: () => { },
  toggleRiverLayer: () => { },
  toggleRiverBufferLayer: () => { },
  toggleInterpolationLayer: () => { },
  resetView: () => { },
  showLayerPanel: false,
  setShowLayerPanel: () => { },
});

export const StretchMapProvider: React.FC<StretchMapProviderProps> = ({
  children,
}) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<OSM | XYZ> | null>(null);
  const basinLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverBufferLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const waterQualityLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const interpolationLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const stretchLinesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchHighlightFrameRef = useRef(0);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [isInterpolationDisplayed, setIsInterpolationDisplayed] =
    useState(false);
  const [isInterpolationLoading, setIsInterpolationLoading] = useState(false);
  const [interpolationError, setInterpolationError] = useState<string | null>(
    null
  );
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const [currentInterpolationParam, setCurrentInterpolationParam] = useState<
    string | null
  >(null);
  const [interpolationOpacity, setInterpolationOpacity] = useState(0.8);
  const [interpolationData, setInterpolationData] = useState<any>(null);
  const [selectedDropdownParam, setSelectedDropdownParam] = useState<
    string | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isWaterQualityDisplayed, setIsWaterQualityDisplayed] = useState(true);
  const [isStretchLinesDisplayed, setIsStretchLinesDisplayed] = useState(true);

  const [isBasinDisplayed, setIsBasinDisplayed] = useState(true);
  const [isRiverDisplayed, setIsRiverDisplayed] = useState(true);
  const [isRiverBufferDisplayed, setIsRiverBufferDisplayed] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(false);


  // Get data from StretchContext
  const {
    basinData,
    riverData,
    riverBufferData,
    waterQualityData,
    selectedStretches,
    selectedSeason,
    areaConfirmed,
    stretchLinesData,
    stretchBufferData,
  } = useStretch();

  const { mapActions } = useStretchApp();

  const activeBufferData =
    selectedStretches.length > 0 && stretchBufferData?.features?.length
      ? stretchBufferData
      : riverBufferData;

  const getStretchLineStyles = (feature: any) => {
    const stretchId = String(feature.get("Stretch_ID") ?? "");
    const isSelectedStretch = selectedStretches.includes(stretchId);
    const hasSelection = selectedStretches.length > 0;

    if (!isSelectedStretch) {
      return new Style({
        stroke: new Stroke({
          color: hasSelection
            ? "rgba(255, 255, 255, 0.18)"
            : "rgba(255, 107, 53, 0.75)",
          width: hasSelection ? 1.4 : 2,
          lineCap: "round",
        }),
      });
    }

    const pulse = 0.5 + 0.5 * Math.sin(stretchHighlightFrameRef.current / 3);
    const glowOpacity = 0.28 + pulse * 0.2;
    const glowWidth = 6.2 + pulse * 1.3;

    return [
      new Style({
        stroke: new Stroke({
          color: "rgba(8, 47, 73, 0.82)",
          width: 4.4,
          lineCap: "round",
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: `rgba(56, 189, 248, ${glowOpacity.toFixed(2)})`,
          width: glowWidth + 0.3,
          lineCap: "round",
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: "#0F4C81",
          width: 3.25,
          lineCap: "round",
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: "rgba(125, 211, 252, 0.92)",
          width: 1.9,
          lineCap: "round",
          lineDash: [20, 14],
          lineDashOffset: -stretchHighlightFrameRef.current * 2.6,
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: "rgba(224, 242, 254, 0.88)",
          width: 0.95,
          lineCap: "round",
          lineDash: [4, 24],
          lineDashOffset: -stretchHighlightFrameRef.current * 4.4,
        }),
      }),
    ];
  };

  // Helper functions for parameter handling
  const getParameterByKey = (
    key: string
  ): WaterQualityParameter | undefined => {
    return getParameterDefinition(key) || undefined;
  };

  const getBackendParameterName = (key: string): string => {
    return getBackendAttributeName(key) || key;
  };

  // Register map actions with parent context
  useEffect(() => {
    mapActions.current.removeInterpolationLayer = removeInterpolationLayer;
  }, []);

  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    // Only initialize the map ONCE
    const baseLayer = new TileLayer({
      source: baseMaps[selectedBaseMap].source(),
      zIndex: 0,
      visible: true,
    });
    baseLayer.set("name", "base-layer");
    baseLayerRef.current = baseLayer;

    const map = new Map({
      target: mapContainer,
      layers: [baseLayer], // Only base layer for now; add others as needed
      view: new View({
        center: fromLonLat([78.9629, 20.5937]),
        zoom: 5,
      }),
    });

    mapInstanceRef.current = map;
    // Now add vector layers (basin, river, buffer, etc.) here or in more useEffects

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [mapContainer]); // <--- NOT [mapContainer, selectedBaseMap] !!!

  // All your existing useEffect hooks for layers remain the same...
  // [Basin layer, River layer, River buffer layer, Water quality points, Stretch lines effects]

  // Display basin layer
  useEffect(() => {
    if (!mapInstanceRef.current || !basinData?.features?.length) return;

    const map = mapInstanceRef.current;
    console.log(
      "Adding basin layer with",
      basinData.features.length,
      "features"
    );

    if (basinLayerRef.current) {
      map.removeLayer(basinLayerRef.current);
    }

    const basinSource = new VectorSource({
      features: new GeoJSON().readFeatures(basinData, {
        featureProjection: "EPSG:3857",
      }),
    });

    const basinLayer = new VectorLayer({
      source: basinSource,
      style: new Style({
        stroke: new Stroke({
          color: "#0000FF",
          width: 2,
        }),
        // fill: new Fill({
        //   color: "rgba(0,80,150, 0.8)",
        // }),
      }),
      zIndex: 1,
    });

    basinLayer.set("name", "basin-layer");
    basinLayerRef.current = basinLayer;
    map.addLayer(basinLayer);
    setIsBasinDisplayed(true);

    console.log("Basin layer added successfully");
  }, [basinData]);

  // Display river layer
  useEffect(() => {
    if (!mapInstanceRef.current || !riverData?.features?.length) return;

    const map = mapInstanceRef.current;
    console.log(
      "Adding river layer with",
      riverData.features.length,
      "features"
    );

    if (riverLayerRef.current) {
      map.removeLayer(riverLayerRef.current);
    }

    const riverSource = new VectorSource({
      features: new GeoJSON().readFeatures(riverData, {
        featureProjection: "EPSG:3857",
      }),
    });

    const riverLayer = new VectorLayer({
      source: riverSource,
      style: new Style({
        stroke: new Stroke({
          color: "#22C55E",
          width: 2,
        }),
      }),
      zIndex: 2,
    });

    riverLayer.set("name", "river-layer");
    riverLayerRef.current = riverLayer;
    map.addLayer(riverLayer);
    setIsRiverDisplayed(true);

    console.log("River layer added successfully");
  }, [riverData]);

  // Display river buffer layer
  useEffect(() => {
    if (!mapInstanceRef.current || !activeBufferData?.features?.length) return;

    const map = mapInstanceRef.current;
    console.log(
      "Adding river buffer layer with",
      activeBufferData.features.length,
      "features"
    );

    if (riverBufferLayerRef.current) {
      map.removeLayer(riverBufferLayerRef.current);
    }

    const bufferSource = new VectorSource({
      features: new GeoJSON().readFeatures(activeBufferData, {
        featureProjection: "EPSG:3857",
      }),
    });

    const bufferLayer = new VectorLayer({
      source: bufferSource,
      style: new Style({
        stroke: new Stroke({
          color: "#FFD700",
          width: 1,
        }),
        fill: new Fill({
          color: "rgba(255, 215, 0, 0.1)",
        }),
      }),
      zIndex: 3,
    });

    bufferLayer.set("name", "river-buffer-layer");
    riverBufferLayerRef.current = bufferLayer;
    map.addLayer(bufferLayer);
    setIsRiverBufferDisplayed(true);

    console.log("River buffer layer added successfully");
  }, [activeBufferData]);

  // Display water quality points
  useEffect(() => {
    if (!mapInstanceRef.current || !waterQualityData?.features?.length) {
      if (waterQualityLayerRef.current) {
        mapInstanceRef.current?.removeLayer(waterQualityLayerRef.current);
        waterQualityLayerRef.current = null;
        setIsWaterQualityDisplayed(false);
      }
      return;
    }

    const map = mapInstanceRef.current;
    console.log(
      "Adding water quality points with",
      waterQualityData.features.length,
      "features"
    );

    if (waterQualityLayerRef.current) {
      map.removeLayer(waterQualityLayerRef.current);
    }

    // Read all features from the GeoJSON collection at once to get a Feature[] (avoids Feature | Feature[] union)
    const features = new GeoJSON().readFeatures(waterQualityData, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    const vectorSource = new VectorSource({ features });

    const waterQualityPointsLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 40,
      style: (feature) => {
        const properties = feature.getProperties();
        const location = properties.Location || "";

        let color = "#666666";
        if (location.includes("Drain")) {
          color = "#f472b6";
        } else if (location.includes("Upstream")) {
          color = "#3b82f6";
        } else if (location.includes("Downstream")) {
          color = "#84cc16";
        }

        return new Style({
          image: new CircleStyle({
            radius: 10,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "rgba(255, 255, 255, 1)", width: 2 }),
          }),
        });
      },
    });

    waterQualityPointsLayer.set("name", "water-quality-points-layer");
    waterQualityLayerRef.current = waterQualityPointsLayer;
    map.addLayer(waterQualityPointsLayer);
    setIsWaterQualityDisplayed(true);

    console.log("Water quality points layer added successfully");
  }, [waterQualityData]);

  // Fit map extent
  useEffect(() => {
    if (!mapInstanceRef.current || !riverBufferLayerRef.current) return;

    const map = mapInstanceRef.current;
    const source = riverBufferLayerRef.current.getSource();

    if (source) {
      const extent = source.getExtent();
      if (extent && extent.some((coord) => isFinite(coord))) {
        console.log("Fitting map to river buffer extent");
        map.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: selectedStretches.length > 0 ? 13.5 : 9.5,
          duration: 800,
        });
      }
    }
  }, [activeBufferData, selectedStretches.length]);

  // Display stretch lines layer
  useEffect(() => {
    if (!mapInstanceRef.current || !stretchLinesData?.features?.length) {
      if (stretchLinesLayerRef.current) {
        mapInstanceRef.current?.removeLayer(stretchLinesLayerRef.current);
        stretchLinesLayerRef.current = null;
        setIsStretchLinesDisplayed(false);
      }
      return;
    }

    const map = mapInstanceRef.current;
    console.log(
      "Adding stretch lines layer with",
      stretchLinesData.features.length,
      "features"
    );

    if (stretchLinesLayerRef.current) {
      map.removeLayer(stretchLinesLayerRef.current);
    }

    const lineFeatures = new GeoJSON()
      .readFeatures(stretchLinesData, {
        featureProjection: "EPSG:3857",
      })
      .filter((feature) => {
        if (!selectedStretches.length) return true;
        const stretchId = String(feature.get("Stretch_ID") ?? "");
        return selectedStretches.includes(stretchId);
      });

    const stretchLinesSource = new VectorSource({
      features: lineFeatures,
    });

    const stretchLinesLayer = new VectorLayer({
      source: stretchLinesSource,
      style: (feature) => getStretchLineStyles(feature),
      zIndex: 15,
    });

    stretchLinesLayer.set("name", "stretch-lines-layer");
    stretchLinesLayerRef.current = stretchLinesLayer;
    map.addLayer(stretchLinesLayer);
    setIsStretchLinesDisplayed(true);

    const extent = stretchLinesSource.getExtent();
    if (
      selectedStretches.length > 0 &&
      extent &&
      extent.some((coord: number) => isFinite(coord))
    ) {
      map.getView().fit(extent, {
        padding: [60, 60, 60, 60],
        maxZoom: 13.5,
        duration: 900,
      });
    }

    console.log("Stretch lines layer added successfully");
  }, [stretchLinesData, selectedStretches]);

  useEffect(() => {
    if (!stretchLinesLayerRef.current) return;

    stretchLinesLayerRef.current.setStyle((feature) =>
      getStretchLineStyles(feature),
    );
    stretchLinesLayerRef.current.changed();
  }, [selectedStretches]);

  useEffect(() => {
    if (!selectedStretches.length || !stretchLinesLayerRef.current) return;

    let animationFrameId = 0;
    let lastTimestamp = 0;

    const animateSelectedStretch = (timestamp: number) => {
      if (timestamp - lastTimestamp >= 90) {
        lastTimestamp = timestamp;
        stretchHighlightFrameRef.current =
          (stretchHighlightFrameRef.current + 1) % 1000;
        stretchLinesLayerRef.current?.changed();
        mapInstanceRef.current?.render();
      }

      animationFrameId = window.requestAnimationFrame(animateSelectedStretch);
    };

    animationFrameId = window.requestAnimationFrame(animateSelectedStretch);

    /*
    const intervalId = window.setInterval(() => {
      stretchHighlightFrameRef.current =
        (stretchHighlightFrameRef.current + 1) % 1000;
      stretchLinesLayerRef.current?.changed();
    }, 90);
    */

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [selectedStretches, isStretchLinesDisplayed]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        if (basinLayerRef.current) {
          mapInstanceRef.current.removeLayer(basinLayerRef.current);
          basinLayerRef.current = null;
        }
        if (riverLayerRef.current) {
          mapInstanceRef.current.removeLayer(riverLayerRef.current);
          riverLayerRef.current = null;
        }
        if (riverBufferLayerRef.current) {
          mapInstanceRef.current.removeLayer(riverBufferLayerRef.current);
          riverBufferLayerRef.current = null;
        }
        if (stretchLinesLayerRef.current) {
          mapInstanceRef.current.removeLayer(stretchLinesLayerRef.current);
          stretchLinesLayerRef.current = null;
        }
        if (waterQualityLayerRef.current) {
          mapInstanceRef.current.removeLayer(waterQualityLayerRef.current);
          waterQualityLayerRef.current = null;
        }
      }
    };
  }, []);

  // Toggle functions
  const toggleWaterQualityPoints = () => {
    if (!waterQualityLayerRef.current || !mapInstanceRef.current) return;

    if (isWaterQualityDisplayed) {
      mapInstanceRef.current.removeLayer(waterQualityLayerRef.current);
      setIsWaterQualityDisplayed(false);
    } else {
      mapInstanceRef.current.addLayer(waterQualityLayerRef.current);
      setIsWaterQualityDisplayed(true);
    }
  };

  const toggleStretchLines = () => {
    if (!stretchLinesLayerRef.current || !mapInstanceRef.current) return;

    if (isStretchLinesDisplayed) {
      mapInstanceRef.current.removeLayer(stretchLinesLayerRef.current);
      setIsStretchLinesDisplayed(false);
    } else {
      mapInstanceRef.current.addLayer(stretchLinesLayerRef.current);
      setIsStretchLinesDisplayed(true);
    }
  };

  const changeBaseMap = (baseMapKey: string) => {
    if (!baseLayerRef.current) return;
    baseLayerRef.current.setSource(baseMaps[baseMapKey].source());
    setSelectedBaseMap(baseMapKey);
  };

  const fetchWaterQualityData = async (
    stretchIds: string[],
    season: string
  ) => {
    return null;
  };

  const generateInterpolation = async (
    stretchIds: string[],
    season: string,
    parameterKey: string
  ) => {
    if (!mapInstanceRef.current || stretchIds.length === 0) {
      console.warn(
        "Cannot generate interpolation: map not initialized or no stretches selected"
      );
      return;
    }

    setIsProcessing(true);
    setInterpolationError(null);

    try {
      const parameterInfo = getParameterByKey(parameterKey);
      if (!parameterInfo) {
        throw new Error(`Invalid parameter key: ${parameterKey}`);
      }

      const backendAttribute = getBackendParameterName(parameterKey);
      console.log(
        `Generating interpolation for ${parameterInfo.label} (${backendAttribute}), stretch-based, ${season}`
      );

      const url = `${process.env.NEXT_PUBLIC_DJANGO_URL}/rwm/interpolate/${encodeURIComponent(
        backendAttribute
      )}/stretchbased/${season}`;

      const requestBody = {
        Stretch_ID: stretchIds,
        points_data: waterQualityData,
      };

      console.log(`Making request to: ${url}`);
      console.log("Request body keys:", Object.keys(requestBody));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Full API response:", data);

      if (data.status === "error") {
        throw new Error(data.message || "Interpolation failed on the backend");
      }

      if (data.status === "success") {
        setInterpolationData(data);
        setLegendData({
          min: 0,
          max: 0,
          mean: 0,
          parameter: "",
          interpolation: {
            parameter: parameterInfo.label,
            parameterKey: parameterKey,
            analysisType: "stretchbased",
            season,
          },
        });

        addInterpolationLayerFromResponse(data, parameterInfo.label);
      }
    } catch (error: any) {
      console.log("Error generating interpolation:", error);
      setInterpolationError(
        `Failed to generate interpolation: ${error.message}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const addInterpolationLayerFromResponse = (
    data: any,
    parameterLabel: string
  ) => {
    if (!mapInstanceRef.current) return;

    removeInterpolationLayer();

    const { wms_url, primary_layer, extent, style_name } = data;
    console.log("WMS URL from backend:", wms_url);
    console.log("Primary layer:", primary_layer);
    console.log("Style name:", style_name);
    console.log("Extent:", extent);

    const workspace = `${process.env.NEXT_PUBLIC_FAST_WORKSPACE}`; // Extract from primary_layer or hardcode
    const fullStyleName = `${workspace}:${style_name}`;

    const wmsSource = new TileWMS({
      url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wms`,
      params: {
        LAYERS: primary_layer,
        FORMAT: "image/png",
        TRANSPARENT: true,
        VERSION: "1.1.1",
        TILED: true,
        STYLES: fullStyleName || "",
      },
      serverType: "geoserver",
      crossOrigin: "anonymous",
    });

    wmsSource.on("tileloaderror", (event: any) => {
      console.log("WMS tile load error:", event);
      if (event.tile) {
        const src = event.tile.getImage()?.src;
        console.log("Failed tile URL:", src);
      }
    });

    wmsSource.on("tileloadend", () => {
      console.log("WMS tile loaded successfully");
    });

    const interpolationLayer = new TileLayer({
      source: wmsSource,
      opacity: interpolationOpacity,
      zIndex: 5,
    });

    // Store legend data
    const stats = data.statistics;
    setLegendData((prev) => ({
      ...prev,
      min: stats.min,
      max: stats.max,
      mean: stats.mean,
      colors: data.color_stops || [],
      parameter: parameterLabel,
    }));

    interpolationLayer.set("name", "interpolation");
    interpolationLayerRef.current = interpolationLayer;
    mapInstanceRef.current.addLayer(interpolationLayer);
    setIsInterpolationDisplayed(true);
    setCurrentInterpolationParam(parameterLabel);

    if (stretchLinesLayerRef.current && isStretchLinesDisplayed) {
      mapInstanceRef.current.removeLayer(stretchLinesLayerRef.current);
      setIsStretchLinesDisplayed(false);
      console.log("Stretch lines hidden for interpolation display");
    }

    if (extent && extent.length === 4) {
      console.log("Fitting to extent:", extent);
      const mapExtent = transformExtent(extent, "EPSG:4326", "EPSG:3857");
      mapInstanceRef.current.getView().fit(mapExtent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
        maxZoom: 14,
      });
    }

    console.log(`Interpolation layer successfully added for ${parameterLabel}`);
  };

  const addInterpolationLayer = (
    parameter: string,
    analysisType: string,
    season: string
  ) => {
    if (!mapInstanceRef.current) return;

    if (interpolationLayerRef.current) {
      mapInstanceRef.current.removeLayer(interpolationLayerRef.current);
    }

    const wmsLayer = new TileLayer({
      source: new TileWMS({
        url: `${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wms`,
        params: {
          LAYERS: `riverwater_assessment:${parameter.toLowerCase()}_${season}_stretch_interpolation`,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
      }),
      opacity: interpolationOpacity,
    });

    interpolationLayerRef.current = wmsLayer;
    mapInstanceRef.current.addLayer(wmsLayer);
    setIsInterpolationDisplayed(true);
    setCurrentInterpolationParam(parameter);
  };

  const removeInterpolationLayer = () => {
    if (!mapInstanceRef.current || !interpolationLayerRef.current) return;

    mapInstanceRef.current.removeLayer(interpolationLayerRef.current);
    interpolationLayerRef.current = null;
    setIsInterpolationDisplayed(false);
    setCurrentInterpolationParam(null);
    setLegendData(null);
  };

  const changeInterpolationOpacity = (opacity: number) => {
    if (interpolationLayerRef.current) {
      interpolationLayerRef.current.setOpacity(opacity);
      setInterpolationOpacity(opacity);
    }
  };

  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;
    let maxZoom = 12;

    if (stretchLinesLayerRef.current && selectedStretches.length > 0) {
      targetLayer = stretchLinesLayerRef.current;
      maxZoom = 13.5;
    } else if (riverBufferLayerRef.current) {
      targetLayer = riverBufferLayerRef.current;
      maxZoom = 12;
    } else if (waterQualityLayerRef.current) {
      targetLayer = waterQualityLayerRef.current;
      maxZoom = 14;
    } else if (riverLayerRef.current) {
      targetLayer = riverLayerRef.current;
      maxZoom = 12;
    }

    if (targetLayer) {
      const source = targetLayer.getSource();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.some((coord: number) => isFinite(coord))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: maxZoom,
            duration: 1000,
          });
        }
      }
    }
  };

  const resetView = () => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot reset view: map not initialized");
      return;
    }

    const view = mapInstanceRef.current.getView();
    const basinCenter = fromLonLat([82.495045, 25.628354]);

    view.animate({
      center: basinCenter,
      zoom: 9.5,
      duration: 1000,
    });

    // Close layer panel on reset
    setShowLayerPanel(false);

    console.log("Map view reset to default");
  };

  // Toggle functions for layers
  const toggleBasinLayer = () => {
    if (!basinLayerRef.current || !mapInstanceRef.current) return;

    if (isBasinDisplayed) {
      mapInstanceRef.current.removeLayer(basinLayerRef.current);
      setIsBasinDisplayed(false);
      console.log("Basin layer hidden");
    } else {
      mapInstanceRef.current.addLayer(basinLayerRef.current);
      setIsBasinDisplayed(true);
      console.log("Basin layer shown");
    }
  };

  const toggleRiverLayer = () => {
    if (!riverLayerRef.current || !mapInstanceRef.current) return;

    if (isRiverDisplayed) {
      mapInstanceRef.current.removeLayer(riverLayerRef.current);
      setIsRiverDisplayed(false);
      console.log("River layer hidden");
    } else {
      mapInstanceRef.current.addLayer(riverLayerRef.current);
      setIsRiverDisplayed(true);
      console.log("River layer shown");
    }
  };

  const toggleRiverBufferLayer = () => {
    if (!riverBufferLayerRef.current || !mapInstanceRef.current) return;

    if (isRiverBufferDisplayed) {
      mapInstanceRef.current.removeLayer(riverBufferLayerRef.current);
      setIsRiverBufferDisplayed(false);
      console.log("River buffer layer hidden");
    } else {
      mapInstanceRef.current.addLayer(riverBufferLayerRef.current);
      setIsRiverBufferDisplayed(true);
      console.log("River buffer layer shown");
    }
  };

  const toggleInterpolationLayer = () => {
    if (!mapInstanceRef.current || !interpolationLayerRef.current) {
      console.warn("Cannot toggle interpolation: layer not initialized");
      return;
    }

    if (isInterpolationDisplayed) {
      // Hide the layer
      mapInstanceRef.current.removeLayer(interpolationLayerRef.current);
      setIsInterpolationDisplayed(false);
      console.log("Interpolation layer hidden");
    } else {
      // Show the layer
      mapInstanceRef.current.addLayer(interpolationLayerRef.current);
      setIsInterpolationDisplayed(true);
      console.log("Interpolation layer shown");
    }
  };


  const contextValue: StretchMapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedStretches,
    selectedBaseMap,
    isInterpolationDisplayed,
    isInterpolationLoading,
    interpolationError,
    legendData,
    setMapContainer,
    changeBaseMap,
    zoomToCurrentExtent,
    addInterpolationLayer,
    removeInterpolationLayer,
    currentInterpolationParam,
    interpolationOpacity,
    setInterpolationOpacity: changeInterpolationOpacity,
    interpolationData,
    selectedDropdownParam,
    setSelectedDropdownParam,
    fetchWaterQualityData,
    generateInterpolation,
    isProcessing,
    setCurrentInterpolationParam,
    dataError,
    isWaterQualityDisplayed,
    isStretchLinesDisplayed,
    toggleWaterQualityPoints,
    toggleStretchLines,
    baseMaps,
    waterQualityParameters: WQ_PARAMETERS,
    getParameterByKey,
    getBackendParameterName,
    isBasinDisplayed,
    isRiverDisplayed,
    isRiverBufferDisplayed,
    toggleBasinLayer,
    toggleRiverLayer,
    toggleRiverBufferLayer,
    toggleInterpolationLayer,
    resetView,
    showLayerPanel,
    setShowLayerPanel,
  };

  return (
    <StretchMapContext.Provider value={contextValue}>
      {children}
    </StretchMapContext.Provider>
  );
};

export const useStretchMap = (): StretchMapContextType => {
  const context = useContext(StretchMapContext);
  if (context === undefined) {
    throw new Error("useStretchMap must be used within a StretchMapProvider");
  }
  return context;
};

// Export additional types and constants
export { baseMaps };
export type { BaseMapDefinition, LegendData };

