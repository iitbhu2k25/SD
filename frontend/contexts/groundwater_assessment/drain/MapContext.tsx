"use client";
import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
} from "react";
import ReactDOM from 'react-dom';
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
import { useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { useWell, WellData } from "@/contexts/groundwater_assessment/drain/WellContext";

// GeoServer configuration
const GEOSERVER_BASE_URL = "/geoserver/api/myworkspace/wfs";
const GEOSERVER_WMS_URL = "/geoserver";

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
  cartoLight: {
    name: "Carto Light",
    source: () =>
      new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        maxZoom: 19,
        attributions:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
        crossOrigin: "anonymous",
      }),
    icon:
      "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
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
  },
  topo: {
    name: "Topographic",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        attributions:
          'Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer">ArcGIS</a>',
        crossOrigin: "anonymous",
      }),
    icon: "M7 14l5-5 5 5",
  },
};

// Interfaces
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
    classes: number;
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
  gsr?: {
    classes: { label: string; color: string; count: number }[];
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

// NEW: Layer opacity state interface
interface LayerOpacityState {
  basemap: number;
  boundaries: number;
  raster: number;
  contour: number;
  trend: number;
  gsr: number;
  wellPoints: number;
  villageOverlay: number;
}

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  isRasterDisplayed: boolean;
  isVillageOverlayVisible: boolean;
  isContourDisplayed: boolean;
  isTrendDisplayed: boolean;
  legendData: LegendData | null;
  // NEW: Opacity controls
  layerOpacities: LayerOpacityState;
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  addRasterLayer: (layerName: string, geoserverUrl?: string, colorScheme?: any) => void;
  removeRasterLayer: () => void;
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
  addGsrLayer: (geojson: any) => void;
  removeGsrLayer: () => void;
  isGsrDisplayed: boolean;
  // NEW: Opacity control functions
  setLayerOpacity: (layerType: keyof LayerOpacityState, opacity: number) => void;
  resetAllOpacities: () => void;
}

interface MapProviderProps {
  children: ReactNode;
}

interface TrendPopupProps {
  feature: any;
  coordinate: number[];
  onClose: () => void;
}

// NEW: Default opacity values (1-10 scale)
const defaultOpacities: LayerOpacityState = {
  basemap: 10,
  boundaries: 8,
  raster: 8,
  contour: 8,
  trend: 9,
  gsr: 9,
  wellPoints: 10,
  villageOverlay: 7,
};

// NEW: Convert 1-10 scale to 0-1 scale for OpenLayers
const scaleToOpacity = (scale: number): number => {
  return Math.max(0, Math.min(1, scale / 10));
};

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "osm",
  isRasterDisplayed: false,
  isVillageOverlayVisible: false,
  isContourDisplayed: false,
  legendData: null,
  isTrendDisplayed: false,
  setMapContainer: () => { },
  changeBaseMap: () => { },
  addRasterLayer: () => { },
  removeRasterLayer: () => { },
  addContourLayer: () => { },
  removeContourLayer: () => { },
  zoomToCurrentExtent: () => { },
  getAllLayers: () => [],
  toggleVillageOverlay: () => { },
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
  addGsrLayer: () => { },
  removeGsrLayer: () => { },
  isGsrDisplayed: false,
  // NEW
  layerOpacities: defaultOpacities,
  setLayerOpacity: () => { },
  resetAllOpacities: () => { },
});


