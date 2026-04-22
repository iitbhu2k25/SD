"use client";

// This file controls the admin map.
// It creates the map, loads layers, and handles map actions like hover,
// fullscreen, base map change, and selection.
import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import { fromLonLat } from "ol/proj";
import Select from "ol/interaction/Select";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { HoverTooltip, baseMaps } from "@/components/MapComponents";
import {
  createIndiaMapWithBaseLayer,
  replaceBaseLayer,
} from "@/components/map_core/openlayersCommon";
import { handleFeaturesLoadEnd } from "@/components/map_core/featureLoad";
import {
  clearRasterLayers,
  createRasterWmsLayer,
  resolveRasterLayerNames,
} from "@/components/map_core/rasterWms";
import {
  buildInClauseFilter,
  createWfsUrlVectorSource,
} from "@/components/map_core/wfs";
import {
  clearVectorLayer,
  replaceVectorLayer,
} from "@/components/map_core/vectorLayers";
import {
  attachFullscreenChangeListener,
  attachPointerMoveTracker,
  createDoubleClickSelectInteraction,
  createHoverSelectInteraction,
  toggleBrowserFullscreen,
} from "@/components/map_core/interactions";
import BaseMaps from "@/components/dss_common/BaseMaps";
import CloseIcon from "@/components/dss_common/CloseIcon";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import MapRasterSelector from "@/components/dss_common/MapRasterSelector";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

function createVectorStyle(isSecondary: boolean, showTitles: boolean) {
  return (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name") || feature.get("NAME");
    const color = isSecondary ? "#7c2d12" : "#2563eb";
    const width = isSecondary ? 3 : 2;
    const styles: Style[] = [];

    if (geometryType.includes("Polygon")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color, width }),
          fill: new Fill({ color: "transparent" }),
        }),
      );
    }

    if (geometryType.includes("LineString")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color, width: width + 1 }),
        }),
      );
    }

    if (geometryType.includes("Point")) {
      styles.push(
        new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: `${color}80` }),
            stroke: new Stroke({ color, width: 2 }),
          }),
        }),
      );
    }

    if (showTitles && zoom > 5 && featureName) {
      styles.push(
        new Style({
          text: new Text({
            text: featureName.toString(),
            font: "12px Arial, sans-serif",
            fill: new Fill({ color }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
            offsetY: geometryType.includes("Point") ? -20 : 0,
            textAlign: "center",
            textBaseline: "middle",
          }),
        }),
      );
    }

    return styles;
  };
}

