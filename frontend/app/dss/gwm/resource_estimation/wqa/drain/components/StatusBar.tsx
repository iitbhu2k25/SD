'use client';

import React from 'react';

interface StatusBarProps {
  activeStep: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function StatusBar({ activeStep, onNext, onPrevious }: StatusBarProps) {
  const steps = [
    { id: 1, name: 'Data Collection' },
    { id: 2, name: 'Output & Report Generation' },
    // { id: 3, name: 'Groundwater Trend' },
    // { id: 4, name: 'Timeseries Analysis and Forecasting' },
    // { id: 5, name: 'Groundwater Recharge' },
  ];

  return (
    <div className="bg-blue-50 text-gray-800 p-4 shadow-lg">
      <div className="max-w-4xl mx-auto">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between space-x-4 mb-6">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  step.id < activeStep
                    ? 'bg-green-600 ring-0.5 ring-green-400'
                    : step.id === activeStep
                    ? 'bg-blue-600 ring-0.5 ring-blue-400 scale-110'
                    : 'bg-gray-600 ring-0.5 ring-gray-500'
                } text-gray-100 hover:ring-opacity-75`}
              >
                {step.id}
              </div>
              <span className="ml-1.5 text-sm font-semibold text-gray-800">{step.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
