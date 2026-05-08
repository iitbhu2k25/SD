"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { HoverTooltip, baseMaps } from "@/components/MapComponents";
import { createIndiaMapWithBaseLayer, replaceBaseLayer } from "@/components/map_core/openlayersCommon";
import { attachFullscreenChangeListener, attachPointerMoveTracker, createHoverSelectInteraction, toggleBrowserFullscreen } from "@/components/map_core/interactions";
import BaseMaps from "@/components/dss_common/BaseMaps";
import CloseIcon from "@/components/dss_common/CloseIcon";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import MapLegendOverlay from "@/components/dss_common/MapLegendOverlay";
import { useAdminViewModel } from "../hooks/useAdminViewModel";
import { useUiModeStore } from "../../services/uiModeService";
import MapRasterParameterSelector from "../../components/MapRasterParameterSelector";
import {
  CHART_TO_BACKEND_ATTRIBUTE,
  WQ_PARAMETERS,
} from "../../utils/chartFormatters";
import toast from "react-hot-toast";

// Vector Map dependencies
import VectorLayer from "ol/layer/Vector";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { fromLonLat } from "ol/proj";

const ADMIN_STATE_COLOR = "#2563eb";
const ADMIN_DISTRICT_COLOR = "#7c2d12";
const ADMIN_SUBDISTRICT_COLOR = "#059669";
const RIVER_STRETCH_COLOR = "#0ea5e9";
const getPointCategoryColor = (feature: any) => {
  const location = String(feature.get("Location") || "");
  if (/drain/i.test(location)) return "#f472b6";
  if (/upstream|\bus\b/i.test(location)) return "#3b82f6";
  if (/downstream|\bds\b/i.test(location)) return "#84cc16";
  return "#666666";
};

const getPointCategory = (location: string) => {
  if (/drain/i.test(location)) return "Drain";
  if (/upstream|\bus\b/i.test(location)) return "US";
  if (/downstream|\bds\b/i.test(location)) return "DS";
  return "";
};

const cleanSamplingName = (value: string) =>
  value
    .replace(/\s*\((US|DS|Drain)\)\s*$/i, "")
    .replace(/\s*Drain\s*\((US|DS)\)\s*$/i, "")
    .replace(/\s*(Drain|Upstream|Downstream)\s*$/i, "")
    .trim();

const BACKEND_TO_CHART_ATTRIBUTE = Object.fromEntries(
  Object.entries(CHART_TO_BACKEND_ATTRIBUTE).map(([frontend, backend]) => [
    backend,
    frontend,
  ]),
) as Record<string, string>;

const readNamedFeatures = (geoJson: any) => {
  const features = new GeoJSON().readFeatures(geoJson, { featureProjection: "EPSG:3857" });
  features.forEach((feature) => {
    const location = String(feature.get("Location") || "");
    const pointCategory = getPointCategory(location);
    const samplingName = cleanSamplingName(
      String(
        feature.get("NormalizedSampling") ||
          feature.get("Sampling") ||
          feature.get("name") ||
          "",
      ),
    );
    const displayName =
      samplingName && pointCategory
        ? `${samplingName} - ${pointCategory}`
        : samplingName ||
          feature.get("name") ||
          feature.get("Name") ||
          feature.get("NAME") ||
          feature.get("NormalizedSampling") ||
          feature.get("Sampling") ||
          feature.get("STATE_NAME") ||
          feature.get("State") ||
          feature.get("STATE") ||
          feature.get("Sub_Distri") ||
          feature.get("Sub_District") ||
          feature.get("SUB_DISTRI") ||
          feature.get("SUBDISTRICT") ||
          feature.get("subdistrict_name") ||
          feature.get("DISTRICT") ||
          feature.get("DISTRICT_N") ||
          feature.get("District_Name") ||
          feature.get("District") ||
          feature.get("State_Name") ||
          feature.get("state_name") ||
          feature.get("River_Name") ||
          feature.get("Location");
    if (displayName) feature.set("name", displayName, true);
  });
  return features;
};

