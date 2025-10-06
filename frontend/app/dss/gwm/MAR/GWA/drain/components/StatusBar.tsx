'use client';

import React from 'react';

interface StatusBarProps {
  activeStep: number;
  onNext: () => void;
  onPrevious: () => void;
  enableGroundwaterDepth: boolean;
  enableTimeseriesAnalysis: boolean;
}

export function StatusBar({
  activeStep,
  onNext,
  onPrevious,
  enableGroundwaterDepth,
  enableTimeseriesAnalysis
}: StatusBarProps) {
  const steps = [
    { id: 1, name: 'Data Collection' },
    { id: 2, name: 'Groundwater Trend' },
    { id: 3, name: 'Groundwater Sustainability Ratio' },
    { id: 4, name: 'Groundwater Depth' },
    { id: 5, name: 'Timeseries Analysis and Forecasting' },
  ];

  const isStepEnabled = (stepId: number) => {
    if (stepId === 4) return enableGroundwaterDepth;
    if (stepId === 5) return enableTimeseriesAnalysis;
    return true; // Steps 1, 2, and 3 are always enabled
  };

  const getStepStatus = (step: { id: number }) => {
    if (!isStepEnabled(step.id)) {
      return 'disabled';
    }
    if (step.id < activeStep) {
      return 'completed';
    }
    if (step.id === activeStep) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="bg-blue-50 text-gray-800 p-4 shadow-lg">
      <div className="max-w-5xl mx-auto">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between space-x-2 mb-6">
          {steps.map((step) => {
            const status = getStepStatus(step);

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${status === 'disabled'
                      ? 'bg-gray-400 ring-1 ring-gray-300 opacity-50'
                      : status === 'completed'
                        ? 'bg-green-600 ring-1 ring-green-400'
                        : status === 'active'
                          ? 'bg-blue-600 ring-1 ring-blue-400 scale-110'
                          : 'bg-gray-600 ring-1 ring-gray-500'
                    } text-white hover:ring-opacity-75`}
                >
                  {step.id}
                </div>
                <div className="ml-2 flex-1">
                  <span
                    className={`text-sm font-semibold block transition-all duration-300 ${status === 'disabled'
                        ? 'text-gray-400 opacity-50'
                        : status === 'active'
                          ? 'text-blue-700'
                          : status === 'completed'
                            ? 'text-green-700'
                            : 'text-gray-700'
                      }`}
                  >
                    {step.name}
                  </span>
                  {status === 'disabled' && (
                    <span className="text-xs text-gray-400 block">(Optional - Not Enabled)</span>
                  )}
                  {status === 'active' && (
                    <span className="text-xs text-blue-600 block">(Current Step)</span>
                  )}
                  {status === 'completed' && (
                    <span className="text-xs text-green-600 block">(Completed)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Core vs Optional Steps Legend */}
        <div className="flex justify-center space-x-8 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <span>Core Steps (1-3)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Optional Steps (4-5)</span>
          </div>
        </div>
      </div>
    </div>
  );
}