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
  districts: { label: string; district_code: string; state_code: string }[];
  selectedDistrictCode: string | null;
  setSelectedDistrictCode: (code: string | null) => void;
  rivers: { label: string; rivname: string }[];
  selectedRiverName: string | null;
  setSelectedRiverName: (name: string | null) => void;
  hoverInfo: string | null;
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
  states = [],
  selectedStateCode,
  setSelectedStateCode,
  districts = [],
  selectedDistrictCode,
  setSelectedDistrictCode,
  rivers = [],
  selectedRiverName,
  setSelectedRiverName,
  hoverInfo,
}) => {
  return (
  <div className={`${isPopupVisible ? "w-1/2" : "w-full"} h-full relative transition-all duration-300`}>
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

      <div ref={popupRef} style={{ display: "none" }} />

      {/* Hover Info */}
      {hoverInfo && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-30 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap pointer-events-none">
          {hoverInfo}
        </div>
      )}

    {/* Base Map + Zoom Controls */}
<div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
  <button
    onClick={toggleBaseMap}
    className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition"
    disabled={!map}
    title={isSatellite ? "Switch to Street Map" : "Switch to Satellite"}
  >
    {isSatellite ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )}
  </button>

  <button 
    onClick={handleZoomIn} 
    className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" 
    disabled={!map}
    title="Zoom In"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  </button>

  <button 
    onClick={handleZoomOut} 
    className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition" 
    disabled={!map}
    title="Zoom Out"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  </button>
</div>

      {/* Fullscreen Button - Bottom Right */}
<div className="absolute bottom-4 right-4 z-20">
  <button
    onClick={toggleFullscreen}
    className="p-3 bg-white rounded-xl shadow-lg border hover:bg-gray-50 transition"
    title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
  >
    {isFullScreen ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    )}
  </button>
</div>

    </div>
  </div>
);

};

export default MapComponent;