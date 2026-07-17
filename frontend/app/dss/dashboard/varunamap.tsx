// app/dss/varuna/dashboard/varunamap.tsx
'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { Select } from 'ol/interaction';
import { click } from 'ol/events/condition';
import { ChevronDown, Map as MapIcon, Layers, Settings, RotateCcw, Search, X, Droplets, Activity, FlaskConical } from 'lucide-react';

interface DrainStation {
  id: number;
  location: string;
  stream?: string;
  lat: number | null;
  lon: number | null;
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
  drainStations: DrainStation[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}



interface LayerState {
  varuna: boolean;
  basuhi: boolean;
  morwa: boolean;
  basin: boolean;
  stations: boolean;
}

const VarunaMap: React.FC<VarunaMapProps> = ({
  sidebarCollapsed,
  showNotification,
  selectedFilter,
  drainStations,
  selectedYear,
  availableYears,
  onYearChange,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const [currentParameter, setCurrentParameter] = useState<'bod' | 'cod' | 'do' | 'ph'>('do');
  const currentParameterRef = useRef<'bod' | 'cod' | 'do' | 'ph'>('do');
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

  // Keep ref in sync with state so stale closures (e.g. OL Select style fn) always read the latest value
  useEffect(() => {
    currentParameterRef.current = currentParameter;
  }, [currentParameter]);

  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0 });
  const [currentBasemap, setCurrentBasemap] = useState<'osm' | 'satellite'>('osm');
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
  const [showLegend, setShowLegend] = useState(true);

  // Layer references
  const riverLayersRef = useRef<{ [key: string]: VectorLayer<VectorSource> }>({});
  const stationLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseMapsRef = useRef<{ [key: string]: TileLayer<OSM | XYZ> }>({});
  const selectInteractionRef = useRef<Select | null>(null);

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

  const getBodPriority = (value: number): { priority: number; label: string; color: string } => {
    // Keep pollution-source priority formula exactly same, only map to quality labels/colors
    if (value > 30) return { priority: 1, label: 'Severe', color: '#8b0000' };
    if (value >= 20) return { priority: 2, label: 'Poor', color: '#ef4444' };
    if (value >= 10) return { priority: 3, label: 'Moderate', color: '#f59e0b' };
    if (value >= 6) return { priority: 4, label: 'Good', color: '#3b82f6' };
    return { priority: 5, label: 'Excellent', color: '#10b981' };
  };

  const getParameterColor = (parameter: string, value: number): string => {
    switch (parameter) {
      case 'bod':
        return getBodPriority(value).color;
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
    if (parameter === 'bod') {
      return getBodPriority(value).label;
    }
    const color = getParameterColor(parameter, value);
    if (color === '#22c55e') return 'Good';
    if (color === '#eab308') return 'Moderate';
    return 'Poor';
  };

  const stationLegendItems =
    currentParameter === 'bod'
      ? [
          { color: '#10b981', label: 'Excellent' },
          { color: '#3b82f6', label: 'Good' },
          { color: '#f59e0b', label: 'Moderate' },
          { color: '#ef4444', label: 'Poor' },
          { color: '#8b0000', label: 'Severe' },
        ]
      : [
          { color: '#22c55e', label: 'Good' },
          { color: '#eab308', label: 'Moderate' },
          { color: '#ef4444', label: 'Poor' },
        ];

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

  const formatNumericValue = (value?: number | null, digits = 2): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
    return value.toFixed(digits);
  };

  const detailFields = selectedStationInfo
  ? [
      { label: 'Stream', value: selectedStationInfo.stream || 'N/A' },
      { label: 'Sampling Date', value: formatSamplingDate(selectedStationInfo.sampling_time) },
      // Added IDs so we can identify them for filtering
      { id: 'ph', label: 'pH', value: formatNumericValue(selectedStationInfo.ph) },
      { id: 'do', label: 'DO (mg/L)', value: formatNumericValue(selectedStationInfo.do_mg_l) },
      { id: 'bod', label: 'BOD (mg/L)', value: formatNumericValue(selectedStationInfo.bod_mg_l) },
      { id: 'cod', label: 'COD (mg/L)', value: formatNumericValue(selectedStationInfo.cod) },
      { label: 'EC (µS/cm)', value: formatNumericValue(selectedStationInfo.ec_us_cm) },
      { label: 'TDS (ppm)', value: formatNumericValue(selectedStationInfo.tds_ppm) },
      { label: 'TSS (mg/L)', value: formatNumericValue(selectedStationInfo.tss_mg_l) },
      { label: 'Turbidity', value: formatNumericValue(selectedStationInfo.turbidity) },
      { label: 'Chloride', value: formatNumericValue(selectedStationInfo.chloride) },
      { label: 'Nitrate', value: formatNumericValue(selectedStationInfo.nitrate) },
    ].filter(field => field.id !== currentParameter) // THIS REMOVES THE DUPLICATE
  : [];


