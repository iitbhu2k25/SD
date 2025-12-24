// frontend/app/dss/gwm/MAR/SWA/drain/page.tsx
'use client';

import React, { useState } from 'react';
import { LocationProvider, useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';
import { StreamFlowProvider, useStreamFlowContext } from '@/contexts/surfacewater_assessment/drain/StreamFlowContext';
import { MapProvider } from '@/contexts/surfacewater_assessment/drain/MapContext';
import { SurfaceWaterProvider, useSurfaceWater } from '@/contexts/surfacewater_assessment/drain/SurfaceWater';
import { EflowProvider, useEflow } from '@/contexts/surfacewater_assessment/drain/EFlowContext';
import { ClimateProvider, useClimate } from '@/contexts/surfacewater_assessment/drain/ClimateContext';
import LocationPage from './components/Location';
import StreamFlow from './components/StreamFlow';
import SurfaceWaterCard from './components/surfacewater';
import MapPage from './components/Map';
import EFlow from './components/EFlow';
import Climate from './components/climate';
import ResizablePanels from './components/resizable-panels';
import { BarChart3, Droplets, Leaf, CloudRain } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ExportPDF from './components/Export/ExportPDF';
import { usePdf, PdfProvider } from './components/pdfprovider';

type TabType = 'streamflow' | 'surfacewater' | 'eflow' | 'climate';

const tabs = [
  { id: 'streamflow', label: 'Stream Flow', icon: BarChart3, color: 'blue', component: StreamFlow },
  { id: 'surfacewater', label: 'Surface Water', icon: Droplets, color: 'green', component: SurfaceWaterCard },
  { id: 'eflow', label: 'Environmental Flow', icon: Leaf, color: 'purple', component: EFlow },
  { id: 'climate', label: 'Climate Change', icon: CloudRain, color: 'orange', component: Climate },
] as const;

const MainContent: React.FC = () => {
  const { selectionConfirmed, selectedSubbasins } = useLocationContext();
  const [activeTab, setActiveTab] = useState<TabType>('streamflow');
  const { series, hasData } = useStreamFlowContext();

  const { isPdfReady, isPreparingPdf, pdfError, pdfData, handlePreparePDF, resetPdf } = usePdf();

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
  };

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || StreamFlow;

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
      <ResizablePanels
        left={
          <div className="flex-grow overflow-y-auto bg-white m-2 rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 space-y-6">

              {/* Location Section */}
              <div className="sticky top-0 bg-white z-10 pb-4 border-b border-gray-200">
                <LocationPage />
              </div>

              {/* Download PDF Button */}
              {selectionConfirmed && (
                <div className="space-y-3">
                  <div className="flex justify-end gap-3">
                    {!isPdfReady ? (
                      <button
                        onClick={handlePreparePDF}
                        disabled={isPreparingPdf}
                        className={`px-4 py-2 rounded-lg transition-all ${
                          isPreparingPdf
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-700 text-white hover:bg-blue-800'
                        }`}
                      >
                        {isPreparingPdf ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Preparing...
                          </div>
                        ) : (
                          'Prepare PDF Report'
                        )}
                      </button>
                    ) : (
                      <>
                        <PDFDownloadLink
                          document={
                            <ExportPDF
                              series={pdfData.series}
                              hasData={pdfData.hasData}
                              selectedSubbasins={pdfData.selectedSubbasins}
                              surfaceWaterResults={pdfData.surfaceWaterResults}
                              eflowResults={pdfData.eflowResults}
                              climateResults={pdfData.climateResults}
                            />
                          }
                          fileName="Surface_Water_Assessment.pdf"
                          className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-all inline-flex items-center gap-2"
                        >
                          {({ loading }) =>
                            loading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating PDF...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                                </svg>
                                Download PDF Report
                              </>
                            )
                          }
                        </PDFDownloadLink>

                        <button
                          onClick={resetPdf}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>

                  {pdfError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{pdfError}</p>
                    </div>
                  )}

                  {isPdfReady && !pdfError && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        PDF ready! Click "Download PDF Report" to save the file.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Navigation */}
              {selectionConfirmed ? (
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
                          {isActive && (
                            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="relative inline-flex items-center group">
                  <i className="ti ti-info-circle text-amber-700 cursor-help" aria-hidden="true" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-lg opacity-0 invisible transition-opacity duration-200 z-20 group-hover:opacity-100 group-hover:visible">
                    Select subbasins and click Confirm to proceed.
                  </span>
                </span>
              )}

              {/* Active Tab Content */}
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

export default function SurfaceWaterAssessmentDrain() {
  return (
    <LocationProvider>
      <StreamFlowProvider>
        <MapProvider>
          <SurfaceWaterProvider>
            <EflowProvider>
              <ClimateProvider>
                <PdfProvider>
                  <MainContent />
                </PdfProvider>
              </ClimateProvider>
            </EflowProvider>
          </SurfaceWaterProvider>
        </MapProvider>
      </StreamFlowProvider>
    </LocationProvider>
  );
}