// Separate PopupForm component to prevent re-creation on every render
interface PopupFormProps {
  visible: boolean;
  formData: WellData;
  availableColumns: string[];
  popupPosition: [number, number] | null;
  onInputChange: (column: string, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const PopupForm: React.FC<PopupFormProps> = React.memo(({
  visible,
  formData,
  availableColumns,
  popupPosition,
  onInputChange,
  onSubmit,
  onCancel
}) => {
  console.log("PopupForm render - visible:", visible);

  if (!visible) return null;

  const displayColumns = availableColumns;

  if (!displayColumns || displayColumns.length === 0) {
    console.warn("No columns available for popup form");
    return null;
  }

  // Group columns
  const essentialColumns = ['HYDROGRAPH', 'BLOCK'].filter(col =>
    displayColumns.includes(col)
  );
  const rlColumn = ['RL'].filter(col => displayColumns.includes(col));
  const coordinateColumns = ['LATITUDE', 'LONGITUDE'].filter(col =>
    displayColumns.includes(col)
  );
  const dataColumns = displayColumns
    .filter(col => col.startsWith('PRE_') || col.startsWith('POST_'))
    .sort();
  const otherColumns = displayColumns.filter(
    col =>
      !essentialColumns.includes(col) &&
      !coordinateColumns.includes(col) &&
      !dataColumns.includes(col) &&
      !rlColumn.includes(col)
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        backgroundColor: 'white',
        border: '2px solid #3B82F6',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        padding: '24px',
        width: '90vw',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800">Add New Well</h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-2xl font-bold bg-transparent border-none cursor-pointer p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          ×
        </button>
      </div>

      {/* Location Info */}
      {popupPosition && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600 font-medium">📍 Selected Location</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Latitude:</span>
              <span className="ml-2 font-mono">{popupPosition[1].toFixed(6)}</span>
            </div>
            <div>
              <span className="text-gray-600">Longitude:</span>
              <span className="ml-2 font-mono">{popupPosition[0].toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>
        <div className="space-y-6">
          {/* Essential Information */}
          {essentialColumns.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-2">
                Essential Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {essentialColumns.map(column => (
                  <div key={column}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {column === 'HYDROGRAPH' ? 'Well Name *' : column === 'BLOCK' ? 'Block' : column.replace('_', ' ')}
                    </label>
                    <input
                      type="text"
                      value={formData[column] || ''}
                      onChange={e => onInputChange(column, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={column === 'HYDROGRAPH' ? 'Enter well name' : 'Enter block name'}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coordinates */}
          {coordinateColumns.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-2">
                Coordinates (Auto-filled)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coordinateColumns.map(column => (
                  <div key={column}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{column}</label>
                    <input
                      type="text"
                      value={formData[column] || ''}
                      readOnly
                      className="w-full p-2 border border-gray-300 rounded-md text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Columns */}
          {otherColumns.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-2">
                Additional Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherColumns.map(column => (
                  <div key={column}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <input
                      type="text"
                      value={formData[column] || ''}
                      onChange={e => onInputChange(column, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Enter ${column.toLowerCase().replace(/_/g, ' ')}`}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Measurements */}
          {dataColumns.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(() => {
                // 1. Parse the columns into an array of objects
                const parsedColumns = dataColumns.map(col => {
                  const parts = col.split('_');
                  return {
                    key: col,
                    year: parts[1],
                    period: parts[0] === 'PRE' ? 'Pre-Monsoon' : 'Post-Monsoon',
                    order: parts[0] === 'PRE' ? 0 : 1 // for sorting
                  };
                });

                // 2. Group by year and sort by period
                // Around line 545
                const sortedColumns = parsedColumns
                  .sort((a, b) => Number(a.year) - Number(b.year) || a.order - b.order);

                // 3. Render
                return sortedColumns.map(col => (
                  <div key={col.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {col.period} {col.year}
                    </label>
                    <input
                      type="number"
                      value={formData[col.key] || ''}
                      onChange={e => onInputChange(col.key, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0.00"
                      step="0.01"
                      autoComplete="off"
                    />
                  </div>
                ));
              })()}
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onSubmit}
          disabled={!formData['HYDROGRAPH'] || (typeof formData['HYDROGRAPH'] === 'string' && !formData['HYDROGRAPH'].trim())}
          className={`flex-1 py-3 px-6 rounded-lg text-sm font-medium transition-colors ${typeof formData['HYDROGRAPH'] === 'string' && formData['HYDROGRAPH'].trim()
            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          Add Well to Table
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-lg text-sm font-medium transition-colors shadow-md hover:shadow-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

PopupForm.displayName = 'PopupForm';

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);

  // Layer refs for drainage system
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

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [isRasterDisplayed, setIsRasterDisplayed] = useState<boolean>(false);
  const [isVillageOverlayVisible, setIsVillageOverlayVisible] = useState<boolean>(false);
  const [isContourDisplayed, setIsContourDisplayed] = useState<boolean>(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  // GSR polygons layer
  const gsrLayerRef = useRef<VectorLayer<any> | null>(null);
  const [isGsrDisplayed, setIsGsrDisplayed] = useState<boolean>(false);

  // Get location context data
  const {
    selectedRiver,
    selectedStretch,
    selectedDrain,
    selectedCatchments,
    selectedVillages,
    areaConfirmed
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

  // NEW: Layer opacity state
  const [layerOpacities, setLayerOpacities] = useState<LayerOpacityState>(defaultOpacities);

  const wellPointStyle = new Style({
    image: new CircleStyle({
      radius: 3,
      fill: new Fill({
        color: '#FF6B35',
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 2,
      }),
    }),
  });

  // Style definitions
  const boundaryLayerStyle = new Style({
    stroke: new Stroke({
      color: "blue",
      width: 2,
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

  // Styles for drainage system layers
  const basinBoundaryStyle = new Style({
    stroke: new Stroke({
      color: "#6f11119d", // Black outline
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(0, 0, 0, 0)", // Completely transparent fill (hollow)
    }),
  });

  const riverStyle = new Style({
    stroke: new Stroke({
      color: "#1E40AF", // Blue
      width: 3,
    }),
  });

  const stretchStyle = new Style({
    stroke: new Stroke({
      color: "#7C3AED", // Purple
      width: 2,
    }),
  });

  const selectedStretchStyle = new Style({
    stroke: new Stroke({
      color: "#EF4444", // Red for selected stretch
      width: 4,
    }),
  });

  const drainStyle = new Style({
    stroke: new Stroke({
      color: "#059669", // Green
      width: 2,
    }),
  });

  const selectedDrainStyle = new Style({
    image: new CircleStyle({
      radius: 8,
      fill: new Fill({
        color: '#FF6B35', // Orange for selected drain point
      }),
      stroke: new Stroke({
        color: '#FFFFFF',
        width: 2,
      }),
    }),
  });

  const catchmentStyle = new Style({
    stroke: new Stroke({
      color: "#DC2626", // Red
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(220, 38, 38, 0.1)", // Light red fill
    }),
  });

  const villageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B", // Orange
      width: 1,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.1)", // Light orange fill
    }),
  });

  const selectedVillageStyle = new Style({
    stroke: new Stroke({
      color: "#F59E0B", // Orange
      width: 2,
    }),
    fill: new Fill({
      color: "rgba(245, 158, 11, 0.4)", // Darker orange fill for selected
    }),
  });

  // Helper function to create text style for labels
  const createLabelStyle = (text: string, offsetY: number = 0) => {
    return new Style({
      text: new Text({
        text: text,
        font: '12px Calibri,sans-serif',
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

  const createTrendStyle = (feature: any) => {
    const properties = feature.getProperties();
    const color = properties.color || '#808080';
    const size = properties.size || 8;
    const opacity = properties.opacity || 0.8;

    return new Style({
      image: new CircleStyle({
        radius: size,
        fill: new Fill({
          color: color,
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 1,
        }),
      }),
    });
  };

  // --- GSR helpers ---
  // Map classification label to default colors if backend color is missing
  const gsrFallbackColorMap: Record<string, string> = {
    'Over Exploited': '#8B0000',
    'Critical': '#DC2626',
    'Very Semi-Critical': '#F59E0B',
    'Semi-Critical': '#F59E0B',
    'Safe': '#16A34A',
    'Very Safe': '#0D9488',
    'No Data': '#9CA3AF',
    'Unknown': '#9CA3AF',
  };

  const gsrColorFor = (props: any) => {
    const label = props.gsr_classification || props.classification || 'Unknown';
    return props.classification_color || gsrFallbackColorMap[label] || '#9CA3AF';
  };

  const createGsrPolygonStyle = (feature: any) => {
    const props = feature.getProperties() || {};
    const base = gsrColorFor(props);

    return [
      // Fill only
      new Style({
        fill: new Fill({ color: base }),
        stroke: new Stroke({ color: 'transparent', width: 0 }),
        zIndex: 1,
      }),
      // White stroke drawn above fill
      new Style({
        stroke: new Stroke({ color: 'white', width: 1 }),
        zIndex: 2,
      }),
    ];
  };


const buildGsrLegend = (features: any[]) => {
  const counts: Record<string, { color: string; count: number }> = {};
  
  for (const f of features) {
    const p = f.getProperties() || {};
    const label = p.gsr_classification || p.classification || 'Unknown';
    const color = p.classification_color || gsrFallbackColorMap[label] || '#9CA3AF';
    
    if (counts[label]) {
      counts[label].count += 1;
    } else {
      counts[label] = { color, count: 1 };
    }
  }
  
  return Object.entries(counts).map(([label, { color, count }]) => ({
    label,
    color,
    count
  }));
};

  // NEW: Function to set layer opacity
  const setLayerOpacity = (layerType: keyof LayerOpacityState, opacity: number) => {
    // Clamp opacity between 1-10
    const clampedOpacity = Math.max(1, Math.min(10, Math.round(opacity))) || defaultOpacities[layerType];

    setLayerOpacities(prev => ({
      ...prev,
      [layerType]: clampedOpacity
    }));

    // Apply opacity to the corresponding layer
    const opacityValue = scaleToOpacity(clampedOpacity);

    switch (layerType) {
      case 'basemap':
        if (baseLayerRef.current) {
          baseLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'boundaries':
        // Apply to all boundary layers
        [basinBoundaryLayerRef, riversLayerRef, stretchesLayerRef, drainsLayerRef, catchmentsLayerRef, villagesLayerRef].forEach(layerRef => {
          if (layerRef.current) {
            layerRef.current.setOpacity(opacityValue);
          }
        });
        break;
      case 'raster':
        if (rasterLayerRef.current) {
          rasterLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'contour':
        if (contourLayerRef.current) {
          contourLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'trend':
        if (trendLayerRef.current) {
          trendLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'gsr':
        if (gsrLayerRef.current) {
          gsrLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'wellPoints':
        if (wellPointsLayerRef.current) {
          wellPointsLayerRef.current.setOpacity(opacityValue);
        }
        break;
      case 'villageOverlay':
        if (villageOverlayLayerRef.current) {
          villageOverlayLayerRef.current.setOpacity(opacityValue);
        }
        break;
    }

    console.log(`Set ${layerType} opacity to ${clampedOpacity}/10 (${opacityValue})`);
  };

  // NEW: Function to reset all opacities to default
  const resetAllOpacities = () => {
    setLayerOpacities({ ...defaultOpacities });

    // Apply default opacities to all layers
    Object.entries(defaultOpacities).forEach(([layerType, opacity]) => {
      const opacityValue = scaleToOpacity(opacity);

      switch (layerType as keyof LayerOpacityState) {
        case 'basemap':
          if (baseLayerRef.current) {
            baseLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'boundaries':
          [basinBoundaryLayerRef, riversLayerRef, stretchesLayerRef, drainsLayerRef, catchmentsLayerRef, villagesLayerRef].forEach(layerRef => {
            if (layerRef.current) {
              layerRef.current.setOpacity(opacityValue);
            }
          });
          break;
        case 'raster':
          if (rasterLayerRef.current) {
            rasterLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'contour':
          if (contourLayerRef.current) {
            contourLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'trend':
          if (trendLayerRef.current) {
            trendLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'gsr':
          if (gsrLayerRef.current) {
            gsrLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'wellPoints':
          if (wellPointsLayerRef.current) {
            wellPointsLayerRef.current.setOpacity(opacityValue);
          }
          break;
        case 'villageOverlay':
          if (villageOverlayLayerRef.current) {
            villageOverlayLayerRef.current.setOpacity(opacityValue);
          }
          break;
      }
    });

    console.log("Reset all layer opacities to default values");
  };


  // NEW: Apply opacity when layers are created/updated
  const applyLayerOpacity = (layer: any, layerType: keyof LayerOpacityState) => {
    if (layer && layerOpacities && layerOpacities[layerType] !== undefined) {
      const opacity = scaleToOpacity(layerOpacities[layerType]);
      layer.setOpacity(opacity);
    }
  };
  // --- GSR layer add/remove ---
  const addGsrLayer = (geojson: any) => {
    if (!mapInstanceRef.current) return;

    try {
      // remove existing
      if (gsrLayerRef.current) {
        mapInstanceRef.current.removeLayer(gsrLayerRef.current);
        gsrLayerRef.current = null;
      }

      if (!geojson || !geojson.features || geojson.features.length === 0) {
        setIsGsrDisplayed(false);
        setLegendData((prev) => ({ ...(prev || {}), gsr: undefined }));
        return;
      }

      const source = new VectorSource({
        features: new GeoJSON().readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }),
      });

      const layer = new VectorLayer({
        source,
        style: createGsrPolygonStyle,
        zIndex: 22,
        visible: true,
      });
      layer.set('name', 'gsr');
      layer.set('type', 'gsr');

      // NEW: Apply opacity
      applyLayerOpacity(layer, 'gsr');

      gsrLayerRef.current = layer;
      mapInstanceRef.current.addLayer(layer);
      setIsGsrDisplayed(true);

      const legendClasses = buildGsrLegend(source.getFeatures());

      // Around line 324
      setLegendData((prev) => {
        const updated: LegendData = prev ? { ...prev } : {};
        updated.gsr = { classes: legendClasses as { label: string; color: string; count: number; }[] };
        return updated;
      });
      setTimeout(() => {
        const extent = source.getExtent();
        if (extent && mapInstanceRef.current) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 300);
      const handleGsrClick = (event: any) => {
        const feature = mapInstanceRef.current?.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
          if (layer === layer) {  // referring to the gsrLayer created in this function
            return feature;
          }
        });

        if (feature) {
          const properties = feature.getProperties();
          console.log('GSR feature clicked:', properties);
          showGsrPopup(feature, event.coordinate);
        }
      };

      // Remove existing click listeners and add new one for GSR
      mapInstanceRef.current.un('singleclick', handleGsrClick);
      mapInstanceRef.current.on('singleclick', handleGsrClick);
    } catch (e) {
      console.log('Error adding GSR layer:', e);
    }
  };
  // Enhanced popup function for GSR features
  const showGsrPopup = (feature: any, coordinate: number[]) => {
    if (!mapInstanceRef.current || !popupOverlayRef.current) return;

    const properties = feature.getProperties();

    // Create popup content for GSR
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
    background: white;
    border: 2px solid #10B981;
    border-radius: 8px;
    padding: 8px;
    min-width: 200px;
    max-width: 250px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
  `;

    // Get GSR values
    const gsrClassification = properties.gsr_classification || properties.classification || 'No Data';
    const gsrValue = properties.gsr_value || properties.gsr || 'N/A';
    const categoryColor = properties.classification_color || gsrFallbackColorMap[gsrClassification] || '#9CA3AF';

    // Get trend values
    const trendStatus = properties.trend_status || properties.Trend_Status || properties.trend || 'N/A';
    const trendColor = getTrendColor(trendStatus);

    popupContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div style="font-weight: 600; color: #1F2937; font-size: 14px;">
        ${properties.Village_Name || properties.village_name || properties.name || 'GSR Data'}
      </div>
      <button id="close-gsr-popup" style="
        background: none; 
        border: none; 
        font-size: 18px; 
        color: #6B7280; 
        cursor: pointer; 
        padding: 2px;
      ">×</button>
    </div>
    
    <div style="background: #F0FDF4; padding: 8px; border-radius: 4px; font-size: 11px;">
      <div style="margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
        <div style="width: 12px; height: 12px; border-radius: 2px; background: ${categoryColor};"></div>
        <b>GSR Classification:</b> ${gsrClassification}
      </div>
      <div style="margin-bottom: 3px;"><b>GSR Value:</b> ${typeof gsrValue === 'number' ? gsrValue.toFixed(2) : gsrValue}</div>
      
      <div style="margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${trendColor};"></div>
        <b>Trend Status:</b> ${trendStatus.replace('_', ' ')}
      </div>
      ${properties.Mann_Kendall_Tau || properties.tau ? `<div style="margin-bottom: 3px;"><b>Tau Value:</b> ${(properties.Mann_Kendall_Tau || properties.tau).toFixed(3)}</div>` : ''}
      ${properties.P_Value || properties.p_value ? `<div style="margin-bottom: 3px;"><b>P-Value:</b> ${(properties.P_Value || properties.p_value).toFixed(3)}</div>` : ''}
      ${properties.Sen_Slope ? `<div style="margin-bottom: 3px;"><b>Slope:</b> ${properties.Sen_Slope.toFixed(3)} m/yr</div>` : ''}
      
      <div style="margin-bottom: 3px;"><b>Total Demand:</b> ${properties.total_demand ? (typeof properties.total_demand === 'number' ? properties.total_demand.toFixed(2) + ' M³/Year' : properties.total_demand) : 'N/A'}</div>
      <div style="margin-bottom: 3px;"><b>Recharge:</b> ${properties.recharge ? (typeof properties.recharge === 'number' ? properties.recharge.toFixed(2) + ' M³/Year' : properties.recharge) : 'N/A'}</div>
      
      ${properties.district ? `<div style="margin-bottom: 3px;"><b>District:</b> ${properties.district}</div>` : ''}
      ${properties.block ? `<div style="margin-bottom: 3px;"><b>Block:</b> ${properties.block}</div>` : ''}
      ${properties.area ? `<div><b>Area:</b> ${properties.area} km²</div>` : ''}
    </div>
  `;

    // Add close button functionality
    const closeButton = popupContent.querySelector('#close-gsr-popup');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (popupOverlayRef.current) {
          popupOverlayRef.current.setPosition(undefined);
        }
      });
    }

    // Set popup content and position
    const popupElement = popupOverlayRef.current.getElement();
    if (popupElement) {
      popupElement.innerHTML = '';
      popupElement.appendChild(popupContent);
      popupElement.style.display = 'block';
    }

    popupOverlayRef.current.setPosition(coordinate);
  };

  // Helper function to get trend color (add this after showGsrPopup function)


  const removeGsrLayer = () => {
    if (!mapInstanceRef.current) return;
    if (gsrLayerRef.current) {
      mapInstanceRef.current.removeLayer(gsrLayerRef.current);
      gsrLayerRef.current = null;
      setIsGsrDisplayed(false);
      setLegendData((prev) => ({ ...(prev || {}), gsr: undefined }));

      // Hide popup if visible
      if (popupOverlayRef.current) {
        popupOverlayRef.current.setPosition(undefined);
      }

      console.log('GSR layer removed successfully');
    }
  };
  const getTrendColor = (status: string): string => {
    const colorMapping: Record<string, string> = {
      'Increasing': '#FF6B6B',      // Red - groundwater depth increasing (level dropping)
      'Decreasing': '#4ECDC4',      // Teal - groundwater depth decreasing (level rising)  
      'No-Trend': '#95A5A6',        // Gray - no significant trend
      'No Trend': '#95A5A6',        // Gray - no significant trend (alternative name)
      'Insufficient Data': '#F39C12' // Orange - insufficient data
    };
    return colorMapping[status] || '#95A5A6';
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

  // Helper function to remove layer by ref with protection for permanent layers
  const removeLayerByRef = (layerRef: React.MutableRefObject<VectorLayer<any> | null>, layerName: string) => {
    if (layerRef.current && mapInstanceRef.current) {
      // Don't remove if it's marked as permanent
      if (layerRef.current.get('permanent')) {
        console.log(`Cannot remove permanent layer: ${layerName}`);
        return;
      }

      console.log(`Removing ${layerName} layer`);
      mapInstanceRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  };

  // Initialize map when container is set
  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.osm.source(),
      zIndex: 0,
    });

    initialBaseLayer.set('name', 'basemap');
    baseLayerRef.current = initialBaseLayer;

    const map = new Map({
      target: mapContainer,
      layers: [initialBaseLayer],
      view: new View({
        center: fromLonLat([82.378970, 25.539697]),
        zoom: 9.7
      }),
    });

    // NEW: Apply opacity
    applyLayerOpacity(initialBaseLayer, 'basemap');

    mapInstanceRef.current = map;
    console.log("Map initialized");

    // ADD BASIN BOUNDARY LAYER HERE - RIGHT AFTER MAP INITIALIZATION
    console.log("Adding permanent basin boundary layer from GeoServer");

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

    // NEW: Apply opacity
    applyLayerOpacity(basinBoundaryLayer, 'boundaries');

    // Add event listeners for debugging
    const basinSource = basinBoundaryLayer.getSource();
    basinSource?.on("featuresloaderror", (event) => {
      console.log("Error loading basin boundary layer:", event);
    });

    basinSource?.on("featuresloadstart", () => {
      console.log("Started loading basin boundary layer");
    });

    basinSource?.on("featuresloadend", () => {
      console.log("Successfully loaded basin boundary layer");
      const features = basinSource.getFeatures();
      console.log(`Loaded ${features.length} basin boundary features`);
    });

    // Store reference and add to map
    basinBoundaryLayerRef.current = basinBoundaryLayer;
    map.addLayer(basinBoundaryLayer);

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

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [mapContainer]);

  // Effect to handle rivers layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!riversLayerRef.current) {
      console.log("Adding rivers layer");
      const riversLayer = createDrainageWFSLayer(
        "Rivers",
        "1=1", // Show all rivers
        riverStyle,
        10,
        "rivers"
      );

      // NEW: Apply opacity
      applyLayerOpacity(riversLayer, 'boundaries');

      riversLayerRef.current = riversLayer;
      mapInstanceRef.current.addLayer(riversLayer);

      // Auto-zoom to rivers extent
      riversLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = riversLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, []);

  // Effect to handle stretches layer when river is selected
  // Configuration object for label visibility rules
  const STRETCH_LABEL_CONFIG = {
    // Zoom thresholds and their corresponding label strategies
    zoomLevels: [
      {
        minZoom: 0,
        maxZoom: 9,
        strategy: 'all', // Show all labels when zoomed out
        description: 'Overview level - show all stretches'
      },
      {
        minZoom: 9,
        maxZoom: 11,
        strategy: 'selective',
        interval: 3, // Show every 3rd stretch
        description: 'Regional level - show major stretches'
      },
      {
        minZoom: 11,
        maxZoom: 13,
        strategy: 'selective',
        interval: 2, // Show every 2nd stretch
        description: 'Local level - show more stretches'
      },
      {
        minZoom: 13,
        maxZoom: 20,
        strategy: 'all', // Show all labels when zoomed in
        description: 'Detail level - show all stretches'
      }
    ],
    // Enable/disable the progressive labeling system
    enableProgressiveLabeling: true,
    // Fallback when progressive labeling is disabled
    fallbackShowAll: true
  };

  // Helper function to determine if a stretch label should be shown
  const shouldShowStretchLabel = (stretchId: number, currentZoom: number, showLabelsToggle: boolean) => {
    // If labels are toggled off, don't show any
    if (!showLabelsToggle) return false;

    // If progressive labeling is disabled, use fallback
    if (!STRETCH_LABEL_CONFIG.enableProgressiveLabeling) {
      return STRETCH_LABEL_CONFIG.fallbackShowAll;
    }

    // Find the appropriate zoom level configuration
    const zoomConfig = STRETCH_LABEL_CONFIG.zoomLevels.find(
      level => currentZoom >= level.minZoom && currentZoom < level.maxZoom
    );

    if (!zoomConfig) return false;

    // Apply the strategy
    switch (zoomConfig.strategy) {
      case 'all':
        return true;
      case 'selective':
        // Show labels based on interval (every nth stretch)
        return stretchId % (zoomConfig?.interval ?? 1) === 1;
      case 'none':
        return false;
      default:
        return false;
    }
  };

  // Helper function to create stretch label style with line placement
  const createStretchLabelStyle = (text: string) => {
    return new Style({
      text: new Text({
        text: text,
        font: '11px Arial, sans-serif',
        fill: new Fill({
          color: '#1F2937' // Dark gray
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 3
        }),
        placement: 'line', // Follow the stretch line
        textAlign: 'center',
        textBaseline: 'middle',
        maxAngle: Math.PI / 4, // Prevent text from rotating too much
        overflow: false // Hide text if it doesn't fit
      })
    });
  };

  // Effect to handle stretches layer when river is selected
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing stretches layer
    removeLayerByRef(stretchesLayerRef, "stretches");

    if (selectedRiver) {
      console.log(`Adding stretches layer for river: ${selectedRiver}`);
      const cqlFilter = `River_Code=${selectedRiver}`;

      // Create stretches layer with dynamic styling based on selection
      const stretchesLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Stretches&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
        }),
        style: (feature) => {
          const stretchId = feature.get('Stretch_ID');
          const baseStyle = stretchId === selectedStretch ? selectedStretchStyle : stretchStyle;

          // Get current zoom level
          const currentZoom = mapInstanceRef.current?.getView().getZoom() || 0;

          // Determine if label should be shown using our helper function
          const shouldShow = shouldShowStretchLabel(stretchId, currentZoom, showLabels);

          if (shouldShow) {
            return [
              baseStyle,
              createStretchLabelStyle(`S-${stretchId}`)
            ];
          }

          return baseStyle;
        },
        zIndex: 11,
        visible: true,
      });

      stretchesLayer.set('name', 'stretches');
      stretchesLayer.set('type', 'drainage');

      // NEW: Apply opacity
      applyLayerOpacity(stretchesLayer, 'boundaries');

      stretchesLayerRef.current = stretchesLayer;
      mapInstanceRef.current.addLayer(stretchesLayer);

      // Add view change listener to refresh styles when zoom changes
      const view = mapInstanceRef.current.getView();
      const zoomChangeHandler = () => {
        const currentZoom = view.getZoom() || 0;
        console.log(`Zoom changed to: ${currentZoom.toFixed(1)} - Refreshing stretch labels`);
        stretchesLayer.changed(); // Force re-render of the layer
      };

      view.on('change:resolution', zoomChangeHandler);

      // Store the handler for cleanup
      stretchesLayer.set('zoomChangeHandler', zoomChangeHandler);

      // Cleanup function to remove zoom listener
      const cleanup = () => {
        view.un('change:resolution', zoomChangeHandler);
      };
      stretchesLayer.set('cleanup', cleanup);

      // Just log when features are loaded
      stretchesLayer.getSource()?.on("featuresloadend", () => {
        console.log(`Successfully loaded stretches for river ${selectedRiver}`);
        const currentZoom = view.getZoom() || 0;
        console.log(`Current zoom level: ${currentZoom.toFixed(1)}`);
      });
    }
  }, [selectedRiver, selectedStretch, showLabels]);

  // Effect to handle drains layer when stretch is selected
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing drains layer
    removeLayerByRef(drainsLayerRef, "drains");

    if (selectedStretch && selectedRiver) {
      console.log(`Adding drains layer for stretch: ${selectedStretch}, river: ${selectedRiver}`);
      const cqlFilter = `Stretch_ID=${selectedStretch} AND River_Code=${selectedRiver}`;

      // Create drains layer with point styling for selected drain
      const drainsLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Drain&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
        }),
        style: (feature) => {
          const drainNo = feature.get('Drain_No');
          return drainNo === selectedDrain ? selectedDrainStyle : drainStyle;
        },
        zIndex: 12,
        visible: true,
      });

      drainsLayer.set('name', 'drains');
      drainsLayer.set('type', 'drainage');

      // NEW: Apply opacity
      applyLayerOpacity(drainsLayer, 'boundaries');

      drainsLayerRef.current = drainsLayer;
      mapInstanceRef.current.addLayer(drainsLayer);

      // Auto-zoom to drains
      drainsLayer.getSource()?.on("featuresloadend", () => {
        setTimeout(() => {
          const extent = drainsLayer.getSource()?.getExtent();
          if (extent && mapInstanceRef.current) {
            mapInstanceRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
            });
          }
        }, 500);
      });
    }
  }, [selectedStretch, selectedRiver, selectedDrain]);

  // Effect to handle catchments ONLY when drain is selected (based on Drain_No)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing catchments layer
    removeLayerByRef(catchmentsLayerRef, "catchments");

    // Show catchments ONLY when a drain is selected, filtered by Drain_No
    if (selectedDrain) {
      console.log(`Adding catchments layer for drain number: ${selectedDrain}`);

      // Filter catchments by the selected drain number
      const catchmentsCqlFilter = `Drain_No=${selectedDrain}`;

      console.log(`Using CQL filter for catchments: ${catchmentsCqlFilter}`);

      const catchmentsLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Catchment&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(catchmentsCqlFilter)}`,
        }),
        style: catchmentStyle,
        zIndex: 13,
        visible: true,
      });

      catchmentsLayer.set('name', 'catchments');
      catchmentsLayer.set('type', 'drainage');

      // NEW: Apply opacity
      applyLayerOpacity(catchmentsLayer, 'boundaries');

      // Enhanced error handling
      const source = catchmentsLayer.getSource();
      source?.on("featuresloaderror", (event: any) => {
        console.log(`Error loading Catchment layer for drain ${selectedDrain}:`, event);
        console.log(`URL attempted: ${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Catchment&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(catchmentsCqlFilter)}`);
      });

      source?.on("featuresloadstart", () => {
        console.log(`Started loading Catchment layer for drain: ${selectedDrain}`);
      });

      source?.on("featuresloadend", () => {
        console.log(`Successfully loaded Catchment layer for drain: ${selectedDrain}`);
        const features = source.getFeatures();
        console.log(`Loaded ${features.length} catchment features for drain ${selectedDrain}`);
      });

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

  // Effect to handle villages ONLY when explicitly selected from dropdown
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing villages layer
    removeLayerByRef(villagesLayerRef, "villages");

    // Only show villages if they are explicitly selected from the dropdown
    if (selectedVillages.length > 0) {
      console.log(`Adding villages layer for selected villages: ${selectedVillages}`);

      // Create filter for selected villages using village codes from LocationContext
      const villageCodeFilter = selectedVillages.map(code => `'${code}'`).join(',');
      const villagesCqlFilter = `village_co IN (${villageCodeFilter})`;

      const villagesLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${GEOSERVER_BASE_URL}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Village&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(villagesCqlFilter)}`,
        }),
        style: (feature) => {
          const villageCode = feature.get('village_co');
          const baseStyle = selectedVillages.includes(Number(villageCode)) ? selectedVillageStyle : villageStyle;

          if (showLabels) {
            const villageName = feature.get('shapeName') || `Village ${villageCode}`;
            return createCombinedStyle(baseStyle, villageName, 0);
          }
          return baseStyle;
        },
        zIndex: 14,
        visible: true,
      });

      villagesLayer.set('name', 'villages');
      villagesLayer.set('type', 'drainage');

      // NEW: Apply opacity
      applyLayerOpacity(villagesLayer, 'boundaries');

      villagesLayerRef.current = villagesLayer;
      mapInstanceRef.current.addLayer(villagesLayer);

      // Auto-zoom to villages extent
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
  }, [selectedVillages, showLabels]);

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

      // Create lightweight village overlay if needed and villages are selected
      if (selectedVillages.length > 0 && !villageOverlayLayerRef.current) {
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

        // NEW: Apply opacity
        applyLayerOpacity(villageOverlay, 'villageOverlay');

        villageOverlayLayerRef.current = villageOverlay;
        mapInstanceRef.current.addLayer(villageOverlay);
        console.log("Added lightweight village overlay on top of raster");
      }
    } else {
      // Remove lightweight village overlay
      if (villageOverlayLayerRef.current) {
        mapInstanceRef.current.removeLayer(villageOverlayLayerRef.current);
        villageOverlayLayerRef.current = null;
        setIsVillageOverlayVisible(true); // Reset to default visibility
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

  // Function to zoom to current extent
  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;

    // Priority: Contour > Village overlay (if visible and raster displayed) > Villages > Catchments > Drains > Stretches > Rivers
    if (contourLayerRef.current && isContourDisplayed) {
      targetLayer = contourLayerRef.current;
    } else if (gsrLayerRef.current && isGsrDisplayed) {
      targetLayer = gsrLayerRef.current;
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
      const source = targetLayer.getSource?.();
      if (source) {
        const extent = source.getExtent();
        if (extent && extent.some((coord: number) => isFinite(coord))) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 10,
            duration: 1000,
          });
          console.log('Zoomed to current extent');
        }
      } else {
        // Fallback for raster/image layers
        const extent = targetLayer.getExtent?.();
        if (extent) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: 10,
            duration: 1000,
          });
        }
      }
    }
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

  // Keep all existing functions for contour, trend, raster, and well layers
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
        visible: true,
      });

