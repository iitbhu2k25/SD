"use client";

import React, { useState } from "react";
import { StatusBar } from "./components/StatusBar";
import DataSelection from "./components/DataSelection";
import GroundwaterContour from "./components/contour";
import { GroundwaterContourProvider } from "@/contexts/water_quality_assesment/admin/ContourContext";
import Map from "./components/Map";
import { LocationProvider, useLocation } from "@/contexts/water_quality_assesment/admin/LocationContext";
import { WellProvider } from "@/contexts/water_quality_assesment/admin/WellContext";
import { MapProvider, useMap } from "@/contexts/water_quality_assesment/admin/MapContext";

interface Step {
  id: number;
  name: string;
}

function GroundwaterAssessmentContent() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [contourData, setContourData] = useState<any>(null);
  const { addRasterLayer, removeAllRasterLayers } = useMap();
  const { selectionsLocked } = useLocation();

  const steps: Step[] = [
    { id: 1, name: "Data Collection" },
    { id: 2, name: "GWQI Analysis" },
  ];

  const handleNext = () => {
    if (activeStep === 2) {
      console.log("GWQI is the final step - use Generate Report button instead");
      return;
    }
    
    if (activeStep === 1 && !selectionsLocked) {
      console.log("Cannot proceed: Location selections not confirmed");
      return;
    }
    
    if (activeStep < 2) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 1) {
      console.log("Going back to previous step - clearing map layers");
      
      // Clear all raster layers from map when going back
      removeAllRasterLayers();
      
      // Clear stored data
      setContourData(null);
      
      setActiveStep(activeStep - 1);
    }
  };

  const handleGeoJsonData = (data: { type: 'contour' | 'raster'; payload: any }) => {
    setContourData(data);
    if (data.type === 'raster') {
      const { layer_name, geoserver_url } = data.payload;
      console.log('Received raster data:', { layer_name, geoserver_url });
      if (layer_name && geoserver_url) {
        addRasterLayer(layer_name, geoserver_url);
        console.log(`Raster layer added to map: ${layer_name}`);
      } else {
       console.log('Invalid raster data:', data.payload);
      }
    }
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Fixed Top Step Bar */}
      <div className="flex-shrink-0 z-10">
        <StatusBar
          activeStep={activeStep}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      </div>

      {/* Main Content - Fixed Height Layout */}
      <div className="flex-grow flex overflow-hidden">
        {/* Left Panel - Scrollable Content */}
        <div className="w-[55%] flex flex-col">
          {/* Scrollable Content Area */}
          <div className="flex-grow overflow-y-auto bg-white mx-3 my-2 rounded-lg shadow-md">
            <div className="p-6">
              {activeStep === 1 ? (
                <DataSelection step={activeStep} />
              ) : activeStep === 2 ? (
                <GroundwaterContourProvider
                  activeTab="groundwater-contour"
                  onGeoJsonData={handleGeoJsonData}
                >
                  <GroundwaterContour
                    activeTab="groundwater-contour"
                    step={activeStep}
                  />
                </GroundwaterContourProvider>
              ) : (
                <div className="text-gray-500">
                  <h2 className="text-xl font-semibold mb-4">{steps[activeStep - 1].name}</h2>
                  <p>Content for this step is not yet implemented.</p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Bottom Navigation for Left Panel */}
          <div className="flex-shrink-0 bg-gray-100 p-4 border-t border-gray-300">
            <div className="flex justify-center space-x-4">
              <button
                onClick={handlePrevious}
                disabled={activeStep === 1}
                className={`px-6 py-3 rounded-lg text-white font-semibold transition-all duration-300 ${
                  activeStep === 1
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                }`}
              >
                Previous Step
              </button>
              
              {/* Only show Next Step button if not on GWQI step */}
              {activeStep < 2 && (
                <button
                  onClick={handleNext}
                  disabled={activeStep === 1 && !selectionsLocked}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition-all duration-300 ${
                    (activeStep === 1 && !selectionsLocked)
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
                  }`}
                >
                  Next Step
                </button>
              )}
              
              {/* Show info message on GWQI step */}
              {activeStep === 2 && (
                <div className="px-6 py-3 bg-green-100 text-green-800 rounded-lg font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate GWQI Report using the button above
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Fixed Map */}
        <div className="w-[45%] h-[90%] flex flex-col">
          <div className="flex-grow bg-white mr-3 my-2 rounded-lg shadow-md overflow-hidden">
            <div className="w-full h-full relative">
              <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  Interactive Map
                </h3>
              </div>
              <div className="w-full h-full pt-13">
                <Map />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GroundwaterAssessmentAdmin() {
  return (
    <LocationProvider>
      <WellProvider>
        <MapProvider>
          <GroundwaterAssessmentContent />
        </MapProvider>
      </WellProvider>
    </LocationProvider>
  );
}