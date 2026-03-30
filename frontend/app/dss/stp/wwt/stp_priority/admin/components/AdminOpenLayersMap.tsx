"use client";

// This file controls the admin map.
// It creates the map, loads layers, and handles map actions like hover,
// fullscreen, base map change, and selection.
import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
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
import MapHeaderControls from "../../shared/ui/MapHeaderControls";
import MapRasterSelector from "../../shared/ui/MapRasterSelector";
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

  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
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
      defaultBaseMapKey: "satellite",
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

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(container);

    return () => {
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
    const selectedLayer = displayRaster.find((item) => item.file_name === selectedradioLayer);
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
    <div className="absolute right-4 top-20 z-30 w-72 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Map Layers</h3>
        <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-slate-900">
          x
        </button>
      </div>

      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex items-center justify-between gap-3">
          <span>India Layer</span>
          <input
            type="checkbox"
            checked={showPrimaryLayer}
            onChange={() => setShowPrimaryLayer(!showPrimaryLayer)}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Selection Layer</span>
          <input
            type="checkbox"
            checked={showSecondaryLayer}
            onChange={() => setShowSecondaryLayer(!showSecondaryLayer)}
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
        <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
          <div>Primary features: {featureCounts.primary}</div>
          <div>Selection features: {featureCounts.secondary}</div>
        </div>
      </div>
    </div>
  );

  const renderBaseMapPanel = () => (
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
  );

  const renderToolsPanel = () => (
    <div className="absolute right-4 top-20 z-30 w-72 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
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
        <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
          <div>Primary features: {featureCounts.primary}</div>
          <div>Selection features: {featureCounts.secondary}</div>
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
        layers={displayRaster}
        selectedLayer={selectedradioLayer}
        layerOpacity={layerOpacity}
        onToggle={() => setIsLayerPanelOpen((prev) => !prev)}
        onSelectLayer={handleLayerSelection}
        onOpacityChange={setLayerOpacity}
      />

      {activePanel === "layers" && renderLayerPanel()}
      {activePanel === "basemap" && renderBaseMapPanel()}
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
