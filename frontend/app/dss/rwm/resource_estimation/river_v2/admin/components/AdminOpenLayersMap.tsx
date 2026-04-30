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

const ADMIN_STATE_COLOR = "#2563eb";
const ADMIN_DISTRICT_COLOR = "#7c2d12";
const ADMIN_SUBDISTRICT_COLOR = "#059669";
const ADMIN_HOVER_COLOR = "#f59e0b";
const BACKEND_TO_CHART_ATTRIBUTE = Object.fromEntries(
  Object.entries(CHART_TO_BACKEND_ATTRIBUTE).map(([frontend, backend]) => [
    backend,
    frontend,
  ]),
) as Record<string, string>;

const readNamedFeatures = (geoJson: any) => {
  const features = new GeoJSON().readFeatures(geoJson, { featureProjection: "EPSG:3857" });
  features.forEach((feature) => {
    const displayName =
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

    // Hover Interaction mapping legacy attribute displays
    const hoverInteraction = createHoverSelectInteraction(
      (event) => {
        setHoveredFeature(event.selected[0] ?? null);
      },
      undefined,
      new Style({
        stroke: new Stroke({ color: ADMIN_HOVER_COLOR, width: 3 }),
        fill: new Fill({ color: "rgba(245, 158, 11, 0.14)" }),
        zIndex: 999,
      }),
    );

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
           // Provide basic stylings matching legacy markers
           const wqiClass = feature.get("WQI_Class");
           let color = "#3b82f6";
           if (wqiClass === "Excellent") color = "#22c55e";
           if (wqiClass === "Good") color = "#84cc16";
           if (wqiClass === "Poor") color = "#f97316";
           if (wqiClass === "Very Poor") color = "#ef4444";
           
           return new Style({
             image: new Circle({
               radius: 7,
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
        stroke: new Stroke({ color: "rgba(255, 165, 0, 0.8)", width: 2 }),
        fill: new Fill({ color: "rgba(100, 150, 255, 0.2)" }),
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
        stroke: new Stroke({ color: "rgba(0, 255, 0, 0.9)", width: 3 }),
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

  const handleRasterAttributeChange = async (attributeKey: string) => {
    if (!canGenerateRaster || mapStore.isMapLayersLoading) return;

    const backendAttribute =
      CHART_TO_BACKEND_ATTRIBUTE[attributeKey] || attributeKey;

    try {
      await mapStore.runInterpolation({
        attribute: backendAttribute,
        season: selectedSeason,
        subDistrictCodes: selectedSubDistricts,
        riverData,
        riverBufferData,
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
      label: "Sub-District Boundaries",
      swatch: <div className="h-4 w-4 border-2 border-[#059669]" />,
      visible: mapStore.showSubDistrictBoundaries,
      onToggle: () => mapStore.setShowSubDistrictBoundaries(!mapStore.showSubDistrictBoundaries),
    },
    {
      label: "Rivers",
      swatch: <div className="h-1 w-4 bg-green-500" />,
      visible: mapStore.showRiver,
      onToggle: () => mapStore.setShowRiver(!mapStore.showRiver),
    },
    {
      label: "River Buffer",
      swatch: <div className="h-4 w-4 border border-orange-400 bg-blue-200/60" />,
      visible: mapStore.showRiverBuffer,
      onToggle: () => mapStore.setShowRiverBuffer(!mapStore.showRiverBuffer),
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
        <BaseMaps baseMaps={baseMaps} selectedBaseMap={selectedBaseMap} onChangeBaseMap={(b) => { replaceBaseLayer({ map: mapInstanceRef.current!, baseLayerRef, baseMapKey: b, baseMaps }); setSelectedBaseMap(b); }} onClose={() => setActivePanel(null)} />
      )}

      {activePanel === "layers" && (
        <div className={`absolute left-4 top-20 z-20 w-72 rounded-xl border shadow-xl ${
          isDark ? "border-[#1e3a5f]/70 bg-[#080e1c]/95 text-slate-100" : "border-stone-200 bg-white/95 text-slate-800"
        }`}>
          <div className={`flex items-center justify-between border-b px-4 py-3 ${
            isDark ? "border-[#1e3a5f]/60" : "border-stone-200"
          }`}>
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
                  <span className={`text-sm ${item.disabled ? "opacity-50" : ""}`}>{item.label}</span>
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
                      :
                    item.visible
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
              <div className={`mt-3 rounded-lg border p-3 ${
                isDark ? "border-[#1e3a5f]/60 bg-[#0b1527]" : "border-stone-200 bg-stone-50/80"
              }`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Interpolation Opacity</span>
                  <span className="text-xs font-semibold">{Math.round(mapStore.opacity)}%</span>
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
      />

      <MapCoordinatesOverlay targetId={mouseTargetId} />
    </div>
  );
}
