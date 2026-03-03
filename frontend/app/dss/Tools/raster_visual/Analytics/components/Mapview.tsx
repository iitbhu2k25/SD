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
  rasterFileName: string;
  onRasterFileNameChange: (name: string) => void;
  legendUrl: string | null;
  onLegendUrlChange: (url: string | null) => void;
  showLegend: boolean;
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
  selectedBaseMap,
  onBaseMapChange,
  rasterFileName,
  onRasterFileNameChange,
  legendUrl,
  onLegendUrlChange,
  showLegend,
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

    vectorTileSource.on('tileloadend', () => {
      console.log('MVT tiles loaded successfully');
    });

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

        onRasterFileNameChange(fileName);
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
        onRasterFileNameChange("");
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 md:w-4/6 p-1 relative bg-slate-950">
      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl shadow-2xl border border-slate-700 bg-slate-900"
      />

      {/* Fullscreen Button */}
      <div className="absolute top-6 right-6 z-30">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-100 shadow-lg hover:bg-slate-700/70 transition"
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m12-6h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4m12 6h4a2 2 0 002-2v-4" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m14-6h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3m14 6h3a2 2 0 002-2v-3" />
            </svg>
          )}
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-6 left-6 z-20 flex flex-col rounded-xl bg-slate-900/70 backdrop-blur-md shadow-xl border border-slate-700 overflow-hidden">
        <button onClick={() => handleZoom(1)} className="p-3 text-slate-100 hover:bg-slate-700 transition" title="Zoom in">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <div className="h-px bg-slate-700" />
        <button onClick={() => handleZoom(-1)} className="p-3 text-slate-100 hover:bg-slate-700 transition" title="Zoom out">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="h-px bg-slate-700" />
        <button onClick={resetView} className="p-3 text-slate-100 hover:bg-slate-700 transition" title="Reset view">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
          </svg>
        </button>
      </div>

      {/* Coordinates */}
      <div className="absolute right-6 bottom-6 z-10 bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-600 shadow-lg">
        <div className="text-xs font-mono text-slate-100" id="mouse-position"></div>
      </div>

      {/* Legend */}
      {legendUrl && showLegend && (
        <div className="absolute bottom-16 right-16 z-20">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 w-[150px] h-[380px] flex flex-col">
            <div className="flex justify-between items-center px-2 py-1 border-b">
              <span className="text-xs font-bold text-gray-700">Legend</span>
              <button
                onClick={() => onLegendUrlChange(null)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
              >
                ✕
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

      {/* Error Message */}
      {error && (
        <div className="absolute top-6 left-6 z-20 bg-red-900/90 backdrop-blur-md border border-red-600 text-red-200 px-4 py-3 rounded-lg shadow-xl flex items-center max-w-md w-full">
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

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 bg-slate-900/70 flex items-center justify-center backdrop-blur-sm">
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