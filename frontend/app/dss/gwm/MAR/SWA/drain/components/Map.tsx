"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import "ol/ol.css";
import { useMap } from "@/contexts/surfacewater_assessment/drain/MapContext";
import { useLocationContext } from "@/contexts/surfacewater_assessment/drain/LocationContext";

type BaseMap = {
  name: string;
  icon: string;
};

type BaseMaps = {
  [key: string]: BaseMap;
};

const baseMaps: BaseMaps = {
  osm: {
    name: "OpenStreetMap",
    icon: "M9 20l-5.447-2.724a1 1 0 010-1.947L9 12.618l-5.447-2.724a1 1 0 010-1.947L9 5.236l-5.447-2.724a1 1 0 010-1.947L9 -1.146",
  },
  satellite: {
    name: "Satellite",
    icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
};
const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    selectedBaseMap,
    changeBaseMap,
    setMapContainer,
    mapInstance,
    isLoading,
    error,
  } = useMap();
  const { selectedSubbasins } = useLocationContext();
  const [isFs, setIsFs] = useState(false);
  const [isBasemapPanelOpen, setIsBasemapPanelOpen] = useState(false);

  useEffect(() => {
    if (mapRef.current) setMapContainer(mapRef.current);
    return () => setMapContainer(null);
  }, [setMapContainer]);

  useEffect(() => {
    const onFsChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // optionally surface an error toast
    }
  }, []);

  // Handle base map change via context function
  const handleBaseMapChange = (key: string) => {
    changeBaseMap(key);
    setIsBasemapPanelOpen(false);
  };

  return (
    <div ref={wrapRef} className="map-container relative w-full h-full bg-gray-100">
      {!mapInstance && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-gray-600">
            {isLoading ? "Loading map..." : error || "Initializing..."}
          </div>
        </div>
      )}
      {/* Basemap Selector */}
      <div className="absolute top-2 right-4 z-[1000]">
        <button
          onClick={() => setIsBasemapPanelOpen(!isBasemapPanelOpen)}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors duration-200 flex items-center gap-2"
          title="Change Base Map"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={baseMaps[selectedBaseMap]?.icon}
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {baseMaps[selectedBaseMap]?.name}
          </span>
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${
              isBasemapPanelOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isBasemapPanelOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-[1001]">
            <div className="p-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Select Base Map</h3>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(baseMaps).map(([key, baseMap]) => (
                  <button
                    key={key}
                    onClick={() => handleBaseMapChange(key)}
                    className={`flex items-center gap-3 w-full p-3 rounded-md text-left transition-colors duration-200 ${
                      selectedBaseMap === key
                        ? "bg-blue-50 border border-blue-200 text-blue-700"
                        : "hover:bg-gray-50 border border-transparent text-gray-700"
                    }`}
                  >
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={baseMap.icon}
                      />
                    </svg>
                    <span className="text-sm font-medium">{baseMap.name}</span>
                    {selectedBaseMap === key && (
                      <svg
                        className="w-4 h-4 text-blue-600 ml-auto"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute top-3 left-10 z-20 flex gap-2">
        <button
          onClick={toggleFullscreen}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
          title={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFs ? (
            <svg
              className="w-5 h-5 text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 7h4V3M17 7h-4V3M7 17h4v4M17 17h-4v4"
              />
            </svg>
          )}
        </button>
      </div>

      <div ref={mapRef} className="relative w-full h-full" style={{ minHeight: "700px" }} />
    </div>
  );
};

export default MapComponent;
