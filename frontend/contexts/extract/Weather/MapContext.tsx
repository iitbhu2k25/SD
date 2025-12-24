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
import { Fill, Stroke, Style, Icon, Text } from "ol/style";
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

  // ----- Styles -----
  const indiaBoundaryStyle = new Style({
    fill: new Fill({ color: "rgba(0, 0, 0, 0.01)" }),
    stroke: new Stroke({ color: "blue", width: 2 }),
  });

  // weather station style: label shown only at zoom >= 6
 const weatherStationStyle = (
  feature: FeatureLike,
  resolution: number
): Style => {
  const label = feature.get("label") || "";
  const zoom = map?.getView().getZoom() ?? 5;
  const showLabel = zoom >= 6;

  return new Style({
    image: new Icon({
      src:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24">
        <defs>
          <radialGradient id="grad" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#ffe1cc" />
            <stop offset="45%" stop-color="#ff7a29" />
            <stop offset="100%" stop-color="#d70000" />
          </radialGradient>
        </defs>

        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
          fill="url(#grad)" stroke="#8b0000" stroke-width="1.4"/>

        <circle cx="12" cy="10" r="3" fill="#b30000"/>
      </svg>`),
      scale: 0.9,
      anchor: [0.5, 1],
    }),

    text: showLabel
      ? new Text({
          text: String(label),
          offsetY: -42,
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
          "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json",
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
          "/geoserver/api/myworkspace/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:weather&outputFormat=application/json",
      }),
      style: weatherStationStyle,
      zIndex: 3,
      properties: { name: "weatherStations" },
    });

    // Weather WMS layer (background)
    const weatherLayer = new ImageLayer({
      source: new ImageWMS({
        url: "http://localhost:9090/geoserver/myworkspace/wms",
        params: {
          LAYERS: "myworkspace:weather",
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

    // Add click interaction for weather stations
    const selectInteraction = new Select({
      condition: click,
      layers: [weatherStationsLayer],
      style: (feature) => {
        const label = feature.get("label") || "";
        const zoom = newMap.getView().getZoom() || 5;
        const showLabel = zoom >= 6;

        return new Style({
          image: new Icon({
            src:
              "data:image/svg+xml;utf8," +
              encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#00ff00;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#006400;stop-opacity:1" />
                </linearGradient>
              </defs>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="#004d00" stroke-width="2" fill="url(#grad)" />
              <circle cx="12" cy="10" r="3" fill="#004d00"></circle>
            </svg>
          `),
            scale: 1.4,
            anchor: [0.5, 1],
          }),
          text: showLabel
            ? new Text({
              text: String(label),
              offsetY: -45,
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

    // if features load event exists, attempt fit on load end
    try {
      (indiaLayer.getSource() as VectorSource)?.on?.("featuresloadend", () => {
        try {
          fitToIndia(newMap, indiaSource);
        } catch (err) {
          console.warn("fitToIndia on featuresloadend failed", err);
        }
      });
    } catch (err) {

    }

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
