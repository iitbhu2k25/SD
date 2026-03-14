'use client'
import React, { useRef, useEffect, useState } from "react";
import MapView, { MapViewHandle } from "./components/Mapview";
import UploadRaster from "./components/Upload";
import RasterDetails from "./components/RasterDetails";
import { OperationsPanel } from "./components/operations";
import { SLDEditor } from "./components/SLDEditor";
import {
  RasterProvider,
  useRaster,
  BASE_MAPS,
} from "@/contexts/raster_operations/RasterContext";

import "@/styles/terraops-theme.css";
import { api } from "@/services/api";
import { toast } from "react-toastify";


type RightTab = "details" | "symbology";

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

  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("details");

  useEffect(() => {
    if (layer) {
      mapViewRef.current?.loadRasterLayer(layer.layer_name, layer.file_name);
      setRightPanelOpen(true);
      setRightTab("details");
    } else {
      setRightPanelOpen(false);
    }
  }, [layer]);

  const handleUploadNew = () => {
    removeLayer();
    mapViewRef.current?.removeRasterLayer();
  };

  const handleSLDApply = async (sldXml: string | null) => {
  if (!layer || !sldXml) return;

  try {
    const resp = await api.post(`/tools/sldupdate`, {
      body:{
        layername: layer.layer_name,
        sld: sldXml

      }
    });
    if (resp.status !=201){
      toast.error("Failed to apply SLD");
      return 
    }
    toast.success("SLD applied successfully");
  } catch (error) {
    console.error("Error applying SLD:", error);
  }
};

  // ── Tab config ─────────────────────────────────────────────────────────
  const tabs: { key: RightTab; label: string; icon: string; color: string; bg: string; border: string }[] = [
    {
      key: "details",
      label: "Details",
      icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      color: "--cyan",
      bg: "--cyan-bg",
      border: "--cyan-border",
    },
    {
      key: "symbology",
      label: "Symbology",
      icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
      color: "--purple",
      bg: "--purple-bg",
      border: "--purple-border",
    },
  ];

  return (
    <div
      className="terraops relative w-full h-screen flex flex-col md:flex-row overflow-hidden"
      style={{ background: 'var(--surface-base)', fontFamily: 'var(--font-body)' }}
    >
      {/* ── Mobile toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setSidebar(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl shadow-lg"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebar(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           LEFT SIDEBAR — Upload + Operations
         ═══════════════════════════════════════════════════════════════════ */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          w-80 md:w-[310px] flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{
          background: 'var(--surface-raised)',
          borderRight: '1px solid var(--border-subtle)',
          flexShrink: 0,
          height: '100%',
        }}
      >
        {/* Brand header */}
        <div
          className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[13px]"
              style={{
                background: 'linear-gradient(135deg, #0d9b7a, #0a7a6a)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-1px',
              }}
            >
              TO
            </div>
            <div>
              <h1 className="text-[14px] font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                TERRA<span style={{ color: 'var(--accent)' }}>OPS</span>
              </h1>
              <p className="text-[8px] font-semibold uppercase mt-0.5"
                style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontFamily: 'var(--font-mono)' }}>
                Raster Analysis
              </p>
            </div>
          </div>
          <button onClick={() => setSidebar(false)} className="md:hidden p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">

          {/* Upload section */}
          <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border)' }}>
                <svg className="w-3 h-3" style={{ color: 'var(--blue)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="text-[11px] font-bold uppercase"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                Layer
              </span>
              {layer && <span className="terra-badge terra-badge--success ml-auto" style={{ fontSize: 9 }}>Active</span>}
            </div>

            {!layer ? (
              <UploadRaster />
            ) : (
              <div className="space-y-2">
                {/* Active layer card */}
                <div className="flex items-center gap-2.5 p-2.5"
                  style={{
                    background: 'var(--surface-card)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)',
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
                    <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{layer.file_name}</p>
                    <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{layer.layer_name}</p>
                  </div>
                  <button onClick={handleUploadNew} className="p-1.5 rounded-md flex-shrink-0" style={{ color: 'var(--text-muted)' }} title="Replace raster">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>

                {/* Quick toggles: Details / Symbology */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Details toggle */}
                  <button
                    onClick={() => { setRightPanelOpen(true); setRightTab("details"); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-all"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${rightPanelOpen && rightTab === "details" ? 'var(--cyan)' : 'var(--border-subtle)'}`,
                      background: rightPanelOpen && rightTab === "details" ? 'var(--cyan-bg)' : 'var(--surface-card)',
                      color: rightPanelOpen && rightTab === "details" ? 'var(--cyan)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Details
                  </button>
                  {/* Symbology toggle */}
                  <button
                    onClick={() => { setRightPanelOpen(true); setRightTab("symbology"); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium transition-all"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${rightPanelOpen && rightTab === "symbology" ? 'var(--purple)' : 'var(--border-subtle)'}`,
                      background: rightPanelOpen && rightTab === "symbology" ? 'var(--purple-bg)' : 'var(--surface-card)',
                      color: rightPanelOpen && rightTab === "symbology" ? 'var(--purple)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Symbology
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Operations section */}
          <div className="p-4">
            <OperationsPanel />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="2" y="2" width="20" height="8" rx="2" strokeWidth={2} />
              <rect x="2" y="14" width="20" height="8" rx="2" strokeWidth={2} />
            </svg>
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>GeoServer</span>
            <span className="w-[5px] h-[5px] rounded-full terra-pulse-dot"
              style={{ background: 'var(--green)', boxShadow: '0 0 4px rgba(34,197,94,0.4)' }} />
          </div>
          <span className="text-[9px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>OL v9</span>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
           CENTER — Map
         ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0 h-full relative" style={{ height: '100%' }}>
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
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
           RIGHT SIDEBAR — Tabbed: Details / Symbology
         ═══════════════════════════════════════════════════════════════════ */}
      {rightPanelOpen && layer && (
        <aside
          className="hidden md:flex flex-col terra-slide-right"
          style={{
            width: 340,
            flexShrink: 0,
            height: '100%',
            background: 'var(--surface-raised)',
            borderLeft: '1px solid var(--border-subtle)',
          }}
        >
          {/* Header with tabs */}
          <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="px-4 pt-3 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {tabs.map((tab) => {
                  const isActive = rightTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setRightTab(tab.key)}
                      className="flex items-center gap-1.5 pb-2.5 transition-all relative"
                      style={{
                        color: isActive ? `var(${tab.color})` : 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                      </svg>
                      {tab.label}
                      {/* Active indicator */}
                      {isActive && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-[2px]"
                          style={{ background: `var(${tab.color})`, borderRadius: '2px 2px 0 0' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setRightPanelOpen(false)} className="p-1.5 rounded-md mb-2" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
            {rightTab === "details" && (
              <div className="terra-fade-in">
                <RasterDetails />
              </div>
            )}
            {rightTab === "symbology" && (
              <div className="terra-fade-in">
                <SLDEditor
                  onApply={handleSLDApply}
                  onClose={() => setRightTab("details")}
                />
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

const Analytics: React.FC = () => (
  <RasterProvider>
    <AnalyticsInner />
  </RasterProvider>
);

export default Analytics;