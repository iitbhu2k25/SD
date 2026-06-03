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
    <div className="bg-stone-50 px-3 py-1.5 border-b border-stone-200">
      <div className="flex items-center gap-4">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider whitespace-nowrap">Optional</span>
        <label className="flex items-center gap-1.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={enableGroundwaterDepth}
            onChange={(e) => {
              setEnableGroundwaterDepth(e.target.checked);
              if (!e.target.checked && activeStep === 4) setActiveStep(3);
            }}
            className="w-3 h-3 accent-stone-500"
          />
          <span className={`text-[11px] font-medium transition-colors ${enableGroundwaterDepth ? 'text-stone-700' : 'text-stone-400'}`}>GW Depth Analysis</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer group">
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
            className="w-3 h-3 accent-stone-500"
          />
          <span className={`text-[11px] font-medium transition-colors ${enableTimeseriesAnalysis ? 'text-stone-700' : 'text-stone-400'}`}>Timeseries Forecast</span>
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
