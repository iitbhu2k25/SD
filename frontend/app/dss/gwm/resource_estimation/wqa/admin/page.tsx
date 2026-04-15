"use client";

import React, { useState, useEffect } from "react";
import { LocationProvider } from "@/contexts/gwm/water_quality_assesment/admin/LocationContext";
import { MapProvider } from "@/contexts/gwm/water_quality_assesment/admin/MapContext";
import LocationSelector from "@/app/dss/gwm/resource_estimation/wqa/admin/components/locations";
import WholeLoading from "@/components/app_layout/newLoading";
import { useLocation } from "@/contexts/gwm/water_quality_assesment/admin/LocationContext";
import MapView from "@/app/dss/gwm/resource_estimation/wqa/admin/components/openlayer";
import { useMap } from "@/contexts/gwm/water_quality_assesment/admin/MapContext";
import {
  YearProvider,
  useYear,
} from "@/contexts/gwm/water_quality_assesment/admin/yearContext";
import YearSelector from "@/app/dss/gwm/resource_estimation/wqa/admin/components/year";
import MultiSelectButtons from "@/app/dss/gwm/resource_estimation/wqa/admin/components/Params";
import WQIDataTable from "@/app/dss/gwm/resource_estimation/wqa/admin/components/utils/dataTable";
import { WQIInterface } from "@/interface/table";
import PiperChart from "@/app/dss/gwm/resource_estimation/wqa/charts/PiperChart";
import DurovChart from "@/app/dss/gwm/resource_estimation/wqa/charts/DurovChart";
import GibbsChart from "@/app/dss/gwm/resource_estimation/wqa/charts/GibbsChart";
import PCAChart from "@/app/dss/gwm/resource_estimation/wqa/charts/PCAChart";
import RDAChart from "@/app/dss/gwm/resource_estimation/wqa/charts/RDAChart";

