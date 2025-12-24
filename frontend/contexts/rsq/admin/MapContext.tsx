"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from "ol/Overlay";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style } from "ol/style";
import Text from "ol/style/Text";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import { Geometry } from "ol/geom";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { defaults as defaultControls } from "ol/control";
import { useLocation } from "./LocationContext";
import { useRSQ } from "./RsqContext";


const baseMaps = {
  osm: {
    name: "OpenStreetMap",
    source: () => new OSM({ crossOrigin: "anonymous" }),
  },
  openstreet: {
    name: "OpenStreet Standard",
    source: () =>
      new XYZ({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        crossOrigin: "anonymous",
      }),
  },
  satellite: {
    name: "Satellite",
    source: () =>
      new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        crossOrigin: "anonymous",
      }),
  },
};

interface MapContextType {
  mapInstance: Map | null;
  selectedBaseMap: string;
  changeBaseMap: (key: string) => void;
  setMapContainer: (el: HTMLDivElement | null) => void;
  isLoading: boolean;
  error: string | null;
  showLabels: boolean;
  toggleLabels: () => void;
  layerVisibility: Record<string, boolean>;
  toggleLayerVisibility: (layerName: string) => void;
  activeLayers: Record<string, boolean>;
  removeGroundwaterLayer: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const mapRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<any> | null>(null);
  const stateLayerRef = useRef<VectorLayer<any> | null>(null);
  const districtLayerRef = useRef<VectorLayer<any> | null>(null);
  const blockLayerRef = useRef<VectorLayer<any> | null>(null);
  const villageLayerRef = useRef<VectorLayer<any> | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);
  const groundwaterLayerRef = useRef<VectorLayer<any> | null>(null);

  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("openstreet");

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    india: true,
    state: true,
    district: true,
    block: true,
    village: true,
    groundwater: true,
  });

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({});

  const { selectedState, selectedDistricts, selectedBlocks, selectedVillages } = useLocation();

  const toggleLabels = () => setShowLabels((v) => !v);
  const { groundWaterData } = useRSQ();

  // Function to remove groundwater layer
  const removeGroundwaterLayer = () => {
    if (groundwaterLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(groundwaterLayerRef.current);
      groundwaterLayerRef.current = null;
      setActiveLayers(prev => ({ ...prev, groundwater: false }));
    }
  };

  // Hide layer and update visibility state
  const hideLayer = (ref: React.MutableRefObject<VectorLayer<any> | null>, layerName: string) => {
    if (ref.current) {
      ref.current.setVisible(false);
      setLayerVisibility(prev => ({ ...prev, [layerName]: false }));
    }
  };

  const toggleLayerVisibility = (layerName: string) => {
    setLayerVisibility(prev => ({ ...prev, [layerName]: !prev[layerName] }));

    const layerRef = {
      india: indiaLayerRef,
      state: stateLayerRef,
      district: districtLayerRef,
      block: blockLayerRef,
      village: villageLayerRef,
      groundwater: groundwaterLayerRef,
    }[layerName];

    if (layerRef && layerRef.current) {
      layerRef.current.setVisible(!layerRef.current.getVisible());
    }
  };

  // Styles
  const baseStyle = (stroke: string, fill: string) =>
    new Style({
      stroke: new Stroke({ color: stroke, width: 2 }),
      fill: new Fill({ color: fill }),
    });

  const labelStyle = (feature: any, base: Style, props: string[], font = "12px") =>
    showLabels
      ? new Style({
        stroke: (base.getStroke() as Stroke | undefined),
        fill: (base.getFill() as Fill | undefined),
        text: new Text({
          text: props.map((p) => feature.get(p)).find(Boolean) || "",
          font: `600 ${font} sans-serif`,
          fill: new Fill({ color: "#0b5394" }),
          stroke: new Stroke({ color: "white", width: 3 }),
          overflow: true,
        }),
      })
      : base;

  const stateStyle = useMemo(() => labelStyle, [showLabels]);
  const districtStyle = useMemo(() => labelStyle, [showLabels]);
  const blockStyle = useMemo(() => labelStyle, [showLabels]);
  const villageStyle = useMemo(() => labelStyle, [showLabels]);

  const stateBase = useMemo(() => baseStyle("rgba(240, 7, 7, 1)", "rgba(12, 129, 238, 0)"), []);
  const districtBase = useMemo(() => baseStyle("rgba(206, 0, 0, 0.8)", "rgba(255, 136, 0, 0)"), []);
  const blockBase = useMemo(() => baseStyle("rgba(255, 0, 0, 1)", "rgba(247, 225, 28, 0)"), []);
  const villageBase = useMemo(() => baseStyle("rgba(238, 20, 20, 0.8)", "rgba(18, 183, 248, 0.6)"), []);

  const makeStateStyle = (f: any) => stateStyle(f, stateBase, ["state_name", "state_code"]);
  const makeDistrictStyle = (f: any) => districtStyle(f, districtBase, ["district_name", "DISTRICT_N", "DISTRICT_C"]);
  const makeBlockStyle = (f: any) => blockStyle(f, blockBase, ["block_name", "BLOCK_NAME", "block"]);
  const makeVillageStyle = (f: any) => villageStyle(f, villageBase, ["village_name", "VILL_NAME", "vlcode", "village"], "10px");

  // Base map change
  const changeBaseMap = (key: string) => {
    if (!mapRef.current || key === selectedBaseMap) return;
    const def = baseMaps[key as keyof typeof baseMaps];
    if (!def) return;

    if (baseLayerRef.current) mapRef.current.removeLayer(baseLayerRef.current);

    const layer = new TileLayer({ source: def.source(), zIndex: 0 });
    layer.set("name", "basemap");
    baseLayerRef.current = layer;
    mapRef.current.getLayers().insertAt(0, layer);
    setSelectedBaseMap(key);
  };

  // Log RSQ data in MapContext when API response arrives
  useEffect(() => {
    if (groundWaterData) {
      console.log("🧪 MapContext: RSQ data available in context:", groundWaterData);

      // Plot groundwater GeoJSON data
      if (mapRef.current && groundWaterData.type === 'FeatureCollection') {
        // Remove existing groundwater layer
        removeGroundwaterLayer();

        // Hide all other layers and update visibility state
        hideLayer(stateLayerRef, 'state');
        hideLayer(districtLayerRef, 'district');
        hideLayer(blockLayerRef, 'block');
        hideLayer(villageLayerRef, 'village');

        // Create vector source from GeoJSON
        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(groundWaterData, {
            featureProjection: 'EPSG:3857', // Web Mercator projection
          }),
        });

        // Create style function that uses color from feature properties
        const groundwaterStyleFunction = (feature: any) => {
          const props = feature.getProperties();
          const color = props.color || props.Color || props.fill || props.Fill || '#00BCD4';

          // Use the color from properties for fill
          return new Style({
            stroke: new Stroke({ color: '#333333', width: 1.5 }),
            fill: new Fill({ color: color }),
          });
        };

        // Create vector layer
        const groundwaterLayer = new VectorLayer({
          source: vectorSource,
          style: groundwaterStyleFunction,
          zIndex: 15,
          visible: layerVisibility.groundwater,
        });

        groundwaterLayer.set("name", "groundwater-layer");
        groundwaterLayerRef.current = groundwaterLayer;
        mapRef.current.addLayer(groundwaterLayer);
        setActiveLayers(prev => ({ ...prev, groundwater: true }));
        setLayerVisibility(prev => ({ ...prev, groundwater: true }));

        // Fit map to groundwater layer extent
        const extent = vectorSource.getExtent();
        if (extent[0] < extent[2]) {
          mapRef.current.getView().fit(extent, {
            duration: 1000,
            padding: [60, 60, 60, 60],
            maxZoom: 17,
          });
        }

        console.log("✅ Groundwater layer plotted successfully");
      }
    } else {
      console.log("🧪 MapContext: RSQ data is null (no data or cleared)");
      removeGroundwaterLayer();
    }
  }, [groundWaterData]);

    // Map initialization
  useEffect(() => {
    if (!mapContainer || mapRef.current) return;

    const base = new TileLayer({
      source: baseMaps.openstreet.source(),
      zIndex: 0,
    });

    base.set("name", "basemap");
    baseLayerRef.current = base;

    const india = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json",
      }),
      style: new Style({
        stroke: new Stroke({ color: "#1e88e5", width: 2 }),
        fill: new Fill({ color: "rgba(30,136,229,0.04)" }),
      }),
      zIndex: 1,
      visible: layerVisibility.india,
    });
    india.set("name", "india");
    indiaLayerRef.current = india;
    setActiveLayers(prev => ({ ...prev, india: true }));

    const map = new Map({
      target: mapContainer,
      layers: [base, india],
      view: new View({ center: fromLonLat([78.9629, 20.5937]), zoom: 5 }),
      controls: defaultControls({ zoom: true, rotate: false }),
    });

    mapRef.current = map;
    setMapInstance(map);
    map.updateSize();

    // Create fixed info panel on the right side (for RSQ layer only)
    const infoPanel = document.createElement("div");
    infoPanel.className = "ol-info-panel";
    infoPanel.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #333;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 12px;
      max-width: 320px;
      min-width: 250px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      display: none;
      z-index: 1000;
    `;
    mapContainer.appendChild(infoPanel);

    // Hover setup for other layers
    const hoverEl = document.createElement("div");
    hoverEl.className = "ol-hover-popup";
    hoverEl.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #333;
      padding: 10px 14px;
      border-radius: 6px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      font-size: 12px;
      font-weight: 600;
      max-width: 280px;
      min-width: 200px;
    `;
    const overlay = new Overlay({ element: hoverEl, positioning: "bottom-center", offset: [0, -15] });
    map.addOverlay(overlay);
    hoverOverlayRef.current = overlay;

    const highlight = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        fill: new Fill({ color: "rgba(59, 130, 246, 0.3)" }),
        stroke: new Stroke({ color: "#FFD700", width: 4 }),
      }),
      zIndex: 999,
    });
    highlight.set("name", "highlight-layer");
    map.addLayer(highlight);
    highlightLayerRef.current = highlight;

    map.on("pointermove", (e) => {
      const hs = highlight.getSource()!;
      hs.clear();
      let found = false;

      map.forEachFeatureAtPixel(
        e.pixel,
        (f, l) => {
          if (l?.get("name") === "highlight-layer") return;
          const props = f.getProperties();

          // Check if it's groundwater layer - show in fixed panel
          if (l?.get("name") === "groundwater-layer") {
            // Display all properties for groundwater features EXCEPT excluded ones
            const excludedProps = ['geometry', 'vlcode', 'blockcode', 'color', 'SUBDIS_COD', 'srno'];
            let displayText = "<div style='border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px;'><strong style='font-size: 14px;'>Groundwater Data</strong></div>";
            
            Object.keys(props).forEach(key => {
              if (!excludedProps.includes(key)) {
                const value = props[key];
                const formattedKey = key.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
                
                displayText += `
                  <div style='margin-bottom: 6px; display: flex; justify-content: space-between; gap: 10px;'>
                    <span style='color: #555; font-weight: 600;'>${formattedKey}:</span>
                    <span style='color: #000; font-weight: 500; text-align: right;'>${value !== null && value !== undefined ? value : '-'}</span>
                  </div>
                `;
              }
            });

            hs.addFeature(f.clone() as Feature<Geometry>);
            infoPanel.innerHTML = displayText;
            infoPanel.style.display = 'block';
            overlay.setPosition(undefined); // Hide moving popup
            found = true;
            map.getTargetElement()!.style.cursor = "pointer";
            return;
          }

          // Handle other layers - show in moving popup
          const name =
            props.village ||
            props.VILL_NAME ||
            props.block_name ||
            props.blockname ||
            props.district_name ||
            props.state_name ||
            "";

          const displayText = `<strong>${name}</strong>`;

          if (name) {
            hs.addFeature(f.clone() as Feature<Geometry>);
            hoverEl.innerHTML = displayText;
            overlay.setPosition(e.coordinate);
            infoPanel.style.display = 'none'; // Hide fixed panel
            found = true;
            map.getTargetElement()!.style.cursor = "pointer";
          }
        },
        { hitTolerance: 5 }
      );

      if (!found) {
        overlay.setPosition(undefined);
        infoPanel.style.display = 'none';
        map.getTargetElement()!.style.cursor = "";
      }
    });

    return () => {
      map.setTarget(undefined);
      if (infoPanel.parentNode) {
        infoPanel.parentNode.removeChild(infoPanel);
      }
    };
  }, [mapContainer]);

  // State layer
  useEffect(() => {
    const layerName = 'state';
    if (!mapRef.current || !selectedState) {
      if (stateLayerRef.current) {
        hideLayer(stateLayerRef, layerName);
      }
      return;
    }

    if (stateLayerRef.current) {
      mapRef.current.removeLayer(stateLayerRef.current);
    }

    const cql = `state_code='${String(selectedState).padStart(2, "0")}'`;
    const url = `http://localhost:9090/geoserver/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url }),
      style: makeStateStyle,
      zIndex: 2,
      visible: layerVisibility.state !== false,
    });
    layer.set("name", "state-layer");
    stateLayerRef.current = layer;
    mapRef.current.addLayer(layer);
    setActiveLayers(prev => ({ ...prev, [layerName]: true }));
    setLayerVisibility(prev => ({ ...prev, [layerName]: true }));

    layer.getSource()?.once("featuresloadend", () => {
      const ext = layer.getSource()!.getExtent();
      if (ext[0] < ext[2]) mapRef.current!.getView().fit(ext, { duration: 800, padding: [50, 50, 50, 50] });
    });
  }, [selectedState]);

  // District layer
  useEffect(() => {
    const layerName = 'district';
    if (!mapRef.current || selectedDistricts.length === 0) {
      if (districtLayerRef.current) {
        hideLayer(districtLayerRef, layerName);
      }
      return;
    }

    hideLayer(stateLayerRef, 'state');

    if (districtLayerRef.current) {
      mapRef.current.removeLayer(districtLayerRef.current);
    }

    const cql = `DISTRICT_C IN (${selectedDistricts.join(",")})`;
    const url = `http://localhost:9090/geoserver/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_district&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url }),
      style: makeDistrictStyle,
      zIndex: 3,
      visible: layerVisibility.district !== false,
    });
    layer.set("name", "state-districts");
    districtLayerRef.current = layer;
    mapRef.current.addLayer(layer);
    setActiveLayers(prev => ({ ...prev, [layerName]: true }));
    setLayerVisibility(prev => ({ ...prev, [layerName]: true }));

    layer.getSource()?.once("featuresloadend", () => {
      const ext = layer.getSource()!.getExtent();
      if (ext[0] < ext[2]) mapRef.current!.getView().fit(ext, { duration: 800, padding: [50, 50, 50, 50] });
    });
  }, [selectedDistricts]);

  // Block layer
  useEffect(() => {
    const layerName = 'block';
    if (!mapRef.current || selectedBlocks.length === 0) {
      if (blockLayerRef.current) {
        hideLayer(blockLayerRef, layerName);
      }
      return;
    }

    hideLayer(stateLayerRef, 'state');
    hideLayer(districtLayerRef, 'district');

    if (blockLayerRef.current) {
      mapRef.current.removeLayer(blockLayerRef.current);
    }

    const cql = `Block_LG00 IN (${selectedBlocks.join(",")})`;
    const url = `http://localhost:9090/geoserver/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:block&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({ format: new GeoJSON(), url }),
      style: makeBlockStyle,
      zIndex: 4,
      visible: layerVisibility.block !== false,
    });
    layer.set("name", "district-blocks");
    blockLayerRef.current = layer;
    mapRef.current.addLayer(layer);
    setActiveLayers(prev => ({ ...prev, [layerName]: true }));
    setLayerVisibility(prev => ({ ...prev, [layerName]: true }));

    layer.getSource()?.once("featuresloadend", () => {
      const ext = layer.getSource()!.getExtent();
      if (ext[0] < ext[2]) mapRef.current!.getView().fit(ext, { duration: 800, padding: [50, 50, 50, 50] });
    });
  }, [selectedBlocks]);

  // Village layer
  useEffect(() => {
    const layerName = 'village';
    console.log('🗺️ Village layer update:', selectedVillages.length, 'villages');

    if (!mapRef.current || selectedVillages.length === 0) {
      if (villageLayerRef.current) {
        hideLayer(villageLayerRef, layerName);
        setActiveLayers(prev => ({ ...prev, village: false }));
      }
      return;
    }

    hideLayer(stateLayerRef, 'state');
    hideLayer(districtLayerRef, 'district');
    hideLayer(blockLayerRef, 'block');

    if (villageLayerRef.current) {
      mapRef.current.removeLayer(villageLayerRef.current);
    }

    const codes = selectedVillages.map((c) => `'${c}'`).join(",");
    const cql = `vlcode IN (${codes})`;
    const url = `http://localhost:9090/geoserver/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:Village&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cql)}`;

    const layer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url,
        strategy: bboxStrategy,
      }),
      style: makeVillageStyle,
      zIndex: 10,
      visible: layerVisibility.village !== false,
    });

    layer.set("name", "villages");
    villageLayerRef.current = layer;
    mapRef.current.addLayer(layer);
    setActiveLayers(prev => ({ ...prev, [layerName]: true }));
    setLayerVisibility(prev => ({ ...prev, [layerName]: true }));

    layer.getSource()?.once("featuresloadend", () => {
      const ext = layer.getSource()!.getExtent();
      if (ext[0] < ext[2]) {
        mapRef.current!.getView().fit(ext, {
          duration: 1000,
          padding: [60, 60, 60, 60],
          maxZoom: 17,
        });
      }
    });
  }, [selectedVillages]);

  // Label toggle refresh
  useEffect(() => {
    [stateLayerRef, districtLayerRef, blockLayerRef, villageLayerRef].forEach((ref) => {
      ref.current?.changed();
    });
  }, [showLabels]);

  const value = useMemo(
    () => ({
      mapInstance,
      selectedBaseMap,
      changeBaseMap,
      setMapContainer,
      isLoading,
      error,
      showLabels,
      toggleLabels,
      layerVisibility,
      toggleLayerVisibility,
      activeLayers,
      removeGroundwaterLayer,
    }),
    [mapInstance, selectedBaseMap, isLoading, error, showLabels, layerVisibility, activeLayers]
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMapContext = (): MapContextType => {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMapContext must be used within MapProvider");
  return ctx;
};