  const loadRiverShapefiles = () => {
    if (!mapInstanceRef.current) return;

    Object.values(riverLayersRef.current).forEach(l => mapInstanceRef.current?.removeLayer(l));
    riverLayersRef.current = {};

    const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
    const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;

    const riverDefs = [
      { name: 'Varuna', visKey: 'varuna' as keyof LayerState, color: '#0066CC', width: 5, zIndex: 203 },
      { name: 'Basuhi', visKey: 'basuhi' as keyof LayerState, color: '#9c00aa', width: 3, zIndex: 202 },
      { name: 'Morwa',  visKey: 'morwa'  as keyof LayerState, color: '#FF6600', width: 3, zIndex: 201 },
    ];

    riverDefs.forEach(({ name, visKey, color, width, zIndex }) => {
      const url = `${WFS_BASE}&typeName=dss_vector:Rivers&CQL_FILTER=River_Name='${name}'`;
      fetch(url)
        .then(r => r.json())
        .then(geojson => {
          if (!mapInstanceRef.current) return;
          const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) });
          const layer = new VectorLayer({
            source,
            style: new Style({ stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }) }),
            zIndex,
            properties: { name: name.toLowerCase(), displayName: name },
            visible: layerVisibility[visKey],
          });
          riverLayersRef.current[visKey] = layer;
          mapInstanceRef.current.addLayer(layer);
        })
        .catch(console.error);
    });

    // Basin boundary
    fetch(`${WFS_BASE}&typeName=dss_vector:basin_boundary`)
      .then(r => r.json())
      .then(geojson => {
        if (!mapInstanceRef.current) return;
        const source = new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) });
        const layer = new VectorLayer({
          source,
          style: new Style({
            stroke: new Stroke({ color: '#8B4513', width: 2.5 }),
            fill: new Fill({ color: 'rgba(139,69,19,0.05)' }),
          }),
          zIndex: 100,
          properties: { name: 'basin', displayName: 'Basin Boundary' },
          visible: layerVisibility.basin,
        });
        riverLayersRef.current['basin'] = layer;
        mapInstanceRef.current.addLayer(layer);
      })
      .catch(console.error);

    // Fit to basin bounding box — same extent the old shapefile fit produced
    mapInstanceRef.current.getView().fit(
      [...fromLonLat([82.38, 25.25]), ...fromLonLat([83.75, 25.95])] as [number, number, number, number],
      { padding: [40, 350, 40, 280], maxZoom: 9 }
    );
  };

  /* kept for the Refresh button — just reloads the WMS layers */
  const refreshRivers = () => {
    loadRiverShapefiles();
    showNotification('Success', 'Rivers refreshed', 'success');
  };


  const updateStationLayer = (stations: DrainStation[], parameter: string) => {
    if (!mapInstanceRef.current) return;

    if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
    if (stationLayerRef.current) mapInstanceRef.current.removeLayer(stationLayerRef.current);

    const features = stations
      .filter(
        (station): station is DrainStation & { lat: number; lon: number } =>
          station.lat !== null && station.lon !== null
      )
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

    if (layerId === 'stations') {
      stationLayerRef.current?.setVisible(newVis.stations);
    } else {
      riverLayersRef.current[layerId]?.setVisible(newVis[layerId as keyof LayerState]);
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
        center: fromLonLat([83.065, 25.6]),
        zoom: 9,
        maxZoom: 18,
        minZoom: 8,
      }),
      controls: defaultControls({ zoom: false }).extend([
        new ScaleLine({ 
  units: 'metric', 
  bar: true, // This enables the scale bar/ratio look
  steps: 4, 
  text: true, 
  minWidth: 140,
  target: 'custom-scale-container' // Directs it to our new div
}),
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

    const selectInteraction = new Select({
      condition: click,
      multi: false,
      filter: (feature) => feature.get('location') != null,
      // Replace the entire selectInteraction style function (Around Line 527)
style: (feature) => {
  const station = feature.getProperties() as DrainStation;
  // ✅ Use ref — always reads the latest value, avoids stale closure
  const value = getParameterValue(station, currentParameterRef.current);
  const color = getParameterColor(currentParameterRef.current, value);

  const selectedStyle = new Style({
    image: new CircleStyle({
      radius: 13,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#00FFFF', width: 4 }),
    }),
    text: new Text({
      // FORCE the text to recalculate here
      text: value.toFixed(1),
      font: 'bold 12px sans-serif',
      fill: new Fill({ color: '#000' }),
      backgroundFill: new Fill({ color: 'rgba(255,255,255,0.9)' }),
      padding: [3, 3, 3, 3],
      offsetY: -30,
    }),
    zIndex: 9999,
  });
  return selectedStyle;
},
    });

    selectInteractionRef.current = selectInteraction;

    selectInteraction.on('select', (e) => {
      if (e.selected.length > 0) {
        const feature = e.selected[0];
        const station = feature.getProperties() as DrainStation;
        setSelectedStationInfo(station);
      } else {
        setSelectedStationInfo(null);
      }
    });

    map.addInteraction(selectInteraction);
    
    setTimeout(() => {
      map.updateSize();
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update stations on parameter change
  // Update stations on parameter change
useEffect(() => {
  if (!mapInstanceRef.current) return;

  if (drainStations.length > 0) {
    updateStationLayer(drainStations, currentParameter);

    // ADD THESE LINES TO FIX THE "FALSE VALUE" ON CLICK:
    if (selectInteractionRef.current) {
      // Clear the current selection highlight when you switch parameters
      // This forces the map to use the new parameter value the next time you click
      selectInteractionRef.current.getFeatures().clear(); 
      setSelectedStationInfo(null); // Optional: Close the sidebar to prevent mismatch
    }
    return;
  }

  if (stationLayerRef.current) {
    mapInstanceRef.current.removeLayer(stationLayerRef.current);
    stationLayerRef.current = null;
  }
}, [currentParameter, drainStations]);

  useEffect(() => {
    if (
      selectedStationInfo &&
      !drainStations.some((station) => station.id === selectedStationInfo.id)
    ) {
      if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
      setSelectedStationInfo(null);
    }
  }, [drainStations, selectedStationInfo]);

  // Load rivers
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => loadRiverShapefiles(), 1000);
    }
  }, [mapInstanceRef.current]);

  return (
    <div className="relative flex h-full w-full bg-slate-900 rounded-lg overflow-hidden shadow-2xl">
      {/* LEFT SIDEBAR */}
      <div
        className={`absolute top-0 left-0 h-full max-h-full w-60 bg-slate-600 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl overflow-hidden flex flex-col z-20 transition-all duration-300 ${
          !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* ✅ FIX: Moved close button to header */}
        <div className="flex items-center justify-between p-2 bg-slate-800/50">
           <h2 className="text-white font-bold text-sm px-12">Map Controls</h2>
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
          {['parameters', 'controls'].map((tab) => (
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
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-lg px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 shadow-xl font-mono">
            📍 {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
          </div>
        </div>
            </div>
          )}

          {/* CONTROLS TAB */}
          {activeTab === 'controls' && (
            <div>
             

              <div className="space-y-3">
                <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
                  <p className="text-slate-300 text-xs font-bold mb-3 uppercase tracking-wide">Assessment Year</p>
                  <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/30">
                  <p className="text-slate-300 text-xs font-bold mb-3 uppercase tracking-wide">Basemap</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => changeBasemap('osm')}
                      className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                        currentBasemap === 'osm'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Streets
                    </button>
                    <button
                      onClick={() => changeBasemap('satellite')}
                      className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                        currentBasemap === 'satellite'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Satellite
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-blue-300 text-xs font-bold mb-2">Stations</p>
                  <p className="text-white text-2xl font-bold">{drainStations.length}</p>
                  <p className="text-slate-300 text-xs mt-1">Monitoring locations in {selectedYear}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        
      </div>

      {/* MAIN MAP AREA */}
      <div className="relative flex-1 h-full">
        <div ref={mapRef} className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />
        <div 
  id="custom-scale-container" 
  className="absolute bottom-6 z-20 transition-all duration-300"
  style={{ 
    left: isSidebarOpen ? '260px' : '20px' // Moves it based on sidebar state
  }}
/>

        {/* TOP LEFT - Toolbar */}
        <div className="absolute top-9 left-1 z-10 flex gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-3 bg-slate-800/90 backdrop-blur-lg hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 shadow-xl transition-all hover:shadow-cyan-500/20"
            title="Toggle sidebar"
          >
            <Layers className="w-5 h-5" />
          </button>
          <div 
  id="scale-box" 
  className="absolute bottom-6 z-50 transition-all duration-300"
  style={{ 
    left: isSidebarOpen ? '260px' : '20px' // THIS IS THE ACTUAL SHIFT
  }}
/>
        </div>

        {/* BOTTOM CENTER - Coordinates */}
        {/* <div className="absolute top-1 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-lg px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 shadow-xl font-mono">
            📍 {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
          </div>
        </div> */}
        
        {showLegend ? (
          <div className="absolute bottom-1 right-1 z-20 w-52 rounded-lg border border-slate-700 bg-slate-900/78 p-3 shadow-2xl backdrop-blur-lg">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-400">Legend</p>
              <button
                onClick={() => setShowLegend(false)}
                className="rounded-full border border-slate-600 p-1.5 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                title="Close legend"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs text-slate-200">
              <div>
                {/* <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Rivers</p> */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-7 rounded-full" style={{ backgroundColor: '#0066CC' }} />
                    <span>Varuna</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-7 rounded-full" style={{ backgroundColor: '#9c00aaff' }} />
                    <span>Basuhi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-7 rounded-full" style={{ backgroundColor: '#FF6600' }} />
                    <span>Morwa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-0 w-7 border-t-2 border-dashed" style={{ borderColor: '#8B4513' }} />
                    <span>Boundary</span>
                  </div>
                </div>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Stations</p>
                <div className="space-y-1.5">
                  {stationLegendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ backgroundColor: item.color }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLegend(true)}
            className="absolute bottom-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-sm border border-slate-700 bg-black text-sm font-bold text-white shadow-xl transition-colors hover:bg-slate-900"
            title="Show legend"
          >
            L
          </button>
        )}

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

      <div className="relative z-10 h-full w-[330px] border-l border-slate-700/50 bg-slate-600 shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-700/50 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Station Details</p>
                <h3 className="mt-2 text-lg font-bold text-white">
                  {selectedStationInfo ? selectedStationInfo.location : 'Select a monitoring point'}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedStationInfo
                    ? `${selectedStationInfo.stream || 'Unknown stream'} • ${selectedYear}`
                    : 'Click any station marker on the map to inspect its water quality values.'}
                </p>
              </div>
              {selectedStationInfo && (
                <button
                  onClick={() => {
                    if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
                    setSelectedStationInfo(null);
                  }}
                  className="rounded-full border border-slate-600 p-2 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
            {selectedStationInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                      {getParameterName(currentParameter)}
                    </p>
                    <p
                      className="mt-2 text-3xl font-bold"
                      style={{ color: getParameterColor(currentParameter, getParameterValue(selectedStationInfo, currentParameter)) }}
                    >
                      {formatNumericValue(getParameterValue(selectedStationInfo, currentParameter), 1)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {getQualityStatus(currentParameter, getParameterValue(selectedStationInfo, currentParameter))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Coordinates</p>
                    <div className="mt-2 space-y-2 text-sm font-semibold text-white">
                      <p>Lat: {formatNumericValue(selectedStationInfo.lat, 5)}</p>
                      <p>Lon: {formatNumericValue(selectedStationInfo.lon, 5)}</p>
                    </div>
                    {/* <p className="mt-2 text-sm text-slate-300">{drainStations.length} stations in {selectedYear}</p> */}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {detailFields.map((field) => (
                    <div key={field.label} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{field.label}</p>
                      <p className="mt-2 text-sm font-semibold text-white break-words">{field.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <div className="max-w-xs rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                    <Droplets className="h-7 w-7" />
                  </div>
                  <h4 className="mt-4 text-lg font-bold text-white">No station selected</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Select any point on the map to view its sampling date, coordinates, and full water quality readings here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
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
  /* Container styling */
:global(#custom-scale-container .ol-scale-line) {
  position: relative !important;
  background: rgba(15, 23, 42, 0.85) !important; /* Dark background so text is visible */
  padding: 10px !important;
  border-radius: 6px !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  bottom: auto !important;
  left: auto !important;
}

/* Force the scale bar and text to be visible */
:global(#custom-scale-container .ol-scale-line-inner) {
  color: #22d3ee !important; /* Cyan text */
  border-color: #22d3ee !important; /* Cyan bar */
  font-weight: bold !important;
  font-size: 11px !important;
}
      `}</style>
    </div>
  );
};

export default VarunaMap;
