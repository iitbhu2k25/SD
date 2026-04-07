"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  GeoJSON,
  LayersControl,
  MapContainer,
  ScaleControl,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { useRsqAdmin, useRsqAnalysis, useRsqDrain, useRsqView } from "./RsqState";

const baseMaps = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  terrain: {
    url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
    attribution: 'Map tiles by Stamen Design, data by OpenStreetMap contributors',
  },
  cartoLight: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  topo: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
};

const RSQ_LEGEND = [
  { label: "Safe", color: "#27ae60", range: "<= 70%" },
  { label: "Semi-Critical", color: "#f39c12", range: "70-90%" },
  { label: "Critical", color: "#6006cd", range: "90-100%" },
  { label: "Over-Exploited", color: "#c0392b", range: "> 100%" },
  { label: "No Data", color: "#95a5a6", range: "N/A" },
];

type RsqMapClientProps = {
  comparisonEnabled?: boolean;
};

type FeatureInfo = {
  title: string;
  properties: Array<{ key: string; value: string }>;
};

function buildWfsUrl(typeName: string, cqlFilter?: string) {
  const base = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${typeName}&outputFormat=application/json&srsName=EPSG:4326`;
  return cqlFilter ? `${base}&CQL_FILTER=${encodeURIComponent(cqlFilter)}` : base;
}

function buildDssVectorWfsUrl(typeName: string, cqlFilter?: string) {
  const base = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=dss_vector:${typeName}&outputFormat=application/json&srsName=EPSG:4326`;
  return cqlFilter ? `${base}&CQL_FILTER=${encodeURIComponent(cqlFilter)}` : base;
}

function useGeoJson(url: string | null) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setData(null);
      return;
    }

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return data;
}

function createPropertyRows(properties: Record<string, any>) {
  return Object.entries(properties)
    .filter(([key]) => key !== "geometry")
    .map(([key, value]) => ({
      key,
      value: value === null || value === undefined || value === "" ? "-" : String(value),
    }));
}

function resolveRsqFillColor(properties: Record<string, any> = {}) {
  const direct = properties.color || properties.Color || properties.fill || properties.Fill;
  if (typeof direct === "string" && direct.trim()) return direct;

  const status = String(properties.status || properties.Status || "").toLowerCase();
  if (status.includes("safe")) return "#27ae60";
  if (status.includes("semi")) return "#f39c12";
  if (status.includes("critical")) return "#6006cd";
  if (status.includes("over")) return "#c0392b";
  if (status.includes("no data")) return "#95a5a6";

  return "#00BCD4";
}

function getFeatureLabel(properties: Record<string, any>, fallback: string) {
  return (
    properties.name ||
    properties.Name ||
    properties.village_na ||
    properties.Village_Na ||
    properties.village_name ||
    properties.Drain_Name ||
    properties.drain_name ||
    properties.Stretch_Na ||
    properties.district ||
    properties.District ||
    fallback
  );
}

function FitToData({
  dataSets,
  onMapMove,
}: {
  dataSets: any[];
  onMapMove?: (coords: { lat: number; lon: number }) => void;
}) {
  const map = useMap();
  const fittedRef = useRef<string>("");

  useEffect(() => {
    const data = dataSets.find(Boolean);
    if (!data) return;

    const signature = JSON.stringify(
      dataSets.map((item) => (item?.features ? item.features.length : item ? 1 : 0)),
    );

    if (signature === fittedRef.current) return;

    const bounds = L.geoJSON(data).getBounds();
    if (!bounds.isValid()) return;

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    fittedRef.current = signature;
    if (onMapMove) {
      const center = map.getCenter();
      onMapMove({ lat: center.lat, lon: center.lng });
    }
  }, [dataSets, map, onMapMove]);

  return null;
}

function MapPositionTracker({ onMove }: { onMove: (coords: { lat: number; lon: number }) => void }) {
  useMapEvents({
    moveend: (event) => {
      const center = event.target.getCenter();
      onMove({ lat: center.lat, lon: center.lng });
    },
  });

  return null;
}

function buildLayerHandlers(
  title: string,
  setFeatureInfo: (info: FeatureInfo) => void,
) {
  return {
    onEachFeature: (feature: any, layer: L.Layer) => {
      (layer as L.Path).on({
        click: () => {
          setFeatureInfo({
            title: getFeatureLabel(feature.properties || {}, title),
            properties: createPropertyRows(feature.properties || {}),
          });
        },
      });
    },
  };
}

function drainPointToLayer(_feature: any, latlng: L.LatLng) {
  return L.circleMarker(latlng, {
    radius: 5,
    color: "#0f766e",
    weight: 1.5,
    fillColor: "#14b8a6",
    fillOpacity: 0.9,
  });
}

