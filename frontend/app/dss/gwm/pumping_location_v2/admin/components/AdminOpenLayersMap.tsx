"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat, toLonLat } from "ol/proj";
import Select from "ol/interaction/Select";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import "ol/ol.css";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import { CsvRow } from "@/interface/table";
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
import { buildInClauseFilter, createWfsUrlVectorSource } from "@/components/map_core/wfs";
import { clearVectorLayer, replaceVectorLayer } from "@/components/map_core/vectorLayers";
import {
  attachFullscreenChangeListener,
  attachPointerMoveTracker,
  createDoubleClickSelectInteraction,
  createHoverSelectInteraction,
  toggleBrowserFullscreen,
} from "@/components/map_core/interactions";
import BaseMaps from "@/components/dss_common/BaseMaps";
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import MapLegendOverlay from "@/components/dss_common/MapLegendOverlay";
import MapRasterSelector from "@/components/dss_common/MapRasterSelector";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import CloseIcon from "@/components/dss_common/CloseIcon";
import { useAdminLocationStore } from "../stores/adminLocationStore";
import { useAdminMapStore } from "../stores/adminMapStore";

function createSelectionStyle(
  type: "primary" | "secondary" | "result" | "well",
  showTitles: boolean,
) {
  return (feature: any, resolution: number) => {
    const geometry = feature.getGeometry();
    const geometryType = geometry?.getType?.() ?? "";
    const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
    const featureName = feature.get("name") || feature.get("Name") || feature.get("NAME");
    const wellId = feature.get("Well_id");
    const styles: Style[] = [];

    const styleByType = {
      primary: { stroke: "#2563eb", width: 2, fill: "transparent" },
      secondary: { stroke: "#7c2d12", width: 3, fill: "transparent" },
      result: { stroke: "#f59e0b", width: 2, fill: "transparent" },
      well: { stroke: "#d84315", width: 2, fill: "rgba(255,87,34,0.82)" },
    } as const;

    const active = styleByType[type];

    if (geometryType.includes("Polygon")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color: active.stroke, width: active.width }),
          fill: new Fill({ color: active.fill }),
        }),
      );
    }

    if (geometryType.includes("LineString")) {
      styles.push(
        new Style({
          stroke: new Stroke({ color: active.stroke, width: active.width + 1 }),
        }),
      );
    }

    if (geometryType.includes("Point")) {
      styles.push(
        new Style({
          image: new Circle({
            radius: type === "well" ? 7 : 6,
            fill: new Fill({ color: type === "well" ? active.fill : `${active.stroke}80` }),
            stroke: new Stroke({ color: active.stroke, width: 2 }),
          }),
        }),
      );
    }

    const canShowVectorTitle = showTitles && zoom > 5 && featureName;
    const canShowWellTitle = type === "well" && showTitles && zoom > 8 && wellId;

    if (canShowVectorTitle || canShowWellTitle) {
      styles.push(
        new Style({
          text: new Text({
            text: canShowWellTitle ? `Well ${wellId}` : String(featureName),
            font: "12px Arial, sans-serif",
            fill: new Fill({ color: active.stroke }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
            offsetY: geometryType.includes("Point") ? -18 : 0,
            textAlign: "center",
            textBaseline: "middle",
          }),
        }),
      );
    }

    return styles;
  };
}

function normalizeWellPoint(row: CsvRow): CsvRow | null {
  const lon = Number.parseFloat(String(row.Longitude));
  const lat = Number.parseFloat(String(row.Latitude));
  const wellId = String(row.Well_id ?? "").trim();
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !wellId) {
    return null;
  }

  return {
    Well_id: wellId,
    Name: row.Name,
    Longitude: lon.toString(),
    Latitude: lat.toString(),
    Distance: row.Distance,
  };
}

const WELL_DIALOG_WIDTH = 280;
const WELL_DIALOG_HEIGHT = 260;

