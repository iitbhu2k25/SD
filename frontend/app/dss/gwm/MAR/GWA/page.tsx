"use client";

import React, { useCallback, useEffect, useState } from "react";
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
    if (locked) {
      // Auto-advance to step 2 when wells are confirmed
      setActiveStep(2);
    }
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
  // Step 1 is data collection (left panel only) — Previous is disabled from step 2 onwards
  const isFirstStep = activeStep <= 2;
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

  const optionalStepsBar = (
    <div className="bg-white px-3 py-2 border-b border-stone-200">
      <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Optional Analysis Steps</h4>
      <div className="flex flex-col space-y-1.5 sm:flex-row sm:space-y-0 sm:space-x-6">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableGroundwaterDepth}
            onChange={(e) => {
              setEnableGroundwaterDepth(e.target.checked);
              if (!e.target.checked && activeStep === 4) setActiveStep(3);
            }}
            className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-xs font-medium text-gray-700">Groundwater Depth Analysis</span>
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
            className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-xs font-medium text-gray-700">Timeseries Analysis and Forecasting</span>
        </label>
      </div>
    </div>
  );

  const navigationProps = {
    activeStep,
    onNext: handleNext,
    onPrevious: handlePrevious,
    isFirstStep,
    isLastStep,
    selectionsLocked,
    enableGroundwaterDepth,
    enableTimeseriesAnalysis,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Module (PageLayout lives inside admin/drain) */}
      <div className="flex-1 min-h-0">
        {mode === "admin"
          ? <GroundwaterAssessmentAdmin {...sharedProps} optionalStepsBar={optionalStepsBar} navigationProps={navigationProps} />
          : <GroundwaterAssessmentDrain {...sharedProps} optionalStepsBar={optionalStepsBar} navigationProps={navigationProps} />
        }
      </div>
    </div>
  );
}
