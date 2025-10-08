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
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style } from "ol/style";
import Text from "ol/style/Text";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import { useLocationContext } from "./LocationContext";
import { createEmpty, extend as extendExtent } from "ol/extent";

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
  setMapContainer: () => { },
  isLoading: true,
  error: null,
  showLabels: false,
  toggleLabels: () => { },
});

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const varunaFullLayerRef = useRef<VectorLayer<any> | null>(null);
  const streamsFullLayerRef = useRef<VectorLayer<any> | null>(null);
  const basinLayerRef = useRef<VectorLayer<any> | null>(null);
  const streamsLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { selectedSubbasins, toggleSubbasinByNumber } = useLocationContext();

  const [showLabels, setShowLabels] = useState<boolean>(false);
  const toggleLabels = () => setShowLabels((s) => !s);

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

  const makeVarunaFullStyleFn = useMemo(
    () => (feature: any) => {
      if (!showLabels) return varunaBaseStyleNoLabel;
      const subAttr = subbasinAttrNameRef.current;
      const txt = String(feature.get(subAttr) ?? "");
      return new Style({
        stroke: new Stroke({ color: "rgba(0,0,0,0.6)", width: 1 }),
        fill: new Fill({ color: "rgba(0, 0, 0, 0.05)" }),
        text: new Text({
          text: txt,
          font: "600 12px sans-serif",
          fill: new Fill({ color: "#0b5394" }),
          stroke: new Stroke({ color: "white", width: 3 }),
          overflow: true,
        }),
      });
    },
    [showLabels, varunaBaseStyleNoLabel]
  );

  const makeSelectedStyleFn = useMemo(
    () => (feature: any) => {
      if (!showLabels) return selectedStyleNoLabel;
      const subAttr = subbasinAttrNameRef.current;
      const txt = String(feature.get(subAttr) ?? "");
      return new Style({
        stroke: new Stroke({ color: "red", width: 3 }),
        fill: new Fill({ color: "rgba(255, 0, 0, 0.2)" }),
        text: new Text({
          text: txt,
          font: "700 13px sans-serif",
          fill: new Fill({ color: "#b71c1c" }),
          stroke: new Stroke({ color: "white", width: 3 }),
          overflow: true,
        }),
      });
    },
    [showLabels, selectedStyleNoLabel]
  );

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
        style: makeVarunaFullStyleFn,
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

      map.once("rendercomplete", () => setIsLoading(false));
      const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

      const fullSrc = varunaFullLayer.getSource();
      const streamsSrc = streamsFullLayer.getSource();

      // Fixed extent validation function
      const isValidExtent = (extent?: number[]) => {
        return extent && 
               extent.length >= 4 && 
               extent[0] < extent[2] && 
               extent[1] < extent[3] &&
               isFinite(extent[0]) && isFinite(extent[1]) && 
               isFinite(extent[2]) && isFinite(extent[3]);
      };

      // Track which layers have loaded
      let varunaLoaded = false;
      let streamsLoaded = false;

      // Function to fit view to Varuna subbasins when ready
      const fitToVarunaWhenReady = () => {
        const m = mapInstanceRef.current;
        if (!m) return;

        const varunaExtent = varunaFullLayerRef.current?.getSource()?.getExtent?.();
        
        if (isValidExtent(varunaExtent)) {
          console.log('Fitting to Varuna extent:', varunaExtent);
          m.getView().fit(varunaExtent!, { 
            padding: [50, 50, 50, 50], 
            duration: 800,
            maxZoom: 12 // Prevent zooming too close
          });
        }
      };

      // Handle Varuna subbasin data loading
      fullSrc?.on("featuresloadend", () => {
        console.log('Varuna features loaded');
        varunaLoaded = true;
        
        const feats = fullSrc.getFeatures();
        if (feats && feats.length) {
          const attr = subbasinAttrNameRef.current;
          subbasinIsStringRef.current = typeof feats[0]?.get(attr) === "string";
          console.log(`Loaded ${feats.length} Varuna features`);
        }

        // Fit to Varuna extent immediately when it loads
        fitToVarunaWhenReady();
      });

      // Handle streams data loading  
      streamsSrc?.on("featuresloadend", () => {
        console.log('Streams features loaded');
        streamsLoaded = true;
        
        const feats = streamsSrc.getFeatures();
        if (feats && feats.length) {
          console.log(`Loaded ${feats.length} stream features`);
        }
        
        // If Varuna hasn't loaded yet, we'll wait for it
        // If it has loaded, the view should already be fitted
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
              toggleSubbasinByNumber(Number(m[1])); // Fixed index from [22] to [1]
              return true;
            }
            return false;
          },
          { layerFilter: (lyr) => lyr === fullLayer, hitTolerance: 3 }
        );
      };

      map.on("singleclick", handleClick);

      return () => {
        clearTimeout(loadingTimeout);
        map.un("singleclick", handleClick);
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
  }, [
    mapContainer,
    boundaryLayerStyle,
    streamsBaseStyle,
    makeVarunaFullStyleFn,
    toggleSubbasinByNumber,
  ]);

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
      style: makeSelectedStyleFn,
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
  }, [selectedSubbasins, mapInstance, makeSelectedStyleFn]);

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
      stroke: new Stroke({ color: "#00e5ff", width: 2 }),
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
  }, [selectedSubbasins, mapInstance]);

  useEffect(() => {
    const vf = varunaFullLayerRef.current;
    if (vf) {
      vf.setStyle(makeVarunaFullStyleFn);
      vf.changed();
    }
    const sel = basinLayerRef.current;
    if (sel) {
      sel.setStyle(makeSelectedStyleFn);
      sel.changed();
    }
  }, [showLabels, makeVarunaFullStyleFn, makeSelectedStyleFn]);

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
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};