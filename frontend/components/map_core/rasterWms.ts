import Map from "ol/Map";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { buildLegendGraphicUrl } from "./openlayersCommon";

export interface RasterLayerInfoLite {
  workspace?: string;
  layer_name?: string;
}

interface RasterNameOptions {
  fallbackWorkspace?: string;
  fallbackLayerName?: string;
}

interface CreateRasterLayerOptions {
  geoServerUrl: string;
  fullLayerName: string;
  layerName: string;
  opacity: number;
  zIndex?: number;
}

interface RasterLayerResult {
  legendUrl: string;
  layerId: string;
  layer: ImageLayer<ImageWMS>;
}

export function clearRasterLayers(
  map: Map,
  layersRef: { current: Record<string, any> },
) {
  Object.entries(layersRef.current).forEach(([id, layer]) => {
    map.removeLayer(layer);
    delete layersRef.current[id];
  });
}

export function resolveRasterLayerNames(
  rasterLayerInfo: RasterLayerInfoLite,
  options: RasterNameOptions = {},
) {
  const workspace = rasterLayerInfo.workspace || options.fallbackWorkspace || "";
  const layerName = rasterLayerInfo.layer_name || options.fallbackLayerName || "";

  if (!layerName) {
    throw new Error("Raster layer name is missing");
  }

  const fullLayerName = workspace ? `${workspace}:${layerName}` : layerName;
  return { workspace, layerName, fullLayerName };
}

export function createRasterWmsLayer(
  options: CreateRasterLayerOptions,
): RasterLayerResult {
  const {
    geoServerUrl,
    fullLayerName,
    layerName,
    opacity,
    zIndex = 3,
  } = options;
  const layerUrl = `${geoServerUrl}/wms`;
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
    opacity,
    zIndex,
  });

  return {
    legendUrl: buildLegendGraphicUrl(layerUrl, fullLayerName),
    layerId: `raster-${layerName}-${Date.now()}`,
    layer,
  };
}
