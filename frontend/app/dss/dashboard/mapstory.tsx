// mapstory.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import type { FeatureLike } from 'ol/Feature'; 
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { ChevronRight, Play, Square, ChevronLeft, MapPin, Info } from 'lucide-react'; 
import { Select } from 'ol/interaction';
import { click } from 'ol/events/condition';



interface MapStoryProps {
  showNotification?: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onInfoClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

interface LayerState {
  [key: string]: boolean;
}

interface StationData {
  id: string;
  lat: number;
  lon: number;
  image: string;
  description: string;
  location: string;
  remarks?: string;
  other?: string;
}

/**
 * Calculates the distance between two coordinates in kilometers
 * using the Haversine formula.
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/* --------------------------------------------------------------
   STATION STYLE - UPDATED WITH PIN LOGIC
   -------------------------------------------------------------- */
const createStationStyleFunction = (selectedStation: StationData | null) => {
  return (feature: FeatureLike) => {
    const isSelected = selectedStation?.id === feature.get('id');

    if (isSelected) {
      // 1. Background Highlight Circle (Kept exactly as requested)
      const circleStyle = new Style({
        image: new CircleStyle({
          radius: 14,
          fill: new Fill({ color: 'rgba(255, 23, 68, 0.3)' }), 
          stroke: new Stroke({ color: '#FFD700', width: 3 }), 
        }),
        zIndex: 9998,
      });

      // 2. The 📍 Pin Style
      const pinStyle = new Style({
        text: new Text({
          text: '📍',           // The pin emoji
          font: '26px sans-serif', 
          offsetY: -16,       // Adjust so tip touches the center
          padding: [0, 0, 0, 0],
        }),
        zIndex: 9999,
      });

      // 3. The Text Label (Moved up slightly to sit above the pin)
      const labelStyle = new Style({
        text: new Text({
          text: feature.get('location'),
          font: 'bold 14px Arial',
          offsetY: -42,       // Moved higher (-22 -> -42) to clear the pin
          fill: new Fill({ color: '#000' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
        }),
        zIndex: 10000,
      });

      // Return array of styles to render them all
      return [circleStyle, pinStyle, labelStyle];
    }

    // Default Unselected Style (Red Dot)
    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#FF6B6B' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      zIndex: 999,
    });
  };
};

/* --------------------------------------------------------------
   MAIN COMPONENT
   -------------------------------------------------------------- */
const MapStory: React.FC<MapStoryProps> = ({ showNotification = () => {}, onInfoClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);

  const [loadingRivers, setLoadingRivers] = useState(true);
  const [loadingStations, setLoadingStations] = useState(true);
  const [currentBasemap, setCurrentBasemap] = useState<'osm' | 'satellite'>('osm');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedDescription, setSelectedDescription] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [stations, setStations] = useState<StationData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const storyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DELAY_MS = 10000; // 3 seconds between stations

  const riverLayersRef = useRef<{ [key: string]: VectorLayer<VectorSource> }>({});
  const stationLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const baseMapsRef = useRef<{ [key: string]: TileLayer<OSM | XYZ> }>({});

  /* ---------- API BASE ---------- */
  const API_BASE = `${process.env.NEXT_PUBLIC_FAST_URL}`;

