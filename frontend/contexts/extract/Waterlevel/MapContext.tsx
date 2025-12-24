"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import ImageWMS from "ol/source/ImageWMS";
import XYZ from "ol/source/XYZ";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style } from "ol/style";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import Overlay from "ol/Overlay";
import { MapBrowserEvent } from "ol";
import { get as getProjection } from "ol/proj";
import { Feature } from "ol";
import { Geometry } from "ol/geom";

interface StationData {
  stationCode: string;
  warningLevel: number | null;
  dangerLevel: number | null;
  highestFlowLevel: number | null;
  frl: number | null;
  mwl: number | null;
  stationType: string;
  dataTypeCode: string;
  value: number;
  actualTime: string;
  otherParam: string;
}

interface PopupData {
  stationName: string;
  stationCode: string;
  latestData: StationData;
  allData: StationData[];
}

interface StateOption {
  label: string;
  state_code: string;
}

interface MapContextProps {
  map: Map | null;
  toggleBaseMap: () => void;
  isSatellite: boolean;
  popupOverlay: Overlay | null;
  popupData: PopupData | null;
  isPopupVisible: boolean;
  isLoading: boolean;
  closePopup: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  states: StateOption[];
  selectedStateCode: string | null;
  setSelectedStateCode: (code: string | null) => void;
}

const MapContext = createContext<MapContextProps | undefined>(undefined);

export const WaterLevelMapProvider = ({ children }: { children: ReactNode }) => {
  const [map, setMap] = useState<Map | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [popupOverlay, setPopupOverlay] = useState<Overlay | null>(null);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [states, setStates] = useState<StateOption[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);

  const indiaBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "blue", width: 2 }),
  });

