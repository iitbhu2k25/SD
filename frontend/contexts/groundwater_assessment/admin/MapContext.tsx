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
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transformExtent, toLonLat } from "ol/proj";
import { Feature } from 'ol';
import { Geometry, Point } from 'ol/geom';
import { useLocation } from "@/contexts/groundwater_assessment/admin/LocationContext";
import { useWell, WellData } from "@/contexts/groundwater_assessment/admin/WellContext";

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
    classes: { label: string; color: string; count?: number }[];
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
  addRasterLayer: (layerName: string, geoserverUrl: string, colorScheme?: any) => void;
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
  layerOpacities: defaultOpacities,
  setMapContainer: () => { },
  changeBaseMap: () => { },
  addRasterLayer: () => { },
  removeRasterLayer: () => { },
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
  addGsrLayer: () => { },
  removeGsrLayer: () => { },
  isGsrDisplayed: false,
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
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Measurements */}
          {(dataColumns.length > 0 || rlColumn.length > 0) && (
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-2">
                Water Level Measurements (Optional)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {/* RL Inputs */}
                {rlColumn.map(column => (
                  <div key={column}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">RL</label>
                    <input
                      type="number"
                      value={formData[column] || ''}
                      onChange={e => onInputChange(column, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                ))}

                {/* Interleaved Pre/Post Inputs */}
                {(() => {
                  // Parse columns
                  const parsedColumns = dataColumns.map(col => {
                    const parts = col.split('_');
                    return {
                      key: col,
                      year: parseInt(parts[1], 10),
                      period: parts[0] === 'PRE' ? 'Pre-Monsoon' : 'Post-Monsoon',
                      order: parts[0] === 'PRE' ? 0 : 1
                    };
                  });

                  // Sort by year, then by period (Pre first)
                  const sortedColumns = parsedColumns.sort((a, b) => a.year - b.year || a.order - b.order);

                  // Render
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
                      />
                    </div>
                  ));
                })()}
              </div>
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
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const stateLayerRef = useRef<VectorLayer<any> | null>(null);
  const districtLayerRef = useRef<VectorLayer<any> | null>(null);
  const subdistrictLayerRef = useRef<VectorLayer<any> | null>(null);
  const villageOverlayLayerRef = useRef<VectorLayer<any> | null>(null);
  const basinWellLayerRef = useRef<VectorLayer<any> | null>(null);
  const rasterLayerRef = useRef<ImageLayer<any> | null>(null);
  const contourLayerRef = useRef<VectorLayer<any> | null>(null);
  const trendLayerRef = useRef<VectorLayer<any> | null>(null);
  const wellPointsLayerRef = useRef<VectorLayer<any> | null>(null);
  const gsrLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const [isRasterDisplayed, setIsRasterDisplayed] = useState<boolean>(false);
  const [isVillageOverlayVisible, setIsVillageOverlayVisible] = useState<boolean>(false);
  const [isContourDisplayed, setIsContourDisplayed] = useState<boolean>(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const [isTrendDisplayed, setIsTrendDisplayed] = useState<boolean>(false);
  const [isGsrDisplayed, setIsGsrDisplayed] = useState<boolean>(false);

  // NEW: Layer opacity state
  const [layerOpacities, setLayerOpacities] = useState<LayerOpacityState>(defaultOpacities);

  const { selectedState, selectedDistricts, selectedSubDistricts } = useLocation();

  const [isWellAddModeActive, setIsWellAddModeActive] = useState(false);
  const [wellAddCallback, setWellAddCallback] = useState<((wellData: WellData, coordinates: [number, number]) => void) | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const clickListenerRef = useRef<((event: any) => void) | null>(null);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<[number, number] | null>(null);
  const [formData, setFormData] = useState<WellData>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);

  // Add these variables near where you define boundaryLayerStyle, villageOverlayStyle, etc.

  const statePolygonStyle = new Style({
    fill: new Fill({ color: 'rgba(0, 188, 212, 0.15)' }),
    stroke: new Stroke({ color: '#00BCD4', width: 3 })     // Pink
  });

  const districtPolygonStyle = new Style({
    fill: new Fill({ color: 'rgba(255, 192, 4, 0.3)' }),  // Amber fill
    stroke: new Stroke({ color: '#FFC107', width: 3 })
  });

  const subdistrictPolygonStyle = new Style({
    fill: new Fill({ color: 'rgba(233, 30, 99, 0.30)' }),  // pink fill
    stroke: new Stroke({ color: '#E91E63', width: 2 })
  });

  const villagePolygonStyle = new Style({
    fill: new Fill({ color: 'rgba(233, 30, 99, 0.30)' }),  // Pink fill
    stroke: new Stroke({ color: '#e91ec4ff', width: 2 })
  });

  // NEW: Function to set layer opacity
  const setLayerOpacity = (layerType: keyof LayerOpacityState, opacity: number) => {
    // Clamp opacity between 1-10
    const clampedOpacity = Math.max(1, Math.min(10, opacity));

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
        [indiaLayerRef, stateLayerRef, districtLayerRef, subdistrictLayerRef].forEach(layerRef => {
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
    setLayerOpacities(defaultOpacities);

    // Apply default opacities to all layers
    Object.entries(defaultOpacities).forEach(([layerType, opacity]) => {
      setLayerOpacity(layerType as keyof LayerOpacityState, opacity);
    });

    console.log("Reset all layer opacities to default values");
  };

  // NEW: Apply opacity when layers are created/updated
  const applyLayerOpacity = (layer: any, layerType: keyof LayerOpacityState) => {
    if (layer && layerOpacities[layerType]) {
      const opacity = scaleToOpacity(layerOpacities[layerType]);
      layer.setOpacity(opacity);
    }
  };

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

  const boundaryLayerStyle = new Style({
    fill: new Fill({
      color: 'rgba(0, 0, 0, 0.01)', // Nearly transparent fill - KEY CHANGE!
    }),
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

  const basinWellStyle = new Style({
    image: new CircleStyle({
      radius: 4,
      fill: new Fill({
        color: "red",
      }),
    }),
  });

  // GSR layer functions (keeping existing functionality)
  const gsrFallbackColor = (classification: string): string => {
    const map: Record<string, string> = {
      'Over Exploited': 'darkred',
      'Critical': 'red',
      'Very Semi-Critical': 'orange',
      'Safe': 'green',
      'Very Safe': 'teal',
      'No Data': 'gold',
    };
    return map[classification] || 'gray';
  };

  const gsrColorFor = (props: any) => {
    const label = props.gsr_classification || props.classification || 'No Data';
    return props.classification_color || gsrFallbackColor(label) || '#000000';
  };

  const createGsrPolygonStyle = (feature: any) => {
    const props = feature.getProperties() || {};
    const base = gsrColorFor(props);

    return [
      new Style({
        fill: new Fill({ color: base }),
        stroke: new Stroke({ color: 'transparent', width: 0 }),
        zIndex: 1,
      }),
      new Style({
        stroke: new Stroke({ color: 'white ', width: 1 }),
        zIndex: 2,
      }),
    ];
  };

  const buildGsrLegend = (features: any[]) => {
    const counts: Record<string, { label: string; color: string; count: number }> = {};
    features.forEach((f: any) => {
      const props = f.getProperties() || {};
      const label = props.gsr_classification || 'No Data';
      const color = props.classification_color || gsrFallbackColor(label);
      const key = `${label}||${color}`;
      if (!counts[key]) counts[key] = { label, color, count: 0 };
      counts[key].count += 1;
    });
    return Object.values(counts);
  };

  const addGsrLayer = (geojson: any) => {
    if (!mapInstanceRef.current) {
      console.warn('Cannot add GSR layer: map not initialized');
      return;
    }
    try {
      if (gsrLayerRef.current) {
        mapInstanceRef.current.removeLayer(gsrLayerRef.current);
        gsrLayerRef.current = null;
      }

      if (!geojson || !geojson.features || geojson.features.length === 0) {
        console.warn('No GSR features to display');
        setIsGsrDisplayed(false);
        setLegendData(prev => ({ ...(prev || {}), gsr: undefined }));
        return;
      }

      const source = new VectorSource({
        features: new GeoJSON().readFeatures(geojson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }),
      });

      const gsrLayer = new VectorLayer({
        source,
        style: createGsrPolygonStyle,
        zIndex: 22,
        visible: true,
      });
      gsrLayer.set('name', 'gsr');
      gsrLayer.set('type', 'gsr');

      // NEW: Apply opacity
      applyLayerOpacity(gsrLayer, 'gsr');

      gsrLayerRef.current = gsrLayer;
      mapInstanceRef.current.addLayer(gsrLayer);
      setIsGsrDisplayed(true);

      const legendClasses = buildGsrLegend(source.getFeatures());
      setLegendData(prev => ({ ...(prev || {}), gsr: { classes: legendClasses } }));

      setTimeout(() => {
        const extent = source.getExtent();
        if (extent && mapInstanceRef.current) {
          mapInstanceRef.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      }, 300);

      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();
      console.log(`GSR layer added with ${geojson.features.length} features`);

      const handleGsrClick = (event: any) => {
        const feature = mapInstanceRef.current?.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
          if (layer === gsrLayer) {
            return feature;
          }
        });

        if (feature) {
          const properties = feature.getProperties();
          console.log('GSR feature clicked:', properties);
          showGsrPopup(feature, event.coordinate);
        }
      };

      mapInstanceRef.current.un('singleclick', handleGsrClick);
      mapInstanceRef.current.on('singleclick', handleGsrClick);

    } catch (e) {
      console.log('Error adding GSR layer:', e);
    }
  };

  const removeGsrLayer = () => {
    if (!mapInstanceRef.current) return;
    if (gsrLayerRef.current) {
      mapInstanceRef.current.removeLayer(gsrLayerRef.current);
      gsrLayerRef.current = null;
      setIsGsrDisplayed(false);
      setLegendData(prev => ({ ...(prev || {}), gsr: undefined }));

      if (popupOverlayRef.current) {
        popupOverlayRef.current.setPosition(undefined);
      }

      console.log('GSR layer removed successfully');
    }
  };

  const showGsrPopup = (feature: any, coordinate: number[]) => {
    if (!mapInstanceRef.current || !popupOverlayRef.current) return;

    const properties = feature.getProperties();

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

    const gsrClassification = properties.gsr_classification || properties.classification || 'No Data';
    const gsrValue = properties.gsr_value || properties.gsr || 'N/A';
    const categoryColor = properties.classification_color || gsrFallbackColor(gsrClassification);

    const trendStatus = properties.trend_status || properties.Trend_Status || properties.trend || 'N/A';
    const trendColor = properties.trend_color || getTrendColor(trendStatus);

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
        
        <div style="margin-bottom: 3px;"><b>Total Demand:</b> ${properties.total_demand ? (typeof properties.total_demand === 'number' ? properties.total_demand.toFixed(2) + 'M³/Year ' : properties.total_demand) : 'N/A'}</div>
        <div style="margin-bottom: 3px;"><b>Recharge:</b> ${properties.recharge ? (typeof properties.recharge === 'number' ? properties.recharge.toFixed(2) + ' M³/Year' : properties.recharge) : 'N/A'}</div>
        
        ${properties.district ? `<div style="margin-bottom: 3px;"><b>District:</b> ${properties.district}</div>` : ''}
        ${properties.block ? `<div style="margin-bottom: 3px;"><b>Block:</b> ${properties.block}</div>` : ''}
        ${properties.area ? `<div><b>Area:</b> ${properties.area} km²</div>` : ''}
      </div>
    `;

    const closeButton = popupContent.querySelector('#close-gsr-popup');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (popupOverlayRef.current) {
          popupOverlayRef.current.setPosition(undefined);
        }
      });
    }

    const popupElement = popupOverlayRef.current.getElement();
    if (popupElement) {
      popupElement.innerHTML = '';
      popupElement.appendChild(popupContent);
      popupElement.style.display = 'block';
    }

    popupOverlayRef.current.setPosition(coordinate);
  };

  const getTrendColor = (status: string): string => {
    const colorMapping: Record<string, string> = {
      'Increasing': '#FF6B6B',
      'Decreasing': '#4ECDC4',
      'No-Trend': '#95A5A6',
      'No Trend': '#95A5A6',
      'Insufficient Data': '#F39C12'
    };
    return colorMapping[status] || '#95A5A6';
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
      console.log(`Contour elevation range: ${minElevation} to ${maxElevation}`);

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
      contourLayer.set('parameter', options.parameter);
      contourLayer.set('interval', options.interval);
      contourLayer.set('statistics', options.statistics);

      // NEW: Apply opacity
      applyLayerOpacity(contourLayer, 'contour');

      contourLayerRef.current = contourLayer;
      mapInstanceRef.current.addLayer(contourLayer);
      setIsContourDisplayed(true);

      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

      console.log(`Contour layer successfully added with ${geoJsonData.features.length} features`);

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

  const createTrendStyle = (feature: any) => {
    const properties = feature.getProperties();
    const color = properties.color || '#808080';
    const size = properties.size || 8;

    return new Style({
      image: new CircleStyle({
        radius: size,
        fill: new Fill({
          color: color,
        }),
        stroke: new Stroke({
          color: '#FFFFFF',
          width: 2,
        }),
      }),
    });
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
          'Increasing': '#fc0808ff',
          'Decreasing': '#62D9D1',
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

      console.log(`Trend layer successfully added with ${geoJsonData.features.length} villages`);

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

      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

    } catch (error) {
      console.log("Error adding trend layer:", error);
    }
  };

  const showTrendPopup = (feature: any, coordinate: number[]) => {
    if (!mapInstanceRef.current || !popupOverlayRef.current) return;

    const properties = feature.getProperties();

    const popupContent = document.createElement('div');
    popupContent.style.cssText = `
    background: white;
    border: 2px solid #3B82F6;
    border-radius: 8px;
    padding: 8px;
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

    const closeButton = popupContent.querySelector('#close-popup');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        if (popupOverlayRef.current) {
          popupOverlayRef.current.setPosition(undefined);
        }
      });
    }

    const popupElement = popupOverlayRef.current.getElement();
    if (popupElement) {
      popupElement.innerHTML = '';
      popupElement.appendChild(popupContent);
      popupElement.style.display = 'block';
    }

    popupOverlayRef.current.setPosition(coordinate);
  };

  const getTrendIcon = (status: string): string => {
    const icons: Record<string, string> = {
      'Increasing': '⬆️',
      'Decreasing': '⬇️',
      'No-Trend': '➡️',
      'No Trend': '➡️',
      'Insufficient Data': '❓'
    };

    return icons[status] || '❓';
  };

  const getStatusDescription = (status: string): string => {
    const descriptions: Record<string, string> = {
      'Increasing': 'Groundwater level is declining over time (depth increasing)',
      'Decreasing': 'Groundwater level is rising over time (depth decreasing)',
      'No-Trend': 'No statistically significant trend detected in the time series',
      'No Trend': 'No statistically significant trend detected in the time series',
      'Insufficient Data': 'Not enough data points available for reliable trend analysis'
    };

    return descriptions[status] || 'Trend analysis result for this village';
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

  // Initialize map when container is set
  useEffect(() => {
    if (!mapContainer || mapInstanceRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });

    const indiaLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:India&outputFormat=application/json",
      }),
      style: boundaryLayerStyle,
      zIndex: 1,
    });

    initialBaseLayer.set('name', 'basemap');
    indiaLayer.set('name', 'india');

    // NEW: Apply initial opacities
    applyLayerOpacity(initialBaseLayer, 'basemap');
    applyLayerOpacity(indiaLayer, 'boundaries');

    baseLayerRef.current = initialBaseLayer;
    indiaLayerRef.current = indiaLayer;

    const map = new Map({
      target: mapContainer,
      layers: [initialBaseLayer, indiaLayer],
      view: new View({
        center: fromLonLat([78.9629, 20.5937]),
        zoom: 4,
      }),
    });

    mapInstanceRef.current = map;
    console.log("Map initialized with India WFS layer");

    indiaLayer.getSource()?.on("featuresloaderror", (event: any) => {
      console.log("Error loading India WFS layer:", event);
    });
    indiaLayer.getSource()?.on("featuresloadend", () => {
      console.log("India WFS layer loaded successfully");
    });

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

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Create hover overlay element
    const hoverElement = document.createElement('div');
    hoverElement.className = 'ol-hover-popup';
    hoverElement.style.cssText = `
    background: rgba(255, 255, 255, 1);
    border: 2px solid #3B82F6;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    color: #1F2937;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    pointer-events: none;
    white-space: nowrap;
    max-width: 300px;
    z-index: 1000;
  `;

    // Create hover overlay
    const hoverOverlay = new Overlay({
      element: hoverElement,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -10],
    });

    mapInstanceRef.current.addOverlay(hoverOverlay);
    hoverOverlayRef.current = hoverOverlay;

    // Create a highlight layer for the hovered feature
    const highlightStyle = new Style({
      fill: new Fill({
        color: 'rgba(59, 130, 246, 0.2)', // Light blue fill
      }),
      stroke: new Stroke({
        color: '#fffb00ff', // Gold border
        width: 3,
      }),
    });

    const highlightLayer = new VectorLayer({
      source: new VectorSource(),
      style: highlightStyle,
      zIndex: 999, // High z-index to appear on top
    });

    highlightLayer.set('name', 'highlight-layer');
    mapInstanceRef.current.addLayer(highlightLayer);
    highlightLayerRef.current = highlightLayer;

    // Handle pointer move for hover
    const handlePointerMove = (event: any) => {
      if (!mapInstanceRef.current || !highlightLayerRef.current) return;

      const pixel = event.pixel;
      let foundFeature = false;
      const highlightSource = highlightLayerRef.current.getSource();

      // Clear previous highlight
      if (highlightSource) {
        highlightSource.clear();
      }

      // Check for features at pixel - use hitTolerance for better detection
      mapInstanceRef.current.forEachFeatureAtPixel(
        pixel,
        (feature, layer) => {
          const layerName = layer?.get('name');
          const layerType = layer?.get('type');

          // Skip highlight layer itself
          if (layerName === 'highlight-layer') {
            return false;
          }

          const properties = feature.getProperties();
          let label = '';
          let isWellPoint = false;

          // Determine label based on layer name
          switch (layerName) {
            case 'india':
              label = properties.STATE || properties.State || properties.state;
              break;

            case 'state':
              label = properties.DISTRICT || properties.District || properties.district;
              break;

            case 'district':
              label = properties.SUB_DISTRI || properties.Sub_Distri || properties.subdistrict || properties.subdistric;
              break;

            case 'villages':
              label = properties.village || properties.Village || properties.VILLAGE;
              break;

            case 'village-overlay':
              label = properties.village || properties.Village || properties.VILLAGE;
              break;

            case 'manual-wells':
              // Well points - show label but no polygon highlight
              isWellPoint = true;
              label = properties.hydrographCode || properties.HYDROGRAPH || properties.hydrograph || 'Well';
              // Add additional info if available
              if (properties.block || properties.BLOCK) {
                label += ` (${properties.block || properties.BLOCK})`;
              }
              break;

            case 'gsr':
              const classification = properties.gsr_classification || properties.classification || 'N/A';
              const villageName = properties.Village_Name || properties.village_name || '';
              label = villageName ? `${villageName} (${classification})` : classification;
              break;

            case 'trend-villages':
              const trendVillage = properties.Village_Name || properties.village_name || '';
              const trendStatus = properties.Trend_Status || properties.trend || '';
              label = trendVillage ? `${trendVillage} (${trendStatus})` : trendStatus;
              break;

            default:
              label = properties.Village_Name ||
                properties.village_name ||
                properties.village ||
                properties.Village ||
                properties.name ||
                properties.NAME ||
                properties.gsr_classification ||
                properties.Trend_Status ||
                properties.HYDROGRAPH ||
                properties.hydrographCode ||
                properties.DISTRICT ||
                properties.SUB_DISTRI;
          }

          if (label && hoverOverlay) {
            // Only highlight if it's NOT a well point
            if (!isWellPoint && highlightSource) {
              if (feature instanceof Feature) {
                const clonedFeature = feature.clone() as Feature<Geometry>;
                clonedFeature.setId(feature.getId());
                highlightSource.addFeature(clonedFeature);
              }
            }

            // Show label for both polygons and well points
            hoverElement.textContent = label;
            hoverOverlay.setPosition(event.coordinate);
            foundFeature = true;
            setHoveredFeature(feature);

            const target = mapInstanceRef.current?.getTargetElement();
            if (target && !isWellAddModeActive) {
              target.style.cursor = "pointer";
            }

            return true;
          }
          return false;
        },
        {
          // Enable layer filter and hit tolerance
          layerFilter: (layer) => {
            const layerName = layer.get('name');
            // Check all layers including well points
            return layerName !== 'highlight-layer';
          },
          hitTolerance: 5 // Pixels of tolerance around features
        }
      );

      // Hide overlay and clear highlight if no feature found
      if (!foundFeature) {
        if (hoverOverlay) {
          hoverOverlay.setPosition(undefined);
        }
        if (highlightSource) {
          highlightSource.clear();
        }
        setHoveredFeature(null);

        // Reset cursor
        const target = mapInstanceRef.current?.getTargetElement();
        if (target && !isWellAddModeActive) {
          target.style.cursor = '';
        }
      }
    };

    mapInstanceRef.current.on('pointermove', handlePointerMove);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.un('pointermove', handlePointerMove);

        // Remove highlight layer
        if (highlightLayerRef.current) {
          mapInstanceRef.current.removeLayer(highlightLayerRef.current);
          highlightLayerRef.current = null;
        }
      }
    };
  }, [mapInstanceRef.current, isWellAddModeActive]);

  const createWFSLayer = (
    layerName: string,
    cqlFilter: string,
    zIndex: number,
    isBasinWell: boolean = false,
    isVillageOverlay: boolean = false
  ): VectorLayer<any> => {
    console.log(`Creating WFS layer: ${layerName} with filter: ${cqlFilter}`);

    let style = boundaryLayerStyle; // default fallback

    // Assign correct style for each administrative boundary
    if (layerName === "B_district") {
      style = statePolygonStyle;  // State level (shows districts within state)
    } else if (layerName === "B_subdistrict") {
      style = districtPolygonStyle;  // District level (shows subdistricts within district)
    } else if (layerName === "Village" && !isVillageOverlay) {
      style = subdistrictPolygonStyle;  // Subdistrict/Village level
    } else if (isVillageOverlay) {
      style = villageOverlayStyle;  // Village overlay on raster
    }

    // else if (/* add subdistrict condition if your code needs it */) style = subdistrictPolygonStyle;

    const layer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
      }),
      style: style,
      zIndex: zIndex,
      visible: isVillageOverlay ? isVillageOverlayVisible : true,
    });



    // NEW: Apply opacity based on layer type
    if (isVillageOverlay) {
      applyLayerOpacity(layer, 'villageOverlay');
    } else {
      applyLayerOpacity(layer, 'boundaries');
    }

    if (isBasinWell) {
      layer.set('name', 'wells');
    } else if (isVillageOverlay) {
      layer.set('name', 'village-overlay');
    } else if (layerName === 'Village') {
      layer.set('name', 'villages');
    } else if (layerName === 'B_district') {
      layer.set('name', 'state');
    } else if (layerName === 'B_subdistrict') {
      layer.set('name', 'district');
    }

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

  const getAllLayers = () => {
    if (!mapInstanceRef.current) return [];
    return mapInstanceRef.current.getAllLayers();
  };

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

  const zoomToCurrentExtent = () => {
    if (!mapInstanceRef.current) return;

    let targetLayer = null;

    if (contourLayerRef.current && isContourDisplayed) {
      targetLayer = contourLayerRef.current;
    } else if (gsrLayerRef.current && isGsrDisplayed) {
      targetLayer = gsrLayerRef.current;
    } else if (villageOverlayLayerRef.current && isRasterDisplayed && isVillageOverlayVisible) {
      targetLayer = villageOverlayLayerRef.current;
    } else if (subdistrictLayerRef.current) {
      targetLayer = subdistrictLayerRef.current;
    } else if (districtLayerRef.current) {
      targetLayer = districtLayerRef.current;
    } else if (stateLayerRef.current) {
      targetLayer = stateLayerRef.current;
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
        } else {
          if (selectedSubDistricts.length > 0) {
            zoomToFeature("Village", `SUBDIS_COD IN (${selectedSubDistricts.map(code => `'${code}'`).join(',')})`);
          } else if (selectedDistricts.length > 0) {
            zoomToFeature("B_district", `DISTRICT_C IN (${selectedDistricts.map(code => `'${code}'`).join(',')})`);
          } else if (selectedState) {
            const formattedStateCode = selectedState.toString().padStart(2, "0");
            zoomToFeature("B_district", `STATE_CODE = '${formattedStateCode}'`);
          }
        }
      }
    }
  };

  const manageVillageLayerVisibility = () => {
    if (!mapInstanceRef.current) return;

    if (isRasterDisplayed) {
      if (subdistrictLayerRef.current) {
        mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
        subdistrictLayerRef.current = null;
        console.log("Removed main village layer due to raster display");
      }

      if (selectedSubDistricts.length > 0 && !villageOverlayLayerRef.current) {
        const subdistrictCodes = selectedSubDistricts.map((code) => `'${code}'`).join(",");
        const cqlFilter = `SUBDIS_COD IN (${subdistrictCodes})`;

        console.log("Creating lightweight village overlay for raster view");
        const villageOverlay = createWFSLayer("Village", cqlFilter, 20, false, true);

        villageOverlayLayerRef.current = villageOverlay;
        mapInstanceRef.current.addLayer(villageOverlay);
        console.log("Added lightweight village overlay on top of raster");
      }
    } else {
      if (villageOverlayLayerRef.current) {
        mapInstanceRef.current.removeLayer(villageOverlayLayerRef.current);
        villageOverlayLayerRef.current = null;
        setIsVillageOverlayVisible(true);
        console.log("Removed lightweight village overlay");
      }

      if (selectedSubDistricts.length > 0 && !subdistrictLayerRef.current) {
        const subdistrictCodes = selectedSubDistricts.map((code) => `'${code}'`).join(",");
        const cqlFilter = `SUBDIS_COD IN (${subdistrictCodes})`;

        console.log("Recreating main village layer");
        const subdistrictLayer = createWFSLayer("Village", cqlFilter, 4);
        subdistrictLayerRef.current = subdistrictLayer;
        mapInstanceRef.current.addLayer(subdistrictLayer);

        subdistrictLayer.getSource()?.on("featuresloaderror", (event: any) => {
          console.log("Subdistrict layer loading error:", event);
        });
        subdistrictLayer.getSource()?.on("featuresloadend", () => {
          console.log("Subdistrict layer loaded successfully");
          setTimeout(() => {
            zoomToFeature("Village", cqlFilter);
          }, 500);
        });
      }
    }
  };

  const addRasterLayer = (layerName: string, geoserverUrl: string, colorScheme?: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add raster layer: map not initialized");
      return;
    }

    console.log(`Adding colored raster layer: ${layerName} from ${geoserverUrl}`);

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
        url: geoserverUrl,
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
        addSingleBandRasterLayer(layerName, geoserverUrl);
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

      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

      console.log(`Colored raster layer successfully added: ${coloredLayerName}`);

    } catch (error) {
      console.log("Error in addRasterLayer:", error);
      addSingleBandRasterLayer(layerName, geoserverUrl);
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
        console.log('Failed image URL:', event.image?.src);
      });

      imageWmsSource.on('imageloadstart', () => {
        console.log(`Starting to load single-band raster image for ${layerName}`);
      });

      imageWmsSource.on('imageloadend', () => {
        console.log(`Single-band raster image loaded successfully for ${layerName}`);
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

      mapInstanceRef.current.render();
      mapInstanceRef.current.getView().changed();

      console.log(`Single-band raster layer successfully added: ${layerName}`);

    } catch (error) {
      console.log("Error in addSingleBandRasterLayer:", error);
    }
  };

  useEffect(() => {
    manageVillageLayerVisibility();
  }, [isRasterDisplayed, selectedSubDistricts]);

  useEffect(() => {
    if (villageOverlayLayerRef.current) {
      villageOverlayLayerRef.current.setVisible(isVillageOverlayVisible);
      console.log(`Village overlay visibility updated to: ${isVillageOverlayVisible}`);
    }
  }, [isVillageOverlayVisible]);

  // Effect to apply opacity changes to existing layers
  useEffect(() => {
    // Apply opacity changes to basemap
    if (baseLayerRef.current) {
      applyLayerOpacity(baseLayerRef.current, 'basemap');
    }

    // Apply to boundary layers
    [indiaLayerRef, stateLayerRef, districtLayerRef, subdistrictLayerRef].forEach(layerRef => {
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

  const zoomToFeature = async (layerName: string, cqlFilter: string) => {
    if (!mapInstanceRef.current) return;

    try {
      console.log(`Attempting to zoom to ${layerName} with filter: ${cqlFilter}`);

      const wfsUrl = `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;

      const response = await fetch(wfsUrl);
      if (!response.ok) {
        throw new Error(`WFS request failed for ${layerName}: ${response.status}`);
      }

      const data = await response.json();
      console.log(`WFS response for ${layerName}:`, data);

      if (data.features && data.features.length > 0) {
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let validCoords = false;

        console.log(`First feature geometry:`, data.features[0]?.geometry);
        console.log(`Sample features (first 3):`, data.features.slice(0, 3).map((f: { geometry: any; }) => f.geometry));

        data.features.forEach((feature: any, index: number) => {
          if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates;
            const geometryType = feature.geometry.type.toLowerCase();

            if (index < 3) {
              console.log(`Feature ${index} - Type: ${geometryType}, Coords structure:`, coords);
            }

            const extractCoordinates = (coordArray: any): number[][] => {
              const allCoords: number[][] = [];

              const flatten = (arr: any, depth: number = 0): void => {
                if (!Array.isArray(arr)) return;

                if (arr.length >= 2 &&
                  typeof arr[0] === 'number' &&
                  typeof arr[1] === 'number') {
                  allCoords.push([arr[0], arr[1]]);
                  return;
                }

                arr.forEach(item => {
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
              console.log(`Feature ${index} extracted coordinates (first 5):`, coordinates.slice(0, 5));
            }

            coordinates.forEach(([x, y]) => {
              if (typeof x === 'number' && typeof y === 'number' &&
                x >= -180 && x <= 180 && y >= -90 && y <= 90 &&
                !isNaN(x) && !isNaN(y)) {

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
          console.log(`Calculated bounds for ${layerName}: [${minX}, ${minY}, ${maxX}, ${maxY}]`);
          console.log("Bounding box raw coords:", [minX, minY, maxX, maxY]);

          const padding = 0.01;
          const paddedExtent = [
            minX - padding,
            minY - padding,
            maxX + padding,
            maxY + padding
          ];

          const extent = transformExtent(
            paddedExtent,
            "EPSG:4326",
            "EPSG:3857"
          );

          const view = mapInstanceRef.current.getView();
          view.fit(extent, {
            padding: [50, 50, 50, 50],
            maxZoom: layerName === "Village" ? 14 : layerName === "B_district" ? 10 : 8,
            duration: 1000,
          });

          console.log(`Successfully zoomed to ${layerName}`);
        } else {
          console.warn(`No valid coordinates found for ${layerName}`);
          console.log(`Debug info - minX: ${minX}, maxX: ${maxX}, minY: ${minY}, maxY: ${maxY}, validCoords: ${validCoords}`);

          if (layerName === "Village" && subdistrictLayerRef.current) {
            const source = subdistrictLayerRef.current.getSource();
            if (source && typeof source.getExtent === 'function') {
              const layerExtent = source.getExtent();
              if (layerExtent && layerExtent.some((val: number) => val !== Infinity && val !== -Infinity)) {
                console.log('Using layer extent as fallback:', layerExtent);
                const view = mapInstanceRef.current.getView();
                view.fit(layerExtent, {
                  padding: [50, 50, 50, 50],
                  maxZoom: 14,
                  duration: 1000,
                });
              }
            }
          }
        }
      } else {
        console.warn(`No features found for ${layerName} with filter: ${cqlFilter}`);
      }
    } catch (error) {
      console.log(`Error zooming to ${layerName}:`, error);
    }
  };


  // Update state layer
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedState) {
      if (stateLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(stateLayerRef.current);
        stateLayerRef.current = null;
      }
      // Add back India layer when no state is selected
      if (indiaLayerRef.current && mapInstanceRef.current) {
        if (!mapInstanceRef.current.getAllLayers().includes(indiaLayerRef.current)) {
          mapInstanceRef.current.addLayer(indiaLayerRef.current);
          console.log("India layer added back");
        }
      }
      return;
    }

    // Remove India layer when state is selected
    if (indiaLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(indiaLayerRef.current);
      console.log("India layer removed - state selected");
    }

    if (stateLayerRef.current) {
      mapInstanceRef.current.removeLayer(stateLayerRef.current);
    }

    const formattedStateCode = selectedState.toString().padStart(2, "0");
    const cqlFilter = `STATE_CODE = '${formattedStateCode}'`;
    const stateLayer = createWFSLayer("B_district", cqlFilter, 2);

    stateLayerRef.current = stateLayer;
    mapInstanceRef.current.addLayer(stateLayer);

    zoomToFeature("B_district", cqlFilter);

    console.log("Added state layer with filter:", cqlFilter);
  }, [selectedState]);

  // Update district layer
  useEffect(() => {
    if (!mapInstanceRef.current || selectedDistricts.length === 0) {
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

    try {
      const districtCodes = selectedDistricts.map((code) => `'${code}'`).join(",");
      const cqlFilter = `DISTRICT_C IN (${districtCodes})`;
      const districtLayer = createWFSLayer("B_subdistrict", cqlFilter, 3);

      districtLayerRef.current = districtLayer;
      mapInstanceRef.current.addLayer(districtLayer);

      zoomToFeature("B_district", cqlFilter);

      console.log("Added district layer with filter:", cqlFilter);
    } catch (error) {
      console.log("Error creating district layer:", error);
    }
  }, [selectedDistricts]);

  // Update subdistrict and basin well layers
  useEffect(() => {
    if (!mapInstanceRef.current || selectedSubDistricts.length === 0) {
      if (subdistrictLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
        subdistrictLayerRef.current = null;
      }
      if (basinWellLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(basinWellLayerRef.current);
        basinWellLayerRef.current = null;
      }
      if (villageOverlayLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(villageOverlayLayerRef.current);
        villageOverlayLayerRef.current = null;
        setIsVillageOverlayVisible(true);
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

    if (basinWellLayerRef.current) {
      mapInstanceRef.current.removeLayer(basinWellLayerRef.current);
    }

    try {
      const subdistrictCodes = selectedSubDistricts.map((code) => `'${code}'`).join(",");
      const cqlFilter = `SUBDIS_COD IN (${subdistrictCodes})`;

      console.log("Creating subdistrict layer with filter:", cqlFilter);

      const subdistrictLayer = createWFSLayer("Village", cqlFilter, 4);

      subdistrictLayer.getSource()?.on("featuresloaderror", (event: any) => {
        console.log("Subdistrict layer loading error:", event);
      });
      subdistrictLayer.getSource()?.on("featuresloadend", () => {
        console.log("Subdistrict layer loaded successfully");
        setTimeout(() => {
          zoomToFeature("Village", cqlFilter);
        }, 500);
      });

      subdistrictLayerRef.current = subdistrictLayer;
      mapInstanceRef.current.addLayer(subdistrictLayer);

      manageVillageLayerVisibility();
    } catch (error) {
      console.log("Error creating subdistrict or basin well layer:", error);
    }
  }, [selectedSubDistricts]);

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

      mapInstanceRef.current.render();

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

  // Updated enableWellAddMode function in MapContext.tsx

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

      // NEW: Apply opacity to new basemap
      applyLayerOpacity(newBaseLayer, 'basemap');

      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      setSelectedBaseMap(baseMapKey);

      console.log(`Changed basemap to: ${baseMapKey}`);
    } catch (error) {
      console.log("Error changing basemap:", error);
    }
  };

  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    isRasterDisplayed,
    isVillageOverlayVisible,
    isContourDisplayed,
    isTrendDisplayed,
    legendData,
    // NEW: Opacity controls
    layerOpacities,
    setMapContainer,
    changeBaseMap,
    addRasterLayer,
    removeRasterLayer,
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
    addGsrLayer,
    removeGsrLayer,
    isGsrDisplayed,
    // NEW: Opacity control functions
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
      gsrLayerRef.current = null;
    };
  }, []);

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
      basinWellLayerRef.current = null;
      rasterLayerRef.current = null;
      contourLayerRef.current = null;
      gsrLayerRef.current = null;
    };
  }, []);

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