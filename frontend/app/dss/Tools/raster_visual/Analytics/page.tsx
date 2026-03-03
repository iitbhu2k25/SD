'use client'
import React, { useRef, useEffect } from "react";
import { baseMaps } from "@/components/MapComponents";
import MapView, { MapViewHandle } from "./components/Mapview";
import UploadRaster from "./components/Upload";
import RasterDetails from "./components/RasterDetails";
import {
  RasterProvider,
  useRaster,
  BASE_MAPS,
} from "@/contexts/raster_operations/RasterContext";



const AnalyticsInner: React.FC = () => {
  const mapViewRef = useRef<MapViewHandle>(null);
  const {
    state,
    clearActiveLayer,
    setOpacity,
    setShowLegend,
    setLegendUrl,
    setBaseMap,
    setMapLoading,
    setSidebar,
    setTab,
    clearError,
  } = useRaster();

  const {
    activeLayer,
    wmsOpacity,
    legendUrl,
    showLegend,
    activeBaseMap,
    mapLoading,
    sidebarTab,
    sidebarOpen,
    error,
  } = state;

  // ── Map bridge: load layer when activeLayer changes ────────────────────
  useEffect(() => {
    if (activeLayer) {
      mapViewRef.current?.loadRasterLayer(activeLayer.layer_name, activeLayer.file_name);
    }
  }, [activeLayer]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleUploadNew = () => {
    clearActiveLayer();
    mapViewRef.current?.removeRasterLayer();
  };

  const handleRemoveLayer = () => {
    clearActiveLayer();
    mapViewRef.current?.removeRasterLayer();
  };

  const handleChangeBaseMap = (key: string) => {
    setBaseMap(key as keyof typeof BASE_MAPS);
    mapViewRef.current?.changeBaseMap(key);
  };

  // ── Tab config ─────────────────────────────────────────────────────────
  const tabs = [
    {
      id: "layers" as const,
      label: "Layers",
      icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      id: "basemap" as const,
      label: "Base Map",
      icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z",
    },
  ];

  return (
    <div className="relative w-full h-200 bg-slate-900 flex flex-col md:flex-row">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebar(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebar(false)} />
      )}

      {/* ═══ SIDEBAR ═════════════════════════════════════════════════════ */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 md:w-2/6 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Raster Analytics</h1>
                <p className="text-blue-100 text-sm">Analyzing tool</p>
              </div>
            </div>
            <button
              onClick={() => setSidebar(false)}
              className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                sidebarTab === tab.id
                  ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/50"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/30"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Panel content ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

          {/* ── Layers panel ───────────────────────────────────────────── */}
          {sidebarTab === "layers" && (
            <div className="space-y-4">
              {!activeLayer ? (
                <UploadRaster />
              ) : (
                <div className="space-y-4">
                  {/* Upload New */}
                  <button
                    onClick={handleUploadNew}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400/60 text-blue-300 hover:text-blue-200 transition-all duration-200 group"
                  >
                    <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-xs font-semibold">Upload New Raster</span>
                  </button>

                  {/* Active layer controls */}
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-600/50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <h4 className="text-sm font-semibold text-white">Active Layer</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowLegend(!showLegend)}
                          className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                          title={showLegend ? "Hide legend" : "Show legend"}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {showLegend ? (
                              <>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
                              </>
                            ) : (
                              <>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.958 9.958 0 012.735-4.338m1.65-1.512A9.959 9.959 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.732 2.945M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                              </>
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={handleRemoveLayer}
                          className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all"
                          title="Remove layer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-sm text-slate-200 font-medium truncate" title={activeLayer.file_name}>
                        {activeLayer.file_name}
                      </p>
                    </div>

                    {/* Opacity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Opacity</span>
                        </label>
                        <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                          {wmsOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={wmsOpacity}
                        onChange={(e) => setOpacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${wmsOpacity}%, #334155 ${wmsOpacity}%, #334155 100%)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Raster metadata */}
                  <RasterDetails />
                </div>
              )}
            </div>
          )}

          {/* ── Base Map panel ─────────────────────────────────────────── */}
          {sidebarTab === "basemap" && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 px-1 mb-3">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <h4 className="text-sm font-semibold text-slate-300">Select Base Map</h4>
              </div>

              <div className="grid gap-3">
                {Object.entries(baseMaps).map(([key, baseMap]) => (
                  <button
                    key={key}
                    onClick={() => handleChangeBaseMap(key)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      activeBaseMap === key
                        ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20"
                        : "bg-slate-700/30 border-slate-600 hover:bg-slate-700/50 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                        activeBaseMap === key ? "bg-blue-500/20" : "bg-slate-600/50"
                      }`}>
                        <svg className={`w-6 h-6 ${activeBaseMap === key ? "text-blue-400" : "text-slate-400"}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${activeBaseMap === key ? "text-white" : "text-slate-300"}`}>
                          {baseMap.name}
                        </h4>
                        {activeBaseMap === key && (
                          <div className="flex items-center space-x-1 mt-1">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                            <p className="text-xs text-blue-400">Active</p>
                          </div>
                        )}
                      </div>
                      {activeBaseMap === key && (
                        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MAP ═════════════════════════════════════════════════════════ */}
      <MapView
        ref={mapViewRef}
        layerOpacity={wmsOpacity}
        onOpacityChange={setOpacity}
        selectedBaseMap={activeBaseMap}
        onBaseMapChange={(k) => setBaseMap(k as keyof typeof BASE_MAPS)}
        rasterFileName={activeLayer?.file_name ?? ""}
        onRasterFileNameChange={() => {}}
        legendUrl={legendUrl}
        onLegendUrlChange={setLegendUrl}
        showLegend={showLegend}
        loading={mapLoading}
        onLoadingChange={setMapLoading}
        error={error}
        onErrorChange={(msg) => msg ? undefined : clearError()}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Exported: wraps with RasterProvider
// ─────────────────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => (
  <RasterProvider>
    <AnalyticsInner />
  </RasterProvider>
);

export default Analytics;