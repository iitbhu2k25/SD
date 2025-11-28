// app/dss/varuna/dashboard/varunamap.tsx
'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { Select, DragPan } from 'ol/interaction';
import { click } from 'ol/events/condition';
import Overlay from 'ol/Overlay';
import { ChevronDown, Map as MapIcon, Layers, Settings, Eye, EyeOff, RotateCcw, Maximize2, Info, Search, X, Droplets, Activity, FlaskConical } from 'lucide-react';

interface DrainStation {
  id: number;
  location: string;
  stream?: string;
  lat: number;
  lon: number;
  ph: number;
  temp: number;
  ec_us_cm: number;
  tds_ppm: number;
  do_mg_l: number;
  turbidity: number;
  chloride: number;
  nitrate: number;
  tss_mg_l: number;
  bod_mg_l: number;
  cod: number;
  sampling_time?: string;
}

interface VarunaMapProps {
  sidebarCollapsed: boolean;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  selectedFilter?: string | null;
}

interface RiverInfo {
  id: string;
  display_name: string;
  folder_path: string;
  shapefile_path: string;
  color?: string;
}

interface LayerState {
  varuna: boolean;
  basuhi: boolean;
  morwa: boolean;
  basin: boolean;
  stations: boolean;
}

const VarunaMap: React.FC<VarunaMapProps> = ({ sidebarCollapsed, showNotification, selectedFilter }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [currentParameter, setCurrentParameter] = useState<'bod' | 'cod' | 'do' | 'ph'>('do');
  // useEffect to synchronize external filter (from Overview tab) with map parameter
  useEffect(() => {
    let newParam: 'bod' | 'cod' | 'do' | 'ph' | null = null; // Use null initially

    // 1. Determine the correct map parameter based on the filter string
    switch (selectedFilter) {
      case 'acidic':
        newParam = 'ph'; // Acidic maps to pH
        break;
      case 'lowDO':
        newParam = 'do'; // Low DO maps to DO
        break;
      case 'highBOD':
        newParam = 'bod'; // High BOD maps to BOD
        break;
      case 'highCOD':
        newParam = 'cod'; // High COD maps to COD
        break;
      default:
        // If the filter is null (e.g., "All Sites") or another tab, do nothing to currentParameter
        return; 
    }

    // 2. Only update if the determined parameter is new
    if (newParam && newParam !== currentParameter) {
        setCurrentParameter(newParam);
    }
    
  }, [selectedFilter]);
  const [drainStations, setDrainStations] = useState<DrainStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [availableRivers, setAvailableRivers] = useState<RiverInfo[]>([]);
  const [currentBasemap, setCurrentBasemap] = useState<'osm' | 'satellite'>('osm');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('parameters');
  const [layerVisibility, setLayerVisibility] = useState<LayerState>({
    varuna: true,
    basuhi: true,
    morwa: true,
    basin: true,
    stations: true,
  });
  const [selectedStationInfo, setSelectedStationInfo] = useState<DrainStation | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Layer references
  const riverLayersRef = useRef<{ [key: string]: VectorLayer<VectorSource> }>({});
  const stationLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseMapsRef = useRef<{ [key: string]: TileLayer<OSM | XYZ> }>({});
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });
  const defaultPopupOffset = [0, -20];

  const API_BASE = 'django/drain-water-quality/';

  const RIVER_COLORS = {
    varuna: '#0066CC',
    basuhi: '#9c00aaff',
    morwa: '#FF6600',
    basin: '#8B4513',
    default: '#0ea5e9',
  };

  const PARAMETERS = [
    { 
      id: 'do', 
      label: 'DO (mg/L)', 
      desc: 'Dissolved Oxygen', 
      color: 'bg-blue-500/20 text-blue-400', 
     
    },
    { 
      id: 'ph', 
      label: 'pH', 
      desc: 'ph Level', 
      color: 'bg-purple-500/20 text-purple-400', 
      
    },
    { 
      id: 'bod', 
      label: 'BOD (mg/L)', 
      desc: 'Biochemical Oxygen Demand', 
      color: 'bg-green-500/20 text-green-400', 
     
    },
    { 
      id: 'cod', 
      label: 'COD (mg/L)', 
      desc: 'Chemical Oxygen Demand', 
      color: 'bg-orange-500/20 text-orange-400', 
      
    },
  ];
  const RIVER_INFO = {
    varuna: { label: 'Varuna River', icon: '', color: '#0066CC' },
    basuhi: { label: 'Basuhi River', icon: '', color: '#9c00aa' },
    morwa: { label: 'Morwa River', icon: '', color: '#FF6600' },
    basin: { label: 'Basin Area', icon: '', color: '#8B4513' },
    stations: { label: 'Monitoring Stations', icon: '', color: '#140716da' },
  };

  const formatSamplingDate = (samplingTime?: string): string => {
    if (!samplingTime) return 'Date not available';
    try {
      const date = new Date(samplingTime);
      if (isNaN(date.getTime())) {
        // Try to parse 'YYYY-MM-DD' format if it's a string
        if (typeof samplingTime === 'string') {
          const parts = samplingTime.split('T')[0].split('-');
          if (parts.length === 3) {
            const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (!isNaN(newDate.getTime())) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }
        }
        return 'Invalid date';
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'Date error';
    }
  };

  const getRiverColor = (riverId: string): string => {
    const lowerRiverId = riverId.toLowerCase();
    if (lowerRiverId.includes('varuna')) return RIVER_COLORS.varuna;
    if (lowerRiverId.includes('basuhi')) return RIVER_COLORS.basuhi;
    if (lowerRiverId.includes('morwa')) return RIVER_COLORS.morwa;
    if (lowerRiverId.includes('basin')) return RIVER_COLORS.basin;
    return RIVER_COLORS.default;
  };

  const getRiverWidth = (riverId: string): number => {
    const lowerRiverId = riverId.toLowerCase();
    if (lowerRiverId.includes('varuna')) return 5;
    if (lowerRiverId.includes('basin')) return 2;
    return 3;
  };

  const getParameterValue = (station: DrainStation, parameter: string): number => {
    switch (parameter) {
      case 'bod':
        return station.bod_mg_l || 0;
      case 'cod':
        return station.cod || 0;
      case 'do':
        return station.do_mg_l || 0;
      case 'ph':
        return station.ph || 7;
      default:
        return 0;
    }
  };

  const getParameterName = (param: string): string => {
    switch (param) {
      case 'bod':
        return 'BOD (mg/L)';
      case 'cod':
        return 'COD (mg/L)';
      case 'do':
        return 'DO (mg/L)';
      case 'ph':
        return 'pH';
      default:
        return param.toUpperCase();
    }
  };

  const getParameterColor = (parameter: string, value: number): string => {
    switch (parameter) {
      case 'bod':
        if (value <= 3) return '#22c55e'; // good
        if (value <= 6) return '#eab308'; // moderate
        return '#ef4444'; // poor
      case 'cod':
        if (value <= 10) return '#22c55e';
        if (value <= 50) return '#eab308';
        return '#ef4444';
      case 'do':
        if (value >= 6) return '#22c55e';
        if (value >= 4) return '#eab308';
        return '#ef4444';
      case 'ph':
        if (value >= 6.5 && value <= 8.0) return '#22c55e';
        if (value > 8.0 && value <= 8.5) return '#eab308';
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getQualityStatus = (parameter: string, value: number): string => {
    const color = getParameterColor(parameter, value);
    if (color === '#22c55e') return 'Good';
    if (color === '#eab308') return 'Moderate';
    return 'Poor';
  };

  const createStationStyle = (station: DrainStation, parameter: string) => {
    const value = getParameterValue(station, parameter);
    const color = getParameterColor(parameter, value);

    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: value.toFixed(1),
        font: 'bold 11px sans-serif',
        fill: new Fill({ color: '#000' }),
        backgroundFill: new Fill({ color: 'rgba(255,255,255,0.8)' }),
        padding: [2, 2, 2, 2],
        offsetY: -25,
      }),
    });
  };

  // ✅ FIX: Replaced this function's body with your provided code
  const createPopupContent = (station: DrainStation, parameter: string): string => {
    const value = getParameterValue(station, parameter);
    const paramName = getParameterName(parameter);
    const qualityStatus = getQualityStatus(parameter, value);
    const samplingDate = formatSamplingDate(station.sampling_time);
    const statusColor = getParameterColor(parameter, value);
    const nitrateValue =
      station.nitrate !== null && station.nitrate !== undefined ? station.nitrate.toFixed(2) : 'N/A';

    return `
      <div style="font-family: sans-serif; position: relative; padding: 8px;">
        <div style="font-weight: bold; margin-bottom: 6px; color: #1f2937; font-size: 11px; padding-right: 20px;">
          📍 ${
            station.location.length > 45
              ? station.location.substring(0, 45) + '...'
              : station.location + ' - (' + (station.stream || 'N/A') + ')'
          }
        </div>
        <div style="margin-bottom: 3px; padding: 2px 4px; background: #f3f4f6; border-radius: 3px; font-size: 10px;">
          <strong>${paramName}:</strong> 
          <span style="color: ${getParameterColor(parameter, value)}; font-weight: bold;">
            ${value.toFixed(1)}
          </span>
        </div>
        <div style="margin-bottom: 3px; font-size: 9px;">
          <strong>Status:</strong> 
          <span style="color: ${getParameterColor(parameter, value)}; font-weight: bold;">
            ${qualityStatus}
          </span>
        </div>
        <div style="margin-bottom: 3px; padding: 2px 4px; background: #f3f4f6; border-radius: 3px; font-size: 10px;">
          <strong>Sampling Date:</strong> 
          <span style="color: #058096ff; font-weight: bold;">
            ${samplingDate}
          </span>
        </div>
        <div style="margin-bottom: 3px; font-size: 9px;">
          <strong>Temprature:</strong> 
          <span style="color: #058096ff; font-weight: bold;">
           ${station.temp + ' °C'}
          </span>
        </div>
        <div style="margin-bottom: 3px; font-size: 9px;">
          <strong>Turbidity:</strong> 
          <span style="color: #058096ff; font-weight: bold;">
           ${station.turbidity}
          </span>
        </div>
        <div style="margin-bottom: 3px; font-size: 9px;">
          <strong>Chloride:</strong> 
          <span style="color: #058096ff; font-weight: bold;">
           ${station.chloride}
          </span>
        </div>
        <div style="margin-bottom: 3px; font-size: 9px;">
          <strong>Nitrate:</strong> 
          <span style="color: #058096ff; font-weight: bold;">
           ${nitrateValue}
          </span>
        </div>
      </div>
    `;
  };


  const scanAvailableRivers = async (): Promise<RiverInfo[]> => {
    try {
      const response = await fetch(`/django/drain-water-quality/rivers/scan/`);
      const data = await response.json();

      if (data.status === 'success') {
        const rivers = Object.values(data.rivers) as RiverInfo[];
        setAvailableRivers(rivers);
        return rivers;
      }
      return [];
    } catch (error) {
      console.error('Error scanning rivers:', error);
      showNotification('Error', 'Could not scan for available rivers', 'error');
      return [];
    }
  };

  const loadRiverShapefiles = async () => {
    if (!mapInstanceRef.current) return;

    try {
      setLoading(true);
      const rivers = await scanAvailableRivers();

      if (rivers.length === 0) {
        showNotification('Info', 'No rivers found. Please upload shapefiles.', 'info');
        return;
      }

      // Load all rivers in parallel
      const loadPromises = rivers.map(async (river) => {
        try {
          const response = await fetch(`/django/drain-water-quality/rivers/geojson/${river.id}`);
          if (!response.ok) return null;
          const geoJsonData = await response.json();
          return { river, geoJsonData };
        } catch (error) {
          console.error(`Error loading ${river.display_name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      let loadedCount = 0;

      results.forEach((result) => {
        if (!result) return;
        const { river, geoJsonData } = result;

        if (riverLayersRef.current[river.id]) {
          mapInstanceRef.current?.removeLayer(riverLayersRef.current[river.id]);
        }

        const riverColor = getRiverColor(river.id);
        const riverWidth = getRiverWidth(river.id);

        const style = new Style({
          stroke: new Stroke({
            color: riverColor,
            width: riverWidth,
            lineCap: 'round',
            lineJoin: 'round',
          }),
          fill: river.id.toLowerCase().includes('basin')
            ? new Fill({ color: `${riverColor}15` })
            : undefined,
        });

        const riverLayer = new VectorLayer({
          source: new VectorSource({
            features: new GeoJSON().readFeatures(geoJsonData, { featureProjection: 'EPSG:3857' }),
          }),
          style: style,
          properties: {
            name: river.id,
            displayName: river.display_name,
          },
          visible: layerVisibility[river.id as keyof LayerState] !== false,
        });

        riverLayersRef.current[river.id] = riverLayer;
        mapInstanceRef.current?.addLayer(riverLayer);
        loadedCount++;
      });

      if (loadedCount > 0) {
        showNotification('Success', `Loaded ${loadedCount} rivers`, 'success');

        setTimeout(() => {
          if (mapInstanceRef.current && Object.keys(riverLayersRef.current).length > 0) {
            const allFeatures = Object.values(riverLayersRef.current).flatMap(
              (layer) => layer.getSource()?.getFeatures() || []
            );
            if (allFeatures.length > 0) {
              let extent = allFeatures[0].getGeometry()?.getExtent();
              if (extent) {
                allFeatures.forEach((feature) => {
                  const geom = feature.getGeometry();
                  if (geom) {
                    const featureExtent = geom.getExtent();
                    extent[0] = Math.min(extent[0], featureExtent[0]);
                    extent[1] = Math.min(extent[1], featureExtent[1]);
                    extent[2] = Math.max(extent[2], featureExtent[2]);
                    extent[3] = Math.max(extent[3], featureExtent[3]);
                  }
                });
                mapInstanceRef.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
              }
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error loading rivers:', error);
      showNotification('Error', 'Failed to load rivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshRivers = async () => {
    try {
      setLoading(true);
      showNotification('Info', 'Refreshing river data...', 'info');

      const response = await fetch(`django/drain-water-quality/rivers/refresh/`, { method: 'POST' });
      const result = await response.json();

      Object.values(riverLayersRef.current).forEach((layer) => mapInstanceRef.current?.removeLayer(layer));
      riverLayersRef.current = {};
      await loadRiverShapefiles();
    } catch (error) {
      console.error('Error refreshing:', error);
      showNotification('Error', 'Could not refresh rivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateStationLayer = (stations: DrainStation[], parameter: string) => {
    if (!mapInstanceRef.current) return;

    if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
    if (stationLayerRef.current) mapInstanceRef.current.removeLayer(stationLayerRef.current);

    const features = stations
      .filter((station) => station.lat && station.lon)
      .map((station) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([station.lon, station.lat])),
          ...station,
        });
        feature.setStyle(createStationStyle(station, parameter));
        return feature;
      });

    const stationLayer = new VectorLayer({
      source: new VectorSource({ features }),
      zIndex: 1000,
      visible: layerVisibility.stations,
    });

    stationLayerRef.current = stationLayer;
    mapInstanceRef.current.addLayer(stationLayer);
  };

  const changeBasemap = (type: 'osm' | 'satellite') => {
    Object.values(baseMapsRef.current).forEach((layer) => layer.setVisible(false));
    if (baseMapsRef.current[type]) {
      baseMapsRef.current[type].setVisible(true);
      setCurrentBasemap(type);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    const newVis = { ...layerVisibility, [layerId]: !layerVisibility[layerId as keyof LayerState] };
    setLayerVisibility(newVis);

    const layer = riverLayersRef.current[layerId];
    if (layer) layer.setVisible(newVis[layerId as keyof LayerState]);
    if (layerId === 'stations' && stationLayerRef.current) {
      stationLayerRef.current.setVisible(newVis.stations);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const osmLayer = new TileLayer({ source: new OSM() });
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      }),
      visible: false,
    });

    baseMapsRef.current = { osm: osmLayer, satellite: satelliteLayer };

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer],
      view: new View({
        center: fromLonLat([82.9739, 25.3176]),
        zoom: 11,
        maxZoom: 18,
        minZoom: 8,
      }),
      controls: defaultControls({ zoom: false }).extend([
        new ScaleLine({ units: 'metric', bar: true, steps: 4, text: true, minWidth: 140 }),
      ]),
    });

    mapInstanceRef.current = map;

    map.on('pointermove', (evt) => {
      const coord = toLonLat(evt.coordinate);
      setCoordinates({
        lat: parseFloat(coord[1].toFixed(5)),
        lng: parseFloat(coord[0].toFixed(5)),
      });
    });

    const overlay = new Overlay({
      element: popupRef.current!,
      positioning: 'bottom-center',
      offset: defaultPopupOffset,
      stopEvent: false,
    });
    overlayRef.current = overlay;
    map.addOverlay(overlay);

    const selectInteraction = new Select({
      condition: click,
      multi: false,
      filter: (feature) => feature.get('location') != null,
      style: (feature) => {
        const station = feature.getProperties() as DrainStation;
        const value = getParameterValue(station, currentParameter);
        const color = getParameterColor(currentParameter, value);

        return new Style({
          image: new CircleStyle({
            radius: 13,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#00FFFF', width: 4 }),
          }),
          text: new Text({
            text: value.toFixed(1),
            font: 'bold 12px sans-serif',
            fill: new Fill({ color: '#000' }),
            backgroundFill: new Fill({ color: 'rgba(255,255,255,0.9)' }),
            padding: [3, 3, 3, 3],
            offsetY: -30,
          }),
          zIndex: 9999,
        });
      },
    });

    selectInteractionRef.current = selectInteraction;

    selectInteraction.on('select', (e) => {
      if (e.selected.length > 0) {
        const feature = e.selected[0];
        const station = feature.getProperties() as DrainStation;
        setSelectedStationInfo(station);

        if (overlayRef.current) {
          const geometry = feature.getGeometry();
          if (geometry instanceof Point) {
            const coordinate = geometry.getCoordinates();
            overlayRef.current.setPosition(coordinate);

            if (popupRef.current) {
              const contentDiv = popupRef.current.querySelector('#popup-content');
              if (contentDiv) {
                contentDiv.innerHTML = createPopupContent(station, currentParameter);
              }
              popupRef.current.style.display = 'block';
            }
          }
        }
      } else {
        if (popupRef.current) popupRef.current.style.display = 'none';
        if (overlayRef.current) overlayRef.current.setPosition(undefined);
        setSelectedStationInfo(null);
      }
    });

    map.addInteraction(selectInteraction);
    
    setTimeout(() => {
      map.updateSize();
    }, 100);

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!popupRef.current || !overlayRef.current || !target.closest('#station-popup')) return;

      e.preventDefault();
      isDraggingRef.current = true;
      const dragPan = map
        .getInteractions()
        .getArray()
        .find((i) => i instanceof DragPan) as DragPan;
      if (dragPan) dragPan.setActive(false);

      const offset = overlayRef.current.getOffset();
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        offsetX: offset[0],
        offsetY: offset[1],
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !overlayRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      overlayRef.current.setOffset([
        dragStartRef.current.offsetX + deltaX,
        dragStartRef.current.offsetY + deltaY,
      ]);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      const dragPan = map
        .getInteractions()
        .getArray()
        .find((i) => i instanceof DragPan) as DragPan;
      if (dragPan) dragPan.setActive(true);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousedown', onMouseDown);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Load drain stations
  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/django/drain-water-quality/main`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: DrainStation[] = await response.json();
        setDrainStations(data);
        if (mapInstanceRef.current) updateStationLayer(data, currentParameter);
      } catch (error) {
        console.error('Error loading stations:', error);
        showNotification('Error', 'Could not load station data', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadStations();
  }, []);

  // Update stations on parameter change
  useEffect(() => {
    if (drainStations.length > 0 && mapInstanceRef.current) {
      updateStationLayer(drainStations, currentParameter);
    }
  }, [currentParameter, drainStations]);

  // Update popup on parameter change
  useEffect(() => {
    if (selectedStationInfo && popupRef.current) {
      const contentDiv = popupRef.current.querySelector('#popup-content');
      if (contentDiv) {
        contentDiv.innerHTML = createPopupContent(selectedStationInfo, currentParameter);
      }
    }
  }, [currentParameter]);

  // Load rivers
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => loadRiverShapefiles(), 1000);
    }
  }, [mapInstanceRef.current]);

  // Fullscreen handling
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await fullscreenContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  return (
    <div ref={fullscreenContainerRef} className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl">
      {/* LEFT SIDEBAR */}
      <div
        className={`absolute top-0 left-0 h-600 max-h-full w-60 bg-gradient-to-b from-slate-800/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl overflow-hidden flex flex-col z-20 transition-all duration-300 ${
          !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* ✅ FIX: Moved close button to header */}
        <div className="flex items-center justify-between p-2 bg-slate-800/50">
           <h2 className="text-white font-bold text-sm px-2">Map Controls</h2>
           <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg text-blue-100 hover:bg-white/20 transition-all"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-3 bg-slate-800/50 border-y border-slate-700/50">
          {/* ✅ FIX: Changed tab order */}
          {['parameters', 'layers', 'info'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {/* PARAMETERS TAB */}
          {activeTab === 'parameters' && (
            <div>
              <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-purple-400" />
                Parameters
              </h2>

              <div className="space-y-2">
                {PARAMETERS.map((param) => (
                  <div
                    key={param.id}
                    className="group p-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 transition-all duration-300 cursor-pointer"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="parameter"
                        value={param.id}
                        checked={currentParameter === param.id}
                        onChange={() => setCurrentParameter(param.id as 'bod' | 'cod' | 'do' | 'ph')}
                        className="w-4 h-4 cursor-pointer accent-cyan-400"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{param.label}</p>
                        <p className="text-slate-400 text-xs">{param.desc}</p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/20">
                <p className="text-cyan-300 text-xs font-bold mb-1">💡 TIP</p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Select a parameter to visualize water quality. Color intensity indicates severity level.
                </p>
              </div>
            </div>
          )}

          {/* LAYERS TAB */}
          {activeTab === 'layers' && (
            <div>
              <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-cyan-400" />
                River Layers
              </h2>

              <div className="space-y-2">
                {Object.entries(RIVER_INFO).map(([key, info]) => (
                  <div
                    key={key}
                    className="group p-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/30 hover:border-slate-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-slate-400"
                          style={{ backgroundColor: info.color }}
                        />
                        <div>
                          <p className="text-white font-medium text-sm">{info.label}</p>
                          <p className="text-slate-400 text-xs">{info.icon}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleLayerVisibility(key)}
                        className={`p-2 rounded-lg transition-all ${
                          layerVisibility[key as keyof LayerState]
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-slate-600/30 text-slate-500'
                        }`}
                      >
                        {layerVisibility[key as keyof LayerState] ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <p className="text-slate-300 text-xs font-bold mb-2">LEGEND</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-slate-400">Good Quality</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-slate-400">Moderate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-400">Poor Quality</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && (
            <div>
              <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-green-400" />
                Information
              </h2>

              <div className="space-y-3">
                <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
                  <p className="text-slate-300 text-xs font-bold mb-2">Active Stations</p>
                  <p className="text-white text-2xl font-bold">{drainStations.length}</p>
                  <p className="text-slate-400 text-xs mt-1">Monitoring locations</p>
                </div>


                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-blue-300 text-xs font-bold mb-2">ℹ️ About</p>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Varuna River Monitoring System powered by IIT (BHU) Varanasi. Real-time water quality data for decision support.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Last updated</span>
            <span className="text-cyan-400 font-bold">Just now</span>
          </div>
        </div>
      </div>

      {/* MAIN MAP AREA */}
      <div className="relative w-full h-full">
        <div ref={mapRef} className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />

        {/* TOP RIGHT - Basemap Selector */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex gap-2 bg-slate-800/90 backdrop-blur-lg p-2 rounded-lg border border-slate-700 shadow-xl">
            <button
              onClick={() => changeBasemap('osm')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                currentBasemap === 'osm'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
               Streets
            </button>
            <button
              onClick={() => changeBasemap('satellite')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                currentBasemap === 'satellite'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
               Satellite
            </button>
          </div>
        </div>

        {/* TOP LEFT - Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-3 bg-slate-800/90 backdrop-blur-lg hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 shadow-xl transition-all hover:shadow-cyan-500/20"
            title="Toggle sidebar"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={refreshRivers}
            disabled={loading}
            className="p-3 bg-slate-800/90 backdrop-blur-lg hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 shadow-xl transition-all disabled:opacity-50"
            title="Refresh data"
          >
            <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* BOTTOM CENTER - Coordinates */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-lg px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 shadow-xl font-mono">
            📍 {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
          </div>
        </div>
        
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-slate-800/90 backdrop-blur-lg hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 shadow-xl transition-all"
            title="Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm z-30">
            <div className="bg-slate-800/95 py-4 px-6 rounded-lg shadow-2xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
                <span className="text-slate-200 font-medium">Loading...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPUP OVERLAY */}
      <div
        ref={popupRef}
        id="station-popup"
        className="absolute bg-white rounded-lg shadow-xl border border-gray-200 pointer-events-auto z-50"
        style={{
          display: 'none',
          minWidth: '280px',
          cursor: 'move',
        }}
      >
        <button
          onClick={() => {
            if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
            if (popupRef.current) popupRef.current.style.display = 'none';
            if (overlayRef.current) overlayRef.current.setPosition(undefined);
            setSelectedStationInfo(null);
          }}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white border-none rounded-full w-6 h-6 text-sm font-bold flex items-center justify-center z-30 transition-colors"
        >
          ✕
        </button>
        <div id="popup-content" className="p-3"></div>

        {/* Tail */}
        <div
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: '50%',
            marginLeft: '-10px',
            width: 0,
            height: 0,
            borderTop: '10px solid white',
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
          }}
        />
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 197, 94, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 197, 94, 0.8);
        }
      `}</style>
    </div>
  );
};

export default VarunaMap;