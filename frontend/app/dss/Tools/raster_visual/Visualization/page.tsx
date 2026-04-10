'use client'
import React, { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import toast from "react-hot-toast";
import PDFGenerationStatus from "@/components/utils/PdfGeneration";
import MapView, { MapViewHandle } from "./components/MapView";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RasterLayer {
  file_name: string;
  layer_name: string;
  category?: string;
}

interface Module {
  module: string;
  category: boolean;
  raster: RasterLayer[];
}

// ── Page ──────────────────────────────────────────────────────────────────────
const Visualization: React.FC = () => {
  const mapViewRef = useRef<MapViewHandle>(null);

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [layerOpacity, setLayerOpacity] = useState<number>(75);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("osm");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [rasterFileName, setRasterFileName] = useState<string>("");
  const [layerName, setLayerName] = useState<string>("");
  const [hasActiveLayer, setHasActiveLayer] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [Displaydata, setDisplayData] = useState<Module[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Fetch available modules on mount
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await api.get('/location/get_raster_visual');
        if (response.status != 201) {
          console.log("Failed to fetch modules");
          return;
        }
        const data = await response.message as Module[];
        setDisplayData(data);
      } catch (err) {
        console.log("Failed to fetch modules", err);
        toast.error("Failed to connect the server", { position: "top-center" });
      }
    };
    fetchModules();
  }, []);

  // Filtered raster list for the selected module
  const filteredRasters: (RasterLayer & { module: string })[] = [];
  if (selectedModule) {
    const selected = Displaydata.find(m => m.module === selectedModule);
    if (selected) {
      selected.raster
        .filter(r =>
          r.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.layer_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .forEach(r => filteredRasters.push({ ...r, module: selected.module }));
    }
  }

  // ── API handlers ─────────────────────────────────────────────────────────
  const handleRasterTiff = async () => {
    try {
      setLoading(true);
      const resp = await api.get<Blob>("/location/raster_download", {
        params: { moduleName: selectedModule, rasterName: layerName },
        responseType: "blob",
      });
      if (resp.status > 201) {
        toast.error("Failed to fetch modules", { position: "top-center" });
        return;
      }
      const blob = resp.message;
      if (!blob) throw new Error("No blob data received");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedModule}_${rasterFileName}.tiff`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.log("Failed to fetch modules", err);
      toast.error("Failed to download raster file", { position: "top-center" });
    } finally {
      setLoading(false);
    }
  };

  const handleRasterpdf = async () => {
    try {
      setTaskId(null);
      setLoading(true);
      const resp = await api.get("/location/celery_pdf", {
        params: { moduleName: selectedModule, rasterName: layerName, fileName: rasterFileName },
      });
      if (resp.status > 201) {
        toast.error("Failed to fetch modules", { position: "top-center" });
        return;
      }
      toast.success("Pdf generation started");
      const task = resp.message as Record<string, string>;
      setTaskId(task["task_id"]);
      setShowPdfStatus(true);
    } catch (err) {
      toast.error("Failed to download file", { position: "top-center" });
    } finally {
      setLoading(false);
      setIsPdfGenerating(false);
    }
  };

  // ── Sidebar helpers ───────────────────────────────────────────────────────
  const handlePdfComplete = () => { setIsPdfGenerating(false); setShowPdfStatus(false); };
  const handlePdfFailure = () => { setIsPdfGenerating(false); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-190 bg-slate-950 flex overflow-hidden">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 bg-blue-600 text-white rounded-xl shadow-lg border border-blue-500"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Raster Visualization</h1>
              <p className="text-xs text-slate-400">Layer management tool</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Layers Panel ─────────────────────────────────────────── */}
          <div className="flex flex-col h-full">
              {/* Search & Module Select */}
              <div className="p-4 space-y-3 border-b border-slate-800">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="Search layers..."
                  />
                </div>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                >
                  <option value="">Select a module...</option>
                  {Displaydata.map((module) => (
                    <option key={module.module} value={module.module}>{module.module}</option>
                  ))}
                </select>
              </div>

              {/* Raster Layers List */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                {!selectedModule ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-3 border border-slate-700">
                      <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-400">Select a module above to browse layers</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">{filteredRasters.length} layer{filteredRasters.length !== 1 ? 's' : ''}</span>
                      {hasActiveLayer && (
                        <button
                          onClick={() => mapViewRef.current?.removeRasterLayer()}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                        >
                          Clear layer
                        </button>
                      )}
                    </div>

                    {filteredRasters.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-500">No layers match your search</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredRasters.map((raster, index) => {
                          const isActive = layerName === raster.layer_name;
                          return (
                            <div
                              key={`${raster.layer_name}-${index}`}
                              className={`rounded-lg border transition-all ${
                                isActive
                                  ? 'bg-blue-600/10 border-blue-500/50'
                                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <div className="p-3">
                                <div className="flex items-start gap-2 mb-2">
                                  <div className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-500/20' : 'bg-slate-700'}`}>
                                    <svg className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{raster.file_name}</p>
                                    {raster.category && (
                                      <span className="inline-block mt-0.5 text-[10px] text-amber-400 bg-amber-900/20 border border-amber-800/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                        {raster.category}
                                      </span>
                                    )}
                                  </div>
                                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />}
                                </div>
                                <button
                                  onClick={() => mapViewRef.current?.loadRasterLayer(raster.layer_name, raster.file_name)}
                                  disabled={loading}
                                  className={`w-full py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    isActive
                                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                  }`}
                                >
                                  {loading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isActive ? "M5 13l4 4L19 7" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z"} />
                                      </svg>
                                      {isActive ? 'Active' : 'View Layer'}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* ── Map Area ──────────────────────────────────────────────────────── */}
      <MapView
        ref={mapViewRef}
        layerOpacity={layerOpacity}
        onOpacityChange={setLayerOpacity}
        selectedBaseMap={selectedBaseMap}
        legendUrl={legendUrl}
        showLegend={showLegend}
        loading={loading}
        error={error}
        onLegendUrlChange={setLegendUrl}
        onShowLegendChange={setShowLegend}
        onErrorChange={setError}
        onLoadingChange={setLoading}
        onRasterLoaded={(ln, fn) => { setLayerName(ln); setRasterFileName(fn); setHasActiveLayer(true); }}
        onRasterRemoved={() => { setLayerName(""); setRasterFileName(""); setHasActiveLayer(false); }}
        onBaseMapChange={setSelectedBaseMap}
        onDownloadTiff={handleRasterTiff}
        onExportPdf={handleRasterpdf}
      />

      {/* PDF Status */}
      {showPdfStatus && taskId && (
        <PDFGenerationStatus
          taskId={taskId}
          className="fixed bottom-8 right-8 w-96 z-50"
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

export default Visualization;
