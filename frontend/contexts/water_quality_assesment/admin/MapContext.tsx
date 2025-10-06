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
import { Point } from 'ol/geom';
import { useLocation } from "@/contexts/water_quality_assesment/admin/LocationContext";
import { useWell, WellData } from "@/contexts/water_quality_assesment/admin/WellContext";

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
  };
}

interface WellPoint {
  id: number;
  latitude: number;
  longitude: number;
  locationCode: string;
  subDistrict: string;
  properties: any;
}

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

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  isRasterDisplayed: boolean;
  isContourDisplayed: boolean;
  isVillageOverlayVisible: boolean;
  legendData: LegendData | null;
  availableRasters: AvailableRaster[];
  selectedRaster: AvailableRaster | null;
  setMapContainer: (container: HTMLDivElement | null) => void;
  changeBaseMap: (baseMapKey: string) => void;
  addRasterLayer: (layerName: string, geoserverUrl: string, colorScheme?: any) => void;
  addMultipleRasterLayers: (layerMetadata: AvailableRaster[], geoserverUrl: string, colorScheme?: any) => void;
  switchToRaster: (raster: AvailableRaster) => void;
  removeRasterLayer: () => void;
  removeAllRasterLayers: () => void;
  zoomToCurrentExtent: () => void;
  getAllLayers: () => any[];
  toggleVillageOverlay: () => void;
  addWellPointsLayer: (wellPoints: WellPoint[]) => void;
  removeWellPointsLayer: () => void;
  forceRemoveWellPointsLayer: () => void;
  enableWellAddMode: (columns: string[], onWellAdd: (wellData: WellData, coordinates: [number, number]) => void) => void;
  disableWellAddMode: () => void;
  isWellAddModeActive: boolean;
  setLegendData: React.Dispatch<React.SetStateAction<LegendData | null>>;
  addContourLayer: (layerName: string, geoserverUrl: string, contourData?: any) => void;
  removeContourLayer: () => void;
  getSelectedAreaBounds: () => [number, number, number, number] | null;
}

interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "osm",
  isRasterDisplayed: false,
  isContourDisplayed: false,
  isVillageOverlayVisible: false,
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
  zoomToCurrentExtent: () => { },
  getAllLayers: () => [],
  toggleVillageOverlay: () => { },
  setLegendData: () => { },
  addWellPointsLayer: () => { },
  removeWellPointsLayer: () => { },
  enableWellAddMode: () => { },
  disableWellAddMode: () => { },
  isWellAddModeActive: false,
  forceRemoveWellPointsLayer: () => { },
  addContourLayer: () => { },
  removeContourLayer: () => { },
  getSelectedAreaBounds: () => null,
});

