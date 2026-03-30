"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Map from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, MousePosition, ScaleLine, ZoomSlider, ZoomToExtent } from "ol/control";
import { pointerMove } from "ol/events/condition";
import GeoJSON from "ol/format/GeoJSON";
import Select from "ol/interaction/Select";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import "ol/ol.css";
import { fromLonLat } from "ol/proj";
import ImageWMS from "ol/source/ImageWMS";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import { GISCompass, HoverTooltip, baseMaps } from "@/components/MapComponents";
import { buildInClauseFilter, createWfsUrlVectorSource } from "@/components/map_core/wfs";
import { INDIA_CENTER, INITIAL_ZOOM } from "@/interface/openlayer";
import BaseMaps from "../../../stp_priority_v2/shared/ui/BaseMaps";
import CloseIcon from "../../../stp_priority_v2/shared/ui/icons/CloseIcon";
import MapHeaderControls from "../../../stp_priority_v2/shared/ui/MapHeaderControls";
import type { ClipRasters } from "../../services/stpSuitabilityTypes";

interface LayerFilterLike {
  filterField: string | null;
  filterValue: string | number | string[] | number[] | null;
}

export interface WorkspaceLayerConfig {
  id: string;
  label: string;
  layerName: string | null;
  workspace?: string;
  filter?: LayerFilterLike | null;
  color: string;
  fillColor?: string;
  zIndex: number;
  visibleByDefault?: boolean;
  toggleable?: boolean;
  interactive?: boolean;
  fitOnLoad?: boolean;
}

interface OpenLayersWorkspaceProps {
  layerPanelTitle: string;
  workspace?: string;
  rasterLayers: ClipRasters[];
  selectedRasterName: string | null;
  rasterLayerInfo: ClipRasters | null;
  onSelectRasterLayer: (name: string) => void;
  onSetRasterLayerInfo: (layer: ClipRasters | null) => void;
  layerConfigs: WorkspaceLayerConfig[];
}

interface FeatureCounts {
  [key: string]: number;
}

interface VisibilityState {
  [key: string]: boolean;
}

function getFeatureLabel(feature: any) {
  return (
    feature.get("name") ||
    feature.get("Name") ||
    feature.get("NAME") ||
    feature.get("village_name") ||
    feature.get("area_ha") ||
    feature.get("area_m2")
  );
}

