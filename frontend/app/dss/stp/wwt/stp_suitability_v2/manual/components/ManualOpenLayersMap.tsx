"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, MousePosition, ScaleLine, ZoomSlider, ZoomToExtent } from "ol/control";
import { Draw, Modify, Snap } from "ol/interaction";
import GeoJSON from "ol/format/GeoJSON";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import "ol/ol.css";
import Feature from "ol/Feature";
import { fromExtent } from "ol/geom/Polygon";
import OlPoint from "ol/geom/Point";
import { fromLonLat, transformExtent } from "ol/proj";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import { toast } from "react-toastify";
import { GISCompass, HoverTooltip, baseMaps } from "@/components/MapComponents";
import { createHoverSelectInteraction } from "@/components/map_core/interactions";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import BaseMaps from "@/components/dss_common/BaseMaps";
import MapCoordinatesOverlay from "@/components/dss_common/MapCoordinatesOverlay";
import MapHeaderControls from "@/components/dss_common/MapHeaderControls";
import MapLegendOverlay from "@/components/dss_common/MapLegendOverlay";
import MapRasterSelector from "@/components/dss_common/MapRasterSelector";
import { createWfsUrlVectorSource } from "@/components/map_core/wfs";
import type { ClipRasters } from "../services/manual_stpSuitabilityTypes";
import { useManualAreaStore } from "../stores/manualAreaStore";
import { useManualMapStore } from "../stores/manualMapStore";
import { useManualMultiStore } from "../stores/manualMultiStore";

const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? "";
const INDIA_LAYER = "STP_State";

/**
 * Apply A/B/C... labels to cluster features sorted nearest-first to the polygon centroid.
 * Sorting strategy: use `rank` attribute if present (set by backend), otherwise compute
 * straight-line distance from each feature's bbox centre to the polygon centroid in map coords.
 * centroidLatLon: [lat, lon] in WGS84 (as stored in the area store).
 */
function applyClusterLabels(
  features: import("ol/Feature").default[],
  centroidLatLon?: [number, number],
) {
  const hasRank = features.some((f) => f.get("rank") != null);

  let sorted: import("ol/Feature").default[];
  if (hasRank) {
    sorted = [...features].sort((a, b) => Number(a.get("rank") ?? 9999) - Number(b.get("rank") ?? 9999));
  } else if (centroidLatLon) {
    const [clat, clon] = centroidLatLon;
    const refPt = fromLonLat([clon, clat]);
    const featureMidpoint = (f: import("ol/Feature").default): [number, number] => {
      const ext = f.getGeometry()?.getExtent();
      if (!ext) return [0, 0];
      return [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2];
    };
    sorted = [...features].sort((a, b) => {
      const [ax, ay] = featureMidpoint(a);
      const [bx, by] = featureMidpoint(b);
      return Math.hypot(ax - refPt[0], ay - refPt[1]) - Math.hypot(bx - refPt[0], by - refPt[1]);
    });
  } else {
    sorted = [...features];
  }

  sorted.forEach((feature, idx) => {
    const clusterLabel = String.fromCharCode(65 + idx);
    feature.setStyle(
      new Style({
        stroke: new Stroke({ color: "#1a1a1a", width: 4 }),
        fill: new Fill({ color: "rgba(50, 50, 50, 0.15)" }),
        text: new Text({
          text: clusterLabel,
          font: "bold 18px sans-serif",
          fill: new Fill({ color: "#000000" }),
          stroke: new Stroke({ color: "#ffffff", width: 4 }),
          overflow: true,
          placement: "point",
        }),
      }),
    );
  });
}

const drawLayerStyle = new Style({
  stroke: new Stroke({ color: "#c8a87a", width: 2, lineDash: [5, 5] }),
  fill: new Fill({ color: "rgba(245, 235, 210, 0.10)" }),
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "#c8a87a" }),
    stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
  }),
});

const activeDrawStyle = new Style({
  stroke: new Stroke({ color: "#c8a87a", width: 2, lineDash: [6, 4] }),
  fill: new Fill({ color: "rgba(245, 235, 210, 0.08)" }),
  image: new Circle({
    radius: 4,
    fill: new Fill({ color: "#d4b896" }),
    stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
  }),
});

const geojsonFormat = new GeoJSON({ featureProjection: "EPSG:3857", dataProjection: "EPSG:4326" });

function makeWfsVectorLayer(layerName: string, color: string, fillColor: string, zIndex: number) {
  const source = createWfsUrlVectorSource({
    geoServerUrl: GEOSERVER_URL,
    workspace: "vector_work",
    layerName,
    cqlFilter: null,
  });

  return new VectorLayer({
    source,
    style: new Style({
      stroke: new Stroke({ color, width: 2 }),
      fill: new Fill({ color: fillColor }),
    }),
    zIndex,
  });
}

