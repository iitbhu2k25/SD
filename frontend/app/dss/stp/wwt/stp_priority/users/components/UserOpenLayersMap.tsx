"use client";

import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import Select from "ol/interaction/Select";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import "ol/ol.css";
import { createWFSVectorSource } from "@/components/utils/geoserver_url";
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
  attachFullscreenChangeListener,
  attachPointerMoveTracker,
  createDoubleClickSelectInteraction,
  createHoverSelectInteraction,
  toggleBrowserFullscreen,
} from "@/components/map_core/interactions";
import MapHeaderControls from "../../shared/ui/MapHeaderControls";
import MapRasterSelector from "../../shared/ui/MapRasterSelector";
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

  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
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
  const setShowCatchment = useUserRiverStore((state) => state.setShowCatchment);
  const setSelectedRiver = useUserRiverStore((state) => state.setSelectedRiver);
  const setSelectedCatchments = useUserRiverStore(
    (state) => state.setSelectedCatchments,
  );
  const setSelectedStretches = useUserRiverStore(
    (state) => state.setSelectedStretches,
  );
  const setSelectedDrains = useUserRiverStore((state) => state.setSelectedDrains);
  const selectionsLocked = useUserRiverStore((state) => state.selectionsLocked);
  const AnalysisCachement = useUserRiverStore((state) => state.AnalysisCachement);
  const setAnalysisCachement = useUserRiverStore(
    (state) => state.setAnalysisCachement,
  );

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
      defaultBaseMapKey: "satellite",
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

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(container);

    return () => {
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

    const source = createWFSVectorSource({
      workspace: defaultWorkspace,
      layerName,
      layerFilter,
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

    const source = createWFSVectorSource({
      workspace: defaultWorkspace,
      layerName: primaryLayer,
    });
    const boundarySource = boundarylayer
      ? createWFSVectorSource({
          workspace: defaultWorkspace,
          layerName: boundarylayer,
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
    const selectedLayer = displayRaster.find((item) => item.file_name === selectedradioLayer);
    setRasterLayerInfo(selectedLayer ?? null);
  }, [displayRaster, selectedradioLayer, setRasterLayerInfo]);

  const toggleFullScreen = () => {
    toggleBrowserFullscreen(containerRef.current, isFullScreen);
  };

  const togglePanel = (panelName: string) => {
    setActivePanel(activePanel === panelName ? null : panelName);
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

  const handleCatchmentAnalysis = async () => {
    setAnalysisCachement(true);
    await setShowCatchment(true);
  };

  const renderLayerPanel = () => (
    <div className="absolute right-4 top-20 z-30 w-80 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">River System Layers</h3>
        <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-900">
          x
        </button>
      </div>
      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex items-center justify-between gap-3">
          <span>Rivers</span>
          <input
            type="checkbox"
            checked={showRiverLayer}
            onChange={() => setShowRiverLayer((prev) => !prev)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Stretches</span>
          <input
            type="checkbox"
            checked={showStretchLayer}
            onChange={() => setShowStretchLayer((prev) => !prev)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Drains</span>
          <input
            type="checkbox"
            checked={showDrainLayer}
            onChange={() => setShowDrainLayer((prev) => !prev)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Catchments</span>
          <input
            type="checkbox"
            checked={showCatchmentLayer}
            onChange={() => setShowCatchmentLayer(!showCatchmentLayer)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Show Labels</span>
          <input
            type="checkbox"
            checked={showTitles}
            onChange={() => setShowTitles((prev) => !prev)}
          />
        </label>
      </div>
    </div>
  );

  const renderToolsPanel = () => (
    <div className="absolute right-4 top-20 z-30 w-80 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Map Tools</h3>
        <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-900">
          x
        </button>
      </div>
      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex items-center justify-between gap-3">
          <span>Show Labels</span>
          <input
            type="checkbox"
            checked={showTitles}
            onChange={() => setShowTitles((prev) => !prev)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Show Legend</span>
          <input
            type="checkbox"
            checked={showLegend && !!legendUrl && !!rasterLayerInfo}
            disabled={!legendUrl || !rasterLayerInfo}
            onChange={() => setShowLegend(!showLegend)}
          />
        </label>
        
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
        layers={displayRaster}
        selectedLayer={selectedradioLayer}
        layerOpacity={layerOpacity}
        onToggle={() => setIsLayerPanelOpen((prev) => !prev)}
        onSelectLayer={handleLayerSelection}
        onOpacityChange={setLayerOpacity}
      />

      {selectedDrains.length > 0 && !AnalysisCachement && (
        <button
          onClick={handleCatchmentAnalysis}
          className="absolute bottom-20 left-4 z-30 rounded-full border border-white/30 bg-white/90 px-4 py-3 text-sm font-medium text-slate-800 shadow-lg backdrop-blur"
        >
          Analyze Catchment
        </button>
      )}

      {activePanel === "layers" && renderLayerPanel()}
      {activePanel === "basemap" && (
        <div className="absolute right-4 top-20 z-30 w-72 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Base Maps</h3>
            <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-900">
              x
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(baseMaps).map(([key, baseMap]) => (
              <button
                key={key}
                onClick={() => changeBaseMap(key)}
                className={`rounded-lg border p-3 text-sm ${
                  selectedBaseMap === key
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {baseMap.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {activePanel === "tools" && renderToolsPanel()}

      {showLegend && legendUrl && rasterLayerInfo && (
        <div className="absolute bottom-4 left-4 z-30 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Legend
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
              title="Close legend"
            >
              x
            </button>
          </div>
          <img src={legendUrl} alt="Legend" className="max-w-[220px]" />
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-30 rounded-lg border border-slate-600 bg-slate-800/90 px-4 py-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <div className="text-xs font-mono text-slate-100" id="mouse-position"></div>
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
