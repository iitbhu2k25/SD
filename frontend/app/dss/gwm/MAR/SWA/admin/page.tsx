'use client';

import React, { useState } from 'react';
import { LocationProvider, useLocationContext } from "@/contexts/surfacewater_assessment/admin/LocationContext";
import { StreamFlowProvider, useStreamFlowContext } from "@/contexts/surfacewater_assessment/admin/StreamFlowContext";
import { VillageSurplusProvider } from "@/contexts/surfacewater_assessment/admin/VillageSurplusContext";
import { EflowProvider } from "@/contexts/surfacewater_assessment/admin/EflowContext";
import { MapProvider } from "@/contexts/surfacewater_assessment/admin/MapContext";
import { ClimateAdminProvider } from "@/contexts/surfacewater_assessment/admin/ClimateContext";
import LocationPage from './components/Location';
import MapPage from './components/Map';
import StreamFlow from './components/StreamFlow';
import VillageSurplus from './components/VillageSurplus';
import Eflow from './components/eflow/Eflow';
import Climate from './components/climate';
import ResizablePanels from './components/resizable-panels';
import { BarChart3, Droplets, Leaf, CloudRain, ChevronUp, ChevronDown } from 'lucide-react';

type TabType = 'fdc' | 'surplus' | 'eflow' | 'climate';

const MainContent: React.FC = () => {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const { fetchData: fetchStreamFlowData, hasData: hasStreamFlowData } = useStreamFlowContext();
  const [activeTab, setActiveTab] = useState<TabType>('fdc');
  const [isLocationVisible, setIsLocationVisible] = useState(true);

  const tabs = [
    { id: 'fdc', label: 'Flow Duration Curve', icon: BarChart3, color: 'blue', component: StreamFlow },
    // { id: 'surplus', label: 'Village Surplus', icon: Droplets, color: 'green', component: VillageSurplus },
    { id: 'eflow', label: 'Environmental Flow', icon: Leaf, color: 'purple', component: Eflow },
    { id: 'climate', label: 'Climate Change', icon: CloudRain, color: 'orange', component: Climate },
  ] as const;

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);

    // Trigger data fetch when clicking FDC tab if data not loaded
    if (tabId === 'fdc' && !hasStreamFlowData && selectionConfirmed) {
      const ids = getConfirmedSubdistrictIds();
      if (ids.length > 0) {
        fetchStreamFlowData(ids);
      }
    }
    // Add similar logic for other tabs as needed
  };

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || StreamFlow;

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
      <ResizablePanels
        left={
          <div className="flex-grow overflow-y-auto bg-white m-2 rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 space-y-6">
              {/* Location Section - Collapsible after confirmation */}
              <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
                {/* Toggle Button - Only show after confirmation */}
                {selectionConfirmed && (
                  <div className="flex justify-end  ">
                    <button
                      onClick={() => setIsLocationVisible(!isLocationVisible)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 
                               bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200
                               border border-gray-300 shadow-sm"
                    >
                      {isLocationVisible ? (
                        <>
                          <ChevronUp className="w-2 h-2" />
                          Hide Location
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-2 h-2" />
                          Show Location
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Location Component with smooth collapse animation */}
                <div
                  className={`
                    transition-all duration-300 ease-in-out overflow-visible
                    ${isLocationVisible ? 'max-h-[2000px] opacity-100 pointer-events-auto' : 'max-h-0 opacity-0 pointer-events-none'}
                  `}
                >
                  <div className="relative z-50">
                    <LocationPage />
                  </div>
                </div>

              </div>

              {/* Tab Navigation - Shows after confirmation */}
              {selectionConfirmed && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => handleTabClick(tab.id as TabType)}
                          className={`
                            relative flex flex-col items-center justify-center p-4 rounded-lg border-2 
                            transition-all duration-200 transform hover:scale-105
                            ${isActive
                              ? 'bg-blue-800 text-white border-gray-800 shadow-lg'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }
                          `}
                        >
                          <span className="text-sm font-semibold text-center leading-tight">
                            {tab.label}
                          </span>
              
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Tab Content - Shows after confirmation */}
              {selectionConfirmed && (
                <div className="transition-all duration-300 ease-in-out">
                  <ActiveComponent />
                </div>
              )}
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
  );
};

const SurfaceWaterAssessmentAdmin: React.FC = () => {
  return (
    <LocationProvider>
      <StreamFlowProvider>
        {/* <VillageSurplusProvider> */}
        <EflowProvider>
          <MapProvider>
            <ClimateAdminProvider>
              <MainContent />
            </ClimateAdminProvider>
          </MapProvider>
        </EflowProvider>
        {/* </VillageSurplusProvider> */}
      </StreamFlowProvider>
    </LocationProvider>
  );
};

export default SurfaceWaterAssessmentAdmin;
