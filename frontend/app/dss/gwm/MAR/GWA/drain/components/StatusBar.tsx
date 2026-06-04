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
  enableGroundwaterDepth,
  enableTimeseriesAnalysis,
}: StatusBarProps) {
  const steps = [
    { id: 1, name: 'Data Collection' },
    { id: 2, name: 'Groundwater Trend' },
    { id: 3, name: 'Groundwater Sustainability Ratio' },
    { id: 4, name: 'Groundwater Depth' },
    { id: 5, name: 'Timeseries Analysis' },
  ];

  const isStepEnabled = (id: number) => {
    if (id === 4) return enableGroundwaterDepth;
    if (id === 5) return enableTimeseriesAnalysis;
    return true;
  };

  const getStatus = (id: number) => {
    if (!isStepEnabled(id)) return 'disabled';
    if (id < activeStep) return 'completed';
    if (id === activeStep) return 'active';
    return 'pending';
  };

  const tooltipDesc: Record<number, string> = {
    1: 'Select area and collect groundwater well data.',
    2: 'Analyse groundwater level trends using Mann-Kendall test.',
    3: 'Compute recharge, demand and groundwater sustainability ratio.',
    4: 'Optional: Contour analysis of groundwater depth.',
    5: 'Optional: Timeseries forecasting of groundwater levels.',
  };

  const connectorColor = (id: number) => {
    const s = getStatus(id);
    if (s === 'completed') return '#22c55e';   // green
    if (s === 'active')    return '#93c5fd';   // blue-300
    return '#e5e7eb';                           // gray-200
  };

  return (
    <div className="bg-blue-50 px-3 py-1">
      {/* Labels row */}
      <div className="flex items-end mb-0.5">
        {steps.map((step, idx) => {
          const status = getStatus(step.id);
          return (
            <React.Fragment key={step.id}>
              <div className="flex-1 min-w-0 flex justify-center">
                <span className={`text-[10px] font-semibold text-center leading-tight block truncate px-0.5 ${
                  status === 'disabled' ? 'text-gray-400' :
                  status === 'active'   ? 'text-blue-700' :
                  status === 'completed'? 'text-green-700' : 'text-gray-600'
                }`}>
                  {step.name}
                </span>
              </div>
              {/* spacer for connector */}
              {idx < steps.length - 1 && <div style={{ width: 28, flexShrink: 0 }} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Circles + connectors row */}
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const status = getStatus(step.id);
          const isLast = idx === steps.length - 1;

          const badgeClass =
            status === 'completed' ? 'bg-green-100 text-green-700' :
            status === 'active'    ? 'bg-blue-100 text-blue-700' :
            status === 'disabled'  ? 'bg-gray-100 text-gray-400' :
            'bg-slate-100 text-slate-500';

          const statusLabel =
            status === 'completed' ? 'Completed' :
            status === 'active'    ? 'Current Step' :
            status === 'disabled'  ? 'Optional – Not Enabled' : 'Pending';

          return (
            <React.Fragment key={step.id}>
              {/* Step circle */}
              <div className="group relative flex-1 flex justify-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 flex-shrink-0 ${
                    status === 'disabled'  ? 'bg-gray-200 text-gray-400 border-2 border-gray-300' :
                    status === 'completed' ? 'bg-green-500 text-white' :
                    status === 'active'    ? 'bg-blue-600 text-white ring-2 ring-blue-200 scale-110' :
                    'bg-gray-400 text-white'
                  }`}
                >
                  {status === 'completed' ? '✓' : step.id}
                </div>

                {/* Sub-label */}
                <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-[9px] font-medium ${
                    status === 'disabled'  ? 'text-gray-400' :
                    status === 'active'    ? 'text-blue-500' :
                    status === 'completed' ? 'text-green-500' : 'text-gray-400'
                  }`}>
                    {status === 'completed' ? 'Done' :
                     status === 'active'    ? 'Current' :
                     status === 'disabled'  ? 'Optional' : ''}
                  </span>
                </div>

                {/* Hover tooltip */}
                <div className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 z-[99] hidden group-hover:block w-44">
                  <div className="flex justify-center -mb-px">
                    <div className="w-0 h-0" style={{
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderBottom: '6px solid white',
                      filter: 'drop-shadow(0 -1px 0 #e2e8f0)',
                    }} />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl shadow-2xl px-3 py-2">
                    <p className="text-[11px] font-bold text-slate-700">{step.id}. {step.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{tooltipDesc[step.id]}</p>
                    <span className={`mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrow connector between steps */}
              {!isLast && (
                <div className="flex items-center flex-shrink-0" style={{ width: 28 }}>
                  <svg width="28" height="10" viewBox="0 0 28 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Line */}
                    <line x1="0" y1="5" x2="22" y2="5" stroke={connectorColor(step.id)} strokeWidth="2.5" strokeLinecap="round"/>
                    {/* Arrowhead */}
                    <polyline points="19,2 26,5 19,8" fill="none" stroke={connectorColor(step.id)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