function getWellDialogPosition(pixel: number[], container: HTMLDivElement | null) {
  const containerWidth = container?.clientWidth ?? 0;
  const containerHeight = container?.clientHeight ?? 0;
  const rawX = pixel[0] + 18;
  const rawY = pixel[1] - 36;

  return {
    x: Math.max(12, Math.min(rawX, Math.max(12, containerWidth - WELL_DIALOG_WIDTH - 12))),
    y: Math.max(12, Math.min(rawY, Math.max(12, containerHeight - WELL_DIALOG_HEIGHT - 12))),
  };
}

export default function AdminOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const primaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const secondaryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const wellLayerRef = useRef<VectorLayer<any> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);
  const hoverInteractionRef = useRef<Select | null>(null);
  const rasterLayersRef = useRef<Record<string, any>>({});
  const manualWellCounterRef = useRef(0);
  const isAddingWellPointRef = useRef(false);

  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showResultLayer, setShowResultLayer] = useState(true);
  const [showWellPointsLayer, setShowWellPointsLayer] = useState(true);
  const [isAddingWellPoint, setIsAddingWellPoint] = useState(false);
  const [pendingWellCoordinate, setPendingWellCoordinate] = useState<{
    lon: number;
    lat: number;
  } | null>(null);
  const [wellDialogPosition, setWellDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [wellName, setWellName] = useState("");
  const mapInstanceId = useId();
  const mouseTargetId = `mouse-position-${mapInstanceId.replace(/:/g, "")}`;
  const [featureCounts, setFeatureCounts] = useState({
    primary: 0,
    secondary: 0,
    result: 0,
    wells: 0,
  });

  const displayRaster = useAdminLocationStore((state) => state.displayRaster);
  const selectionsLocked = useAdminLocationStore((state) => state.selectionsLocked);
  const selectedState = useAdminLocationStore((state) => state.selectedState);
  const selectedVillages = useAdminLocationStore((state) => state.selectedVillages);
  const selectedDistricts = useAdminLocationStore((state) => state.selectedDistricts);
  const selectedSubDistricts = useAdminLocationStore((state) => state.selectedSubDistricts);
  const resultLayerName = useAdminLocationStore((state) => state.resultLayer);
  const wellPoints = useAdminLocationStore((state) => state.wellPoints);
  const setWellPoints = useAdminLocationStore((state) => state.setWellPoints);
  const setSelectedState = useAdminLocationStore((state) => state.setSelectedState);
  const setSelectedDistricts = useAdminLocationStore((state) => state.setSelectedDistricts);
  const setSelectedSubDistricts = useAdminLocationStore((state) => state.setSelectedSubDistricts);

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

  const normalizedWellPoints = useMemo(
    () => wellPoints.map(normalizeWellPoint).filter((item): item is CsvRow => item !== null),
    [wellPoints],
  );

  useEffect(() => {
    isAddingWellPointRef.current = isAddingWellPoint;
  }, [isAddingWellPoint]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

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

    const selectInteraction = createDoubleClickSelectInteraction((event, interaction) => {
      if (isAddingWellPointRef.current) {
        return;
      }

      const feature = event.selected[0];
      if (!feature) {
        return;
      }

      const stateCode = feature.get("State_Code");
      const districtCode = feature.get("district_c");
      const subDistrictCode = feature.get("subdis_cod");

      if (subDistrictCode) {
        void setSelectedSubDistricts([Number(subDistrictCode)]);
      } else if (districtCode) {
        void setSelectedDistricts([Number(districtCode)]);
      } else if (stateCode) {
        void setSelectedState(Number(stateCode));
      }

      setTimeout(() => interaction.getFeatures().clear(), 250);
    });

    const hoverInteraction = createHoverSelectInteraction((event) => {
      if (isAddingWellPointRef.current) {
        return;
      }
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
  }, [
    mouseTargetId,
    setLoading,
    setSelectedDistricts,
    setSelectedState,
    setSelectedSubDistricts,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    const handleMapClickForWell = (event: any) => {
      if (!isAddingWellPointRef.current) {
        return;
      }
      const [lon, lat] = toLonLat(event.coordinate);
      setPendingWellCoordinate({ lon, lat });
      setWellDialogPosition(getWellDialogPosition(event.pixel, containerRef.current));
    };

    map.on("singleclick", handleMapClickForWell);
    return () => {
      map.un("singleclick", handleMapClickForWell);
    };
  }, []);

  useEffect(() => {
    if (!selectInteractionRef.current || !hoverInteractionRef.current || !mapRef.current) {
      return;
    }
    const selectable = !selectionsLocked && !isAddingWellPoint;
    selectInteractionRef.current.setActive(selectable);
    hoverInteractionRef.current.setActive(!isAddingWellPoint);
    mapRef.current.style.cursor = isAddingWellPoint ? "crosshair" : "default";
  }, [isAddingWellPoint, selectionsLocked]);

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
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);

  useEffect(() => {
    if (primaryLayerRef.current) {
      primaryLayerRef.current.setVisible(showPrimaryLayer);
    }
  }, [showPrimaryLayer]);

  useEffect(() => {
    setShowPrimaryLayer(selectedState === null);
  }, [selectedState, setShowPrimaryLayer]);

  useEffect(() => {
    if (secondaryLayerRef.current) {
      secondaryLayerRef.current.setVisible(showSecondaryLayer);
    }
  }, [showSecondaryLayer]);

  useEffect(() => {
    if (resultLayerRef.current) {
      resultLayerRef.current.setVisible(showResultLayer);
    }
  }, [showResultLayer]);

  useEffect(() => {
    if (wellLayerRef.current) {
      wellLayerRef.current.setVisible(showWellPointsLayer);
    }
  }, [showWellPointsLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !primaryLayer) {
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
      map,
      layerRef: primaryLayerRef,
      source,
      style: createSelectionStyle("primary", showTitles),
      zIndex: 1,
      visible: showPrimaryLayer,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map,
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

    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName: secondaryLayer,
      srsName: "EPSG:3857",
      cqlFilter: buildInClauseFilter(LayerFilter, LayerFilterValue),
    });

    const { cleanup } = replaceVectorLayer({
      map,
      layerRef: secondaryLayerRef,
      source,
      style: createSelectionStyle("secondary", showTitles),
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
    if (!map || !selectionsLocked || !resultLayerName || selectedVillages.length === 0) {
      if (map && resultLayerRef.current) {
        clearVectorLayer(map, resultLayerRef);
      }
      setFeatureCounts((prev) => ({ ...prev, result: 0 }));
      return;
    }

    const source = createWfsUrlVectorSource({
      geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
      workspace: defaultWorkspace,
      layerName: resultLayerName,
      srsName: "EPSG:3857",
      cqlFilter: buildInClauseFilter('"ID"', selectedVillages),
    });

    const { cleanup } = replaceVectorLayer({
      map,
      layerRef: resultLayerRef,
      source,
      style: createSelectionStyle("result", showTitles),
      zIndex: 6,
      visible: showResultLayer,
      onFeaturesLoadEnd: (event) =>
        handleFeaturesLoadEnd({
          event,
          source,
          map,
          onCount: (count) => setFeatureCounts((prev) => ({ ...prev, result: count })),
        }),
    });

    return () => cleanup();
  }, [
    defaultWorkspace,
    resultLayerName,
    selectionsLocked,
    selectedVillages,
    showResultLayer,
    showTitles,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    const features: Feature[] = [];
    normalizedWellPoints.forEach((point) => {
      const lon = Number.parseFloat(point.Longitude);
      const lat = Number.parseFloat(point.Latitude);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return;
      }
      features.push(
        new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          Well_id: point.Well_id,
          Name: point.Name ?? point.Well_id,
          Longitude: lon,
          Latitude: lat,
        }),
      );
    });

    if (wellLayerRef.current) {
      map.removeLayer(wellLayerRef.current);
      wellLayerRef.current = null;
    }

    const source = new VectorSource({ features });
    const layer = new VectorLayer({
      source,
      style: createSelectionStyle("well", showTitles),
      zIndex: 10,
      visible: showWellPointsLayer,
    });

    map.addLayer(layer);
    wellLayerRef.current = layer;
    setFeatureCounts((prev) => ({ ...prev, wells: features.length }));
  }, [normalizedWellPoints, showTitles, showWellPointsLayer]);

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
      const message = error instanceof Error ? error.message : "Failed to set raster layer";
      setError(message);
      setRasterLoading(false);
    }
  }, [layerOpacity, rasterLayerInfo, setError, setRasterLoading, setShowLegend]);

  useEffect(() => {
    const selected = displayRaster.find((item) => item.file_name === selectedradioLayer);
    setRasterLayerInfo(selected ?? null);
  }, [displayRaster, selectedradioLayer, setRasterLayerInfo]);

  const toggleFullScreen = () => {
    toggleBrowserFullscreen(containerRef.current, isFullScreen);
  };

  const togglePanel = (panelName: string) => {
    setActivePanel((prev) => (prev === panelName ? null : panelName));
  };

  const goToHomeView = () => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    map.getView().animate({
      center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
      zoom: INITIAL_ZOOM,
      duration: 320,
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

  const openAddWellMode = () => {
    setPendingWellCoordinate(null);
    setWellDialogPosition(null);
    setWellName("");
    setIsAddingWellPoint(true);
    setActivePanel(null);
  };

  const cancelAddWell = () => {
    setPendingWellCoordinate(null);
    setWellDialogPosition(null);
    setWellName("");
    setIsAddingWellPoint(false);
  };

  const confirmAddWell = () => {
    if (!pendingWellCoordinate) {
      return;
    }

    manualWellCounterRef.current += 1;
    const generatedId = `M${manualWellCounterRef.current}`;
    const pointName = wellName.trim();
    const newPoint: CsvRow = {
      Well_id: generatedId,
      Name: pointName || generatedId,
      Longitude: pendingWellCoordinate.lon.toString(),
      Latitude: pendingWellCoordinate.lat.toString(),
      Distance: "N/A",
    };

    const next = [...normalizedWellPoints, newPoint];
    setWellPoints(next);
    setPendingWellCoordinate(null);
    setWellDialogPosition(null);
    setWellName("");
  };

  const renderLayerPanel = () => (
    <div className="absolute left-1/2 top-16 z-30 w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 px-2 sm:top-20 sm:max-w-xs">
      <div className="rounded-xl border border-white/50 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">Admin Layers</h3>
          <button
            onClick={() => setActivePanel(null)}
            className="rounded-full bg-slate-300 p-1 text-white transition-all duration-200 hover:bg-red-100 hover:text-red-600"
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
                  <div className="text-xs text-gray-500">{featureCounts.primary} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowPrimaryLayer(!showPrimaryLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showPrimaryLayer ? "bg-blue-500" : "bg-gray-300"
                }`}
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
                ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showSecondaryLayer ? "bg-emerald-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showSecondaryLayer ? "text-emerald-800" : "text-gray-600"
                    }`}
                  >
                    Selection Layer
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.secondary} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowSecondaryLayer(!showSecondaryLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showSecondaryLayer ? "bg-emerald-500" : "bg-gray-300"
                }`}
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
              showResultLayer
                ? "border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showResultLayer ? "bg-amber-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showResultLayer ? "text-amber-800" : "text-gray-600"
                    }`}
                  >
                    Result Layer
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.result} features</div>
                </div>
              </div>
              <button
                onClick={() => setShowResultLayer(!showResultLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showResultLayer ? "bg-amber-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showResultLayer ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 ${
              showWellPointsLayer
                ? "border-orange-200 bg-gradient-to-r from-orange-50 to-red-100"
                : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`mr-3 h-3 w-3 rounded-full ${
                    showWellPointsLayer ? "bg-orange-500" : "bg-gray-400"
                  }`}
                />
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      showWellPointsLayer ? "text-orange-800" : "text-gray-600"
                    }`}
                  >
                    Well Points
                  </div>
                  <div className="text-xs text-gray-500">{featureCounts.wells} points</div>
                </div>
              </div>
              <button
                onClick={() => setShowWellPointsLayer(!showWellPointsLayer)}
                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${
                  showWellPointsLayer ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showWellPointsLayer ? "translate-x-5" : "translate-x-0.5"
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
                    Display Labels
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
            className="rounded-full bg-slate-300 p-1 text-white transition-all duration-200 hover:bg-red-100 hover:text-red-600"
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
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-100"
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

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/70 px-3 py-2.5 text-sm text-gray-700">
            <div>
              <div className="font-medium text-gray-800">Add Well Point</div>
              <div className="text-xs text-gray-500">
                Click map to pick location
              </div>
            </div>
            <button
              onClick={openAddWellMode}
              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition-all duration-200 hover:bg-orange-100"
            >
              Add Well
            </button>
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
        layers={displayRaster}
        selectedLayer={selectedradioLayer}
        onToggle={() => setIsLayerPanelOpen((prev) => !prev)}
        onSelectLayer={handleLayerSelection}
      />

      {activePanel === "layers" && renderLayerPanel()}
      {activePanel === "basemap" && renderBaseMapPanel()}
      {activePanel === "tools" && renderToolsPanel()}

      <MapLegendOverlay
        legendUrl={legendUrl}
        showLegend={showLegend}
        hasActiveRaster={Boolean(rasterLayerInfo)}
        onShowLegend={() => setShowLegend(true)}
        onHideLegend={() => setShowLegend(false)}
      />

      <MapCoordinatesOverlay targetId={mouseTargetId} />

      {isAddingWellPoint && pendingWellCoordinate && wellDialogPosition && (
        <div
          className="absolute z-30 w-[280px] rounded-xl border border-orange-200 bg-white/95 shadow-xl"
          style={{ left: wellDialogPosition.x, top: wellDialogPosition.y }}
        >
          <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-3 py-2">
            <h4 className="text-sm font-semibold text-orange-800">Add Well Point</h4>
            <button
              onClick={cancelAddWell}
              className="rounded-full p-1 text-orange-700 transition-colors duration-150 hover:bg-orange-100"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 p-3 text-xs text-slate-700">
            <p>
              {pendingWellCoordinate
                ? "Coordinate selected. Add an optional name and confirm."
                : "Click anywhere on map to select well location."}
            </p>
            {pendingWellCoordinate && (
              <div className="rounded-md border border-stone-200 bg-stone-50 p-2 font-mono">
                <div>Lat: {pendingWellCoordinate.lat.toFixed(6)}</div>
                <div>Lon: {pendingWellCoordinate.lon.toFixed(6)}</div>
              </div>
            )}
            <input
              type="text"
              value={wellName}
              onChange={(event) => setWellName(event.target.value)}
              placeholder="Well name (optional)"
              className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs outline-none focus:border-orange-300"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelAddWell}
                className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddWell}
                disabled={!pendingWellCoordinate}
                className={`rounded-md px-2.5 py-1.5 font-semibold text-white ${
                  pendingWellCoordinate ? "bg-orange-600 hover:bg-orange-500" : "bg-stone-300"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {rasterLoading && (
        <div className="absolute inset-x-0 top-0 z-30 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-white">
          Loading raster layer...
        </div>
      )}

      {selectedState === null && selectedDistricts.length === 0 && selectedSubDistricts.length === 0 && (
        <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow">
          Tip: Double-click map layers to set selection quickly.
        </div>
      )}
    </div>
  );
}
