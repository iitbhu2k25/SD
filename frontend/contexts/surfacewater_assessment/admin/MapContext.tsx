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
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Fill, Stroke, Style } from 'ol/style';
import Text from 'ol/style/Text';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { useLocationContext } from './LocationContext';

interface MapContextType {
  mapInstance: Map | null;
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

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState<boolean>(false);

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
      isLoading,
      error,
      showLabels,
      toggleLabels,
    }),
    [mapInstance, isLoading, error, showLabels]
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
