"use client";

import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import { fromLonLat } from "ol/proj";
import Select from "ol/interaction/Select";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM, LAYER_COLORS } from "@/interface/openlayer";
import { HoverTooltip, baseMaps } from "@/components/MapComponents";
import {
  createIndiaMapWithBaseLayer,
  replaceBaseLayer,
} from "@/components/map_core/openlayersCommon";
import {
  handleFeaturesLoadEnd,
} from "@/components/map_core/featureLoad";
import {
  clearRasterLayers,
  createRasterWmsLayer,
  resolveRasterLayerNames,
} from "@/components/map_core/rasterWms";
import {
  clearVectorLayer,
  replaceVectorLayer,
} from "@/components/map_core/vectorLayers";
import {
  buildInClauseFilter,
  createWfsUrlVectorSource,
} from "@/components/map_core/wfs";
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
import { useUserRiverStore } from "../stores/userRiverStore";
import { useUserMapStore } from "../stores/userMapStore";

function createVectorStyle(layerType: string, showLabels: boolean) {
  return (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry.getType();
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name") || feature.get("NAME");
    const colorConfig = LAYER_COLORS[layerType] || LAYER_COLORS.primary;
    const styles: Style[] = [];

    if (geometryType.includes("Polygon")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color: colorConfig.color, width: 2 }),
          fill: new Fill({ color: "transparent" }),
        }),
      );
    }

    if (geometryType.includes("LineString")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color: colorConfig.color, width: layerType === "stretch" ? 2 : 3 }),
        }),
      );
    }

    if (geometryType.includes("Point")) {
      styles.push(
        new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: `${colorConfig.color}80` }),
            stroke: new Stroke({ color: colorConfig.color, width: 3 }),
          }),
        }),
      );
    }

    if (showLabels && featureName) {
      let minZoomForLabel = 10;
      if (layerType === "catchment") minZoomForLabel = 12;
      if (layerType === "drain") minZoomForLabel = 13;
      if (layerType === "stretch") minZoomForLabel = 14;
      if (layerType === "river") minZoomForLabel = 11;

      if (zoom >= minZoomForLabel) {
        styles.push(
          new Style({
            text: new Text({
              text: featureName.toString(),
              font: "12px Arial, sans-serif",
              fill: new Fill({ color: colorConfig.color }),
              stroke: new Stroke({ color: "#ffffff", width: 3 }),
              offsetY: geometryType.includes("Point") ? -20 : 0,
              textAlign: "center",
              textBaseline: "middle",
            }),
          }),
        );
      }
    }

    return styles;
  };
}

