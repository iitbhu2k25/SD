"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { HoverTooltip, baseMaps } from "@/components/MapComponents";
import {
  createIndiaMapWithBaseLayer,
  replaceBaseLayer,
} from "@/components/map_core/openlayersCommon";
import {
  attachFullscreenChangeListener,
  attachPointerMoveTracker,
  createHoverSelectInteraction,
  toggleBrowserFullscreen,
} from "@/components/map_core/interactions";
import BaseMaps from "@/components/dss_common/BaseMaps";
import CloseIcon from "@/components/dss_common/CloseIcon";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import MapLegendOverlay from "@/components/dss_common/MapLegendOverlay";
import { useDrainViewModel } from "../hooks/useDrainViewModel";
import { useUiModeStore } from "../../services/uiModeService";
import { fetchAdminIndiaBoundary } from "../../services/rwmRiverApi";
import MapRasterParameterSelector from "../../components/MapRasterParameterSelector";
import {
  CHART_TO_BACKEND_ATTRIBUTE,
  WQ_PARAMETERS,
} from "../../utils/chartFormatters";
import toast from "react-hot-toast";

import VectorLayer from "ol/layer/Vector";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Circle, Fill, Stroke, Style } from "ol/style";

const ADMIN_PRIMARY_COLOR = "#2563eb";
const ADMIN_SELECTION_COLOR = "#7c2d12";
const BACKEND_TO_CHART_ATTRIBUTE = Object.fromEntries(
  Object.entries(CHART_TO_BACKEND_ATTRIBUTE).map(([frontend, backend]) => [
    backend,
    frontend,
  ]),
) as Record<string, string>;

const readNamedFeatures = (geoJson: any) => {
  const features = new GeoJSON().readFeatures(geoJson, {
    featureProjection: "EPSG:3857",
  });
  features.forEach((feature) => {
    const displayName =
      feature.get("name") ||
      feature.get("Name") ||
      feature.get("NAME") ||
      feature.get("NormalizedSampling") ||
      feature.get("Sampling") ||
      feature.get("Stretch_Name") ||
      feature.get("Stretch_Na") ||
      feature.get("River_Name") ||
      feature.get("Basin_Name") ||
      feature.get("Location");
    if (displayName) feature.set("name", displayName, true);
  });
  return features;
};

