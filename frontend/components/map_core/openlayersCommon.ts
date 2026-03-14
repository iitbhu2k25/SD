import {
  defaults as defaultControls,
  MousePosition,
  ScaleLine,
  ZoomSlider,
  ZoomToExtent,
} from "ol/control";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import View from "ol/View";
import { fromLonLat } from "ol/proj";

const INDIA_BOUNDS = {
  west: 68,
  south: 7,
  east: 97,
  north: 37,
};

export function formatMouseCoordinates(coordinate?: number[]): string {
  if (!coordinate) return "No coordinates";
  const [longitude, latitude] = coordinate;
  return `${latitude.toFixed(6)} deg N, ${longitude.toFixed(6)} deg E`;
}

export function createIndiaMapControls(mouseTargetId: string) {
  return defaultControls().extend([
    new ScaleLine({ units: "metric", bar: true, steps: 4, minWidth: 140 }),
    new MousePosition({
      coordinateFormat: formatMouseCoordinates,
      projection: "EPSG:4326",
      className: "custom-mouse-position",
      target: document.getElementById(mouseTargetId) as HTMLElement,
    }),
    new ZoomSlider(),
    new ZoomToExtent({
      tipLabel: "Zoom to India",
      extent: fromLonLat([INDIA_BOUNDS.west, INDIA_BOUNDS.south]).concat(
        fromLonLat([INDIA_BOUNDS.east, INDIA_BOUNDS.north]),
      ),
    }),
  ]);
}

export function buildLegendGraphicUrl(
  layerUrl: string,
  fullLayerName: string,
): string {
  return `${layerUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${fullLayerName}&LEGEND_OPTIONS=fontAntiAliasing:true;fontSize:12;fontColor:0x000000;bgColor:0xFFFFFF;dpi:96`;
}

interface BaseMapConfig {
  source: () => any;
}

interface MapCenter {
  lon: number;
  lat: number;
}

interface CreateIndiaMapWithBaseLayerOptions {
  target: HTMLElement;
  mouseTargetId: string;
  baseMaps: Record<string, BaseMapConfig>;
  defaultBaseMapKey: string;
  center: MapCenter;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

interface ReplaceBaseLayerOptions {
  map: Map;
  baseLayerRef: { current: TileLayer<any> | null };
  baseMapKey: string;
  baseMaps: Record<string, BaseMapConfig>;
}

export function replaceBaseLayer({
  map,
  baseLayerRef,
  baseMapKey,
  baseMaps,
}: ReplaceBaseLayerOptions): boolean {
  if (!baseLayerRef.current || !baseMaps[baseMapKey]) {
    return false;
  }

  map.removeLayer(baseLayerRef.current);

  const newBaseLayer = new TileLayer({
    source: baseMaps[baseMapKey].source(),
    zIndex: 0,
    properties: { type: "base" },
  });

  baseLayerRef.current = newBaseLayer;
  map.getLayers().insertAt(0, newBaseLayer);
  return true;
}

export function createIndiaMapWithBaseLayer(
  options: CreateIndiaMapWithBaseLayerOptions,
) {
  const {
    target,
    mouseTargetId,
    baseMaps,
    defaultBaseMapKey,
    center,
    zoom,
    minZoom,
    maxZoom,
  } = options;

  const defaultBaseMap = baseMaps[defaultBaseMapKey];
  if (!defaultBaseMap) {
    throw new Error(`Base map '${defaultBaseMapKey}' is not configured`);
  }

  const baseLayer = new TileLayer({
    source: defaultBaseMap.source(),
    zIndex: 0,
    properties: { type: "base" },
  });

  const map = new Map({
    target,
    layers: [baseLayer],
    controls: createIndiaMapControls(mouseTargetId),
    view: new View({
      center: fromLonLat([center.lon, center.lat]),
      zoom,
      minZoom,
      maxZoom,
      constrainResolution: true,
      smoothExtentConstraint: true,
      enableRotation: true,
      constrainRotation: false,
    }),
  });

  return { map, baseLayer };
}

