// frontend/app/dss/rsq/admin/page.tsx
"use client";
import React, { useState } from "react";
import AreaSelection from "./components/AreaSelection";
import RSQAnalysis from "./components/rsq";
import Map from "./components/Map";
import { LocationProvider, useLocation } from "@/contexts/rsq/drain/LocationContext";
import { MapProvider } from "@/contexts/rsq/drain/MapContext";
import { RSQProvider } from "@/contexts/rsq/drain/RsqContext";


/* ================= MAIN CONTENT ================= */
function RSQAssessmentContent() {
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [isMobileMapVisible, setIsMobileMapVisible] = useState(false);
//   const { selectedBlocks, selectedVillages } = useLocation();

  // Handle confirmation from AreaSelection component
  const handleAreaConfirmed = () => {
    setLocationConfirmed(true);
  };

  /* ================= LEFT PANEL ================= */
  const leftPanel = (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6">RSQ Assessment</h1>
      
      {/* Location Section with Toggle */}
      {(!locationConfirmed || showLocation) && (
        <div className="mb-6">
          <AreaSelection onAreaConfirmed={handleAreaConfirmed} />
        </div>
      )}
      
      {/* Toggle Location Visibility Button */}
      {locationConfirmed && (
        <button
          onClick={() => setShowLocation(!showLocation)}
          className="flex items-center gap-2 mb-6 text-blue-600 hover:text-blue-700"
        >
          <span className="text-xl">{showLocation ? "👁️" : "👁️‍🗨️"}</span>
          <span>{showLocation ? "Hide Location" : "Show Location"}</span>
        </button>
      )}
      
      {/* RSQ Analysis - Only show after location confirmed */}
      {locationConfirmed && <RSQAnalysis />}
     
    </div>
    
  );

  /* ================= RIGHT PANEL (MAP) ================= */
  const rightPanel = (
    <div className="relative h-full bg-gray-100 px-2 sm:px-3">
      {/* Floating Close Button for Mobile */}
      <button
        onClick={() => setIsMobileMapVisible(false)}
        className="lg:hidden absolute top-3 right-3 z-50 bg-black/60 text-white px-3 py-1 rounded-md"
      >
        ✕
      </button>
      {/* MAP */}
      <div className="h-full mt-3 mb-3 rounded-2xl border border-gray-300 shadow-lg overflow-hidden bg-white">
   
      <Map />
      </div>
    </div>
  );

  /* ================= RENDER ================= */
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Mobile Map Toggle */}
      <div className="lg:hidden p-4">
        <button
          onClick={() => setIsMobileMapVisible(!isMobileMapVisible)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {isMobileMapVisible ? "Show Data Panel" : "Show Map"}
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: 50-50 Split */}
        <div className="hidden lg:grid lg:grid-cols-2 h-full">
          <div className="overflow-y-auto">{leftPanel}</div>
          <div>{rightPanel}</div>
        </div>

        {/* Mobile: Toggle */}
        <div className="lg:hidden h-full overflow-y-auto">
          {isMobileMapVisible ? rightPanel : leftPanel}
        </div>
      </div>
    </div>
  );
}

/* ================= PROVIDER WRAPPER ================= */
export default function RSQAssessmentDrain() {
  return (
<LocationProvider>
  <RSQProvider>
    <MapProvider>
          <RSQAssessmentContent />
    </MapProvider>
  </RSQProvider>
</LocationProvider>
  );
}