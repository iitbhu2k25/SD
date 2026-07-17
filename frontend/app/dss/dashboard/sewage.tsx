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
import { Style, Stroke, Fill, Icon } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { Select } from 'ol/interaction';
import { click } from 'ol/events/condition';

interface SewageInfrastructureProps {
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

interface ShapefileLayer {
  id: string;
  name: string;
  displayName: string;
  color: string;
  visible: boolean;
  features?: number;
}

interface FeatureProperties {
  [key: string]: any;
}

// --- 1. CUSTOM ICON GENERATOR (Updated STP & Selection Logic) ---
const getLayerIcon = (layerId: string, color: string, isSelected: boolean = false) => {
  let svgPath = '';
  const viewBox = '0 0 24 24';
  
  // Selection Styles
  const strokeColor = isSelected ? '#FFFF00' : 'white'; // Yellow stroke if selected
  const strokeWidth = isSelected ? '3.5' : '1.5';       // Thicker stroke if selected
  const scale = isSelected ? 1.3 : 1.0;                 // Bigger size if selected

  switch (layerId) {
    case 'untapped_drain': // Red - Triangle Pennant
      svgPath = `<path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M4 2v20h2V14h14L4 2z"/>`;
      break;
    case 'tapped': // Green - Long Rectangular Flag
      svgPath = `<path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M4 2v20h2v-8h14l-2-5 2-5H6z"/>`;
      break;
    case 'partial_tapped_drain': // Orange - Swallowtail Flag
      svgPath = `<path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M4 2v20h2v-8h12l-4-5 4-5H6z"/>`;
      break;
    case 'STP': // Blue - Square Flag (Distinct from others but still a flag)
      svgPath = `<path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M4 2v20h2v-8h12V2H4z"/>`;
      break;
    default: // Fallback
      svgPath = `<path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>`;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="${viewBox}">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
      </filter>
      <g filter="url(#shadow)">
        ${svgPath}
      </g>
    </svg>`;
    
  return { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), scale };
};

const SewageInfrastructure: React.FC<SewageInfrastructureProps> = ({ showNotification }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState<'osm' | 'satellite'>('osm');
  const [loading, setLoading] = useState(false);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<FeatureProperties | null>(null);
  const [selectedFeatureName, setSelectedFeatureName] = useState<string>('');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const [layers, setLayers] = useState<ShapefileLayer[]>([
    { id: 'partial_tapped_drain', name: 'partial_tapped_drain', displayName: 'Partial Tapped Drain', color: '#FFA500', visible: true },
    { id: 'tapped', name: 'tapped', displayName: 'Tapped Drain', color: '#22c55e', visible: true },
    { id: 'untapped_drain', name: 'untapped_drain', displayName: 'Untapped Drain', color: '#ef4444', visible: true },
    { id: 'STP', name: 'STP', displayName: 'STP (Sewage Treatment Plant)', color: '#3b82f6', visible: true },
  ]);

  const layerRefsRef = useRef<{ [key: string]: VectorLayer<VectorSource> }>({});
  const basinLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayersRef = useRef<{ [key: string]: VectorLayer<VectorSource> }>({}); 
  const baseMapsRef = useRef<{ [key: string]: TileLayer<OSM | XYZ> }>({});
  const API_BASE = `${process.env.NEXT_PUBLIC_FAST_URL}/drain-water-quality/`;

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      console.log("✅ Map init: Creating map instance...");
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
          zoom: 9,
          maxZoom: 19,
          minZoom: 8,
        }),
        controls: defaultControls().extend([new ScaleLine({ units: 'metric' })]),
      });

      const selectInteraction = new Select({
        condition: click,
        // ✅ FILTER: Ignore Basin AND Rivers.
        filter: (feature) => {
            const layerId = feature.get('__layer_id');
            return layerId && layerId !== 'Basin' && layerId !== 'River';
        },
        style: (feature) => {
          const layerId = feature.get('__layer_id');
          const color = feature.get('__color') || '#00FFFF';
          
          // ✅ Highlight Logic: Pass true for isSelected
          const iconData = getLayerIcon(layerId, color, true);

          return new Style({
              image: new Icon({
                src: iconData.src,
                scale: iconData.scale, // Scale is handled inside getLayerIcon for selection
                anchor: [0.1, 1],
              }),
              zIndex: 999 // Bring selected to front
          });
        },
      });

      selectInteraction.on('select', (e) => {
        if (e.selected.length > 0) {
          const feature = e.selected[0];
          const properties = feature.getProperties();
          const featureId = feature.getId() || `feature-${Date.now()}`;
          
          setSelectedFeatureInfo(properties);
          setSelectedFeatureName(properties.name || properties.id || 'Feature Details');
          setSelectedFeatureId(String(featureId));
        } else {
          setSelectedFeatureInfo(null);
          setSelectedFeatureName('');
          setSelectedFeatureId(null);
        }
      });

      map.addInteraction(selectInteraction);
      selectInteractionRef.current = selectInteraction;
      mapInstanceRef.current = map;
      
      setIsMapReady(true);
    } catch (error) {
      console.error('❌ Map init error:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Load Data
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const loadAllLayers = async () => {
      setLoading(true);
      await loadRivers();
      await loadBasin();
      await loadInfrastructurePoints();
      setLoading(false);
    };

    const loadRivers = async () => {
        const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
        const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;
        const geoJson = new GeoJSON();

        const riverDefs = [
            { name: 'Varuna', key: 'varuna', color: '#0066CC', width: 5, zIndex: 22 },
            { name: 'Basuhi', key: 'basuhi', color: '#9c00aa', width: 3, zIndex: 21 },
            { name: 'Morwa',  key: 'morwa',  color: '#FF6600', width: 3, zIndex: 21 },
        ];

        const promises = riverDefs.map(({ name, key, color, width, zIndex }) =>
            fetch(`${WFS_BASE}&typeName=dss_vector:Rivers&CQL_FILTER=River_Name='${name}'`)
                .then(r => r.json())
                .then(geojson => {
                    if (!mapInstanceRef.current) return;
                    const layer = new VectorLayer({
                        source: new VectorSource({ features: geoJson.readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
                        style: new Style({ stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }) }),
                        zIndex,
                    });
                    mapInstanceRef.current.addLayer(layer);
                    riverLayersRef.current[key] = layer;
                })
                .catch(e => console.error(`Error loading ${name}:`, e))
        );

        await Promise.allSettled(promises);
    };

    const loadBasin = async () => {
        try {
            const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
            const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;
            const response = await fetch(`${WFS_BASE}&typeName=dss_vector:basin_boundary`);
            if (!response.ok) return;
            const geojson = await response.json();
            const features = new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' });
            if (!features.length || !mapInstanceRef.current) return;

            const basinLayer = new VectorLayer({
                source: new VectorSource({ features }),
                style: new Style({
                    stroke: new Stroke({ color: '#8B4513', width: 2.5 }),
                    fill: new Fill({ color: 'rgba(139,69,19,0.05)' }),
                }),
                zIndex: 10,
            });

            mapInstanceRef.current.addLayer(basinLayer);
            basinLayerRef.current = basinLayer;

            mapInstanceRef.current.getView().fit(
                [...fromLonLat([82.38, 25.25]), ...fromLonLat([83.75, 25.95])] as [number, number, number, number],
                { padding: [40, 40, 40, 320], maxZoom: 9 }
            );
        } catch (e) { console.error("Error loading basin:", e); }
    };

    const loadInfrastructurePoints = async () => {
        const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
        const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;
        const geoJson = new GeoJSON();

        const geoserverLayerName: Record<string, string> = {
            partial_tapped_drain: 'dss_vector:partial_tapped_drain',
            tapped: 'dss_vector:tapped',
            untapped_drain: 'dss_vector:untapped_drain',
            STP: 'dss_vector:Export_Output_5',
        };

        for (const layer of layers) {
            if (!layer.visible) continue;
            try {
              let geojson: any;
              const response = await fetch(`${WFS_BASE}&typeName=${geoserverLayerName[layer.id]}`);
              if (!response.ok) continue;
              geojson = await response.json();

              // GeoServer returns EPSG:404000 (non-standard) but coords are lon/lat — force 4326
              const features = geoJson.readFeatures(geojson, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
              features.forEach(feature => {
                feature.set('__layer_id', layer.id);
                feature.set('__color', layer.color);
              });

              const iconData = getLayerIcon(layer.id, layer.color, false);
              const vectorLayer = new VectorLayer({
                source: new VectorSource({ features }),
                style: new Style({
                  image: new Icon({
                    src: iconData.src,
                    scale: iconData.scale,
                    anchor: [0.1, 1],
                  }),
                }),
                zIndex: 100,
                visible: true,
              });

              if (mapInstanceRef.current) {
                mapInstanceRef.current.addLayer(vectorLayer);
                layerRefsRef.current[layer.id] = vectorLayer;
                setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, features: features.length } : l));
              }
            } catch (e) { console.error(`Error loading ${layer.id}:`, e); }
        }
    };

    loadAllLayers();
  }, [isMapReady]);

  const toggleLayer = (layerId: string) => {
    const newLayers = layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
    setLayers(newLayers);
    const vectorLayer = layerRefsRef.current[layerId];
    if (vectorLayer) vectorLayer.setVisible(!vectorLayer.getVisible());
  };

  const changeBasemap = (basemap: 'osm' | 'satellite') => {
    setCurrentBasemap(basemap);
    if (baseMapsRef.current.osm) baseMapsRef.current.osm.setVisible(basemap === 'osm');
    if (baseMapsRef.current.satellite) baseMapsRef.current.satellite.setVisible(basemap === 'satellite');
  };

  const closePopup = () => {
    if (selectInteractionRef.current) selectInteractionRef.current.getFeatures().clear();
    setSelectedFeatureInfo(null);
    setSelectedFeatureName('');
    setSelectedFeatureId(null);
  };
  
  const getDisplayProperties = (properties: FeatureProperties | null): FeatureProperties => {
    if (!properties) return {};
    const layerId = properties.__layer_id;
    let rules: { [key: string]: string | null } | null = null;
    const filteredProperties: FeatureProperties = {};

    if (layerId === 'STP') {
      rules = {
        "Name": "STP Name", "Districs": "District", "City_Town": "City / Town", "STP_Status": "Status",
        "BOD_mg_l": "BOD (mg/l)", "Filter": "Filter", "S_No": null, "STP_Name": null, "Compliant": null,
        "STP_Type": null, "Join": null, "BOD_mg_l1": null, "BOD_mg_l_1": null, "Capacity__": null,
        "Last_Updat": null, "Source_Fil": null, "Utilizatio": null,
      };
    } else if (['partial_tapped_drain', 'tapped', 'untapped_drain'].includes(layerId)) {
      rules = { "S_No": null, "Last_Updat": null };
    }

    if (!rules) {
      Object.keys(properties).filter(k => !k.startsWith('geometry') && !k.startsWith('__')).forEach(k => filteredProperties[k] = properties[k]);
      return filteredProperties;
    }

    for (const originalKey in rules) {
      if (properties.hasOwnProperty(originalKey)) {
        const newKey = rules[originalKey];
        if (newKey !== null) filteredProperties[newKey] = properties[originalKey];
      }
    }
    Object.keys(properties).filter(k => !k.startsWith('geometry') && !k.startsWith('__') && !rules.hasOwnProperty(k)).forEach(k => filteredProperties[k] = properties[k]);

    if (layerId === 'STP' && properties.Utilizatio) {
        filteredProperties['Utilization'] = properties.Capacity__ ? `${properties.Utilizatio} / ${properties.Capacity__}` : properties.Utilizatio;
    }
    return filteredProperties;
  };

  return (
    <div className="space-y-6">
      <style>{`
        .toggle-switch { position: relative; display: inline-block; width: 40px; height: 20px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.4s; border-radius: 20px; }
        .toggle-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: 0.4s; border-radius: 50%; }
        input:checked + .toggle-slider { background-color: #2563eb; }
        input:checked + .toggle-slider:before { transform: translateX(20px); }
      `}</style>

      <div className="
        bg-gradient-to-r 
        from-green-400 
        via-cyan-500 
        to-blue-600 
        rounded-t-lg 
        p-6 
        text-white 
        text-center
      ">
        <h1 className="text-3xl font-bold mb-1">Sewage Infrastructure</h1>
        <p className="text-white/90 text-sm">Near Real-time monitoring system</p>
      </div>

      <div className="grid grid-cols-12 gap-6 px-6 pb-6">
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 border-b pb-2">Infrastructure Layers</h3>
            <div className="space-y-3">
              {layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0">
                        <img src={getLayerIcon(layer.id, layer.color, false).src} alt="flag" className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{layer.displayName}</p>
                      <p className="text-xs text-gray-500">{layer.features || 0} locations</p>
                    </div>
                  </div>
                  <label className="toggle-switch flex-shrink-0 ml-2">
                    <input type="checkbox" checked={layer.visible} onChange={() => toggleLayer(layer.id)} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Basemap */}
          <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Basemap</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => changeBasemap('osm')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${currentBasemap === 'osm' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Streets</button>
              <button onClick={() => changeBasemap('satellite')} className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${currentBasemap === 'satellite' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Satellite</button>
            </div>
          </div>

          {/* ✅ SUMMARY RESTORED */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md p-4 border border-green-100">
              <h3 className="text-xs font-bold text-green-800 uppercase mb-3 flex items-center gap-2">
                  <span></span> Summary
              </h3>
              <div className="space-y-1">
                  {layers.map(l => (
                      <div key={l.id} className="flex justify-between text-xs">
                          <span className="text-gray-700 truncate pr-2">{l.displayName}:</span>
                          <span className="font-bold text-green-700">{l.features || 0}</span>
                      </div>
                  ))}
              </div>
          </div>
        </div>

        <div className="col-span-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 h-[600px] relative">
            <div ref={mapRef} className="w-full h-full bg-gray-100" />
            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                <span className="text-gray-600 font-medium text-sm">Loading infrastructure data...</span>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3">
          <div className="bg-white rounded-xl shadow-md p-0 overflow-hidden border border-gray-100 h-[600px] flex flex-col">
            <div className="p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><span>📋</span> Feature Details</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {selectedFeatureInfo ? (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">📍</div>
                        <div>
                            <p className="font-bold text-gray-900 text-sm">{selectedFeatureName}</p>
                            <p className="text-xs text-blue-600 mt-1 font-mono">ID: {selectedFeatureId}</p>
                        </div>
                    </div>
                    </div>
                    <div className="space-y-0 divide-y divide-gray-100">
                    {Object.entries(getDisplayProperties(selectedFeatureInfo)).map(([key, value]) => (
                        <div key={key} className="py-3 grid grid-cols-3 gap-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{key}</span>
                            <span className="col-span-2 text-sm text-gray-800 font-medium break-words text-right">{String(value)}</span>
                        </div>
                    ))}
                    </div>
                </div>
                ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
                    <div className="text-5xl mb-4 opacity-20">👆</div>
                    <p className="text-sm font-medium text-gray-500">Select a flag on the map</p>
                    <p className="text-xs mt-2">Click any infrastructure point to view details.</p>
                </div>
                )}
            </div>
            {selectedFeatureInfo && (
                <div className="p-4 border-t bg-gray-50">
                    <button onClick={closePopup} className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Close Selection</button>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SewageInfrastructure;