      contourLayer.set('name', 'contours');
      contourLayer.set('type', 'contour');

      // NEW: Apply opacity
      applyLayerOpacity(contourLayer, 'contour');

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
            color: finalColor + '80'
          }),
          stroke: new Stroke({
            color: finalColor,
            width: 2
          })
        });
      };

      const trendLayer = new VectorLayer({
        source: trendSource,
        style: createVillageTrendStyle,
        zIndex: 25,
        visible: true,
      });

      trendLayer.set('name', 'trend-villages');
      trendLayer.set('type', 'trend');

      // NEW: Apply opacity
      applyLayerOpacity(trendLayer, 'trend');

      trendLayerRef.current = trendLayer;
      mapInstanceRef.current.addLayer(trendLayer);
      setIsTrendDisplayed(true);

      setTimeout(() => {
        const extent = trendSource.getExtent();
        if (extent && mapInstanceRef.current) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 500);

      const handleTrendClick = (event: any) => {
        const feature = mapInstanceRef.current?.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
          if (layer === trendLayer) {
            return feature;
          }
        });

        if (feature) {
          const properties = feature.getProperties();
          console.log('Trend village clicked:', properties);
          showTrendPopup(feature, event.coordinate);
        }
      };

      mapInstanceRef.current.un('singleclick', handleTrendClick);
      mapInstanceRef.current.on('singleclick', handleTrendClick);

    } catch (error) {
      console.log("Error adding trend layer:", error);
    }
  };

  const showTrendPopup = (feature: any, coordinate: number[]) => {
    if (!mapInstanceRef.current || !popupOverlayRef.current) return;

    const properties = feature.getProperties();

    // Create minimal popup content
    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
    background: white;
    border: 2px solid #3B82F6;
    border-radius: 8px;
    padding: 12px;
    min-width: 180px;
    max-width: 220px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
  `;

    const trendStatus = properties.Trend_Status || properties.trend || 'Unknown';
    const pValue = properties.P_Value || properties.p_value;

    popupContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div style="font-weight: 600; color: #1F2937; font-size: 14px;">
        ${properties.Village_Name || properties.village_name || 'Unknown Village'}
      </div>
      <button id="close-popup" style="
        background: none; 
        border: none; 
        font-size: 18px; 
        color: #6B7280; 
        cursor: pointer; 
        padding: 2px;
      ">×</button>
    </div>
    
    <div style="background: #F8F9FA; padding: 8px; border-radius: 4px; font-size: 11px;">
      <div style="margin-bottom: 3px;"><b>Status:</b> ${trendStatus.replace('_', ' ')}</div>
      <div style="margin-bottom: 3px;"><b>Tau:</b> ${properties.Mann_Kendall_Tau?.toFixed(3) || properties.tau?.toFixed(3) || 'N/A'}</div>
      <div style="margin-bottom: 3px;"><b>P-value:</b> ${pValue?.toFixed(3) || 'N/A'}</div>
      <div><b>Slope:</b> ${properties.Sen_Slope?.toFixed(3) || 'N/A'} m/yr</div>
    </div>
  `;

    // Add close button functionality
    const closeButton = popupContent.querySelector('#close-popup');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (popupOverlayRef.current) {
          popupOverlayRef.current.setPosition(undefined);
        }
      });
    }

    // Set popup content and position
    const popupElement = popupOverlayRef.current.getElement();
    if (popupElement) {
      popupElement.innerHTML = '';
      popupElement.appendChild(popupContent);
      popupElement.style.display = 'block';
    }

    popupOverlayRef.current.setPosition(coordinate);
  };


  const removeTrendLayer = () => {
    if (!mapInstanceRef.current) return;

    if (trendLayerRef.current) {
      console.log("Removing trend layer");
      mapInstanceRef.current.removeLayer(trendLayerRef.current);
      trendLayerRef.current = null;
      setIsTrendDisplayed(false);

      if (popupOverlayRef.current) {
        popupOverlayRef.current.setPosition(undefined);
      }

      console.log("Trend layer removed successfully");
    }
  };

  const addRasterLayer = (layerName: string, geoserverUrl?: string, colorScheme?: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add raster layer: map not initialized");
      return;
    }

    // Use base URL if no specific URL provided
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
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');

      // NEW: Apply opacity
      applyLayerOpacity(rasterLayer, 'raster');

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

  const removeRasterLayer = () => {
    if (!mapInstanceRef.current) return;

    if (rasterLayerRef.current) {
      console.log("Removing raster layer");
      mapInstanceRef.current.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
      setIsRasterDisplayed(false);
      setLegendData((prev) => ({ ...prev, raster: undefined }));
      console.log("Raster layer removed successfully");
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
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');

      // NEW: Apply opacity
      applyLayerOpacity(rasterLayer, 'raster');

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

  const addWellPointsLayer = (wellPoints: WellPoint[]) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add well points: map not initialized");
      return;
    }

    console.log(`Adding ${wellPoints.length} well points to map`);

    try {
      if (wellPointsLayerRef.current) {
        mapInstanceRef.current.removeLayer(wellPointsLayerRef.current);
        wellPointsLayerRef.current = null;
      }

      if (wellPoints.length === 0) {
        console.log("No well points to display");
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
        visible: true,
      });

      wellPointsLayer.set('name', 'manual-wells');
      wellPointsLayer.set('type', 'well-points');

      // NEW: Apply opacity
      applyLayerOpacity(wellPointsLayer, 'wellPoints');

      wellPointsLayerRef.current = wellPointsLayer;
      mapInstanceRef.current.addLayer(wellPointsLayer);

      console.log(`Well points layer successfully added with ${features.length} points`);

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
      console.log("Error adding well points layer:", error);
    }
  };

  const removeWellPointsLayer = () => {
    if (!mapInstanceRef.current) return;

    if (wellPointsLayerRef.current) {
      console.log("Removing well points layer");
      console.log("Well points layer removed successfully");
    }
  };

  const forceRemoveWellPointsLayer = () => {
    if (!mapInstanceRef.current) return;

    if (wellPointsLayerRef.current) {
      console.log("Force removing well points layer from map");
      mapInstanceRef.current.removeLayer(wellPointsLayerRef.current);
      wellPointsLayerRef.current = null;
      console.log("Well points layer force removed from map");
    }
  };

  // Updated enableWellAddMode function in drain mode MapContext.tsx
  const enableWellAddMode = (columns: string[], onWellAdd: (wellData: WellData, coordinates: [number, number]) => void) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot enable well add mode: map not initialized");
      return;
    }

    console.log("Enabling well add mode with columns:", columns);
    setIsWellAddModeActive(true);
    setWellAddCallback(() => onWellAdd);
    setAvailableColumns(columns);

    if (clickListenerRef.current) {
      mapInstanceRef.current.un('singleclick', clickListenerRef.current);
    }

    const clickListener = (event: any) => {
      if (popupVisible) {
        console.log("Popup already visible, ignoring click");
        return;
      }

      console.log("Map clicked, opening popup with all available columns");

      event.preventDefault();
      event.stopPropagation();

      const coordinate = event.coordinate;
      const lonLat = toLonLat(coordinate);

      console.log("Map clicked at:", lonLat);

      // Initialize form data with ALL available columns
      const initialData: WellData = {};

      // Initialize all columns with empty values first
      columns.forEach(column => {
        initialData[column] = '';
      });

      // Then set the coordinate values
      initialData['LATITUDE'] = lonLat[1].toFixed(6);
      initialData['LONGITUDE'] = lonLat[0].toFixed(6);

      console.log("Setting form data with all columns:", initialData);
      console.log("Total columns in popup:", Object.keys(initialData).length);

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

    console.log(`Well add mode enabled with ${columns.length} columns available in popup`);
  };

  const disableWellAddMode = () => {
    if (!mapInstanceRef.current) return;

    console.log("Disabling well add mode");
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

    console.log("Well add mode disabled successfully");
  };

  const handlePopupSubmit = () => {
    if (!wellAddCallback || !popupPosition) {
      console.warn("Cannot submit: missing callback or position");
      return;
    }

    console.log("Submitting well data:", formData);
    wellAddCallback(formData, popupPosition);

    setPopupVisible(false);
    setFormData({});
    setPopupPosition(null);

    console.log("Well data submitted successfully");
  };

  const handlePopupInputChange = (column: string, value: string) => {
    console.log(`Updating form field ${column} to:`, value);
    setFormData(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const handlePopupCancel = () => {
    console.log("Popup cancelled");
    setPopupVisible(false);
    setFormData({});
    setPopupPosition(null);
  };

  const PopupBackdrop = () => {
    if (!popupVisible) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={handlePopupCancel}
      />
    );
  };

  const toggleLabels = () => {
    setShowLabels(!showLabels);
    console.log(`Labels toggled to: ${!showLabels}`);
  };

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

      // NEW: Apply opacity
      applyLayerOpacity(newBaseLayer, 'basemap');

      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      setSelectedBaseMap(baseMapKey);

      console.log(`Changed basemap to: ${baseMapKey}`);
    } catch (error) {
      console.log("Error changing basemap:", error);
    }
  };

  // NEW: Effect to apply opacity changes to existing layers
  useEffect(() => {
    // Apply opacity changes to basemap
    if (baseLayerRef.current) {
      applyLayerOpacity(baseLayerRef.current, 'basemap');
    }

    // Apply to boundary layers
    [basinBoundaryLayerRef, riversLayerRef, stretchesLayerRef, drainsLayerRef, catchmentsLayerRef, villagesLayerRef].forEach(layerRef => {
      if (layerRef.current) {
        applyLayerOpacity(layerRef.current, 'boundaries');
      }
    });

    // Apply to other layers
    if (rasterLayerRef.current) {
      applyLayerOpacity(rasterLayerRef.current, 'raster');
    }
    if (contourLayerRef.current) {
      applyLayerOpacity(contourLayerRef.current, 'contour');
    }
    if (trendLayerRef.current) {
      applyLayerOpacity(trendLayerRef.current, 'trend');
    }
    if (gsrLayerRef.current) {
      applyLayerOpacity(gsrLayerRef.current, 'gsr');
    }
    if (wellPointsLayerRef.current) {
      applyLayerOpacity(wellPointsLayerRef.current, 'wellPoints');
    }
    if (villageOverlayLayerRef.current) {
      applyLayerOpacity(villageOverlayLayerRef.current, 'villageOverlay');
    }
  }, [layerOpacities]);

  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    isRasterDisplayed,
    isVillageOverlayVisible,
    isContourDisplayed,
    legendData,
    setMapContainer,
    changeBaseMap,
    addRasterLayer,
    removeRasterLayer,
    addContourLayer,
    removeContourLayer,
    zoomToCurrentExtent,
    getAllLayers,
    toggleVillageOverlay,
    isTrendDisplayed,
    addTrendLayer,
    removeTrendLayer,
    setLegendData,
    addWellPointsLayer,
    removeWellPointsLayer,
    enableWellAddMode,
    disableWellAddMode,
    isWellAddModeActive,
    forceRemoveWellPointsLayer,
    showLabels,
    toggleLabels,
    addGsrLayer,
    removeGsrLayer,
    isGsrDisplayed,
    // NEW: Opacity controls
    layerOpacities,
    setLayerOpacity,
    resetAllOpacities,
  };

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      trendLayerRef.current = null;
      wellPointsLayerRef.current = null;
      gsrLayerRef.current = null; // NEW
    };
  }, []);

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
      gsrLayerRef.current = null; // NEW
    };
  }, []);

  // Enhanced PopupForm component for drain mode MapContext.tsx - replace existing PopupForm



  return (
    <MapContext.Provider value={contextValue}>
      {children}
      <PopupBackdrop />
      <PopupForm
        visible={popupVisible}
        formData={formData}
        availableColumns={availableColumns}
        popupPosition={popupPosition}
        onInputChange={handlePopupInputChange}
        onSubmit={handlePopupSubmit}
        onCancel={handlePopupCancel}
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