const fetchHydrographStationData = async (stationCode: string) => {
  try {
    const currentDate = new Date().toISOString().split("T")[0];
    const startDate = "2016-01-01";
    const apiUrl = "/django/extract/level";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationCode: `'${stationCode}'`,
        startDate,
        endDate: currentDate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Always return an array
    if (Array.isArray(data)) return data; // already an array
    if (data.data && Array.isArray(data.data)) return data.data; // extract from "data" field
    if (data.message === "External API returned no valid data") return []; // return empty array for no-data message

    return []; // fallback to empty array
  } catch (error) {
    console.error("[ERROR] fetchHydrographStationData:", error);
    return []; // return empty array instead of throwing to prevent .sort error
  }
};


  const updatePopupPosition = (coordinate: number[]) => {
    if (!map || !popupOverlay) return;

    const pixel = map.getPixelFromCoordinate(coordinate);
    const mapSize = map.getSize() || [800, 600];
    const popupEstimatedHeight = 380;

    const spaceBelow = mapSize[1] - pixel[1];
    const spaceAbove = pixel[1];

    if (spaceBelow < popupEstimatedHeight && spaceAbove > spaceBelow) {
      popupOverlay.setPositioning("top-center");
      popupOverlay.setOffset([0, 15]);
    } else {
      popupOverlay.setPositioning("bottom-center");
      popupOverlay.setOffset([0, -15]);
    }

    popupOverlay.setPosition(coordinate);
  };

  useEffect(() => {
    if (map) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
      visible: !isSatellite,
      properties: { name: "osm" },
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
      }),
      visible: isSatellite,
      properties: { name: "satellite" },
    });

    const indiaLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url: "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json",
      }),
      style: indiaBoundaryStyle,
      zIndex: 1,
      properties: { name: "indiaBase" },
    });

    const waterLevelLayer = new ImageLayer({
      source: new ImageWMS({
        url: "http://localhost:9090/geoserver/myworkspace/wms",
        params: {
          LAYERS: "myworkspace:waterlevel",
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
      visible: true,
      opacity: 0.8,
      properties: { name: "waterLevel" },
    });

    const overlay = new Overlay({
      element: undefined,
      autoPan: false,
      positioning: "bottom-center",
      offset: [0, -15],
      stopEvent: false,
    });

    const initialMap = new Map({
      target: undefined,
      view: new View({
        center: fromLonLat([78.9629, 22.5937]),
        zoom: 5,
        minZoom: 3,
        maxZoom: 18,
      }),
      layers: [osmLayer, satelliteLayer, indiaLayer, waterLevelLayer],
      overlays: [overlay],
      controls: defaultControls({ zoom: false, attribution: true, rotate: false }).extend([
        new ScaleLine({ units: "metric", bar: true, steps: 4, text: true, minWidth: 140 }),
      ]),
    });

    // Load states from B_State layer
    indiaLayer.getSource()?.on("featuresloadend", () => {
      const source = indiaLayer.getSource();
      if (!source) return;

      const features = source.getFeatures();
      const stateList: StateOption[] = features
        .map((f: Feature<Geometry>) => {
          const props = f.getProperties();
          const label = props.State || props.state || "Unknown";
          const code = props.state_code || props.STATE_CODE || props.StateCode;
          return { label, state_code: code } as StateOption;
        })
        .filter((item): item is StateOption => item !== null)
        .sort((a, b) => a.label.localeCompare(b.label));

      setStates([{ label: "All India", state_code: "" }, ...stateList]);

      // Fit to India initially
      const extent = source.getExtent();
      if (extent && extent.some(isFinite)) {
        initialMap.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
      }
    });

    setMap(initialMap);
    setPopupOverlay(overlay);
  }, []);

  // Apply CQL filter when selectedStateCode changes
  useEffect(() => {
    if (!map) return;

    const layer = map.getLayers().getArray().find(l => l.get("name") === "waterLevel") as ImageLayer<ImageWMS>;
    if (!layer) return;

    const source = layer.getSource();
    if (!source) return;

    const params = source.getParams();

    if (!selectedStateCode || selectedStateCode === "") {
      delete params.CQL_FILTER;
    } else {
      params.CQL_FILTER = `STATE_CODE = '${selectedStateCode}'`;
    }

    source.updateParams({ ...params, t: Date.now() }); // Force refresh
  }, [selectedStateCode, map]);

  // Zoom to selected state
  useEffect(() => {
    if (!map || !selectedStateCode) return;

    const indiaLayer = map.getLayers().getArray().find(l => l.get("name") === "indiaBase") as VectorLayer<VectorSource>;
    if (!indiaLayer) return;

    const source = indiaLayer.getSource();
    if (!source) return;

    const feature = source.getFeatures().find((f: Feature<Geometry>) => {
      const code = f.get("state_code") || f.get("STATE_CODE") || f.get("StateCode");
      return code === selectedStateCode;
    });

    if (feature) {
      const geometry = feature.getGeometry();
      if (geometry) {
        const extent = geometry.getExtent();
        map.getView().fit(extent, {
          duration: 1000,
          padding: [100, 100, 100, 100],
          maxZoom: 10,
        });
      }
    }
  }, [selectedStateCode, map]);

  const handleMapClick = async (evt: MapBrowserEvent<any>) => {
    if (!map || !popupOverlay) return;

    const resolution = map.getView().getResolution();
    if (!resolution) return;

    const layer = map.getLayers().getArray().find(l => l.get("name") === "waterLevel") as ImageLayer<ImageWMS>;
    if (!layer) return;

    const url = layer.getSource()?.getFeatureInfoUrl(
      evt.coordinate,
      resolution,
      "EPSG:3857",
      { INFO_FORMAT: "application/json" }
    );

    if (!url) {
      popupOverlay.setPosition(undefined);
      setIsPopupVisible(false);
      return;
    }

    try {
      console.log("[DEBUG] GetFeatureInfo URL:", url);
      const res = await fetch(url);
      const data = await res.json();
      console.log("[DEBUG] GetFeatureInfo response:", data);

      if (data.features?.length > 0) {
        const props = data.features[0].properties;
        console.log("[DEBUG] Feature properties:", props);

        const stationCode =
          props.stationCode ||
          props.station_code ||
          props.STATION_CODE ||
          props.stationCod ||
          props.StationCod ||
          props.stationcod ||
          props.STATIONCOD ||
          null;


        if (!stationCode) {
          console.warn("[WARN] No station code found in properties");
          popupOverlay.setPosition(undefined);
          setIsPopupVisible(false);
          return;
        }

        console.log("[DEBUG] Station code found:", stationCode);
        setIsLoading(true);
        setIsPopupVisible(true);

        try {
          const hydroData = await fetchHydrographStationData(stationCode);
          const sorted = hydroData.sort((a: any, b: any) =>
            new Date(b.actualTime).getTime() - new Date(a.actualTime).getTime()
          );

          setPopupData({
            stationName: props.name || props.NAME || stationCode,
            stationCode,
            latestData: sorted[0],
            allData: sorted,
          });

          updatePopupPosition(evt.coordinate);
        } catch (err) {
          console.error("Failed to load station data", err);
          setPopupData(null);
          setIsPopupVisible(false);
          popupOverlay.setPosition(undefined);
        }

        setIsLoading(false);
      } else {
        console.log("[DEBUG] No features found at click location");
        popupOverlay.setPosition(undefined);
        setIsPopupVisible(false);
      }
    } catch (err) {
      console.error("GetFeatureInfo failed", err);
      popupOverlay.setPosition(undefined);
      setIsPopupVisible(false);
    }
  };

  useEffect(() => {
    if (!map) return;
    map.on("singleclick", handleMapClick);
    return () => map.un("singleclick", handleMapClick);
  }, [map, popupOverlay]);

  useEffect(() => {
    if (!map) return;
    map.getLayers().forEach(layer => {
      const name = layer.get("name");
      if (name === "osm") layer.setVisible(!isSatellite);
      if (name === "satellite") layer.setVisible(isSatellite);
    });
  }, [map, isSatellite]);

  const toggleBaseMap = () => setIsSatellite(prev => !prev);

  const closePopup = () => {
    setIsPopupVisible(false);
    setPopupData(null);
    popupOverlay?.setPosition(undefined);
  };

  const handleZoomIn = () => {
    map?.getView().animate({ zoom: (map.getView().getZoom() || 0) + 1, duration: 250 });
  };

  const handleZoomOut = () => {
    map?.getView().animate({ zoom: (map.getView().getZoom() || 0) - 1, duration: 250 });
  };

  return (
    <MapContext.Provider
      value={{
        map,
        toggleBaseMap,
        isSatellite,
        popupOverlay,
        popupData,
        isPopupVisible,
        isLoading,
        closePopup,
        handleZoomIn,
        handleZoomOut,
        states,
        selectedStateCode,
        setSelectedStateCode,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextProps => {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMap must be used within WaterLevelMapProvider");
  return context;
};