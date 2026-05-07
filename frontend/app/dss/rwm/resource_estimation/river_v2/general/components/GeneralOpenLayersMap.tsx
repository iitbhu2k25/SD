"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, RegularShape, Stroke, Style, Circle as CircleStyle } from "ol/style";
import { transformExtent } from "ol/proj";
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
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import { useUiModeStore } from "../../services/uiModeService";
import { useGeneralViewModel } from "../hooks/useGeneralViewModel";

const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL || "http://localhost:8080/geoserver";
const FALLBACK_WORKSPACE = process.env.NEXT_PUBLIC_FAST_WORKSPACE || "myworkspace";

const FEATURE_NAME_FIELDS = [
  "name",
  "Name",
  "NAME",
  "district",
  "District",
  "DISTRICT",
  "district_name",
  "District_Name",
  "DISTRICT_NAME",
  "dist_name",
  "DIST_NAME",
  "state",
  "State",
  "STATE",
  "state_name",
  "State_Name",
  "STATE_NAME",
  "ST_NM",
  "st_nm",
  "area_ha",
];

const WQI_CLASS_COLORS: Record<string, string> = {
  Excellent: "#22c55e",
  Good: "#3b82f6",
  Poor: "#eab308",
  "Very Poor": "#f97316",
  Unsuitable: "#ef4444",
};

const getPointColor = (feature: any) => {
  const wqiClass = feature.get("wqi_class") || feature.get("WQI_Class") || feature.get("wqiClass");
  return WQI_CLASS_COLORS[wqiClass] || "#64748b";
};

const pointStyle = (feature: any) => {
  const type = feature.get("type");
  if (type !== "valid") {
    return new Style({
      image: new RegularShape({
        fill: new Fill({ color: "#dc2626" }),
        stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
        points: 3,
        radius: 9,
        angle: Math.PI,
      }),
    });
  }

  const color = getPointColor(feature);
  return new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "#ffffff", width: 1.8 }),
    }),
  });
};

const hoverStyle = (feature: any) => {
  const geometryType = feature.getGeometry()?.getType();

  if (geometryType === "Point" || geometryType === "MultiPoint") {
    const featureType = feature.get("type");
    const isRejected = featureType && featureType !== "valid";

    if (isRejected) {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: "#dc2626" }),
          stroke: new Stroke({ color: "#ffffff", width: 2.5 }),
          points: 3,
          radius: 12,
          angle: Math.PI,
        }),
        zIndex: 999,
      });
    }

    return new Style({
      image: new CircleStyle({
        radius: 12,
        fill: new Fill({ color: getPointColor(feature) }),
        stroke: new Stroke({ color: "#ffffff", width: 3 }),
      }),
      zIndex: 999,
    });
  }

  return new Style({
    stroke: new Stroke({ color: "#f59e0b", width: 3 }),
    fill: new Fill({ color: "transparent" }),
    zIndex: 999,
  });
};

const getFeatureName = (feature: any) => {
  for (const field of FEATURE_NAME_FIELDS) {
    const value = feature.get(field);
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return null;
};

const attachFeatureNames = (source: VectorSource, fallbackName: string) => {
  const setFeatureName = (feature: any) => {
    feature.set("name", getFeatureName(feature) || fallbackName, true);
  };

  source.getFeatures().forEach(setFeatureName);
  source.on("addfeature", (event: any) => {
    if (event.feature) setFeatureName(event.feature);
  });
  source.on("featuresloadend", () => {
    source.getFeatures().forEach(setFeatureName);
  });
};

const getRasterLayerName = (raster: any, activeParameter: string) => {
  const layerName =
    activeParameter === "WQI"
      ? raster.layerName
      : raster.parameterLayers?.[activeParameter] || raster.layerName;
  return layerName.includes(":") ? layerName : `${raster.workspace}:${layerName}`;
};

const getLegendStats = (raster: any, activeParameter: string) =>
  activeParameter !== "WQI" && raster?.parameterStatistics?.[activeParameter]
    ? raster.parameterStatistics[activeParameter]
    : raster?.statistics;

const getPublicWmsUrl = () => `${GEOSERVER_URL.replace(/\/+$/, "")}/wms`;

const getPublicWfsUrl = (layerName: string) => {
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: layerName,
    outputFormat: "application/json",
  });
  return `${GEOSERVER_URL.replace(/\/+$/, "")}/ows?${params.toString()}`;
};

const getLayerNameFromWmsUrl = (wmsUrl: string | null | undefined) => {
  if (!wmsUrl) return null;
  try {
    const parsed = new URL(wmsUrl, window.location.origin);
    return (
      parsed.searchParams.get("layers") ||
      parsed.searchParams.get("LAYERS") ||
      parsed.searchParams.get("layer") ||
      parsed.searchParams.get("LAYER")
    );
  } catch {
    return null;
  }
};

