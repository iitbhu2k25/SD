'use client'
import React, { useRef, useEffect } from "react";
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
    layer,
    wmsOpacity,
    legendUrl,
    showLegend,
    activeBaseMap,
    mapLoading,
    sidebarOpen,
    error,
    setOpacity,
    setShowLegend,
    setLegendUrl,
    setBaseMap,
    setMapLoading,
    setSidebar,
    clearError,
    removeLayer,
  } = useRaster();

  // ── Map bridge: load layer when it changes ─────────────────────────────
  useEffect(() => {
    if (layer) {
      mapViewRef.current?.loadRasterLayer(layer.layer_name, layer.file_name);
    }
  }, [layer]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleUploadNew = () => {
    removeLayer();
    mapViewRef.current?.removeRasterLayer();
  };

  const handleRemoveLayer = () => {
    removeLayer();
    mapViewRef.current?.removeRasterLayer();
  };

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

        {/* ── Panel content (layers only) ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="space-y-4">
            {!layer ? (
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

                {/* Active layer info card */}
               

                {/* Raster metadata */}
                <RasterDetails />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAP ═════════════════════════════════════════════════════════ */}
      <MapView
        ref={mapViewRef}
        layerOpacity={wmsOpacity}
        onOpacityChange={setOpacity}
        selectedBaseMap={activeBaseMap}
        onBaseMapChange={(k) => setBaseMap(k as keyof typeof BASE_MAPS)}
        legendUrl={legendUrl}
        onLegendUrlChange={setLegendUrl}
        showLegend={showLegend}
        onShowLegendChange={setShowLegend}
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