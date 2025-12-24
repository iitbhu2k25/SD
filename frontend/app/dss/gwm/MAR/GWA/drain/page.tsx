"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StatusBar } from "./components/StatusBar";
import DataSelection from "./components/DataSelection";
import GroundwaterContour from "./components/contour";
import GroundwaterTrend from "./components/trend";
import GroundwaterForecast from "./components/forecast";
import GSR from "./components/GSR";
import PDF from "./components/pdf";
import { GroundwaterContourProvider } from "@/contexts/groundwater_assessment/drain/ContourContext";
import { GroundwaterTrendProvider } from "@/contexts/groundwater_assessment/drain/TrendContext";
import { GroundwaterForecastProvider } from "@/contexts/groundwater_assessment/drain/ForecastContext";
import Map from "./components/Map";
import { LocationProvider, useLocation } from "@/contexts/groundwater_assessment/drain/LocationContext";
import { WellProvider } from "@/contexts/groundwater_assessment/drain/WellContext";
import { MapProvider, useMap } from "@/contexts/groundwater_assessment/drain/MapContext";
import { RechargeProvider } from "@/contexts/groundwater_assessment/drain/RechargeContext";
import { DemandProvider } from "@/contexts/groundwater_assessment/drain/DemandContext";
import { GSRProvider, useGSR } from "@/contexts/groundwater_assessment/drain/GSRContext";
import { PDFProvider } from "@/contexts/groundwater_assessment/drain/PDFContext";
import { AdminUnitsProvider, useAdminUnits } from "@/contexts/groundwater_assessment/drain/AdminUnitsContext";
import ResizablePanels from "./components/resizable-panels";
import { useRecharge } from "@/contexts/groundwater_assessment/drain/RechargeContext";


interface Step {
  id: number;
  name: string;
}

interface GroundwaterAssessmentContentProps {
  contourData: any;
  trendData: any;
  forecastData: any;
}

// ✅ UPDATED: Compute Available Water Button - Uses pre-fetched admin units
function ComputeAvailableWaterButton() {
  const { selectedVillages } = useLocation();
  const { stateCode, districtCodes, subdistrictCodes, isLoading, error } = useAdminUnits();
  const { stressTableData } = useGSR();

  const handleClick = () => {
    // Validate that we have admin units data
    if (!stateCode && districtCodes.length === 0 && subdistrictCodes.length === 0) {
      alert('Location data is not available. Please try again or contact support.');
      console.error('❌ Admin units data not available');
      return;
    }

    // Build query parameters using pre-fetched admin units
    const params = new URLSearchParams();
    
    if (stateCode) {
      params.append('state', stateCode.toString());
    }
    if (districtCodes.length > 0) {
      params.append('districts', districtCodes.join(','));
    }
    if (subdistrictCodes.length > 0) {
      params.append('subdistricts', subdistrictCodes.join(','));
    }

    // Store stress data (injection need data) in localStorage
    if (stressTableData && stressTableData.length > 0) {
      try {
        localStorage.setItem('gwa_stress_data', JSON.stringify(stressTableData));
        console.log('✅ Stress data stored in localStorage:', stressTableData.length, 'villages');
      } catch (error) {
        console.error('❌ Failed to store stress data:', error);
        alert('Warning: Could not transfer stress data. The dataset might be too large.');
      }
    } else {
      // Clear any old stress data
      localStorage.removeItem('gwa_stress_data');
      console.log('⚠️ No stress data available to transfer');
    }

    const url = `/dss/gwm/MAR/SWA?${params.toString()}`;
    
    // Log what we're sending (same as admin case)
    console.log('=== SENDING DATA TO SWA MODULE (DRAIN CASE) ===');
    console.log('State Code:', stateCode);
    console.log('District Codes:', districtCodes);
    console.log('Subdistrict Codes:', subdistrictCodes);
    console.log('Stress Data (Injection Need):', stressTableData.length, 'villages');
    console.log('Selected Villages (Source):', selectedVillages);
    console.log('Full URL:', url);
    console.log('===============================================');

    // Open in new tab (same as admin case)
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Show loading state if admin units are still being fetched
  if (isLoading) {
    return (
      <button
        disabled
        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full py-3 px-6 shadow-lg opacity-50 cursor-not-allowed"
      >
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="whitespace-nowrap">Fetching Location Data...</span>
      </button>
    );
  }

  // Show error state if there was an error fetching admin units
  if (error) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold transition-all duration-200 rounded-full py-3 px-6 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50"
        title={error}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="whitespace-nowrap">Retry Location Data</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold transition-all duration-200 rounded-full py-3 px-6 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50 transform hover:scale-105"
    >
      <span className="whitespace-nowrap">Compute Available Water</span>
    </button>
  );
}