  /* ==============================================================
     1. INITIALISE MAP
     ============================================================== */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const osmLayer = new TileLayer({ source: new OSM(), visible: true });
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
      }),
      visible: false,
    });

    baseMapsRef.current = { osm: osmLayer, satellite: satelliteLayer };

    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer],
      view: new View({
        center: fromLonLat([83.065, 25.6]),
        zoom: 8,
        maxZoom: 18,
        minZoom: 8,
      }),
      // STRICTLY SET PIXEL RATIO TO 1 FOR IMAGE QUALITY
      pixelRatio: 1, 
      controls: defaultControls({ zoom: false }).extend([
        new ScaleLine({ units: 'metric', bar: true, steps: 4, text: true, minWidth: 140 }),
      ]),
    });

    mapInstanceRef.current = map;
    setTimeout(() => map.updateSize(), 100);
    showNotification('Success', 'Map initialized', 'success');

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
      if (storyTimeoutRef.current) {
        clearTimeout(storyTimeoutRef.current);
      }
    };
  }, []);

  /* ==============================================================
     2. FETCH STATIONS
     ============================================================== */
  useEffect(() => {
    const fetchAndProcessStations = async () => {
      try {
        setLoadingStations(true);
        setError(null);

        const url = `${API_BASE}/drain-water-quality/story-map/stations`;
        const response = await fetch(url, { headers: { Accept: 'application/json' } });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.status !== 'success' || !Array.isArray(data.stations)) {
          throw new Error('Invalid station data');
        }

        let transformed: StationData[] = data.stations.map((s: any) => ({
          id: s.id,
          location: s.location,
          lat: parseFloat(s.lat),
          lon: parseFloat(s.lon),
          image: s.image,
          description: s.description,
          remarks: s.remarks ?? '',
          other: s.other ?? '',
        }));

        if (transformed.length === 0) {
          showNotification('Info', 'No stations found', 'info');
          setLoadingStations(false);
          return;
        }

        // --- Sorting Logic ---
        const sortedPath: StationData[] = [];
        let remainingStations = [...transformed];
        let startIndex = remainingStations.findIndex((s) => {
          const filename = s.image.split('/').pop()?.toLowerCase();
          return (
            filename === 'origin.jpg' ||
            filename === 'origin.png' ||
            filename === 'origin.jpeg'
          );
        });
        
        if (startIndex === -1) {
          showNotification('Warning', 'Station with "origin" image not found. Starting with first available.', 'info');
          startIndex = 0;
        }
        
        let currentStation = remainingStations.splice(startIndex, 1)[0];
        sortedPath.push(currentStation);

        while (remainingStations.length > 0) {
          let nearestDist = Infinity;
          let nearestIdx = -1;

          remainingStations.forEach((station, index) => {
            const dist = getDistance(
              currentStation.lat,
              currentStation.lon,
              station.lat,
              station.lon
            );
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIdx = index;
            }
          });

          const nextStation = remainingStations.splice(nearestIdx, 1)[0];
          sortedPath.push(nextStation);
          currentStation = nextStation;
        }
        // --- End Sorting ---

        setStations(sortedPath);
        
        const first = sortedPath[0];
        setSelectedStation(first);
        setSelectedImage(first.image);
        setSelectedDescription(first.description);
        setCurrentStationIndex(0);
        
        showNotification('Success', `Loaded ${sortedPath.length} stations`, 'success');

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        showNotification('Error', `Failed to load stations: ${msg}`, 'error');
      } finally {
        setLoadingStations(false);
      }
    };

    fetchAndProcessStations();
  }, [API_BASE, showNotification]);


  /* ==============================================================
     3. LOAD RIVERS & BASINS (via GeoServer WMS)
     ============================================================== */
  const loadRiversAndBasins = () => {
    if (!mapInstanceRef.current) return;

    setLoadingRivers(true);

    // Remove any previously added WMS layers
    Object.values(riverLayersRef.current).forEach(layer => {
      mapInstanceRef.current?.removeLayer(layer);
    });
    riverLayersRef.current = {};

    const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
    const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;

    const riverDefs = [
      { name: 'Varuna', key: 'varuna', color: '#0066CC', width: 5, zIndex: 203 },
      { name: 'Basuhi', key: 'basuhi', color: '#9c00aa', width: 3, zIndex: 202 },
      { name: 'Morwa',  key: 'morwa',  color: '#FF6600', width: 3, zIndex: 201 },
    ];

    const promises = riverDefs.map(({ name, key, color, width, zIndex }) =>
      fetch(`${WFS_BASE}&typeName=dss_vector:Rivers&CQL_FILTER=River_Name='${name}'`)
        .then(r => r.json())
        .then(geojson => {
          if (!mapInstanceRef.current) return;
          const layer = new VectorLayer({
            source: new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
            style: new Style({ stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }) }),
            zIndex,
            properties: { name: key, displayName: name },
            visible: true,
          });
          riverLayersRef.current[key] = layer;
          mapInstanceRef.current.addLayer(layer);
        })
    );

    fetch(`${WFS_BASE}&typeName=dss_vector:basin_boundary`)
      .then(r => r.json())
      .then(geojson => {
        if (!mapInstanceRef.current) return;
        const layer = new VectorLayer({
          source: new VectorSource({ features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
          style: new Style({
            stroke: new Stroke({ color: '#8B4513', width: 2.5 }),
            fill: new Fill({ color: 'rgba(139,69,19,0.05)' }),
          }),
          zIndex: 100,
          properties: { name: 'basin', displayName: 'Basin Boundary' },
          visible: true,
        });
        riverLayersRef.current['basin'] = layer;
        mapInstanceRef.current.addLayer(layer);
      });

    Promise.allSettled(promises).then(() => {
      mapInstanceRef.current?.getView().fit(
        [...fromLonLat([82.38, 25.25]), ...fromLonLat([83.75, 25.95])] as [number, number, number, number],
        { padding: [40, 40, 40, 320], maxZoom: 9 }
      );
      setLoadingRivers(false);
    });
  };

  /* ==============================================================
     4. ADD STATIONS
     ============================================================== */
  const addStationsToMap = async () => {
    if (!mapInstanceRef.current || stations.length === 0) return;

    if (Object.keys(riverLayersRef.current).length === 0) {
      loadRiversAndBasins();
    }

    if (stationLayerRef.current) {
      mapInstanceRef.current.removeLayer(stationLayerRef.current);
    }

    const features = stations.map(s => new Feature({
      geometry: new Point(fromLonLat([s.lon, s.lat])),
      ...s,
    }));

    const layer = new VectorLayer({
      source: new VectorSource({ features }),
      style: createStationStyleFunction(selectedStation),
      zIndex: 1000,
    });

    stationLayerRef.current = layer;
    mapInstanceRef.current.addLayer(layer);

    const select = new Select({
      condition: click,
      layers: [layer],
      style: null,
    });

    select.on('select', e => {
      if (e.selected.length > 0) {
        const st = e.selected[0].getProperties() as StationData;
        const idx = stations.findIndex(s => s.id === st.id);
        
        handleStationSelect(st, idx, false);
      }
    });

    if (selectInteractionRef.current) {
      mapInstanceRef.current.removeInteraction(selectInteractionRef.current);
    }
    selectInteractionRef.current = select;
    mapInstanceRef.current.addInteraction(select);
  };

  useEffect(() => {
    if (stations.length > 0) {
      addStationsToMap();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  useEffect(() => {
    if (stationLayerRef.current) {
      stationLayerRef.current.setStyle(createStationStyleFunction(selectedStation));
    }
  }, [selectedStation]);


  const stopStory = useCallback(() => {
    setIsPlayingStory(false);
    if (storyTimeoutRef.current) {
      clearTimeout(storyTimeoutRef.current);
      storyTimeoutRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return () => {
      stopStory();
    }
  }, [stopStory]);


  /* ==============================================================
     HELPERS
     ============================================================== */
  const changeBasemap = (type: 'osm' | 'satellite') => {
    Object.values(baseMapsRef.current).forEach(l => l.setVisible(false));
    baseMapsRef.current[type]?.setVisible(true);
    setCurrentBasemap(type);
  };

  const handleStationSelect = (station: StationData, index: number, isAuto: boolean = false) => {
    if (!isAuto && isPlayingStory) {
      stopStory();
    }

    setSelectedStation(station);
    setSelectedImage(station.image);
    setSelectedDescription(station.description);
    setCurrentStationIndex(index);

    // **********************************************
    // ✨ CORE FIX: ZOOM TO SELECTED LOCATION
    // **********************************************
    mapInstanceRef.current?.getView().animate({
      center: fromLonLat([station.lon, station.lat]),
      zoom: 15, // Increased zoom level for a more significant zoom effect
      duration: 4000, // Smooth transition
    });
    // **********************************************
  };

  const handleNextStation = () => {
    if (stations.length === 0) return;
    if (isPlayingStory) stopStory();

    const nextIndex = (currentStationIndex + 1) % stations.length;
    handleStationSelect(stations[nextIndex], nextIndex, false);
  };

  const handlePreviousStation = () => {
    if (stations.length === 0) return;
    if (isPlayingStory) stopStory();

    const prevIndex = (currentStationIndex - 1 + stations.length) % stations.length;
    handleStationSelect(stations[prevIndex], prevIndex, false);
  };

  const playStoryStep = (index: number, stopIndex: number) => {
    if (index > stopIndex) {
      stopStory();
      return;
    }

    handleStationSelect(stations[index], index, true);

    storyTimeoutRef.current = setTimeout(() => {
      playStoryStep(index + 1, stopIndex);
    }, STORY_DELAY_MS);
  };

  const startStory = () => {
    if (stations.length === 0) return;

    setIsPlayingStory(true);

    const stopIndex = stations.findIndex((s) => {
      const filename = s.image.split('/').pop()?.toLowerCase();
      return (
        filename === 'confluence.jpg' ||
        filename === 'confluence.png' ||
        filename === 'confluence.jpeg'
      );
    });

    const endPoint = (stopIndex === -1) ? stations.length - 1 : stopIndex;
    playStoryStep(0, endPoint);
  };

  const toggleStoryMode = () => {
    if (isPlayingStory) {
      stopStory();
    } else {
      startStory();
    }
  };


  /* ==============================================================
     RENDER
     ============================================================== */
  return (
    <div className="relative w-full bg-gradient-to-br from-slate-100 to-slate-100 rounded-2xl overflow-hidden shadow-2xl">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-400 to-blue-400 text-white p-6 shadow-lg flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Story Map</h1>
            {onInfoClick && (
              <button
                onClick={(event) => onInfoClick(event)}
                className="w-7 h-7 rounded-full bg-white/90 text-blue-700 hover:bg-white flex items-center justify-center"
                aria-label="Story map info"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-white/80">Explore the water quality narrative through an interactive geographic story</p>
        </div>
        
        <div>
          <button
            onClick={toggleStoryMode}
            disabled={stations.length === 0 || loadingStations}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300
              ${isPlayingStory
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
              }
              disabled:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isPlayingStory ? (
              <>
                <Square className="w-4 h-4" />
                Stop Story
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-180px)]">
        {/* LEFT PANEL */}
        <div className="relative w-1/2 flex flex-col p-4 gap-4">
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm z-50 rounded-l-2xl p-6">
              <div className="bg-slate-800/95 py-4 px-6 rounded-lg shadow-2xl border border-slate-700 text-center max-w-md">
                <p className="text-red-400 font-bold mb-2">Failed to load stations</p>
                <p className="text-slate-300 text-sm mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 rounded font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* IMAGE DISPLAY */}
          <div className="flex-3/4 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-xl relative group">
            {selectedImage ? (
              <>
                {/* STRICTLY IMPROVE IMAGE QUALITY */}
                <img
                  src={selectedImage}
                  alt={selectedStation?.location}
                  className="w-full h-full" 
                  style={{ objectFit: 'contain' }}
                  loading="eager" 
                  onError={e => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600?text=Image+Not+Found'}
                />
                
                <button
                  onClick={handlePreviousStation}
                  className="absolute bottom-1 left-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white p-3 rounded-full shadow-lg transition-all transform hover:scale-110 z-10"
                  title="Previous Station"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={handleNextStation}
                  className="absolute bottom-1 right-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white p-3 rounded-full shadow-lg transition-all transform hover:scale-110 z-10"
                  title="Next Station"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-white/90 text-slate-800 px-4 py-2 rounded-lg border border-slate-200">
                  <p className="text-sm font-semibold">{selectedStation?.location}</p>
                </div>
              </>
            ) : (
              !loadingStations && (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <div className="text-5xl mb-2">Image</div>
                    <p>No stations loaded.</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* ===================================================================================== */}
          {/* MODIFIED SECTION: Split Description (75%) and Monitoring Stations (25%) side-by-side */}
          {/* ===================================================================================== */}
          <div className="flex-1/4 bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-row gap-4 overflow-hidden">
            
            {/* --- LEFT: DESCRIPTION (75%) --- */}
            <div className="w-3/4 flex flex-col border-r border-slate-200 pr-4">
              <h3 className="font-bold text-slate-800 mb-2 text-lg sticky top-0 bg-transparent z-10">Description</h3>
              <div className="overflow-y-auto pr-2 custom-scrollbar">
                {selectedDescription ? (
                  <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
                    {selectedDescription}
                  </p>
                ) : (
                  <p className="text-slate-500 italic text-sm">Select a station to view details.</p>
                )}
              </div>
            </div>

            {/* --- RIGHT: MONITORING STATIONS LIST (25%) --- */}
            <div className="w-1/4 flex flex-col">
              <h4 className="font-semibold text-slate-700 mb-2 text-xs uppercase tracking-wider text-center bg-slate-100 border border-slate-200 py-1 rounded">
                Stations ({stations.length})
              </h4>
              
              <div className="overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
                {stations.length > 0 ? (
                  stations.map((st, i) => (
                    <div
                      key={st.id}
                      onClick={() => handleStationSelect(st, i, false)}
                      className={`
                        p-2 rounded cursor-pointer transition-all text-xs border-l-4 
                        flex items-center justify-between
                        ${selectedStation?.id === st.id
                          ? 'bg-blue-50 text-slate-800 border-pink-500 shadow-sm'
                          : 'bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
                        }
                      `}
                    >
                      <p className="font-bold truncate">{i + 1}. {st.location}</p>
                      
                      {/* 📍 ADDED LOCATION PIN FOR SELECTED STATION */}
                      {selectedStation?.id === st.id && (
                          <MapPin className="w-3 h-3 text-pink-500 flex-shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-xs text-center italic py-4">No stations</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL – MAP */}
        <div className="w-1/2 p-4">
          <div className="flex flex-col h-full"> 
            <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 shadow-xl bg-slate-200 relative">
              <div ref={mapRef} className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-200" />
              <div className="absolute top-2.5 right-2.5 z-10 flex gap-1 bg-slate-800/80 p-1 rounded-lg backdrop-blur-sm border border-slate-700">
                <button
                  onClick={() => changeBasemap('osm')}
                  className={`px-3 py-1.5 text-xs rounded font-bold transition-all ${
                    currentBasemap === 'osm'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Streets
                </button>
                <button
                  onClick={() => changeBasemap('satellite')}
                  className={`px-3 py-1.5 text-xs rounded font-bold transition-all ${
                    currentBasemap === 'satellite'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Satellite
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIVER LOADING OVERLAY */}
      {loadingRivers && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm rounded-2xl z-40">
          <div className="bg-slate-800/95 py-4 px-6 rounded-lg shadow-2xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-400"></div>
              <span className="text-slate-200 font-medium">Loading rivers & basins...</span>
            </div>
          </div>
        </div>
      )}

      {/* Custom scrollbar */}
      <style jsx>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(51, 65, 85, 0.3); }
        ::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.5); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.8); }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      `}</style>
    </div>
  );
};

export default MapStory;
