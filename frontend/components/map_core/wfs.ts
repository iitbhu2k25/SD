import GeoJSON from "ol/format/GeoJSON";
import VectorSource from "ol/source/Vector";

type FilterValue = string | number | Array<string | number> | null | undefined;

interface WfsUrlOptions {
  geoServerUrl: string;
  workspace: string;
  layerName: string;
  srsName?: string;
  cqlFilter?: string | null;
  bbox?: [number, number, number, number] | null;
}

type WfsSourceOptions = WfsUrlOptions;

export function buildInClauseFilter(
  filterField: string | null | undefined,
  filterValue: FilterValue,
): string | null {
  if (!filterField || filterValue == null) {
    return null;
  }

  const values = Array.isArray(filterValue) ? filterValue : [filterValue];
  if (values.length === 0) {
    return null;
  }

  const joinedValues = values.map((item) => `'${item}'`).join(",");
  return `${filterField} IN (${joinedValues})`;
}

export function buildWfsGetFeatureUrl(options: WfsUrlOptions): string {
  const {
    geoServerUrl,
    workspace,
    layerName,
    srsName = "EPSG:3857",
    cqlFilter,
    bbox,
  } = options;

  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: `${workspace}:${layerName}`,
    outputFormat: "application/json",
    srsname: srsName,
  });

  if (cqlFilter) {
    params.set("CQL_FILTER", cqlFilter);
  }

  if (bbox) {
    // Native WFS BBOX param — no geometry column name required
    params.set("BBOX", `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]},EPSG:4326`);
  }

  return `${geoServerUrl}/wfs?${params.toString()}`;
}

export function createWfsUrlVectorSource(options: WfsSourceOptions): VectorSource {
  const url = buildWfsGetFeatureUrl(options);
  return new VectorSource({
    format: new GeoJSON(),
    url,
  });
}