/* ── Section header ─────────────────────────────────────── */
const SectionLabel: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: string;
}> = ({ icon, title, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-slate-400">{icon}</span>
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {title}
    </span>
    {badge && (
      <span className="ml-auto text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

const Divider = () => <div className="border-t border-slate-100 my-1" />;

/* ── Main content ────────────────────────────────────────── */
const CHART_TABS = [
  { id: "piper", label: "Piper" },
  { id: "durov", label: "Durov" },
  { id: "gibbs", label: "Gibbs" },
  { id: "pca", label: "PCA" },
  { id: "rda", label: "RDA" },
] as const;

type ChartTab = (typeof CHART_TABS)[number]["id"];

const MainContent = () => {
  const [activeView, setActiveView] = useState<"map" | "charts">("map");
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>("piper");
  const [gibbsMode, setGibbsMode] = useState<"cation" | "anion">("cation");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    wqi_data,
    setWqiData,
    selectedParam,
    qualityParam,
    setFocusedWellPoint,
  } = useYear();
  const { selectionsLocked, selectedSubDistrictsNames } = useLocation();
  const {
    loading,
    isMapLoading,
    wqaOperation,
    setwqaOperation,
    chartData,
    chartLoading,
  } = useMap();
  const [showYears, setshowYears] = useState(false);

  // Auto-collapse sidebar when analysis results arrive
  useEffect(() => {
    if (chartData) setSidebarCollapsed(true);
  }, [chartData]);

  useEffect(() => {
    setshowYears(selectionsLocked);
  }, [selectionsLocked]);

  return (
    <div className="flex h-full bg-slate-100">
      <WholeLoading
        visible={loading || isMapLoading || wqaOperation}
        title={wqaOperation ? "Analyzing Water Quality" : "Loading Resources"}
        message={
          wqaOperation
            ? "Analyzing groundwater water quality and generating results…"
            : "Fetching map data and initializing components…"
        }
      />

      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div className="relative shrink-0 h-full">
        <aside
          className={`${sidebarCollapsed ? "w-10" : "w-[450px]"} h-full flex flex-col bg-white border-r border-slate-200 overflow-hidden transition-all duration-300`}
        >
          {sidebarCollapsed ? (
            /* ── Collapsed: vertical label only ── */
            <div className="flex items-center justify-center h-full">
              <span className="text-base font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
                Control Panel
              </span>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-slate-800">
                    Control Panel
                  </span>
                </div>
                {selectionsLocked && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selectedSubDistrictsNames.length} sub-district
                    {selectedSubDistrictsNames.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/* Location section */}
                <div className="px-4 pt-4 pb-3">
                  <SectionLabel
                    icon={
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    }
                    title="Location"
                  />
                  <LocationSelector />
                </div>

                {/* Year section */}
                {showYears && (
                  <>
                    <Divider />
                    <div className="px-4 py-3 animate-fadeIn">
                      <SectionLabel
                        icon={
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        }
                        title="Survey Year"
                      />
                      <YearSelector />
                    </div>
                  </>
                )}

                {/* Well points table */}
                {wqi_data && wqi_data.length > 0 && (
                  <>
                    <Divider />
                    <div className="px-4 py-3 animate-fadeIn">
                      <SectionLabel
                        icon={
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        }
                        title="Well Points"
                        badge={`${wqi_data.length}`}
                      />
                      <WQIDataTable
                        initialData={wqi_data}
                        onDelete={(row) =>
                          setWqiData((prev: WQIInterface[]) =>
                            prev.filter(
                              (r: WQIInterface) =>
                                !(
                                  r.Location === row.Location &&
                                  r.Latitude === row.Latitude
                                ),
                            ),
                          )
                        }
                        onView={(row) =>
                          setFocusedWellPoint(row as WQIInterface)
                        }
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
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                        }
                        title="Parameters"
                        badge={
                          selectedParam.length > 0
                            ? `${selectedParam.length} selected`
                            : undefined
                        }
                      />
                      <MultiSelectButtons
                        options={qualityParam}
                        onChange={(selected) =>
                          console.log("Selected:", selected)
                        }
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                    onClick={() => setwqaOperation(true)}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Run Analysis
                  </button>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Toggle button — vertically centered on the right edge */}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 z-20 w-7 h-15 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-md hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className=" w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4.5}
              d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
            />
          </svg>
        </button>
      </div>

      {/* ── RIGHT AREA ────────────────────────────────────────── */}
      <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
        {/* View toggle — only shown when chart data is available */}
        {chartData && (
          <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-white border-b border-slate-200">
            <button
              onClick={() => setActiveView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeView === "map"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Map
            </button>
            <button
              onClick={() => setActiveView("charts")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeView === "charts"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Analysis Charts
              <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                {chartData.piper.points.length} wells
              </span>
            </button>

            {chartLoading && (
              <span className="ml-2 text-[11px] text-slate-400 flex items-center gap-1">
                <svg
                  className="w-3 h-3 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Loading charts…
              </span>
            )}
          </div>
        )}

        {/* Map view — always mounted so OpenLayers doesn't re-init on tab switch */}
        <div
          className={`relative overflow-hidden transition-all duration-200 ${activeView === "map" ? "flex-1 min-h-0" : "h-0 pointer-events-none"}`}
        >
          <MapView />
        </div>

        {/* Charts view */}
        {chartData && (
          <div
            className={`overflow-hidden flex flex-col transition-all duration-200 ${activeView === "charts" ? "flex-1 min-h-0" : "h-0 pointer-events-none"}`}
          >
            {/* Chart tabs */}
            <div className="shrink-0 flex items-center gap-1 px-3 pt-2 bg-slate-50 border-b border-slate-200">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveChartTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors border-b-2 ${
                    activeChartTab === tab.id
                      ? "border-blue-600 text-blue-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

      
             
            </div>

            {/* Chart content */}
            <div className="flex-1 overflow-auto p-4 bg-white">
              {activeChartTab === "piper" && (
                <PiperChart data={chartData.piper} />
              )}
              {activeChartTab === "durov" && (
                <DurovChart data={chartData.durov} />
              )}
              {activeChartTab === "gibbs" && (
                <GibbsChart data={chartData.gibbs} />
              )}
              {activeChartTab === "pca" && <PCAChart data={chartData.pca} />}
              {activeChartTab === "rda" && <RDAChart data={chartData.rda} />}
            </div>
          </div>
        )}

        {/* Chart loading skeleton while charts view is selected but data isn't ready */}
        {activeView === "charts" && chartLoading && !chartData && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <svg
                className="w-8 h-8 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-sm font-medium">
                Computing hydrogeochemical charts…
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .hydro-tooltip {
          background: rgba(15, 23, 42, 0.92);
          color: #e2e8f0;
          font-family: monospace;
          font-size: 11px;
          line-height: 1.6;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          pointer-events: none;
          max-width: 220px;
          z-index: 9999;
          transition: opacity 0.12s;
        }
      `}</style>
    </div>
  );
};

const PriorityAdmin = () => (
  <LocationProvider>
    <YearProvider>
      <MapProvider>
        <MainContent />
      </MapProvider>
    </YearProvider>
  </LocationProvider>
);

export default PriorityAdmin;
