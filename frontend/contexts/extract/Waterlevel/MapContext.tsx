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

interface DistrictOption {
  label: string;
  district_code: string;
  state_code: string;
}

interface RiverOption {
  label: string;
  rivname: string;
  state_code?: string;
  district_code?: string;
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
  districts: DistrictOption[];
  selectedDistrictCode: string | null;
  setSelectedDistrictCode: (code: string | null) => void;
  rivers: RiverOption[];
  selectedRiverName: string | null;
  setSelectedRiverName: (name: string | null) => void;
  hoverInfo: string | null;
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
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<string | null>(null);
  const [rivers, setRivers] = useState<RiverOption[]>([]);
  const [selectedRiverName, setSelectedRiverName] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const indiaBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "blue", width: 2 }),
  });

  const districtBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "green", width: 1 }),
  });

  const riverStyle = new Style({
    stroke: new Stroke({ color: "#0ea5e9", width: 2 }),
  });

  const riverHighlightStyle = new Style({
    stroke: new Stroke({ color: "#f59e0b", width: 3 }),
  });

  const fetchHydrographStationData = async (stationCode: string) => {
    try {
      const currentDate = new Date().toISOString().split("T")[0];
      const startDate = "2016-01-01";
      const apiUrl = "http://localhost:8050/extract/level";

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

    // Initialize with "All Rivers" option
    setRivers([{ label: "All Rivers", rivname: "" }]);

    setMap(initialMap);
    setPopupOverlay(overlay);
  }, []);

  // Filter rivers based on selected district - dynamically fetch from GeoServer
  useEffect(() => {
    if (!selectedDistrictCode || selectedDistrictCode === "") {
      // If no district selected, show all rivers
      setRivers([{ label: "All Rivers", rivname: "" }]);
      setSelectedRiverName(null);
      return;
    }

    // Fetch rivers for the selected district from GeoServer
    const fetchDistrictRivers = async () => {
      try {
        const cqlFilter = `DISTRICT_C='${selectedDistrictCode}'`;
        const response = await fetch(
          `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:indiariver&outputFormat=application/json&propertyName=rivname,DISTRICT_C&CQL_FILTER=${encodeURIComponent(cqlFilter)}`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const riverList = (data.features as any[])
            .map<RiverOption | null>((f) => {
              const rivname =
                f.properties?.rivname ||
                f.properties?.RIVNAME ||
                f.properties?.RivName;

              const district_code =
                f.properties?.DISTRICT_C ||
                f.properties?.district_c ||
                f.properties?.DistrictCode;

              return rivname
                ? {
                    label: rivname,
                    rivname,
                    district_code,
                  }
                : null;
            })
            .filter((item): item is RiverOption => item !== null);

          // Remove duplicates and sort
          const uniqueRivers = Array.from(
            new Set(riverList.map(r => r.rivname))
          ).map(rivname => {
            return riverList.find(r => r.rivname === rivname)!;
          }).sort((a, b) => a.label.localeCompare(b.label));

          setRivers([{ label: "All Rivers", rivname: "" }, ...uniqueRivers]);

          // Reset river selection
          setSelectedRiverName(null);
        } else {
          // No rivers found for this district
          setRivers([{ label: "All Rivers", rivname: "" }]);
          setSelectedRiverName(null);
        }
      } catch (error) {
        console.error("Failed to fetch district rivers:", error);
        setRivers([{ label: "All Rivers", rivname: "" }]);
        setSelectedRiverName(null);
      }
    };

    fetchDistrictRivers();
  }, [selectedDistrictCode]);

  // Apply river filter when river is selected - load river layer dynamically
  useEffect(() => {
    if (!map) return;

    // Get existing river layer if any
    let riverLayer = map.getLayers().getArray().find(l => l.get("name") === "riverLayer") as VectorLayer<VectorSource>;

    if (!selectedRiverName || selectedRiverName === "") {
      // Remove river layer if "All Rivers" selected
      if (riverLayer) {
        map.removeLayer(riverLayer);
      }
      return;
    }

    // Build CQL filter for selected river with district context
    let cqlFilter = `rivname='${selectedRiverName}'`;

    // Add district filter if district is selected
    if (selectedDistrictCode && selectedDistrictCode !== "") {
      cqlFilter += ` AND DISTRICT_C='${selectedDistrictCode}'`;
    }

    if (!riverLayer) {
      // Create new river layer with selected river only
      riverLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:indiariver&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
        }),
        style: riverHighlightStyle,
        zIndex: 3,
        properties: { name: "riverLayer" },
      });

      map.addLayer(riverLayer);

      // Zoom to river when loaded
      riverLayer.getSource()?.on("featuresloadend", () => {
        const source = riverLayer.getSource();
        if (!source) return;

        const extent = source.getExtent();
        if (extent && extent.some(isFinite)) {
          map.getView().fit(extent, {
            duration: 1000,
            padding: [100, 100, 100, 100],
            maxZoom: 8,
          });
        }
      });
    } else {
      // Update existing layer with new filter
      const source = riverLayer.getSource();
      if (source) {
        const newUrl = `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:indiariver&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;

        source.clear();
        source.setUrl(newUrl);
        source.refresh();

        // Zoom to river when loaded
        source.once("featuresloadend", () => {
          const extent = source.getExtent();
          if (extent && extent.some(isFinite)) {
            map.getView().fit(extent, {
              duration: 1000,
              padding: [100, 100, 100, 100],
              maxZoom: 8,
            });
          }
        });
      }
    }
  }, [selectedRiverName, selectedDistrictCode, map]);

  // Dynamically load district layer when state is selected
  useEffect(() => {
    if (!map || !selectedStateCode || selectedStateCode === "") {
      // Remove district layer if no state selected
      if (map) {
        const existingLayer = map.getLayers().getArray().find(l => l.get("name") === "districtBase");
        if (existingLayer) {
          map.removeLayer(existingLayer);
        }
      }
      setDistricts([{ label: "All Districts", district_code: "", state_code: "" }]);
      setSelectedDistrictCode(null);
      return;
    }

    // Check if district layer already exists
    let districtLayer = map.getLayers().getArray().find(l => l.get("name") === "districtBase") as VectorLayer<VectorSource>;

    if (!districtLayer) {
      // Create new district layer with CQL filter for selected state
      const cqlFilter = `STATE_CODE='${selectedStateCode}'`;

      districtLayer = new VectorLayer({
        source: new VectorSource({
          format: new GeoJSON(),
          url: `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_district&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
        }),
        style: districtBoundaryStyle,
        zIndex: 2,
        properties: { name: "districtBase" },
      });

      // Add layer to map
      map.addLayer(districtLayer);

      // Load districts when features are loaded
      districtLayer.getSource()?.on("featuresloadend", () => {
        const source = districtLayer.getSource();
        if (!source) return;

        const features = source.getFeatures();
        const districtList: DistrictOption[] = features
          .map((f: Feature<Geometry>) => {
            const props = f.getProperties();
            const label = props.DISTRICT || props.district || props.District || "Unknown";
            const districtCode = props.DISTRICT_C || props.district_c || props.DistrictCode;
            const stateCode = props.STATE_CODE || props.state_code || props.StateCode;
            return { label, district_code: districtCode, state_code: stateCode } as DistrictOption;
          })
          .filter((item): item is DistrictOption => item !== null && Boolean(item.district_code))
          .sort((a, b) => a.label.localeCompare(b.label));

        setDistricts([{ label: "All Districts", district_code: "", state_code: selectedStateCode }, ...districtList]);
      });
    } else {
      // Update existing layer with new CQL filter
      const source = districtLayer.getSource();
      if (source) {
        const cqlFilter = `STATE_CODE='${selectedStateCode}'`;
        const newUrl = `/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_district&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;

        // Clear and reload source
        source.clear();
        source.setUrl(newUrl);
        source.refresh();

        // Reload districts when features are loaded
        source.once("featuresloadend", () => {
          const features = source.getFeatures();
          const districtList: DistrictOption[] = features
            .map((f: Feature<Geometry>) => {
              const props = f.getProperties();
              const label = props.DISTRICT || props.district || props.District || "Unknown";
              const districtCode = props.DISTRICT_C || props.district_c || props.DistrictCode;
              const stateCode = props.STATE_CODE || props.state_code || props.StateCode;
              return { label, district_code: districtCode, state_code: stateCode } as DistrictOption;
            })
            .filter((item): item is DistrictOption => item !== null && Boolean(item.district_code))
            .sort((a, b) => a.label.localeCompare(b.label));

          setDistricts([{ label: "All Districts", district_code: "", state_code: selectedStateCode }, ...districtList]);
        });
      }
    }

    // Reset district selection when state changes
    setSelectedDistrictCode(null);
  }, [selectedStateCode, map]);

  // Apply CQL filter when selectedStateCode or selectedDistrictCode changes
  useEffect(() => {
    if (!map) return;

    const layer = map.getLayers().getArray().find(l => l.get("name") === "waterLevel") as ImageLayer<ImageWMS>;
    if (!layer) return;

    const source = layer.getSource();
    if (!source) return;

    const params = source.getParams();

    // Build CQL filter based on state and district selection
    let cqlFilter = "";

    if (selectedDistrictCode && selectedDistrictCode !== "") {
      // District filter takes priority
      cqlFilter = `DISTRICT_C = '${selectedDistrictCode}'`;
    } else if (selectedStateCode && selectedStateCode !== "") {
      // State filter
      cqlFilter = `STATE_CODE = '${selectedStateCode}'`;
    }

    if (cqlFilter) {
      params.CQL_FILTER = cqlFilter;
    } else {
      delete params.CQL_FILTER;
    }

    source.updateParams({ ...params, t: Date.now() }); // Force refresh
  }, [selectedStateCode, selectedDistrictCode, map]);

  // Zoom to selected state or district
  useEffect(() => {
    if (!map) return;

    if (selectedDistrictCode && selectedDistrictCode !== "") {
      // Zoom to district
      const districtLayer = map.getLayers().getArray().find(l => l.get("name") === "districtBase") as VectorLayer<VectorSource>;
      if (!districtLayer) return;

      const source = districtLayer.getSource();
      if (!source) return;

      // Wait a bit for features to load if needed
      const zoomToDistrict = () => {
        const feature = source.getFeatures().find((f: Feature<Geometry>) => {
          const code = f.get("DISTRICT_C") || f.get("district_c") || f.get("DistrictCode");
          return code === selectedDistrictCode;
        });

        if (feature) {
          const geometry = feature.getGeometry();
          if (geometry) {
            const extent = geometry.getExtent();
            map.getView().fit(extent, {
              duration: 1000,
              padding: [100, 100, 100, 100],
              maxZoom: 12,
            });
          }
        }
      };

      // Try immediately first
      if (source.getFeatures().length > 0) {
        zoomToDistrict();
      } else {
        // Wait for features to load
        source.once("featuresloadend", zoomToDistrict);
      }
    } else if (selectedStateCode && selectedStateCode !== "") {
      // Zoom to state
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
    } else {
      // Zoom back to All India
      const indiaLayer = map.getLayers().getArray().find(l => l.get("name") === "indiaBase") as VectorLayer<VectorSource>;
      if (!indiaLayer) return;

      const source = indiaLayer.getSource();
      if (!source) return;

      const extent = source.getExtent();
      if (extent && extent.some(isFinite)) {
        map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
      }
    }
  }, [selectedStateCode, selectedDistrictCode, map]);

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

  // Add pointer move handler for hover info
  useEffect(() => {
    if (!map) return;

    const handlePointerMove = async (evt: MapBrowserEvent<any>) => {
      if (evt.dragging) {
        setHoverInfo(null);
        return;
      }

      const pixel = evt.pixel;
      let infoText = "";

      // Check for river features
      const riverLayer = map.getLayers().getArray().find(l => l.get("name") === "riverLayer") as VectorLayer<VectorSource>;
      if (riverLayer) {
        const riverFeature = map.forEachFeatureAtPixel(pixel, (feature) => feature, {
          layerFilter: (layer) => layer === riverLayer,
        }) as Feature<Geometry> | undefined;

        if (riverFeature) {
          const rivname = riverFeature.get("rivname") || riverFeature.get("RIVNAME") || riverFeature.get("RivName");
          infoText += `River: ${rivname || 'Unknown'}`;
        }
      }

      // Check for state
      const indiaLayer = map.getLayers().getArray().find(l => l.get("name") === "indiaBase") as VectorLayer<VectorSource>;
      if (indiaLayer) {
        const stateFeature = map.forEachFeatureAtPixel(pixel, (feature) => feature, {
          layerFilter: (layer) => layer === indiaLayer,
        }) as Feature<Geometry> | undefined;

        if (stateFeature) {
          const stateName = stateFeature.get("State") || stateFeature.get("state") || stateFeature.get("STATE");
          if (stateName && infoText) infoText += ` | `;
          if (stateName) infoText += `State: ${stateName}`;
        }
      }

      // Check for district
      const districtLayer = map.getLayers().getArray().find(l => l.get("name") === "districtBase") as VectorLayer<VectorSource>;
      if (districtLayer) {
        const districtFeature = map.forEachFeatureAtPixel(pixel, (feature) => feature, {
          layerFilter: (layer) => layer === districtLayer,
        }) as Feature<Geometry> | undefined;

        if (districtFeature) {
          const districtName = districtFeature.get("DISTRICT") || districtFeature.get("district") || districtFeature.get("District");
          if (districtName && infoText) infoText += ` | `;
          if (districtName) infoText += `District: ${districtName}`;
        }
      }

      // Check for water level station
      const resolution = map.getView().getResolution();
      if (resolution) {
        const waterLevelLayer = map.getLayers().getArray().find(l => l.get("name") === "waterLevel") as ImageLayer<ImageWMS>;
        if (waterLevelLayer) {
          const url = waterLevelLayer.getSource()?.getFeatureInfoUrl(
            evt.coordinate,
            resolution,
            "EPSG:3857",
            { INFO_FORMAT: "application/json" }
          );

          if (url) {
            try {
              const res = await fetch(url);
              const data = await res.json();
              if (data.features?.length > 0) {
                const props = data.features[0].properties;
                const stationName = props.name || props.NAME || props.stationCode || props.station_code;
                const waterLevel = props.value || props.VALUE;

                if (stationName && infoText) infoText += ` | `;
                if (stationName) infoText += `Station: ${stationName}`;
                if (waterLevel != null) infoText += ` (${Number(waterLevel).toFixed(2)}m)`;
              }
            } catch (err) {
              // Silently fail for hover
            }
          }
        }
      }

      setHoverInfo(infoText || null);
    };

    map.on("pointermove", handlePointerMove);
    return () => {
      map.un("pointermove", handlePointerMove);
    };
  }, [map]);

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
        districts,
        selectedDistrictCode,
        setSelectedDistrictCode,
        rivers,
        selectedRiverName,
        setSelectedRiverName,
        hoverInfo,
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