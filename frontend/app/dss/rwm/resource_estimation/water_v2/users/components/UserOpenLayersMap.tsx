"use client";

// Basin (user) OpenLayers map engine for water_v2.
// Shows WFS vector layers (boundary/river/stretch/drain/catchment)
// and WMS raster layers after confirm.
import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat, transformExtent } from "ol/proj";
import { defaults as defaultControls, ScaleLine, ZoomSlider } from "ol/control";
import { Style, Fill, Stroke } from "ol/style";
import { INDIA_CENTER } from "@/interface/openlayer";
import { baseMaps, HoverTooltip } from "@/components/MapComponents";
import { createWFSVectorSource } from "@/components/utils/geoserver_url";
// @ts-ignore
import "ol/ol.css";

import { useUserMapStore } from "../stores/userMapStore";
import { useUserRiverStore } from "../stores/userRiverStore";

const GEOSERVER_WMS_URL = "/geoserver/wms";
const WORKSPACE = "dss_vector";
const VECTOR_OVERLAY_Z = {
  stretch: 29,
  catchment: 30,
  river: 34,
  drain: 35,
} as const;

function buildLegendUrl(workspace: string, layerName: string, style: string) {
  return (
    `${GEOSERVER_WMS_URL}?REQUEST=GetLegendGraphic&VERSION=1.0.0` +
    `&FORMAT=image/png&WIDTH=20&HEIGHT=20` +
    `&LAYER=${workspace}:${layerName}&STYLE=${style}` +
    `&LEGEND_OPTIONS=forceLabels:on;fontName:Arial;fontSize:12;fontAntiAliasing:true`
  );
}

type ExtentTuple = [number, number, number, number];

function isFiniteExtent(extent: number[] | null | undefined): extent is ExtentTuple {
  return (
    Array.isArray(extent) &&
    extent.length === 4 &&
    extent.every((value) => Number.isFinite(value)) &&
    extent[2] > extent[0] &&
    extent[3] > extent[1]
  );
}

function resolveToMapExtent(rawExtent: number[]): ExtentTuple | null {
  if (!isFiniteExtent(rawExtent)) return null;

  const [minx, miny, maxx, maxy] = rawExtent;
  const isLikelyLonLat =
    Math.abs(minx) <= 180 &&
    Math.abs(maxx) <= 180 &&
    Math.abs(miny) <= 90 &&
    Math.abs(maxy) <= 90;

  const isLikelyUtm44N =
    minx >= 100000 &&
    maxx <= 900000 &&
    miny >= 0 &&
    maxy <= 10000000;

  const isLikelyWebMercator =
    Math.abs(minx) <= 20037508 &&
    Math.abs(maxx) <= 20037508 &&
    Math.abs(miny) <= 20037508 &&
    Math.abs(maxy) <= 20037508 &&
    (Math.abs(minx) > 1000 || Math.abs(maxx) > 1000);

  const tryTransform = (sourceCrs: string): ExtentTuple | null => {
    try {
      const transformed = transformExtent(rawExtent as ExtentTuple, sourceCrs, "EPSG:3857");
      return isFiniteExtent(transformed) ? transformed : null;
    } catch {
      return null;
    }
  };

  if (isLikelyLonLat) {
    const from4326 = tryTransform("EPSG:4326");
    if (from4326) return from4326;
  }

  if (isLikelyUtm44N) {
    const from32644 = tryTransform("EPSG:32644");
    if (from32644) return from32644;
  }

  if (isLikelyWebMercator) {
    return [minx, miny, maxx, maxy];
  }

  return tryTransform("EPSG:4326") ?? tryTransform("EPSG:32644");
}

function createDualStrokeStyle(haloColor: string, haloWidth: number, coreColor: string, coreWidth: number) {
  return [
    new Style({ stroke: new Stroke({ color: haloColor, width: haloWidth }) }),
    new Style({ stroke: new Stroke({ color: coreColor, width: coreWidth }) }),
  ];
}

