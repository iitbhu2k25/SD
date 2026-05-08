"use client";

// Admin OpenLayers map engine for water_v2.
// Ported from water/admin/components/openlayer.tsx.
// Reads from adminMapStore and adminLocationStore (Zustand) — no React Context.
import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke } from "ol/style";
import { fromLonLat, transformExtent } from "ol/proj";
import {
  defaults as defaultControls,
  ScaleLine,
  ZoomSlider,
} from "ol/control";
import { INDIA_CENTER } from "@/interface/openlayer";
import { baseMaps, HoverTooltip } from "@/components/MapComponents";
// @ts-ignore — OL CSS has no TS declarations
import "ol/ol.css";

import { useAdminMapStore } from "../stores/adminMapStore";
import { useAdminLocationStore } from "../stores/adminLocationStore";

const GEOSERVER_WFS_BASE =
  "/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsname=EPSG:3857";
const WORKSPACE = "dss_vector";
const VECTOR_Z = {
  indiaBoundary: 30,
  selectedBoundary: 31,
} as const;

function wfsUrl(typeName: string, cqlFilter?: string) {
  let url = `${GEOSERVER_WFS_BASE}&typeName=${WORKSPACE}:${typeName}`;
  if (cqlFilter) url += `&CQL_FILTER=${encodeURIComponent(cqlFilter)}`;
  return url;
}

function boundaryStyle(highlight: boolean) {
  if (highlight) {
    return [
      new Style({
        stroke: new Stroke({ color: "rgba(15, 23, 42, 0.92)", width: 3.6 }),
      }),
      new Style({
        fill: new Fill({ color: "rgba(14, 165, 233, 0.10)" }),
        stroke: new Stroke({ color: "#0284C7", width: 2.2 }),
      }),
    ];
  }

  return [
    new Style({
      stroke: new Stroke({ color: "rgba(255, 255, 255, 0.98)", width: 2.8 }),
    }),
    new Style({
      fill: new Fill({ color: "rgba(59, 130, 246, 0.045)" }),
      stroke: new Stroke({ color: "#2563EB", width: 1.55 }),
    }),
  ];
}

const GEOSERVER_WMS_URL = "/geoserver/wms";

function buildLegendUrl(workspace: string, layerName: string, style: string) {
  return (
    `${GEOSERVER_WMS_URL}?REQUEST=GetLegendGraphic&VERSION=1.0.0` +
    `&FORMAT=image/png&WIDTH=20&HEIGHT=20` +
    `&LAYER=${workspace}:${layerName}&STYLE=${style}` +
    `&LEGEND_OPTIONS=forceLabels:on;fontName:Arial;fontSize:12;fontAntiAliasing:true`
  );
}

