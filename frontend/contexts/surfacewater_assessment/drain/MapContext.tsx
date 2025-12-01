"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useState,
  useMemo,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from "ol/Overlay";
import TileLayer from "ol/layer/Tile";
import { Tile as TileSource, XYZ } from 'ol/source';
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style } from "ol/style";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import { Geometry } from "ol/geom";

const baseMaps: Record<string, { name: string; source: () => TileSource; icon: string }> = {
  osm: {
    name: "OpenStreetMap",
    source: () => new OSM({ crossOrigin: "anonymous" }),
    icon: "M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146",
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
        crossOrigin: "anonymous",
      }),
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
};


// Mock context hooks - replace with your actual implementations
const useLocationContext = () => ({
  selectedSubbasins: [],
  toggleSubbasinByNumber: (num: number) => console.log('Toggle subbasin:', num)
});

interface MapContextType {
  mapInstance: Map | null;
  setMapContainer: (container: HTMLDivElement | null) => void;
  isLoading: boolean;
  error: string | null;
  selectedBaseMap: string;
  changeBaseMap: (key: string) => void;
}


interface MapProviderProps {
  children: ReactNode;
}

const MapContext = createContext<MapContextType>({
  mapInstance: null,
  setMapContainer: () => {},
  isLoading: true,
  error: null,
  selectedBaseMap: "osm",
  changeBaseMap: () => {},
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const varunaFullLayerRef = useRef<VectorLayer<any> | null>(null);
  const streamsFullLayerRef = useRef<VectorLayer<any> | null>(null);
  const basinLayerRef = useRef<VectorLayer<any> | null>(null);
  const streamsLayerRef = useRef<VectorLayer<any> | null>(null);
  
  // NEW: Hover overlay refs
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { selectedSubbasins, toggleSubbasinByNumber } = useLocationContext();
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const subbasinAttrNameRef = useRef<string>("Subbasin");
  const subbasinIsStringRef = useRef<boolean>(true);

  const boundaryLayerStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: "blue", width: 2 }),
        fill: new Fill({ color: "rgba(0, 0, 255, 0.1)" }),
      }),
    []
  );

  const varunaBaseStyleNoLabel = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: "rgba(0,0,0,0.6)", width: 1 }),
        fill: new Fill({ color: "rgba(0, 0, 0, 0.05)" }),
      }),
    []
  );

  const streamsBaseStyle = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: "rgba(30, 144, 255, 0.6)", width: 1.5 }),
      }),
    []
  );

  const selectedStyleNoLabel = useMemo(
    () =>
      new Style({
        stroke: new Stroke({ color: "red", width: 3 }),
        fill: new Fill({ color: "rgba(255, 0, 0, 0.2)" }),
      }),
    []
  );

  const changeBaseMap = (key: string) => {
  if (!mapInstanceRef.current) return;
  if (baseMaps[key] == null) return;
  if (key === selectedBaseMap) return;

  const map = mapInstanceRef.current;

  if (baseLayerRef.current) {
    map.removeLayer(baseLayerRef.current);
  }

  const newBaseLayer = new TileLayer({
    source: baseMaps[key].source(),
    zIndex: 0,
  });
  newBaseLayer.set("name", "basemap");
  baseLayerRef.current = newBaseLayer;
  map.getLayers().insertAt(0, newBaseLayer);

  setSelectedBaseMap(key);
};

  useEffect(() => {
    if (!mapContainer) return;
    if (mapInstanceRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const initialBaseLayer = new TileLayer({
        source: new OSM({
          crossOrigin: "anonymous",
          attributions: "© OpenStreetMap contributors",
        }),
        zIndex: 0,
      });

      const indiaLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url:
            "/geoserver/api/myworkspace/wfs" +
            "?service=WFS&version=1.0.0&request=GetFeature" +
            "&typeName=myworkspace:India" +
            "&outputFormat=application/json",
        }),
        style: boundaryLayerStyle,
        zIndex: 1,
      });

      const varunaFullLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url:
            "/geoserver/api/myworkspace/wfs" +
            "?service=WFS&version=1.0.0&request=GetFeature" +
            "&typeName=myworkspace:varuna_subbasin_data" +
            "&outputFormat=application/json",
        }),
        style: varunaBaseStyleNoLabel,
        declutter: true,
        zIndex: 2,
      });

      const streamsFullLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url:
            "/geoserver/api/myworkspace/wfs" +
            "?service=WFS&version=1.0.0&request=GetFeature" +
            "&typeName=myworkspace:Streams_clipped" +
            "&outputFormat=application/json",
        }),
        style: streamsBaseStyle,
        zIndex: 2.5,
      });

      initialBaseLayer.set("name", "basemap");
      indiaLayer.set("name", "india");
      varunaFullLayer.set("name", "varuna_full");
      streamsFullLayer.set("name", "streams_full");

      baseLayerRef.current = initialBaseLayer;
      indiaLayerRef.current = indiaLayer;
      varunaFullLayerRef.current = varunaFullLayer;
      streamsFullLayerRef.current = streamsFullLayer;

      const map = new Map({
        target: mapContainer,
        layers: [initialBaseLayer, indiaLayer, varunaFullLayer, streamsFullLayer],
        view: new View({
          center: fromLonLat([78.9629, 20.5937]),
          zoom: 4,
        }),
      });

      mapInstanceRef.current = map;
      setMapInstance(map);

      // NEW: Create hover overlay element
      const hoverElement = document.createElement('div');
      hoverElement.className = 'ol-hover-popup';
      hoverElement.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
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

      const hoverOverlay = new Overlay({
        element: hoverElement,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10],
      });

      map.addOverlay(hoverOverlay);
      hoverOverlayRef.current = hoverOverlay;

      // NEW: Create highlight layer
      const highlightStyle = new Style({
        fill: new Fill({
          color: 'rgba(59, 130, 246, 0.2)',
        }),
        stroke: new Stroke({
          color: '#f10606ff',
          width: 3,
        }),
      });

      const highlightLayer = new VectorLayer({
        source: new VectorSource(),
        style: highlightStyle,
        zIndex: 999,
      });

      highlightLayer.set('name', 'highlight-layer');
      map.addLayer(highlightLayer);
      highlightLayerRef.current = highlightLayer;

      map.once("rendercomplete", () => setIsLoading(false));
      const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

      const fullSrc = varunaFullLayer.getSource();
      const streamsSrc = streamsFullLayer.getSource();

      const isValidExtent = (extent?: number[]) => {
        return extent && 
               extent.length >= 4 && 
               extent[0] < extent[2] && 
               extent[1] < extent[3] &&
               isFinite(extent[0]) && isFinite(extent[1]) && 
               isFinite(extent[2]) && isFinite(extent[3]);
      };

      const fitToVarunaWhenReady = () => {
        const m = mapInstanceRef.current;
        if (!m) return;

        const varunaExtent = varunaFullLayerRef.current?.getSource()?.getExtent?.();
        
        if (isValidExtent(varunaExtent)) {
          console.log('Fitting to Varuna extent:', varunaExtent);
          m.getView().fit(varunaExtent!, { 
            padding: [50, 50, 50, 50], 
            duration: 800,
            maxZoom: 12
          });
        }
      };

      fullSrc?.on("featuresloadend", () => {
        console.log('Varuna features loaded');
        const feats = fullSrc.getFeatures();
        if (feats && feats.length) {
          const attr = subbasinAttrNameRef.current;
          subbasinIsStringRef.current = typeof feats[0]?.get(attr) === "string";
          console.log(`Loaded ${feats.length} Varuna features`);
        }
        fitToVarunaWhenReady();
      });

      streamsSrc?.on("featuresloadend", () => {
        console.log('Streams features loaded');
        const feats = streamsSrc.getFeatures();
        if (feats && feats.length) {
          console.log(`Loaded ${feats.length} stream features`);
        }
      });

      fullSrc?.on("featuresloaderror", (error) => {
        console.error('Error loading Varuna features:', error);
        setError("Failed to load Varuna basin. Check GeoServer or network.");
      });

      streamsSrc?.on("featuresloaderror", (error) => {
        console.error('Error loading streams:', error);
        setError("Failed to load streams. Check GeoServer or network.");
      });

      const handleClick = (evt: any) => {
        const fullLayer = varunaFullLayerRef.current;
        if (!fullLayer) return;
        map.forEachFeatureAtPixel(
          evt.pixel,
          (feature, layer) => {
            if (layer !== fullLayer) return false;
            const attr = subbasinAttrNameRef.current;
            const val = feature.get(attr);
            if (val === undefined || val === null) return false;
            const asNum = Number(val);
            if (!Number.isNaN(asNum)) {
              toggleSubbasinByNumber(asNum);
              return true;
            }
            const m = String(val).match(/(\d+)$/);
            if (m) {
              toggleSubbasinByNumber(Number(m[1]));
              return true;
            }
            return false;
          },
          { layerFilter: (lyr) => lyr === fullLayer, hitTolerance: 3 }
        );
      };

      map.on("singleclick", handleClick);

      // NEW: Handle pointer move for hover (moved inside useEffect to avoid dependency issues)
      const handlePointerMove = (event: any) => {
        const highlightSource = highlightLayerRef.current?.getSource();
        if (!highlightSource) return;

        const pixel = event.pixel;
        let foundFeature = false;

        highlightSource.clear();

        map.forEachFeatureAtPixel(
          pixel,
          (feature, layer) => {
            const layerName = layer?.get('name');

            if (layerName === 'highlight-layer') {
              return false;
            }

            const properties = feature.getProperties();
            let label = '';

            switch (layerName) {
              case 'india':
                const STATE = properties.STATE || properties.State;
                label = STATE ? ` ${STATE}` : 'India';
                break;

              case 'varuna_full':
                const subbasin = properties.Subbasin || properties.subbasin;
                label = subbasin ? `Subbasin ${subbasin}` : 'Varuna Subbasin';
                break;

              case 'streams_full':
                const streamId = properties.HYDROID || properties.HydroID;
                label = streamId ? `Stream ${streamId}` : 'Stream';
                break;

              case 'varuna_selected':
                const selectedSub = properties.Subbasin || properties.subbasin;
                label = selectedSub ? `Selected Subbasin ${selectedSub}` : 'Selected Subbasin';
                break;

              case 'streams_selected':
                const selectedStream = properties.HYDROID || properties.HydroID;
                label = selectedStream ? `Selected Stream ${selectedStream}` : 'Selected Stream';
                break;

              default:
                label = properties.name || properties.NAME || properties.Subbasin;
            }

            if (label && hoverOverlay) {
              if (feature instanceof Feature) {
                const clonedFeature = feature.clone() as Feature<Geometry>;
                clonedFeature.setId(feature.getId());
                highlightSource.addFeature(clonedFeature);
              }

              hoverElement.textContent = label;
              hoverOverlay.setPosition(event.coordinate);
              foundFeature = true;

              const target = map.getTargetElement();
              if (target) {
                target.style.cursor = "pointer";
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

        if (!foundFeature) {
          if (hoverOverlay) {
            hoverOverlay.setPosition(undefined);
          }
          highlightSource.clear();

          const target = map.getTargetElement();
          if (target) {
            target.style.cursor = '';
          }
        }
      };

      map.on('pointermove', handlePointerMove);

      return () => {
        clearTimeout(loadingTimeout);
        map.un("singleclick", handleClick);
        map.un('pointermove', handlePointerMove);
        
        if (highlightLayerRef.current) {
          map.removeLayer(highlightLayerRef.current);
          highlightLayerRef.current = null;
        }
        
        map.setTarget(undefined);
        mapInstanceRef.current = null;
        setMapInstance(null);
        setIsLoading(true);
        setError(null);
        baseLayerRef.current = null;
        indiaLayerRef.current = null;
        varunaFullLayerRef.current = null;
        streamsFullLayerRef.current = null;
        basinLayerRef.current = null;
        streamsLayerRef.current = null;
      };
    } catch (err) {
      console.error('Error initializing map:', err);
      setError("Failed to initialize map");
      setIsLoading(false);
    }
  }, [mapContainer]); // Only mapContainer as dependency

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (basinLayerRef.current) {
      map.removeLayer(basinLayerRef.current);
      basinLayerRef.current = null;
    }

    if (!selectedSubbasins || selectedSubbasins.length === 0) {
      return;
    }

    const attr = subbasinAttrNameRef.current;
    const list = selectedSubbasins
      .map((sb: any) => {
        const raw = String(sb.sub);
        return subbasinIsStringRef.current ? `'${raw.replace(/'/g, "''")}'` : `${Number(raw)}`;
      })
      .join(",");

    const cql = `${attr} IN (${list})`;
    const wfsUrl =
      `/geoserver/api/myworkspace/wfs` +
      `?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=myworkspace:varuna_subbasin_data` +
      `&outputFormat=application/json` +
      `&CQL_FILTER=${encodeURIComponent(cql)}`;

    const basinLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: wfsUrl,
      }),
      style: selectedStyleNoLabel,
      declutter: true,
      zIndex: 3,
    });

    basinLayer.set("name", "varuna_selected");
    basinLayerRef.current = basinLayer;
    map.addLayer(basinLayer);

    const source = basinLayer.getSource();
    if (source) {
      source.on("featuresloaderror", () => {
        setError("Failed to load selected subbasin boundaries");
      });
      source.on("featuresloadend", () => {
        const feats = source.getFeatures();
        if (!feats || feats.length === 0) {
          setError("No features returned for selected subbasins");
          return;
        }
        const selExt = source.getExtent();
        if (selExt && selExt[0] < selExt[2] && selExt[1] < selExt[3]) {
          map.getView().fit(selExt, { padding: [50, 50, 50, 50], duration: 700 });
        }
      });
    }

    return () => {
      if (map && basinLayerRef.current) {
        map.removeLayer(basinLayerRef.current);
        basinLayerRef.current = null;
      }
    };
  }, [selectedSubbasins]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (streamsLayerRef.current) {
      map.removeLayer(streamsLayerRef.current);
      streamsLayerRef.current = null;
    }

    if (!selectedSubbasins || selectedSubbasins.length === 0) {
      return;
    }

    const attr = subbasinAttrNameRef.current;
    const list = selectedSubbasins
      .map((sb: any) => {
        const raw = String(sb.sub);
        return subbasinIsStringRef.current ? `'${raw.replace(/'/g, "''")}'` : `${Number(raw)}`;
      })
      .join(",");

    const cql = `${attr} IN (${list})`;
    const wfsUrl =
      `/geoserver/api/myworkspace/wfs` +
      `?service=WFS&version=1.0.0&request=GetFeature` +
      `&typeName=myworkspace:Streams_clipped` +
      `&outputFormat=application/json` +
      `&CQL_FILTER=${encodeURIComponent(cql)}`;

    const streamStyle = new Style({
      stroke: new Stroke({ color: "#0011ffff", width: 2 }),
    });

    const streamsLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: wfsUrl,
      }),
      style: streamStyle,
      zIndex: 4,
    });

    streamsLayer.set("name", "streams_selected");
    streamsLayerRef.current = streamsLayer;
    map.addLayer(streamsLayer);

    const source = streamsLayer.getSource();
    if (source) {
      source.on("featuresloaderror", () => {
        setError("Failed to load selected streams");
      });
    }

    return () => {
      if (map && streamsLayerRef.current) {
        map.removeLayer(streamsLayerRef.current);
        streamsLayerRef.current = null;
      }
    };
  }, [selectedSubbasins]);

const contextValue = useMemo(
  () => ({
    mapInstance,
    setMapContainer,
    isLoading,
    error,
    selectedBaseMap,
    changeBaseMap,
  }),
  [mapInstance, isLoading, error, selectedBaseMap]
);


  return <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>;
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};