export default function UserOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const boundaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const riverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stretchLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drainLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const catchmentLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const rasterLayersRef = useRef<Record<string, any>>({});

  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [showTitles, setShowTitles] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showRiverLayer, setShowRiverLayer] = useState(true);
  const [showStretchLayer, setShowStretchLayer] = useState(true);
  const [showDrainLayer, setShowDrainLayer] = useState(true);
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    river: 0,
    stretch: 0,
    drain: 0,
    catchment: 0,
  });

  const selectedDrains = useUserRiverStore((state) => state.selectedDrains);
  const selectedRiver = useUserRiverStore((state) => state.selectedRiver);
  const selectedStretches = useUserRiverStore((state) => state.selectedStretches);
  const selectedCatchments = useUserRiverStore((state) => state.selectedCatchments);
  const setShowCatchmentLayer = useUserRiverStore(
    (state) => state.setShowCatchmentLayer,
  );
  const showCatchmentLayer = useUserRiverStore((state) => state.showCatchmentLayer);
  const displayRaster = useUserRiverStore((state) => state.displayRaster);
  const setSelectedRiver = useUserRiverStore((state) => state.setSelectedRiver);
  const setSelectedCatchments = useUserRiverStore(
    (state) => state.setSelectedCatchments,
  );
  const setSelectedStretches = useUserRiverStore(
    (state) => state.setSelectedStretches,
  );
  const setSelectedDrains = useUserRiverStore((state) => state.setSelectedDrains);
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);

  const {
    primaryLayer,
    riverLayer,
    boundarylayer,
    stretchLayer,
    drainLayer,
    catchmentLayer,
    riverFilter,
    stretchFilter,
    drainFilter,
    catchmentFilter,
    defaultWorkspace,
    setLoading,
    hasSelections,
    showLegend,
    setShowLegend,
    setRasterLayerInfo,
    rasterLayerInfo,
    setError,
    setRasterLoading,
    rasterLoading,
    layerOpacity,
    selectedradioLayer,
    setLayerOpacity,
    handleLayerSelection,
  } = useUserMapStore();

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
      minZoom: 4,
      maxZoom: 18,
    });
    baseLayerRef.current = baseLayer;

    const selectInteraction = createDoubleClickSelectInteraction(
      (event, interaction) => {
        const feature = event.selected[0];
        if (!feature) {
          return;
        }

        const riverCode = feature.get("River_Code");
        const stretchId = feature.get("Stretch_ID");
        const drainNo = feature.get("Drain_No");
        const villageId = feature.get("village_id");

        if (villageId) {
          setSelectedCatchments([Number(villageId)]);
        } else if (drainNo) {
          setSelectedDrains([Number(drainNo)]);
        } else if (stretchId) {
          setSelectedStretches([Number(stretchId)]);
        } else if (riverCode) {
          setSelectedRiver(Number(riverCode));
        }

        setTimeout(() => interaction.getFeatures().clear(), 300);
      },
      (_feature, layer) => layer !== boundaryLayerRef.current && layer !== primaryLayerRef.current,
    );

    const hoverInteraction = createHoverSelectInteraction(
      (event) => {
        setHoveredFeature(event.selected[0] ?? null);
      },
      (_feature, layer) => layer !== boundaryLayerRef.current && layer !== primaryLayerRef.current,
    );

    const cleanupMouseTracking = attachPointerMoveTracker(map, setMousePosition);
    const handleHoverClearOnMove = (event: any) => {
      const featureAtPixel = map.forEachFeatureAtPixel(
        event.pixel,
        (feature, layer) =>
          layer !== boundaryLayerRef.current && layer !== primaryLayerRef.current
            ? feature
            : null,
      );

      if (!featureAtPixel) {
        setHoveredFeature(null);
        hoverInteractionRef.current?.getFeatures().clear();
      }
    };

    map.on("pointermove", handleHoverClearOnMove);
    map.addInteraction(selectInteraction);
    map.addInteraction(hoverInteraction);
    selectInteractionRef.current = selectInteraction;
    hoverInteractionRef.current = hoverInteraction;
    mapInstanceRef.current = map;

    setTimeout(() => setLoading(false), 250);

    return () => {
      map.un("pointermove", handleHoverClearOnMove);
      cleanupMouseTracking();
      setHoveredFeature(null);
      map.setTarget("");
    };
  }, [setLoading, setSelectedCatchments, setSelectedDrains, setSelectedRiver, setSelectedStretches]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handlePointerLeave = () => {
      setHoveredFeature(null);
      hoverInteractionRef.current?.getFeatures().clear();
    };

    container.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      container.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    if (!selectInteractionRef.current) {
      return;
    }
    selectInteractionRef.current.setActive(!selectionsLocked);
  }, [selectionsLocked]);

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
      }, 1000);
    });

    resizeObserver.observe(container);

    return () => {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);

  const createRiverSystemLayer = (
    layerName: string | null,
    layerRef: React.MutableRefObject<VectorLayer<VectorSource> | null>,
    layerType: "river" | "stretch" | "drain" | "catchment",
    zIndex: number,
    isVisible: boolean,
    layerFilter: { filterField: string | null; filterValue: number[] | string[] | null },
  ) => {
    const map = mapInstanceRef.current;
    if (!map || !layerName) {
      if (map && layerRef.current) {
        clearVectorLayer(map, layerRef);
      }
      setFeatureCounts((prev) => ({ ...prev, [layerType]: 0 }));
      return;
    }

    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName,
      srsName: "EPSG:3857",
      cqlFilter: buildInClauseFilter(layerFilter.filterField, layerFilter.filterValue),
    });

    return replaceVectorLayer({
      map,
      layerRef,
      source,
      style: createVectorStyle(layerType, showTitles),
      zIndex,
      visible: isVisible,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map,
          onCount: (count) => setFeatureCounts((prev) => ({ ...prev, [layerType]: count })),
          shouldFit: (count) => hasSelections && count > 0,
        }),
    }).cleanup;
  };

  useEffect(() => {
    if (!mapInstanceRef.current || !primaryLayer) {
      return;
    }

    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName: primaryLayer,
      srsName: "EPSG:3857",
    });
    const boundarySource = boundarylayer
      ? createWfsUrlVectorSource({
          geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
          workspace: defaultWorkspace,
          layerName: boundarylayer,
          srsName: "EPSG:3857",
        })
      : null;

    const boundaryCleanup = boundarySource
      ? replaceVectorLayer({
          map: mapInstanceRef.current,
          layerRef: boundaryLayerRef,
          source: boundarySource,
          style: new Style({
            stroke: new Stroke({ color: "#312e81", width: 2 }),
            fill: new Fill({ color: "rgba(49, 46, 129, 0.05)" }),
          }),
          zIndex: 2,
          visible: true,
        }).cleanup
      : () => undefined;

    const primaryCleanup = replaceVectorLayer({
      map: mapInstanceRef.current,
      layerRef: primaryLayerRef,
      source,
      style: createVectorStyle("primary", showTitles),
      zIndex: 1,
      visible: true,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map: mapInstanceRef.current,
          onCount: (count) => setFeatureCounts((prev) => ({ ...prev, primary: count })),
        }),
    }).cleanup;

    return () => {
      boundaryCleanup();
      primaryCleanup();
    };
  }, [boundarylayer, defaultWorkspace, primaryLayer, showTitles]);

  useEffect(
    () =>
      createRiverSystemLayer(
        riverLayer,
        riverLayerRef,
        "river",
        13,
        showRiverLayer,
        riverFilter,
      ),
    [
      defaultWorkspace,
      hasSelections,
      riverFilter,
      riverLayer,
      selectedCatchments.length,
      selectedDrains.length,
      selectedRiver,
      selectedStretches.length,
      showRiverLayer,
      showTitles,
    ],
  );

  useEffect(
    () =>
      createRiverSystemLayer(
        stretchLayer,
        stretchLayerRef,
        "stretch",
        12,
        showStretchLayer,
        stretchFilter,
      ),
    [
      defaultWorkspace,
      hasSelections,
      selectedCatchments.length,
      selectedDrains.length,
      selectedRiver,
      selectedStretches.length,
      showStretchLayer,
      showTitles,
      stretchFilter,
      stretchLayer,
    ],
  );

  useEffect(
    () =>
      createRiverSystemLayer(
        drainLayer,
        drainLayerRef,
        "drain",
        11,
        showDrainLayer,
        drainFilter,
      ),
    [
      defaultWorkspace,
      drainFilter,
      drainLayer,
      hasSelections,
      selectedCatchments.length,
      selectedDrains.length,
      selectedRiver,
      selectedStretches.length,
      showDrainLayer,
      showTitles,
    ],
  );

  useEffect(
    () =>
      createRiverSystemLayer(
        catchmentLayer,
        catchmentLayerRef,
        "catchment",
        10,
        showCatchmentLayer,
        catchmentFilter,
      ),
    [
      catchmentFilter,
      catchmentLayer,
      defaultWorkspace,
      hasSelections,
      selectedCatchments.length,
      selectedDrains.length,
      selectedRiver,
      selectedStretches.length,
      showCatchmentLayer,
      showTitles,
    ],
  );

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
  }, [layerOpacity, rasterLayerInfo, setError, setRasterLoading, setShowLegend]);

  useEffect(() => {
    const safeDisplayRaster = Array.isArray(displayRaster) ? displayRaster : [];
    const selectedLayer = safeDisplayRaster.find(
      (item) => item.file_name === selectedradioLayer,
    );
    setRasterLayerInfo(selectedLayer ?? null);
  }, [displayRaster, selectedradioLayer, setRasterLayerInfo]);

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
          <h3 className="text-sm font-bold text-gray-800">River System Layers</h3>
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
              showRiverLayer
                ? "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div className={`mr-3 h-3 w-3 rounded-full ${showRiverLayer ? "bg-blue-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`text-sm font-semibold ${showRiverLayer ? "text-blue-800" : "text-gray-600"}`}>
                    Rivers
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.river} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowRiverLayer((prev) => !prev)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showRiverLayer ? "bg-blue-500" : "bg-gray-300"
                }`}
                title={showRiverLayer ? "Hide rivers" : "Show rivers"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showRiverLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showStretchLayer
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div className={`mr-3 h-3 w-3 rounded-full ${showStretchLayer ? "bg-emerald-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`text-sm font-semibold ${showStretchLayer ? "text-emerald-800" : "text-gray-600"}`}>
                    Stretches
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.stretch} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowStretchLayer((prev) => !prev)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showStretchLayer ? "bg-emerald-500" : "bg-gray-300"
                }`}
                title={showStretchLayer ? "Hide stretches" : "Show stretches"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showStretchLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showDrainLayer
                ? "border-red-200 bg-gradient-to-r from-red-50 to-rose-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div className={`mr-3 h-3 w-3 rounded-full ${showDrainLayer ? "bg-red-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`text-sm font-semibold ${showDrainLayer ? "text-red-800" : "text-gray-600"}`}>
                    Drains
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.drain} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowDrainLayer((prev) => !prev)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showDrainLayer ? "bg-red-500" : "bg-gray-300"
                }`}
                title={showDrainLayer ? "Hide drains" : "Show drains"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showDrainLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showCatchmentLayer
                ? "border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div className={`mr-3 h-3 w-3 rounded-full ${showCatchmentLayer ? "bg-amber-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`text-sm font-semibold ${showCatchmentLayer ? "text-amber-800" : "text-gray-600"}`}>
                    Catchments
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.catchment} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowCatchmentLayer(!showCatchmentLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showCatchmentLayer ? "bg-amber-500" : "bg-gray-300"
                }`}
                title={showCatchmentLayer ? "Hide catchments" : "Show catchments"}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showCatchmentLayer ? "translate-x-5" : "translate-x-0.5"
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
                <div className={`mr-3 h-3 w-3 rounded-full ${showTitles ? "bg-purple-500" : "bg-gray-400"}`} />
                <div>
                  <div className={`text-sm font-semibold ${showTitles ? "text-purple-800" : "text-gray-600"}`}>
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
        </div>
      </div>
    </div>
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
      {activePanel === "basemap" && (
        <BaseMaps
          baseMaps={baseMaps}
          selectedBaseMap={selectedBaseMap}
          onChangeBaseMap={changeBaseMap}
          onClose={() => setActivePanel(null)}
        />
      )}
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

      <div className="pointer-events-none absolute bottom-2 left-40 z-30 max-w-[calc(100vw-11rem)] rounded-2xl border border-white/45 bg-white/35 px-3 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.15)] backdrop-blur-md sm:left-44 sm:max-w-[calc(100vw-18rem)] sm:px-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            <svg className="h-3.5 w-3.5 text-cyan-700/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </span>
          <div className="truncate text-[11px] leading-4 font-mono font-medium text-slate-700" id="mouse-position"></div>
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
