'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
  useMemo,
} from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style';
import Text from 'ol/style/Text';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import { useLocationContext } from './LocationContext';
import XYZ from 'ol/source/XYZ';
import { BaseMapDefinition } from '@/components/MapComponents';

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


interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  changeBaseMap: (baseMapKey: string) => void;
  setMapContainer: (container: HTMLDivElement | null) => void;
  isLoading: boolean;
  error: string | null;
  showLabels: boolean;
  toggleLabels: () => void;
}

interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  selectedBaseMap: "osm",
  changeBaseMap: () => {},
  setMapContainer: () => {},
  isLoading: true,
  error: null,
  showLabels: false,
  toggleLabels: () => {},
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const stateLayerRef = useRef<VectorLayer<any> | null>(null);
  const districtLayerRef = useRef<VectorLayer<any> | null>(null);
  const villageLayerRef = useRef<VectorLayer<any> | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("satellite");
  const { selectedState, selectedDistricts, selectedSubDistricts } = useLocationContext();

  const toggleLabels = () => setShowLabels((s) => !s);

  // Base styles
  const boundaryLayerStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: '#1e88e5', width: 1.5 }),
        fill: new Fill({ color: 'rgba(30,136,229,0.04)' }),
      }),
    []
  );

  const districtBaseStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: 'rgba(0,100,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(0, 100, 0, 0.05)' }),
      }),
    []
  );

  const subdistrictBaseStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: 'rgba(100,0,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(100, 0, 0, 0.05)' }),
      }),
    []
  );

  const villageBaseStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: 'rgba(100,100,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(100, 100, 0, 0.05)' }),
      }),
    []
  );

  const changeBaseMap = (baseMapKey: string) => {
  if (!mapInstanceRef.current) return;
  if (baseMapKey === selectedBaseMap) return;

  const baseMapDef = baseMaps[baseMapKey];
  if (!baseMapDef) return;

  const map = mapInstanceRef.current;

  // Remove existing base layer if present
  if (baseLayerRef.current) {
    map.removeLayer(baseLayerRef.current);
    baseLayerRef.current = null;
  }

  // Create new base layer from selected base map
  const newBaseLayer = new TileLayer({
    source: baseMapDef.source(),
    zIndex: 0,
  });
  newBaseLayer.set('name', 'basemap');
  baseLayerRef.current = newBaseLayer;

  // Add new base layer to map, at the bottom
  map.getLayers().insertAt(0, newBaseLayer);

  // Update selected base map state
  setSelectedBaseMap(baseMapKey);
};


  // Style functions with label toggle
  const makeDistrictStyleFn = useMemo(
    () => (feature: any) => {
      if (!showLabels) return districtBaseStyle;
      const txt = String(
        feature.get('district_name') ||
          feature.get('DISTRICT_N') ||
          feature.get('district_code') ||
          feature.get('DISTRICT_C') ||
          ''
      );
      return new Style({
        stroke: new Stroke({ color: 'rgba(0,100,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(0, 100, 0, 0.05)' }),
        text: new Text({
          text: txt,
          font: '600 12px sans-serif',
          fill: new Fill({ color: '#0b5394' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
          overflow: true,
        }),
      });
    },
    [showLabels, districtBaseStyle]
  );

  const makeSubdistrictStyleFn = useMemo(
    () => (feature: any) => {
      if (!showLabels) return subdistrictBaseStyle;
      const txt = String(
        feature.get('subdistrict_name') ||
          feature.get('SUBDIS_NAM') ||
          feature.get('subdistrict_code') ||
          feature.get('SUBDIS_COD') ||
          ''
      );
      return new Style({
        stroke: new Stroke({ color: 'rgba(100,0,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(100, 0, 0, 0.05)' }),
        text: new Text({
          text: txt,
          font: '600 12px sans-serif',
          fill: new Fill({ color: '#0b5394' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
          overflow: true,
        }),
      });
    },
    [showLabels, subdistrictBaseStyle]
  );

  const makeVillageStyleFn = useMemo(
    () => (feature: any) => {
      if (!showLabels) return villageBaseStyle;
      const txt = String(
        feature.get('village_name') ||
          feature.get('VILL_NAME') ||
          feature.get('village_code') ||
          feature.get('VILLAGE_CO') ||
          ''
      );
      return new Style({
        stroke: new Stroke({ color: 'rgba(100,100,0,0.6)', width: 1 }),
        fill: new Fill({ color: 'rgba(100, 100, 0, 0.05)' }),
        text: new Text({
          text: txt,
          font: '600 10px sans-serif',
          fill: new Fill({ color: '#0b5394' }),
          stroke: new Stroke({ color: 'white', width: 2 }),
          overflow: true,
        }),
      });
    },
    [showLabels, villageBaseStyle]
  );

  // Helper: remove a vector layer safely
  const removeLayerIfPresent = (layerRef: React.MutableRefObject<VectorLayer<any> | null>) => {
    const map = mapInstanceRef.current;
    if (map && layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  };

  // Map init with basemap and permanent India layer
  useEffect(() => {
    if (!mapContainer) return;
    if (mapInstanceRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const base = new TileLayer({
        source: new OSM({ crossOrigin: 'anonymous', attributions: '© OpenStreetMap contributors' }),
        zIndex: 0,
      });
      base.set('name', 'basemap');
      baseLayerRef.current = base;

      // Permanent India boundary layer (always present)
      const indiaLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url:
            '/geoserver/api/myworkspace/wfs' +
            '?service=WFS&version=1.0.0&request=GetFeature' +
            '&typeName=myworkspace:B_State&outputFormat=application/json',
        }),
        style: boundaryLayerStyle,
        zIndex: 1,
      });
      indiaLayer.set('name', 'india');
      indiaLayerRef.current = indiaLayer;

      const map = new Map({
        target: mapContainer,
        layers: [base, indiaLayer],
        view: new View({
          center: fromLonLat([78.9629, 20.5937]),
          zoom: 4,
        }),
      });

      mapInstanceRef.current = map;
      setMapInstance(map);

      // Ensure size to avoid white map
      const updateSize = () => {
        try {
          map.updateSize();
        } catch {}
      };
      updateSize();
      setTimeout(updateSize, 50);
      setTimeout(updateSize, 200);
      window.addEventListener('resize', updateSize);

      map.once('rendercomplete', () => setIsLoading(false));
      const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

      // Diagnostics
      indiaLayer.getSource()?.on('featuresloaderror', () => {
        setError((e) => e ?? 'Failed to load India boundary');
      });

      return () => {
        clearTimeout(loadingTimeout);
        window.removeEventListener('resize', updateSize);
        map.setTarget(undefined);
        mapInstanceRef.current = null;
        setMapInstance(null);
        setIsLoading(true);
        setError(null);
        baseLayerRef.current = null;
        indiaLayerRef.current = null;
        stateLayerRef.current = null;
        districtLayerRef.current = null;
        villageLayerRef.current = null;
      };
    } catch {
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  }, [mapContainer, boundaryLayerStyle]);

  // Add hover functionality
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

          // Skip highlight layer itself
          if (layerName === 'highlight-layer') {
            return false;
          }

          const properties = feature.getProperties();
          let label = '';

          // Determine label based on layer name
          switch (layerName) {
            case 'india':
              label = properties.STATE || properties.State || properties.state || 
                      properties.state_name || properties.STATE_NAME;
              break;

            case 'state-districts':
              label = properties.DISTRICT_N || properties.District_N || 
                      properties.district_name || properties.district || 
                      properties.DISTRICT;
              break;

            case 'district-subdistricts':
              label = properties.SUBDIS_NAM || properties.Subdis_Nam || 
                      properties.subdistrict_name || properties.subdistrict || 
                      properties.SUB_DISTRI;
              break;

            case 'villages':
              label = properties.VILL_NAME || properties.Vill_Name || 
                      properties.village_name || properties.village || 
                      properties.VILLAGE;
              break;

            default:
              label = properties.name || properties.NAME || 
                      properties.village_name || properties.VILL_NAME ||
                      properties.district_name || properties.DISTRICT_N ||
                      properties.subdistrict_name || properties.SUBDIS_NAM;
          }

          if (label && hoverOverlay) {
            // Highlight the feature
            if (highlightSource && feature instanceof Feature) {
              const clonedFeature = feature.clone() as Feature<Geometry>;
              clonedFeature.setId(feature.getId());
              highlightSource.addFeature(clonedFeature);
            }

            // Show label
            hoverElement.textContent = label;
            hoverOverlay.setPosition(event.coordinate);
            foundFeature = true;
            setHoveredFeature(feature);

            const target = mapInstanceRef.current?.getTargetElement();
            if (target) {
              target.style.cursor = 'pointer';
            }

            return true;
          }
          return false;
        },
        {
          layerFilter: (layer) => {
            const layerName = layer.get('name');
            return layerName !== 'highlight-layer';
          },
          hitTolerance: 5
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

        const target = mapInstanceRef.current?.getTargetElement();
        if (target) {
          target.style.cursor = '';
        }
      }
    };

    mapInstanceRef.current.on('pointermove', handlePointerMove);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.un('pointermove', handlePointerMove);

        if (highlightLayerRef.current) {
          mapInstanceRef.current.removeLayer(highlightLayerRef.current);
          highlightLayerRef.current = null;
        }
      }
    };
  }, [mapInstanceRef.current]);

  // Load districts when state is selected (state layer slot)
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!map || !selectedState) {
      removeLayerIfPresent(stateLayerRef);
      removeLayerIfPresent(districtLayerRef);
      removeLayerIfPresent(villageLayerRef);
      return;
    }

    // Replace state layer (district polygons filtered by state)
    removeLayerIfPresent(stateLayerRef);

    const cql = `STATE_CODE='${selectedState}'`;
    const wfsUrl =
      `/geoserver/api/myworkspace/wfs` +
      `?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=myworkspace:B_district` +
      `&outputFormat=application/json` +
      `&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url: wfsUrl }),
      style: makeDistrictStyleFn,
      declutter: true,
      zIndex: 2,
    });
    layer.set('name', 'state-districts');
    stateLayerRef.current = layer;
    map.addLayer(layer);

    const src = layer.getSource();
    if (src) {
      src.on('featuresloaderror', () => setError('Failed to load districts'));
      src.on('featuresloadend', () => {
        const extent = src.getExtent();
        if (extent && extent[0] < extent[2] && extent[1] < extent[3]) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
        }
      });
    }

    return () => removeLayerIfPresent(stateLayerRef);
  }, [selectedState, makeDistrictStyleFn]);

  // Load subdistricts when districts are selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedDistricts.length === 0) {
      removeLayerIfPresent(districtLayerRef);
      removeLayerIfPresent(villageLayerRef);
      return;
    }

    removeLayerIfPresent(stateLayerRef);
    removeLayerIfPresent(districtLayerRef);

    const districtCodes = selectedDistricts.map((d) => `'${d}'`).join(',');
    const cql = `DISTRICT_C IN (${districtCodes})`;
    const wfsUrl =
      `/geoserver/api/myworkspace/wfs` +
      `?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=myworkspace:B_subdistrict` +
      `&outputFormat=application/json` +
      `&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url: wfsUrl }),
      style: makeSubdistrictStyleFn,
      declutter: true,
      zIndex: 3,
    });
    layer.set('name', 'district-subdistricts');
    districtLayerRef.current = layer;
    map.addLayer(layer);

    const src = layer.getSource();
    if (src) {
      src.on('featuresloaderror', () => setError('Failed to load subdistricts'));
      src.on('featuresloadend', () => {
        const extent = src.getExtent();
        if (extent && extent[0] < extent[2] && extent[1] < extent[3]) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
        }
      });
    }

    return () => removeLayerIfPresent(districtLayerRef);
  }, [selectedDistricts, makeSubdistrictStyleFn]);

  // Load villages when subdistricts are selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedSubDistricts.length === 0) {
      removeLayerIfPresent(villageLayerRef);
      return;
    }

    removeLayerIfPresent(districtLayerRef);
    removeLayerIfPresent(villageLayerRef);

    const subCodes = selectedSubDistricts.map((s) => `'${s}'`).join(',');
    const cql = `SUBDIS_COD IN (${subCodes})`;
    const wfsUrl =
      `/geoserver/api/myworkspace/wfs` +
      `?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=myworkspace:Village` +
      `&outputFormat=application/json` +
      `&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url: wfsUrl }),
      style: makeVillageStyleFn,
      declutter: true,
      zIndex: 4,
    });
    layer.set('name', 'villages');
    villageLayerRef.current = layer;
    map.addLayer(layer);

    const src = layer.getSource();
    if (src) {
      src.on('featuresloaderror', () => setError('Failed to load villages'));
      src.on('featuresloadend', () => {
        const extent = src.getExtent();
        if (extent && extent[0] < extent[2] && extent[1] < extent[3]) {
          map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 800 });
        }
      });
    }

    return () => removeLayerIfPresent(villageLayerRef);
  }, [selectedSubDistricts, makeVillageStyleFn]);

  // Refresh styles on label toggle
  useEffect(() => {
    if (stateLayerRef.current) {
      stateLayerRef.current.setStyle(makeDistrictStyleFn);
      stateLayerRef.current.changed();
    }
    if (districtLayerRef.current) {
      districtLayerRef.current.setStyle(makeSubdistrictStyleFn);
      districtLayerRef.current.changed();
    }
    if (villageLayerRef.current) {
      villageLayerRef.current.setStyle(makeVillageStyleFn);
      villageLayerRef.current.changed();
    }
  }, [showLabels, makeDistrictStyleFn, makeSubdistrictStyleFn, makeVillageStyleFn]);

const contextValue = useMemo(
  () => ({
    mapInstance,
    setMapContainer,
    selectedBaseMap,
    isLoading,
    error,
    showLabels,
    toggleLabels,
    changeBaseMap, // refer to the implemented changeBaseMap function
  }),
  [mapInstance, isLoading, error, showLabels, selectedBaseMap]
);


  return <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>;
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }
  return context;
};