export default function UserOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const clippedRasterLayersRef = useRef<Record<string, ImageLayer<any>>>({});

  // Vector layer refs
  const boundaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drainLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const catchmentLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hoveredFeatureRef = useRef<any>(null);
  const pendingMousePositionRef = useRef({ x: 0, y: 0 });
  const mouseFrameRef = useRef<number | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("osm");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [legendData, setLegendData] = useState<any>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [layerOpacity, setLayerOpacity] = useState(75);

  const rasterLayerInfo = useUserMapStore((s) => s.rasterLayerInfo);
  const rasterResponse = useUserMapStore((s) => s.rasterResponse);
  const activeYear = useUserMapStore((s) => s.activeYear);
  const setActiveYear = useUserMapStore((s) => s.setActiveYear);
  const rasterResponseRef = useRef(rasterResponse);

  const selectedRiver = useUserRiverStore((s) => s.selectedRiver);
  const selectedStretch = useUserRiverStore((s) => s.selectedStretch);
  const selectedDrain = useUserRiverStore((s) => s.selectedDrain);

  useEffect(() => {
    rasterResponseRef.current = rasterResponse;
  }, [rasterResponse]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const baseLayer = new TileLayer({ source: baseMaps["osm"].source(), zIndex: 0 });
    baseLayerRef.current = baseLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [baseLayer],
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: 4.8,
      }),
      controls: defaultControls({ zoom: false }).extend([
        new ScaleLine(),
        new ZoomSlider(),
      ]),
    });

    const handlePointerMove = (event: any) => {
      if (event.dragging) return;

      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (candidateFeature, layer) => {
          if (layer instanceof VectorLayer) return candidateFeature;
          return undefined;
        },
        { hitTolerance: 3 },
      ) as any | undefined;

      const nextFeature = feature ?? null;
      if (nextFeature !== hoveredFeatureRef.current) {
        hoveredFeatureRef.current = nextFeature;
        setHoveredFeature(nextFeature);
      }

      if (!nextFeature) return;

      const pe = event.originalEvent as PointerEvent;
      pendingMousePositionRef.current = { x: pe.clientX, y: pe.clientY };

      if (mouseFrameRef.current !== null) return;
      mouseFrameRef.current = window.requestAnimationFrame(() => {
        mouseFrameRef.current = null;
        setMousePosition(pendingMousePositionRef.current);
      });
    };

    const handleMoveStart = () => {
      if (!hoveredFeatureRef.current) return;
      hoveredFeatureRef.current = null;
      setHoveredFeature(null);
    };

    map.on("pointermove", handlePointerMove);
    map.on("movestart", handleMoveStart);

    mapInstanceRef.current = map;

    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(mapRef.current!);

    setMapReady(true);

    return () => {
      ro.disconnect();
      map.un("pointermove", handlePointerMove);
      map.un("movestart", handleMoveStart);
      if (mouseFrameRef.current !== null) {
        window.cancelAnimationFrame(mouseFrameRef.current);
        mouseFrameRef.current = null;
      }
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Basemap switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!baseLayerRef.current) return;
    const def = baseMaps[selectedBaseMap] ?? baseMaps["osm"];
    baseLayerRef.current.setSource(def.source());
  }, [selectedBaseMap]);

  // ── Boundary layer — always visible ─────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const source = createWFSVectorSource({ workspace: WORKSPACE, layerName: "Boundary" });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#1D4ED8", width: 1.45 }),
        fill: new Fill({ color: "rgba(37, 99, 235, 0.035)" }),
      }),
      zIndex: 2,
    });

    map.addLayer(layer);
    boundaryLayerRef.current = layer;

    const tryZoomBoundary = () => {
      if (source.getFeatures().length > 0) {
        source.un("change", tryZoomBoundary);
        if (!selectedRiver && !rasterResponseRef.current) {
          const ext = source.getExtent();
          if (ext && ext.some((v) => isFinite(v))) {
            map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 800 });
          }
        }
      }
    };
    source.on("change", tryZoomBoundary);

    return () => {
      source.un("change", tryZoomBoundary);
      map.removeLayer(layer);
      boundaryLayerRef.current = null;
    };
  }, [mapReady]);

  // ── River layer — load when river is selected ────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (riverLayerRef.current) {
      map?.removeLayer(riverLayerRef.current);
      riverLayerRef.current = null;
    }

    if (!map || !mapReady || !selectedRiver) return;

    const source = createWFSVectorSource({
      workspace: WORKSPACE,
      layerName: "Rivers",
      layerFilter: { filterField: "River_Code", filterValue: [selectedRiver] },
    });

    const layer = new VectorLayer({
      source,
      style: createDualStrokeStyle("rgba(8, 47, 73, 0.95)", 5.6, "#06B6D4", 3.8),
      zIndex: VECTOR_OVERLAY_Z.river,
    });

    map.addLayer(layer);
    riverLayerRef.current = layer;

    const tryZoomRiver = () => {
      if (source.getFeatures().length > 0) {
        source.un("change", tryZoomRiver);
        if (!selectedStretch && !rasterResponseRef.current) {
          const ext = source.getExtent();
          if (ext && ext.some((v) => isFinite(v))) {
            map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 800 });
          }
        }
      }
    };
    source.on("change", tryZoomRiver);

    return () => {
      source.un("change", tryZoomRiver);
      map.removeLayer(layer);
      riverLayerRef.current = null;
    };
  }, [mapReady, selectedRiver]);

  // ── Stretch layer — always visible (all stretches by default) ──────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const source = createWFSVectorSource({
      workspace: WORKSPACE,
      layerName: "Stretches",
    });

    const layer = new VectorLayer({
      source,
      style: createDualStrokeStyle("rgba(255, 255, 255, 0.92)", 3.4, "#F97316", 2.2),
      zIndex: VECTOR_OVERLAY_Z.stretch,
    });

    map.addLayer(layer);
    stretchLayerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      stretchLayerRef.current = null;
    };
  }, [mapReady]);

  // ── Zoom to selected stretch when it changes ─────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || selectedStretch === null || !stretchLayerRef.current) return;

    const source = stretchLayerRef.current.getSource();
    if (!source) return;

    const zoomToStretch = () => {
      if (rasterResponseRef.current) return;
      const features = source.getFeatures();
      if (features.length === 0) return;
      const feature = features.find((f) => f.get("Stretch_ID") === selectedStretch);
      if (feature) {
        source.un("change", zoomToStretch);
        const ext = feature.getGeometry()?.getExtent();
        if (ext && ext.some((v) => isFinite(v))) {
          map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 800 });
        }
      }
    };

    // Try immediately (features may already be loaded)
    zoomToStretch();
    // Also listen for load completion if not yet loaded
    source.on("change", zoomToStretch);

    return () => {
      source.un("change", zoomToStretch);
    };
  }, [mapReady, selectedStretch]);

  // ── Drain layer — load when drain is selected ────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (drainLayerRef.current) {
      map?.removeLayer(drainLayerRef.current);
      drainLayerRef.current = null;
    }

    if (!map || !mapReady || selectedDrain === null) return;

    const source = createWFSVectorSource({
      workspace: WORKSPACE,
      layerName: "Drain",
      layerFilter: { filterField: "Drain_No", filterValue: [selectedDrain] },
    });

    const layer = new VectorLayer({
      source,
      style: createDualStrokeStyle("rgba(17, 24, 39, 0.98)", 6.2, "#22C55E", 4.2),
      zIndex: VECTOR_OVERLAY_Z.drain,
    });

    map.addLayer(layer);
    drainLayerRef.current = layer;

    const tryZoomDrain = () => {
      if (source.getFeatures().length > 0) {
        source.un("change", tryZoomDrain);
        if (rasterResponseRef.current) return;
        const ext = source.getExtent();
        if (ext && ext.some((v) => isFinite(v))) {
          map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 800 });
        }
      }
    };
    source.on("change", tryZoomDrain);

    return () => {
      source.un("change", tryZoomDrain);
      map.removeLayer(layer);
      drainLayerRef.current = null;
    };
  }, [mapReady, selectedDrain]);

  // ── Catchment layer — load when drain is selected ────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;

    if (catchmentLayerRef.current) {
      map?.removeLayer(catchmentLayerRef.current);
      catchmentLayerRef.current = null;
    }

    if (!map || !mapReady || selectedDrain === null) return;

    const source = new VectorSource({
      format: new GeoJSON(),
      url: `/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${WORKSPACE}:Catchment&outputFormat=application/json&srsname=EPSG:3857&cql_filter=Drain_No=${selectedDrain}`,
    });

    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#BE123C", width: 2.8, lineDash: [9, 5] }),
        fill: new Fill({ color: "rgba(190, 24, 93, 0.08)" }),
      }),
      zIndex: VECTOR_OVERLAY_Z.catchment,
    });

    map.addLayer(layer);
    catchmentLayerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      catchmentLayerRef.current = null;
    };
  }, [mapReady, selectedDrain]);

  // ── Load raster layers when rasterResponse changes ─────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(clippedRasterLayersRef.current).forEach((l) => map.removeLayer(l));
    clippedRasterLayersRef.current = {};

    if (!rasterResponse?.clipped_rasters?.length) return;

    let bboxToFit: number[] | null = null;
    const responseBbox = rasterResponse?.bbox;
    const initialVisibleYear =
      activeYear ??
      Array.from(new Set(rasterResponse.clipped_rasters.map((r) => r.year))).sort((a, b) => a - b)[0] ??
      null;

    rasterResponse.clipped_rasters.forEach((raster, index) => {
      const { layer_name, workspace, style, original_name, year, season, layer_type, bbox } = raster;

      const layer = new ImageLayer({
        source: new ImageWMS({
          url: GEOSERVER_WMS_URL,
          params: {
            SERVICE: "WMS",
            REQUEST: "GetMap",
            LAYERS: `${workspace}:${layer_name}`,
            STYLES: style ?? "",
            TRANSPARENT: true,
            VERSION: "1.1.1",
            FORMAT: "image/png",
          },
          ratio: 1,
          serverType: "geoserver",
        }),
        zIndex: 10 + index,
        opacity: layerOpacity / 100,
        visible: year === initialVisibleYear,
        properties: { name: original_name, workspace, layerName: layer_name, style, layer_type, year, season },
      });

      map.addLayer(layer);
      clippedRasterLayersRef.current[`clipped_${layer_name}`] = layer;

      const candidateBbox = bbox ?? null;
      if (isFiniteExtent(candidateBbox)) bboxToFit = candidateBbox;
    });

    if (!bboxToFit && isFiniteExtent(responseBbox)) {
      bboxToFit = responseBbox;
    }

    let fitExtent = resolveToMapExtent(bboxToFit ?? []);
    if (!fitExtent) {
      const catchmentExtent = catchmentLayerRef.current?.getSource()?.getExtent();
      if (catchmentExtent && isFiniteExtent(catchmentExtent)) {
        fitExtent = catchmentExtent;
      } else {
        const drainExtent = drainLayerRef.current?.getSource()?.getExtent();
        if (drainExtent && isFiniteExtent(drainExtent)) {
          fitExtent = drainExtent;
        }
      }
    }

    if (fitExtent) {
      map.updateSize();
      map.getView().fit(fitExtent, { padding: [48, 48, 48, 48], maxZoom: 13, duration: 700 });
      const currentZoom = map.getView().getZoom() ?? 0;
      const minZoomAfterConfirm = selectedDrain !== null ? 11.4 : 10.2;
      if (currentZoom < minZoomAfterConfirm) {
        map.getView().animate({ zoom: minZoomAfterConfirm, duration: 220 });
      }
    }

    if (activeYear === null && initialVisibleYear !== null) {
      Object.values(clippedRasterLayersRef.current).forEach((layer) => {
        const props = layer.getProperties();
        layer.setVisible(props.year === initialVisibleYear);
      });
    } else {
      Object.values(clippedRasterLayersRef.current).forEach((layer) => {
        const props = layer.getProperties();
        layer.setVisible(props.year === activeYear);
      });
    }
  }, [rasterResponse, selectedDrain]);

  // ── Show only the active year's layer ──────────────────────────────────────
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((layer) => {
      const props = layer.getProperties();
      layer.setVisible(props.year === activeYear);
    });
  }, [activeYear]);

  // Keep vector overlays soft while raster is visible to avoid boundary dominance.
  useEffect(() => {
    const hasRaster = Boolean(rasterResponse?.clipped_rasters?.length);
    const hasSelectedDrain = selectedDrain !== null;
    const hasSelectedStretch = selectedStretch !== null;

    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.setOpacity(hasRaster ? 0.52 : 1);
    }
    if (riverLayerRef.current) {
      riverLayerRef.current.setOpacity(hasRaster ? 0.95 : 1);
    }
    if (stretchLayerRef.current) {
      stretchLayerRef.current.setVisible(true);
      stretchLayerRef.current.setOpacity(
        hasRaster
          ? hasSelectedDrain
            ? 0.38
            : hasSelectedStretch
              ? 0.55
              : 0.7
          : hasSelectedDrain
            ? 0.48
            : hasSelectedStretch
              ? 0.65
              : 0.88,
      );
    }
    if (drainLayerRef.current) {
      drainLayerRef.current.setOpacity(hasRaster ? 0.96 : 1);
    }
    if (catchmentLayerRef.current) {
      catchmentLayerRef.current.setOpacity(hasRaster ? 0.95 : 1);
    }
  }, [rasterResponse, selectedRiver, selectedStretch, selectedDrain]);

  // ── Update legend when active raster changes ────────────────────────────────
  useEffect(() => {
    if (!rasterLayerInfo) { setLegendUrl(null); setLegendData(null); return; }
    const { workspace, layer_name, style, legend_data } = rasterLayerInfo;
    if (legend_data) { setLegendData(legend_data); setLegendUrl(null); }
    else { setLegendUrl(buildLegendUrl(workspace, layer_name, style)); setLegendData(null); }
    setShowLegend(true);
  }, [rasterLayerInfo]);

  // ── Sync opacity ────────────────────────────────────────────────────────────
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((l) =>
      l.setOpacity(layerOpacity / 100),
    );
  }, [layerOpacity]);

  // ── Fullscreen update ───────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => mapInstanceRef.current?.updateSize(), 100);
  }, [isFullScreen]);

  const availableYears = rasterResponse
    ? Array.from(new Set(rasterResponse.clipped_rasters.map((r) => r.year))).sort((a, b) => a - b)
    : [];

  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden bg-slate-100 ${isFullScreen ? "fixed inset-0 z-50" : ""}`}>
      <div ref={mapRef} className="flex-1 min-h-0 w-full" />

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={() => setIsFullScreen((f) => !f)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200 text-slate-600 hover:bg-white"
          title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={() => setActivePanel((p) => (p === "basemap" ? null : "basemap"))}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200 text-slate-600 hover:bg-white"
          title="Basemap"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>
        {(legendUrl || legendData) && (
          <button
            onClick={() => setShowLegend((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200 text-slate-600 hover:bg-white"
            title="Toggle legend"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Year selector */}
      {availableYears.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-xl bg-white/90 px-3 py-2 shadow border border-slate-200">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setActiveYear(year)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                activeYear === year ? "bg-green-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Basemap picker */}
      {activePanel === "basemap" && (
        <div className="absolute top-3 right-14 z-20 rounded-xl bg-white shadow-lg border border-slate-200 p-3 flex flex-col gap-1 min-w-[140px]">
          {Object.keys(baseMaps).map((key) => (
            <button
              key={key}
              onClick={() => { setSelectedBaseMap(key); setActivePanel(null); }}
              className={`rounded-lg px-3 py-1.5 text-xs text-left font-medium transition ${
                selectedBaseMap === key ? "bg-green-50 text-green-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      {showLegend && (legendUrl || legendData) && (
        <div className="absolute bottom-14 right-3 z-10 rounded-xl bg-white/95 shadow-lg border border-slate-200 p-3 max-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Legend</span>
            <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
          {legendUrl && <img src={legendUrl} alt="Map legend" className="max-w-full" onError={() => setLegendUrl(null)} />}
          {legendData?.classes && (
            <div className="space-y-1">
              {legendData.classes.map((cls: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: cls.color }} />
                  <span className="text-[10px] text-slate-700 truncate">{cls.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Opacity slider */}
      {rasterResponse && (
        <div className="absolute bottom-4 left-3 z-10 rounded-xl bg-white/90 shadow border border-slate-200 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Opacity</span>
          <input
            type="range" min={10} max={100} value={layerOpacity}
            onChange={(e) => setLayerOpacity(Number(e.target.value))}
            className="w-20 accent-green-600"
          />
          <span className="text-[10px] text-slate-500 w-6">{layerOpacity}%</span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredFeature && (
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />
      )}
    </div>
  );
}
