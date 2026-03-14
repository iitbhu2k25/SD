"use client";
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
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
import { fromLonLat } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  MousePosition,
} from "ol/control";
import { Style, Fill, Stroke } from "ol/style";
import { transformExtent } from "ol/proj";
import "ol/ol.css";
import { baseMaps } from "@/components/MapComponents";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { useRaster } from "@/contexts/raster_operations/RasterContext";
import { LegendEntry } from "@/interface/raster_operations";
const GEOSERVER_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
const GEOSERVER_MVT_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/gwc/service/tms/1.0.0`;
const Vector_workspace = "vector_work";
const Raster_workspace = "raster_work";
const FIXED_VECTOR_LAYER = "STP_State";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MapViewHandle {
  loadRasterLayer: (layerName: string, fileName: string) => void;
  removeRasterLayer: () => void;
  changeBaseMap: (baseMapKey: string) => void;
  applySLD: (sldXml: string | null) => void;
}

interface MapViewProps {
  layerOpacity: number;
  onOpacityChange: (opacity: number) => void;
  selectedBaseMap: string;
  onBaseMapChange: (key: string) => void;
  legendUrl: string | null;
  onLegendUrlChange: (url: string | null) => void;
  showLegend: boolean;
  onShowLegendChange: (show: boolean) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  error: string | null;
  onErrorChange: (error: string | null) => void;
}

// ── Parse WMS JSON legend from GeoServer ──────────────────────────────────────

// ── NativeLegend ──────────────────────────────────────────────────────────────
const NativeLegend: React.FC<{
  entries: LegendEntry[];
  onClose: () => void;
}> = ({ entries, onClose }) => {
  const stops = entries
    .map((e, i) => {
      const pct = entries.length <= 1 ? 50 : (i / (entries.length - 1)) * 100;
      return `${e.color} ${pct.toFixed(1)}%`;
    })
    .join(", ");

  const barHeight = Math.max(entries.length * 24, 72);

  return (
    <div
      className="bg-white/96 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden"
      style={{ width: 220 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Legend
          </span>
        </div>
        
      </div>

      {entries.length === 0 ? (
        <div className="px-3 py-5 text-center">
          <p className="text-[11px] text-slate-400">No legend data</p>
        </div>
      ) : (
        <div className="px-3 pb-3 pt-1 flex gap-3 items-stretch">
          {/* Gradient bar */}
          <div className="flex-shrink-0 flex flex-col" style={{ width: 14 }}>
            <div
              className="rounded-full border border-slate-200/50 shadow-inner w-full"
              style={{
                height: barHeight,
                background:
                  entries.length > 1
                    ? `linear-gradient(to bottom, ${stops})`
                    : entries[0].color,
              }}
            />
          </div>

          {/* Labels — pinned to match gradient positions */}
          <div
            className="flex flex-col justify-between flex-1"
            style={{ height: barHeight }}
          >
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-1.5 min-h-0">
                {/* Swatch */}
                <span
                  className="flex-shrink-0 rounded-sm border border-white/80"
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    background: entry.color,
                    opacity: entry.opacity,
                    boxShadow: `0 0 0 1px ${entry.color}55`,
                  }}
                />
                {/* Label */}
                <span
                  className="text-[10px] font-mono text-slate-600 leading-none truncate"
                  title={entry.label}
                >
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getWMSExtent4326 = async (
  layerName: string,
): Promise<number[] | null> => {
  const url = `${GEOSERVER_URL}?service=WMS&request=GetCapabilities&version=1.3.0`;
  const response = await fetch(url);
  const text = await response.text();
  const xml = new DOMParser().parseFromString(text, "text/xml");
  const layers = Array.from(xml.getElementsByTagName("Layer"));
  const layer = layers.find(
    (l) => l.getElementsByTagName("Name")[0]?.textContent === layerName,
  );
  if (!layer) return null;
  const bbox = layer.getElementsByTagName("EX_GeographicBoundingBox")[0];
  if (!bbox) return null;
  return [
    parseFloat(bbox.getElementsByTagName("westBoundLongitude")[0].textContent!),
    parseFloat(bbox.getElementsByTagName("southBoundLatitude")[0].textContent!),
    parseFloat(bbox.getElementsByTagName("eastBoundLongitude")[0].textContent!),
    parseFloat(bbox.getElementsByTagName("northBoundLatitude")[0].textContent!),
  ];
};

/* ── Floating panel wrapper ─────────────────────────────────────────────── */
function FloatingPanel({
  children,
  onClose,
  title,
  width = 320,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  width?: number;
}) {
  return (
    <div
      className="absolute top-[68px] left-1/2 -translate-x-1/2 z-30"
      style={{ width }}
    >
      <div
        className="p-4"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="font-bold text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-muted)" }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Toolbar button ─────────────────────────────────────────────────────── */
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
      className="relative p-2 rounded-lg transition-all duration-200"
      title={title}
      style={{
        background: active ? "var(--accent-bg)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-tertiary)",
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
const MapView = forwardRef<MapViewHandle, MapViewProps>(
  (
    {
      layerOpacity,
      onOpacityChange,
      selectedBaseMap,
      onBaseMapChange,
      legendUrl,
      onLegendUrlChange,
      showLegend,
      onShowLegendChange,
      loading,
      onLoadingChange,
      error,
      onErrorChange,
    },
    ref,
  ) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<Map | null>(null);
    const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
    const vectorLayerRef = useRef<VectorTileLayer | null>(null);
    const baseLayerRef = useRef<TileLayer<OSM | XYZ> | null>(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activePanel, setActivePanel] = useState<string | null>(null);

    const {
      rasterFileName,
      removeLayer,
      legendEntries,
      legendEntriesLoading,
      fetchLegendEntries,
      setLegendEntries,
    } = useRaster();

    useEffect(() => {
      if (rasterFileName) setActivePanel("layers");
    }, [rasterFileName]);

    const handleRemoveLayer = () => {
      if (mapInstanceRef.current && rasterLayerRef.current) {
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
        onLegendUrlChange(null);
        setLegendEntries([]);
      }
      removeLayer();
      setActivePanel(null);
    };

    useEffect(() => {
      const fn = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", fn);
      return () => document.removeEventListener("fullscreenchange", fn);
    }, []);

    // ── Initialize map ───────────────────────────────────────────────────
    useEffect(() => {
      if (!mapRef.current) return;

      const initialBaseLayer = new TileLayer({
        source: baseMaps.satellite.source(),
        zIndex: 0,
      });
      baseLayerRef.current = initialBaseLayer;

      const coordTarget =
        document.getElementById("mouse-position-mapview") || undefined;

      const controls = defaultControls({
        zoom: false,
        rotate: false,
        attributionOptions: { collapsible: false },
      }).extend([
        new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
        new MousePosition({
          coordinateFormat: (c) =>
            c ? `${c[1].toFixed(6)}°N  ${c[0].toFixed(6)}°E` : "",
          projection: "EPSG:4326",
          target: coordTarget,
          className: "custom-mouse-position",
        }),
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

      const mvtUrl = `${GEOSERVER_MVT_URL}/${Vector_workspace}:${FIXED_VECTOR_LAYER}@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf`;
      const vectorTileLayer = new VectorTileLayer({
        source: new VectorTileSource({
          format: new MVT(),
          url: mvtUrl,
          maxZoom: 22,
        }),
        style: new Style({
          stroke: new Stroke({
            color: "#0d9b7a",
            width: 2.5,
            lineJoin: "round",
          }),
          fill: new Fill({ color: "transparent" }),
        }),
        zIndex: 5,
      });
      map.addLayer(vectorTileLayer);
      vectorLayerRef.current = vectorTileLayer;

      setTimeout(() => map.updateSize(), 100);

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current
            .getLayers()
            .getArray()
            .slice()
            .forEach((l) => mapInstanceRef.current?.removeLayer(l));
          mapInstanceRef.current.setTarget("");
          mapInstanceRef.current = null;
        }
        rasterLayerRef.current = null;
        vectorLayerRef.current = null;
        baseLayerRef.current = null;
      };
    }, []);

    // Resize observer
    useEffect(() => {
      if (!mapContainerRef.current || !mapInstanceRef.current) return;
      const ro = new ResizeObserver(() => {
        mapInstanceRef.current?.updateSize();
      });
      ro.observe(mapContainerRef.current);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (rasterLayerRef.current)
        rasterLayerRef.current.setOpacity(layerOpacity / 100);
    }, [layerOpacity]);

    // ── Imperative API ───────────────────────────────────────────────────
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
            params: {
              LAYERS: fullLayerName,
              TILED: true,
              FORMAT: "image/png",
              TRANSPARENT: true,
              VERSION: "1.3.0",
            },
            ratio: 1,
            serverType: "geoserver",
          });
          const rasterLayer = new ImageLayer({
            source: wmsSource,
            visible: true,
            opacity: layerOpacity / 100,
            zIndex: 10,
          });

          // Set a non-null legendUrl to signal a layer is active (used for showLegend toggle)
          const legendUrlStr =
            `${GEOSERVER_URL}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic` +
            `&FORMAT=application/json&LAYER=${fullLayerName}`;
          onLegendUrlChange(legendUrlStr);

          // Fetch rich JSON legend entries — drives NativeLegend
          setLegendEntries([]);

          map.addLayer(rasterLayer);
          rasterLayerRef.current = rasterLayer;

          getWMSExtent4326(fullLayerName).then((extent4326) => {
            if (!extent4326) return;
            const view = map.getView();
            const viewProj = view.getProjection().getCode();
            const extent =
              viewProj === "EPSG:4326"
                ? extent4326
                : transformExtent(extent4326, "EPSG:4326", viewProj);
            view.fit(extent, {
              padding: [40, 40, 40, 40],
              duration: 500,
              maxZoom: 14,
            });
          });
          onLoadingChange(false);
        } catch (err) {
          onErrorChange(
            `Error: ${err instanceof Error ? err.message : "Unknown"}`,
          );
          onLoadingChange(false);
        }
      },

      removeRasterLayer() {
        if (mapInstanceRef.current && rasterLayerRef.current) {
          mapInstanceRef.current.removeLayer(rasterLayerRef.current);
          rasterLayerRef.current = null;
          onLegendUrlChange(null);
          setLegendEntries([]);
        }
      },

      changeBaseMap(baseMapKey: string) {
        if (!mapInstanceRef.current || !baseLayerRef.current) return;
        mapInstanceRef.current.removeLayer(baseLayerRef.current);
        const nb = new TileLayer({
          source: baseMaps[baseMapKey].source(),
          zIndex: 0,
        });
        baseLayerRef.current = nb;
        mapInstanceRef.current.getLayers().insertAt(0, nb);
        onBaseMapChange(baseMapKey);
      },

      applySLD(sldXml: string | null) {
        if (!rasterLayerRef.current) return;
        const layer = rasterLayerRef.current;
        const oldSource = layer.getSource();
        if (!oldSource) return;

        const currentParams = { ...oldSource.getParams() };
        if (sldXml) {
          currentParams.SLD_BODY = sldXml;
          delete currentParams.STYLES;
        } else {
          delete currentParams.SLD_BODY;
          currentParams.STYLES = "";
        }
        currentParams._t = Date.now();

        layer.setSource(
          new ImageWMS({
            url: GEOSERVER_URL,
            params: currentParams,
            ratio: 1,
            serverType: "geoserver",
          }),
        );

       
        
      },
    }));

    const toggleFullscreen = () => {
      const el = mapContainerRef.current;
      if (!el) return;
      if (!document.fullscreenElement) el.requestFullscreen();
      else document.exitFullscreen();
    };
    const handleZoom = (d: number) => {
      const v = mapInstanceRef.current?.getView();
      if (v) v.animate({ zoom: (v.getZoom() ?? 0) + d, duration: 250 });
    };
    const resetView = () => {
      const v = mapInstanceRef.current?.getView();
      if (v)
        v.animate({
          center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
          zoom: INITIAL_ZOOM,
          duration: 600,
        });
    };
    const togglePanel = (p: string) =>
      setActivePanel(activePanel === p ? null : p);
    const handleChangeBaseMap = (key: string) => {
      if (!mapInstanceRef.current || !baseLayerRef.current) return;
      mapInstanceRef.current.removeLayer(baseLayerRef.current);
      const nb = new TileLayer({ source: baseMaps[key].source(), zIndex: 0 });
      baseLayerRef.current = nb;
      mapInstanceRef.current.getLayers().insertAt(0, nb);
      onBaseMapChange(key);
      setActivePanel(null);
    };

    // ── Render ───────────────────────────────────────────────────────────
    return (
      <div
        ref={mapContainerRef}
        className="w-full h-full p-1.5 relative"
        style={{ background: "var(--surface-base)" }}
      >
        {/* MAP ELEMENT */}
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-card)",
            overflow: "hidden",
          }}
        />

        {/* ═══ FLOATING TOOLBAR ══════════════════════════════════════════ */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div
            className="px-4 py-2.5 flex items-center space-x-2"
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span
              className="text-sm font-bold flex items-center mr-2"
              style={{ color: "var(--text-primary)" }}
            >
              <svg
                className="w-5 h-5 mr-1.5"
                style={{ color: "var(--accent)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.5px",
                }}
              >
                GIS Viewer
              </span>
            </span>
            <div
              className="w-px h-6"
              style={{ background: "var(--border-subtle)" }}
            />
            <ToolbarBtn
              active={activePanel === "layers"}
              onClick={() => togglePanel("layers")}
              title="Layers"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </ToolbarBtn>
            <ToolbarBtn
              active={activePanel === "basemap"}
              onClick={() => togglePanel("basemap")}
              title="Base Map"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z"
                />
              </svg>
            </ToolbarBtn>

            <div
              className="w-px h-6"
              style={{ background: "var(--border-subtle)" }}
            />
            <ToolbarBtn
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                {isFullscreen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                )}
              </svg>
            </ToolbarBtn>
          </div>
        </div>

        {/* ═══ PANELS ════════════════════════════════════════════════════ */}
        {activePanel === "layers" && (
          <FloatingPanel
            title="Layer Controls"
            onClose={() => setActivePanel(null)}
          >
            {rasterFileName ? (
              <>
                <div
                  className="p-3 mb-3"
                  style={{
                    background: "var(--accent-bg)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2 h-2 rounded-full terra-pulse-dot"
                        style={{ background: "var(--green)" }}
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        Active Layer
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveLayer}
                      className="p-1 rounded-md"
                      style={{ color: "var(--red)" }}
                      title="Remove"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <p
                    className="text-sm truncate"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                    }}
                  >
                    {rasterFileName}
                  </p>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Opacity
                    </label>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        color: "var(--accent)",
                        background: "var(--accent-bg)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {layerOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={layerOpacity}
                    onChange={(e) => onOpacityChange(parseInt(e.target.value))}
                    className="w-full terra-slider"
                    style={{
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${layerOpacity}%, var(--border-subtle) ${layerOpacity}%, var(--border-subtle) 100%)`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Show Legend
                  </span>
                  <div
                    className="terra-toggle"
                    data-active={showLegend.toString()}
                    onClick={() => onShowLegendChange(!showLegend)}
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <svg
                  className="w-10 h-10 mx-auto mb-2"
                  style={{ color: "var(--text-muted)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No raster layer loaded
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Upload from the sidebar
                </p>
              </div>
            )}
          </FloatingPanel>
        )}

        {activePanel === "basemap" && (
          <FloatingPanel title="Base Maps" onClose={() => setActivePanel(null)}>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => handleChangeBaseMap(key)}
                  className="flex flex-col items-center p-3 transition-all duration-200"
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${selectedBaseMap === key ? "var(--accent)" : "var(--border-subtle)"}`,
                    background:
                      selectedBaseMap === key
                        ? "var(--accent-bg)"
                        : "var(--surface-raised)",
                    color:
                      selectedBaseMap === key
                        ? "var(--accent)"
                        : "var(--text-tertiary)",
                  }}
                >
                  <svg
                    className="w-6 h-6 mb-1.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={baseMap.icon}
                    />
                  </svg>
                  <span className="text-xs font-medium">{baseMap.name}</span>
                  {selectedBaseMap === key && (
                    <div className="flex items-center space-x-1 mt-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--green)" }}
                      />
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--green)" }}
                      >
                        Active
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </FloatingPanel>
        )}

        {/* ═══ ZOOM CONTROLS ═══════════════════════════════════════════ */}
        <div
          className="absolute top-20 left-4 z-20 flex flex-col overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(8px)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {[
            {
              icon: "M12 4v16m8-8H4",
              action: () => handleZoom(1),
              title: "Zoom in",
            },
            {
              icon: "M20 12H4",
              action: () => handleZoom(-1),
              title: "Zoom out",
            },
            { icon: "M4 4h16v16H4z", action: resetView, title: "Reset" },
          ].map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className="h-px"
                  style={{ background: "var(--border-subtle)" }}
                />
              )}
              <button
                onClick={b.action}
                className="p-2.5 transition-colors"
                title={b.title}
                style={{ color: "var(--text-secondary)" }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={b.icon}
                  />
                </svg>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* ═══ COORDINATES ════════════════════════════════════════════ */}
        <div
          className="absolute bottom-3 right-3 z-20 px-3 py-1.5 flex items-center space-x-2"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(6px)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          }}
        >
          <svg
            className="w-3 h-3 flex-shrink-0"
            style={{ color: "var(--accent)" }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="4" />
          </svg>
          <div
            id="mouse-position-mapview"
            className="text-sm min-w-[180px]"
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>

        {/* ═══ NATIVE HTML LEGEND ════════════════════════════════════ */}
        {legendUrl && showLegend && (
          <div className="absolute bottom-12 right-3 z-20">
            <NativeLegend
              entries={legendEntries}
              onClose={() => onLegendUrlChange(null)}
            />
          </div>
        )}

        {/* ═══ ERROR ═════════════════════════════════════════════════ */}
        {error && (
          <div
            className="absolute top-20 left-16 z-20 px-4 py-3 flex items-center max-w-sm"
            style={{
              background: "var(--red-bg)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <svg
              className="w-5 h-5 mr-3 flex-shrink-0"
              style={{ color: "var(--red)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              className="text-sm font-medium pr-8"
              style={{ color: "#991b1b" }}
            >
              {error}
            </span>
            <button
              onClick={() => onErrorChange(null)}
              className="absolute right-2 top-2 p-1 rounded"
              style={{ color: "var(--red)" }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* ═══ LOADING ══════════════════════════════════════════════ */}
        {loading && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(4px)",
              borderRadius: "var(--radius-xl)",
            }}
          >
            <div
              className="p-8"
              style={{
                background: "var(--surface-card)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-xl)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center space-x-4">
                <div
                  className="animate-spin rounded-full h-8 w-8"
                  style={{ borderBottom: "2px solid var(--accent)" }}
                />
                <div>
                  <p
                    className="font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Loading raster layer…
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Connecting to GeoServer
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

MapView.displayName = "MapView";
export default MapView;
