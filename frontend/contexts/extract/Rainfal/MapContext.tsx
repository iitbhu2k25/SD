"use client";

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import Overlay from "ol/Overlay";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import MultiPolygon from "ol/geom/MultiPolygon";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";

import { RainfallFeature, RainfallData, DailyContext } from "./RaifallContext";

type MapContextType = {
  mapInstance: Map | null;
  setMapContainer: (el: HTMLElement | null) => void;
  isLoading: boolean;
  error: string | null;
  selectedBaseMap: "osm" | "satellite";
  changeBaseMap: (key: "osm" | "satellite") => void;
  rainfallData: RainfallData | null;
  setSelectedState: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSelectedDistrict: React.Dispatch<React.SetStateAction<string | undefined>>;
  selectedState: string | undefined;
  selectedDistrict: string | undefined;
};

const MapContext = createContext<MapContextType | undefined>(undefined);

const baseMaps = {
  osm: new TileLayer({
    source: new OSM(),
  }),
  satellite: new TileLayer({
    source: new OSM(), // Replace with satellite source if available
  }),
};

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const dailyContext = useContext(DailyContext);
  if (!dailyContext) throw new Error("MapProvider must be used within DailyProvider");

  const { rainfallData, category } = dailyContext;

  const mapRef = useRef<Map | null>(null);
  const [mapContainer, setMapContainer] = useState<HTMLElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState<"osm" | "satellite">("osm");

  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const [selectedState, setSelectedState] = useState<string | undefined>(undefined);
  const [selectedDistrict, setSelectedDistrict] = useState<string | undefined>(undefined);

  // Initialize map and tooltip overlay
  useEffect(() => {
    if (!mapContainer) return;

    const vectorLayer = new VectorLayer({
      source: vectorSourceRef.current,
      style: (feature) => {
        const color = feature.get("color") || "#000000";
        const isDistrict = feature.get("district") !== undefined;
        const isRiverBasin = feature.get("basin_name") !== undefined;

        return new Style({
          image: new CircleStyle({
            radius: isDistrict ? 5 : isRiverBasin ? 0 : 7,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#333", width: 1 }),
          }),
          fill: new Fill({ color: color + "80" }), // Add transparency for polygons
          stroke: new Stroke({ 
            color: isRiverBasin ? "#0891b2" : "#333", 
            width: isRiverBasin ? 2 : 1 
          }),
        });
      },
    });

    const map = new Map({
      target: mapContainer,
      layers: [baseMaps[selectedBaseMap], vectorLayer],
      view: new View({
        center: fromLonLat([78.9629, 20.5937]),
        zoom: 5,
      }),
      controls: [],
    });

    mapRef.current = map;
    setIsLoading(false);

    // Create a persistent hover tooltip container
    const hoverTooltipContainer = document.createElement("div");
    hoverTooltipContainer.style.backgroundColor = "white";
    hoverTooltipContainer.style.padding = "8px 12px";
    hoverTooltipContainer.style.borderRadius = "10px";
    hoverTooltipContainer.style.border = "1px solid #1411c5ff";
    hoverTooltipContainer.style.minWidth = "200px";
    hoverTooltipContainer.style.position = "absolute";
    hoverTooltipContainer.style.pointerEvents = "none";
    hoverTooltipContainer.style.whiteSpace = "nowrap";
    hoverTooltipContainer.style.display = "none";
    hoverTooltipContainer.style.zIndex = "1000";
    hoverTooltipContainer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    document.body.appendChild(hoverTooltipContainer);

    const hoverOverlay = new Overlay({
      element: hoverTooltipContainer,
      offset: [10, 0],
      positioning: "bottom-left",
    });
    map.addOverlay(hoverOverlay);

    map.on("pointermove", (evt) => {
      if (evt.dragging) return;
      const pixel = map.getEventPixel(evt.originalEvent);
      const feature = map.forEachFeatureAtPixel(pixel, (feat) => feat, { hitTolerance: 5 });

      if (feature) {
        hoverOverlay.setPosition(evt.coordinate);

        const district = feature.get("district");
        const state = feature.get("state");
        const basinName = feature.get("basin_name");
        const precipitation = feature.get("precipitation");
        const fmo = feature.get("fmo");
        const date = feature.get("date");

        if (basinName) {
          // River Basin tooltip
          hoverTooltipContainer.innerHTML = `
            <div style="font-weight: bold; color: #0891b2; margin-bottom: 4px;">${basinName}</div>
            <div style="font-size: 12px; color: #666;">FMO: ${fmo || "N/A"}</div>
            <div style="font-size: 12px; margin-top: 4px;">
              <strong>Precipitation:</strong> ${precipitation || "N/A"}
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">Date: ${date || "N/A"}</div>
          `;
        } else {
          // State/District tooltip
          const locationLabel = district
            ? `<b>${district}</b><br/><i>${state || ""}</i>`
            : `<b>${state || "Unknown"}</b>`;

          hoverTooltipContainer.innerHTML = `
            ${locationLabel}<br/>
            Actual Rainfall: ${feature.get("actual_rainfall") || "N/A"}<br/>
            Normal Rainfall: ${feature.get("normal_rainfall") || "N/A"}<br/>
            Departure: ${feature.get("departure") || "N/A"}<br/>
            Category: ${feature.get("category") || "No Data"}<br/>
            Last Updated: ${feature.get("last_updated") || ""}
          `;
        }
        hoverTooltipContainer.style.display = "block";
      } else {
        hoverOverlay.setPosition(undefined);
        hoverTooltipContainer.style.display = "none";
      }
    });

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      if (hoverTooltipContainer.parentNode) {
        hoverTooltipContainer.parentNode.removeChild(hoverTooltipContainer);
      }
    };
  }, [mapContainer, selectedBaseMap]);

  // Update rainfall geometries when rainfallData changes
  useEffect(() => {
    if (!mapRef.current || !rainfallData) return;

    vectorSourceRef.current.clear();

    const features: Feature[] = rainfallData.features
      .filter((f: RainfallFeature) => f.geometry && Array.isArray(f.geometry.coordinates))
      .map((f: RainfallFeature) => {
        let geometry;

        if (f.geometry.type === "Point") {
          geometry = new Point(fromLonLat(f.geometry.coordinates));
        } else if (f.geometry.type === "Polygon") {
          geometry = new Polygon(f.geometry.coordinates);
        } else if (f.geometry.type === "MultiPolygon") {
          geometry = new MultiPolygon(f.geometry.coordinates);
        } else {
          return null;
        }

        const feature = new Feature({
          geometry,
          state: f.properties.state || f.properties.rainfall_title,
          district: f.properties.district || f.properties.DISTRICT,
          actual_rainfall: f.properties.actual_rainfall || f.properties.rainfall_info,
          normal_rainfall: f.properties.normal_rainfall || "0 mm",
          departure: f.properties.departure || f.properties.rainfall_info,
          category: f.properties.category || "No Data",
          color: f.properties.color || f.properties.rainfall_color || "#D8D8D8",
          last_updated: f.properties.last_updated || new Date().toISOString(),
          // River Basin properties
          basin_name: f.properties.basin_name || f.properties.Basin_1,
          precipitation: f.properties.precipitation,
          fmo: f.properties.fmo_precip || f.properties.FMO_1,
          date: f.properties.date,
        });
        return feature;
      })
      .filter(Boolean) as Feature[];

    vectorSourceRef.current.addFeatures(features);

    if (features.length > 0) {
      const extent = vectorSourceRef.current.getExtent();
      if (extent && extent.some(Number.isFinite)) {
        mapRef.current.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: category === "district" ? 8 : category === "riverbasin" ? 6 : 5,
          duration: 800,
        });
      }
    }
  }, [rainfallData, category]);

  const changeBaseMap = useCallback(
    (key: "osm" | "satellite") => {
      if (!mapRef.current) return;
      setSelectedBaseMap(key);

      Object.keys(baseMaps).forEach((k) => {
        mapRef.current!.removeLayer(baseMaps[k as keyof typeof baseMaps]);
      });
      mapRef.current.addLayer(baseMaps[key]);
    },
    [],
  );

  return (
    <MapContext.Provider
      value={{
        mapInstance: mapRef.current,
        setMapContainer,
        isLoading,
        error,
        selectedBaseMap,
        changeBaseMap,
        rainfallData,
        selectedState,
        setSelectedState,
        selectedDistrict,
        setSelectedDistrict,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMapContext must be used within MapProvider");
  return ctx;
};