export default function AdminOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const primaryVectorRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryVectorRef = useRef<VectorLayer<VectorSource> | null>(null);
  const clippedRasterLayersRef = useRef<Record<string, ImageLayer<any>>>({});
  const hoveredFeatureRef = useRef<any>(null);
  const pendingMousePositionRef = useRef({ x: 0, y: 0 });
  const mouseFrameRef = useRef<number | null>(null);

  // Local UI state (valid as map-local per standard)
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("osm");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [legendData, setLegendData] = useState<any>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [layerOpacity, setLayerOpacity] = useState(75);

  // Store reads
  const rasterLayerInfo = useAdminMapStore((s) => s.rasterLayerInfo);
  const rasterResponse = useAdminMapStore((s) => s.rasterResponse);
  const activeYear = useAdminMapStore((s) => s.activeYear);
  const setActiveYear = useAdminMapStore((s) => s.setActiveYear);
  const selectionsLocked = useAdminLocationStore((s) => s.selectionsLocked);
  const selectedState = useAdminLocationStore((s) => s.selectedState);
  const selectedDistricts = useAdminLocationStore((s) => s.selectedDistricts);
  const selectedSubDistricts = useAdminLocationStore((s) => s.selectedSubDistricts);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const baseLayer = new TileLayer({
      source: baseMaps["osm"].source(),
      zIndex: 0,
    });
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

    // OL reads container dimensions at init; flex layout may not have settled yet.
    // Use ResizeObserver so updateSize() fires once the container has real dimensions.
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(mapRef.current!);

    setIsLoading(false);

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
    };
  }, []);

  // ── Basemap switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!baseLayerRef.current) return;
    const def = baseMaps[selectedBaseMap] ?? baseMaps["osm"];
    baseLayerRef.current.setSource(def.source());
  }, [selectedBaseMap]);

  // ── Primary boundary layer: always show full India states outline ───────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const source = new VectorSource({
      format: new GeoJSON(),
      url: wfsUrl("STP_State"),
    });
    const layer = new VectorLayer({
      source,
      style: boundaryStyle(false),
      zIndex: VECTOR_Z.indiaBoundary,
    });
    map.addLayer(layer);
    primaryVectorRef.current = layer;

    return () => {
      map.removeLayer(layer);
      primaryVectorRef.current = null;
    };
  }, []);

  // ── Secondary boundary layer: zoom to selection (district / sub-district) ───
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove the previous secondary layer
    if (secondaryVectorRef.current) {
      map.removeLayer(secondaryVectorRef.current);
      secondaryVectorRef.current = null;
    }

    let typeName: string | null = null;
    let cqlFilter: string | null = null;

    if (selectedSubDistricts.length > 0) {
      typeName = "STP_subdistrict";
      cqlFilter = `subdis_cod IN (${selectedSubDistricts.join(",")})`;
    } else if (selectedDistricts.length > 0) {
      typeName = "STP_district";
      cqlFilter = `district_c IN (${selectedDistricts.join(",")})`;
    } else if (selectedState !== null) {
      typeName = "STP_State";
      cqlFilter = `State_Code IN (${selectedState})`;
    }

    if (!typeName) return;

    const source = new VectorSource({
      format: new GeoJSON(),
      url: wfsUrl(typeName, cqlFilter ?? undefined),
    });
    const layer = new VectorLayer({
      source,
      style: boundaryStyle(true),
      zIndex: VECTOR_Z.selectedBoundary,
    });

    source.on("featuresloadend", () => {
      const extent = source.getExtent();
      if (extent && extent.every(isFinite)) {
        mapInstanceRef.current
          ?.getView()
          .fit(extent, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 800 });
      }
    });

    map.addLayer(layer);
    secondaryVectorRef.current = layer;

    return () => {
      map.removeLayer(layer);
      secondaryVectorRef.current = null;
    };
  }, [selectedState, selectedDistricts, selectedSubDistricts]);

  // Keep vector boundaries subtle when raster is visible.
  useEffect(() => {
    const hasRaster = Boolean(rasterResponse?.clipped_rasters?.length);

    if (primaryVectorRef.current) {
      primaryVectorRef.current.setStyle(boundaryStyle(false));
      primaryVectorRef.current.setOpacity(hasRaster ? 0.45 : 1);
    }

    if (secondaryVectorRef.current) {
      secondaryVectorRef.current.setStyle(boundaryStyle(true));
      secondaryVectorRef.current.setOpacity(hasRaster ? 0.65 : 1);
    }
  }, [rasterResponse]);

  // ── Load raster layers when rasterResponse changes ─────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing clipped raster layers
    Object.values(clippedRasterLayersRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    clippedRasterLayersRef.current = {};

    if (!rasterResponse?.clipped_rasters?.length) return;

    let bboxToFit: number[] | null = null;

    rasterResponse.clipped_rasters.forEach((raster, index) => {
      const { layer_name, workspace, style, original_name, year, season, layer_type, bbox } =
        raster;

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
        zIndex: 5 + index,
        opacity: layerOpacity / 100,
        visible: true,
        properties: {
          name: original_name,
          type: "clipped-raster",
          workspace,
          layerName: layer_name,
          style,
          layer_type,
          year,
          season,
        },
      });

      map.addLayer(layer);
      clippedRasterLayersRef.current[`clipped_${layer_name}`] = layer;

      // Capture bbox from the last raster (most likely to have it)
      if (bbox && bbox.length === 4) bboxToFit = bbox;
    });

    // Zoom to the raster's bounding box so the user sees the selected region
    // Use larger padding to keep a slightly zoomed-out view on confirm
    if (bboxToFit) {
      const extent = transformExtent(bboxToFit as number[], "EPSG:4326", "EPSG:3857");
      map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 10, duration: 600 });
    }

    // After fitting, honour the active-year visibility
    Object.values(clippedRasterLayersRef.current).forEach((layer) => {
      const props = layer.getProperties();
      layer.setVisible(props.year === activeYear || activeYear === null);
    });
  }, [rasterResponse]);

  // ── Show only the active year's layer ──────────────────────────────────────
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((layer) => {
      const props = layer.getProperties();
      layer.setVisible(props.year === activeYear);
    });
  }, [activeYear]);

  // ── Update legend when active raster changes ────────────────────────────────
  useEffect(() => {
    if (!rasterLayerInfo) {
      setLegendUrl(null);
      setLegendData(null);
      return;
    }
    const { workspace, layer_name, style, legend_data } = rasterLayerInfo;
    if (legend_data) {
      setLegendData(legend_data);
      setLegendUrl(null);
    } else {
      setLegendUrl(buildLegendUrl(workspace, layer_name, style));
      setLegendData(null);
    }
    setShowLegend(true);
  }, [rasterLayerInfo]);

  // ── Sync opacity ────────────────────────────────────────────────────────────
  useEffect(() => {
    Object.values(clippedRasterLayersRef.current).forEach((layer) => {
      layer.setOpacity(layerOpacity / 100);
    });
  }, [layerOpacity]);

  // ── Reset map when selections are cleared ───────────────────────────────────
  useEffect(() => {
    if (!selectionsLocked && !rasterResponse) {
      const map = mapInstanceRef.current;
      if (map) {
        map.getView().animate({
          center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
          zoom: 4.8,
          duration: 300,
        });
      }
    }
  }, [selectionsLocked, rasterResponse]);

  // ── Fullscreen toggle ───────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => mapInstanceRef.current?.updateSize(), 100);
  }, [isFullScreen]);

  const availableYears = rasterResponse
    ? Array.from(new Set(rasterResponse.clipped_rasters.map((r) => r.year))).sort(
        (a, b) => a - b,
      )
    : [];

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden bg-slate-100 ${
        isFullScreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      )}

      <div ref={mapRef} className="flex-1 min-h-0 w-full" />

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Fullscreen */}
        <button
          onClick={() => setIsFullScreen((f) => !f)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200 text-slate-600 hover:bg-white"
          title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullScreen ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0M4 4l0 5M15 9l5-5m0 0l-5 0m5 0l0 5M9 15l-5 5m0 0l5 0m-5 0l0-5M15 15l5 5m0 0l-5 0m5 0l0-5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>

        {/* Basemap toggle */}
        <button
          onClick={() => setActivePanel((p) => (p === "basemap" ? null : "basemap"))}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow border border-slate-200 text-slate-600 hover:bg-white"
          title="Basemap"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>

        {/* Legend toggle */}
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
                activeYear === year
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Basemap panel */}
      {activePanel === "basemap" && (
        <div className="absolute top-3 right-14 z-20 rounded-xl bg-white shadow-lg border border-slate-200 p-3 flex flex-col gap-1 min-w-[140px]">
          {Object.keys(baseMaps).map((key) => (
            <button
              key={key}
              onClick={() => {
                setSelectedBaseMap(key);
                setActivePanel(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs text-left font-medium transition ${
                selectedBaseMap === key
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
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
            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
          {legendUrl && (
            <img
              src={legendUrl}
              alt="Map legend"
              className="max-w-full"
              onError={() => setLegendUrl(null)}
            />
          )}
          {legendData?.classes && (
            <div className="space-y-1">
              {legendData.classes.map((cls: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: cls.color }}
                  />
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
            type="range"
            min={10}
            max={100}
            value={layerOpacity}
            onChange={(e) => setLayerOpacity(Number(e.target.value))}
            className="w-20 accent-blue-600"
          />
          <span className="text-[10px] text-slate-500 w-6">{layerOpacity}%</span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredFeature && (
        <HoverTooltip
          hoveredFeature={hoveredFeature}
          mousePosition={mousePosition}
        />
      )}
    </div>
  );
}
