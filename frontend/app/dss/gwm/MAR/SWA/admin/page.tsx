'use client';

import React from 'react';
import { LocationProvider } from "@/contexts/surfacewater_assessment/admin/LocationContext";
import { StreamFlowProvider } from "@/contexts/surfacewater_assessment/admin/StreamFlowContext";
import { VillageSurplusProvider } from "@/contexts/surfacewater_assessment/admin/VillageSurplusContext";
import { EflowProvider } from "@/contexts/surfacewater_assessment/admin/EflowContext";
import { MapProvider } from "@/contexts/surfacewater_assessment/admin/MapContext";
import { ClimateAdminProvider } from "@/contexts/surfacewater_assessment/admin/ClimateContext";
 import LocationPage from './components/Location';
 import MapPage from './components/Map';
 import StreamFlow from './components/StreamFlow';
 import VillageSurplus from './components/VillageSurplus';
 import Eflow from './components/Eflow';
 import Climate from './components/climate';

import ResizablePanels from './components/resizable-panels';

const SurfaceWaterAssessmentAdmin: React.FC = () => {
  return (
    <LocationProvider>
       <StreamFlowProvider>
       <VillageSurplusProvider>
          <EflowProvider>  
            <MapProvider>
              <ClimateAdminProvider>
                <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
                  <ResizablePanels
                    left={
                      <div className="flex-grow overflow-y-auto bg-white m-2 rounded-xl shadow-lg border border-gray-200">
                        <div className="p-6 space-y-6">
                          <LocationPage />
                           <StreamFlow />
                           <VillageSurplus />
                          <Eflow />
                          <Climate />  
                        </div>
                      </div>
                    }
                    right={
                      <div className="flex-grow m-2 rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <MapPage />
                      </div>
                    }
                  />
                </div>
              </ClimateAdminProvider>
            </MapProvider>
           </EflowProvider>
       </VillageSurplusProvider>
       </StreamFlowProvider>
    </LocationProvider>
  );
};

export default SurfaceWaterAssessmentAdmin;