export default function OpenLayersWorkspace({
  layerPanelTitle,
  workspace = "vector_work",
  rasterLayers,
  selectedRasterName,
  rasterLayerInfo,
  onSelectRasterLayer,
  onSetRasterLayerInfo,
  layerConfigs,
}: OpenLayersWorkspaceProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<TileLayer<any> | null>(null);
  const rasterLayerRef = useRef<ImageLayer<ImageWMS> | null>(null);
  const vectorLayersRef = useRef<Record<string, VectorLayer<VectorSource>>>({});

  const [featureCounts, setFeatureCounts] = useState<FeatureCounts>({});
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [layerOpacity, setLayerOpacity] = useState(70);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string | null>(null);
  const [showTitles, setShowTitles] = useState(false);
  const [selectedBaseMap, setSelectedBaseMap] = useState("satellite");
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isRasterPanelOpen, setIsRasterPanelOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);

  const toggleableLayers = useMemo(
    () => layerConfigs.filter((layer) => layer.toggleable !== false),
    [layerConfigs],
  );

  useEffect(() => {
    setVisibility((current) => {
      const next = { ...current };
      for (const layer of layerConfigs) {
        if (next[layer.id] === undefined) {
          next[layer.id] = layer.visibleByDefault ?? true;
        }
      }
      return next;
    });
  }, [layerConfigs]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const initialBaseLayer = new TileLayer({
      source: baseMaps.satellite.source(),
      zIndex: 0,
      properties: { type: "base" },
    });

    baseLayerRef.current = initialBaseLayer;

    const controls = defaultControls().extend([
      new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
      new MousePosition({
        coordinateFormat: (coordinate) => {
          if (!coordinate) {
            return "No coordinates";
          }
          const [longitude, latitude] = coordinate;
          return `${latitude.toFixed(6)} N, ${longitude.toFixed(6)} E`;
        },
        projection: "EPSG:4326",
        className: "custom-mouse-position",
        target: document.getElementById("mouse-position") as HTMLElement,
      }),
      new ZoomSlider(),
      new ZoomToExtent({
        tipLabel: "Zoom to India",
        extent: fromLonLat([68, 7]).concat(fromLonLat([97, 37])),
      }),
    ]);

    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls,
      view: new View({
        center: fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]),
        zoom: INITIAL_ZOOM,
        minZoom: 4,
        maxZoom: 18,
        constrainResolution: true,
        smoothExtentConstraint: true,
        enableRotation: true,
        constrainRotation: false,
      }),
    });

    const hoverInteraction = new Select({
      condition: pointerMove,
      style: new Style({
        stroke: new Stroke({ color: "#ffaa00", width: 2 }),
        fill: new Fill({ color: "transparent" }),
      }),
      filter: (_feature, layer) => Boolean(layer?.get("interactive")),
    });

    hoverInteraction.on("select", (event) => {
      setHoveredFeature(event.selected.length > 0 ? event.selected[0] : null);
    });

    map.on("pointermove", (event) => {
      setMousePosition({ x: event.pixel[0], y: event.pixel[1] });
    });

    map.addInteraction(hoverInteraction);
    mapInstanceRef.current = map;

    return () => {
      map.setTarget("");
    };
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);

  useEffect(() => {
    if (!selectedRasterName) {
      onSetRasterLayerInfo(null);
      return;
    }

    const activeRaster =
      rasterLayers.find((item) => item.file_name === selectedRasterName) ?? null;
    onSetRasterLayerInfo(activeRaster);
  }, [onSetRasterLayerInfo, rasterLayers, selectedRasterName]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    const existingLayers = vectorLayersRef.current;
    const nextCounts: FeatureCounts = {};

    Object.values(existingLayers).forEach((layer) => map.removeLayer(layer));
    vectorLayersRef.current = {};
    setError(null);

    layerConfigs.forEach((config) => {
      nextCounts[config.id] = 0;

      if (!config.layerName) {
        return;
      }

      const source = createWfsUrlVectorSource({
        geoServerUrl: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}`,
        workspace: config.workspace ?? workspace,
        layerName: config.layerName,
        cqlFilter: buildInClauseFilter(
          config.filter?.filterField,
          config.filter?.filterValue,
        ),
      });

      const vectorLayer = new VectorLayer({
        source,
        style: (feature, resolution) => {
          const geometry = feature.getGeometry();
          const geometryType = geometry?.getType?.() ?? "";
          const featureLabel = getFeatureLabel(feature);
          const zoom = Math.round(Math.log(156543.03392 / resolution) / Math.log(2));
          const styles = [];

          if (geometryType.includes("Polygon")) {
            styles.push(
              new Style({
                stroke: new Stroke({ color: config.color, width: 2 }),
                fill: new Fill({ color: config.fillColor ?? "transparent" }),
              }),
            );
          }

          if (geometryType.includes("LineString")) {
            styles.push(
              new Style({
                stroke: new Stroke({ color: config.color, width: 3 }),
              }),
            );
          }

          if (geometryType.includes("Point")) {
            styles.push(
              new Style({
                image: new Circle({
                  radius: 6,
                  fill: new Fill({ color: `${config.color}80` }),
                  stroke: new Stroke({ color: config.color, width: 2 }),
                }),
              }),
            );
          }

          if (showTitles && featureLabel && zoom > 8) {
            styles.push(
              new Style({
                text: new Text({
                  text: featureLabel.toString(),
                  font: "12px Arial, sans-serif",
                  fill: new Fill({ color: config.color }),
                  stroke: new Stroke({ color: "#ffffff", width: 3 }),
                  offsetY: geometryType.includes("Point") ? -20 : 0,
                  textAlign: "center",
                  textBaseline: "middle",
                }),
              }),
            );
          }

          return styles;
        },
        zIndex: config.zIndex,
        visible: visibility[config.id] ?? (config.visibleByDefault ?? true),
        properties: {
          interactive: config.interactive !== false,
        },
      });

      source.on("featuresloadend", () => {
        const count = source.getFeatures().length;
        setFeatureCounts((current) => ({ ...current, [config.id]: count }));

        if (config.fitOnLoad && count > 0) {
          const extent = source.getExtent();
          if (extent && extent.every((value) => Number.isFinite(value))) {
            map.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 16,
            });
          }
        }
      });

      source.on("featuresloaderror", () => {
        setError(`Failed to load ${config.label}`);
      });

      map.addLayer(vectorLayer);
      vectorLayersRef.current[config.id] = vectorLayer;
    });

    setFeatureCounts(nextCounts);
  }, [layerConfigs, showTitles, visibility, workspace]);

  useEffect(() => {
    Object.entries(vectorLayersRef.current).forEach(([id, layer]) => {
      layer.setVisible(visibility[id] ?? true);
    });
  }, [visibility]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    if (rasterLayerRef.current) {
      map.removeLayer(rasterLayerRef.current);
      rasterLayerRef.current = null;
    }

    if (!rasterLayerInfo) {
      setLegendUrl(null);
      return;
    }

    try {
      const layerUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/wms`;
      const fullLayerName = rasterLayerInfo.workspace
        ? `${rasterLayerInfo.workspace}:${rasterLayerInfo.layer_name}`
        : rasterLayerInfo.layer_name;

      const wmsSource = new ImageWMS({
        url: layerUrl,
        params: {
          LAYERS: fullLayerName,
          TILED: true,
          FORMAT: "image/png",
          TRANSPARENT: true,
        },
        ratio: 1,
        serverType: "geoserver",
      });

      const layer = new ImageLayer({
        source: wmsSource,
        visible: true,
        opacity: layerOpacity / 100,
        zIndex: 30,
      });

      rasterLayerRef.current = layer;
      map.addLayer(layer);
      setLegendUrl(
        `${layerUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&STYLE=`,
      );
    } catch (caughtError: any) {
      setError(`Error setting up raster layer: ${caughtError.message}`);
    }
  }, [layerOpacity, rasterLayerInfo]);

  const toggleFullScreen = () => {
    if (!containerRef.current) {
      return;
    }
    if (!isFullScreen) {
      containerRef.current.requestFullscreen?.();
      return;
    }
    document.exitFullscreen?.();
  };

  const changeBaseMap = (baseMapKey: string) => {
    if (!mapInstanceRef.current || !baseLayerRef.current) {
      return;
    }

    mapInstanceRef.current.removeLayer(baseLayerRef.current);
    const newBaseLayer = new TileLayer({
      source: baseMaps[baseMapKey].source(),
      zIndex: 0,
      properties: { type: "base" },
    });
    baseLayerRef.current = newBaseLayer;
    mapInstanceRef.current.getLayers().insertAt(0, newBaseLayer);
    setSelectedBaseMap(baseMapKey);
  };

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div
        ref={containerRef}
        className="relative h-full w-full flex-grow overflow-hidden border border-gray-200 shadow-2xl"
      >
        <div ref={mapRef} className="h-full w-full bg-blue-50" />

        <div className="hidden md:block">
          <GISCompass />
        </div>
        <HoverTooltip hoveredFeature={hoveredFeature} mousePosition={mousePosition} />

        <MapHeaderControls
          activePanel={activePanel}
          onTogglePanel={(panel) => setActivePanel((current) => (current === panel ? null : panel))}
          onToggleFullScreen={toggleFullScreen}
          isFullScreen={isFullScreen}
        />

        <div className="group absolute right-4 top-3 z-20">
          <button
            onClick={() => setIsRasterPanelOpen((current) => !current)}
            className="relative rounded-full border border-white/20 bg-white/90 p-2 shadow-lg transition-all duration-200 hover:scale-110 hover:opacity-80"
          >
            <Image src="/openlayerslogo.svg" alt="Logo" width={32} height={32} />
            <span className="pointer-events-none absolute -bottom-10 -left-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Raster Layers
            </span>
          </button>
        </div>

        {activePanel === "basemap" && (
          <BaseMaps
            baseMaps={baseMaps}
            selectedBaseMap={selectedBaseMap}
            onChangeBaseMap={changeBaseMap}
            onClose={() => setActivePanel(null)}
          />
        )}

        {isRasterPanelOpen && rasterLayers.length > 0 && (
          <div className="absolute right-4 top-20 z-20 w-80 rounded-xl border border-gray-200 bg-white/95 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Select Layer</h3>
              <button
                onClick={() => setIsRasterPanelOpen(false)}
                className="cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close raster layers panel"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {rasterLayers.map((layer, index) => (
                <div key={`${layer.file_name}-${index}`} className="mb-3 flex cursor-pointer items-center rounded-lg p-3 hover:bg-blue-50">
                  <input
                    type="radio"
                    id={`layer-${layer.file_name}-${index}`}
                    name="layerSelection"
                    value={layer.file_name}
                    checked={selectedRasterName === layer.file_name}
                    onChange={() => onSelectRasterLayer(layer.file_name)}
                    className="mr-3 h-4 w-4 cursor-pointer text-blue-600"
                  />
                  <label
                    htmlFor={`layer-${layer.file_name}-${index}`}
                    className="cursor-pointer text-sm text-gray-700"
                  >
                    {layer.file_name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePanel === "layers" && (
          <div className="absolute left-1/2 top-20 z-30 mx-2 w-full max-w-md -translate-x-1/2 rounded-xl bg-white/95 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{layerPanelTitle}</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close layers panel"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {toggleableLayers.map((layer) => {
                const active = visibility[layer.id] ?? true;
                return (
                  <div
                    key={layer.id}
                    className={`rounded-xl border p-4 ${
                      active
                        ? "border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100"
                        : "border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`mr-3 h-4 w-4 rounded-full ${active ? "bg-blue-500" : "bg-gray-400"}`}
                          style={active ? { backgroundColor: layer.color } : undefined}
                        />
                        <span className={`font-semibold ${active ? "text-slate-800" : "text-gray-600"}`}>
                          {layer.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-700">
                          {featureCounts[layer.id] ?? 0} features
                        </span>
                        <button
                          onClick={() =>
                            setVisibility((current) => ({
                              ...current,
                              [layer.id]: !(current[layer.id] ?? true),
                            }))
                          }
                          className={`relative h-6 w-12 rounded-full transition-all duration-300 ${
                            active ? "bg-blue-500" : "bg-gray-300"
                          }`}
                          style={active ? { backgroundColor: layer.color } : undefined}
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
                    onChange={(event) => setLayerOpacity(Number.parseInt(event.target.value, 10))}
                    className="w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activePanel === "tools" && (
          <div className="absolute left-1/2 top-20 z-30 mx-2 w-full max-w-md -translate-x-1/2 rounded-xl bg-white/95 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Map Tools</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close map tools panel"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTitles((current) => !current)}
                className={`flex flex-col items-center rounded-xl border p-4 transition-all duration-200 ${
                  showTitles
                    ? "border-green-200 bg-gradient-to-br from-green-50 to-green-100 text-green-700"
                    : "border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700"
                }`}
              >
                <span className="mb-2 text-lg font-semibold">{showTitles ? "ON" : "OFF"}</span>
                <span className="text-sm font-medium">Display Labels</span>
              </button>

              <button
                onClick={() => setHoveredFeature(null)}
                className="flex flex-col items-center rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-gray-700 hover:bg-gray-200"
              >
                <CloseIcon className="mb-2 h-8 w-8" />
                <span className="text-sm font-medium">Clear Hover</span>
              </button>

              <button
                onClick={() => {
                  const view = mapInstanceRef.current?.getView();
                  if (!view) {
                    return;
                  }
                  view.setCenter(fromLonLat([INDIA_CENTER.lon, INDIA_CENTER.lat]));
                  view.setZoom(INITIAL_ZOOM);
                }}
                className="flex flex-col items-center rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-4 text-gray-700 hover:bg-gray-200"
              >
                <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a2 2 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-sm font-medium">Home View</span>
              </button>
            </div>
          </div>
        )}

        {legendUrl && rasterLayerInfo && (
          <div
            className={`absolute bottom-16 right-16 z-20 rounded-xl bg-white/95 p-2 shadow-2xl backdrop-blur-md transition-all duration-200 ${
              isFullScreen ? "w-[250px]" : "w-[150px]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Legend</span>
              <button
                onClick={() => setLegendUrl(null)}
                className="cursor-pointer rounded-full p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Close legend"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <Image
              src={legendUrl}
              alt="Layer Legend"
              width={200}
              height={300}
              className="h-auto w-full rounded-lg border border-gray-200 object-contain"
              onErrorCapture={() => setError("Failed to load legend")}
              unoptimized
            />
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-10 rounded-lg border border-slate-600 bg-slate-800/90 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <div className="text-xs font-mono text-slate-100" id="mouse-position" />
          </div>
        </div>

        {error && (
          <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-xl">
            <svg className="mr-3 h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="pr-8 text-sm font-medium">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute right-2 top-2 text-red-400 hover:text-red-600"
            >
              x
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