function isSelectedRiverFeature(feature: any, selectedRiver: number | null) {
  if (!selectedRiver) return false;
  const code = feature?.properties?.River_Code ?? feature?.properties?.river_code;
  return Number(code) === Number(selectedRiver);
}

function isSelectedStretchFeature(feature: any, selectedStretch: number | null) {
  if (!selectedStretch) return false;
  const id = feature?.properties?.Stretch_ID ?? feature?.properties?.stretch_id;
  return Number(id) === Number(selectedStretch);
}

function MapPanel({
  dataSets,
  analysisData,
  analysisTitle,
  analysisStyle,
  baseMap,
  setBaseMap,
  featureInfo,
  setFeatureInfo,
  fitData,
  onMapMove,
  activeView,
  drainSelection,
}: {
  dataSets: {
    basinData: any;
    indiaData: any;
    stateData: any;
    districtData: any;
    blockData: any;
    villageData: any;
    riversData: any;
    stretchesData: any;
    drainsData: any;
    catchmentsData: any;
  };
  analysisData: any;
  analysisTitle: string;
  analysisStyle: L.StyleFunction<any>;
  baseMap: keyof typeof baseMaps;
  setBaseMap: (map: keyof typeof baseMaps) => void;
  featureInfo: FeatureInfo | null;
  setFeatureInfo: (info: FeatureInfo) => void;
  fitData: any[];
  onMapMove: (coords: { lat: number; lon: number }) => void;
  activeView: "admin" | "drain";
  drainSelection: {
    selectedRiver: number | null;
    selectedStretch: number | null;
  };
}) {
  const layerStyles = useMemo(
    () => ({
      basin: { color: "#6f11119d", weight: 3, fillOpacity: 0 } as L.PathOptions,
      india: { color: "#1d4ed8", weight: 2, fillOpacity: 0.02 } as L.PathOptions,
      state: { color: "#ef4444", weight: 2, fillOpacity: 0.03 } as L.PathOptions,
      district: { color: "#16a34a", weight: 1.6, fillOpacity: 0.03 } as L.PathOptions,
      block: { color: "#2563eb", weight: 1.4, fillOpacity: 0.03 } as L.PathOptions,
      village: { color: "#eab308", weight: 1, fillOpacity: 0.18 } as L.PathOptions,
      river: { color: "#1d4ed8", weight: 2.5, fillOpacity: 0 } as L.PathOptions,
      stretch: { color: "#7c3aed", weight: 2.5, fillOpacity: 0 } as L.PathOptions,
      drain: { color: "#0f766e", weight: 2.5, fillOpacity: 0.04 } as L.PathOptions,
      catchment: { color: "#ea580c", weight: 1.5, fillOpacity: 0.08 } as L.PathOptions,
      analysis:
        analysisTitle.includes("Comparison")
          ? ({ color: "#7c2d12", weight: 1.5, fill: true, fillOpacity: 0.82, opacity: 1 } as L.PathOptions)
          : ({ color: "#1e293b", weight: 1.5, fill: true, fillOpacity: 0.82, opacity: 1 } as L.PathOptions),
    }),
    [analysisTitle],
  );

  const handlers = useMemo(
    () => ({
      basin: buildLayerHandlers("Basin Boundary", setFeatureInfo),
      india: buildLayerHandlers("India", setFeatureInfo),
      state: buildLayerHandlers("State", setFeatureInfo),
      district: buildLayerHandlers("District", setFeatureInfo),
      block: buildLayerHandlers("Sub-District", setFeatureInfo),
      village: buildLayerHandlers("Village", setFeatureInfo),
      river: buildLayerHandlers("River", setFeatureInfo),
      stretch: buildLayerHandlers("Stretch", setFeatureInfo),
      drain: buildLayerHandlers("Drain", setFeatureInfo),
      catchment: buildLayerHandlers("Catchment", setFeatureInfo),
      analysis: buildLayerHandlers(analysisTitle, setFeatureInfo),
    }),
    [analysisTitle, setFeatureInfo],
  );

  const riverStyle = useMemo(
    () =>
      ((feature: any) => {
        const selected = activeView === "drain" && isSelectedRiverFeature(feature, drainSelection.selectedRiver);
        return {
          color: selected ? "#1d05f3" : "#1d4ed8",
          weight: selected ? 4 : 2.5,
          fillOpacity: 0,
          opacity: 0.95,
        };
      }) as L.StyleFunction<any>,
    [activeView, drainSelection.selectedRiver],
  );

  const stretchStyle = useMemo(
    () =>
      ((feature: any) => {
        const selected = activeView === "drain" && isSelectedStretchFeature(feature, drainSelection.selectedStretch);
        return {
          color: selected ? "#ef4444" : "#7c3aed",
          weight: selected ? 5 : 2.5,
          fillOpacity: 0,
          opacity: 0.95,
        };
      }) as L.StyleFunction<any>,
    [activeView, drainSelection.selectedStretch],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100 shadow-lg">
      <MapContainer center={[22.5937, 82.9739]} zoom={5} zoomControl={false} style={{ height: "100%", width: "100%" }}>
        <ZoomControl position="topleft" />
        <ScaleControl position="bottomleft" />
        <MapPositionTracker onMove={onMapMove} />
        <FitToData dataSets={fitData} onMapMove={onMapMove} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked={baseMap === "osm"} name="OpenStreetMap">
            <TileLayer url={baseMaps.osm.url} attribution={baseMaps.osm.attribution} eventHandlers={{ add: () => setBaseMap("osm") }} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseMap === "terrain"} name="Terrain">
            <TileLayer url={baseMaps.terrain.url} attribution={baseMaps.terrain.attribution} eventHandlers={{ add: () => setBaseMap("terrain") }} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseMap === "cartoLight"} name="Carto Light">
            <TileLayer url={baseMaps.cartoLight.url} attribution={baseMaps.cartoLight.attribution} eventHandlers={{ add: () => setBaseMap("cartoLight") }} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseMap === "satellite"} name="Satellite">
            <TileLayer
              url={baseMaps.satellite.url}
              attribution={baseMaps.satellite.attribution}
              eventHandlers={{ add: () => setBaseMap("satellite") }}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={baseMap === "topo"} name="Topographic">
            <TileLayer url={baseMaps.topo.url} attribution={baseMaps.topo.attribution} eventHandlers={{ add: () => setBaseMap("topo") }} />
          </LayersControl.BaseLayer>

          {dataSets.basinData && <LayersControl.Overlay checked name="Basin Boundary"><GeoJSON data={dataSets.basinData} style={layerStyles.basin} {...handlers.basin} /></LayersControl.Overlay>}
          {dataSets.indiaData && <LayersControl.Overlay checked name="India"><GeoJSON data={dataSets.indiaData} style={layerStyles.india} {...handlers.india} /></LayersControl.Overlay>}
          {dataSets.stateData && <LayersControl.Overlay checked name="State"><GeoJSON data={dataSets.stateData} style={layerStyles.state} {...handlers.state} /></LayersControl.Overlay>}
          {dataSets.districtData && <LayersControl.Overlay checked name="District"><GeoJSON data={dataSets.districtData} style={layerStyles.district} {...handlers.district} /></LayersControl.Overlay>}
          {dataSets.blockData && <LayersControl.Overlay checked name="Sub-District"><GeoJSON data={dataSets.blockData} style={layerStyles.block} {...handlers.block} /></LayersControl.Overlay>}
          {dataSets.villageData && <LayersControl.Overlay checked name="Village"><GeoJSON data={dataSets.villageData} style={layerStyles.village} {...handlers.village} /></LayersControl.Overlay>}
          {dataSets.riversData && <LayersControl.Overlay checked name="River"><GeoJSON data={dataSets.riversData} style={riverStyle} {...handlers.river} /></LayersControl.Overlay>}
          {dataSets.stretchesData && <LayersControl.Overlay checked name="Stretch"><GeoJSON data={dataSets.stretchesData} style={stretchStyle} {...handlers.stretch} /></LayersControl.Overlay>}
          {dataSets.drainsData && (
            <LayersControl.Overlay checked name="Drain">
              <GeoJSON data={dataSets.drainsData} style={layerStyles.drain} pointToLayer={drainPointToLayer} {...handlers.drain} />
            </LayersControl.Overlay>
          )}
          {dataSets.catchmentsData && <LayersControl.Overlay checked name="Catchment"><GeoJSON data={dataSets.catchmentsData} style={layerStyles.catchment} {...handlers.catchment} /></LayersControl.Overlay>}
        </LayersControl>

        {analysisData && <GeoJSON key={analysisTitle} data={analysisData as any} style={analysisStyle} {...handlers.analysis} />}
      </MapContainer>

      <div className="pointer-events-none absolute left-15 top-4 z-[1500] rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
        <span className="text-sm font-semibold text-slate-700">{analysisTitle}</span>
      </div>

      <div className="pointer-events-none absolute bottom-15 left-4 z-[1500] w-[220px] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">RSQ Legend</div>
        <div className="space-y-2">
          {RSQ_LEGEND.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="text-slate-500">{item.range}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-17 top-2 z-[1500] max-h-[320px] w-[280px] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {featureInfo?.title || "Feature Details"}
        </div>
        {featureInfo ? (
          <div className="space-y-1.5">
            {featureInfo.properties.map((row) => (
              <div key={row.key} className="flex gap-2 text-xs">
                <span className="min-w-[100px] font-semibold uppercase tracking-wide text-slate-500">{row.key}</span>
                <span className="break-all text-slate-700">{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Click any polygon or line on the map to inspect its properties.</p>
        )}
      </div>
    </div>
  );
}

export default function RsqMapClient({ comparisonEnabled = false }: RsqMapClientProps) {
  const { activeView } = useRsqView();
  const admin = useRsqAdmin();
  const drain = useRsqDrain();
  const adminAnalysis = useRsqAnalysis("admin");
  const drainAnalysis = useRsqAnalysis("drain");

  const [baseMap, setBaseMap] = useState<keyof typeof baseMaps>("osm");
  const [coords, setCoords] = useState({ lat: 22.5937, lon: 82.9739 });
  const [featureInfo, setFeatureInfo] = useState<FeatureInfo | null>(null);

  const activeAnalysis = activeView === "admin" ? adminAnalysis : drainAnalysis;
  const showComparison = Boolean(
    comparisonEnabled &&
      activeAnalysis.selectedYear &&
      activeAnalysis.comparisonYear &&
      activeAnalysis.groundWaterData &&
      activeAnalysis.comparisonGroundWaterData,
  );

  const leftTitle = activeAnalysis.selectedYear ? `RSQ ${activeAnalysis.selectedYear}` : "RSQ Analysis";
  const rightTitle = activeAnalysis.comparisonYear ? `RSQ ${activeAnalysis.comparisonYear}` : "RSQ Comparison";

  const leftAnalysisStyle = useMemo(
    () =>
      ((feature: any) => ({
        color: "#1e293b",
        weight: 1.5,
        fill: true,
        fillColor: resolveRsqFillColor(feature?.properties),
        fillOpacity: 0.82,
        opacity: 1,
      })) as L.StyleFunction<any>,
    [],
  );

  const rightAnalysisStyle = useMemo(
    () =>
      ((feature: any) => ({
        color: "#1e293b",
        weight: 1.5,
        fill: true,
        fillColor: resolveRsqFillColor(feature?.properties),
        fillOpacity: 0.82,
        opacity: 1,
      })) as L.StyleFunction<any>,
    [],
  );

  const basinData = useGeoJson(activeView === "drain" ? buildDssVectorWfsUrl("basin_boundary", "1=1") : null);
  const indiaData = useGeoJson(buildWfsUrl("B_State"));
  const stateData = useGeoJson(
    activeView === "admin" && admin.selectedState
      ? buildWfsUrl("B_State", `state_code='${String(admin.selectedState).padStart(2, "0")}'`)
      : null,
  );
  const districtData = useGeoJson(
    activeView === "admin" && admin.selectedDistricts.length
      ? buildWfsUrl("B_district", `DISTRICT_C IN (${admin.selectedDistricts.join(",")})`)
      : null,
  );
  const blockData = useGeoJson(
    activeView === "admin" && admin.selectedBlocks.length
      ? buildWfsUrl("block", `Block_LG00 IN (${admin.selectedBlocks.join(",")})`)
      : null,
  );
  const villageData = useGeoJson(
    activeView === "admin"
      ? admin.selectedVillages.length
        ? buildWfsUrl("Village", `vlcode IN (${admin.selectedVillages.map((code) => `'${code}'`).join(",")})`)
        : null
      : drain.selectedVillages.length
        ? buildWfsUrl("Village", `village_co IN (${drain.selectedVillages.map((code) => `'${code}'`).join(",")})`)
        : null,
  );
  const riversData = useGeoJson(
    activeView === "drain"
      ? drain.selectedRiver
        ? buildWfsUrl("Rivers", `River_Code=${drain.selectedRiver}`)
        : buildWfsUrl("Rivers")
      : null,
  );
  const stretchesData = useGeoJson(
    activeView === "drain" && drain.selectedRiver && drain.selectedStretch
      ? buildWfsUrl("Stretches", `River_Code=${drain.selectedRiver} AND Stretch_ID=${drain.selectedStretch}`)
      : null,
  );
  const drainsData = useGeoJson(
    activeView === "drain"
      ? drain.selectedDrain
        ? buildWfsUrl("Drain", `Drain_No=${drain.selectedDrain}`)
        : drain.selectedStretch
          ? buildWfsUrl("Drain", `Stretch_ID=${drain.selectedStretch}`)
          : drain.selectedRiver
            ? buildWfsUrl("Drain", `River_Code=${drain.selectedRiver}`)
            : buildWfsUrl("Drain")
      : null,
  );
  const catchmentsData = useGeoJson(
    activeView === "drain" && drain.selectedDrain ? buildWfsUrl("Catchment", `Drain_No=${drain.selectedDrain}`) : null,
  );

  const sharedDataSets = useMemo(
    () => ({
      basinData,
      indiaData,
      stateData,
      districtData,
      blockData,
      villageData,
      riversData,
      stretchesData,
      drainsData,
      catchmentsData,
    }),
    [basinData, blockData, catchmentsData, districtData, drainsData, indiaData, riversData, stateData, stretchesData, villageData],
  );

  const fitData = useMemo(
    () => {
      if (activeView === "admin") {
        return [
          activeAnalysis.groundWaterData,
          activeAnalysis.comparisonGroundWaterData,
          basinData,
          villageData,
          blockData,
          districtData,
          stateData,
          indiaData,
        ];
      }

      if (activeAnalysis.groundWaterData || activeAnalysis.comparisonGroundWaterData) {
        return [
          activeAnalysis.groundWaterData,
          activeAnalysis.comparisonGroundWaterData,
          villageData,
          catchmentsData,
          drainsData,
          stretchesData,
          riversData,
          basinData,
          indiaData,
        ];
      }

      if (drain.selectedDrain) {
        return [drainsData, catchmentsData, villageData, stretchesData, riversData, basinData, indiaData];
      }

      if (drain.selectedStretch) {
        return [stretchesData, drainsData, riversData, basinData, indiaData];
      }

      if (drain.selectedRiver) {
        return [riversData, stretchesData, drainsData, basinData, indiaData];
      }

      return [basinData, riversData, drainsData, indiaData];
    },
    [
      activeAnalysis.comparisonGroundWaterData,
      activeAnalysis.groundWaterData,
      activeView,
      drain.selectedDrain,
      drain.selectedRiver,
      drain.selectedStretch,
      basinData,
      blockData,
      catchmentsData,
      districtData,
      drainsData,
      indiaData,
      riversData,
      stateData,
      stretchesData,
      villageData,
    ],
  );

  useEffect(() => {
    setFeatureInfo(null);
  }, [activeView, activeAnalysis.selectedYear, activeAnalysis.comparisonYear, comparisonEnabled]);

  return (
    <div className="relative z-0 h-full w-full overflow-hidden bg-slate-100 p-3">
      <div className={`grid h-full gap-3 ${showComparison ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <MapPanel
          dataSets={sharedDataSets}
          analysisData={activeAnalysis.groundWaterData}
          analysisTitle={leftTitle}
          analysisStyle={leftAnalysisStyle}
          baseMap={baseMap}
          setBaseMap={setBaseMap}
          featureInfo={featureInfo}
          setFeatureInfo={setFeatureInfo}
          fitData={fitData}
          onMapMove={(next) => {
            setCoords({ lat: +next.lat.toFixed(6), lon: +next.lon.toFixed(6) });
          }}
          activeView={activeView}
          drainSelection={{ selectedRiver: drain.selectedRiver, selectedStretch: drain.selectedStretch }}
        />

        {showComparison && (
          <MapPanel
            dataSets={sharedDataSets}
            analysisData={activeAnalysis.comparisonGroundWaterData}
            analysisTitle={rightTitle}
            analysisStyle={rightAnalysisStyle}
            baseMap={baseMap}
            setBaseMap={setBaseMap}
            featureInfo={featureInfo}
            setFeatureInfo={setFeatureInfo}
            fitData={fitData}
            onMapMove={(next) => {
              setCoords({ lat: +next.lat.toFixed(6), lon: +next.lon.toFixed(6) });
            }}
            activeView={activeView}
            drainSelection={{ selectedRiver: drain.selectedRiver, selectedStretch: drain.selectedStretch }}
          />
        )}
      </div>

      {activeAnalysis.isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[2000] flex items-center justify-center bg-white/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-7 py-5 shadow-2xl">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
            <p className="text-sm font-semibold text-slate-600">Loading analysis data...</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-15 right-7 z-[1500] rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 text-xs text-slate-600 shadow-lg backdrop-blur">
        <div>Lat -&gt; {coords.lat}</div>
        <div>Lng -&gt; {coords.lon}</div>
      </div>
    </div>
  );
}
