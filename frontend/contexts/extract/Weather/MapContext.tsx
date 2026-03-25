// contexts/extract/WeatherMapContext.tsx
"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { FeatureLike } from "ol/Feature";
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
import { Fill, Stroke, Style, Circle, Text } from "ol/style";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { Feature } from "ol";
import { Geometry } from "ol/geom";
import { Select } from "ol/interaction";
import { click } from "ol/events/condition";


interface WeatherData {
  locationName: string;
  weather: string;
  temperature: string;
  feelsLike: string;
  humidity: string;
  wind: string;
  observationTime: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
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

interface WeatherMapContextType {
  mapRef: React.RefObject<HTMLDivElement | null>;
  map: Map | null;
  isLoading: boolean;
  isSatellite: boolean;
  toggleBaseMap: () => void;
  weatherData: WeatherData | null;
  isLoadingWeather: boolean;
  selectedStation: string | null;
  closeWeatherPanel: () => void;
  states: StateOption[];
  selectedStateCode: string | null;
  setSelectedStateCode: (code: string | null) => void;
  districts: DistrictOption[];
  selectedDistrictCode: string | null;
  setSelectedDistrictCode: (code: string | null) => void;
}

const WeatherMapContext = createContext<WeatherMapContextType | undefined>(undefined);

export const WeatherMapProvider = ({ children }: { children: ReactNode }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSatellite, setIsSatellite] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(5);
  
  // State and District selection states
  const [states, setStates] = useState<StateOption[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<string | null>(null);

  // ----- Styles -----
  const indiaBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "blue", width: 2 }),
  });

  const districtBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "green", width: 1 }),
  });

  // weather station style: label shown only at zoom >= 6
  // Replace the weatherStationStyle function with this simpler version:
