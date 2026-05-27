"use client";

import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "./admin/components/StatusBar";
import GroundwaterAssessmentAdmin from "./admin/page";
import GroundwaterAssessmentDrain from "./drain/page";

type GwaMode = "admin" | "drain";

export default function GroundwaterAssessmentPage() {
  const [mode, setMode] = useState<GwaMode>("admin");
  const [activeStep, setActiveStep] = useState<number>(1);
  const [enableGroundwaterDepth, setEnableGroundwaterDepth] = useState<boolean>(false);
  const [enableTimeseriesAnalysis, setEnableTimeseriesAnalysis] = useState<boolean>(false);
  const [selectionsLocked, setSelectionsLocked] = useState<boolean>(false);

  const handleLockedChange = useCallback((locked: boolean) => {
    setSelectionsLocked(locked);
  }, []);

  const handleModeChange = (newMode: GwaMode) => {
    setMode(newMode);
    setActiveStep(1);
    setEnableGroundwaterDepth(false);
    setEnableTimeseriesAnalysis(false);
    setSelectionsLocked(false);
  };

  const getAvailableSteps = () => {
    const steps = [1, 2, 3];
    if (enableGroundwaterDepth) steps.push(4);
    if (enableTimeseriesAnalysis) steps.push(5);
    return steps.sort();
  };
  const availableSteps = getAvailableSteps();
  const isFirstStep = activeStep === availableSteps[0];
  const isLastStep = activeStep === availableSteps[availableSteps.length - 1];

  const handleNext = () => {
    if (activeStep === 1 && !selectionsLocked) return;
    const idx = availableSteps.indexOf(activeStep);
    if (idx < availableSteps.length - 1) setActiveStep(availableSteps[idx + 1]);
  };
  const handlePrevious = () => {
    const idx = availableSteps.indexOf(activeStep);
    if (idx > 0) setActiveStep(availableSteps[idx - 1]);
  };

  const sharedProps = {
    activeStep,
    enableGroundwaterDepth,
    enableTimeseriesAnalysis,
    onSelectionsLockedChange: handleLockedChange,
    onModeChange: handleModeChange,
    currentMode: mode,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* StatusBar */}
      <div className="flex-shrink-0">
        <StatusBar
          activeStep={activeStep}
          onNext={handleNext}
          onPrevious={handlePrevious}
          enableGroundwaterDepth={enableGroundwaterDepth}
          enableTimeseriesAnalysis={enableTimeseriesAnalysis}
        />
      </div>

      {/* Optional Analysis Steps bar */}
      <div className="flex-shrink-0 bg-white mx-2 sm:mx-3 mt-2 rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-blue-500">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Optional Analysis Steps</h4>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-6">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGroundwaterDepth}
              onChange={(e) => {
                setEnableGroundwaterDepth(e.target.checked);
                if (!e.target.checked && activeStep === 4) setActiveStep(3);
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
                  const base = [1, 2, 3];
                  if (enableGroundwaterDepth) base.push(4);
                  setActiveStep(Math.max(...base));
                }
              }}
              className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-xs sm:text-sm font-medium text-gray-700">Timeseries Analysis and Forecasting</span>
          </label>
        </div>
      </div>

      {/* Module (PageLayout lives inside admin/drain) */}
      <div className="flex-1 min-h-0">
        {mode === "admin"
          ? <GroundwaterAssessmentAdmin {...sharedProps} />
          : <GroundwaterAssessmentDrain {...sharedProps} />
        }
      </div>

      {/* Bottom navigation bar */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={[
              "inline-flex items-center gap-1.5 font-medium text-sm rounded-full py-2 px-4 transition-all duration-200",
              isFirstStep
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400",
            ].join(" ")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Previous Step</span>
            <span className="sm:hidden">Prev</span>
          </button>
          <button
            onClick={handleNext}
            disabled={isLastStep || (activeStep === 1 && !selectionsLocked)}
            className={[
              "inline-flex items-center gap-1.5 font-medium text-sm rounded-full py-2 px-4 transition-all duration-200",
              isLastStep || (activeStep === 1 && !selectionsLocked)
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400",
            ].join(" ")}
          >
            <span className="hidden sm:inline">Next Step</span>
            <span className="sm:hidden">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
