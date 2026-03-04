'use client'
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
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
import { defaults as defaultControls, ScaleLine, MousePosition, ZoomToExtent, FullScreen } from "ol/control";
import { Style, Fill, Stroke } from "ol/style";
import { transformExtent } from 'ol/proj';
import "ol/ol.css";
import { baseMaps } from "@/components/MapComponents";
import Image from "next/image";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { useRaster } from "@/contexts/raster_operations/RasterContext";

// ── Constants ──────────────────────────────────────────────────────────────────
const GEOSERVER_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
const GEOSERVER_MVT_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/gwc/service/tms/1.0.0`;
const Vector_workspace = "vector_work";
const Raster_workspace = "raster_work";
const FIXED_VECTOR_LAYER = "STP_State";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface MapViewHandle {
  loadRasterLayer: (layerName: string, fileName: string) => void;
  removeRasterLayer: () => void;
  changeBaseMap: (baseMapKey: string) => void;
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const getWMSExtent4326 = async (layerName: string): Promise<number[] | null> => {
  const url = `${GEOSERVER_URL}?service=WMS&request=GetCapabilities&version=1.3.0`;
  const response = await fetch(url);
  const text = await response.text();

  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const layers = Array.from(xml.getElementsByTagName('Layer'));

  const layer = layers.find(l =>
    l.getElementsByTagName('Name')[0]?.textContent === layerName
  );

  if (!layer) return null;

  const bbox = layer.getElementsByTagName('EX_GeographicBoundingBox')[0];
  if (!bbox) return null;

  return [
    parseFloat(bbox.getElementsByTagName('westBoundLongitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('southBoundLatitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('eastBoundLongitude')[0].textContent!),
    parseFloat(bbox.getElementsByTagName('northBoundLatitude')[0].textContent!)
  ];
};

// ── Component ──────────────────────────────────────────────────────────────────
const MapView = forwardRef<MapViewHandle, MapViewProps>(({
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
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const vectorLayerRef = useRef<VectorTileLayer | null>(null);
  const baseLayerRef = useRef<TileLayer<OSM | XYZ> | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const { rasterFileName, removeLayer } = useRaster();

  // Auto-open the layers panel when a raster is loaded
  useEffect(() => {
    if (rasterFileName) {
      setActivePanel("layers");
    }
  }, [rasterFileName]);

  // Remove layer from BOTH the map and the context
  const handleRemoveLayer = () => {
    // 1. Remove from OpenLayers map
    if (mapInstanceRef.current && rasterLayerRef.current) {
      mapInstanceRef.current.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
      onLegendUrlChange(null);
    }
    // 2. Remove from context (clears rasterFileName, layer, details, etc.)
    removeLayer();
    // 3. Close the panel
    setActivePanel(null);
  };

  // ── Fullscreen listener ────────────────────────────────────────────────────
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
    });
    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls({
      zoom: false,
      rotate: false,
      attributionOptions: { collapsible: false },
    }).extend([
      new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
      new MousePosition({
        coordinateFormat: (coordinate) => {
          if (!coordinate) return "No coordinates";
          const [lon, lat] = coordinate;
          return `${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E`;
        },
        projection: "EPSG:4326",
        target: document.getElementById("mouse-position") || undefined,
      }),
      new ZoomToExtent({
        tipLabel: "Zoom to extent",
        extent: fromLonLat([68, 6]).concat(fromLonLat([97, 37])),
      }),
      new FullScreen({ tipLabel: "Toggle fullscreen" }),
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

    // MVT vector layer
    const mvtUrl = `${GEOSERVER_MVT_URL}/${Vector_workspace}:${FIXED_VECTOR_LAYER}@EPSG%3A900913@pbf/{z}/{x}/{-y}.pbf`;
    const vectorTileSource = new VectorTileSource({
      format: new MVT(),
      url: mvtUrl,
      maxZoom: 22,
    });

    const vectorTileLayer = new VectorTileLayer({
      source: vectorTileSource,
      style: new Style({
        stroke: new Stroke({ color: "#3b82f6", width: 3, lineJoin: "round" }),
        fill: new Fill({ color: 'transparent' }),
      }),
      zIndex: 5,
    });

    map.addLayer(vectorTileLayer);
    vectorLayerRef.current = vectorTileLayer;

    return () => {
      if (mapInstanceRef.current) {
        const layers = mapInstanceRef.current.getLayers().getArray().slice();
        layers.forEach(layer => mapInstanceRef.current?.removeLayer(layer));
        mapInstanceRef.current.setTarget("");
        mapInstanceRef.current = null;
      }
      rasterLayerRef.current = null;
      vectorLayerRef.current = null;
      baseLayerRef.current = null;
    };
  }, []);

  // ── Sync opacity when slider changes ───────────────────────────────────────
  useEffect(() => {
    if (rasterLayerRef.current) {
      rasterLayerRef.current.setOpacity(layerOpacity / 100);
    }
  }, [layerOpacity]);

  // ── Imperative API exposed to parent ───────────────────────────────────────
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

        if (rasterLayerRef.current) {
          map.removeLayer(rasterLayerRef.current);
        }

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

        const legendUrlString = `${GEOSERVER_URL}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000`;
        onLegendUrlChange(legendUrlString);
        map.addLayer(rasterLayer);
        rasterLayerRef.current = rasterLayer;

        getWMSExtent4326(fullLayerName).then(extent4326 => {
          if (!extent4326) return;
          const view = map.getView();
          const viewProj = view.getProjection().getCode();
          const extent = viewProj === 'EPSG:4326'
            ? extent4326
            : transformExtent(extent4326, 'EPSG:4326', viewProj);
          view.fit(extent, { padding: [20, 20, 20, 20], duration: 500, maxZoom: 14 });
        });

        onLoadingChange(false);
      } catch (err) {
        console.log("Error loading raster layer:", err);
        onErrorChange(`Error loading raster layer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        onLoadingChange(false);
      }
    },

    removeRasterLayer() {
      if (mapInstanceRef.current && rasterLayerRef.current) {
        mapInstanceRef.current.removeLayer(rasterLayerRef.current);
        rasterLayerRef.current = null;
        onLegendUrlChange(null);
      }
    },

    changeBaseMap(baseMapKey: string) {
      if (!mapInstanceRef.current || !baseLayerRef.current) return;
      mapInstanceRef.current.removeLayer(baseLayerRef.current);

      const newBaseLayer = new TileLayer({
        source: baseMaps[baseMapKey].source(),
        zIndex: 0,
      });
      baseLayerRef.current = newBaseLayer;
      mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
      onBaseMapChange(baseMapKey);
    },
  }));

  // ── Local actions ──────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    const el = mapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleZoom = (delta: number) => {
    const view = mapInstanceRef.current?.getView();
    if (view) view.animate({ zoom: (view.getZoom() ?? 0) + delta, duration: 250 });
  };

  const resetView = () => {
    const view = mapInstanceRef.current?.getView();
    if (view) {
      view.animate({ center: fromLonLat([78.9629, 23.5937]), zoom: 5, duration: 600 });
    }
  };

  const togglePanel = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  const handleChangeBaseMap = (key: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;
    mapInstanceRef.current.removeLayer(baseLayerRef.current);

    const newBaseLayer = new TileLayer({
      source: baseMaps[key].source(),
      zIndex: 0,
    });
    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
    onBaseMapChange(key);
    setActivePanel(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 md:w-4/6 p-1 relative bg-slate-950">
      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl shadow-2xl border border-slate-700 bg-slate-900"
      />

      {/* ═══ FLOATING GIS TOOLBAR ═══════════════════════════════════════════ */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700 px-4 py-2.5 flex items-center space-x-2">
          <span className="text-sm font-bold text-slate-100 flex items-center mr-2">
            <svg className="w-5 h-5 mr-1.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            GIS Viewer
          </span>

          <div className="w-px h-6 bg-slate-600" />

          {/* Layers */}
          <button
            onClick={() => togglePanel("layers")}
            className={`relative group p-2 rounded-lg transition-all duration-200 ${
              activePanel === "layers"
                ? "bg-blue-500/20 text-blue-400"
                : "hover:bg-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Layers"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>

          {/* Basemap */}
          <button
            onClick={() => togglePanel("basemap")}
            className={`relative group p-2 rounded-lg transition-all duration-200 ${
              activePanel === "basemap"
                ? "bg-blue-500/20 text-blue-400"
                : "hover:bg-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Base Map"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h2a2 2 0 002-2v-1a2 2 0 012-2h1.945M5.05 9h13.9c.976 0 1.31-1.293.455-1.832L12 2 4.595 7.168C3.74 7.707 4.075 9 5.05 9z" />
            </svg>
          </button>

          {/* Tools */}
          <button
            onClick={() => togglePanel("tools")}
            className={`relative group p-2 rounded-lg transition-all duration-200 ${
              activePanel === "tools"
                ? "bg-blue-500/20 text-blue-400"
                : "hover:bg-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Tools"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-600" />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-all duration-200"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ LAYERS PANEL (floating) ════════════════════════════════════════ */}
      {activePanel === "layers" && (
        <div className="absolute top-[72px] left-1/2 transform -translate-x-1/2 z-30 w-80">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 p-4">
            {/* Header: title + action buttons */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-100 text-sm">Layer Controls</h3>
              <div className="flex items-center space-x-1">
                {/* Remove layer — only when active */}
                {rasterFileName && (
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
                )}
                {/* Close panel */}
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                  title="Close panel"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {rasterFileName ? (
              <>
                {/* Active raster info */}
                <div className="bg-slate-800/60 rounded-lg p-3 mb-3 border border-slate-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-green-400">Active Layer</span>
                  </div>
                  <p className="text-sm text-slate-200 truncate">{rasterFileName}</p>
                </div>

                {/* Opacity slider */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Opacity</label>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                      {layerOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={layerOpacity}
                    onChange={(e) => onOpacityChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${layerOpacity}%, #334155 ${layerOpacity}%, #334155 100%)`,
                    }}
                  />
                </div>

                {/* Legend toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Show Legend</span>
                  <button
                    onClick={() => onShowLegendChange(!showLegend)}
                    className={`w-10 h-5 rounded-full relative transition-all duration-300 ${
                      showLegend ? "bg-blue-500" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 mt-0.5 mx-0.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        showLegend ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <svg className="w-10 h-10 mx-auto text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-sm text-slate-400">No raster layer loaded</p>
                <p className="text-xs text-slate-500 mt-1">Upload a raster from the sidebar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BASEMAP PANEL (floating) ═══════════════════════════════════════ */}
      {activePanel === "basemap" && (
        <div className="absolute top-[72px] left-1/2 transform -translate-x-1/2 z-30 w-80">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-100 text-sm">Base Maps</h3>
              <button onClick={() => setActivePanel(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(baseMaps).map(([key, baseMap]) => (
                <button
                  key={key}
                  onClick={() => handleChangeBaseMap(key)}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 border ${
                    selectedBaseMap === key
                      ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10"
                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500"
                  }`}
                >
                  <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={baseMap.icon} />
                  </svg>
                  <span className="text-xs font-medium">{baseMap.name}</span>
                  {selectedBaseMap === key && (
                    <div className="flex items-center space-x-1 mt-1">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      <span className="text-[10px] text-green-400">Active</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOOLS PANEL (floating) ═════════════════════════════════════════ */}
      {activePanel === "tools" && (
        <div className="absolute top-[72px] left-1/2 transform -translate-x-1/2 z-30 w-72">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-100 text-sm">Map Tools</h3>
              <button onClick={() => setActivePanel(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { resetView(); setActivePanel(null); }}
                className="flex flex-col items-center p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
              >
                <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs font-medium">Home View</span>
              </button>

              <button
                onClick={() => handleZoom(1)}
                className="flex flex-col items-center p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
              >
                <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                <span className="text-xs font-medium">Zoom In</span>
              </button>

              <button
                onClick={() => handleZoom(-1)}
                className="flex flex-col items-center p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
              >
                <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
                <span className="text-xs font-medium">Zoom Out</span>
              </button>

              <button
                onClick={toggleFullscreen}
                className="flex flex-col items-center p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all"
              >
                <svg className="w-6 h-6 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                <span className="text-xs font-medium">Fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ZOOM CONTROLS (left side) ══════════════════════════════════════ */}
      <div className="absolute top-20 left-4 z-20 flex flex-col rounded-xl bg-slate-900/70 backdrop-blur-md shadow-xl border border-slate-700 overflow-hidden">
        <button onClick={() => handleZoom(1)} className="p-2.5 text-slate-100 hover:bg-slate-700 transition" title="Zoom in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="h-px bg-slate-700" />
        <button onClick={() => handleZoom(-1)} className="p-2.5 text-slate-100 hover:bg-slate-700 transition" title="Zoom out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="h-px bg-slate-700" />
        <button onClick={resetView} className="p-2.5 text-slate-100 hover:bg-slate-700 transition" title="Reset view">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
          </svg>
        </button>
      </div>

      {/* ═══ COORDINATES ════════════════════════════════════════════════════ */}
      <div className="absolute right-4 bottom-4 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
        <div className="text-xs font-mono text-slate-100" id="mouse-position"></div>
      </div>

      {/* ═══ LEGEND ═════════════════════════════════════════════════════════ */}
      {legendUrl && showLegend && (
        <div className="absolute bottom-14 right-14 z-20">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 w-[150px] h-[380px] flex flex-col">
            <div className="flex justify-between items-center px-2 py-1 border-b">
              <span className="text-xs font-bold text-gray-700">Legend</span>
              <button
                onClick={() => onLegendUrlChange(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative flex-1 p-2 overflow-hidden">
              <Image
                src={legendUrl}
                alt="Layer Legend"
                fill
                className="object-contain"
                unoptimized
                onError={() => onErrorChange("Failed to load legend")}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ ERROR MESSAGE ══════════════════════════════════════════════════ */}
      {error && (
        <div className="absolute top-20 left-4 z-20 bg-red-900/90 backdrop-blur-md border border-red-600 text-red-200 px-4 py-3 rounded-lg shadow-xl flex items-center max-w-md w-full">
          <svg className="w-5 h-5 mr-3 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium pr-8">{error}</span>
          <button
            onClick={() => onErrorChange(null)}
            className="absolute right-2 top-2 text-red-400 hover:text-red-200 transition-colors p-1 hover:bg-red-800/30 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══ LOADING OVERLAY ════════════════════════════════════════════════ */}
      {loading && (
        <div className="absolute inset-0 z-40 bg-slate-900/70 flex items-center justify-center backdrop-blur-sm rounded-2xl">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-xl p-8 shadow-2xl border border-slate-600">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <div>
                <p className="text-white font-medium">Loading raster layer...</p>
                <p className="text-slate-400 text-sm">Connecting to GeoServer</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MapView.displayName = "MapView";

export default MapView;