export default function DrainOpenLayersMap() {
  const mouseTargetId = useId().replace(/:/g, "-");
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const basinLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchLinesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchBufferLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const pointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const rasterLayerRef = useRef<TileLayer<TileWMS> | null>(null);

  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [indiaBoundaryData, setIndiaBoundaryData] = useState<any>(null);

  const { location, map: mapStore } = useDrainViewModel();
  const {
    waterQualityData,
    stretchLinesData,
    stretchBufferData,
    selectedStretches,
    selectedSeason,
    selectedYear,
    areaConfirmed,
  } = location;
  const { basinData, riverData } = mapStore;
  const isDark = useUiModeStore((s) => s.isDark);

  useEffect(() => {
    if (!mapRef.current) return;

    const { map, baseLayer } = createIndiaMapWithBaseLayer({
      target: mapRef.current,
      mouseTargetId,
      baseMaps,
      defaultBaseMapKey: "terrain",
      center: INDIA_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 18,
    });
    baseLayerRef.current = baseLayer;

    const hoverInteraction = createHoverSelectInteraction((event) => {
      setHoveredFeature(event.selected[0] ?? null);
    });

    const cleanupMouseTracking = attachPointerMoveTracker(map, setMousePosition);
    map.addInteraction(hoverInteraction);
    mapInstanceRef.current = map;

    return () => {
      cleanupMouseTracking();
      map.setTarget("");
    };
  }, [mouseTargetId]);

  useEffect(() => {
    fetchAdminIndiaBoundary()
      .then(setIndiaBoundaryData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (indiaLayerRef.current) {
      map.removeLayer(indiaLayerRef.current);
      indiaLayerRef.current = null;
    }
    if (!indiaBoundaryData?.features?.length) return;
    const source = new VectorSource({ features: readNamedFeatures(indiaBoundaryData) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_PRIMARY_COLOR, width: 1.75 }),
      }),
      zIndex: 1,
    });
    map.addLayer(layer);
    indiaLayerRef.current = layer;
  }, [indiaBoundaryData]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (basinLayerRef.current) {
      map.removeLayer(basinLayerRef.current);
      basinLayerRef.current = null;
    }
    if (!basinData?.features?.length || !mapStore.showBasin) return;
    const source = new VectorSource({ features: readNamedFeatures(basinData) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#8b5cf6", width: 2 }),
        fill: new Fill({ color: "rgba(139,92,246,0.03)" }),
      }),
      zIndex: 2,
    });
    map.addLayer(layer);
    basinLayerRef.current = layer;
  }, [basinData, mapStore.showBasin]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (riverLayerRef.current) {
      map.removeLayer(riverLayerRef.current);
      riverLayerRef.current = null;
    }
    if (!riverData?.features?.length || !mapStore.showRiver) return;
    const source = new VectorSource({ features: readNamedFeatures(riverData) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#22c55e", width: 2.5 }),
      }),
      zIndex: 3,
    });
    map.addLayer(layer);
    riverLayerRef.current = layer;
  }, [riverData, mapStore.showRiver]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (stretchBufferLayerRef.current) {
      map.removeLayer(stretchBufferLayerRef.current);
      stretchBufferLayerRef.current = null;
    }
    if (!stretchBufferData?.features?.length || !mapStore.showStretchBuffer) return;
    const source = new VectorSource({ features: readNamedFeatures(stretchBufferData) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_SELECTION_COLOR, width: 2 }),
        fill: new Fill({ color: "rgba(124, 45, 18, 0.12)" }),
      }),
      zIndex: 4,
    });
    map.addLayer(layer);
    stretchBufferLayerRef.current = layer;
  }, [stretchBufferData, mapStore.showStretchBuffer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (stretchLinesLayerRef.current) {
      map.removeLayer(stretchLinesLayerRef.current);
      stretchLinesLayerRef.current = null;
    }
    if (!stretchLinesData?.features?.length || !mapStore.showStretchLines) return;
    const source = new VectorSource({ features: readNamedFeatures(stretchLinesData) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_SELECTION_COLOR, width: 4 }),
      }),
      zIndex: 7,
    });
    map.addLayer(layer);
    stretchLinesLayerRef.current = layer;
    const extent = source.getExtent();
    if (extent) {
      map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 800 });
    }
  }, [stretchLinesData, mapStore.showStretchLines]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (pointsLayerRef.current) {
      map.removeLayer(pointsLayerRef.current);
      pointsLayerRef.current = null;
    }
    if (!waterQualityData?.features?.length || !mapStore.showPoints) return;
    const source = new VectorSource({ features: readNamedFeatures(waterQualityData) });
    const layer = new VectorLayer({
      source,
      style: (feature) => {
        const wqiClass = feature.get("WQI_Class");
        let color = "#3b82f6";
        if (wqiClass === "Excellent") color = "#22c55e";
        if (wqiClass === "Good") color = "#84cc16";
        if (wqiClass === "Poor") color = "#f97316";
        if (wqiClass === "Very Poor") color = "#ef4444";

        return new Style({
          image: new Circle({
            radius: 7,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#fff", width: 2 }),
          }),
        });
      },
      zIndex: 30,
    });
    map.addLayer(layer);
    pointsLayerRef.current = layer;
  }, [waterQualityData, mapStore.showPoints]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (rasterLayerRef.current) {
      map.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
    }

    if (!mapStore.activeRasterLayer || !mapStore.showInterpolation) return;

    const layerName = mapStore.activeRasterLayer;
    const [workspace, bareLayerName] = layerName.includes(":")
      ? layerName.split(":", 2)
      : ["myworkspace", layerName];

    const wmsSource = new TileWMS({
      url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://localhost:8080/geoserver"}/${workspace}/wms`,
      params: {
        LAYERS: `${workspace}:${bareLayerName}`,
        TILED: true,
      },
      serverType: "geoserver",
      transition: 0,
    });

    const rasterLayer = new TileLayer({
      source: wmsSource,
      opacity: mapStore.opacity / 100,
      zIndex: 25,
    });

    map.addLayer(rasterLayer);
    rasterLayerRef.current = rasterLayer;
  }, [mapStore.activeRasterLayer, mapStore.opacity, mapStore.showInterpolation]);

  const legendUrl = useMemo(() => {
    if (!mapStore.activeRasterLayer) return null;
    const layerName = mapStore.activeRasterLayer;
    const [workspace, bareLayerName] = layerName.includes(":")
      ? layerName.split(":", 2)
      : ["myworkspace", layerName];
    const geoserverUrl =
      process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://localhost:8080/geoserver";
    const fullLayerName = `${workspace}:${bareLayerName}`;
    return `${geoserverUrl}/${workspace}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${encodeURIComponent(fullLayerName)}&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000;bgColor:0xFFFFFF;dpi:96`;
  }, [mapStore.activeRasterLayer]);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);

  const toggleFullScreen = () =>
    toggleBrowserFullscreen(containerRef.current, isFullScreen);
  const togglePanel = (panelName: string) =>
    setActivePanel(activePanel === panelName ? null : panelName);
  const selectedRasterAttribute =
    mapStore.currentInterpolationAttribute
      ? BACKEND_TO_CHART_ATTRIBUTE[mapStore.currentInterpolationAttribute] ||
        mapStore.currentInterpolationAttribute
      : null;
  const canGenerateRaster =
    areaConfirmed &&
    selectedStretches.length > 0 &&
    selectedSeason !== "" &&
    selectedYear !== "" &&
    Boolean(waterQualityData?.features?.length);

  const handleRasterAttributeChange = async (attributeKey: string) => {
    if (!canGenerateRaster || mapStore.isMapLayersLoading) return;

    const backendAttribute =
      CHART_TO_BACKEND_ATTRIBUTE[attributeKey] || attributeKey;

    try {
      await mapStore.runInterpolation({
        attribute: backendAttribute,
        season: selectedSeason,
        stretchIds: selectedStretches,
        pointsData: waterQualityData,
      });
      toast.success(
        `${WQ_PARAMETERS.find((param) => param.key === attributeKey)?.label || attributeKey} raster generated.`,
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate raster.");
    }
  };

  const layerItems = [
    {
      label: mapStore.currentInterpolationAttribute
        ? `${mapStore.currentInterpolationAttribute} Interpolation`
        : "Interpolation",
      swatch: <div className="h-4 w-4 bg-gradient-to-r from-blue-500 to-red-500" />,
      visible: mapStore.showInterpolation,
      disabled: !mapStore.activeRasterLayer,
      onToggle: () => mapStore.setShowInterpolation(!mapStore.showInterpolation),
    },
    {
      label: "Water Quality Points",
      swatch: <div className="h-4 w-4 rounded-full bg-blue-500" />,
      visible: mapStore.showPoints,
      onToggle: () => mapStore.setShowPoints(!mapStore.showPoints),
    },
    {
      label: "Stretch Lines",
      swatch: <div className="h-1 w-4 bg-[#7c2d12]" />,
      visible: mapStore.showStretchLines,
      onToggle: () => mapStore.setShowStretchLines(!mapStore.showStretchLines),
    },
    {
      label: "Stretch Buffer",
      swatch: <div className="h-4 w-4 border border-[#7c2d12] bg-[#7c2d12]/15" />,
      visible: mapStore.showStretchBuffer,
      onToggle: () => mapStore.setShowStretchBuffer(!mapStore.showStretchBuffer),
    },
    {
      label: "Basin Boundary",
      swatch: <div className="h-4 w-4 border-2 border-violet-500 bg-violet-100/60" />,
      visible: mapStore.showBasin,
      onToggle: () => mapStore.setShowBasin(!mapStore.showBasin),
    },
    {
      label: "Rivers",
      swatch: <div className="h-1 w-4 bg-green-500" />,
      visible: mapStore.showRiver,
      onToggle: () => mapStore.setShowRiver(!mapStore.showRiver),
    },
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      <div ref={mapRef} className="h-full w-full" />
      <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

      <MapHeaderControls
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        onToggleFullScreen={toggleFullScreen}
        isFullScreen={isFullScreen}
      />

      <MapRasterParameterSelector
        selectedAttribute={selectedRasterAttribute}
        onAttributeChange={handleRasterAttributeChange}
        disabled={!canGenerateRaster}
        isLoading={mapStore.isMapLayersLoading}
        error={mapStore.interpolationError}
        isDark={isDark}
      />

      {activePanel === "basemap" && (
        <BaseMaps
          baseMaps={baseMaps}
          selectedBaseMap={selectedBaseMap}
          onChangeBaseMap={(b) => {
            replaceBaseLayer({
              map: mapInstanceRef.current!,
              baseLayerRef,
              baseMapKey: b,
              baseMaps,
            });
            setSelectedBaseMap(b);
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === "layers" && (
        <div
          className={`absolute left-4 top-20 z-20 w-72 rounded-xl border shadow-xl ${
            isDark
              ? "border-[#1e3a5f]/70 bg-[#080e1c]/95 text-slate-100"
              : "border-stone-200 bg-white/95 text-slate-800"
          }`}
        >
          <div
            className={`flex items-center justify-between border-b px-4 py-3 ${
              isDark ? "border-[#1e3a5f]/60" : "border-stone-200"
            }`}
          >
            <h3 className="text-sm font-semibold">Map Layers</h3>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className={`rounded-full p-1 transition ${
                isDark ? "hover:bg-[#12233f]" : "hover:bg-stone-100"
              }`}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2 p-3">
            {layerItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between rounded-lg px-2 py-2 ${
                  isDark ? "hover:bg-[#0f1d34]" : "hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.swatch}
                  <span className={`text-sm ${item.disabled ? "opacity-50" : ""}`}>
                    {item.label}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={item.onToggle}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    item.disabled
                      ? isDark
                        ? "cursor-not-allowed bg-slate-800/60 text-slate-500"
                        : "cursor-not-allowed bg-stone-200/80 text-stone-400"
                      : item.visible
                        ? isDark
                          ? "bg-cyan-500/15 text-cyan-300"
                          : "bg-blue-100 text-blue-700"
                        : isDark
                          ? "bg-slate-700/50 text-slate-300"
                          : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {item.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}

            {mapStore.activeRasterLayer && (
              <div
                className={`mt-3 rounded-lg border p-3 ${
                  isDark
                    ? "border-[#1e3a5f]/60 bg-[#0b1527]"
                    : "border-stone-200 bg-stone-50/80"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Interpolation Opacity</span>
                  <span className="text-xs font-semibold">
                    {Math.round(mapStore.opacity)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={mapStore.opacity}
                  onChange={(event) => mapStore.setOpacity(Number(event.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <MapLegendOverlay
        legendUrl={legendUrl}
        showLegend={mapStore.showLegend}
        hasActiveRaster={Boolean(mapStore.activeRasterLayer && mapStore.showInterpolation)}
        onShowLegend={() => mapStore.setShowLegend(true)}
        onHideLegend={() => mapStore.setShowLegend(false)}
        title="Interpolation Legend"
      />

      <MapCoordinatesOverlay targetId={mouseTargetId} />
    </div>
  );
}
