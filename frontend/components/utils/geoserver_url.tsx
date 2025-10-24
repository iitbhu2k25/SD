import { Vector as VectorSource } from "ol/source";
import GeoJSON from "ol/format/GeoJSON";

interface LayerFilter {
  filterField?: string | null;
  filterValue?: string | string[] | number[] | null;
}

interface WFSOptions {
  workspace: string;
  layerName: string;
  layerFilter?: LayerFilter;
  srs?: string;
  url?: string;
}

export const createWFSVectorSource = ({
  workspace,
  layerName,
  layerFilter,
  srs = "EPSG:3857",
  url = "/geoserver/api/wfs"
}: WFSOptions): VectorSource => {
  // base params
  const wfsParams: Record<string, string> = {
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: `${workspace}:${layerName}`,
    outputFormat: "application/json",
    srsname: srs,
  };

  // apply optional CQL filter
  if (layerFilter?.filterField && layerFilter?.filterValue && layerFilter.filterValue.length > 0) {
    const filterValues = Array.isArray(layerFilter.filterValue)
      ? layerFilter.filterValue.map((v) => `'${v}'`).join(",")
      : `'${layerFilter.filterValue}'`;

    wfsParams.CQL_FILTER = `${layerFilter.filterField} IN (${filterValues})`;
  }

  // vector source with custom loader
  const vectorSource = new VectorSource({
    format: new GeoJSON(),
    loader: (extent, resolution, projection) => {
      const requestParams = { ...wfsParams };

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(requestParams).toString(),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const format = new GeoJSON();
          const features = format.readFeatures(data, {
            dataProjection: srs,
            featureProjection: projection,
          });
          vectorSource.clear();
          vectorSource.addFeatures(features);
        })
        .catch((err) => {
          console.log(`Error loading WFS features (${layerName}):`, err);
        });
    },
  });

  return vectorSource;
};