const weatherStationStyle = (
  feature: FeatureLike,
  resolution: number
): Style => {
  const label = feature.get("label") || "";
  const zoom = map?.getView().getZoom() ?? 5;
  const showLabel = zoom >= 6;

  return new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: "#ff4444" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),

    text: showLabel
      ? new Text({
          text: String(label),
          offsetY: -15,
          font: "600 12px Arial",
          fill: new Fill({ color: "#000" }),
          stroke: new Stroke({ color: "#fff", width: 3 }),
          textAlign: "center",
        })
      : undefined,
  });
};

  // ----- Parsing helper (defensive) -----
  const parseWeatherData = (html: string): WeatherData | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Defensive lookups: some selectors might not exist
      const locationName =
        doc.querySelector("h3")?.textContent?.trim() ||
        doc.querySelector(".location")?.textContent?.trim() ||
        "Unknown";

      const weather =
        doc.querySelector(".weather span")?.textContent?.trim() ||
        doc.querySelector(".cond")?.textContent?.trim() ||
        "N/A";

      const temps = doc.querySelectorAll("#temperature");
      const temperature = temps.length > 0 ? temps[0].textContent?.trim() || "N/A" : "N/A";
      const feelsLike = temps.length > 1 ? temps[1].textContent?.trim() || "N/A" : "N/A";

      const temp1 = doc.querySelectorAll("#temperature1");
      const humidity = temp1.length > 0 ? temp1[0].textContent?.trim() || "N/A" : "N/A";
      const wind = temp1.length > 1 ? temp1[1].textContent?.trim() || "N/A" : "N/A";

      // Additional small info blocks
      const divs = doc.querySelectorAll(".tempt > div, .extra > div");
      let observationTime = "N/A";
      let sunrise = "N/A";
      let sunset = "N/A";
      let moonrise = "N/A";
      let moonset = "N/A";

      divs.forEach((div) => {
        const text = div.textContent || "";
        const cleaned = text.replace(/\s+/g, " ").trim();
        if (/Observation time/i.test(cleaned)) {
          observationTime = cleaned.replace(/Observation time\s*:?/i, "").trim();
        } else if (/Sunrise/i.test(cleaned)) {
          sunrise = cleaned.replace(/Sunrise\s*:?/i, "").trim();
        } else if (/Sunset/i.test(cleaned)) {
          sunset = cleaned.replace(/Sunset\s*:?/i, "").trim();
        } else if (/Moonrise/i.test(cleaned)) {
          moonrise = cleaned.replace(/Moonrise\s*:?/i, "").trim();
        } else if (/Moonset/i.test(cleaned)) {
          moonset = cleaned.replace(/Moonset\s*:?/i, "").trim();
        }
      });

      return {
        locationName,
        weather,
        temperature,
        feelsLike,
        humidity,
        wind,
        observationTime,
        sunrise,
        sunset,
        moonrise,
        moonset,
      };
    } catch (error) {
      console.error("Error parsing weather HTML:", error);
      return null;
    }
  };

  // ----- Robust fetch helper (timeout + retries + backoff) -----
  const fetchWithTimeoutAndRetry = async (
    url: string,
    options: RequestInit = {},
    timeoutMs = 10000,
    retries = 2,
    backoffFactor = 1.6
  ): Promise<string> => {
    let attempt = 0;
    let wait = 800; // initial backoff ms

    while (attempt <= retries) {
      attempt += 1;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          // Avoid caching stale content
          cache: "no-store",
        });

        clearTimeout(id);

        if (!res.ok) {
          // treat non-2xx as error to retry
          throw new Error(`HTTP ${res.status}`);
        }

        const text = await res.text();

        // Basic validation: ensure we got HTML-like content
        if (!text || text.length < 50) {
          throw new Error("Empty or too-small response body");
        }

        return text;
      } catch (err) {
        clearTimeout(id);
        const isLastAttempt = attempt > retries;
        console.warn(`Fetch attempt ${attempt} failed for ${url}:`, err);

        if (isLastAttempt) {
          throw err;
        }

        // wait exponential backoff before next attempt
        await new Promise((r) => setTimeout(r, wait));
        wait = Math.round(wait * backoffFactor);
      }
    }

    throw new Error("Unreachable fetch logic");
  };

  // ----- Main weather fetch function -----
  const fetchWeatherData = async (stationId: string) => {
    setIsLoadingWeather(true);
    setSelectedStation(stationId);
    try {
      // Prefer raw proxy to avoid JSON wrapping and ensure plain HTML
      const proxy = "https://api.allorigins.win/raw?url=";
      const target = encodeURIComponent(
        `https://mausam.imd.gov.in/responsive/LIP/sample4State.php?id=${encodeURIComponent(
          stationId
        )}`
      );

      // Add cache-busting timestamp so repeated requests go through
      const url = `${proxy}${target}&_=${Date.now()}`;

      // try fetch with timeout and retries
      const html = await fetchWithTimeoutAndRetry(url, {}, 12000, 2, 1.7);

      // validate that the HTML likely contains weather info
      if (!/Observation time|Sunrise|Sunset|#temperature|class="weather"/i.test(html)) {
        console.warn("Fetched HTML doesn't contain expected weather markers, attempting parse anyway.");
      }

      const parsed = parseWeatherData(html);
      if (!parsed) {
        throw new Error("Parsing produced null result");
      }

      setWeatherData(parsed);
    } catch (error) {
      console.error("fetchWeatherData failed:", error);

      // Final fallback state: provide a clear error object so UI can show meaningful message
      setWeatherData({
        locationName: "Unavailable",
        weather: "Unable to fetch weather (IMD may block direct requests)",
        temperature: "N/A",
        feelsLike: "N/A",
        humidity: "N/A",
        wind: "N/A",
        observationTime: "N/A",
        sunrise: "N/A",
        sunset: "N/A",
        moonrise: "N/A",
        moonset: "N/A",
      });
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Close weather panel
  const closeWeatherPanel = () => {
    setWeatherData(null);
    setSelectedStation(null);
  };

  // Fit to India extent function
  const fitToIndia = useCallback((indiaMap: Map, indiaSource: VectorSource) => {
    try {
      const extent = indiaSource.getExtent();
      if (Array.isArray(extent) && extent.every((e) => Number.isFinite(e))) {
        indiaMap.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          duration: 1000,
          maxZoom: 6,
        });
        setIsLoading(false);
      }
    } catch (err) {
      console.warn("fitToIndia failed:", err);
    }
  }, []);

  // ----- Map init -----
  useEffect(() => {
    if (!mapRef.current || map) return;

    // Base map layers
    const osmLayer = new TileLayer({
      source: new OSM(),
      properties: { name: "osm" },
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maxZoom: 19,
      }),
      visible: true,
      properties: { name: "satellite" },
    });

    // India boundary layer (WFS)
    const indiaLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url:
          `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json`,
      }),
      style: indiaBoundaryStyle,
      zIndex: 1,
      properties: { name: "indiaBase" },
    });

    // Weather stations layer (WFS with points)
    const weatherStationsLayer = new VectorLayer({
      source: new VectorSource({
        format: new GeoJSON(),
        url:
          `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:weather&outputFormat=application/json`,
      }),
      style: weatherStationStyle,
      zIndex: 3,
      properties: { name: "weatherStations" },
    });

    // Weather WMS layer (background)
    const weatherLayer = new ImageLayer({
      source: new ImageWMS({
        url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wms`,
        params: {
          LAYERS: `${process.env.NEXT_PUBLIC_FAST_WORKSPACE}:weather`,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
      visible: true,
      opacity: 0.8,
      zIndex: 2,
      properties: { name: "weather" },
    });

    const newMap = new Map({
      target: mapRef.current,
      view: new View({
        center: fromLonLat([78.9629, 22.5937]),
        zoom: 5,
        minZoom: 3,
        maxZoom: 18,
      }),
      layers: [osmLayer, satelliteLayer, indiaLayer, weatherLayer, weatherStationsLayer],
      controls: defaultControls({ zoom: false, attribution: true, rotate: false }).extend([
        new ScaleLine({ units: "metric", bar: true, steps: 4, text: true, minWidth: 140 }),
      ]),
    });

    // Listen to zoom changes to refresh layer styles
    newMap.getView().on("change:resolution", () => {
      const zoom = newMap.getView().getZoom();
      if (zoom !== undefined) {
        setCurrentZoom(zoom);
        weatherStationsLayer.changed(); // Force layer re-render to update label visibility
      }
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
      try {
        fitToIndia(newMap, source);
      } catch (err) {
        console.warn("fitToIndia on featuresloadend failed", err);
      }
    });

    // Add click interaction for weather stations
    const selectInteraction = new Select({
  condition: click,
  layers: [weatherStationsLayer],
  style: (feature) => {
    const label = feature.get("label") || "";
    const zoom = newMap.getView().getZoom() || 5;
    const showLabel = zoom >= 6;

    return new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: "#00ff00" }),
        stroke: new Stroke({ color: "#004d00", width: 2 }),
      }),
      text: showLabel
        ? new Text({
            text: String(label),
            offsetY: -15,
            font: "bold 12px Arial",
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
            textAlign: "center",
          })
        : undefined,
    });
  },
});

    selectInteraction.on("select", (e) => {
      if (e.selected && e.selected.length > 0) {
        const feature = e.selected[0];
        const stationId = feature.get("station_");
        if (stationId) {
          // ensure stationId is a string
          fetchWeatherData(String(stationId));
        }
      }
    });

    newMap.addInteraction(selectInteraction);

    // Ensure india fit: multiple strategies
    const indiaSource = indiaLayer.getSource() as VectorSource;

    const timeoutId = setTimeout(() => {
      try {
        fitToIndia(newMap, indiaSource);
      } catch (err) {
        console.warn("fitToIndia initial timeout call failed", err);
      }
    }, 2000);

    // refresh source to trigger load
    try {
      indiaSource?.refresh();
    } catch (err) {
      // ignore
    }

    setMap(newMap);

    return () => {
      clearTimeout(timeoutId);
      newMap.setTarget(undefined);
      setMap(null);
      setIsLoading(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToIndia]);

  // Dynamically load district layer when state is selected
useEffect(() => {
  if (!map || !selectedStateCode || selectedStateCode === "") {
    // Remove district layer if no state selected
    if (map) {  // Add this check
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
          url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_district&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
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
        .filter((item): item is DistrictOption => item !== null && Boolean(item.district_code))  // Change here
        .sort((a, b) => a.label.localeCompare(b.label));

      setDistricts([{ label: "All Districts", district_code: "", state_code: selectedStateCode }, ...districtList]);
    });
  } else {
      // Update existing layer with new CQL filter
       const source = districtLayer.getSource();
    if (source) {
      const cqlFilter = `STATE_CODE='${selectedStateCode}'`;
      const newUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_district&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;
      
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
          .filter((item): item is DistrictOption => item !== null && Boolean(item.district_code))  // Change here
          .sort((a, b) => a.label.localeCompare(b.label));

        setDistricts([{ label: "All Districts", district_code: "", state_code: selectedStateCode }, ...districtList]);
      });
    }
  }

  // Reset district selection when state changes
  setSelectedDistrictCode(null);
}, [selectedStateCode, map]);

  // Apply CQL filter to weather layers when state or district changes
  useEffect(() => {
    if (!map) return;

    // Apply filter to Weather WMS layer
    const weatherWMSLayer = map.getLayers().getArray().find(l => l.get("name") === "weather") as ImageLayer<ImageWMS>;
    if (weatherWMSLayer) {
      const source = weatherWMSLayer.getSource();
      if (source) {
        const params = source.getParams();
        let cqlFilter = "";

        if (selectedDistrictCode && selectedDistrictCode !== "") {
          cqlFilter = `DISTRICT_C = '${selectedDistrictCode}'`;
        } else if (selectedStateCode && selectedStateCode !== "") {
          cqlFilter = `STATE_CODE = '${selectedStateCode}'`;
        }

        if (cqlFilter) {
          params.CQL_FILTER = cqlFilter;
        } else {
          delete params.CQL_FILTER;
        }

        source.updateParams({ ...params, t: Date.now() });
      }
    }

    // Apply filter to Weather Stations layer
    const weatherStationsLayer = map.getLayers().getArray().find(l => l.get("name") === "weatherStations") as VectorLayer<VectorSource>;
    if (weatherStationsLayer) {
      const source = weatherStationsLayer.getSource();
      if (source) {
        let cqlFilter = "";

        if (selectedDistrictCode && selectedDistrictCode !== "") {
          cqlFilter = `DISTRICT_C = '${selectedDistrictCode}'`;
        } else if (selectedStateCode && selectedStateCode !== "") {
          cqlFilter = `STATE_CODE = '${selectedStateCode}'`;
        }

        const baseUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:weather&outputFormat=application/json`;
        const newUrl = cqlFilter 
          ? `${baseUrl}&CQL_FILTER=${encodeURIComponent(cqlFilter)}`
          : baseUrl;

        source.clear();
        source.setUrl(newUrl);
        source.refresh();
      }
    }
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

      if (source.getFeatures().length > 0) {
        zoomToDistrict();
      } else {
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

  // Toggle base map
  const toggleBaseMap = () => {
    setIsSatellite((prev) => {
      const osmLayer = map?.getLayers().getArray().find((l) => l.get("name") === "osm");
      const satelliteLayer = map?.getLayers().getArray().find((l) => l.get("name") === "satellite");

      if (osmLayer && satelliteLayer) {
        osmLayer.setVisible(prev); // when prev true (satellite on), osm setVisible(true) => switch
        satelliteLayer.setVisible(!prev);
      }
      return !prev;
    });
  };

  return (
    <WeatherMapContext.Provider
      value={{
        mapRef,
        map,
        isLoading,
        isSatellite,
        toggleBaseMap,
        weatherData,
        isLoadingWeather,
        selectedStation,
        closeWeatherPanel,
        states,
        selectedStateCode,
        setSelectedStateCode,
        districts,
        selectedDistrictCode,
        setSelectedDistrictCode,
      }}
    >
      {children}
    </WeatherMapContext.Provider>
  );
};

export const useWeatherMap = () => {
  const context = useContext(WeatherMapContext);
  if (!context) {
    throw new Error("useWeatherMap must be used within WeatherMapProvider");
  }
  return context;
};