'use client'
import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorTileLayer from "ol/layer/VectorTile";
import VectorTileSource from "ol/source/VectorTile";
import ImageWMS from "ol/source/ImageWMS";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import MVT from "ol/format/MVT";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { defaults as defaultControls, ScaleLine } from "ol/control";
import { Style, Fill, Stroke } from "ol/style";
import "ol/ol.css";
import { baseMaps } from "@/components/MapComponents";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";

// ── LegendEntry ───────────────────────────────────────────────────────────────
interface LegendEntry {
  label: string;
  color: string;
  opacity: number;
}

// ── NativeLegend ──────────────────────────────────────────────────────────────
const NativeLegend: React.FC<{
  entries: LegendEntry[];
  interpolation: "linear" | "discrete";
  onClose: () => void;
}> = ({ entries, interpolation, onClose }) => {
  const isContinuous = interpolation === "linear";

  const gradientStops = entries
    .map((e, i) => {
      const pct = entries.length <= 1 ? 50 : (i / (entries.length - 1)) * 100;
      return `${e.color} ${pct.toFixed(1)}%`;
    })
    .join(", ");

  const header = (
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Legend</span>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ minWidth: 150, maxWidth: 260 }}>
        {header}
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-slate-400">No legend data</p>
        </div>
      </div>
    );
  }

  if (isContinuous) {
    const ROW_HEIGHT = 30;
    const RAMP_HEIGHT = Math.max(entries.length * ROW_HEIGHT, 40);

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ minWidth: 150, maxWidth: 220 }}>
        {header}
        <div className="px-3 pb-3 pt-2 flex gap-2" style={{ height: RAMP_HEIGHT + 80 }}>
          {/* Gradient bar — same height as label area */}
          <div
            className="flex-shrink-0 rounded-full border border-slate-200"
            style={{
              width: 30,
              background: entries.length > 1 ? `linear-gradient(to bottom, ${gradientStops})` : entries[0].color,
            }}
          />
          {/* Labels via flex so first/last align exactly with bar top/bottom */}
          <div className="flex flex-col justify-between flex-1 min-w-0">
            {entries.map((entry, i) => (
              <span
                key={i}
                className="text-[11px] font-mono text-slate-600 leading-none truncate"
                title={entry.label}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const barHeight = Math.max(entries.length * 24, 180);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden" style={{ minWidth: 150, maxWidth: 260 }}>
      {header}
      <div className="px-3 pb-3 pt-2 flex gap-3 items-stretch w-full">
        <div className="flex-shrink-0 rounded border border-slate-200 overflow-hidden flex flex-col" style={{ width: 16, height: barHeight }}>
          {entries.map((e, i) => (
            <div key={i} style={{ flex: 1, background: e.color, opacity: e.opacity }} />
          ))}
        </div>
        <div className="flex flex-col justify-between" style={{ height: barHeight, flex: 1, minWidth: 0 }}>
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5 min-h-0">
              <span className="flex-shrink-0 rounded-sm border border-white shadow-sm" style={{ display: "inline-block", width: 10, height: 10, background: entry.color, opacity: entry.opacity }} />
              <span className="text-[11px] font-mono text-slate-700 leading-tight truncate" title={entry.label}>{entry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────
const GEOSERVER_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
const GEOSERVER_MVT_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/gwc/service/tms/1.0.0`;
const Vector_workspace = "vector_work";
const Raster_workspace = "raster_visualization";
const FIXED_VECTOR_LAYER = "STP_State";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MapViewHandle {
  loadRasterLayer: (layerName: string, fileName: string) => void;
  removeRasterLayer: () => void;
  changeBaseMap: (baseMapKey: string) => void;
}

interface MapViewProps {
  layerOpacity: number;
  onOpacityChange: (opacity: number) => void;
  selectedBaseMap: string;
  legendUrl: string | null;
  showLegend: boolean;
  loading: boolean;
  error: string | null;
  onLegendUrlChange: (url: string | null) => void;
  onShowLegendChange: (show: boolean) => void;
  onErrorChange: (error: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onRasterLoaded: (layerName: string, fileName: string) => void;
  onRasterRemoved: () => void;
  onBaseMapChange: (key: string) => void;
  onDownloadTiff: () => void;
  onExportPdf: () => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────
const getWMSExtent4326 = async (layerName: string): Promise<number[] | null> => {
  const url = `${GEOSERVER_URL}?service=WMS&request=GetCapabilities&version=1.3.0`;
  const response = await fetch(url);
  const text = await response.text();
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const layers = Array.from(xml.getElementsByTagName('Layer'));
  const layer = layers.find(l => l.getElementsByTagName('Name')[0]?.textContent === layerName);
  if (!layer) return null;
  const bbox = layer.getElementsByTagName('EX_GeographicBoundingBox')[0];
  if (!bbox) return null;
  return [
    parseFloat(bbox.getElementsByTagName('westBoundLongitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('southBoundLatitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('eastBoundLongitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('northBoundLatitude')[0].textContent!),
  ];
};

// ── Floating panel wrapper ────────────────────────────────────────────────────
function FloatingPanel({
  children,
  onClose,
  title,
  width = 300,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  width?: number;
}) {
  return (
    <div className="absolute top-[68px] left-1/2 -translate-x-1/2 z-30" style={{ width }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-all duration-200 ${
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
const MapView = forwardRef<MapViewHandle, MapViewProps>(({
  layerOpacity, onOpacityChange, selectedBaseMap,
  legendUrl, showLegend, loading, error,
  onLegendUrlChange, onShowLegendChange, onErrorChange, onLoadingChange,
  onRasterLoaded, onRasterRemoved, onBaseMapChange,
  onDownloadTiff, onExportPdf,
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const vectorLayerRef = useRef<VectorTileLayer | null>(null);
  const baseLayerRef = useRef<TileLayer<OSM | XYZ> | null>(null);

  const [mouseCoords, setMouseCoords] = useState<string>("");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLayerFileName, setActiveLayerFileName] = useState<string>("");
  const [hasLayer, setHasLayer] = useState(false);
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [legendInterpolation] = useState<"linear" | "discrete">("discrete");

  const fetchLegendEntries = async (fullLayerName: string) => {
    try {
      const url = `${GEOSERVER_URL}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=application/json&LAYER=${encodeURIComponent(fullLayerName)}`;
      const res = await fetch(url);
      if (!res.ok) { setLegendEntries([]); return; }
      const json = await res.json();
      const rules: any[] = json?.Legend?.[0]?.rules ?? [];
      const entries: LegendEntry[] = [];
      for (const rule of rules) {
        for (const sym of rule.symbolizers ?? []) {
          const raster = sym.Raster ?? sym.raster;
          if (raster?.colormap?.entries) {
            for (const e of raster.colormap.entries) {
              entries.push({ label: e.label ?? String(e.quantity ?? ""), color: e.color ?? "#cccccc", opacity: parseFloat(e.opacity ?? "1") });
            }
            setLegendEntries(entries);
            return;
          }
        }
      }
      setLegendEntries(entries);
    } catch {
      setLegendEntries([]);
    }
  };

  // Track fullscreen state
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  // ── Map initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({ source: baseMaps.osm.source(), zIndex: 0 });
    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls({
      zoom: false,
      rotate: false,
      attributionOptions: { collapsible: false },
    }).extend([
      new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
    ]);

    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 18,
        enableRotation: true,
        constrainRotation: false,
      }),
    });
    mapInstanceRef.current = map;

    map.on('pointermove', (evt) => {
      const lonLat = toLonLat(evt.coordinate);
      setMouseCoords(`${lonLat[1].toFixed(6)}°N, ${lonLat[0].toFixed(6)}°E`);
    });

    const mvtUrl = `${GEOSERVER_MVT_URL}/${Vector_workspace}:${FIXED_VECTOR_LAYER}@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf`;
    const vectorTileLayer = new VectorTileLayer({
      source: new VectorTileSource({ format: new MVT(), url: mvtUrl, maxZoom: 22 }),
      style: new Style({
        stroke: new Stroke({ color: "#3b82f6", width: 3, lineJoin: "round" }),
        fill: new Fill({ color: 'transparent' }),
      }),
      zIndex: 5,
    });
    map.addLayer(vectorTileLayer);
    vectorLayerRef.current = vectorTileLayer;

    setTimeout(() => map.updateSize(), 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.getLayers().getArray().slice().forEach(l => mapInstanceRef.current?.removeLayer(l));
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      rasterLayerRef.current = null;
      vectorLayerRef.current = null;
      baseLayerRef.current = null;
    };
  }, []);

  // Resize observer keeps map size correct
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    const ro = new ResizeObserver(() => mapInstanceRef.current?.updateSize());
    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync opacity to the active raster layer
  useEffect(() => {
    if (rasterLayerRef.current) rasterLayerRef.current.setOpacity(layerOpacity / 100);
  }, [layerOpacity]);

  // ── Imperative API ───────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    loadRasterLayer(layerName: string, fileName: string) {
      if (!mapInstanceRef.current || !layerName.trim()) {
        onErrorChange("Please select a valid layer");
        return;
      }
      onLoadingChange(true);
      onErrorChange(null);
      try {
        const map = mapInstanceRef.current;
        const fullLayerName = `${Raster_workspace}:${layerName}`;
        if (rasterLayerRef.current) map.removeLayer(rasterLayerRef.current);

        const wmsSource = new ImageWMS({
          url: GEOSERVER_URL,
          params: { LAYERS: fullLayerName, TILED: true, FORMAT: "image/png", TRANSPARENT: true, VERSION: "1.3.0" },
          ratio: 1,
          serverType: "geoserver",
        });
        const rasterLayer = new ImageLayer({
          source: wmsSource,
          visible: true,
          opacity: layerOpacity / 100,
          zIndex: 10,
        });

        onLegendUrlChange(fullLayerName);
        fetchLegendEntries(fullLayerName);

        map.addLayer(rasterLayer);
        rasterLayerRef.current = rasterLayer;

        getWMSExtent4326(fullLayerName).then(extent4326 => {
          if (!extent4326) return;
          const view = map.getView();
          const viewProj = view.getProjection().getCode();
          const extent = viewProj === 'EPSG:4326' ? extent4326 : transformExtent(extent4326, 'EPSG:4326', viewProj);
          view.fit(extent, { padding: [160, 160, 160, 160], duration: 300, maxZoom: 10 });
        });

        setActiveLayerFileName(fileName);
        setHasLayer(true);
        onRasterLoaded(layerName, fileName);
        onLoadingChange(false);
      } catch (err) {
        onErrorChange(`Error loading raster layer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        onLoadingChange(false);
      }
    },

    removeRasterLayer() {
      if (mapInstanceRef.current && rasterLayerRef.current) {
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
        onLegendUrlChange(null);
        onShowLegendChange(false);
        setLegendEntries([]);
        setActiveLayerFileName("");
        setHasLayer(false);
        onRasterRemoved();
      }
    },

    changeBaseMap(baseMapKey: string) {
      if (!mapInstanceRef.current || !baseLayerRef.current) return;
      mapInstanceRef.current.removeLayer(baseLayerRef.current);
      const newBaseLayer = new TileLayer({ source: baseMaps[baseMapKey].source(), zIndex: 0 });
      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      onBaseMapChange(baseMapKey);
    },
  }));

  // ── Map actions ──────────────────────────────────────────────────────────
  const handleZoom = (delta: number) => {
    const v = mapInstanceRef.current?.getView();
    if (v) v.animate({ zoom: (v.getZoom() ?? 0) + delta, duration: 250 });
  };

  const resetView = () => {
    const v = mapInstanceRef.current?.getView();
    if (v) v.animate({ center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]), zoom: INITIAL_ZOOM, duration: 600 });
  };

  const toggleFullscreen = () => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleChangeBaseMap = (key: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;
    mapInstanceRef.current.removeLayer(baseLayerRef.current);
    const nb = new TileLayer({ source: baseMaps[key].source(), zIndex: 0 });
    baseLayerRef.current = nb;
    mapInstanceRef.current.getLayers().insertAt(0, nb);
    onBaseMapChange(key);
    setActivePanel(null);
  };

  const togglePanel = (p: string) => setActivePanel(activePanel === p ? null : p);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div ref={mapContainerRef} className="flex-1 relative bg-slate-950">
      {/* Map canvas */}
      <div ref={mapRef} className="w-full h-full" />

      {/* ═══ FLOATING TOOLBAR ════════════════════════════════════════════════ */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="px-4 py-2.5 flex items-center space-x-1 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200">
          {/* Title */}
          <span className="text-sm font-bold text-gray-800 flex items-center mr-2">
            <svg className="w-5 h-5 mr-1.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="font-mono tracking-wide">GIS Viewer</span>
          </span>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Layer Controls button */}
          <ToolbarBtn active={activePanel === "layers"} onClick={() => togglePanel("layers")} title="Layer Controls">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </ToolbarBtn>

          {/* Basemap button */}
          <ToolbarBtn active={activePanel === "basemap"} onClick={() => togglePanel("basemap")} title="Base Map">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" />
            </svg>
          </ToolbarBtn>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Fullscreen button */}
          <ToolbarBtn onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              )}
            </svg>
          </ToolbarBtn>
        </div>
      </div>

      {/* ═══ LAYER CONTROLS PANEL ════════════════════════════════════════════ */}
      {activePanel === "layers" && (
        <FloatingPanel title="Layer Controls" onClose={() => setActivePanel(null)}>
          {hasLayer ? (
            <div className="space-y-4">
              {/* Active layer indicator */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-purple-600/20 border-b border-slate-700 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white">Active Layer</span>
                </div>
                <div className="p-3 space-y-3">
                  <p className="text-xs text-slate-300 font-mono bg-slate-900/60 px-2 py-1.5 rounded border border-slate-700 truncate">
                    {activeLayerFileName}
                  </p>

                  {/* Opacity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Opacity</span>
                      <span className="text-purple-400 font-medium">{layerOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={layerOpacity}
                      onChange={(e) => onOpacityChange(parseInt(e.target.value))}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer bg-slate-700 accent-purple-500"
                    />
                  </div>

                  {/* Legend Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Show Legend</span>
                    <button
                      onClick={() => onShowLegendChange(!showLegend)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showLegend ? 'bg-green-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showLegend ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Download Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={onDownloadTiff}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-xs text-slate-200 border border-slate-600"
                    >
                      <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                      </svg>
                      Download Tiff
                    </button>
                    <button
                      onClick={onExportPdf}
                      className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-xs text-slate-200 border border-slate-600"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M6 20h12" />
                      </svg>
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No layer loaded</p>
              <p className="text-xs text-gray-400 mt-1">Select a layer from the sidebar</p>
            </div>
          )}
        </FloatingPanel>
      )}

      {/* ═══ BASEMAP PANEL ═══════════════════════════════════════════════════ */}
      {activePanel === "basemap" && (
        <FloatingPanel title="Base Maps" onClose={() => setActivePanel(null)}>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(baseMaps).map(([key, baseMap]) => (
              <button
                key={key}
                onClick={() => handleChangeBaseMap(key)}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 ${
                  selectedBaseMap === key
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                </svg>
                <span className="text-xs font-medium">{baseMap.name}</span>
                {selectedBaseMap === key && (
                  <div className="flex items-center space-x-1 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] text-green-600">Active</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}

      {/* ═══ ZOOM CONTROLS ═══════════════════════════════════════════════════ */}
      <div className="absolute top-20 left-4 z-20 flex flex-col bg-white/92 backdrop-blur rounded-xl border border-gray-200 shadow-md overflow-hidden">
        {[
          { icon: "M12 4v16m8-8H4", action: () => handleZoom(1), title: "Zoom in" },
          { icon: "M20 12H4", action: () => handleZoom(-1), title: "Zoom out" },
          { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", action: resetView, title: "Reset view" },
        ].map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="h-px bg-gray-200" />}
            <button
              onClick={b.action}
              title={b.title}
              className="p-2.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
              </svg>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ═══ COORDINATES ═════════════════════════════════════════════════════ */}
      {mouseCoords && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700 shadow-lg whitespace-nowrap">
          <span className="text-xs font-mono text-slate-200">{mouseCoords}</span>
        </div>
      )}

      {/* ═══ LEGEND ══════════════════════════════════════════════════════════ */}
      {legendUrl && showLegend && (
        <div className="absolute bottom-14 right-4 z-20">
          <NativeLegend
            entries={legendEntries}
            interpolation={legendInterpolation}
            onClose={() => onShowLegendChange(false)}
          />
        </div>
      )}

      {/* ═══ ERROR ═══════════════════════════════════════════════════════════ */}
      {error && (
        <div className="absolute top-20 left-16 z-20 bg-red-50 border border-red-200 rounded-xl shadow-md px-4 py-3 flex items-center max-w-sm">
          <svg className="w-5 h-5 mr-3 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-red-700 pr-8">{error}</span>
          <button onClick={() => onErrorChange(null)} className="absolute right-2 top-2 p-1 rounded text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══ LOADING ═════════════════════════════════════════════════════════ */}
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl border border-gray-200 flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <div>
              <p className="font-medium text-gray-800">Loading raster layer…</p>
              <p className="text-sm text-gray-500">Connecting to GeoServer</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MapView.displayName = "MapView";
export default MapView;
