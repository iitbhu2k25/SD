"use client";

import React from "react";
import "ol/ol.css";

interface MapProps {
  mapElement: React.RefObject<HTMLDivElement | null>;
  popupRef: React.RefObject<HTMLDivElement | null>;
  map: any;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  toggleBaseMap: () => void;
  isSatellite: boolean;
  isFullScreen: boolean;
  toggleFullscreen: () => void;
  isPopupVisible: boolean;
  states: { label: string; state_code: string }[];
  selectedStateCode: string | null;
  setSelectedStateCode: (code: string | null) => void;
}

const MapComponent: React.FC<MapProps> = ({
  mapElement,
  popupRef,
  map,
  handleZoomIn,
  handleZoomOut,
  toggleBaseMap,
  isSatellite,
  isFullScreen,
  toggleFullscreen,
  isPopupVisible,
  states,
  selectedStateCode,
  setSelectedStateCode,
}) => {
  return (
    <div className={`${isPopupVisible ? 'w-1/2' : 'w-full'} h-full relative transition-all duration-300`}>
      <div className="h-full w-full relative rounded-lg overflow-hidden shadow-2xl border-4 border-gray-300">
        <div ref={mapElement} className="w-full h-full bg-gray-200" style={{ minHeight: "400px" }}>
          {!map && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Initializing map...</p>
              </div>
            </div>
          )}
        </div>

        <div ref={popupRef} style={{ display: 'none' }} />

        {/* State Dropdown + Zoom Controls */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
          {/* State Dropdown */}
          <select
            value={selectedStateCode || ""}
            onChange={(e) => setSelectedStateCode(e.target.value || null)}
            className="px-4 py-3 bg-white rounded-xl shadow-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
            disabled={states.length === 0}
          >
            {states.length === 0 ? (
              <option>Loading states...</option>
            ) : (
              states.map((state) => (
                <option key={state.state_code} value={state.state_code}>
                  {state.label}
                </option>
              ))
            )}
          </select>

          {/* Zoom Buttons */}
         
        </div>

        {/* Base Map Toggle */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleBaseMap}
            className="px-6 py-3 bg-white rounded-xl shadow-lg border font-medium flex items-center gap-3 hover:bg-gray-50 transition"
            disabled={!map}
          >
            {isSatellite ? "Street Map" : "Satellite"}
          </button>
          <div className="absolute top-16 right-0 flex flex-col gap-2 mt-1">
           <button onClick={handleZoomIn} className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" disabled={!map}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button onClick={handleZoomOut} className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" disabled={!map}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          </div>
        </div>

        {/* Fullscreen */}
        <div className="absolute bottom-4 right-4 z-20">
          <button
            onClick={toggleFullscreen}
            className="p-4 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition"
          >
            {isFullScreen ? (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h4V3M17 7h-4V3M7 17h4v4M17 17h-4v4" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;