function GroundwaterAssessmentContent({ contourData, trendData, forecastData }: GroundwaterAssessmentContentProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [enableGroundwaterDepth, setEnableGroundwaterDepth] = useState<boolean>(false);
  const [enableTimeseriesAnalysis, setEnableTimeseriesAnalysis] = useState<boolean>(false);
  const [isMobileMapVisible, setIsMobileMapVisible] = useState<boolean>(false);
  const { addRasterLayer } = useMap();
  const { selectionsLocked } = useLocation();
  const { stressTableData } = useGSR();
  const { computeRecharge, tableData, isLoading, canComputeRecharge } = useRecharge();


  React.useEffect(() => {
    if (activeStep === 3 && canComputeRecharge() && tableData.length === 0) {
      console.log("✅ Auto-triggering groundwater recharge computation (drain)...");
      computeRecharge();
    }
  }, [activeStep]);

  const steps: Step[] = [
    { id: 1, name: "Data Collection" },
    { id: 2, name: "Groundwater Trend" },
    { id: 3, name: "Groundwater Sustainability Ratio" },
    { id: 4, name: "Groundwater Depth" },
    { id: 5, name: "Timeseries Analysis and Forecasting" },
  ];

  const getAvailableSteps = () => {
    const availableSteps = [1, 2, 3];
    if (enableGroundwaterDepth) availableSteps.push(4);
    if (enableTimeseriesAnalysis) availableSteps.push(5);
    return availableSteps.sort();
  };

  const handleNext = () => {
    if (activeStep === 1 && !selectionsLocked) {
      console.log("Cannot proceed: Location selections not confirmed");
      return;
    }

    const availableSteps = getAvailableSteps();
    const currentIndex = availableSteps.indexOf(activeStep);

    if (currentIndex < availableSteps.length - 1) {
      setActiveStep(availableSteps[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const availableSteps = getAvailableSteps();
    const currentIndex = availableSteps.indexOf(activeStep);

    if (currentIndex > 0) {
      setActiveStep(availableSteps[currentIndex - 1]);
    }
  };

  const availableSteps = getAvailableSteps();
  const isLastStep = activeStep === availableSteps[availableSteps.length - 1];
  const isFirstStep = activeStep === availableSteps[0];

  // Left Panel Content
  const leftPanel = (
    <div className="flex flex-col h-screen">
      <div className="flex-grow overflow-y-auto bg-white mx-2 sm:mx-3 my-2 rounded-lg shadow-md">
        <div className="p-3 sm:p-6">
          {activeStep === 1 ? (
            <DataSelection step={activeStep} />
          ) : activeStep === 2 ? (
            <GroundwaterTrend activeTab="groundwater-trend" step={activeStep} />
          ) : activeStep === 3 ? (
            <GSR step={activeStep} />
          ) : activeStep === 4 && enableGroundwaterDepth ? (
            <GroundwaterContour activeTab="groundwater-contour" step={activeStep} />
          ) : activeStep === 5 && enableTimeseriesAnalysis ? (
            <GroundwaterForecast activeTab="groundwater-forecast" step={activeStep} />
          ) : null}
        </div>
      </div>
    </div>
  );

  // Right Panel Content (Map)
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className="flex-grow bg-white mr-2 sm:mr-3 mx-2 lg:mx-0 my-2 rounded-lg shadow-md overflow-hidden min-h-[400px] lg:min-h-0">
        <div className="w-full h-full relative">
          {/* Map Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">
                <span className="hidden sm:inline">Interactive Map - Step {activeStep}: {steps[activeStep - 1].name}</span>
                <span className="sm:hidden">Step {activeStep}</span>
              </h3>
              <button
                onClick={() => setIsMobileMapVisible(false)}
                className="lg:hidden p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Close Map"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Map Content */}
          <div className="w-full h-full pt-10 sm:pt-13">
            <Map />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Fixed Top Step Bar */}
      <div className="flex-shrink-0 z-20">
        <StatusBar
          activeStep={activeStep}
          onNext={handleNext}
          onPrevious={handlePrevious}
          enableGroundwaterDepth={enableGroundwaterDepth}
          enableTimeseriesAnalysis={enableTimeseriesAnalysis}
        />
      </div>

      {/* Step Visibility Controls */}
      <div className="flex-shrink-0 bg-white mx-2 sm:mx-3 mt-2 rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-blue-500">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Optional Analysis Steps</h4>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-6">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGroundwaterDepth}
              onChange={(e) => {
                setEnableGroundwaterDepth(e.target.checked);
                if (!e.target.checked && activeStep === 4) {
                  setActiveStep(3);
                }
              }}
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Groundwater Depth Analysis</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableTimeseriesAnalysis}
              onChange={(e) => {
                setEnableTimeseriesAnalysis(e.target.checked);
                if (!e.target.checked && activeStep === 5) {
                  const newAvailableSteps = [1, 2, 3];
                  if (enableGroundwaterDepth) newAvailableSteps.push(4);
                  setActiveStep(Math.max(...newAvailableSteps));
                }
              }}
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Timeseries Analysis and Forecasting</span>
          </label>
        </div>
      </div>

      {/* Mobile Map Toggle Button */}
      <div className="flex-shrink-0 lg:hidden mx-2 sm:mx-3 mt-2">
        <button
          onClick={() => setIsMobileMapVisible(!isMobileMapVisible)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {isMobileMapVisible ? 'Show Data Panel' : 'Show Map'}
        </button>
      </div>

      {/* Main Content with Resizable Panels */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Desktop View with Resizable Panels */}
        <div className="hidden lg:block flex-grow min-h-0">
          <ResizablePanels left={leftPanel} right={rightPanel} />
        </div>

        {/* Mobile View - Toggle between panels */}
        <div className="lg:hidden flex-grow overflow-hidden">
          {isMobileMapVisible ? (
            <div className="h-full flex flex-col">
              {rightPanel}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {leftPanel}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex-shrink-0 bg-gray-100 p-2 sm:p-4 border-t border-gray-300 mx-2 sm:mx-3 mb-2 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4">
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={[
                "inline-flex items-center justify-center gap-2 text-white font-semibold transition-colors duration-300 ease-in-out rounded-full py-3 px-6",
                isFirstStep
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50",
              ].join(" ")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous Step</span>
              <span className="sm:hidden">Previous</span>
            </button>

            <button
              onClick={handleNext}
              disabled={isLastStep || (activeStep === 1 && !selectionsLocked)}
              className={[
                "inline-flex items-center justify-center gap-2 text-white font-semibold transition-colors duration-300 ease-in-out rounded-full py-3 px-6",
                (isLastStep || (activeStep === 1 && !selectionsLocked))
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-md focus:outline-none focus:ring-4 focus:ring-green-400 focus:ring-opacity-50",
              ].join(" ")}
            >
              <span className="hidden sm:inline">Next Step</span>
              <span className="sm:hidden">Next</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* PDF Download and Compute Available Water Buttons */}
          {activeStep >= 3 && (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-3 mb-1">
              <PDF contourData={contourData} trendData={trendData} forecastData={forecastData} />

              {/* ✅ Compute Available Water Button - Only shown when stress data is available */}
              {stressTableData.length > 0 && (
                <ComputeAvailableWaterButton />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Map Toggle */}
      <div className="lg:hidden flex-shrink-0 bg-gray-100 border-t border-gray-300 p-2">
        <button
          onClick={() => setIsMobileMapVisible(!isMobileMapVisible)}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-sm">{isMobileMapVisible ? 'View Data' : 'View Map'}</span>
        </button>
      </div>
    </div>
  );
}

export default function GroundwaterAssessmentDrain() {
  const [contourData, setContourData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);

  const handleGeoJsonData = (data: { type: "contour" | "raster"; payload: any }) => {
    console.log("ContourData updated", data);
    setContourData(data.payload);
  };

  const handleTrendData = (data: any) => {
    setTrendData(data);
    console.log("Trend data:", data);
  };

  const handleForecastData = (data: any) => {
    setForecastData(data);
    console.log("Forecast data:", data);
  };

  return (
    <LocationProvider>
      <AdminUnitsProvider> {/* ✅ AdminUnitsProvider wraps everything to provide location data */}
        <WellProvider>
          <MapProvider>
            <PDFProvider>
              <GroundwaterContourProvider activeTab="groundwater-contour" onGeoJsonData={handleGeoJsonData}>
                <GroundwaterTrendProvider activeTab="groundwater-trend" onTrendData={handleTrendData}>
                  <GroundwaterForecastProvider activeTab="groundwater-forecast" onForecastData={handleForecastData}>
                    <RechargeProvider>
                      <DemandProvider>
                        <GSRProvider>
                          <GroundwaterAssessmentContent contourData={contourData} trendData={trendData} forecastData={forecastData} />
                        </GSRProvider>
                      </DemandProvider>
                    </RechargeProvider>
                  </GroundwaterForecastProvider>
                </GroundwaterTrendProvider>
              </GroundwaterContourProvider>
            </PDFProvider>
          </MapProvider>
        </WellProvider>
      </AdminUnitsProvider>
    </LocationProvider>
  );
}