// PopupForm component
const PopupForm = React.memo<{
  visible: boolean;
  position: [number, number] | null;
  columns: string[];
  formData: WellData;
  onSubmit: () => void;
  onCancel: () => void;
  onInputChange: (column: string, value: string) => void;
  selectedRegionBounds: [number, number, number, number] | null;
}>(({ visible, position, columns, formData, onSubmit, onCancel, onInputChange, selectedRegionBounds }) => {
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
          width: '550px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '24px',
          borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                Add Well from Map
              </h3>
            </div>
            <button onClick={onCancel} style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: 'white',
              cursor: 'pointer'
            }}>×</button>
          </div>
        </div>

        {/* Location Info */}
        {position && (
          <div style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderBottom: '2px solid #93c5fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <svg style={{ width: '20px', height: '20px', color: '#1e40af' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <strong style={{ color: '#1e40af', fontSize: '14px' }}>Selected Location:</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingLeft: '28px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Latitude:</span>
                <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '700', fontFamily: 'monospace' }}>
                  {position[1].toFixed(6)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Longitude:</span>
                <div style={{ fontSize: '14px', color: '#1e40af', fontWeight: '700', fontFamily: 'monospace' }}>
                  {position[0].toFixed(6)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Valid Region Info */}
        {selectedRegionBounds && (
          <div style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            borderBottom: '2px solid #7dd3fc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <svg style={{ width: '18px', height: '18px', color: '#0369a1' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <strong style={{ color: '#0369a1', fontSize: '13px' }}>Valid Region:</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#075985', paddingLeft: '26px', fontFamily: 'monospace' }}>
              Lat: {selectedRegionBounds[1].toFixed(4)}° to {selectedRegionBounds[3].toFixed(4)}°<br/>
              Lon: {selectedRegionBounds[0].toFixed(4)}° to {selectedRegionBounds[2].toFixed(4)}°
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {columns.map((column, index) => (
              <div key={`${column}-${index}`}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  {column}
                </label>
                <input
                  type="text"
                  value={formData[column] || ''}
                  onChange={(e) => onInputChange(column, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  placeholder={`Enter ${column}`}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{
          padding: '20px 24px',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <button onClick={onSubmit} style={{
            flex: 1,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '14px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            Add Well to Table
          </button>
          <button onClick={onCancel} style={{
            flex: 1,
            backgroundColor: '#6b7280',
            color: 'white',
            padding: '14px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Cancel
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#fef3c7',
          borderTop: '1px solid #fde68a',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontWeight: '500' }}>
            Latitude and Longitude are automatically captured from your map click
          </p>
        </div>
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
  const rasterLayerRef = useRef<ImageLayer<any> | null>(null);
  const contourLayerRef = useRef<VectorLayer<any> | null>(null);
  const wellPointsLayerRef = useRef<VectorLayer<any> | null>(null);
  
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const [isRasterDisplayed, setIsRasterDisplayed] = useState<boolean>(false);
  const [isContourDisplayed, setIsContourDisplayed] = useState<boolean>(false);
  const [isVillageOverlayVisible, setIsVillageOverlayVisible] = useState<boolean>(false);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  
  const [availableRasters, setAvailableRasters] = useState<AvailableRaster[]>([]);
  const [selectedRaster, setSelectedRaster] = useState<AvailableRaster | null>(null);
  
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

  const createWFSLayer = (
    layerName: string,
    cqlFilter: string,
    zIndex: number,
    isVillageOverlay: boolean = false
  ): VectorLayer<any> => {
    console.log(`Creating WFS layer: ${layerName} with filter: ${cqlFilter}`);

    let style = boundaryLayerStyle;
    if (isVillageOverlay) {
      style = villageOverlayStyle;
    }

    const layer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
      }),
      style: style,
      zIndex,
      visible: isVillageOverlay ? isVillageOverlayVisible : true,
    });

    if (isVillageOverlay) {
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

    if (villageOverlayLayerRef.current && isRasterDisplayed && isVillageOverlayVisible) {
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

  const getSelectedAreaBounds = (): [number, number, number, number] | null => {
    if (!mapInstanceRef.current) return null;
    
    let targetLayer = null;
    
    // Priority: villages > districts > state
    if (subdistrictLayerRef.current) {
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
          // Convert from EPSG:3857 to EPSG:4326 (lat/lon)
          const [minX, minY, maxX, maxY] = extent;
          const minLonLat = toLonLat([minX, minY]);
          const maxLonLat = toLonLat([maxX, maxY]);
          
          console.log('[BOUNDS] Calculated region bounds:', {
            minLon: minLonLat[0],
            minLat: minLonLat[1],
            maxLon: maxLonLat[0],
            maxLat: maxLonLat[1]
          });
          
          return [minLonLat[0], minLonLat[1], maxLonLat[0], maxLonLat[1]];
        }
      }
    }
    
    console.log('[BOUNDS] No bounds available');
    return null;
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
        const villageOverlay = createWFSLayer("Village", cqlFilter, 20, true);

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

      const geoserverUrl = "/geoserver/api/myworkspace/wms";
      
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

  const addRasterLayer = (layerName: string, geoserverUrl: string, colorScheme?: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add raster layer: map not initialized");
      return;
    }

    console.log(`Adding single raster layer: ${layerName} from ${geoserverUrl}`);

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
            parameter_name: colorScheme.parameter_name || colorScheme.parameter,
            unit: colorScheme.unit || '',
            classes: colorScheme.classes,
            type: colorScheme.type || 'gwqi'
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
        opacity: 0.85,
        visible: true,
      });

      rasterLayer.set('name', 'raster');
      rasterLayer.set('type', 'raster');

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

  const addContourLayer = (layerName: string, geoserverUrl: string, contourData?: any) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot add contour layer: map not initialized");
      return;
    }

    console.log(`Adding contour layer: ${layerName}`);

    try {
      if (contourLayerRef.current) {
        mapInstanceRef.current.removeLayer(contourLayerRef.current);
        contourLayerRef.current = null;
      }

      const contourLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `${geoserverUrl}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json`,
        }),
        style: new Style({
          stroke: new Stroke({
            color: '#ff6600',
            width: 2,
          }),
        }),
        zIndex: 25,
        visible: true,
      });

      contourLayer.set('name', 'contours');
      contourLayer.set('type', 'contour');

      contourLayerRef.current = contourLayer;
      mapInstanceRef.current.addLayer(contourLayer);
      setIsContourDisplayed(true);

      if (contourData) {
        setLegendData((prev) => ({
          ...prev,
          contour: contourData,
        }));
      }

      console.log(`Contour layer successfully added: ${layerName}`);

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

  useEffect(() => {
    manageVillageLayerVisibility();
  }, [isRasterDisplayed, selectedSubDistricts]);

  useEffect(() => {
    if (villageOverlayLayerRef.current) {
      villageOverlayLayerRef.current.setVisible(isVillageOverlayVisible);
      console.log(`Village overlay visibility updated to: ${isVillageOverlayVisible}`);
    }
  }, [isVillageOverlayVisible]);

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

        data.features.forEach((feature: any, index: number) => {
          if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates;
            const geometryType = feature.geometry.type.toLowerCase();

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
        }
      } else {
        console.warn(`No features found for ${layerName} with filter: ${cqlFilter}`);
      }
    } catch (error) {
     console.log(`Error zooming to ${layerName}:`, error);
    }
  };

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedState) {
      if (stateLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(stateLayerRef.current);
        stateLayerRef.current = null;
      }
      return;
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

  useEffect(() => {
    if (!mapInstanceRef.current || selectedSubDistricts.length === 0) {
      if (subdistrictLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(subdistrictLayerRef.current);
        subdistrictLayerRef.current = null;
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
     console.log("Error creating subdistrict layer:", error);
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
          locationCode: wellPoint.locationCode,
          subDistrict: wellPoint.subDistrict,
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

  const enableWellAddMode = (columns: string[], onWellAdd: (wellData: WellData, coordinates: [number, number]) => void) => {
    if (!mapInstanceRef.current) {
      console.warn("Cannot enable well add mode: map not initialized");
      return;
    }

    console.log("Enabling well add mode with columns:", columns);
    setIsWellAddModeActive(true);
    setWellAddCallback(() => onWellAdd);
    
    const editableColumns = columns.filter(col => 
      col !== 'Latitude' && col !== 'Longitude' && col !== 'YEAR'
    );
    setAvailableColumns(editableColumns);

    if (clickListenerRef.current) {
      mapInstanceRef.current.un('singleclick', clickListenerRef.current);
    }

    const clickListener = (event: any) => {
      if (popupVisible) {
        console.log("Popup already visible, ignoring click");
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
          console.log('[VALIDATION] Click outside selected region:', {
            clickLon: clickLon.toFixed(6),
            clickLat: clickLat.toFixed(6),
            bounds: { minLon, minLat, maxLon, maxLat }
          });
          return;
        }
      }

      console.log("Map clicked at:", lonLat);

      const initialData: WellData = {};
      editableColumns.forEach(col => {
        initialData[col] = '';
      });

      console.log("Setting form data for editable columns:", initialData);
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

    console.log("Well add mode enabled with form for all table fields");
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

  const contextValue: MapContextType = {
    mapInstance: mapInstanceRef.current,
    selectedBaseMap,
    isRasterDisplayed,
    isContourDisplayed,
    isVillageOverlayVisible,
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
    zoomToCurrentExtent,
    getAllLayers,
    toggleVillageOverlay,
    setLegendData,
    addWellPointsLayer,
    removeWellPointsLayer,
    forceRemoveWellPointsLayer,
    enableWellAddMode,
    disableWellAddMode,
    isWellAddModeActive,
    addContourLayer,
    removeContourLayer,
    getSelectedAreaBounds,
  };

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
        selectedRegionBounds={getSelectedAreaBounds()}
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