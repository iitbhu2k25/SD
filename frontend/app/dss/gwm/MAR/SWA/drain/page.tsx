'use client';

import React from 'react';
import LocationPage from './components/Location';
import StreamFlow from '@/app/dss/GWM/MAR/SWA/drain/components/StreamFlow';
import SurfaceWaterCard from '@/app/dss/GWM/MAR/SWA/drain/components/surfacewater';
import MapPage from './components/Map';
import { LocationProvider, useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';
import { StreamFlowProvider } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { MapProvider } from '@/contexts/surfacewater_assessment/drain/MapContext';
import { SurfaceWaterProvider } from '@/contexts/surfacewater_assessment/drain/SurfaceWater';
import { EflowProvider } from '@/contexts/surfacewater_assessment/drain/EFlowContext';
import { ClimateProvider } from '@/contexts/surfacewater_assessment/drain/ClimateContext';
import EFlow from './components/EFlow';
import Climate from './components/climate';

function LeftPanelContent() {
  const { selectionConfirmed } = useLocationContext();
  return (
    <div className="p-6 space-y-6">
      <LocationPage />
      {selectionConfirmed ? (
        <>
          <StreamFlow />
          <SurfaceWaterCard />
          <EFlow />
          <Climate />
        </>
      ) : (
        <span className="relative inline-flex items-center group">
  <i className="ti ti-info-circle text-amber-700 cursor-help" aria-hidden="true" />
  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-lg opacity-0 invisible transition-opacity duration-200 z-20 group-hover:opacity-100 group-hover:visible">
    Select subbasins and click Confirm to proceed.
  </span>
</span>

      )}
    </div>
  );
}

export default function SurfaceWaterAssessmentDrain() {
  return (
    <LocationProvider>
      <StreamFlowProvider>
        <MapProvider>
          <SurfaceWaterProvider>
            <EflowProvider>
              <ClimateProvider>
                <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
                  <div className="flex-grow flex overflow-hidden">
                    <div className="w-[55%] min-w-0 flex flex-col">
                      <div className="flex-grow overflow-y-auto bg-white m-2 rounded-xl shadow-lg border border-gray-200">
                        <LeftPanelContent />
                      </div>
                    </div>
                    <div className="w-[45%] min-w-0 flex flex-col">
                      <div className="flex-grow m-2 rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <MapPage />
                      </div>
                    </div>
                  </div>
                </div>
              </ClimateProvider>
            </EflowProvider>
          </SurfaceWaterProvider>
        </MapProvider>
      </StreamFlowProvider>
    </LocationProvider>
  );
}
