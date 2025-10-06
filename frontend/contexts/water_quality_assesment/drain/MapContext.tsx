// frontend/app/contexts/groundwater_assessment/drain/MapContext.tsx
"use client";
import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
  useCallback,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from 'ol/Overlay';
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent, toLonLat } from "ol/proj";
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { extend, createEmpty } from 'ol/extent';
import { useLocation } from "@/contexts/water_quality_assesment/drain/LocationContext";
import { useWell, WellData } from "@/contexts/water_quality_assesment/drain/WellContext";

// GeoServer configuration
const GEOSERVER_BASE_URL = "/geoserver/api/myworkspace/wfs";
const GEOSERVER_WMS_URL = "/geoserver/api/myworkspace/wms";

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
  terrain: {
    name: "Stamen Terrain",
    source: () =>
      new XYZ({
        url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
        maxZoom: 19,
        attributions:
          'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
        crossOrigin: "anonymous",
      }),
    icon: "M14 11l4-8H6l4 8H6l6 10 6-10h-4z",
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions:
          'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">ArcGIS</a>',
        crossOrigin: "anonymous",
      }),
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  }
};

// Enhanced interface for available raster layers with color schemes
interface AvailableRaster {
  layer_name: string;
  display_name: string;
  type: 'gwqi' | 'parameter';
  parameter: string;
  year: string;
  description: string;
  color_scheme: {
    type: string;
    colors: string[];
    labels: string[];
    parameter_name: string;
    unit: string;
    ranges?: number[];
  };
  is_default: boolean;
}

// Other interfaces
interface ContourLayerOptions {
  name: string;
  parameter: string;
  interval: string;
  statistics?: any;
}

interface LegendData {
  raster?: {
    colors: string[];
    labels: string[];
    parameter: string;
    parameter_name?: string;
    unit?: string;
    classes: number;
    type?: string;
  };
  contour?: {
    minElevation: number;
    maxElevation: number;
    interval: number;
    statistics?: any;
  };
  trend?: {
    totalWells: number;
    increasing: number;
    decreasing: number;
    noTrend: number;
    significant: number;
  };
}

interface WellPoint {
  id: number;
  latitude: number;
  longitude: number;
  hydrographCode: string;
  block: string;
  properties: any;
}

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  isRasterDisplayed: boolean;
  isVillageOverlayVisible: boolean;
  isContourDisplayed: boolean;
  isTrendDisplayed: boolean;
  legendData: LegendData | null;
  // Enhanced raster management
  availableRasters: AvailableRaster[];
  selectedRaster: AvailableRaster | null;
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  // Enhanced raster methods
  addRasterLayer: (layerName: string, geoserverUrl?: string, colorScheme?: any) => void;
  addMultipleRasterLayers: (layerMetadata: AvailableRaster[], geoserverUrl: string, colorScheme?: any) => void;
  switchToRaster: (raster: AvailableRaster) => void;
  removeRasterLayer: () => void;
  removeAllRasterLayers: () => void;
  addContourLayer: (geoJsonData: any, options: ContourLayerOptions) => void;
  removeContourLayer: () => void;
  zoomToCurrentExtent: () => void;
  getAllLayers: () => any[];
  toggleVillageOverlay: () => void;
  addTrendLayer: (trendData: any) => void;
  removeTrendLayer: () => void;
  addWellPointsLayer: (wellPoints: WellPoint[]) => void;
  removeWellPointsLayer: () => void;
  forceRemoveWellPointsLayer: () => void;
  enableWellAddMode: (columns: string[], onWellAdd: (wellData: WellData, coordinates: [number, number]) => void) => void;
  disableWellAddMode: () => void;
  isWellAddModeActive: boolean;
  setLegendData: React.Dispatch<React.SetStateAction<LegendData | null>>;
  showLabels: boolean;
  toggleLabels: () => void;
  // Progressive highlighting functions
  highlightSelectedFeatures: (layerType: string, selectedIds: number[], propertyName: string) => void;
  zoomToSelectedFeatures: (layerType: string, selectedIds: number[], propertyName: string) => void;
  // NEW: Get selected area bounds
  getSelectedAreaBounds: () => [number, number, number, number] | null;
}

interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "osm",
  isRasterDisplayed: false,
  isVillageOverlayVisible: false,
  isContourDisplayed: false,
  legendData: null,
  availableRasters: [],
  selectedRaster: null,
  setMapContainer: () => { },
  changeBaseMap: () => { },
  addRasterLayer: () => { },
  addMultipleRasterLayers: () => { },
  switchToRaster: () => { },
  removeRasterLayer: () => { },
  removeAllRasterLayers: () => { },
  addContourLayer: () => { },
  removeContourLayer: () => { },
  zoomToCurrentExtent: () => { },
  getAllLayers: () => [],
  toggleVillageOverlay: () => { },
  isTrendDisplayed: false,
  addTrendLayer: () => { },
  removeTrendLayer: () => { },
  setLegendData: () => { },
  addWellPointsLayer: () => { },
  removeWellPointsLayer: () => { },
  enableWellAddMode: () => { },
  disableWellAddMode: () => { },
  isWellAddModeActive: false,
  forceRemoveWellPointsLayer: () => { },
  showLabels: false,
  toggleLabels: () => { },
  highlightSelectedFeatures: () => { },
  zoomToSelectedFeatures: () => { },
  getSelectedAreaBounds: () => null,
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);

  // Layer refs for drainage system - ALL layers loaded initially
  const basinBoundaryLayerRef = useRef<VectorLayer<any> | null>(null);
  const riversLayerRef = useRef<VectorLayer<any> | null>(null);
  const stretchesLayerRef = useRef<VectorLayer<any> | null>(null);
  const drainsLayerRef = useRef<VectorLayer<any> | null>(null);
  const catchmentsLayerRef = useRef<VectorLayer<any> | null>(null);
  const villagesLayerRef = useRef<VectorLayer<any> | null>(null);
  const villageOverlayLayerRef = useRef<VectorLayer<any> | null>(null);

  // Keep existing refs for other layers
  const rasterLayerRef = useRef<ImageLayer<any> | null>(null);
  const contourLayerRef = useRef<VectorLayer<any> | null>(null);
  const trendLayerRef = useRef<VectorLayer<any> | null>(null);
  const wellPointsLayerRef = useRef<VectorLayer<any> | null>(null);

  // NEW: Hover popup refs
  const hoverPopupRef = useRef<Overlay | null>(null);
  const hoverPopupElementRef = useRef<HTMLDivElement | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const [isRasterDisplayed, setIsRasterDisplayed] = useState<boolean>(false);
  const [isVillageOverlayVisible, setIsVillageOverlayVisible] = useState<boolean>(false);
  const [isContourDisplayed, setIsContourDisplayed] = useState<boolean>(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);

  // Enhanced raster management state
  const [availableRasters, setAvailableRasters] = useState<AvailableRaster[]>([]);
  const [selectedRaster, setSelectedRaster] = useState<AvailableRaster | null>(null);

  // Get location context data
  const {
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    areaConfirmed,
    rivers,
    stretches,
    drains,
    catchments,
    villages
  } = useLocation();

  const [isTrendDisplayed, setIsTrendDisplayed] = useState<boolean>(false);
  const [isWellAddModeActive, setIsWellAddModeActive] = useState(false);
  const [wellAddCallback, setWellAddCallback] = useState<((wellData: WellData, coordinates: [number, number]) => void) | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const clickListenerRef = useRef<((event: any) => void) | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<[number, number] | null>(null);
  const [formData, setFormData] = useState<WellData>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);

  // ENHANCED STYLE DEFINITIONS FOR PROGRESSIVE HIGHLIGHTING
  
  // Basin boundary style
  const basinBoundaryStyle = new Style({
    stroke: new Stroke({
      color: "#6f11119d",
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(0, 0, 0, 0)",
    }),
  });

  // Default styles (muted when not selected)
  const riverStyle = new Style({
    stroke: new Stroke({
      color: "#8001ffff",
      width: 4.5,
    }),
  });

  const stretchStyle = new Style({
    stroke: new Stroke({
      color: "#c4bc2bff",
      width: 1,
    }),
  });

  const drainStyle = new Style({
    image: new CircleStyle({
      radius: 2,
      fill: new Fill({
        color: '#FF6B35',
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 1,
      }),
    }),
  });

  // Highlighted styles (when selected)
  const selectedRiverStyle = new Style({
    stroke: new Stroke({
      color: "#1a01ffff",
      width: 11,
    }),
  });

  const selectedStretchStyle = new Style({
    stroke: new Stroke({
      color: "#DC2626",
      width: 6,
    }),
  });

  const selectedDrainStyle = new Style({
    image: new CircleStyle({
      radius: 13,
      fill: new Fill({
        color: '#FF0000',
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 3,
      }),
    }),
  });

  // Active styles (when river/stretch is selected, show related features)
  const activeRiverStyle = new Style({
    stroke: new Stroke({
      color: "#0d05f3ff",
      width: 4,
    }),
  });

  const activeStretchStyle = new Style({
    stroke: new Stroke({
      color: "#c4bc2bff",
      width: 7,
    }),
  });

  const activeDrainStyle = new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({
        color: '#ff5a3584',
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 2,
      }),
    }),
  });

  // Village and catchment styles
  const catchmentStyle = new Style({
    stroke: new Stroke({
      color: "#DC2626",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(220, 38, 38, 0.1)",
    }),
  });

  const villageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.1)",
    }),
  });

  const selectedVillageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B",
      width: 2,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.4)",
    }),
  });

  const villageOverlayStyle = new Style({
    stroke: new Stroke({
      color: "rgba(255, 255, 255, 0.8)",
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(255, 255, 255, 0.05)",
    }),
  });

  const wellPointStyle = new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({
        color: '#FF6B35',
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 2,
      }),
    }),
  });

  // Disabled styles
  const disabledRiverStyle = new Style({
    stroke: new Stroke({
      color: '#1E40AF',
      width: 2.1,
    }),
  });

  const disabledStretchStyle = new Style({
    stroke: new Stroke({
      color: '#E5E7EB',
      width: 1,
    }),
  });

  // Helper function to create text style for labels
  const createLabelStyle = (text: string, offsetY: number = 0) => {
    return new Style({
      text: new Text({
        text: text,
        font: '10px Calibri,sans-serif',
        fill: new Fill({
          color: '#000000'
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 3
        }),
        offsetY: offsetY,
        textAlign: 'center',
        textBaseline: 'middle'
      })
    });
  };

  // Helper function to create combined geometry + label style
  const createCombinedStyle = (baseStyle: Style, labelText: string, offsetY: number = 0) => {
    return [
      baseStyle,
      createLabelStyle(labelText, offsetY)
    ];
  };

  // Helper function to create WFS layers for drainage system
  const createDrainageWFSLayer = (
    layerName: string,
    cqlFilter: string,
    style: Style | ((feature: any) => Style | Style[]),
    zIndex: number,
    layerIdentifier: string
  ): VectorLayer<any> => {
    console.log(`Creating drainage WFS layer: ${layerName} with filter: ${cqlFilter}`);

    const layer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
      }),
      style: style,
      zIndex,
      visible: true,
    });

    layer.set('name', layerIdentifier);
    layer.set('type', 'drainage');

    // Add event listeners
    const source = layer.getSource();
    source?.on("featuresloaderror", (event: any) => {
     console.log(`Error loading layer ${layerName}:`, event);
    });
    source?.on("featuresloadstart", () => {
      console.log(`Started loading layer ${layerName}`);
    });
    source?.on("featuresloadend", () => {
      console.log(`Successfully loaded layer ${layerName}`);
    });

    return layer;
  };

  // Initialize map when container is set
  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });

    initialBaseLayer.set('name', 'basemap');
    baseLayerRef.current = initialBaseLayer;

    const map = new Map({
      target: mapContainer,
      layers: [initialBaseLayer],
      view: new View({
        center: fromLonLat([82.378970, 25.539697]),
        zoom: 9.5,
        extent: transformExtent([80.0, 24.0, 85.0, 27.0], 'EPSG:4326', 'EPSG:3857')
      }),
    });

    mapInstanceRef.current = map;
    console.log("Map initialized with basin view");

    // Create well add popup overlay
    const popupElement = document.createElement('div');
    popupElement.className = 'ol-popup';
    popupElement.style.display = 'none';

    const overlay = new Overlay({
      element: popupElement,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
      positioning: 'bottom-center',
      stopEvent: false,
      insertFirst: false,
    });

    map.addOverlay(overlay);
    popupOverlayRef.current = overlay;

    // NEW: Create hover popup overlay
    const hoverPopupElement = document.createElement('div');
    hoverPopupElement.className = 'ol-popup-hover';
    hoverPopupElement.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      border-radius: 8px;
      padding: 8px 12px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      z-index: 1000;
      display: none;
    `;
    
    hoverPopupElementRef.current = hoverPopupElement;

    const hoverOverlay = new Overlay({
      element: hoverPopupElement,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -10],
    });

    map.addOverlay(hoverOverlay);
    hoverPopupRef.current = hoverOverlay;

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      hoverPopupRef.current = null;
      hoverPopupElementRef.current = null;
    };
  }, [mapContainer]);

  // Load all initial layers when map is ready
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const loadInitialLayers = async () => {
      console.log("Loading all initial drainage layers for basin overview");

      // 1. Add basin boundary layer (permanent)
      if (!basinBoundaryLayerRef.current) {
        console.log("Adding permanent basin boundary layer");
        const basinBoundaryLayer = new VectorLayer({
          source: new VectorSource({
            format: new GeoJSON(),
            url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:basin_boundary&outputFormat=application/json&CQL_FILTER=1=1`,
          }),
          style: basinBoundaryStyle,
          zIndex: 1,
          visible: true,
        });

        basinBoundaryLayer.set('name', 'basin-boundary');
        basinBoundaryLayer.set('type', 'drainage');
        basinBoundaryLayer.set('permanent', true);

        basinBoundaryLayerRef.current = basinBoundaryLayer;
        mapInstanceRef.current?.addLayer(basinBoundaryLayer);
      }

      // 2. Load all rivers initially
      if (!riversLayerRef.current) {
        console.log("Loading all rivers with default style");
        const riversLayer = createDrainageWFSLayer(
          "Rivers",
          "1=1",
          riverStyle,
          10,
          "rivers"
        );
        riversLayerRef.current = riversLayer;
        mapInstanceRef.current?.addLayer(riversLayer);
      }

      // 3. Load all stretches initially
      if (!stretchesLayerRef.current) {
        console.log("Loading all stretches with default style");
        const stretchesLayer = createDrainageWFSLayer(
          "Stretches",
          "1=1",
          stretchStyle,
          11,
          "stretches"
        );
        stretchesLayerRef.current = stretchesLayer;
        mapInstanceRef.current?.addLayer(stretchesLayer);
      }

      // 4. Load all drains initially
      if (!drainsLayerRef.current) {
        console.log("Loading all drains with default style");
        const drainsLayer = createDrainageWFSLayer(
          "Drain",
          "1=1",
          drainStyle,
          12,
          "drains"
        );
        drainsLayerRef.current = drainsLayer;
        mapInstanceRef.current?.addLayer(drainsLayer);
      }

      console.log("All initial drainage layers loaded");
    };

    setTimeout(loadInitialLayers, 100);
  }, [mapInstanceRef.current]);

  // Progressive highlighting functions
  const highlightSelectedFeatures = useCallback((layerType: string, selectedIds: number[], propertyName: string) => {
    if (!mapInstanceRef.current) return;

    const layers = mapInstanceRef.current.getAllLayers();
    const targetLayer = layers.find(layer => layer.get('name') === layerType);

    if (targetLayer) {
      console.log(`Updating styles for ${layerType} based on context`);

      targetLayer.setStyle((feature: any) => {
        switch(layerType) {
          
          // LOGIC FOR RIVERS (Handles disabling)
          case 'rivers': {
            const featureRiverCode = feature.get('River_Code');
            if (!selectedRiver) {
              return riverStyle;
            }
            return featureRiverCode === selectedRiver ? selectedRiverStyle : disabledRiverStyle;
          }

          // LOGIC FOR STRETCHES (Handles disabling)
          case 'stretches': {
            const featureStretchId = feature.get('Stretch_ID');
            const featureRiverCode = feature.get('River_Code');
            const stretchIdStr = String(featureStretchId);

            if (!selectedRiver) {
                return stretchStyle;
            }

            if (featureRiverCode === selectedRiver) {
                if (selectedStretch && featureStretchId === selectedStretch) {
                    return selectedStretchStyle;
                }
                if (!selectedStretch) {
                    return createCombinedStyle(activeStretchStyle, stretchIdStr);
                }
                return activeStretchStyle;
            } else {
                return disabledStretchStyle;
            }
          }
          
          case 'drains': {
            const featureDrainNo = feature.get('Drain_No');
            const featureStretchId = feature.get('Stretch_ID');
            
            // Highlight selected drain
            if (selectedDrain && featureDrainNo === selectedDrain) {
              return selectedDrainStyle;
            }
            
            // Show drains that belong to selected stretch
            if (selectedStretch && featureStretchId === selectedStretch) {
              return activeDrainStyle;
            }
            
            // Hide drains from other stretches
            return new Style({});
          }

          default:
            return riverStyle;
        }
      });

      targetLayer.changed();
    }
  }, [selectedRiver, selectedStretch, selectedDrain, drains]);

  const zoomToSelectedFeatures = useCallback((layerType: string, selectedIds: number[], propertyName: string) => {
    if (!mapInstanceRef.current || selectedIds.length === 0) return;

    const layers = mapInstanceRef.current.getAllLayers();
    const targetLayer = layers.find(layer => layer.get('name') === layerType);

    if (targetLayer) {
      const source = targetLayer.getSource();
      const features = source.getFeatures();
      const selectedFeatures = features.filter((feature: any) => 
        selectedIds.includes(feature.get(propertyName))
      );

      if (selectedFeatures.length > 0) {
        const extent = selectedFeatures.reduce((ext: any, feature: any) => {
          return extend(ext, feature.getGeometry().getExtent());
        }, createEmpty());

        mapInstanceRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
          maxZoom: layerType === 'drains' ? 12 : undefined
        });

        console.log(`Zoomed to ${selectedFeatures.length} ${layerType} features`);
      }
    }
  }, []);

  // Effect for river selection
  useEffect(() => {
    if (selectedRiver) {
      console.log(`Highlighting selected river: ${selectedRiver}`);
      highlightSelectedFeatures('rivers', [selectedRiver], 'River_Code');
      
      setTimeout(() => {
        zoomToSelectedFeatures('rivers', [selectedRiver], 'River_Code');
      }, 300);
    } else {
      highlightSelectedFeatures('rivers', [], 'River_Code');
    }
  }, [selectedRiver]);

  // Effect for stretch selection
  useEffect(() => {
    if (selectedRiver && selectedStretch) {
      console.log(`Highlighting selected stretch: ${selectedStretch} for river: ${selectedRiver}`);
      highlightSelectedFeatures('stretches', [selectedStretch], 'Stretch_ID');
      
      setTimeout(() => {
        zoomToSelectedFeatures('stretches', [selectedStretch], 'Stretch_ID');
      }, 300);
    } else if (selectedRiver) {
      const riverStretches = stretches
        .filter(s => s.riverCode === selectedRiver)
        .map(s => s.stretchId);
      highlightSelectedFeatures('stretches', riverStretches, 'Stretch_ID');
    } else {
      highlightSelectedFeatures('stretches', [], 'Stretch_ID');
    }
  }, [selectedRiver, selectedStretch, stretches]);

  // Effect for drain selection
  useEffect(() => {
    if (selectedDrain) {
      console.log(`Highlighting selected drain: ${selectedDrain}`);
      highlightSelectedFeatures('drains', [selectedDrain], 'Drain_No');
      
      setTimeout(() => {
        zoomToSelectedFeatures('drains', [selectedDrain], 'Drain_No');
      }, 300);
    } else if (selectedStretch) {
      const stretchDrains = drains
        .filter(d => d.stretchId === selectedStretch)
        .map(d => d.drainNo);
      highlightSelectedFeatures('drains', stretchDrains, 'Drain_No');
    } else {
      highlightSelectedFeatures('drains', [], 'Drain_No');
    }
  }, [selectedDrain, selectedStretch, drains]);
  // Effect to handle catchments ONLY when drain is selected
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing catchments layer
    if (catchmentsLayerRef.current) {
      mapInstanceRef.current.removeLayer(catchmentsLayerRef.current);
      catchmentsLayerRef.current = null;
    }

    // Show catchments ONLY when a drain is selected
    if (selectedDrain) {
      console.log(`Adding catchments layer for drain number: ${selectedDrain}`);

      const catchmentsCqlFilter = `Drain_No=${selectedDrain}`;
      const catchmentsLayer = createDrainageWFSLayer(
        "Catchment",
        catchmentsCqlFilter,
        catchmentStyle,
        13,
        "catchments"
      );

      catchmentsLayerRef.current = catchmentsLayer;
      mapInstanceRef.current.addLayer(catchmentsLayer);

      // Auto-zoom to catchments extent
      catchmentsLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = catchmentsLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, [selectedDrain]);

  // Effect to handle villages layer (styling and visibility)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // If no villages are selected, remove the layer
    if (selectedVillages.length === 0) {
      if (villagesLayerRef.current) {
        mapInstanceRef.current.removeLayer(villagesLayerRef.current);
        villagesLayerRef.current = null;
        console.log("Removed villages layer - no villages selected");
      }
      return;
    }

    // Get ALL villages that COULD be displayed
    const availableVillages = villages;

    // If we already have a village layer, just update the styling
    if (villagesLayerRef.current && availableVillages.length > 0) {
      console.log(`Updating village styles for ${selectedVillages.length} selected villages`);
      
      villagesLayerRef.current.setStyle((feature: any) => {
        const villageCode = feature.get('village_co');
        const isSelected = selectedVillages.includes(Number(villageCode));
        const baseStyle = isSelected ? selectedVillageStyle : villageStyle;

        if (showLabels) {
          const villageName = feature.get('shapeName') || `Village ${villageCode}`;
          return createCombinedStyle(baseStyle, villageName, 0);
        }
        return baseStyle;
      });

      villagesLayerRef.current.changed();
      return;
    }

    // Only create a new layer if we don't have one and we have villages to show
    if (!villagesLayerRef.current && availableVillages.length > 0) {
      console.log(`Creating new villages layer for ${availableVillages.length} available villages`);

      const allVillageCodeFilter = availableVillages.map(v => `'${v.code}'`).join(',');
      const villagesCqlFilter = `village_co IN (${allVillageCodeFilter})`;

      const villagesLayer = createDrainageWFSLayer(
        "Village",
        villagesCqlFilter,
        (feature: any) => {
          const villageCode = feature.get('village_co');
          const isSelected = selectedVillages.includes(Number(villageCode));
          const baseStyle = isSelected ? selectedVillageStyle : villageStyle;

          if (showLabels) {
            const villageName = feature.get('shapeName') || `Village ${villageCode}`;
            return createCombinedStyle(baseStyle, villageName, 0);
          }
          return baseStyle;
        },
        14,
        "villages"
      );

      villagesLayerRef.current = villagesLayer;
      mapInstanceRef.current.addLayer(villagesLayer);

      // Auto-zoom only when first creating the layer
      villagesLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = villagesLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, [selectedVillages, villages, showLabels]);

  // Function to manage village layer visibility based on raster state
  const manageVillageLayerVisibility = () => {
    if (!mapInstanceRef.current) return;

    if (isRasterDisplayed) {
      // Remove main village layer if it exists
      if (villagesLayerRef.current) {
        mapInstanceRef.current.removeLayer(villagesLayerRef.current);
        villagesLayerRef.current = null;
        console.log("Removed main village layer due to raster display");
      }

      // Create village overlay if villages are selected
      const shouldShowVillageOverlay = selectedVillages.length > 0 && !villageOverlayLayerRef.current;
      
      if (shouldShowVillageOverlay) {
        console.log("Creating lightweight village overlay for raster view");
        const villageCodeFilter = selectedVillages.map(code => `'${code}'`).join(',');
        const villagesCqlFilter = `village_co IN (${villageCodeFilter})`;

        const villageOverlay = createDrainageWFSLayer(
          "Village",
          villagesCqlFilter,
          villageOverlayStyle,
          20,
          "village-overlay"
        );

        villageOverlayLayerRef.current = villageOverlay;
        mapInstanceRef.current.addLayer(villageOverlay);
        villageOverlay.setVisible(isVillageOverlayVisible);
        console.log("Added lightweight village overlay on top of raster with visibility:", isVillageOverlayVisible);
      }
    } else {
      // Remove lightweight village overlay
      if (villageOverlayLayerRef.current) {
        mapInstanceRef.current.removeLayer(villageOverlayLayerRef.current);
        villageOverlayLayerRef.current = null;
        setIsVillageOverlayVisible(false);
        console.log("Removed lightweight village overlay");
      }
    }
  };

  // Effect to manage village layer visibility when raster state changes
  useEffect(() => {
    manageVillageLayerVisibility();
  }, [isRasterDisplayed, selectedVillages]);

  // Effect to update village overlay visibility
  useEffect(() => {
    if (villageOverlayLayerRef.current) {
      villageOverlayLayerRef.current.setVisible(isVillageOverlayVisible);
      console.log(`Village overlay visibility updated to: ${isVillageOverlayVisible}`);
    }
  }, [isVillageOverlayVisible]);

  // NEW: Hover tooltip effect with context-aware display
  useEffect(() => {
    if (!mapInstanceRef.current || !hoverPopupRef.current || !hoverPopupElementRef.current) return;

    const hoverOverlay = hoverPopupRef.current;
    const hoverElement = hoverPopupElementRef.current;

    const handlePointerMove = (event: any) => {
      const pixel = event.pixel;
      let featureFound = false;
      let tooltipText = '';
      let tooltipColor = 'rgba(0, 0, 0, 0.85)';

      // Priority 1: Check for drains (only when stretch is selected)
      if (selectedStretch) {
        mapInstanceRef.current!.forEachFeatureAtPixel(pixel, (feature, layer) => {
          if (!featureFound && layer && layer.get('name') === 'drains') {
            const drainNo = feature.get('Drain_No');
            const drainStretchId = feature.get('Stretch_ID');
            
            if (drainStretchId === selectedStretch) {
              tooltipText = `Drain ${drainNo}`;
              tooltipColor = 'rgba(255, 107, 53, 0.9)';
              featureFound = true;
              return true;
            }
          }
        }, { hitTolerance: 8 });
      }

      // Priority 2: Check for stretches (only when river is selected)
      if (!featureFound && selectedRiver) {
        mapInstanceRef.current!.forEachFeatureAtPixel(pixel, (feature, layer) => {
          if (!featureFound && layer && layer.get('name') === 'stretches') {
            const stretchId = feature.get('Stretch_ID');
            const stretchRiverCode = feature.get('River_Code');
            
            if (stretchRiverCode === selectedRiver) {
              tooltipText = `Stretch ${stretchId}`;
              tooltipColor = 'rgba(196, 188, 43, 0.9)';
              featureFound = true;
              return true;
            }
          }
        }, { hitTolerance: 5 });
      }

      // Priority 3: Check for rivers (always show)
      if (!featureFound) {
        mapInstanceRef.current!.forEachFeatureAtPixel(pixel, (feature, layer) => {
          if (!featureFound && layer && layer.get('name') === 'rivers') {
            const riverCode = feature.get('River_Code');
            const riverName = feature.get('River_Name') || `River ${riverCode}`;
            
            tooltipText = riverName;
            tooltipColor = 'rgba(26, 1, 255, 0.9)';
            featureFound = true;
            return true;
          }
        }, { hitTolerance: 5 });
      }

      if (featureFound && tooltipText) {
        hoverElement.innerHTML = tooltipText;
        hoverElement.style.background = tooltipColor;
        hoverElement.style.display = 'block';
        hoverOverlay.setPosition(event.coordinate);
      } else {
        hoverElement.style.display = 'none';
        hoverOverlay.setPosition(undefined);
      }
    };

    mapInstanceRef.current.on('pointermove', handlePointerMove);

    return () => {
      mapInstanceRef.current?.un('pointermove', handlePointerMove);
      if (hoverElement) {
        hoverElement.style.display = 'none';
      }
      hoverOverlay.setPosition(undefined);
    };
  }, [mapInstanceRef.current, selectedRiver, selectedStretch]);

  // Function to zoom to current extent
  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;

    // Priority: Contour > Village overlay > Villages > Catchments > Drains > Stretches > Rivers
    if (contourLayerRef.current && isContourDisplayed) {
      targetLayer = contourLayerRef.current;
    } else if (villageOverlayLayerRef.current && isRasterDisplayed && isVillageOverlayVisible) {
      targetLayer = villageOverlayLayerRef.current;
    } else if (villagesLayerRef.current) {
      targetLayer = villagesLayerRef.current;
    } else if (catchmentsLayerRef.current) {
      targetLayer = catchmentsLayerRef.current;
    } else if (drainsLayerRef.current) {
      targetLayer = drainsLayerRef.current;
    } else if (stretchesLayerRef.current) {
      targetLayer = stretchesLayerRef.current;
    } else if (riversLayerRef.current) {
      targetLayer = riversLayerRef.current;
    }

    if (targetLayer) {
      const source = targetLayer.getSource();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.some((coord: number) => isFinite(coord))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 14,
            duration: 1000,
          });
          console.log("Zoomed to current extent");
        }
      }
    }
  };

  // NEW: Get selected area bounds function
  const getSelectedAreaBounds = (): [number, number, number, number] | null => {
    if (!mapInstanceRef.current) return null;
    
    let targetLayer = null;
    
    // Priority: villages > catchments > drains
    if (villagesLayerRef.current) {
      targetLayer = villagesLayerRef.current;
    } else if (catchmentsLayerRef.current) {
      targetLayer = catchmentsLayerRef.current;
    } else if (drainsLayerRef.current) {
      targetLayer = drainsLayerRef.current;
    }
    
    if (targetLayer) {
      const source = targetLayer.getSource();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.some((coord: number) => isFinite(coord))) {
          // Convert from EPSG:3857 to EPSG:4326 (lat/lon)
          const [minX, minY, maxX, maxY] = extent;
          const minLonLat = toLonLat([minX, minY]);
          const maxLonLat = toLonLat([maxX, maxY]);
          
          console.log('[DRAIN BOUNDS] Calculated region bounds:', {
            minLon: minLonLat[0],
            minLat: minLonLat[1],
            maxLon: maxLonLat[0],
            maxLat: maxLonLat[1]
          });
          
          return [minLonLat[0], minLonLat[1], maxLonLat[0], maxLonLat[1]];
        }
      }
    }
    
    console.log('[DRAIN BOUNDS] No bounds available');
    return null;
  };

  // Function to get all layers
  const getAllLayers = () => {
    if (!mapInstanceRef.current) return [];
    return mapInstanceRef.current.getAllLayers();
  };

  // Function to toggle village overlay visibility
  const toggleVillageOverlay = () => {
    if (!mapInstanceRef.current || !villageOverlayLayerRef.current) {
      console.log("No village overlay layer to toggle");
      return;
    }

    const newVisibility = !isVillageOverlayVisible;
    setIsVillageOverlayVisible(newVisibility);
    villageOverlayLayerRef.current.setVisible(newVisibility);
    console.log(`Village overlay visibility set to: ${newVisibility}`);
  };

  // Function to change basemap
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

      newBaseLayer.set('name', 'basemap');
      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      setSelectedBaseMap(baseMapKey);

      console.log(`Changed basemap to: ${baseMapKey}`);
    } catch (error) {
     console.log("Error changing basemap:", error);
    }
  };

  // Function to toggle labels
  const toggleLabels = () => {
    setShowLabels(!showLabels);
    console.log(`Labels toggled to: ${!showLabels}`);
  };

  // Enhanced method to add multiple raster layers
  const addMultipleRasterLayers = (layerMetadata: AvailableRaster[], geoserverUrl: string, defaultColorScheme?: any) => {
    console.log(`[MapContext] Adding multiple raster layers: ${layerMetadata.length} layers`);
    console.log(`[MapContext] Layer metadata received:`, layerMetadata);
    
    setAvailableRasters(layerMetadata);
    
    const defaultLayer = layerMetadata.find(layer => layer.is_default) || layerMetadata[0];
    
    if (defaultLayer) {
      console.log(`[MapContext] Setting default layer: ${defaultLayer.display_name}`);
      console.log(`[MapContext] Default layer color scheme:`, defaultLayer.color_scheme);
      switchToRaster(defaultLayer);
    }
  };

  // Enhanced method to switch between rasters
  const switchToRaster = (raster: AvailableRaster) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot switch raster: map not initialized");
      return;
    }

    console.log(`[MapContext] Switching to raster: ${raster.display_name} (${raster.layer_name})`);
    console.log(`[MapContext] Raster color scheme:`, raster.color_scheme);

    try {
      if (rasterLayerRef.current) {
        console.log("Removing existing raster layer");
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
      }

      const geoserverUrl = GEOSERVER_WMS_URL;
      
      const imageWmsSource = new ImageWMS({
        url: geoserverUrl,
        params: {
          LAYERS: `myworkspace:${raster.layer_name}`,
          FORMAT: "image/png",
          TRANSPARENT: true,
          VERSION: "1.1.1",
          SRS: "EPSG:3857",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        ratio: 1,
      });

      const rasterLayer = new ImageLayer({
        source: imageWmsSource,
        zIndex: 15,
        opacity: 0.85,
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');
      rasterLayer.set('raster_info', raster);

      imageWmsSource.on('imageloaderror', (event: any) => {
       console.log(`ImageWMS error for layer ${raster.layer_name}:`, event);
      });

      imageWmsSource.on('imageloadstart', () => {
        console.log(`Starting to load raster image for ${raster.layer_name}`);
      });

      imageWmsSource.on('imageloadend', () => {
        console.log(`Raster image loaded successfully for ${raster.layer_name}`);
        setIsRasterDisplayed(true);
        
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

      rasterLayerRef.current = rasterLayer;
      mapInstanceRef.current.addLayer(rasterLayer);
      
      setSelectedRaster(raster);
      
      if (raster.color_scheme) {
        console.log(`[MapContext] Updating legend for ${raster.type} raster:`, raster.color_scheme);
        
        setLegendData((prev) => ({
          ...prev,
          raster: {
            colors: raster.color_scheme.colors,
            labels: raster.color_scheme.labels,
            parameter: raster.parameter,
            parameter_name: raster.color_scheme.parameter_name,
            unit: raster.color_scheme.unit,
            classes: raster.color_scheme.colors.length,
            type: raster.type
          },
        }));
      }
      
      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

      console.log(`[MapContext] Successfully switched to raster: ${raster.layer_name}`);

    } catch (error) {
     console.log("Error in switchToRaster:", error);
    }
  };

  // Function to add single raster layer
  const addRasterLayer = (layerName: string, geoserverUrl?: string, colorScheme?: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add raster layer: map not initialized");
      return;
    }

    const wmsUrl = geoserverUrl || GEOSERVER_WMS_URL;
    console.log(`Adding colored raster layer: ${layerName} from ${wmsUrl}`);

    try {
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

      const coloredLayerName = `${layerName}_colored`;
      console.log(`Attempting to load colored layer: ${coloredLayerName}`);

      const imageWmsSource = new ImageWMS({
        url: wmsUrl,
        params: {
          LAYERS: `myworkspace:${coloredLayerName}`,
          FORMAT: "image/png",
          TRANSPARENT: true,
          VERSION: "1.1.1",
          SRS: "EPSG:3857",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        ratio: 1,
      });

      const rasterLayer = new ImageLayer({
        source: imageWmsSource,
        zIndex: 15,
        opacity: 0.85,
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');

      imageWmsSource.on('imageloaderror', (event: any) => {
       console.log(`ImageWMS error for colored layer ${coloredLayerName}:`, event);
        console.log("Falling back to single-band layer...");
        addSingleBandRasterLayer(layerName, wmsUrl);
      });

      imageWmsSource.on('imageloadstart', () => {
        console.log(`Starting to load colored raster image for ${coloredLayerName}`);
      });

      imageWmsSource.on('imageloadend', () => {
        console.log(`Colored raster image loaded successfully for ${coloredLayerName}`);
        setIsRasterDisplayed(true);

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

      rasterLayerRef.current = rasterLayer;
      mapInstanceRef.current.addLayer(rasterLayer);

      console.log(`Colored raster layer successfully added: ${coloredLayerName}`);

    } catch (error) {
     console.log("Error in addRasterLayer:", error);
      addSingleBandRasterLayer(layerName, wmsUrl);
    }
  };

  const addSingleBandRasterLayer = (layerName: string, geoserverUrl: string) => {
    if (!mapInstanceRef.current) return;

    console.log(`Adding single-band raster layer as fallback: ${layerName}`);

    try {
      if (rasterLayerRef.current) {
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
      }

      const imageWmsSource = new ImageWMS({
        url: geoserverUrl,
        params: {
          LAYERS: `myworkspace:${layerName}`,
          FORMAT: "image/png",
          TRANSPARENT: true,
          VERSION: "1.1.1",
          SRS: "EPSG:3857",
          STYLES: "",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        ratio: 1,
      });

      const rasterLayer = new ImageLayer({
        source: imageWmsSource,
        zIndex: 15,
        opacity: 0.8,
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');

      imageWmsSource.on('imageloaderror', (event: any) => {
       console.log(`ImageWMS error for single-band layer ${layerName}:`, event);
      });

      imageWmsSource.on('imageloadend', () => {
        console.log(`Single-band raster image loaded successfully for ${layerName}`);
        setIsRasterDisplayed(true);
      });

      rasterLayerRef.current = rasterLayer;
      mapInstanceRef.current.addLayer(rasterLayer);

    } catch (error) {
     console.log("Error in addSingleBandRasterLayer:", error);
    }
  };

  const removeRasterLayer = () => {
    if (!mapInstanceRef.current) return;

    if (rasterLayerRef.current) {
      console.log("Removing raster layer");
      mapInstanceRef.current.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
      setIsRasterDisplayed(false);
      setSelectedRaster(null);
      setLegendData((prev) => ({ ...prev, raster: undefined }));
      console.log("Raster layer removed successfully");
    }
  };

  const removeAllRasterLayers = () => {
    removeRasterLayer();
    setAvailableRasters([]);
    setSelectedRaster(null);
    console.log("All raster layers removed");
  };

  // Contour layer functions
  const addContourLayer = (geoJsonData: any, options: ContourLayerOptions) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add contour layer: map not initialized");
      return;
    }

    console.log('Adding contour layer to map:', options);

    try {
      if (contourLayerRef.current) {
        console.log("Removing existing contour layer");
        mapInstanceRef.current.removeLayer(contourLayerRef.current);
        contourLayerRef.current = null;
      }

      if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        console.warn("No contour features to display");
        return;
      }

      const elevations = geoJsonData.features.map((feature: any) => feature.properties.elevation);
      const minElevation = Math.min(...elevations);
      const maxElevation = Math.max(...elevations);
      
      setLegendData((prev) => ({
        ...prev,
        contour: {
          minElevation,
          maxElevation,
          interval: parseFloat(options.interval),
          statistics: options.statistics,
        },
      }));

      const contourSource = new VectorSource({
        features: new GeoJSON().readFeatures(geoJsonData, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:32644'
        }),
      });

      const contourLayer = new VectorLayer({
        source: contourSource,
        style: (feature: any) => {
          const elevation = feature.get('elevation') || feature.get('level');
          return createContourStyle(elevation, minElevation, maxElevation);
        },
        zIndex: 25,
        opacity: 0.8,
        visible: true,
      });

      contourLayer.set('name', 'contours');
      contourLayer.set('type', 'contour');
      contourLayerRef.current = contourLayer;
      mapInstanceRef.current.addLayer(contourLayer);
      setIsContourDisplayed(true);

      setTimeout(() => {
        const extent = contourSource.getExtent();
        if (extent && mapInstanceRef.current) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 500);

    } catch (error) {
     console.log("Error adding contour layer:", error);
    }
  };

  const createContourStyle = (elevation: number, minElevation: number, maxElevation: number) => {
    const normalizedElevation = (elevation - minElevation) / (maxElevation - minElevation);
    const red = Math.round(255 * normalizedElevation);
    const blue = Math.round(255 * (1 - normalizedElevation));
    const green = Math.round(128 * (1 - Math.abs(normalizedElevation - 0.5) * 2));

    return new Style({
      stroke: new Stroke({
        color: `rgb(${red}, ${green}, ${blue}, 8)`,
        width: 5,
      }),
    });
  };

  const removeContourLayer = () => {
    if (!mapInstanceRef.current) return;

    if (contourLayerRef.current) {
      console.log("Removing contour layer");
      mapInstanceRef.current.removeLayer(contourLayerRef.current);
      contourLayerRef.current = null;
      setIsContourDisplayed(false);
      setLegendData((prev) => ({ ...prev, contour: undefined }));
      console.log("Contour layer removed successfully");
    }
  };

  // Trend layer functions
  const addTrendLayer = (geoJsonData: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add trend layer: map not initialized");
      return;
    }

    console.log('Adding trend layer to map:', geoJsonData);

    try {
      if (trendLayerRef.current) {
        console.log("Removing existing trend layer");
        mapInstanceRef.current.removeLayer(trendLayerRef.current);
        trendLayerRef.current = null;
      }

      if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
        console.warn("No trend features to display");
        return;
      }

      const trendSource = new VectorSource({
        features: new GeoJSON().readFeatures(geoJsonData, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        }),
      });

      const createVillageTrendStyle = (feature: any) => {
        const properties = feature.getProperties();
        const trendStatus = properties.Trend_Status || properties.trend;
        const trendColor = properties.Color || properties.trend_color;

        const colorMapping: Record<string, string> = {
          'Increasing': '#FF6B6B',
          'Decreasing': '#4ECDC4',
          'No-Trend': '#95A5A6',
          'Insufficient Data': '#F39C12'
        };

        const finalColor = trendColor || colorMapping[trendStatus] || '#95A5A6';

        return new Style({
          fill: new Fill({
            color: finalColor + '80',
          }),
          stroke: new Stroke({
            color: finalColor,
            width: 2,
          }),
        });
      };

      const trendLayer = new VectorLayer({
        source: trendSource,
        style: createVillageTrendStyle,
        zIndex: 30,
        opacity: 0.7,
        visible: true,
      });

      trendLayer.set('name', 'trends');
      trendLayer.set('type', 'trend');

      trendLayerRef.current = trendLayer;
      mapInstanceRef.current.addLayer(trendLayer);
      setIsTrendDisplayed(true);

      const features = trendSource.getFeatures();
      let totalWells = 0;
      let increasing = 0;
      let decreasing = 0;
      let noTrend = 0;
      let significant = 0;

      features.forEach((feature: any) => {
        const props = feature.getProperties();
        totalWells++;
        
        const trendStatus = props.Trend_Status || props.trend;
        const isSignificant = props.Is_Significant === 'Yes' || props.is_significant === true;

        if (trendStatus === 'Increasing') increasing++;
        else if (trendStatus === 'Decreasing') decreasing++;
        else if (trendStatus === 'No-Trend') noTrend++;

        if (isSignificant) significant++;
      });

      setLegendData((prev) => ({
        ...prev,
        trend: {
          totalWells,
          increasing,
          decreasing,
          noTrend,
          significant,
        },
      }));

      setTimeout(() => {
        const extent = trendSource.getExtent();
        if (extent && mapInstanceRef.current) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 500);

    } catch (error) {
     console.log("Error adding trend layer:", error);
    }
  };

  const removeTrendLayer = () => {
    if (!mapInstanceRef.current) return;

    if (trendLayerRef.current) {
      console.log("Removing trend layer");
      mapInstanceRef.current.removeLayer(trendLayerRef.current);
      trendLayerRef.current = null;
      setIsTrendDisplayed(false);
      setLegendData((prev) => ({ ...prev, trend: undefined }));
      console.log("Trend layer removed successfully");
    }
  };

  // Well points layer functions
  const addWellPointsLayer = (wellPoints: WellPoint[]) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add well points: map not initialized");
      return;
    }

    console.log(`[DRAIN] Adding ${wellPoints.length} well points to map`);

    try {
      if (wellPointsLayerRef.current) {
        mapInstanceRef.current.removeLayer(wellPointsLayerRef.current);
        wellPointsLayerRef.current = null;
      }

      if (wellPoints.length === 0) {
        console.log("[DRAIN] No well points to display");
        return;
      }

      const features = wellPoints.map((wellPoint) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([wellPoint.longitude, wellPoint.latitude])),
          id: wellPoint.id,
          hydrographCode: wellPoint.hydrographCode,
          block: wellPoint.block,
          ...wellPoint.properties
        });
        return feature;
      });

      const wellPointsSource = new VectorSource({
        features: features,
      });

      const wellPointsLayer = new VectorLayer({
        source: wellPointsSource,
        style: wellPointStyle,
        zIndex: 35,
        opacity: 1,
        visible: true,
      });

      wellPointsLayer.set('name', 'manual-wells');
      wellPointsLayer.set('type', 'well-points');

      wellPointsLayerRef.current = wellPointsLayer;
      mapInstanceRef.current.addLayer(wellPointsLayer);
      mapInstanceRef.current.render();

      console.log(`[DRAIN] Well points layer successfully added with ${features.length} points`);

      if (features.length > 0) {
        setTimeout(() => {
          const extent = wellPointsSource.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [100, 100, 100, 100],
              duration: 1000,
              maxZoom: 12
            });
          }
        }, 500);
      }

    } catch (error) {
     console.log("[DRAIN] Error adding well points layer:", error);
    }
  };

  const removeWellPointsLayer = () => {
    if (!mapInstanceRef.current) return;

    if (wellPointsLayerRef.current) {
      console.log("[DRAIN] Removing well points layer");
      console.log("[DRAIN] Well points layer removed successfully");
    }
  };

  const forceRemoveWellPointsLayer = () => {
    if (!mapInstanceRef.current) return;

    if (wellPointsLayerRef.current) {
      console.log("[DRAIN] Force removing well points layer from map");
      mapInstanceRef.current.removeLayer(wellPointsLayerRef.current);
      wellPointsLayerRef.current = null;
      console.log("[DRAIN] Well points layer force removed from map");
    }
  };

  // Well add mode functions
  const enableWellAddMode = (columns: string[], onWellAdd: (wellData: WellData, coordinates: [number, number]) => void) => {
    if (!mapInstanceRef.current) {
      console.warn("[DRAIN] Cannot enable well add mode: map not initialized");
      return;
    }

    console.log("[DRAIN] Enabling well add mode with columns:", columns);
    setIsWellAddModeActive(true);
    setWellAddCallback(() => onWellAdd);
    
    const editableColumns = columns.filter(col => 
      col !== 'LATITUDE' && col !== 'LONGITUDE' && col !== 'YEAR'
    );
    setAvailableColumns(editableColumns);

    if (clickListenerRef.current) {
      mapInstanceRef.current.un('singleclick', clickListenerRef.current);
    }

    const clickListener = (event: any) => {
      if (popupVisible) {
        console.log("[DRAIN] Popup already visible, ignoring click");
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const coordinate = event.coordinate;
      const lonLat = toLonLat(coordinate);
      
      // Validate if click is within selected region
      const bounds = getSelectedAreaBounds();
      if (bounds) {
        const [minLon, minLat, maxLon, maxLat] = bounds;
        const [clickLon, clickLat] = lonLat;
        
        if (clickLon < minLon || clickLon > maxLon || clickLat < minLat || clickLat > maxLat) {
          // Show styled error notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            max-width: 400px;
          `;
          notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
              <svg style="width: 24px; height: 24px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <div style="font-size: 18px; margin-bottom: 4px;">Outside Selected Region</div>
                <div style="font-size: 14px; opacity: 0.9;">Please click within the highlighted area to add a well</div>
              </div>
            </div>
          `;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.style.transition = 'opacity 0.3s ease';
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 3000);
          console.log('[DRAIN VALIDATION] Click outside selected region:', {
            clickLon: clickLon.toFixed(6),
            clickLat: clickLat.toFixed(6),
            bounds: { minLon, minLat, maxLon, maxLat }
          });
          return;
        }
      }

      console.log("[DRAIN] Map clicked at:", lonLat);

      const initialData: WellData = {};
      editableColumns.forEach(col => {
        initialData[col] = '';
      });

      console.log("[DRAIN] Setting form data:", initialData);
      setFormData(initialData);
      setPopupPosition([lonLat[0], lonLat[1]]);
      setPopupVisible(true);
    };

    clickListenerRef.current = clickListener;
    mapInstanceRef.current.on('singleclick', clickListener);

    const targetElement = mapInstanceRef.current.getTargetElement();
    if (targetElement) {
      targetElement.style.cursor = 'crosshair';
    }

    console.log("[DRAIN] Well add mode enabled with simplified popup");
  };

  const disableWellAddMode = () => {
    if (!mapInstanceRef.current) return;

    console.log("[DRAIN] Disabling well add mode");
    setIsWellAddModeActive(false);
    setWellAddCallback(null);

    if (clickListenerRef.current) {
      mapInstanceRef.current.un('singleclick', clickListenerRef.current);
      clickListenerRef.current = null;
    }

    setPopupVisible(false);
    setFormData({});
    setPopupPosition(null);

    const targetElement = mapInstanceRef.current.getTargetElement();
    if (targetElement) {
      targetElement.style.cursor = '';
    }

    console.log("[DRAIN] Well add mode disabled successfully");
  };

  const handlePopupSubmit = () => {
    if (!wellAddCallback || !popupPosition) {
      console.warn("[DRAIN] Cannot submit: missing callback or position");
      return;
    }

    console.log("[DRAIN] Submitting well data:", formData);
    wellAddCallback(formData, popupPosition);

    setPopupVisible(false);
    setFormData({});
    setPopupPosition(null);

    console.log("[DRAIN] Well data submitted successfully");
  };

  const handlePopupInputChange = (column: string, value: string) => {
    console.log(`[DRAIN] Updating form field ${column} to:`, value);
    setFormData(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const handlePopupCancel = () => {
    console.log("[DRAIN] Popup cancelled");
    setPopupVisible(false);
    setFormData({});
    setPopupPosition(null);
  };

  // PopupForm component (simplified for map clicks)
  const PopupForm = React.memo<{
    visible: boolean;
    position: [number, number] | null;
    columns: string[];
    formData: WellData;
    onSubmit: () => void;
    onCancel: () => void;
    onInputChange: (column: string, value: string) => void;
  }>(({ visible, position, columns, formData, onSubmit, onCancel, onInputChange }) => {
    if (!visible) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onCancel}
      >
        <div
          style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            width: '450px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '20px',
            borderRadius: '16px 16px 0 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                Add Well from Map (Drain)
              </h3>
              <button onClick={onCancel} style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                fontSize: '20px',
                color: 'white',
                cursor: 'pointer'
              }}>×</button>
            </div>
          </div>

          {/* Location Info */}
          {position && (
            <div style={{ padding: '16px', background: '#dbeafe', borderBottom: '1px solid #93c5fd' }}>
              <strong style={{ color: '#1e40af' }}>Location:</strong>
              <div style={{ fontSize: '14px', color: '#1e40af', marginTop: '4px' }}>
                Lat: {position[1].toFixed(6)}, Lon: {position[0].toFixed(6)}
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              Fill in the fields below. LATITUDE and LONGITUDE will be added automatically.
            </p>
            {columns.map((column) => (
              <div key={column} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  {column}
                </label>
                <input
                  type="text"
                  value={formData[column] || ''}
                  onChange={(e) => onInputChange(column, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                  placeholder={`Enter ${column}`}
                />
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
            <button onClick={onSubmit} style={{
              flex: 1,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Add Well
            </button>
            <button onClick={onCancel} style={{
              flex: 1,
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  });

  PopupForm.displayName = 'PopupForm';

  // Context value
  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    isRasterDisplayed,
    isVillageOverlayVisible,
    isContourDisplayed,
    isTrendDisplayed,
    legendData,
    availableRasters,
    selectedRaster,
    setMapContainer,
    changeBaseMap,
    addRasterLayer,
    addMultipleRasterLayers,
    switchToRaster,
    removeRasterLayer,
    removeAllRasterLayers,
    addContourLayer,
    removeContourLayer,
    zoomToCurrentExtent,
    getAllLayers,
    toggleVillageOverlay,
    addTrendLayer,
    removeTrendLayer,
    setLegendData,
    addWellPointsLayer,
    removeWellPointsLayer,
    forceRemoveWellPointsLayer,
    enableWellAddMode,
    disableWellAddMode,
    isWellAddModeActive,
    showLabels,
    toggleLabels,
    highlightSelectedFeatures,
    zoomToSelectedFeatures,
    getSelectedAreaBounds,
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      baseLayerRef.current = null;
      basinBoundaryLayerRef.current = null;
      riversLayerRef.current = null;
      stretchesLayerRef.current = null;
      drainsLayerRef.current = null;
      catchmentsLayerRef.current = null;
      villagesLayerRef.current = null;
      villageOverlayLayerRef.current = null;
      rasterLayerRef.current = null;
      contourLayerRef.current = null;
      trendLayerRef.current = null;
      wellPointsLayerRef.current = null;
    };
  }, []);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
      <PopupForm
        visible={popupVisible}
        position={popupPosition}
        columns={availableColumns}
        formData={formData}
        onSubmit={handlePopupSubmit}
        onCancel={handlePopupCancel}
        onInputChange={handlePopupInputChange}
      />
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};