export default function ManualOpenLayersMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const drawSourceRef = useRef<VectorSource | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const snapInteractionRef = useRef<Snap | null>(null);
  const indiaLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectionLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const bufferOutlineLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const polygonLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drainLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const resultPathLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const previewLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const clusterLimitRef = useRef<number>(10);
  // Multi-polygon layers — polygon outlines + drain points per entry, plus result path layers
  const multiLayersRef = useRef<VectorLayer<VectorSource>[]>([]);
  const multiDrainLayersRef = useRef<VectorLayer<VectorSource>[]>([]);
  // Multi suitability raster layers — one WMS layer per polygon after DSS analyze
  const multiRasterLayersRef = useRef<ImageLayer<ImageWMS>[]>([]);
  const mapInstanceId = useId();
  const mouseTargetId = `mouse-position-${mapInstanceId.replace(/:/g, "")}`;

  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [selectedBaseMap, setSelectedBaseMap] = useState("terrain");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isRasterPanelOpen, setIsRasterPanelOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnPolygon, setHasDrawnPolygon] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    india: true,
    drawnPolygon: true,
    confirmedSelection: true,
    treatmentCluster: true,
  });
  const [featureCounts, setFeatureCounts] = useState<Record<string, number>>({
    india: 0,
    drawnPolygon: 0,
    confirmedSelection: 0,
    treatmentCluster: 0,
    suitablePath: 0,
  });

  // store state
  const selectedMethod = useManualAreaStore((state) => state.selectedMethod);
  const selectionsLocked = useManualAreaStore((state) => state.selectionsLocked);
  const setDrawnPolygon = useManualAreaStore((state) => state.setDrawnPolygon);
  const drawnPolygon = useManualAreaStore((state) => state.drawnPolygon);
  const displayRaster = useManualAreaStore((state) => state.displayRaster);
  const selectionVectorLayer = useManualAreaStore((state) => state.selectionVectorLayer);
  const polygonLayer = useManualAreaStore((state) => state.polygonLayer);
  const bufferBbox = useManualAreaStore((state) => state.bufferBbox);
  const areaCentroid = useManualAreaStore((state) => state.areaCentroid);
  const drainPoints = useManualAreaStore((state) => state.drainPoints);
  const selectedDrainNos = useManualAreaStore((state) => state.selectedDrainNos);
  const previewGeojson = useManualAreaStore((state) => state.previewGeojson);

  const rasterLayerInfo = useManualMapStore((state) => state.rasterLayerInfo);
  const showLegend = useManualMapStore((state) => state.showLegend);
  const layerOpacity = useManualMapStore((state) => state.layerOpacity);
  const selectedRadioLayer = useManualMapStore((state) => state.selectedRadioLayer);
  const resultVectorLayer = useManualMapStore((state) => state.resultVectorLayer);
  const resultPathVectorLayer = useManualMapStore((state) => state.resultPathVectorLayer);
  const showDrainLabels = useManualMapStore((state) => state.showDrainLabels);
  const clusterDistances = useManualMapStore((state) => state.clusterDistances);
  const selectedClusterRank = useManualMapStore((state) => state.selectedClusterRank);
  const handleLayerSelection = useManualMapStore((state) => state.handleLayerSelection);
  const setRasterLayerInfo = useManualMapStore((state) => state.setRasterLayerInfo);
  const setLayerOpacity = useManualMapStore((state) => state.setLayerOpacity);
  const setShowLegend = useManualMapStore((state) => state.setShowLegend);
  const drawingActive = useManualMapStore((state) => state.drawingActive);
  const setDrawingActive = useManualMapStore((state) => state.setDrawingActive);

  // Multi-polygon store
  const multiPolygonResults = useManualMultiStore((state) => state.polygonResults);
  const multiPolygonEntries = useManualMultiStore((state) => state.polygonEntries);
  const multiSelectionsLocked = useManualMultiStore((state) => state.selectionsLocked);

  // When multi is active, build a deduplicated raster list from the first polygon's rasters,
  // replacing per-polygon suitability keys (STP_Suitability_P1, P2...) with a single
  // "STP_Suitability" entry so the selector shows one row per layer type (not one per polygon).
  const activeDisplayRaster = (() => {
    if (!multiSelectionsLocked || multiPolygonEntries.length === 0) return displayRaster;
    const firstEntry = multiPolygonEntries[0];
    const seen = new Set<string>();
    const result: ClipRasters[] = [];
    for (const r of firstEntry.displayRasters ?? []) {
      const displayKey = r.file_name.startsWith("STP_Suitability") ? "STP_Suitability" : r.file_name;
      if (seen.has(displayKey)) continue;
      seen.add(displayKey);
      result.push({ ...r, file_name: displayKey });
    }
    return result;
  })();

  const isPolygonMode = selectedMethod === "polygon";

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return;

    const baseLayer = new TileLayer({
      source: baseMaps.terrain.source(),
      zIndex: 0,
    });
    baseLayerRef.current = baseLayer;

    // India boundary
    const indiaLayer = makeWfsVectorLayer(INDIA_LAYER, "#2563eb", "transparent", 1);
    indiaLayerRef.current = indiaLayer;
    const indiaSource = indiaLayer.getSource();
    if (indiaSource) {
      indiaSource.on("featuresloadend", () => {
        setFeatureCounts((prev) => ({ ...prev, india: indiaSource.getFeatures().length }));
      });
    }

    // Draw source & layer
    const drawSource = new VectorSource();
    drawSourceRef.current = drawSource;
    const drawLayer = new VectorLayer({
      source: drawSource,
      style: drawLayerStyle,
      zIndex: 20,
    });
    drawLayerRef.current = drawLayer;

    const controls = defaultControls().extend([
      new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
      new MousePosition({
        coordinateFormat: (coordinate) => {
          if (!coordinate) return "No coordinates";
          const [longitude, latitude] = coordinate;
          return `${latitude.toFixed(6)} N, ${longitude.toFixed(6)} E`;
        },
        projection: "EPSG:4326",
        className: "custom-mouse-position",
        target: document.getElementById(mouseTargetId) as HTMLElement,
      }),
      new ZoomSlider(),
      new ZoomToExtent({
        tipLabel: "Zoom to India",
        extent: fromLonLat([68, 7]).concat(fromLonLat([97, 37])),
      }),
    ]);

    const map = new Map({
      target: mapRef.current,
      layers: [baseLayer, indiaLayer, drawLayer],
      controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 18,
        constrainResolution: true,
      }),
    });

    map.on("pointermove", (event) => {
      setMousePosition({ x: event.pixel[0], y: event.pixel[1] });
    });

    const hoverInteraction = createHoverSelectInteraction(
      (event) => { setHoveredFeature(event.selected[0] ?? null); },
      (_feature, layer) => Boolean(layer?.get("interactive")),
    );
    map.addInteraction(hoverInteraction);

    mapInstanceRef.current = map;

    return () => {
      map.setTarget("");
    };
  }, [mouseTargetId]);

  // Sync draw interaction when drawingActive, mode, or lock changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const drawSource = drawSourceRef.current;
    if (!map || !drawSource) return;

    // Remove existing interactions
    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    if (modifyInteractionRef.current) {
      map.removeInteraction(modifyInteractionRef.current);
      modifyInteractionRef.current = null;
    }
    if (snapInteractionRef.current) {
      map.removeInteraction(snapInteractionRef.current);
      snapInteractionRef.current = null;
    }

    if (!isPolygonMode || selectionsLocked || !drawingActive) return;

    const draw = new Draw({
      source: drawSource,
      type: "Polygon",
      style: activeDrawStyle,
    });

    draw.on("drawstart", () => {
      setIsDrawing(true);
      drawSource.clear();
    });

    draw.on("drawend", (event) => {
      setIsDrawing(false);
      const geojson = geojsonFormat.writeFeatureObject(event.feature) as GeoJSON.Feature<GeoJSON.Polygon>;
      if (geojson.geometry) {
        setDrawnPolygon({ geojson: geojson.geometry, label: "Drawn Polygon" });
        setHasDrawnPolygon(true);
        // Deactivate drawing mode after polygon is complete
        setDrawingActive(false);
        toast.success("Polygon drawn — click Confirm Selection to proceed");
      }
    });

    const modify = new Modify({ source: drawSource });
    modify.on("modifyend", () => {
      const features = drawSource.getFeatures();
      if (features.length === 0) return;
      const geojson = geojsonFormat.writeFeatureObject(features[0]) as GeoJSON.Feature<GeoJSON.Polygon>;
      if (geojson.geometry) {
        setDrawnPolygon({ geojson: geojson.geometry, label: "Drawn Polygon" });
        toast.info("Polygon updated");
      }
    });

    const snap = new Snap({ source: drawSource });

    map.addInteraction(draw);
    map.addInteraction(modify);
    map.addInteraction(snap);

    drawInteractionRef.current = draw;
    modifyInteractionRef.current = modify;
    snapInteractionRef.current = snap;
  }, [isPolygonMode, selectionsLocked, drawingActive, setDrawnPolygon, setDrawingActive]);

  // When polygon mode is exited, clear draw source and reset drawing state
  useEffect(() => {
    if (!isPolygonMode && drawSourceRef.current) {
      drawSourceRef.current.clear();
      setHasDrawnPolygon(false);
      setDrawingActive(false);
    }
  }, [isPolygonMode, setDrawingActive]);

  // When drawnPolygon is cleared externally (Edit button), clear draw layer too
  useEffect(() => {
    if (!drawnPolygon && drawSourceRef.current) {
      drawSourceRef.current.clear();
      setHasDrawnPolygon(false);
    }
  }, [drawnPolygon]);

  // Show villages + drawn polygon + buffer outline when area is confirmed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous layers
    if (selectionLayerRef.current) {
      map.removeLayer(selectionLayerRef.current);
      selectionLayerRef.current = null;
    }
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    if (drainLayerRef.current) {
      map.removeLayer(drainLayerRef.current);
      drainLayerRef.current = null;
    }

    if (!selectionVectorLayer || !bufferBbox) return;

    const [minLon, minLat, maxLon, maxLat] = bufferBbox;
    const bboxValid = minLon !== 0 || minLat !== 0 || maxLon !== 0 || maxLat !== 0;
    if (!bboxValid) {
      console.warn("[Manual Map] degenerate bufferBbox [0,0,0,0] — check backend response");
      return;
    }

    // Layer 1: villages — blue-purple, thin strokes so they don't overpower
    const villageSource = createWfsUrlVectorSource({
      geoServerUrl: GEOSERVER_URL,
      workspace: "vector_work",
      layerName: selectionVectorLayer,
      cqlFilter: null,
    });
    const villageLayer = new VectorLayer({
      source: villageSource,
      style: new Style({
        stroke: new Stroke({ color: "#6366f1", width: 1 }),
        fill: new Fill({ color: "rgba(99, 102, 241, 0.10)" }),
      }),
      zIndex: 13,
      properties: { interactive: true },
    });
    villageSource.on("featuresloadend", () => {
      setFeatureCounts((prev) => ({ ...prev, confirmedSelection: villageSource.getFeatures().length }));
    });
    selectionLayerRef.current = villageLayer;
    map.addLayer(villageLayer);

    // Layer 2: drawn polygon from GeoServer — cream stroke, very light fill so internals are visible
    if (polygonLayer) {
      const polygonSource = createWfsUrlVectorSource({
        geoServerUrl: GEOSERVER_URL,
        workspace: "vector_work",
        layerName: polygonLayer,
        cqlFilter: null,
      });
      const drawnPolygonLayer = new VectorLayer({
        source: polygonSource,
        style: new Style({
          stroke: new Stroke({ color: "#06b6d4", width: 2.5, lineDash: [5, 5] }),
          fill: new Fill({ color: "rgba(6, 182, 212, 0.06)" }),
        }),
        zIndex: 60,
      });
      polygonSource.on("featuresloadend", () => {
        setFeatureCounts((prev) => ({ ...prev, drawnPolygon: polygonSource.getFeatures().length }));
      });
      polygonLayerRef.current = drawnPolygonLayer;
      map.addLayer(drawnPolygonLayer);
    }

    // Layer 3: drain points from DB within buffer bbox
    const drainSource = new VectorSource();
    const drainLayer = new VectorLayer({
      source: drainSource,
      style: new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: "#7c3aed" }),
          stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
        }),
      }),
      zIndex: 55,
      properties: { interactive: true },
    });
    drainLayerRef.current = drainLayer;
    map.addLayer(drainLayer);

    // Zoom to the drawn polygon bbox (not a padded buffer box)
    const bufferExtent3857 = transformExtent(
      [minLon, minLat, maxLon, maxLat],
      "EPSG:4326",
      "EPSG:3857",
    );
    map.getView().fit(bufferExtent3857, { padding: [60, 60, 60, 60], duration: 1000, maxZoom: 14 });
  }, [selectionVectorLayer, polygonLayer, bufferBbox]);

  // Populate drain points layer — filter to selectedDrainNos if any are chosen, else show all
  // Re-runs when showDrainLabels changes to update label visibility
  useEffect(() => {
    const layer = drainLayerRef.current;
    if (!layer) return;
    const source = layer.getSource() as VectorSource;
    source.clear();
    if (drainPoints.length === 0) return;
    const visible =
      selectedDrainNos.length > 0
        ? drainPoints.filter((dp) => selectedDrainNos.includes(dp.Drain_No))
        : drainPoints;
    const features = visible.map((dp) => {
      const f = new Feature({
        geometry: new OlPoint(fromLonLat([dp.longitude, dp.latitude])),
        Drain_No: dp.Drain_No,
      });
      f.setStyle(
        new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: "#7c3aed" }),
            stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
          }),
          ...(showDrainLabels
            ? {
                text: new Text({
                  text: `#${dp.Drain_No}`,
                  font: "bold 11px sans-serif",
                  fill: new Fill({ color: "#1e293b" }),
                  stroke: new Stroke({ color: "#ffffff", width: 3 }),
                  offsetY: -14,
                  textAlign: "center",
                }),
              }
            : {}),
        }),
      );
      return f;
    });
    source.addFeatures(features);
  }, [drainPoints, selectedDrainNos, showDrainLabels]);

  // Re-style multi-polygon drain features when showDrainLabels toggles
  useEffect(() => {
    for (const layer of multiDrainLayersRef.current) {
      const source = layer.getSource() as VectorSource;
      for (const f of source.getFeatures()) {
        const drainNo = f.get("Drain_No") as number;
        f.setStyle(
          new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: "#dc2626" }),
              stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
            }),
            ...(showDrainLabels
              ? {
                  text: new Text({
                    text: `#${drainNo}`,
                    font: "bold 11px sans-serif",
                    fill: new Fill({ color: "#1e293b" }),
                    stroke: new Stroke({ color: "#ffffff", width: 3 }),
                    offsetY: -14,
                    textAlign: "center",
                  }),
                }
              : {}),
          }),
        );
      }
    }
  }, [showDrainLabels]);

  // Preview layer — show polygon outline before Confirm Selection (from "Upload" button)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (previewLayerRef.current) {
      map.removeLayer(previewLayerRef.current);
      previewLayerRef.current = null;
    }

    if (!previewGeojson) return;

    const source = new VectorSource({
      features: geojsonFormat.readFeatures(previewGeojson),
    });
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#7c3aed", width: 2.5, lineDash: [6, 4] }),
        fill: new Fill({ color: "rgba(124, 58, 237, 0.08)" }),
      }),
      zIndex: 60,
    });
    previewLayerRef.current = layer;
    map.addLayer(layer);

    const extent = source.getExtent();
    if (extent?.every((v) => Number.isFinite(v))) {
      map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 800, maxZoom: 14 });
    }
  }, [previewGeojson]);

  // Sync selectedRadioLayer → rasterLayerInfo (same logic as OpenLayersWorkspace)
  useEffect(() => {
    if (!selectedRadioLayer) {
      setRasterLayerInfo(null);
      return;
    }
    // Multi mode bypasses rasterLayerInfo — each polygon renders its own WMS layer directly
    if (multiSelectionsLocked) return;
    const active = activeDisplayRaster.find((item) => item.file_name === selectedRadioLayer) ?? null;
    setRasterLayerInfo(active);
  }, [selectedRadioLayer, activeDisplayRaster, setRasterLayerInfo, multiSelectionsLocked]);

  // Raster layer — single-file only; multi uses its own per-polygon raster effect above
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (rasterLayerRef.current) {
      map.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
    }

    // Multi mode handles its own rasters — skip single-file raster rendering
    if (multiSelectionsLocked) return;

    if (!rasterLayerInfo) {
      setLegendUrl(null);
      setShowLegend(false);
      return;
    }

    const layerUrl = `${GEOSERVER_URL}/wms`;
    const fullLayerName = rasterLayerInfo.workspace
      ? `${rasterLayerInfo.workspace}:${rasterLayerInfo.layer_name}`
      : rasterLayerInfo.layer_name;

    const wmsSource = new ImageWMS({
      url: layerUrl,
      params: { LAYERS: fullLayerName, FORMAT: "image/png", TRANSPARENT: true },
      ratio: 1,
      serverType: "geoserver",
    });

    const layer = new ImageLayer({
      source: wmsSource,
      opacity: layerOpacity / 100,
      zIndex: 30,
    });

    rasterLayerRef.current = layer;
    map.addLayer(layer);
    setLegendUrl(`${layerUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=`);
    setShowLegend(true);
  }, [rasterLayerInfo, layerOpacity, setShowLegend]);

  // Result vector layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (resultLayerRef.current) {
      map.removeLayer(resultLayerRef.current);
      resultLayerRef.current = null;
    }

    if (!resultVectorLayer) return;

    clusterLimitRef.current = clusterDistances ? clusterDistances.length : 10;

    const source = createWfsUrlVectorSource({
      geoServerUrl: GEOSERVER_URL,
      workspace: "vector_work",
      layerName: resultVectorLayer,
      cqlFilter: null,
    });

    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({ color: "#1a1a1a", width: 4 }),
        fill: new Fill({ color: "rgba(50, 50, 50, 0.15)" }),
      }),
      zIndex: 40,
    });

    const centroidSnap = areaCentroid;
    source.on("featuresloadend", () => {
      const limit = clusterLimitRef.current;
      const allFeatures = source.getFeatures();
      if (allFeatures.length > limit) {
        allFeatures.slice(limit).forEach((f) => source.removeFeature(f));
      }
      applyClusterLabels(source.getFeatures(), centroidSnap ?? undefined);
      setFeatureCounts((prev) => ({ ...prev, treatmentCluster: Math.min(allFeatures.length, limit) }));
      const extent = source.getExtent();
      if (extent?.every((v) => Number.isFinite(v))) {
        map.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 1000, maxZoom: 16 });
      }
    });

    resultLayerRef.current = layer;
    map.addLayer(layer);
  }, [resultVectorLayer, clusterDistances, areaCentroid]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (resultPathLayerRef.current) {
      map.removeLayer(resultPathLayerRef.current);
      resultPathLayerRef.current = null;
    }

    if (!resultPathVectorLayer) return;

    // DSS mode: clusters with pre-computed path_layer — path toggled by cluster click.
    // No-constraint mode: suitable_path used directly — always visible immediately.
    const { selectedClusterRank: rank, clusterDistances: cds } = useManualMapStore.getState();
    const isDssMode = cds !== null && cds.length > 0 && cds.some((c) => c.path_layer != null);
    const isVisible = isDssMode ? rank !== null : true;

    const source = createWfsUrlVectorSource({
      geoServerUrl: GEOSERVER_URL,
      workspace: "vector_work",
      layerName: resultPathVectorLayer,
      cqlFilter: null,
    });

    const layer = new VectorLayer({
      source,
      style: new Style({ stroke: new Stroke({ color: "#16a34a", width: 2.5 }) }),
      zIndex: 41,
      visible: isVisible,
    });

    source.on("featuresloadend", () => {
      setFeatureCounts((prev) => ({ ...prev, suitablePath: source.getFeatures().length }));
    });

    resultPathLayerRef.current = layer;
    map.addLayer(layer);
  }, [resultPathVectorLayer]);

  // Multi-polygon: mirror single-file confirm behavior for each polygon entry
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous multi outline + result path layers
    for (const l of multiLayersRef.current) map.removeLayer(l);
    multiLayersRef.current = [];
    // Clear previous multi drain layers
    for (const l of multiDrainLayersRef.current) map.removeLayer(l);
    multiDrainLayersRef.current = [];

    if (multiPolygonEntries.length === 0) return;

    const allExtents: number[][] = [];

    for (const entry of multiPolygonEntries) {
      // Layer 1: polygon outline from GeoServer (cream dashed, like single-file polygonLayer)
      if (entry.polygonLayer) {
        const polygonSource = createWfsUrlVectorSource({
          geoServerUrl: GEOSERVER_URL,
          workspace: "vector_work",
          layerName: entry.polygonLayer,
          cqlFilter: null,
        });
        const polygonOutlineLayer = new VectorLayer({
          source: polygonSource,
          style: new Style({
            stroke: new Stroke({ color: "#06b6d4", width: 2.5 }),
            fill: new Fill({ color: "rgba(6, 182, 212, 0.06)" }),
          }),
          zIndex: 60 + entry.index,
        });
        map.addLayer(polygonOutlineLayer);
        multiLayersRef.current.push(polygonOutlineLayer);
      }

      // Layer 2: village/buffer area from GeoServer (violet fill, like single-file selectionVectorLayer)
      const villageSource = createWfsUrlVectorSource({
        geoServerUrl: GEOSERVER_URL,
        workspace: "vector_work",
        layerName: entry.vectorLayer,
        cqlFilter: null,
      });
      const villageLayer = new VectorLayer({
        source: villageSource,
        style: new Style({
          stroke: new Stroke({ color: "#6366f1", width: 1 }),
          fill: new Fill({ color: "rgba(99, 102, 241, 0.10)" }),
        }),
        zIndex: 13 + entry.index,
      });
      map.addLayer(villageLayer);
      multiLayersRef.current.push(villageLayer);

      // Layer 3: drain points as violet circles above raster
      const drainSource = new VectorSource();
      const drainLayer = new VectorLayer({
        source: drainSource,
        zIndex: 55 + entry.index,
        properties: { interactive: true },
      });
      const drainFeatures = entry.drainPoints.map((dp) => {
        const f = new Feature({ geometry: new OlPoint(fromLonLat([dp.longitude, dp.latitude])), Drain_No: dp.Drain_No });
        f.setStyle(
          new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: "#7c3aed" }),
              stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
            }),
            ...(showDrainLabels
              ? {
                  text: new Text({
                    text: `#${dp.Drain_No}`,
                    font: "bold 11px sans-serif",
                    fill: new Fill({ color: "#1e293b" }),
                    stroke: new Stroke({ color: "#ffffff", width: 3 }),
                    offsetY: -14,
                    textAlign: "center",
                  }),
                }
              : {}),
          }),
        );
        return f;
      });
      drainSource.addFeatures(drainFeatures);
      map.addLayer(drainLayer);
      multiDrainLayersRef.current.push(drainLayer);

      // Collect bbox for combined zoom
      const [minLon, minLat, maxLon, maxLat] = entry.bufferBbox;
      allExtents.push(transformExtent([minLon, minLat, maxLon, maxLat], "EPSG:4326", "EPSG:3857"));
    }

    // Zoom to fit all polygons combined
    if (allExtents.length > 0) {
      const combined = allExtents.reduce(
        (acc, ext) => [
          Math.min(acc[0], ext[0]),
          Math.min(acc[1], ext[1]),
          Math.max(acc[2], ext[2]),
          Math.max(acc[3], ext[3]),
        ],
        [Infinity, Infinity, -Infinity, -Infinity]
      );
      if (combined.every((v) => Number.isFinite(v))) {
        map.getView().fit(combined as [number, number, number, number], { padding: [60, 60, 60, 60], duration: 1000, maxZoom: 14 });
      }
    }
  }, [multiPolygonEntries, showDrainLabels]);

  // Multi rasters — when multi is active, show the selected raster type for ALL polygons simultaneously.
  // selectedRadioLayer names non-suitability rasters by file_name (same key across polygons),
  // and suitability rasters by "STP_Suitability_P{i+1}" — we match by stripping the suffix too.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous multi raster layers
    for (const l of multiRasterLayersRef.current) map.removeLayer(l);
    multiRasterLayersRef.current = [];

    if (!multiSelectionsLocked || multiPolygonEntries.length === 0) {
      return;
    }

    // Determine which raster file_name to show for each polygon.
    // For suitability rasters keyed "STP_Suitability_P{n}", map to each polygon's own key.
    // For other rasters (NDVI, Slope etc.) the file_name is the same across all polygons.
    // Nothing selected — don't render any raster until user picks one
    if (!selectedRadioLayer) return;

    const isSuitabilitySelected = selectedRadioLayer.startsWith("STP_Suitability");

    for (const entry of multiPolygonEntries) {
      let raster = null;
      if (isSuitabilitySelected) {
        // Each polygon has its own suitability raster keyed by index
        raster = entry.displayRasters.find((r) => r.file_name === `STP_Suitability_P${entry.index + 1}`);
      } else {
        // Non-suitability: same file_name key across all polygons
        raster = entry.displayRasters.find((r) => r.file_name === selectedRadioLayer);
      }

      if (!raster) continue;

      const fullLayerName = raster.workspace
        ? `${raster.workspace}:${raster.layer_name}`
        : raster.layer_name;
      const wmsSource = new ImageWMS({
        url: `${GEOSERVER_URL}/wms`,
        params: { LAYERS: fullLayerName, FORMAT: "image/png", TRANSPARENT: true },
        ratio: 1,
        serverType: "geoserver",
      });
      const layer = new ImageLayer({
        source: wmsSource,
        opacity: layerOpacity / 100,
        zIndex: 30 + entry.index,
      });
      map.addLayer(layer);
      multiRasterLayersRef.current.push(layer);
    }

    // Update legend from first polygon's rendered raster
    const firstEntry = multiPolygonEntries[0];
    if (firstEntry) {
      const firstRaster = isSuitabilitySelected
        ? firstEntry.displayRasters.find((r) => r.file_name === "STP_Suitability_P1")
        : firstEntry.displayRasters.find((r) => r.file_name === selectedRadioLayer);
      if (firstRaster) {
        const fullName = firstRaster.workspace
          ? `${firstRaster.workspace}:${firstRaster.layer_name}`
          : firstRaster.layer_name;
        setLegendUrl(`${GEOSERVER_URL}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullName}&STYLE=`);
        setShowLegend(true);
      }
    }
  }, [multiPolygonEntries, multiSelectionsLocked, selectedRadioLayer, layerOpacity, setShowLegend]);

  // Multi-polygon result layers — cluster polygons (DSS) and/or road paths (non-DSS)
  // Mirrors single-file resultVectorLayer + resultPathVectorLayer behavior, one per polygon
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const addedLayers: VectorLayer<VectorSource>[] = [];

    for (const result of multiPolygonResults) {
      const numClusters = result.clusterDistances ? result.clusterDistances.length : 10;
      const entryCentroid = multiPolygonEntries.find((e) => e.index === result.index)?.centroid ?? null;

      // Cluster layer (DSS mode) — same dark style as single-file resultVectorLayer
      if (result.clusterLayer) {
        const source = createWfsUrlVectorSource({
          geoServerUrl: GEOSERVER_URL,
          workspace: "vector_work",
          layerName: result.clusterLayer,
          cqlFilter: null,
        });
        const layer = new VectorLayer({
          source,
          style: new Style({
            stroke: new Stroke({ color: "#1a1a1a", width: 4 }),
            fill: new Fill({ color: "rgba(50, 50, 50, 0.15)" }),
          }),
          zIndex: 40 + result.index,
        });
        source.on("featuresloadend", () => {
          const allFeatures = source.getFeatures();
          if (allFeatures.length > numClusters) {
            allFeatures.slice(numClusters).forEach((f) => source.removeFeature(f));
          }
          applyClusterLabels(source.getFeatures(), entryCentroid ?? undefined);
          const extent = source.getExtent();
          if (extent?.every((v) => Number.isFinite(v))) {
            map.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 800, maxZoom: 16 });
          }
        });
        map.addLayer(layer);
        addedLayers.push(layer);
      }

      // Road path layer (non-DSS mode) — same orange style as single-file resultPathVectorLayer
      if (result.suitablePath) {
        const source = createWfsUrlVectorSource({
          geoServerUrl: GEOSERVER_URL,
          workspace: "vector_work",
          layerName: result.suitablePath,
          cqlFilter: null,
        });
        const layer = new VectorLayer({
          source,
          style: new Style({
            stroke: new Stroke({ color: "#f97316", width: 3 }),
            fill: new Fill({ color: "rgba(249,115,22,0.1)" }),
          }),
          zIndex: 50 + result.index,
        });
        source.on("featuresloadend", () => {
          const extent = source.getExtent();
          if (extent?.every((v) => Number.isFinite(v))) {
            map.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 800, maxZoom: 16 });
          }
        });
        map.addLayer(layer);
        addedLayers.push(layer);
      }
    }

    return () => {
      for (const l of addedLayers) map.removeLayer(l);
    };
  }, [multiPolygonResults]);

  // Sync layer visibility state → actual OL layer visibility
  useEffect(() => {
    indiaLayerRef.current?.setVisible(layerVisibility.india ?? true);
  }, [layerVisibility.india]);

  useEffect(() => {
    drawLayerRef.current?.setVisible(layerVisibility.drawnPolygon ?? true);
    polygonLayerRef.current?.setVisible(layerVisibility.drawnPolygon ?? true);
  }, [layerVisibility.drawnPolygon]);

  useEffect(() => {
    selectionLayerRef.current?.setVisible(layerVisibility.confirmedSelection ?? true);
  }, [layerVisibility.confirmedSelection]);

  useEffect(() => {
    resultLayerRef.current?.setVisible(layerVisibility.treatmentCluster ?? true);
  }, [layerVisibility.treatmentCluster]);

  // DSS mode (clusters have pre-computed path_layer): toggled by cluster click.
  // No-constraint mode (suitable_path only): always visible.
  useEffect(() => {
    if (!resultPathLayerRef.current) return;
    const isDssMode = clusterDistances !== null && clusterDistances.length > 0 && clusterDistances.some((c) => c.path_layer != null);
    resultPathLayerRef.current.setVisible(isDssMode ? selectedClusterRank !== null : true);
  }, [selectedClusterRank, resultPathVectorLayer, clusterDistances]);

  // Fullscreen listener
  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  const clearDrawnPolygon = () => {
    drawSourceRef.current?.clear();
    setDrawnPolygon(null);
    setHasDrawnPolygon(false);
  };

  const changeBaseMap = (key: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;
    mapInstanceRef.current.removeLayer(baseLayerRef.current);
    const newBase = new TileLayer({ source: baseMaps[key].source(), zIndex: 0 });
    baseLayerRef.current = newBase;
    mapInstanceRef.current.getLayers().insertAt(0, newBase);
    setSelectedBaseMap(key);
  };

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-gray-50">
      <div ref={containerRef} className="relative h-full w-full flex-grow overflow-hidden">
        <div ref={mapRef} className="h-full w-full bg-blue-50" />

        <div className="hidden md:block">
          <GISCompass />
        </div>
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

        <MapHeaderControls
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel((cur) => (cur === panel ? null : panel))}
          onToggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
        />

        <MapRasterSelector
          isOpen={isRasterPanelOpen}
          layers={activeDisplayRaster}
          selectedLayer={selectedRadioLayer}
          onToggle={() => setIsRasterPanelOpen((cur) => !cur)}
          onSelectLayer={handleLayerSelection}
        />

        {/* Draw toolbar — shown in polygon mode when drawing is active */}
        {isPolygonMode && !selectionsLocked && drawingActive && (
          <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${isDrawing ? "animate-pulse bg-violet-500" : "bg-violet-400"}`}
              />
              <span className="text-xs font-medium text-violet-700">
                {isDrawing
                  ? "Drawing… double-click to finish"
                  : "Click on the map to place points"}
              </span>
              <button
                type="button"
                onClick={() => setDrawingActive(false)}
                className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {/* After polygon drawn — show edit hint */}
        {isPolygonMode && !selectionsLocked && !drawingActive && hasDrawnPolygon && (
          <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-700">Polygon ready — drag vertices to edit</span>
              <button
                type="button"
                onClick={clearDrawnPolygon}
                className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {activePanel === "layers" && (
          <div className="absolute left-1/2 top-20 z-30 mx-2 w-full max-w-md -translate-x-1/2 rounded-xl bg-white/95 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Administrative Layers</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close layers panel"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {(
                [
                  { id: "india", label: "India Layer", color: "#2563eb" },
                  { id: "drawnPolygon", label: "Drawn Polygon", color: "#06b6d4" },
                  { id: "confirmedSelection", label: "Confirmed Selection", color: "#0f766e" },
                  { id: "treatmentCluster", label: "Treatment Cluster", color: "#1a1a1a" },
                ] as const
              ).map((item) => {
                const active = layerVisibility[item.id] ?? true;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 ${
                      active
                        ? "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                        : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className="mr-3 h-4 w-4 rounded-full"
                          style={{ backgroundColor: active ? item.color : "#9ca3af" }}
                        />
                        <span className={`font-semibold ${active ? "text-slate-800" : "text-gray-600"}`}>
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-700">
                          {featureCounts[item.id] ?? 0} features
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLayerVisibility((prev) => ({ ...prev, [item.id]: !active }))
                          }
                          className="relative h-6 w-12 rounded-full transition-all duration-300"
                          style={{ backgroundColor: active ? item.color : "#d1d5db" }}
                        >
                          <span
                            className={`mx-0.5 mt-0.5 block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                              active ? "translate-x-6" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {rasterLayerInfo && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold text-purple-800">Raster Layer</span>
                  </div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span>Opacity</span>
                    <span>{layerOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    step={10}
                    value={layerOpacity}
                    onChange={(e) => setLayerOpacity(Number.parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activePanel === "basemap" && (
          <BaseMaps
            baseMaps={baseMaps}
            selectedBaseMap={selectedBaseMap}
            onChangeBaseMap={changeBaseMap}
            onClose={() => setActivePanel(null)}
          />
        )}

        <MapLegendOverlay
          legendUrl={legendUrl}
          showLegend={showLegend}
          hasActiveRaster={Boolean(rasterLayerInfo)}
          onShowLegend={() => setShowLegend(true)}
          onHideLegend={() => setShowLegend(false)}
        />

        <MapCoordinatesOverlay targetId={mouseTargetId} />
      </div>
    </div>
  );
}
