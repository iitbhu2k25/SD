"use client";
import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
} from "react";
import ReactDOM from "react-dom";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from "ol/Overlay";
import TileWMS from "ol/source/TileWMS";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import ImageStatic from "ol/source/ImageStatic";
import GeoJSON from "ol/format/GeoJSON";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent, toLonLat } from "ol/proj";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { useLocation } from "@/contexts/riverwater_assessment/admin/LocationContext";
import { useApp } from "@/contexts/riverwater_assessment/admin/AppContext";

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
    name: "OpenTopo Map",
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
};
 
// Workspace used for GeoServer layer names (can be overridden via env var)
const WORKSPACE = process.env.NEXT_PUBLIC_GEOSERVER_WORKSPACE || "myworkspace_rwm";

interface LegendData {
  mean?: number;
  max?: number;
  min?: number;
  parameter?: string;
  colors?: Array<{value: number, color: string, label: string}>; 
  interpolation?: {
    parameter: string;
    parameterKey: string;
    analysisType: string;
    season: string;
    unit?: string;
    range?: string;
  };
}

// Data interfaces for the fetched data
interface RiverData {
  type: string;
  features: any[];
}

interface RiverBufferData {
  type: string;
  features: any[];
}

interface FetchedData {
  riverData: RiverData | null;
  riverBufferData: RiverBufferData | null;
}

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  isWaterQualityDisplayed: boolean;
  legendData: LegendData | null;
  fetchedData: FetchedData;
  isDataLoading: boolean;
  dataError: string | null;
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  addRasterLayer: (
    layerName: string,
    geoserverUrl: string,
    colorScheme?: any
  ) => void;
  removeRasterLayer: () => void;
  zoomToCurrentExtent: () => void;
  getAllLayers: () => any[];
  setLegendData: React.Dispatch<React.SetStateAction<LegendData | null>>;
  addRiverLayers: () => void;
  removeRiverLayers: () => void;
  addWaterQualityPoints: () => void;
  removeWaterQualityPoints: () => void;
  toggleWaterQualityPoints: () => void;
  isInterpolationDisplayed: boolean;
  isInterpolationLoading: boolean;
  interpolationError: string | null;
  addInterpolationLayer: (
    parameter: string,
    analysisType: string,
    season: string
  ) => void;
  removeInterpolationLayer: () => void;
  toggleInterpolationLayer: (
    parameter?: string,
    analysisType?: string,
    season?: string
  ) => void;
  currentInterpolationParam: string | null;
  attributeMapping: Record<string, string>;
  interpolationOpacity: number;
  setInterpolationOpacity: (opacity: number) => void;
  resetView: () => void;
  isRiverDisplayed: boolean;
  isRiverBufferDisplayed: boolean;
  toggleRiverLayer: () => void;
  toggleRiverBufferLayer: () => void;
  isSubDistrictDisplayed: boolean;
  toggleSubDistrictLayer: () => void;
  isInterpolationVisible: boolean;
  hideShowInterpolationLayer: () => void;
}

interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "satellite",
  isWaterQualityDisplayed: false,
  legendData: null,
  fetchedData: {
    riverData: null,
    riverBufferData: null,
  },
  isDataLoading: false,
  dataError: null,
  setMapContainer: () => {},
  changeBaseMap: () => {},
  addRasterLayer: () => {},
  removeRasterLayer: () => {},
  zoomToCurrentExtent: () => {},
  getAllLayers: () => [],
  setLegendData: () => {},
  addRiverLayers: () => {},
  removeRiverLayers: () => {},
  addWaterQualityPoints: () => {},
  removeWaterQualityPoints: () => {},
  toggleWaterQualityPoints: () => {},
  isInterpolationDisplayed: false,
  isInterpolationLoading: false,
  interpolationError: null,
  addInterpolationLayer: function (
    parameter: string,
    analysisType: string,
    season: string
  ): void {
    throw new Error("Function not implemented.");
  },
  removeInterpolationLayer: function (): void {
    throw new Error("Function not implemented.");
  },
  toggleInterpolationLayer: function (): void {
    throw new Error("Function not implemented.");
  },
  currentInterpolationParam: null,
  attributeMapping: {},
  interpolationOpacity: 1,
  setInterpolationOpacity: () => {},
  resetView: () => {},
  isRiverDisplayed: false,
  isRiverBufferDisplayed: false,
  toggleRiverLayer: () => {},
  toggleRiverBufferLayer: () => {},
  isSubDistrictDisplayed: true,
  toggleSubDistrictLayer: () => {},
  isInterpolationVisible: true,
  hideShowInterpolationLayer: () => {},
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const stateLayerRef = useRef<VectorLayer<any> | null>(null);
  const districtLayerRef = useRef<VectorLayer<any> | null>(null);
  const subdistrictLayerRef = useRef<VectorLayer<any> | null>(null);
  const villageOverlayLayerRef = useRef<VectorLayer<any> | null>(null);
  const rasterLayerRef = useRef<ImageLayer<any> | null>(null);
  const contourLayerRef = useRef<VectorLayer<any> | null>(null);
  const trendLayerRef = useRef<VectorLayer<any> | null>(null);
  const gsrLayerRef = useRef<VectorLayer<any> | null>(null);

  // New refs for river-related layers
  const riverLayerRef = useRef<VectorLayer<any> | null>(null);
  const riverBufferLayerRef = useRef<VectorLayer<any> | null>(null);
  const waterQualityLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const [isRasterDisplayed, setIsRasterDisplayed] = useState<boolean>(false);
  const [isVillageOverlayVisible, setIsVillageOverlayVisible] =
    useState<boolean>(false);
  const [isContourDisplayed, setIsContourDisplayed] = useState<boolean>(false);
  const [isTrendDisplayed, setIsTrendDisplayed] = useState<boolean>(false);
  const [isGsrDisplayed, setIsGsrDisplayed] = useState<boolean>(false);
  const [isWaterQualityDisplayed, setIsWaterQualityDisplayed] =
    useState<boolean>(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);

  // New state for fetched data
  const [fetchedData, setFetchedData] = useState<FetchedData>({
    riverData: null,
    riverBufferData: null,
  });
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Interpolation Layer for State variables
  const [isInterpolationDisplayed, setIsInterpolationDisplayed] =
    useState<boolean>(false);
  const [isInterpolationLoading, setIsInterpolationLoading] =
    useState<boolean>(false);
  const [interpolationError, setInterpolationError] = useState<string | null>(
    null
  );
  const [currentInterpolationParam, setCurrentInterpolationParam] = useState<
    string | null
  >(null);
  const [interpolationOpacity, setInterpolationOpacity] = useState<number>(0.8);
  const [isRiverDisplayed, setIsRiverDisplayed] = useState(false);
  const [isRiverBufferDisplayed, setIsRiverBufferDisplayed] = useState(false);
  const [isSubDistrictDisplayed, setIsSubDistrictDisplayed] = useState(true);

  const [isInterpolationVisible, setIsInterpolationVisible] = useState(true);

  const interpolationLayerRef = useRef<TileLayer<any> | null>(null);

  const attributeMapping = {
    pH: "pH",
    "TDS (ppm)": "TDS_mg_L_",
    "EC (μS/cm)": "EC__S_cm_",
    Temperature: "Temperatur",
    "Turbidity (FNU)": "Turbidity_",
    "DO (mg/L)": "DO_mg_L_",
    ORP: "ORP",
    "TSS (mg/l)": "TSS_mg_L_",
    COD: "COD_mg_L_",
    "BOD (mg/l)": "BOD_mg_L_",
    "TS (mg/l)": "TS_mg_L_",
    "Chloride (mg/l)": "Chloride_m",
    Nitrate: "Nitrate_mg",
    "Hardness(mg/l)": "Hardness_m",
    "Faecal Coliform (CFU/100 mL)": "Faecal_Col",
    "Total Coliform (CFU/100 mL)": "Total_Coli",
    WQI: "WQI",
  };

  // Inside MapProvider, after your state declarations
  const waterQualityParameters = [
    { key: "pH", label: "pH", unit: "" },
    { key: "TDSmgL", label: "TDS", unit: "mg/L" },
    { key: "ECScm", label: "EC", unit: "S/cm" },
    { key: "Temperatur", label: "Temperature", unit: "°C" },
    { key: "Turbidity", label: "Turbidity", unit: "NTU" },
    { key: "DOmgL", label: "Dissolved Oxygen", unit: "mg/L" },
    { key: "ORP", label: "ORP", unit: "mV" },
    { key: "TSSmgL", label: "TSS", unit: "mg/L" },
    { key: "CODmgL", label: "COD", unit: "mg/L" },
    { key: "BODmgL", label: "BOD", unit: "mg/L" },
    { key: "TSmgL", label: "Total Solids", unit: "mg/L" },
    { key: "Chloridem", label: "Chloride", unit: "mg/L" },
    { key: "Nitratemg", label: "Nitrate", unit: "mg/L" },
    { key: "Hardnessm", label: "Hardness", unit: "mg/L" },
    { key: "FaecalCol", label: "Faecal Coliform", unit: "MPN/100ml" },
    { key: "TotalColi", label: "Total Coliform", unit: "MPN/100ml" },
    { key: "WQI", label: "Water Quality Index", unit: "" },
  ];

  const {
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    areaConfirmed,
    waterQualityData,
    isLoadingWaterQuality,
    selectedSeason,
  } = useLocation();

  const { mapActions } = useApp();

  const popupOverlayRef = useRef<Overlay | null>(null);

  // Add this useEffect after your existing useEffect for fetchedData
  useEffect(() => {
    if (
      waterQualityData &&
      waterQualityData.features &&
      waterQualityData.features.length > 0 &&
      mapInstanceRef.current
    ) {
      console.log("Water quality data available, adding points to map");
      addWaterQualityPoints();
    } else {
      console.log("No water quality data or map not ready");
      removeWaterQualityPoints();
    }
  }, [waterQualityData, mapInstanceRef.current]);

  // Style for boundary layers (blue outline, hollow fill)
  const boundaryLayerStyle = new Style({
    stroke: new Stroke({
      color: "blue",
      width: 2,
    }),
  });

  // Style for village overlay when raster is displayed
  const villageOverlayStyle = new Style({
    stroke: new Stroke({
      color: "rgba(255, 255, 255, 0.8)",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(255, 255, 255, 0.05)",
    }),
  });

  // Styles for river layers
  const riverStyle = new Style({
    stroke: new Stroke({
      color: "rgba(0, 255, 0, 0.9)",
      width: 3,
    }),
  });

  const riverBufferStyle = new Style({
    stroke: new Stroke({
      color: "rgb(255, 234, 0)",
      width: 2,
    }),
    fill: new Fill({
      color: "rgba(100, 150, 255, 0.2)",
    }),
  });

  const shapefileStyle = new Style({
    stroke: new Stroke({
      color: "rgba(255, 165, 0, 0.8)",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(255, 165, 0, 0.6)",
    }),
  });

  const subdistrictStyle = new Style({
  stroke: new Stroke({
    color: "blue", // Orange boundary
    width: 2,
  }),
});

  // Style for water quality points
  const waterQualityPointStyle = new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({
        color: "rgba(255, 0, 0, 0.8)",
      }),
      stroke: new Stroke({
        color: "rgba(255, 255, 255, 0.9)",
        width: 2,
      }),
    }),
    text: new Text({
      font: "12px Arial",
      fill: new Fill({
        color: "rgba(0, 0, 0, 0.8)",
      }),
      stroke: new Stroke({
        color: "rgba(255, 255, 255, 0.9)",
        width: 2,
      }),
      offsetY: -20,
      backgroundStroke: new Stroke({
        color: "rgba(0, 0, 0, 0.2)", // Light gray border
        width: 1,
      }),
    }),
  });

  // Find this function in MapContext.tsx:
  const changeInterpolationOpacity = (opacity: number) => {
    if (interpolationLayerRef.current) {
      interpolationLayerRef.current.setOpacity(opacity);
      setInterpolationOpacity(opacity); // ✅ ADD THIS LINE
      console.log(`Interpolation opacity changed to: ${opacity}`);
    }
  };

  // Function to fetch data from APIs
  const fetchRiverData = async () => {
    if (!areaConfirmed || selectedSubDistricts.length === 0) {
      return;
    }

    setIsDataLoading(true);
    setDataError(null);

    // Prepare the request body with selected subdistrict codes
    const requestBody = {
      Sub_District_Code: selectedSubDistricts,
    };

    console.log("POST request body:", requestBody);
    console.log("Selected subdistricts:", selectedSubDistricts);

    const apiCalls = [
      {
        url: "/django/rwm/river/",
        name: "rivers",
      },
      {
        url: "/django/rwm/river_100m_buffer/subdistbased/",
        name: "riverBuffer",
      },
    ];

    try {
      console.log(
        "Fetching river data for selected subdistricts:",
        selectedSubDistricts
      );

      const fetchPromises = apiCalls.map(async (apiCall) => {
        try {
          console.log(
            `Making POST request to ${apiCall.url} with body:`,
            requestBody
          );

          const response = await fetch(apiCall.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          console.log(`Response status for ${apiCall.name}:`, response.status);
          console.log(
            `Response headers for ${apiCall.name}:`,
            response.headers
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log(
            `Fetched ${apiCall.name} data - Feature count:`,
            data.features?.length || 0
          );
          console.log(`Sample ${apiCall.name} data:`, data);
          return data;
        } catch (error) {
          console.error(
            `Error fetching ${apiCall.name} from ${apiCall.url}:`,
            error
          );
          throw error;
        }
      });

      const [riverData, riverBufferData] = await Promise.all(fetchPromises);

      setFetchedData({
        riverData,
        riverBufferData,
      });

      console.log("All river data fetched successfully");
      console.log("River features:", riverData.features?.length || 0);
      console.log("Buffer features:", riverBufferData.features?.length || 0);
    } catch (error) {
      console.error("Error fetching river data:", error);
      setDataError(
        `Failed to fetch river data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDataLoading(false);
    }
  };

  // Effect to fetch data when conditions are met
  useEffect(() => {
    if (areaConfirmed && selectedSubDistricts.length > 0) {
      console.log(
        "Area confirmed and subdistricts selected, fetching river data..."
      );
      // First clear any existing river data
      removeRiverLayers();
      fetchRiverData();
    } else {
      // Clear data if conditions are not met
      console.log("Clearing river data - conditions not met");
      removeRiverLayers();
      setFetchedData({
        riverData: null,
        riverBufferData: null,
      });
      setDataError(null);
    }
  }, [areaConfirmed, selectedSubDistricts]);


  const toggleSubDistrictLayer = () => {
  if (!mapInstanceRef.current) return;
  
  if (subdistrictLayerRef.current) {
    const isVisible = subdistrictLayerRef.current.getVisible();
    subdistrictLayerRef.current.setVisible(!isVisible);
    setIsSubDistrictDisplayed(!isVisible);
    console.log(`Subdistrict layer visibility: ${!isVisible}`);
  } else {
    console.warn("Subdistrict layer not available");
  }
};

  // Function to add river layers to the map
  const addRiverLayers = () => {
    if (!mapInstanceRef.current || !fetchedData.riverData) {
      console.warn(
        "Cannot add river layers: map not initialized or no data available"
      );
      return;
    }

    console.log("Adding river layers to map");

    try {
      // Remove existing river layers
      removeRiverLayers();

      // Add river layer
      if (fetchedData.riverData && fetchedData.riverData.features) {
        const riverSource = new VectorSource({
          features: new GeoJSON().readFeatures(fetchedData.riverData, {
            featureProjection: "EPSG:3857",
          }),
        });

        const riverLayer = new VectorLayer({
          source: riverSource,
          style: riverStyle,
          zIndex: 20,
        });

        riverLayer.set("name", "river");
        riverLayerRef.current = riverLayer;
        mapInstanceRef.current.addLayer(riverLayer);
        setIsRiverDisplayed(true);
        console.log("River layer added");
      }

      // Add river buffer layer
      if (fetchedData.riverBufferData && fetchedData.riverBufferData.features) {
        const riverBufferSource = new VectorSource({
          features: new GeoJSON().readFeatures(fetchedData.riverBufferData, {
            featureProjection: "EPSG:3857",
          }),
        });

        const riverBufferLayer = new VectorLayer({
          source: riverBufferSource,
          style: riverBufferStyle,
          zIndex: 19,
        });

        riverBufferLayer.set("name", "river-buffer");
        riverBufferLayerRef.current = riverBufferLayer;
        mapInstanceRef.current.addLayer(riverBufferLayer);
        setIsRiverBufferDisplayed(true);
        console.log("River buffer layer added");
      }

      // Zoom to extent of all river layers
      setTimeout(() => {
        zoomToRiverExtent();
      }, 500);
    } catch (error) {
      console.error("Error adding river layers:", error);
    }
  };

  // Function to remove river layers from the map
  const removeRiverLayers = () => {
    if (!mapInstanceRef.current) return;

    // Remove all river-related layers
    const layers = [riverLayerRef.current, riverBufferLayerRef.current];

    layers.forEach((layerRef, index) => {
      if (layerRef) {
        mapInstanceRef.current?.removeLayer(layerRef);
        console.log(`Removed river layer ${index + 1}`);
      }
    });

    // Also remove any layers that might have similar names
    const allLayers = mapInstanceRef.current.getAllLayers();
    allLayers.forEach((layer) => {
      const layerName = layer.get("name");
      if (
        layerName &&
        (layerName.includes("river") ||
          layerName.includes("buffer") ||
          layerName.includes("clipped"))
      ) {
        mapInstanceRef.current?.removeLayer(layer);
        console.log(`Removed layer with name: ${layerName}`);
      }
    });

    riverLayerRef.current = null;
    riverBufferLayerRef.current = null;
    setIsRiverDisplayed(false);
    setIsRiverBufferDisplayed(false);
  };

  // Function to zoom to river extent
  const zoomToRiverExtent = () => {
    if (!mapInstanceRef.current) return;

    const riverLayers = [
      riverLayerRef.current,
      riverBufferLayerRef.current,
    ].filter((layer) => layer !== null);

    if (riverLayers.length === 0) return;

    let combinedExtent: number[] | null = null;

    riverLayers.forEach((layer) => {
      const source = layer!.getSource();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.every((coord: number) => isFinite(coord))) {
          if (!combinedExtent) {
            combinedExtent = [...extent];
          } else {
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
        maxZoom: 14,
        duration: 1000,
      });
      console.log("Zoomed to river extent");
    }
  };

  // Function to add water quality points to the map
  const addWaterQualityPoints = () => {
    if (
      !mapInstanceRef.current ||
      !waterQualityData ||
      !waterQualityData.features ||
      waterQualityData.features.length === 0
    ) {
      console.warn(
        "Cannot add water quality points: map not initialized or no data available"
      );
      return;
    }

    console.log(
      "Adding water quality points to map",
      waterQualityData.features.length,
      "points"
    );

    try {
      // Remove existing water quality layer
      removeWaterQualityPoints();

      // Create features from GeoJSON water quality data
      const features: Feature[] = [];

      waterQualityData.features.forEach((feature) => {
        if (feature.geometry && feature.geometry.coordinates) {
          const olFeature = new Feature({
            geometry: new Point(
              fromLonLat([
                feature.geometry.coordinates[0],
                feature.geometry.coordinates[1],
              ])
            ),
          });

          // Set feature properties from GeoJSON properties
          const props = feature.properties;
          olFeature.setProperties({
            id: props.S_No_,
            location: props.Location || props.Sampling,
            subDistrict: props.Sub_Distri,
            ph: props.pH,
            tds: props.TDS_mg_L_,
            temperature: props.Temperatur,
            dissolvedOxygen: props.DO_mg_L_,
            turbidity: props.Turbidity_,
            cod: props.COD_mg_L_,
            bod: props.BOD_mg_L_,
            chloride: props.Chloride_m,
            nitrate: props.Nitrate_mg,
            hardness: props.Hardness_m,
            stretchId: props.Stretch_ID,
          });

          // Set dynamic style with label based on location type
          const location = props.Location || "";
          let color = "rgba(255, 0, 0, 1)"; // Default red

          if (location.includes("Drain")) {
            color = "rgba(244, 114, 182, 1)"; // Pink for drain
          } else if (location.includes("Upstream")) {
            color = "rgba(59, 130, 246, 1)"; // Blue for upstream
          } else if (location.includes("Downstream")) {
            color = "rgba(132, 204, 22, 1)"; // Green for downstream
          }

          const pointStyle = new Style({
            image: new CircleStyle({
              radius: 10,
              fill: new Fill({ color }),
              stroke: new Stroke({
                color: "rgba(255, 255, 255, 1)",
                width: 2,
              }),
            }),
            text: new Text({
              font: "12px Arial, sans-serif",
              text: props.Sampling || `Point ${props.S_No_}`,
              fill: new Fill({
                color: "rgba(0, 0, 0, 1)", // Black text
              }),
              backgroundFill: new Fill({
                color: "rgba(255, 255, 255, 0.9)", // White background
              }),
              padding: [3, 5, 3, 5], // top, right, bottom, left padding
              offsetY: -25,
              textAlign: "center",
              textBaseline: "bottom",
            }),
          });

          olFeature.setStyle(pointStyle);
          features.push(olFeature);
        }
      });

      // ADD THIS MISSING PART - Create and add the layer to the map
      if (features.length > 0) {
        const waterQualitySource = new VectorSource({
          features: features,
        });

        const waterQualityLayer = new VectorLayer({
          source: waterQualitySource,
          zIndex: 30, // Higher than river layers
        });

        waterQualityLayer.set("name", "water-quality-points");
        waterQualityLayerRef.current = waterQualityLayer;
        mapInstanceRef.current.addLayer(waterQualityLayer);
        setIsWaterQualityDisplayed(true);

        console.log(
          `Water quality points layer added with ${features.length} features`
        );
      }
    } catch (error) {
      console.error("Error adding water quality points:", error);
    }
  };

  // Function to remove water quality points from the map
  const removeWaterQualityPoints = () => {
    if (!mapInstanceRef.current) return;

    if (waterQualityLayerRef.current) {
      mapInstanceRef.current.removeLayer(waterQualityLayerRef.current);
      waterQualityLayerRef.current = null;
      setIsWaterQualityDisplayed(false);
      console.log("Water quality points layer removed");
    }
  };

  // Function to toggle water quality points visibility
  const toggleWaterQualityPoints = () => {
    if (isWaterQualityDisplayed) {
      removeWaterQualityPoints();
    } else {
      addWaterQualityPoints();
    }
  };

  const toggleRiverLayer = () => {
    if (!mapInstanceRef.current) return;

    if (riverLayerRef.current) {
      const isVisible = riverLayerRef.current.getVisible();
      riverLayerRef.current.setVisible(!isVisible);
      setIsRiverDisplayed(!isVisible);
      console.log(`River layer visibility: ${!isVisible}`);
    }
  };

  const toggleRiverBufferLayer = () => {
    if (!mapInstanceRef.current) return;

    if (riverBufferLayerRef.current) {
      const isVisible = riverBufferLayerRef.current.getVisible();
      riverBufferLayerRef.current.setVisible(!isVisible);
      setIsRiverBufferDisplayed(!isVisible);
      console.log(`River buffer layer visibility: ${!isVisible}`);
    }
  };

  useEffect(() => {
    if (fetchedData.riverData && mapInstanceRef.current) {
      addRiverLayers();
    } else {
      removeRiverLayers();
    }
  }, [fetchedData]);

  // Initialize map when container is set
  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });

    // Create India WFS layer
    const indiaLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace_rwm:India&outputFormat=application/json",
      }),
      style: boundaryLayerStyle,
      zIndex: 1,
    });

    // Set layer names for identification
    initialBaseLayer.set("name", "basemap");
    indiaLayer.set("name", "india");

    baseLayerRef.current = initialBaseLayer;
    indiaLayerRef.current = indiaLayer;

    const map = new Map({
      target: mapContainer,
      layers: [initialBaseLayer, indiaLayer],
      view: new View({
        center: fromLonLat([78.9629, 20.5937]), // Center of India
        zoom: 5,
        minZoom: 2,
        maxZoom: 20,
      }),
    });

    mapInstanceRef.current = map;
    console.log("River Water Map initialized with India WFS layer");

    // Error handling for WFS layer
    indiaLayer.getSource()?.on("featuresloaderror", (event: any) => {
      console.error("Error loading India WFS layer:", event);
    });
    indiaLayer.getSource()?.on("featuresloadend", () => {
      console.log("India WFS layer loaded successfully");
    });

    // Create popup overlay
    const popupElement = document.createElement("div");
    popupElement.className = "ol-popup";
    popupElement.style.display = "none";

    const overlay = new Overlay({
      element: popupElement,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
      positioning: "bottom-center",
      stopEvent: false,
      insertFirst: false,
    });

    map.addOverlay(overlay);
    popupOverlayRef.current = overlay;

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [mapContainer]);

  // Create WFS layer helper with error handling
  const createWFSLayer = (
    layerName: string,
    cqlFilter: string,
    zIndex: number,
    isVillageOverlay: boolean = false,
    customStyle?: Style
  ): VectorLayer<any> => {
    console.log(`Creating WFS layer: ${layerName} with filter: ${cqlFilter}`);

    let style = customStyle || boundaryLayerStyle;
    if (isVillageOverlay) {
      style = villageOverlayStyle;
    }

    const layer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace_rwm:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(
          cqlFilter
        )}`,
      }),
      style: style,
      zIndex,
      visible: isVillageOverlay ? isVillageOverlayVisible : true,
    });

    // Set layer name for identification
    if (isVillageOverlay) {
      layer.set("name", "village-overlay");
    } else if (layerName === "Village") {
      layer.set("name", "villages");
    } else if (layerName === "B_State") {
      layer.set("name", "state");
    } else if (layerName === "B_district") {
      layer.set("name", "district");
    } else if (layerName === "B_subdistrict") {
      layer.set("name", "subdistrict");
    }

    // Add error handling
    const source = layer.getSource();
    source?.on("featuresloaderror", (event: any) => {
      console.error(`Error loading layer ${layerName}:`, event);
    });
    source?.on("featuresloadstart", () => {
      console.log(`Started loading layer ${layerName}`);
    });
    source?.on("featuresloadend", () => {
      console.log(`Successfully loaded layer ${layerName}`);
    });

    return layer;
  };

  // Improved Zoom to feature helper
  const zoomToFeature = async (layerName: string, cqlFilter: string) => {
    if (!mapInstanceRef.current) return;

    try {
      console.log(
        `Attempting to zoom to ${layerName} with filter: ${cqlFilter}`
      );

      const wfsUrl = `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace_rwm:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(
        cqlFilter
      )}`;

      const response = await fetch(wfsUrl);
      if (!response.ok) {
        throw new Error(
          `WFS request failed for ${layerName}: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`WFS response for ${layerName}:`, data);

      if (data.features && data.features.length > 0) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let validCoords = false;

        // Log first few features for debugging
        console.log(`First feature geometry:`, data.features[0]?.geometry);

        data.features.forEach((feature: any, index: number) => {
          if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates;
            const geometryType = feature.geometry.type.toLowerCase();

            // Log geometry details for debugging
            if (index < 3) {
              console.log(
                `Feature ${index} - Type: ${geometryType}, Coords structure:`,
                coords
              );
            }

            const extractCoordinates = (coordArray: any): number[][] => {
              const allCoords: number[][] = [];

              const flatten = (arr: any, depth: number = 0): void => {
                if (!Array.isArray(arr)) return;

                // Check if this is a coordinate pair [longitude, latitude]
                if (
                  arr.length >= 2 &&
                  typeof arr[0] === "number" &&
                  typeof arr[1] === "number"
                ) {
                  allCoords.push([arr[0], arr[1]]);
                  return;
                }

                // Otherwise, recursively flatten
                arr.forEach((item) => {
                  if (Array.isArray(item)) {
                    flatten(item, depth + 1);
                  }
                });
              };

              flatten(coordArray);
              return allCoords;
            };

            const coordinates = extractCoordinates(coords);

            if (index < 3) {
              console.log(
                `Feature ${index} extracted coordinates (first 5):`,
                coordinates.slice(0, 5)
              );
            }

            coordinates.forEach(([x, y]) => {
              // Validate coordinates are within reasonable bounds
              if (
                typeof x === "number" &&
                typeof y === "number" &&
                x >= -180 &&
                x <= 180 &&
                y >= -90 &&
                y <= 90 &&
                !isNaN(x) &&
                !isNaN(y)
              ) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                validCoords = true;
              }
            });
          }
        });

        if (validCoords && minX !== Infinity) {
          console.log(
            `Calculated bounds for ${layerName}: [${minX}, ${minY}, ${maxX}, ${maxY}]`
          );

          // Add some padding to the bounds to ensure all features are visible
          const padding = 0.01; // ~1km at equator
          const paddedExtent = [
            minX - padding,
            minY - padding,
            maxX + padding,
            maxY + padding,
          ];

          // Transform extent to map projection (EPSG:3857)
          const extent = transformExtent(
            paddedExtent,
            "EPSG:4326",
            "EPSG:3857"
          );

          const view = mapInstanceRef.current.getView();
          view.fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom:
              layerName === "B_subdistrict"
                ? 12
                : layerName === "B_district"
                ? 9
                : 6,
            duration: 500,
          });

          console.log(`Successfully zoomed to ${layerName}`);
        } else {
          console.warn(`No valid coordinates found for ${layerName}`);
        }
      } else {
        console.warn(
          `No features found for ${layerName} with filter: ${cqlFilter}`
        );
      }
    } catch (error) {
      console.error(`Error zooming to ${layerName}:`, error);
    }
  };

  // Update state layer
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedState) {
      if (stateLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(stateLayerRef.current);
        stateLayerRef.current = null;
      }
      if (districtLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(districtLayerRef.current);
        districtLayerRef.current = null;
      }
      return;
    }

    if (stateLayerRef.current) {
      mapInstanceRef.current.removeLayer(stateLayerRef.current);
      stateLayerRef.current = null;
    }

    if (districtLayerRef.current) {
      mapInstanceRef.current.removeLayer(districtLayerRef.current);
    }

    const formattedStateCode = selectedState.toString().padStart(2, "0");
    const cqlFilter = `state_code = '${formattedStateCode}'`;

    // Create custom style for state with fill
    const stateStyle = new Style({
      stroke: new Stroke({
        color: "yellow",
        width: 2,
      }),
      // fill: new Fill({
      //   color: "rgba(255, 255, 0, 0.7)",
      // }),
    });

    const stateLayer = createWFSLayer(
      "B_State",
      cqlFilter,
      2,
      false,
      stateStyle
    );
    stateLayerRef.current = stateLayer;
    mapInstanceRef.current.addLayer(stateLayer);

    // Auto-zoom after layer loads
    stateLayer.getSource()?.on("featuresloadend", () => {
      setTimeout(() => {
        zoomToFeature("B_State", cqlFilter);
      }, 500);
    });

    //     const districtCql = `state_code = '${formattedStateCode}'`;
    //     const districtLayer = createWFSLayer("B_district", districtCql, 3, false);
    //     districtLayerRef.current = districtLayer;
    //     mapInstanceRef.current.addLayer(districtLayer);
    // districtLayer.getSource()?.on("featuresloadend", () => {
    //   setTimeout(() => {
    //     zoomToFeature("B_district", districtCql);
    //   }, 500);
    // });

    // console.log("Added state layer with filter:", districtCql);
  }, [selectedState]);

  // Update district layer
  useEffect(() => {
    if (!mapInstanceRef.current || selectedDistricts.length === 0) {
      if (districtLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(districtLayerRef.current);
        districtLayerRef.current = null;
      }
      if (subdistrictLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
        subdistrictLayerRef.current = null;
      }
      return;
    }

    if (stateLayerRef.current) {
      mapInstanceRef.current.removeLayer(stateLayerRef.current);
      stateLayerRef.current = null;
    }

    if (districtLayerRef.current) {
      mapInstanceRef.current.removeLayer(districtLayerRef.current);
    }

    if (subdistrictLayerRef.current) {
      mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
    }

    try {
      const districtCodes = selectedDistricts
        .map((code) => `'${code}'`)
        .join(",");
      const cqlFilter = `DISTRICT_C IN (${districtCodes})`;

      // Create custom style for state with fill
      const districtStyle = new Style({
        stroke: new Stroke({
          color: "rgba(0, 255, 0, 0.7)",
          width: 2,
        }),
        // fill: new Fill({
        //   color: "rgba(0, 255, 0, 0.7)", // Light blue fill for selected state
        // }),
      });

      const districtLayer = createWFSLayer(
        "B_district",
        cqlFilter,
        3,
        false,
        districtStyle
      );

      districtLayerRef.current = districtLayer;
      mapInstanceRef.current.addLayer(districtLayer);

      // const subdistrictCodes = selectedDistricts
      //   .map((code) => `'${code}'`)
      //   .join(",");
      // const subdistrictCql = `DISTRICT_C IN (${subdistrictCodes})`;
      // const subdistrictLayer = createWFSLayer(
      //   "B_subdistrict",
      //   subdistrictCql,
      //   4
      // );
      // subdistrictLayerRef.current = subdistrictLayer;
      // mapInstanceRef.current.addLayer(subdistrictLayer);

      // Auto-zoom after layer loads
      // districtLayer.getSource()?.on("featuresloadend", () => {
      //   setTimeout(() => {
      //     zoomToFeature("B_district", cqlFilter);
      //   }, 500);
      // });

      districtLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          zoomToFeature("B_district", cqlFilter);
        }, 500);
      });

      console.log("Added district layer with filter:", cqlFilter);
    } catch (error) {
      console.error("Error creating district layer:", error);
    }
  }, [selectedDistricts]);

  // Update subdistrict layer
  useEffect(() => {
    if (!mapInstanceRef.current || selectedSubDistricts.length === 0) {
      if (subdistrictLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
        subdistrictLayerRef.current = null;
        setIsSubDistrictDisplayed(false);
      }
      if (villageOverlayLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(villageOverlayLayerRef.current);
        villageOverlayLayerRef.current = null;
        setIsVillageOverlayVisible(false);
      }
      return;
    }

    if (districtLayerRef.current) {
      mapInstanceRef.current.removeLayer(districtLayerRef.current);
      districtLayerRef.current = null;
    }

    if (subdistrictLayerRef.current) {
      mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
    }

    try {
      const subdistrictCodes = selectedSubDistricts
        .map((code) => `'${code}'`)
        .join(",");
      const cqlFilter = `SUBDIS_COD IN (${subdistrictCodes})`;

      console.log("Creating subdistrict layer with filter:", cqlFilter);

      const subdistrictLayer = createWFSLayer("B_subdistrict", cqlFilter, 4, false, subdistrictStyle);

      subdistrictLayer.getSource()?.on("featuresloaderror", (event: any) => {
        console.error("Subdistrict layer loading error:", event);
      });
      subdistrictLayer.getSource()?.on("featuresloadend", () => {
        console.log("Subdistrict layer loaded successfully");
        setIsSubDistrictDisplayed(true);
        // Auto-zoom to subdistricts when loaded
        setTimeout(() => {
          zoomToFeature("B_subdistrict", cqlFilter);
        }, 500);
      });

      subdistrictLayerRef.current = subdistrictLayer;
      mapInstanceRef.current.addLayer(subdistrictLayer);

      console.log("Added subdistrict layer with filter:", cqlFilter);
    } catch (error) {
      console.error("Error creating subdistrict layer:", error);
    }
  }, [selectedSubDistricts]);

  // Function to get all layers
  const getAllLayers = () => {
    if (!mapInstanceRef.current) return [];
    return mapInstanceRef.current.getAllLayers();
  };

  // Function to zoom to current extent
  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;
    let maxZoom = 12;

    // Priority: River layers > Contour > GSR > Village overlay > Subdistricts > Districts > State
    if (riverLayerRef.current) {
      zoomToRiverExtent();
      return;
    } else if (contourLayerRef.current && isContourDisplayed) {
      targetLayer = contourLayerRef.current;
      maxZoom = 14;
    } else if (gsrLayerRef.current && isGsrDisplayed) {
      targetLayer = gsrLayerRef.current;
      maxZoom = 12;
    } else if (
      villageOverlayLayerRef.current &&
      isRasterDisplayed &&
      isVillageOverlayVisible
    ) {
      targetLayer = villageOverlayLayerRef.current;
      maxZoom = 14;
    } else if (subdistrictLayerRef.current) {
      targetLayer = subdistrictLayerRef.current;
      maxZoom = 12;
    } else if (districtLayerRef.current) {
      targetLayer = districtLayerRef.current;
      maxZoom = 9;
    } else if (stateLayerRef.current) {
      targetLayer = stateLayerRef.current;
      maxZoom = 6;
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
          console.log("Zoomed to current extent");
        }
      }
    }
  };

  // Function to reset map view to default
  const resetView = () => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot reset view: map not initialized");
      return;
    }

    const view = mapInstanceRef.current.getView();
    const indiaCenter = fromLonLat([78.9629, 20.5937]); // Center of India

    view.animate({
      center: indiaCenter,
      zoom: 5,
      duration: 1000,
    });

    console.log("Map view reset to India default");
  };

  // Enhanced addRasterLayer function
  const addRasterLayer = (
    layerName: string,
    geoserverUrl: string,
    colorScheme?: any
  ) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add raster layer: map not initialized");
      return;
    }

    console.log(`Adding raster layer: ${layerName} from ${geoserverUrl}`);

    try {
      // Remove existing raster layer if present
      if (rasterLayerRef.current) {
        console.log("Removing existing raster layer");
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
      }

      if (colorScheme) {
        setLegendData((prev) => ({
          ...prev,
          raster: {
            colors: colorScheme.colors,
            labels: colorScheme.labels,
            parameter: colorScheme.parameter,
            classes: colorScheme.classes,
          },
        }));
      }

      // Create ImageWMS source for raster display
      const imageWmsSource = new ImageWMS({
        url: geoserverUrl,
        params: {
          LAYERS: `${WORKSPACE}:${layerName}`,
          FORMAT: "image/png",
          TRANSPARENT: true,
          VERSION: "1.1.1",
          SRS: "EPSG:3857",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        ratio: 1,
      });

      // Create raster layer
      const rasterLayer = new ImageLayer({
        source: imageWmsSource,
        zIndex: 25,
        opacity: 0.85,
        visible: true,
      });

      rasterLayer.set("name", "raster");
      rasterLayer.set("type", "raster");

      // Add event listeners
      imageWmsSource.on("imageloaderror", (event: any) => {
        console.error(`ImageWMS error for layer ${layerName}:`, event);
      });

      imageWmsSource.on("imageloadend", () => {
        console.log(`Raster image loaded successfully for ${layerName}`);
        setIsRasterDisplayed(true);

        // Auto-zoom to raster extent after loading
        setTimeout(() => {
          const extent = rasterLayer.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });

      // Store reference
      rasterLayerRef.current = rasterLayer;

      // Add to map
      mapInstanceRef.current.addLayer(rasterLayer);

      // Force refresh
      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

      console.log(`Raster layer successfully added: ${layerName}`);
    } catch (error) {
      console.error("Error in addRasterLayer:", error);
    }
  };

  // Function to remove raster layer
  const removeRasterLayer = () => {
    if (!mapInstanceRef.current) return;

    if (rasterLayerRef.current) {
      console.log("Removing raster layer");
      mapInstanceRef.current.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
      setIsRasterDisplayed(false);
      // setLegendData((prev) => ({ ...prev, raster: undefined }));
      console.log("Raster layer removed successfully");
    }
  };

  // Change base map
  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) {
      console.warn("Cannot change basemap: map or base layer not initialized");
      return;
    }

    try {
      mapInstanceRef.current.removeLayer(baseLayerRef.current);

      const newBaseLayer = new TileLayer({
        source: baseMaps[baseMapKey].source(),
        zIndex: 0,
      });

      newBaseLayer.set("name", "basemap");
      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      setSelectedBaseMap(baseMapKey);

      console.log(`Changed basemap to: ${baseMapKey}`);
    } catch (error) {
      console.error("Error changing basemap:", error);
    }
  };

  // **********************************************Interpolation***********************************************
  // ============================================================================
  // REPLACE the existing addInterpolationLayer function in MapContext.tsx
  // with this updated version
  // ============================================================================

  const addInterpolationLayer = async (
    parameter: string,
    analysisType: string,
    season: string
  ) => {
    if (!mapInstanceRef.current || selectedSubDistricts.length === 0) {
      console.warn(
        "Cannot add interpolation layer: map not initialized or no subdistricts selected"
      );
      return;
    }

    setIsInterpolationLoading(true);
    setInterpolationError(null);

    try {
      console.log(
        `Fetching interpolation for ${parameter}, ${analysisType}, ${season}`
      );

      // Map the display parameter to backend parameter name
      const backendAttribute =
        attributeMapping[parameter as keyof typeof attributeMapping] ||
        parameter;

      const url = `/django/rwm/interpolate/${encodeURIComponent(
        backendAttribute
      )}/${analysisType}/${season}/`;

      // Prepare request body with all required data
      const requestBody = {
        Sub_District_Code: selectedSubDistricts,
        river_data: fetchedData.riverData,
        river_buffer_data: fetchedData.riverBufferData,
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
        // Remove existing interpolation layer
        removeInterpolationLayer();

        const { wms_url, primary_layer, extent } = data;

        console.log("WMS URL from backend:", wms_url);
        console.log("Primary layer:", primary_layer);
        console.log("Extent:", extent);

        // Create TileWMS source with proper URL
        const wmsSource = new TileWMS({
          url: wms_url,
          params: {
            LAYERS: primary_layer,
            FORMAT: "image/png",
            TRANSPARENT: true,
            VERSION: "1.1.1",
            TILED: true,
            STYLES: "",
          },
          serverType: "geoserver",
          crossOrigin: "anonymous",
        });

        // Add e-
        // les
        wmsSource.on("tileloaderror", (event: any) => {
          console.error("WMS tile load error:", event);
          if (event.tile && event.tile.src_) {
            console.error("Failed tile URL:", event.tile.src_);
          }
        });

        wmsSource.on("tileloadstart", () => {
          console.log("WMS tile load started");
        });

        wmsSource.on("tileloadend", () => {
          console.log("WMS tile loaded successfully");
        });

        // Create the interpolation layer using TileLayer
        const interpolationLayer = new TileLayer({
          source: wmsSource,
          opacity: interpolationOpacity,
          zIndex: 26,
          visible: true,
        });

        interpolationLayer.set("name", "interpolation");
        interpolationLayer.set("type", "interpolation");

        // Store reference and add to map
        interpolationLayerRef.current = interpolationLayer;
        mapInstanceRef.current.addLayer(interpolationLayer);

        console.log("Interpolation layer added to map");

        // Fit to extent if provided
        if (extent && extent.length === 4) {
          console.log("Fitting to extent:", extent);
          const mapExtent = transformExtent(extent, "EPSG:4326", "EPSG:3857");
          console.log("Transformed extent:", mapExtent);

          mapInstanceRef.current.getView().fit(mapExtent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: 14,
          });
        }

        // Update state and legend
        setIsInterpolationDisplayed(true);
        setIsInterpolationVisible(true);
        setCurrentInterpolationParam(parameter);
        setIsInterpolationLoading(false);

        // Update legend data with the response information
        const parameterInfo = Object.entries(attributeMapping).find(
          ([key, value]) => value === parameter || key === parameter
        )?.[0];

        const paramLabel =
          waterQualityParameters.find((p) => p.key === parameterInfo)?.label ||
          parameter;

        setLegendData({
          min: data.statistics.min,
          max: data.statistics.max,
          mean: data.statistics.mean,
          parameter: paramLabel, // Add the parameter label
          colors: data.color_stops || []
        });

        console.log(`Interpolation layer successfully added for ${parameter}`);

        // Force map refresh
        mapInstanceRef.current.render();
      } else {
        throw new Error("Unexpected response format from interpolation API");
      }
    } catch (error) {
      console.error("Error adding interpolation layer:", error);
      setInterpolationError(
        `Failed to load interpolation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsInterpolationLoading(false);
    }
  };

  // Remove interpolation layer function
  const removeInterpolationLayer = () => {
    if (!mapInstanceRef.current) return;

    if (interpolationLayerRef.current) {
      console.log("Removing interpolation layer");
      mapInstanceRef.current.removeLayer(interpolationLayerRef.current);

      // Clean up blob URL to prevent memory leaks
      const source = interpolationLayerRef.current.getSource();
      if (source && source.getUrl && source.getUrl()) {
        URL.revokeObjectURL(source.getUrl());
      }

      interpolationLayerRef.current = null;
      setIsInterpolationDisplayed(false);
      setIsInterpolationVisible(true);
      setInterpolationError(null);

      setLegendData(null);
      // Remove from legend
      // setLegendData((prev) => ({ ...prev, interpolation: undefined }));

      console.log("Interpolation layer removed successfully");
    }
  };

  // Register the removeInterpolationLayer function with parent context
  useEffect(() => {
    mapActions.current.removeInterpolationLayer = removeInterpolationLayer;
  }, [removeInterpolationLayer]);

  // Toggle interpolation layer function
  const toggleInterpolationLayer = (
    parameter?: string,
    analysisType?: string,
    season?: string
  ) => {
    // Use provided parameters or get from LocationContext
    const param = parameter || "pH";
    const analysis = analysisType || "subdistbased";
    const seasonParam = season || selectedSeason || "premonsoon";
    if (isInterpolationDisplayed) {
      removeInterpolationLayer();
    }
    addInterpolationLayer(param, analysis, seasonParam);
  };

  const hideShowInterpolationLayer = () => {
  if (!mapInstanceRef.current) return;
  
  if (interpolationLayerRef.current) {
    const isVisible = interpolationLayerRef.current.getVisible();
    interpolationLayerRef.current.setVisible(!isVisible);
    setIsInterpolationVisible(!isVisible);
    console.log(`Interpolation layer visibility: ${!isVisible}`);
  } else {
    console.warn("Interpolation layer not available to hide/show");
  }
};


  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    isWaterQualityDisplayed,
    legendData,
    fetchedData,
    isDataLoading,
    dataError,
    setMapContainer,
    changeBaseMap,
    addRasterLayer,
    removeRasterLayer,
    zoomToCurrentExtent,
    getAllLayers,
    setLegendData,
    addRiverLayers,
    removeRiverLayers,
    addWaterQualityPoints,
    removeWaterQualityPoints,
    toggleWaterQualityPoints,
    isInterpolationDisplayed,
    isInterpolationLoading,
    interpolationError,
    toggleInterpolationLayer, // Make sure this line is here
    addInterpolationLayer,
    removeInterpolationLayer,
    currentInterpolationParam,
    attributeMapping,
    interpolationOpacity,
    setInterpolationOpacity: changeInterpolationOpacity,
    resetView,
    isRiverDisplayed,
    isRiverBufferDisplayed,
    toggleRiverLayer,
    toggleRiverBufferLayer,
    isSubDistrictDisplayed,
  toggleSubDistrictLayer,
  isInterpolationVisible,
  hideShowInterpolationLayer,
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      baseLayerRef.current = null;
      indiaLayerRef.current = null;
      stateLayerRef.current = null;
      districtLayerRef.current = null;
      subdistrictLayerRef.current = null;
      villageOverlayLayerRef.current = null;
      rasterLayerRef.current = null;
      contourLayerRef.current = null;
      trendLayerRef.current = null;
      gsrLayerRef.current = null;
      riverLayerRef.current = null;
      riverBufferLayerRef.current = null;
      waterQualityLayerRef.current = null;
      interpolationLayerRef.current = null;
    };
  }, []);

  return (
    <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
  );
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};