export default function AdminOpenLayersMap() {
  const mouseTargetId = useId().replace(/:/g, "-");
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stateLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const districtLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const subDistrictLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverBufferLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const rasterLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  
  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { location, map: mapStore } = useAdminViewModel();
  const {
    waterQualityData,
    indiaBoundary,
    districtBoundaries,
    subDistrictBoundaries,
    riverData,
    riverBufferData,
    selectedState,
    selectedDistricts,
    selectedSubDistricts,
    selectedSeason,
    selectedYear,
  } = location;
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

  // Sync window size
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Vector Feature injection
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old layer
    if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current);
        vectorLayerRef.current = null;
    }

    if (waterQualityData && waterQualityData.features && mapStore.showPoints) {
       const source = new VectorSource({
         features: readNamedFeatures(waterQualityData)
      });

       const layer = new VectorLayer({
         source,
         style: (feature) => {
           const color = getPointCategoryColor(feature);
           
           return new Style({
             image: new Circle({
               radius: 10,
               fill: new Fill({ color: color }),
               stroke: new Stroke({ color: "#fff", width: 2 })
             })
           });
         },
         zIndex: 30
       });

       map.addLayer(layer);
       vectorLayerRef.current = layer;

       // Fit bounds
       if (source.getFeatures().length > 0) {
           const extent = source.getExtent();
           if (extent) {
             map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
           }
       }
    }

  }, [waterQualityData, mapStore.showPoints]);

  // India Boundary layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (indiaLayerRef.current) { map.removeLayer(indiaLayerRef.current); indiaLayerRef.current = null; }
    if (selectedState !== null) return;
    if (!indiaBoundary?.features?.length) return;
    const source = new VectorSource({ features: readNamedFeatures(indiaBoundary) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_STATE_COLOR, width: 1.75 }),
        fill: new Fill({ color: "transparent" }),
      }),
      zIndex: 1,
    });
    map.addLayer(layer);
    indiaLayerRef.current = layer;
  }, [indiaBoundary, selectedState]);

  // District boundary layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (districtLayerRef.current) { map.removeLayer(districtLayerRef.current); districtLayerRef.current = null; }
    if (selectedState === null || selectedDistricts.length > 0) return;
    if (!districtBoundaries?.features?.length) return;
    const source = new VectorSource({ features: readNamedFeatures(districtBoundaries) });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_DISTRICT_COLOR, width: 2 }),
        fill: new Fill({ color: "transparent" }),
      }),
      zIndex: 3,
    });
    map.addLayer(layer);
    districtLayerRef.current = layer;
    const extent = source.getExtent();
    if (extent) {
      map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600 });
    }
  }, [districtBoundaries, selectedDistricts.length, selectedState]);

  // Sub-district boundary layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (subDistrictLayerRef.current) {
      map.removeLayer(subDistrictLayerRef.current);
      subDistrictLayerRef.current = null;
    }
    if (selectedDistricts.length === 0) return;
    if (!subDistrictBoundaries?.features?.length || !mapStore.showSubDistrictBoundaries) return;
    const source = new VectorSource({
      features: readNamedFeatures(subDistrictBoundaries),
    });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_SUBDISTRICT_COLOR, width: 2 }),
        fill: new Fill({ color: "transparent" }),
      }),
      zIndex: 4,
    });
    map.addLayer(layer);
    subDistrictLayerRef.current = layer;
    const extent = source.getExtent();
    if (extent) {
      map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 600 });
    }
  }, [selectedDistricts.length, subDistrictBoundaries, mapStore.showSubDistrictBoundaries]);

  // River buffer layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (riverBufferLayerRef.current) {
      map.removeLayer(riverBufferLayerRef.current);
      riverBufferLayerRef.current = null;
    }
    if (!riverBufferData?.features?.length || !mapStore.showRiverBuffer) return;
    const source = new VectorSource({
      features: readNamedFeatures(riverBufferData),
    });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: ADMIN_DISTRICT_COLOR, width: 2 }),
        fill: new Fill({ color: "rgba(124, 45, 18, 0.12)" }),
      }),
      zIndex: 19,
    });
    map.addLayer(layer);
    riverBufferLayerRef.current = layer;
  }, [riverBufferData, mapStore.showRiverBuffer]);

  // River line layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (riverLayerRef.current) {
      map.removeLayer(riverLayerRef.current);
      riverLayerRef.current = null;
    }
    if (!riverData?.features?.length || !mapStore.showRiver) return;
    const source = new VectorSource({
      features: readNamedFeatures(riverData),
    });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({
          color: RIVER_STRETCH_COLOR,
          width: 3,
          lineDash: [2, 8],
          lineCap: "round",
        }),
      }),
      zIndex: 20,
    });
    map.addLayer(layer);
    riverLayerRef.current = layer;
  }, [riverData, mapStore.showRiver]);

  // Interpolation WMS layer
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

  const toggleFullScreen = () => toggleBrowserFullscreen(containerRef.current, isFullScreen);
  const togglePanel = (panelName: string) => setActivePanel(activePanel === panelName ? null : panelName);
  const selectedRasterAttribute =
    mapStore.currentInterpolationAttribute
      ? BACKEND_TO_CHART_ATTRIBUTE[mapStore.currentInterpolationAttribute] ||
        mapStore.currentInterpolationAttribute
      : null;
  const canGenerateRaster =
    location.areaConfirmed &&
    selectedSubDistricts.length > 0 &&
    selectedSeason !== "" &&
    selectedYear !== "" &&
    Boolean(riverData) &&
    Boolean(riverBufferData) &&
    Boolean(waterQualityData);

  const rasterSelectionKey = [
    location.areaConfirmed ? "confirmed" : "editing",
    selectedSubDistricts.join(","),
    selectedSeason,
    selectedYear,
  ].join("|");
  const previousRasterSelectionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousRasterSelectionKeyRef.current === null) {
      previousRasterSelectionKeyRef.current = rasterSelectionKey;
      return;
    }
    if (previousRasterSelectionKeyRef.current !== rasterSelectionKey) {
      mapStore.clearInterpolation();
      previousRasterSelectionKeyRef.current = rasterSelectionKey;
    }
  }, [mapStore, rasterSelectionKey]);

  const handleRasterAttributeChange = async (attributeKey: string) => {
    if (!canGenerateRaster || mapStore.isMapLayersLoading) return;

    const parameterLabel =
      WQ_PARAMETERS.find((param) => param.key === attributeKey)?.label || attributeKey;

    if (mapStore.generatedRasterLayers[attributeKey]) {
      mapStore.setActiveRasterAttribute(attributeKey);
      return;
    }

    if (Object.keys(mapStore.generatedRasterLayers).length > 0) {
      toast.error(`${parameterLabel} raster is unavailable for this selection.`);
      mapStore.setActiveRasterAttribute(attributeKey);
      return;
    }

    try {
      const layers = await mapStore.runBatchInterpolation({
        season: selectedSeason,
        subDistrictCodes: selectedSubDistricts,
        riverData,
        riverBufferData,
        pointsData: waterQualityData,
      });

      if (!layers[attributeKey]) {
        toast.error(`${parameterLabel} raster is unavailable for this selection.`);
        return;
      }

      mapStore.setActiveRasterAttribute(attributeKey);
      toast.success("Raster layers generated.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate raster layers.");
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
      label: "Sub-District Boundaries",
      swatch: <div className="h-4 w-4 border-2 border-[#059669]" />,
      visible: mapStore.showSubDistrictBoundaries,
      onToggle: () => mapStore.setShowSubDistrictBoundaries(!mapStore.showSubDistrictBoundaries),
    },
    {
      label: "Rivers",
      swatch: <div className="h-1 w-4 bg-[#1e3a8a]" />,
      visible: mapStore.showRiver,
      onToggle: () => mapStore.setShowRiver(!mapStore.showRiver),
    },
    {
      label: "River Buffer",
      swatch: <div className="h-4 w-4 border border-[#7c2d12] bg-[#7c2d12]/15" />,
      visible: mapStore.showRiverBuffer,
      onToggle: () => mapStore.setShowRiverBuffer(!mapStore.showRiverBuffer),
    },
  ];

  const changeBaseMap = (baseMapKey: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const didReplace = replaceBaseLayer({
      map,
      baseLayerRef,
      baseMapKey,
      baseMaps,
    });
    if (didReplace) setSelectedBaseMap(baseMapKey);
  };

  const fitLayer = (layer: VectorLayer<VectorSource> | null, maxZoom = 13) => {
    const map = mapInstanceRef.current;
    const source = layer?.getSource();
    if (!map || !source) return false;
    const extent = source.getExtent();
    if (!extent || !extent.every((coord) => Number.isFinite(coord))) return false;
    map.getView().fit(extent, {
      padding: [60, 60, 60, 60],
      duration: 600,
      maxZoom,
    });
    return true;
  };

  const goToHomeView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (fitLayer(vectorLayerRef.current, 14)) return;
    if (fitLayer(riverBufferLayerRef.current, 13)) return;
    if (fitLayer(riverLayerRef.current, 13)) return;
    if (fitLayer(subDistrictLayerRef.current, 12)) return;
    if (fitLayer(districtLayerRef.current, 10)) return;
    if (fitLayer(indiaLayerRef.current, 5)) return;
    map.getView().animate({
      center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
      zoom: INITIAL_ZOOM,
      duration: 400,
    });
  };

  const renderLayerPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className={`rounded-xl border p-3 shadow-2xl backdrop-blur-md ${
        isDark ? "border-[#1e3a5f]/70 bg-[#080e1c]/95 text-slate-100" : "border-white/50 bg-white/20 text-slate-800"
      }`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Map Layers</h3>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className={`rounded-full p-1 transition ${
              isDark ? "bg-slate-800 hover:bg-red-950/60 hover:text-red-300" : "bg-slate-300 text-white hover:bg-red-100 hover:text-red-600"
            }`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {layerItems.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border p-3 ${
                item.visible
                  ? isDark
                    ? "border-cyan-500/25 bg-cyan-500/10"
                    : "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                  : isDark
                    ? "border-slate-700 bg-slate-900/60"
                    : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center">
                  <div className="mr-3 shrink-0">{item.swatch}</div>
                  <div className="min-w-0">
                    <div className={`truncate text-sm font-semibold ${item.disabled ? "opacity-50" : ""}`}>
                      {item.label}
                    </div>
                    <div className="text-xs opacity-60">
                      {item.disabled ? "Unavailable" : item.visible ? "Visible" : "Hidden"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={item.onToggle}
                  className={`relative h-5 w-10 shrink-0 rounded-full transition-all duration-300 ${
                    item.disabled
                      ? "cursor-not-allowed bg-gray-300 opacity-50"
                      : item.visible
                        ? "bg-blue-500"
                        : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                      item.visible ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderToolsPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className={`rounded-xl border p-3 shadow-2xl backdrop-blur-md ${
        isDark ? "border-[#1e3a5f]/70 bg-[#080e1c]/95 text-slate-100" : "border-white/50 bg-white/20 text-slate-800"
      }`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Map Tools</h3>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className={`rounded-full p-1 transition ${
              isDark ? "bg-slate-800 hover:bg-red-950/60 hover:text-red-300" : "bg-slate-300 text-white hover:bg-red-100 hover:text-red-600"
            }`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${
            isDark ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white/70"
          }`}>
            <div>
              <div className="font-medium">Home View</div>
              <div className="text-xs opacity-60">Zoom to current map data</div>
            </div>
            <button
              type="button"
              onClick={goToHomeView}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isDark ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              Reset
            </button>
          </div>

          <div className={`rounded-xl border px-3 py-3 text-sm ${
            isDark ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white/70"
          }`}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Raster Opacity</div>
                <div className="text-xs opacity-60">
                  {mapStore.activeRasterLayer ? mapStore.activeRasterLayer : "Generate a raster first"}
                </div>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                isDark ? "bg-slate-800" : "bg-gray-100"
              }`}>
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
              disabled={!mapStore.activeRasterLayer}
            />
          </div>

          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${
            isDark ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white/70"
          }`}>
            <div>
              <div className="font-medium">Legend</div>
              <div className="text-xs opacity-60">Show raster legend</div>
            </div>
            <button
              type="button"
              disabled={!mapStore.activeRasterLayer}
              onClick={() => mapStore.setShowLegend(!mapStore.showLegend)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                !mapStore.activeRasterLayer
                  ? "cursor-not-allowed opacity-50"
                  : isDark
                    ? "border-slate-600 bg-slate-800 hover:bg-slate-700"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {mapStore.showLegend ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="button"
            disabled={!mapStore.activeRasterLayer}
            onClick={mapStore.clearInterpolation}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              mapStore.activeRasterLayer
                ? isDark
                  ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
            }`}
          >
            Clear Raster
          </button>
        </div>
      </div>
    </div>
  );

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
          onChangeBaseMap={changeBaseMap}
          onClose={() => setActivePanel(null)}
        />
      )}

      {activePanel === "layers" && renderLayerPanel()}
      {activePanel === "tools" && renderToolsPanel()}

      <MapLegendOverlay
        legendUrl={legendUrl}
        showLegend={mapStore.showLegend}
        hasActiveRaster={Boolean(mapStore.activeRasterLayer && mapStore.showInterpolation)}
        onShowLegend={() => mapStore.setShowLegend(true)}
        onHideLegend={() => mapStore.setShowLegend(false)}
      />

      <MapCoordinatesOverlay targetId={mouseTargetId} />
    </div>
  );
}
