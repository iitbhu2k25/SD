import Map from "ol/Map";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";

type FeatureLoadHandler = (event: any) => void;

interface ReplaceVectorLayerOptions {
  map: Map;
  layerRef: { current: VectorLayer<VectorSource> | null };
  source: VectorSource;
  style?: any;
  zIndex: number;
  visible?: boolean;
  onFeaturesLoadEnd?: FeatureLoadHandler;
  onFeaturesLoadError?: FeatureLoadHandler;
}

export function clearVectorLayer(
  map: Map,
  layerRef: { current: VectorLayer<VectorSource> | null },
) {
  if (!layerRef.current) {
    return;
  }

  map.removeLayer(layerRef.current);
  layerRef.current = null;
}

export function replaceVectorLayer({
  map,
  layerRef,
  source,
  style,
  zIndex,
  visible = true,
  onFeaturesLoadEnd,
  onFeaturesLoadError,
}: ReplaceVectorLayerOptions) {
  const vectorLayer = new VectorLayer({
    source,
    style,
    zIndex,
    visible,
  });

  if (onFeaturesLoadEnd) {
    source.on("featuresloadend", onFeaturesLoadEnd);
  }

  if (onFeaturesLoadError) {
    source.on("featuresloaderror", onFeaturesLoadError);
  }

  if (layerRef.current) {
    map.removeLayer(layerRef.current);
  }

  map.addLayer(vectorLayer);
  layerRef.current = vectorLayer;

  const cleanup = () => {
    if (onFeaturesLoadEnd) {
      source.un("featuresloadend", onFeaturesLoadEnd);
    }
    if (onFeaturesLoadError) {
      source.un("featuresloaderror", onFeaturesLoadError);
    }
  };

  return { layer: vectorLayer, cleanup };
}
