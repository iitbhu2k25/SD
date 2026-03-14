import Map from "ol/Map";
import VectorSource from "ol/source/Vector";

interface FitExtentOptions {
  map: Map | null | undefined;
  source: VectorSource;
  padding?: [number, number, number, number];
  duration?: number;
}

interface HandleFeaturesLoadEndOptions extends FitExtentOptions {
  event: any;
  onCount?: (count: number) => void;
  onLoaded?: () => void;
  shouldFit?: boolean | ((count: number) => boolean);
}

export function fitSourceExtentIfValid(options: FitExtentOptions) {
  const { map, source, padding = [50, 50, 50, 50], duration = 1000 } = options;
  if (!map) {
    return false;
  }

  const extent = source.getExtent();
  const hasValidExtent = extent && extent.some((value) => isFinite(value));
  if (!hasValidExtent) {
    return false;
  }

  map.getView().fit(extent, { padding, duration });
  return true;
}

export function handleFeaturesLoadEnd(options: HandleFeaturesLoadEndOptions) {
  const {
    event,
    source,
    map,
    onCount,
    onLoaded,
    shouldFit = true,
    padding,
    duration,
  } = options;

  const count = event?.features ? event.features.length : 0;
  onCount?.(count);
  onLoaded?.();

  const allowFit =
    typeof shouldFit === "function" ? shouldFit(count) : shouldFit;

  if (allowFit) {
    fitSourceExtentIfValid({
      map,
      source,
      padding,
      duration,
    });
  }

  return count;
}