export default function AdminOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const rasterLayersRef = useRef<Record<string, any>>({});

  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [featureCounts, setFeatureCounts] = useState({ primary: 0, secondary: 0 });

  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const selectedState = useAdminLocationStore((state) => state.selectedState);
  const setSelectedState = useAdminLocationStore((state) => state.setSelectedState);
  const setSelectedDistricts = useAdminLocationStore((state) => state.setSelectedDistricts);
  const setSelectedSubDistricts = useAdminLocationStore(
    (state) => state.setSelectedSubDistricts,
  );

  const {
    primaryLayer,
    secondaryLayer,
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    setShowLegend,
    rasterLoading,
    setRasterLoading,
    setError,
    layerOpacity,
    selectedradioLayer,
    setLayerOpacity,
    handleLayerSelection,
    setLoading,
    rasterLayerInfo,
    setRasterLayerInfo,
    showLegend,
    showPrimaryLayer,
    showSecondaryLayer,
    setShowPrimaryLayer,
    setShowSecondaryLayer,
  } = useAdminMapStore();

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const { map, baseLayer } = createIndiaMapWithBaseLayer({
      target: mapRef.current,
      mouseTargetId: "mouse-position",
      baseMaps,
      defaultBaseMapKey: "terrain",
      center: INDIA_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 18,
    });
    baseLayerRef.current = baseLayer;

    const selectInteraction = createDoubleClickSelectInteraction((event, interaction) => {
      const feature = event.selected[0];
      if (!feature) {
        return;
      }

      const stateCode = feature.get("State_Code");
      const districtCode = feature.get("district_c");
      const subDistrictCode = feature.get("subdis_cod");

      if (subDistrictCode) {
        setSelectedSubDistricts([Number(subDistrictCode)]);
      } else if (districtCode) {
        setSelectedDistricts([Number(districtCode)]);
      } else if (stateCode) {
        setSelectedState(Number(stateCode));
      }

      setTimeout(() => interaction.getFeatures().clear(), 300);
    });

    const hoverInteraction = createHoverSelectInteraction((event) => {
      setHoveredFeature(event.selected[0] ?? null);
    });

    const cleanupMouseTracking = attachPointerMoveTracker(map, setMousePosition);
    map.addInteraction(selectInteraction);
    map.addInteraction(hoverInteraction);
    selectInteractionRef.current = selectInteraction;
    hoverInteractionRef.current = hoverInteraction;
    mapInstanceRef.current = map;

    setTimeout(() => setLoading(false), 250);

    return () => {
      cleanupMouseTracking();
      map.setTarget("");
    };
  }, [setLoading, setSelectedDistricts, setSelectedState, setSelectedSubDistricts]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const container = containerRef.current;
    if (!map || !container || typeof ResizeObserver === "undefined") {
      return;
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(() => {
        map.updateSize();
      }, 100);
    });

    resizeObserver.observe(container);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(showPrimaryLayer);
    }
  }, [showPrimaryLayer]);

  useEffect(() => {
    if (secondaryLayerRef.current) {
      secondaryLayerRef.current.setVisible(showSecondaryLayer);
    }
  }, [showSecondaryLayer]);

  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) {
      return;
    }

    setError(null);

    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName: primaryLayer,
      srsName: "EPSG:3857",
    });

    const { cleanup } = replaceVectorLayer({
      map: mapInstanceRef.current,
      layerRef: primaryLayerRef,
      source,
      style: createVectorStyle(false, showTitles),
      zIndex: 1,
      visible: showPrimaryLayer,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map: mapInstanceRef.current,
          onCount: (count) => setFeatureCounts((prev) => ({ ...prev, primary: count })),
        }),
      onFeaturesLoadError: () => setError("Failed to load primary features"),
    });

    return () => cleanup();
  }, [defaultWorkspace, primaryLayer, setError, showPrimaryLayer, showTitles]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !secondaryLayer) {
      if (map && secondaryLayerRef.current) {
        clearVectorLayer(map, secondaryLayerRef);
      }
      setFeatureCounts((prev) => ({ ...prev, secondary: 0 }));
      return;
    }

    const cqlFilter = buildInClauseFilter(LayerFilter, LayerFilterValue);
    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName: secondaryLayer,
      srsName: "EPSG:3857",
      cqlFilter,
    });

    const { cleanup } = replaceVectorLayer({
      map,
      layerRef: secondaryLayerRef,
      source,
      style: createVectorStyle(true, showTitles),
      zIndex: 4,
      visible: showSecondaryLayer,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map,
          onCount: (count) => setFeatureCounts((prev) => ({ ...prev, secondary: count })),
        }),
    });

    return () => cleanup();
  }, [
    LayerFilter,
    LayerFilterValue,
    defaultWorkspace,
    secondaryLayer,
    showSecondaryLayer,
    showTitles,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    clearRasterLayers(map, rasterLayersRef);

    if (!rasterLayerInfo) {
      setLegendUrl(null);
      setShowLegend(false);
      setRasterLoading(false);
      return;
    }

    try {
      const { layerName, fullLayerName } = resolveRasterLayerNames(rasterLayerInfo);
      const { legendUrl, layerId, layer } = createRasterWmsLayer({
        geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
        fullLayerName,
        layerName,
        opacity: layerOpacity / 100,
      });
      rasterLayersRef.current[layerId] = layer;
      map.addLayer(layer);
      map.renderSync();
      setLegendUrl(legendUrl);
      setShowLegend(true);
      setRasterLoading(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to set raster layer";
      setError(message);
      setRasterLoading(false);
    }
  }, [
    layerOpacity,
    rasterLayerInfo,
    setError,
    setRasterLoading,
    setShowLegend,
  ]);

  useEffect(() => {
    const safeDisplayRaster = Array.isArray(displayRaster) ? displayRaster : [];
    const selectedLayer = safeDisplayRaster.find(
      (item) => item.file_name === selectedradioLayer,
    );
    setRasterLayerInfo(selectedLayer ?? null);
  }, [displayRaster, selectedradioLayer, setRasterLayerInfo]);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);

  useEffect(() => {
    if (!selectInteractionRef.current) {
      return;
    }
    selectInteractionRef.current.setActive(!selectionsLocked);
  }, [selectionsLocked]);

  useEffect(() => {
    setShowPrimaryLayer(selectedState === null);
  }, [selectedState, setShowPrimaryLayer]);

  const toggleFullScreen = () => {
    toggleBrowserFullscreen(containerRef.current, isFullScreen);
  };

  const togglePanel = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
  };

  const goToHomeView = () => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    const view = map.getView();
    view.animate({
      center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
      zoom: INITIAL_ZOOM,
      duration: 300,
    });
  };

  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current) {
      return;
    }
    const didReplace = replaceBaseLayer({
      map: mapInstanceRef.current,
      baseLayerRef,
      baseMapKey,
      baseMaps,
    });
    if (didReplace) {
      setSelectedBaseMap(baseMapKey);
    }
  };

  const renderLayerPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className="rounded-xl border border-white/50 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Map Layers</h3>
          <button
            onClick={() => setActivePanel(null)}
            className="text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div
            className={`rounded-xl border p-3 ${
              showPrimaryLayer
                ? "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showPrimaryLayer ? "bg-blue-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showPrimaryLayer ? "text-blue-800" : "text-gray-600"
                    }`}
                  >
                    India Layer
                  </div>
                  <div className="text-xs text-gray-500">
                    {featureCounts.primary} features
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPrimaryLayer(!showPrimaryLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showPrimaryLayer ? "bg-blue-500" : "bg-gray-300"
                }`}
                title={showPrimaryLayer ? "Hide India layer" : "Show India layer"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showPrimaryLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showSecondaryLayer
                ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showSecondaryLayer ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showSecondaryLayer ? "text-green-800" : "text-gray-600"
                    }`}
                  >
                    Selection Layer
                  </div>
                  <div className="text-xs text-gray-500">
                    {featureCounts.secondary} features
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSecondaryLayer(!showSecondaryLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showSecondaryLayer ? "bg-green-500" : "bg-gray-300"
                }`}
                title={
                  showSecondaryLayer
                    ? "Hide selection layer"
                    : "Show selection layer"
                }
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showSecondaryLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showTitles
                ? "border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showTitles ? "bg-purple-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showTitles ? "text-purple-800" : "text-gray-600"
                    }`}
                  >
                    Display Titles
                  </div>
                  <div className="text-xs text-gray-500">
                    {showTitles ? "Labels enabled" : "Labels hidden"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowTitles((prev) => !prev)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showTitles ? "bg-purple-500" : "bg-gray-300"
                }`}
                title={showTitles ? "Hide labels" : "Show labels"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showTitles ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/50 bg-white/30 p-3 text-xs text-gray-700">
            <div>Primary features: {featureCounts.primary}</div>
            <div>Selection features: {featureCounts.secondary}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBaseMapPanel = () => (
    <BaseMaps
      baseMaps={baseMaps}
      selectedBaseMap={selectedBaseMap}
      onChangeBaseMap={changeBaseMap}
      onClose={() => setActivePanel(null)}
    />
  );

  const renderToolsPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className="rounded-xl border border-white/50 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Map Tools</h3>
          <button
            onClick={() => setActivePanel(null)}
            className="text-white bg-slate-300 hover:text-red-600 hover:bg-red-100 p-1 rounded-full cursor-pointer transition-all duration-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5 text-sm text-gray-700">
            <div>
              <div className="font-medium text-gray-800">Home View</div>
              <div className="text-xs text-gray-500">Reset zoom and center</div>
            </div>
            <button
              onClick={goToHomeView}
              className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-100"
            >
              Reset
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white/70 px-3 py-3 text-sm text-gray-700">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-800">Raster Opacity</div>
                <div className="text-xs text-gray-500">
                  {selectedradioLayer ? selectedradioLayer : "Select a raster layer to adjust"}
                </div>
              </div>
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                {layerOpacity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={layerOpacity}
              onChange={(event) => setLayerOpacity(parseInt(event.target.value, 10))}
              className="w-full"
              aria-label="Adjust raster opacity"
              disabled={!selectedradioLayer}
            />
          </div>
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

      <MapRasterSelector
        isOpen={isLayerPanelOpen}
        layers={Array.isArray(displayRaster) ? displayRaster : []}
        selectedLayer={selectedradioLayer}
        onToggle={() => setIsLayerPanelOpen((prev) => !prev)}
        onSelectLayer={handleLayerSelection}
      />

      {activePanel === "layers" && renderLayerPanel()}
      {activePanel === "basemap" && renderBaseMapPanel()}
      {activePanel === "tools" && renderToolsPanel()}

      {showLegend && legendUrl && rasterLayerInfo && (
        <div className="absolute bottom-24 right-2 z-[9] w-[150px] overflow-hidden rounded-2xl border border-indigo-100 bg-white/97 shadow-2xl shadow-indigo-100/40 backdrop-blur-md sm:bottom-10">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-indigo-50 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect
                  x="1"
                  y="2"
                  width="5"
                  height="5"
                  rx="1.5"
                  fill="#6366f1"
                />
                <rect
                  x="1"
                  y="9"
                  width="5"
                  height="5"
                  rx="1.5"
                  fill="#6366f1"
                  opacity="0.5"
                />
                <rect
                  x="8"
                  y="2"
                  width="7"
                  height="2"
                  rx="1"
                  fill="#6366f1"
                  opacity="0.7"
                />
                <rect
                  x="8"
                  y="6"
                  width="5"
                  height="2"
                  rx="1"
                  fill="#6366f1"
                  opacity="0.4"
                />
                <rect
                  x="8"
                  y="9"
                  width="7"
                  height="2"
                  rx="1"
                  fill="#6366f1"
                  opacity="0.7"
                />
                <rect
                  x="8"
                  y="13"
                  width="5"
                  height="2"
                  rx="1"
                  fill="#6366f1"
                  opacity="0.4"
                />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">
                Legend
              </span>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-all duration-150 hover:bg-red-50 hover:text-red-500 cursor-pointer"
              title="Close legend"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>

          {/* Legend image */}
          <div className="p-3">
            <img
              src={legendUrl}
              alt="Legend"
              className="max-h-[40vh] max-w-full rounded-md"
            />
          </div>
        </div>
      )}

      {!showLegend && legendUrl && rasterLayerInfo && (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute bottom-2 right-10 z-[9] inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-200/60 bg-white/92 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-700 shadow-md shadow-indigo-100/50 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-50/90 hover:shadow-lg hover:shadow-indigo-200/50"
          title="Show legend"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className="opacity-80"
          >
            <rect
              x="1"
              y="2"
              width="5"
              height="5"
              rx="1.5"
              fill="currentColor"
            />
            <rect
              x="1"
              y="9"
              width="5"
              height="5"
              rx="1.5"
              fill="currentColor"
              opacity="0.5"
            />
            <rect
              x="8"
              y="2"
              width="7"
              height="2"
              rx="1"
              fill="currentColor"
              opacity="0.7"
            />
            <rect
              x="8"
              y="6"
              width="5"
              height="2"
              rx="1"
              fill="currentColor"
              opacity="0.4"
            />
            <rect
              x="8"
              y="9"
              width="7"
              height="2"
              rx="1"
              fill="currentColor"
              opacity="0.7"
            />
            <rect
              x="8"
              y="13"
              width="5"
              height="2"
              rx="1"
              fill="currentColor"
              opacity="0.4"
            />
          </svg>
          Legend
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
        </button>
      )}

      <div className="pointer-events-none absolute bottom-2 left-20 z-30 max-w-[calc(100vw-11rem)] rounded-2xl border border-white/45 bg-white/35 px-3 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.15)] backdrop-blur-md md:left-62 sm:max-w-[calc(100vw-18rem)] sm:px-3.5">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5 shrink-0 text-cyan-700/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <div className="flex h-4 items-center truncate text-[11px] leading-none font-mono font-medium text-slate-700" id="mouse-position"></div>
        </div>
      </div>

      {rasterLoading && (
        <div className="absolute inset-x-0 top-0 z-30 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-white">
          Loading raster layer...
        </div>
      )}
    </div>
  );
}