export default function GeneralOpenLayersMap() {
  const mouseTargetId = useId().replace(/:/g, "-");
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const indiaLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const uploadLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const uploadHoverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const pointsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const rasterLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const fittedPointsKeyRef = useRef<string | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { upload, map: mapStore, activeResult, activeMapGeoJson } = useGeneralViewModel();
  const isDark = useUiModeStore((s) => s.isDark);

  const activeRaster = activeResult?.wqiRaster || null;
  const legendStats = useMemo(
    () => getLegendStats(activeRaster, upload.activeParameter),
    [activeRaster, upload.activeParameter],
  );

  useEffect(() => {
    if (!mapRef.current) return;

    const { map, baseLayer } = createIndiaMapWithBaseLayer({
      target: mapRef.current,
      mouseTargetId,
      baseMaps,
      defaultBaseMapKey: mapStore.selectedBaseMap,
      center: INDIA_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 5,
      maxZoom: 18,
    });
    baseLayerRef.current = baseLayer;

    const indiaSource = new VectorSource({
      url: `${GEOSERVER_URL}/${FALLBACK_WORKSPACE}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${FALLBACK_WORKSPACE}:India&outputFormat=application/json`,
      format: new GeoJSON(),
    });
    attachFeatureNames(indiaSource, "India");

    const indiaLayer = new VectorLayer({
      source: indiaSource,
      style: new Style({
        stroke: new Stroke({ color: "#2563eb", width: 1.8 }),
        fill: new Fill({ color: "rgba(37, 99, 235, 0.04)" }),
      }),
      zIndex: 1,
    });
    map.addLayer(indiaLayer);
    indiaLayerRef.current = indiaLayer;

    const hoverInteraction = createHoverSelectInteraction((event) => {
      const feature = event.selected[0] ?? null;
      setHoveredFeature(feature);
      mapStore.setHoveredFeature(feature);
    }, undefined, hoverStyle);

    const cleanupMouseTracking = attachPointerMoveTracker(map, setMousePosition);
    map.addInteraction(hoverInteraction);
    mapInstanceRef.current = map;

    return () => {
      cleanupMouseTracking();
      indiaLayerRef.current = null;
      map.setTarget("");
    };
  }, [mouseTargetId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => attachFullscreenChangeListener(setIsFullScreen), []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (indiaLayerRef.current) {
      indiaLayerRef.current.setVisible(!upload.layerInfo);
    }

    if (uploadLayerRef.current) {
      map.removeLayer(uploadLayerRef.current);
      uploadLayerRef.current = null;
    }
    if (uploadHoverLayerRef.current) {
      map.removeLayer(uploadHoverLayerRef.current);
      uploadHoverLayerRef.current = null;
    }

    if (!upload.layerInfo || !mapStore.showUploadedLayer) {
      return;
    }

    const uploadLayerName =
      getLayerNameFromWmsUrl(upload.layerInfo.wmsUrl) ||
      (upload.layerInfo.layerName.includes(":")
        ? upload.layerInfo.layerName
        : `${FALLBACK_WORKSPACE}:${upload.layerInfo.layerName}`);
    const uploadLayer = new TileLayer({
      source: new TileWMS({
        url: getPublicWmsUrl(),
        params: {
          LAYERS: uploadLayerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
        transition: 0,
      }),
      opacity: 0.55,
      zIndex: 5,
    });
    map.addLayer(uploadLayer);
    uploadLayerRef.current = uploadLayer;

    const uploadHoverSource = new VectorSource({
      url: getPublicWfsUrl(uploadLayerName),
      format: new GeoJSON(),
    });
    attachFeatureNames(uploadHoverSource, upload.layerInfo.layerName || "Uploaded boundary");

    const uploadHoverLayer = new VectorLayer({
      source: uploadHoverSource,
      style: new Style({
        stroke: new Stroke({ color: "rgba(168, 85, 247, 0)" }),
        fill: new Fill({ color: "rgba(168, 85, 247, 0.01)" }),
      }),
      zIndex: 6,
    });
    map.addLayer(uploadHoverLayer);
    uploadHoverLayerRef.current = uploadHoverLayer;

    if (upload.layerInfo.bbox) {
      const extent = transformExtent(upload.layerInfo.bbox, "EPSG:4326", "EPSG:3857");
      map.getView().fit(extent, { padding: [55, 55, 55, 55], duration: 600 });
    }
  }, [upload.layerInfo, mapStore.showUploadedLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (pointsLayerRef.current) {
      map.removeLayer(pointsLayerRef.current);
      pointsLayerRef.current = null;
    }

    if (!activeMapGeoJson?.features?.length || !mapStore.showWqiPoints) {
      return;
    }

    const source = new VectorSource({
      features: new GeoJSON().readFeatures(activeMapGeoJson, {
        featureProjection: "EPSG:3857",
      }),
    });
    source.getFeatures().forEach((feature) => {
      const props = feature.getProperties();
      const name =
        props.type === "valid"
          ? `WQI ${props.wqi_score ?? ""} - ${props.wqi_class ?? "Valid"}`
          : "Rejected point";
      feature.set("name", name, true);
    });

    const pointsLayer = new VectorLayer({
      source,
      style: pointStyle,
      zIndex: 30,
    });
    map.addLayer(pointsLayer);
    pointsLayerRef.current = pointsLayer;

    const pointsFitKey = activeResult?.uploadId || activeResult?.fileLabel || null;
    if (source.getFeatures().length && pointsFitKey && fittedPointsKeyRef.current !== pointsFitKey) {
      const extent = source.getExtent();
      if (extent) {
        map.getView().fit(extent, { padding: [55, 55, 55, 55], duration: 500 });
        fittedPointsKeyRef.current = pointsFitKey;
      }
    }
  }, [activeMapGeoJson, activeResult?.fileLabel, activeResult?.uploadId, mapStore.showWqiPoints]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (rasterLayerRef.current) {
      map.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
    }

    if (!activeRaster || !mapStore.showRaster) {
      return;
    }

    const layerName = getRasterLayerName(activeRaster, upload.activeParameter);
    const rasterLayer = new TileLayer({
      source: new TileWMS({
        url: `${GEOSERVER_URL}/wms`,
        params: {
          LAYERS: layerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        serverType: "geoserver",
        transition: 0,
      }),
      opacity: mapStore.opacity / 100,
      zIndex: 10,
    });
    map.addLayer(rasterLayer);
    rasterLayerRef.current = rasterLayer;
  }, [activeRaster, upload.activeParameter, mapStore.showRaster, mapStore.opacity]);

  const toggleFullScreen = () => toggleBrowserFullscreen(containerRef.current, isFullScreen);
  const togglePanel = (panelName: string) =>
    mapStore.setActivePanel(mapStore.activePanel === panelName ? null : panelName);

  const changeBaseMap = (baseMapKey: string) => {
    replaceBaseLayer({
      map: mapInstanceRef.current!,
      baseLayerRef,
      baseMapKey,
      baseMaps,
    });
    mapStore.setSelectedBaseMap(baseMapKey);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100" ref={containerRef}>
      <div ref={mapRef} className="h-full w-full" />
      <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

      <MapHeaderControls
        activePanel={mapStore.activePanel}
        onTogglePanel={togglePanel}
        onToggleFullScreen={toggleFullScreen}
        isFullScreen={isFullScreen}
      />

      {mapStore.activePanel === "basemap" && (
        <BaseMaps
          baseMaps={baseMaps}
          selectedBaseMap={mapStore.selectedBaseMap}
          onChangeBaseMap={changeBaseMap}
          onClose={() => mapStore.setActivePanel(null)}
        />
      )}

      {activeRaster && mapStore.showLegend && (
        <div
          className={`absolute bottom-24 right-2 z-[9] w-[210px] overflow-hidden rounded-lg border shadow-xl backdrop-blur-md sm:bottom-10 ${
            isDark ? "border-[#1e3a5f] bg-[#050911]/95 text-slate-200" : "border-stone-200 bg-white/95 text-slate-700"
          }`}
        >
          <div
            className={`flex items-center justify-between border-b px-3 py-2 ${
              isDark ? "border-[#1e3a5f]" : "border-stone-100"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide">
              {upload.activeParameter === "WQI" ? "WQI Index" : upload.activeParameter}
            </span>
            <button
              type="button"
              onClick={() => mapStore.setShowLegend(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              title="Close legend"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
          <div className="p-3">
            <div
              className="mb-2 h-4 w-full rounded"
              style={{
                background:
                  "linear-gradient(to right, #22c55e, #a3e635, #eab308, #f97316, #ef4444)",
              }}
            />
            <div className="flex justify-between text-[10px] font-semibold">
              <span>Min {(legendStats?.min ?? 0).toFixed(1)}</span>
              <span>Max {(legendStats?.max ?? 0).toFixed(1)}</span>
            </div>
            <div className="mt-1 text-center text-[10px] opacity-70">
              {upload.activeParameter === "WQI" ? "Excellent to Unsuitable" : "Low to High"}
            </div>
          </div>
        </div>
      )}

      {activeRaster && !mapStore.showLegend && (
        <button
          type="button"
          onClick={() => mapStore.setShowLegend(true)}
          className="absolute bottom-2 right-10 z-[9] rounded-full border border-indigo-200 bg-white/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 shadow-md transition hover:bg-indigo-50"
        >
          Legend
        </button>
      )}

      <MapCoordinatesOverlay targetId={mouseTargetId} />
    </div>
  );
}
