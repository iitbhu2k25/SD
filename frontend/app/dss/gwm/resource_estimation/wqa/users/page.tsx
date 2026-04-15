"use client";

import React, { useState, useEffect } from "react";
import { RiverSystemProvider } from "@/contexts/gwm/water_quality_assesment/users/DrainContext";
import { MapProvider } from "@/contexts/gwm/water_quality_assesment/users/DrainMapContext";
import WholeLoading from "@/components/app_layout/newLoading";
import { useRiverSystem } from "@/contexts/gwm/water_quality_assesment/users/DrainContext";
import MapView from "@/app/dss/gwm/resource_estimation/wqa/users/components/openlayer";
import { useMap } from "@/contexts/gwm/water_quality_assesment/users/DrainMapContext";
import RiverSelector from "@/app/dss/gwm/resource_estimation/wqa/users/components/locations";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import { YearProvider, useYear } from "@/contexts/gwm/water_quality_assesment/users/yearContext";
import YearSelector from "@/app/dss/gwm/resource_estimation/wqa/users/components/year";
import MultiSelectButtons from "@/app/dss/gwm/resource_estimation/wqa/users/components/Params";
import WQIDataTable from "@/app/dss/gwm/resource_estimation/wqa/admin/components/utils/dataTable";
import { WQIInterface } from "@/interface/table";

/* ── Section label ───────────────────────────────────────── */
const SectionLabel: React.FC<{ icon: React.ReactNode; title: string; badge?: string }> = ({ icon, title, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-slate-400">{icon}</span>
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</span>
    {badge && (
      <span className="ml-auto text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

const Divider = () => <div className="border-t border-slate-100 my-1" />;

/* ── Main content ────────────────────────────────────────── */
const MainContent = () => {
  const [reportLoading, setReportLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const { wqi_data, setWqiData, selectedParam, qualityParam, setFocusedWellPoint } = useYear();
  const { totalArea, totalCatchments, selectionsLocked } = useRiverSystem();
  const { setwqaOperation, loading, isMapLoading, wqaOperation } = useMap();
  const [showYears, setshowYears] = useState(false);

  useEffect(() => { setshowYears(selectionsLocked); }, [selectionsLocked]);

  const handlePdfComplete = () => { setIsPdfGenerating(false); setShowPdfStatus(false); };
  const handlePdfFailure = () => { setIsPdfGenerating(false); };

  return (
    <div className="flex h-full bg-slate-100">
      <WholeLoading
        visible={loading || isMapLoading || wqaOperation || reportLoading}
        title={wqaOperation ? "Analyzing Water Quality" : reportLoading ? "Generating Report" : "Loading Resources"}
        message={
          wqaOperation ? "Analyzing water quality and generating results…"
          : reportLoading ? "Generating report, please wait…"
          : "Fetching map data and initializing components…"
        }
      />

      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <aside className="w-[450px] shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-hidden">

        {/* Panel header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span className="text-sm font-semibold text-slate-800">Control Panel</span>
          </div>
          {selectionsLocked && (
            <p className="text-[11px] text-slate-500 mt-1">
              {totalCatchments} catchment{totalCatchments !== 1 ? "s" : ""} · {totalArea.toFixed(1)} km²
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* River system selection */}
          <div className="px-4 pt-4 pb-3">
            <SectionLabel
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
              title="River System"
            />
            <RiverSelector />
          </div>

          {/* Year */}
          {showYears && (
            <>
              <Divider />
              <div className="px-4 py-3 animate-fadeIn">
                <SectionLabel
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  title="Survey Year"
                />
                <YearSelector />
              </div>
            </>
          )}

          {/* Well points */}
          {wqi_data && wqi_data.length > 0 && (
            <>
              <Divider />
              <div className="px-4 py-3 animate-fadeIn">
                <SectionLabel
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                  title="Well Points"
                  badge={`${wqi_data.length}`}
                />
                <WQIDataTable
                  initialData={wqi_data}
                  onDelete={(row) =>
                    setWqiData((prev: WQIInterface[]) =>
                      prev.filter((r: WQIInterface) =>
                        !(r.Location === row.Location && r.Latitude === row.Latitude)
                      )
                    )
                  }
                  onView={(row) => setFocusedWellPoint(row as WQIInterface)}
                />
              </div>
            </>
          )}

          {/* Parameters */}
          {wqi_data && wqi_data.length > 0 && (
            <>
              <Divider />
              <div className="px-4 py-3 animate-fadeIn">
                <SectionLabel
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  title="Parameters"
                  badge={selectedParam.length > 0 ? `${selectedParam.length} selected` : undefined}
                />
                <MultiSelectButtons
                  options={qualityParam}
                  onChange={(selected) => console.log("Selected:", selected)}
                />
              </div>
            </>
          )}
        </div>

        {/* Sticky run button */}
        {wqi_data && wqi_data.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-white shrink-0">
            <button
              disabled={selectedParam.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
              onClick={() => setwqaOperation(true)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Run Analysis
            </button>
          </div>
        )}
      </aside>

      {/* ── MAP ──────────────────────────────────────────────── */}
      <div className="flex-1 h-full min-h-0 relative overflow-hidden">
        <MapView />
      </div>

      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed bottom-6 right-6 w-80 z-50 animate-fadeIn"
          autoClose={true}
          closeDelay={3000}
          enableAutoDownload={true}
          onComplete={handlePdfComplete}
          onFailure={handlePdfFailure}
        />
      )}
    </div>
  );
};

const PriorityDrain = () => (
  <RiverSystemProvider>
    <YearProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </YearProvider>
  </RiverSystemProvider>
);

export default PriorityDrain;
