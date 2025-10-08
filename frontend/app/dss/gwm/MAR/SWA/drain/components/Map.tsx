"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import "ol/ol.css";
import { useMap } from "@/contexts/surfacewater_assessment/drain/MapContext";
import { useLocationContext } from "@/contexts/surfacewater_assessment/drain/LocationContext";

const MapComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { setMapContainer, mapInstance, isLoading, error, showLabels, toggleLabels } = useMap();
  const { selectedSubbasins } = useLocationContext();
  const [isFs, setIsFs] = useState(false);

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
    } catch (e) {
      // optionally surface an error toast
    }
  }, []);

  return (
    <div ref={wrapRef} className="map-container relative w-full h-full bg-gray-100">
      {!mapInstance && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-gray-600">
            {isLoading ? "Loading map..." : error || "Initializing..."}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 left-10 z-20 flex gap-2">
        <button
          onClick={toggleLabels}
          className={`bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200 ${showLabels ? "bg-blue-50 border-blue-300" : ""}`}
          title={showLabels ? "Hide Labels" : "Show Labels"}
        >
          <svg className={`w-5 h-5 ${showLabels ? "text-blue-600" : "text-gray-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>

        <button
          onClick={toggleFullscreen}
          className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors duration-200"
          title={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {/* simple icon swap */}
          {isFs ? (
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7h4V3M17 7h-4V3M7 17h4v4M17 17h-4v4" />
            </svg>
          )}
        </button>
      </div>

      <div ref={mapRef} className="relative w-full h-full" style={{ minHeight: "700px" }} />
    </div>
  );
};

export default MapComponent;
