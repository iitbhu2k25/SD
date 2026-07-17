'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { Eye, Info } from 'lucide-react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { DashboardInfoContent, getDashboardInfo, InfoPopup } from './info';

interface DrainRecord {
  id: number;
  location: string;
  stream?: string;
  ph: number;
  temp: number;
  ec_us_cm: number;
  tds_ppm: number;
  do_mg_l: number;
  turbidity: number;
  tss_mg_l: number;
  cod: number;
  bod_mg_l: number;
  ts_mg_l: number;
  chloride: number;
  nitrate: number;
  faecal_col: string | null;
  total_col: string | null;
  lat: number | null;
  lon: number | null;
  sampling_time?: string;
}

interface PollutionSourcesProps {
  drainData: DrainRecord[];
}

interface BODPriorityAnalysis {
  priority: number;
  range: string;
  description: string;
  color: string;
  count: number;
  locations: DrainRecord[];
  criteria: string[];
  action: string;
}

interface BODSummary {
  priority: number;
  stretches: number;
  color: string;
}

// Helper function for parsing coliform data
const extractFaecalValue = (val: string | null): number => {
  if (!val || val === 'N/A') return 0;
  const parts = val.replace(/,/g, '').split(/–|-/).map(Number);
  return parts.length === 2 ? (parts[0] + parts[1]) / 2 : Number(parts[0]);
};

const BOD_PRIORITY_CLASSES = [
  { priority: 1, label: 'Severe', color: '#8b0000' },
  { priority: 2, label: 'Poor', color: '#ef4444' },
  { priority: 3, label: 'Moderate', color: '#f59e0b' },
  { priority: 4, label: 'Good', color: '#3b82f6' },
  { priority: 5, label: 'Excellent', color: '#10b981' },
];

const getBodPriorityMeta = (value: number) => {
  if (value > 30) return BOD_PRIORITY_CLASSES[0];
  if (value >= 20) return BOD_PRIORITY_CLASSES[1];
  if (value >= 10) return BOD_PRIORITY_CLASSES[2];
  if (value >= 6) return BOD_PRIORITY_CLASSES[3];
  return BOD_PRIORITY_CLASSES[4];
};

const getStationPointStyle = (color: string, value: number, isSelected: boolean) => {
  if (isSelected) {
    return [
      // Strong outer glow
      new Style({
        image: new CircleStyle({
          radius: 26,
          fill: new Fill({ color: 'rgba(236, 72, 153, 0.30)' }),
        }),
        zIndex: 1750,
      }),
      // Middle ring for clearer focus
      new Style({
        image: new CircleStyle({
          radius: 18,
          fill: new Fill({ color: 'rgba(244, 114, 182, 0.22)' }),
          stroke: new Stroke({ color: 'rgba(190, 24, 93, 0.9)', width: 2 }),
        }),
        zIndex: 1800,
      }),
      new Style({
        image: new CircleStyle({
          radius: 11,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
        }),
        text: new Text({
          text: value.toFixed(2),
          font: 'bold 13px sans-serif',
          fill: new Fill({ color: '#111827' }),
          backgroundFill: new Fill({ color: 'rgba(255, 255, 240, 0.98)' }),
          stroke: new Stroke({ color: '#ffffff', width: 4 }),
          padding: [4, 4, 4, 4],
          offsetY: -24,
        }),
        zIndex: 2100,
      }),
    ];
  }

  return new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: new Text({
      text: value.toFixed(2),
      font: 'bold 11px sans-serif',
      fill: new Fill({ color: '#111827' }),
      backgroundFill: new Fill({ color: 'rgba(255,255,255,0.85)' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      padding: [2, 2, 2, 2],
      offsetY: -16,
    }),
    zIndex: 1000,
  });
};

const PollutionSources: React.FC<PollutionSourcesProps> = ({ drainData }) => {
  const [bodPage, setBodPage] = useState(0);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [bodPriorityFilter, setBodPriorityFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [selectedInfo, setSelectedInfo] = useState<DashboardInfoContent | null>(null);
  const [selectedInfoAnchor, setSelectedInfoAnchor] = useState<HTMLElement | null>(null);
  const pageSize = 10;
  const bodMapRef = React.useRef<HTMLDivElement | null>(null);
  const bodMapInstanceRef = React.useRef<Map | null>(null);
  const bodPointLayerRef = React.useRef<VectorLayer<VectorSource> | null>(null);
  const bodRiverLayersRef = React.useRef<Array<VectorLayer<VectorSource>>>([]);
  const [isBodMapReady, setIsBodMapReady] = useState(false);

  const openInfo = (event: React.MouseEvent<HTMLElement>) => {
    setSelectedInfoAnchor(event.currentTarget);
    setSelectedInfo(getDashboardInfo('high-bod-sites'));
  };

  // ============================================================
  // 1. BOD PRIORITY CLASSIFICATION LOGIC
  // ============================================================
  
  const bodPriorityAnalysis = useMemo(() => {
    if (!drainData || drainData.length === 0) return [];

    const priorityMap: { [key: number]: BODPriorityAnalysis } = {
      1: {
        priority: 1,
        range: '>30 mg/L',
        description: 'Critical Sewage Load - Exceeds STP Standards',
        color: '#dc2626',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration exceeds 30 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Standard of sewage treatment plant discharge',
          'Requires immediate intervention'
        ],
        action: ' CRITICAL - Immediate remediation required'
      },
      2: {
        priority: 2,
        range: '20-30 mg/L',
        description: 'Very High Pollution - Heavy Sewage Influence',
        color: '#ea580c',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 20-30 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Indicates significant untreated discharge'
        ],
        action: ' HIGH PRIORITY - Urgent action needed'
      },
      3: {
        priority: 3,
        range: '10-20 mg/L',
        description: 'High Pollution - Moderate Sewage Load',
        color: '#f59e0b',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 10-20 mg/L',
          'Exceeds 6 mg/L on all occasions',
          'Moderate pollution requiring intervention'
        ],
        action: ' MEDIUM-HIGH - Planned intervention'
      },
      4: {
        priority: 4,
        range: '6-10 mg/L',
        description: 'Moderate Pollution - Manageable Levels',
        color: '#eab308',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 6-10 mg/L',
          'Exceeds desired water quality',
          'Manageable with standard treatment'
        ],
        action: ' MEDIUM - Regular monitoring required'
      },
      5: {
        priority: 5,
        range: '3-6 mg/L',
        description: 'Low Pollution - Near Acceptable Levels',
        color: '#84cc16',
        count: 0,
        locations: [],
        criteria: [
          'BOD concentration between 3-6 mg/L',
          'Approaching desired water quality',
          'Acceptable with continued monitoring'
        ],
        action: ' LOW - Continue monitoring'
      }
    };

    drainData.forEach(record => {
      let priority = 5;
      if (record.bod_mg_l > 30) priority = 1;
      else if (record.bod_mg_l >= 20) priority = 2;
      else if (record.bod_mg_l >= 10) priority = 3;
      else if (record.bod_mg_l >= 6) priority = 4;

      priorityMap[priority].count++;
      priorityMap[priority].locations.push(record);
    });
    
    Object.values(priorityMap).forEach(analysis => {
        analysis.locations.sort((a, b) => (b.bod_mg_l || 0) - (a.bod_mg_l || 0));
    });

    return Object.values(priorityMap).sort((a, b) => a.priority - b.priority);
  }, [drainData]);

  // ============================================================
  // 2. STRETCHES OUTCOME
  // ============================================================
  
  const stretchesOutcome = useMemo(() => {
    const summary: BODSummary[] = [
      { priority: 1, stretches: 0, color: '#dc2626' },
      { priority: 2, stretches: 0, color: '#ea580c' },
      { priority: 3, stretches: 0, color: '#f59e0b' },
      { priority: 4, stretches: 0, color: '#eab308' },
      { priority: 5, stretches: 0, color: '#84cc16' }
    ];

    bodPriorityAnalysis.forEach(analysis => {
      const summaryItem = summary.find(s => s.priority === analysis.priority);
      if (summaryItem) {
        summaryItem.stretches = analysis.count;
      }
    });

    return summary;
  }, [bodPriorityAnalysis]);

  // ============================================================
  // 3. STATISTICS & WORST SITES CALCULATION
  // ============================================================

  const bodStats = useMemo(() => {
    const validBOD = drainData.filter(d => d.bod_mg_l !== null && d.bod_mg_l !== undefined);
    if (validBOD.length === 0) return null;

    const bodValues = validBOD.map(d => d.bod_mg_l);
    const average = bodValues.reduce((a, b) => a + b, 0) / bodValues.length;
    const max = Math.max(...bodValues);
    const min = Math.min(...bodValues);
    const median = bodValues.sort((a, b) => a - b)[Math.floor(validBOD.length / 2)];

    return { average, max, min, median, count: validBOD.length };
  }, [drainData]);

  const bodChartData = useMemo(() => {
    return bodPriorityAnalysis.map(p => ({
      name: `P${p.priority}`,
      count: p.count,
      range: p.range,
      fill: p.color
    }));
  }, [bodPriorityAnalysis]);

  const filteredBodData = useMemo(() => {
    if (bodPriorityFilter === 'all') return drainData;
    return drainData.filter((d) => getBodPriorityMeta(d.bod_mg_l).priority === bodPriorityFilter);
  }, [drainData, bodPriorityFilter]);

  const sortedBodData = useMemo(
    () => [...filteredBodData].sort((a, b) => b.bod_mg_l - a.bod_mg_l),
    [filteredBodData]
  );

  const totalBodPages = Math.max(1, Math.ceil(sortedBodData.length / pageSize));
  const currentBodPage = Math.min(bodPage, totalBodPages - 1);
  const pageStart = currentBodPage * pageSize;
  const paginatedBodData = sortedBodData.slice(pageStart, pageStart + pageSize);
  const showingStart = sortedBodData.length === 0 ? 0 : pageStart + 1;
  const showingEnd = sortedBodData.length === 0 ? 0 : Math.min(pageStart + pageSize, sortedBodData.length);

  React.useEffect(() => {
    if (bodPage > totalBodPages - 1) {
      setBodPage(Math.max(0, totalBodPages - 1));
    }
  }, [bodPage, totalBodPages]);

  React.useEffect(() => {
    if (!bodMapRef.current || bodMapInstanceRef.current) return;

    const baseLayer = new TileLayer({
      source: new OSM(),
      zIndex: 0,
    });

    const pointLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 10,
    });

    const map = new Map({
      target: bodMapRef.current,
      layers: [baseLayer, pointLayer],
      view: new View({
        // Initial fallback view; final view is set after basin/river layers load
        center: fromLonLat([83.065, 25.6]),
        zoom: 9,
      }),
    });

    bodPointLayerRef.current = pointLayer;
    bodMapInstanceRef.current = map;
    setIsBodMapReady(true);

    return () => {
      map.setTarget(undefined);
      bodMapInstanceRef.current = null;
      bodPointLayerRef.current = null;
      bodRiverLayersRef.current = [];
      setIsBodMapReady(false);
    };
  }, []);

  React.useEffect(() => {
    if (!isBodMapReady || !bodMapInstanceRef.current) return;

    let isCancelled = false;

    const loadRiverLayers = () => {
      const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL ?? '/geoserver';
      const WFS_BASE = `${GS}/dss_vector/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json`;
      const geoJson = new GeoJSON();

      const riverDefs = [
        { name: 'Varuna', color: '#0066CC', width: 5, zIndex: 5 },
        { name: 'Basuhi', color: '#9c00aa', width: 3, zIndex: 4 },
        { name: 'Morwa',  color: '#FF6600', width: 3, zIndex: 4 },
      ];

      const promises = riverDefs.map(({ name, color, width, zIndex }) =>
        fetch(`${WFS_BASE}&typeName=dss_vector:Rivers&CQL_FILTER=River_Name='${name}'`)
          .then(r => r.json())
          .then(geojson => {
            if (isCancelled || !bodMapInstanceRef.current) return;
            const layer = new VectorLayer({
              source: new VectorSource({ features: geoJson.readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
              style: new Style({ stroke: new Stroke({ color, width, lineCap: 'round', lineJoin: 'round' }) }),
              zIndex,
            });
            bodMapInstanceRef.current.addLayer(layer);
            bodRiverLayersRef.current.push(layer);
          })
          .catch(console.error)
      );

      fetch(`${WFS_BASE}&typeName=dss_vector:basin_boundary`)
        .then(r => r.json())
        .then(geojson => {
          if (isCancelled || !bodMapInstanceRef.current) return;
          const layer = new VectorLayer({
            source: new VectorSource({ features: geoJson.readFeatures(geojson, { featureProjection: 'EPSG:3857' }) }),
            style: new Style({
              stroke: new Stroke({ color: '#8B4513', width: 2.5 }),
              fill: new Fill({ color: 'rgba(139,69,19,0.05)' }),
            }),
            zIndex: 3,
          });
          bodMapInstanceRef.current.addLayer(layer);
          bodRiverLayersRef.current.push(layer);
        })
        .catch(console.error);

      Promise.allSettled(promises).then(() => {
        if (!bodMapInstanceRef.current) return;
        bodMapInstanceRef.current.getView().fit(
          [...fromLonLat([82.38, 25.25]), ...fromLonLat([83.75, 25.95])] as [number, number, number, number],
          { padding: [40, 40, 40, 320], maxZoom: 9 }
        );
      });
    };

    loadRiverLayers();

    return () => {
      isCancelled = true;
      if (!bodMapInstanceRef.current) return;
      bodRiverLayersRef.current.forEach((layer) => {
        bodMapInstanceRef.current?.removeLayer(layer);
      });
      bodRiverLayersRef.current = [];
    };
  }, [isBodMapReady]);

  React.useEffect(() => {
    if (!bodPointLayerRef.current || !bodMapInstanceRef.current) return;

    const source = bodPointLayerRef.current.getSource();
    if (!source) return;
    source.clear();

    const features = filteredBodData
      .filter((d) => d.lat !== null && d.lon !== null)
      .map((d) => {
        const meta = getBodPriorityMeta(d.bod_mg_l);
        const feature = new Feature({
          geometry: new Point(fromLonLat([d.lon as number, d.lat as number])),
          stationId: d.id,
          location: d.location,
          bod: d.bod_mg_l,
          priority: meta.priority,
        });

        feature.setStyle(getStationPointStyle(meta.color, d.bod_mg_l, false));

        return feature;
      });

    source.addFeatures(features);

    // Keep a stable basin-level view; avoid aggressive auto-zoom on section load.
  }, [filteredBodData]);

  React.useEffect(() => {
    if (selectedStationId === null) return;
    const existsInFilter = filteredBodData.some((d) => d.id === selectedStationId);
    if (!existsInFilter) {
      setSelectedStationId(null);
    }
  }, [filteredBodData, selectedStationId]);

  React.useEffect(() => {
    if (!bodPointLayerRef.current || !bodMapInstanceRef.current) return;
    const source = bodPointLayerRef.current.getSource();
    if (!source) return;

    source.getFeatures().forEach((feature) => {
      const bod = Number(feature.get('bod') || 0);
      const priority = Number(feature.get('priority') || 5);
      const color = BOD_PRIORITY_CLASSES.find((c) => c.priority === priority)?.color || '#6b7280';
      const featureStationId = Number(feature.get('stationId'));
      const isSelected = selectedStationId !== null && featureStationId === selectedStationId;
      feature.setStyle(getStationPointStyle(color, bod, isSelected));
    });

    if (selectedStationId !== null) {
      const target = source
        .getFeatures()
        .find((f) => Number(f.get('stationId')) === selectedStationId);
      if (target) {
        const geometry = target.getGeometry() as Point | null;
        if (geometry) {
          bodMapInstanceRef.current.getView().animate({
            center: geometry.getCoordinates(),
            zoom: 13,
            duration: 450,
          });
        }
      }
    }
  }, [selectedStationId]);

  React.useEffect(() => {
    if (!bodMapInstanceRef.current) return;
    const timer = setTimeout(() => bodMapInstanceRef.current?.updateSize(), 120);
    const onResize = () => bodMapInstanceRef.current?.updateSize();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [paginatedBodData.length]);

  const {
    worstNitrate,
    worstBOD,
    worstFaecalColiform,
    worstAlgaeRisk,
    worstChemicalRisk,
    worstTurbidity,
    worstSalinity,
    worstIndustrial,
    worstLandDumping,
    worstDetergentRisk,
    acidicSites,
  } = useMemo(() => {
    const formatLoc = (d: DrainRecord) => d.stream ? `${d.location} (${d.stream})` : d.location;

    // 1. Organic (BOD)
    const bodSorted = [...drainData]
      .filter(site => site.bod_mg_l !== null && site.bod_mg_l !== undefined)
      .sort((a, b) => b.bod_mg_l - a.bod_mg_l);
    const worstBOD = bodSorted.length > 0 
      ? { location: formatLoc(bodSorted[0]), value: bodSorted[0].bod_mg_l.toFixed(2) }
      : { location: '–', value: '–' };

    // 2. Pathogen (Faecal Coliform)
    const faecalSites = drainData.filter(d => {
      const val = d.faecal_col;
      if (!val || val === 'N/A') return false;
      const parsed = extractFaecalValue(val);
      return !isNaN(parsed) && parsed > 0;
    });
    const worstFaecal = faecalSites.sort(
      (a, b) => extractFaecalValue(b.faecal_col) - extractFaecalValue(a.faecal_col)
    )[0];
    const worstFaecalColiform = worstFaecal
      ? { location: formatLoc(worstFaecal), value: extractFaecalValue(worstFaecal.faecal_col).toFixed(0) }
      : { location: '–', value: '–' };

    // 3. Chemical Pollution (COD + TSS)
    const chemicalRiskCandidates = drainData.filter(d => d.cod !== null && d.tss_mg_l !== null);
    const highestChemicalSite = chemicalRiskCandidates.sort(
      (a, b) => (b.cod + b.tss_mg_l) - (a.cod + a.tss_mg_l)
    )[0];
    const worstChemicalRisk = highestChemicalSite
      ? { location: formatLoc(highestChemicalSite), cod: highestChemicalSite.cod.toFixed(2), tss: highestChemicalSite.tss_mg_l.toFixed(2) }
      : { location: '–', cod: '–', tss: '–' };

    // 4. Turbidity
    const highTurbiditySite = drainData
      .filter(d => typeof d.turbidity === 'number')
      .sort((a, b) => b.turbidity - a.turbidity)[0];
    const worstTurbidity = highTurbiditySite
      ? { location: formatLoc(highTurbiditySite), value: highTurbiditySite.turbidity.toFixed(2) }
      : { location: '–', value: '–' };

    // 5. Salinity (TDS + EC)
    const salinityCandidates = drainData.filter(d => d.tds_ppm > 0 || d.ec_us_cm > 0);
    const highestSalinitySite = salinityCandidates.sort(
      (a, b) => (b.tds_ppm + b.ec_us_cm) - (a.tds_ppm + a.ec_us_cm)
    )[0];
    const worstSalinity = highestSalinitySite
      ? { location: formatLoc(highestSalinitySite), tds: highestSalinitySite.tds_ppm.toFixed(0), ec: highestSalinitySite.ec_us_cm.toFixed(0) }
      : { location: '–', tds: '–', ec: '–' };

    // 6. Nitrates
    const nitrateSorted = [...drainData]
      .filter(site => site.nitrate !== null && site.nitrate !== undefined)
      .sort((a, b) => b.nitrate - a.nitrate);
    const worstNitrate = nitrateSorted.length > 0 
      ? { location: formatLoc(nitrateSorted[0]), value: nitrateSorted[0].nitrate.toFixed(2) }
      : { location: '–', value: '–' };

    // 7. Algae (Nitrate + BOD)
    const algaeRiskCandidates = drainData.filter(d => d.nitrate !== null && d.bod_mg_l !== null);
    const highestAlgaeSite = algaeRiskCandidates.sort(
      (a, b) => (b.nitrate + b.bod_mg_l) - (a.nitrate + a.bod_mg_l)
    )[0];
    const worstAlgaeRisk = highestAlgaeSite
      ? { location: formatLoc(highestAlgaeSite), nitrate: highestAlgaeSite.nitrate.toFixed(2), bod: highestAlgaeSite.bod_mg_l.toFixed(2) }
      : { location: '–', nitrate: '–', bod: '–' };

    // 8. Industrial (COD + TDS)
    const industrialCandidates = drainData.filter(d => d.cod && d.tds_ppm);
    const highestIndustrial = industrialCandidates.sort(
      (a, b) => (b.cod + b.tds_ppm) - (a.cod + a.tds_ppm)
    )[0];
    const worstIndustrial = highestIndustrial
      ? { location: formatLoc(highestIndustrial), cod: highestIndustrial.cod.toFixed(1), tds: highestIndustrial.tds_ppm.toFixed(0) }
      : { location: '–', cod: '–', tds: '–' };

    // 9. Detergents (BOD + COD)
    const detergentRiskCandidates = drainData.filter(d => d.bod_mg_l !== null && d.cod !== null);
    const worstDetergentSite = detergentRiskCandidates.sort(
      (a, b) => (b.bod_mg_l + b.cod) - (a.bod_mg_l + a.cod)
    )[0];
    const worstDetergentRisk = worstDetergentSite
      ? { location: formatLoc(worstDetergentSite), bod: worstDetergentSite.bod_mg_l.toFixed(1), cod: worstDetergentSite.cod.toFixed(1) }
      : { location: '–', bod: '–', cod: '–' };

    // 10. Land Dumping (TSS + Turb + TS)
    const landDumpingCandidates = drainData.filter(
      d => d.tss_mg_l > 0 || d.turbidity > 0 || d.ts_mg_l > 0
    );
    const worstDumpingSite = landDumpingCandidates.sort(
      (a, b) => (b.tss_mg_l + b.turbidity + b.ts_mg_l) - (a.tss_mg_l + a.turbidity + a.ts_mg_l)
    )[0];
    const worstLandDumping = worstDumpingSite
      ? { location: formatLoc(worstDumpingSite), tss: worstDumpingSite.tss_mg_l.toFixed(0), turbidity: worstDumpingSite.turbidity.toFixed(0), ts: worstDumpingSite.ts_mg_l.toFixed(0) }
      : { location: '–', tss: '–', turbidity: '–', ts: '–' };
    
    const acidicSites = drainData
      .filter(d => d.ph < 6.5)
      .sort((a, b) => a.ph - b.ph);

    return {
      worstNitrate,
      worstBOD,
      worstFaecalColiform,
      worstAlgaeRisk,
      worstChemicalRisk,
      worstTurbidity,
      worstSalinity,
      worstIndustrial,
      worstLandDumping,
      worstDetergentRisk,
      acidicSites, 
    };
  }, [drainData]);

  return (
    <div className="space-y-8">

      {/* SECTION 2: BOD INDICATORS (Chart) */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
          <span>BOD Indicators</span>
          <button
            type="button"
            onClick={openInfo}
            aria-label="BOD indicators info"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-purple-300 text-purple-600 bg-white/90 hover:bg-purple-50 transition-colors"
          >
            <Info size={13} />
          </button>
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch min-h-[760px]">
          <div className="xl:col-span-5 space-y-4 h-full flex flex-col">
            <h3 className="font-semibold text-gray-800">Comparative Analysis of Top Polluted Sites</h3>

            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
              <button
                onClick={() => setBodPage((p) => Math.max(0, p - 1))}
                disabled={currentBodPage === 0}
                className="px-3 py-1.5 rounded bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-base font-semibold text-gray-700 mt-1">
                Showing {showingStart}-{showingEnd} of {sortedBodData.length}
              </span>
              <button
                onClick={() => setBodPage((p) => Math.min(totalBodPages - 1, p + 1))}
                disabled={currentBodPage >= totalBodPages - 1}
                className="px-3 py-1.5 rounded bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 flex-1">
              <table className="w-full text-sm border-separate border-spacing-y-1">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="pl-2 pr-2 py-3 text-left">#</th>
                    <th className="px-2 py-3 text-left">Location</th>
                    <th className="px-2 py-3 text-left">Stream</th>
                    <th className="px-2 py-3 text-right">BOD (mg/L)</th>
                    <th className="px-2 py-3 text-center align-middle">
                      <div className="block">
                        <span className="block leading-none">Priority</span>
                        <select
                          value={bodPriorityFilter}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBodPriorityFilter(value === 'all' ? 'all' : (Number(value) as 1 | 2 | 3 | 4 | 5));
                            setBodPage(0);
                          }}
                          className="mt-1 block mx-auto w-20 h-5 text-[10px] border border-gray-300 rounded px-1 bg-white leading-none"
                        >
                          <option value="all">All</option>
                          <option value="1">Priority 1</option>
                          <option value="2">Priority 2</option>
                          <option value="3">Priority 3</option>
                          <option value="4">Priority 4</option>
                          <option value="5">Priority 5</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-2 py-3 text-left">Quality</th>
                    <th className="px-2 py-3 text-center">View</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBodData.map((drain, idx) => {
                    const meta = getBodPriorityMeta(drain.bod_mg_l);
                    return (
                      <tr key={`${drain.id}-${idx}`} className="bg-white hover:bg-gray-50">
                        <td className="pl-2 pr-2 py-3 font-semibold">{pageStart + idx + 1}</td>
                        <td className="px-2 py-3">{drain.location}</td>
                        <td className="px-2 py-3 text-gray-600">{drain.stream || 'N/A'}</td>
                        <td className="px-2 py-3 text-right font-semibold">{drain.bod_mg_l.toFixed(2)}</td>
                        <td className="px-2 py-3 text-center font-bold" style={{ color: meta.color }}>
                          {meta.priority}
                        </td>
                        <td className="px-2 py-3">
                          <span className="px-2 py-1 rounded text-white text-xs font-semibold inline-block" style={{ backgroundColor: meta.color }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedStationId(drain.id)}
                            className={`inline-flex items-center justify-center p-1.5 rounded border transition-colors ${
                              selectedStationId === drain.id
                                ? 'bg-pink-100 text-pink-700 border-pink-300'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-pink-50 hover:border-pink-200'
                            }`}
                            title="View on map"
                            aria-label="View on map"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          <div className="xl:col-span-7 h-full">
            <div className="h-full rounded-xl border border-gray-200 overflow-hidden bg-white flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                <h3 className="font-semibold text-gray-800">BOD Priority Map</h3>
                <p className="text-xs text-gray-600 mt-1">All monitoring points colored by BOD priority classes</p>
              </div>
              <div ref={bodMapRef} className="flex-1 w-full min-h-[0]" />
              <div className="p-3 border-t border-gray-200">
                <p className="text-[11px] font-semibold text-gray-700 mb-2">BOD Priority Legend</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {BOD_PRIORITY_CLASSES.map((item) => (
                    <div key={item.priority} className="flex items-center gap-2 px-2 py-1 rounded border border-gray-200 bg-gray-50 whitespace-nowrap">
                      <span className="h-3 w-8 rounded-sm border border-white" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-gray-700 font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2.5: BOD PRIORITY ANALYSIS */}
      <div className="space-y-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-xl p-8 border border-gray-200">
        {/* HEADER */}
        <div className="border-b-2 border-orange-200 pb-6">
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent flex items-center gap-3">
            Chemical Pollution: BOD Analysis & Priority Classification
          </h2>
          <p className="text-gray-600 text-sm">
            Comprehensive Biochemical Oxygen Demand assessment based on 5-tier priority system
          </p>
        </div>

        {/* OVERALL STATISTICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {bodStats && (
            <>
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-700 font-semibold mb-1">Maximum BOD</div>
                <div className="text-3xl font-bold text-red-600">{bodStats.max.toFixed(1)}</div>
                <div className="text-xs text-red-600 mt-2">mg/L (Critical Level)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-700 font-semibold mb-1">Average BOD</div>
                <div className="text-3xl font-bold text-orange-600">{bodStats.average.toFixed(1)}</div>
                <div className="text-xs text-orange-600 mt-2">mg/L (Average)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-green-50 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-700 font-semibold mb-1">Median BOD</div>
                <div className="text-3xl font-bold text-yellow-600">{bodStats.median.toFixed(1)}</div>
                <div className="text-xs text-yellow-600 mt-2">mg/L (Median)</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-700 font-semibold mb-1">Minimum BOD</div>
                <div className="text-3xl font-bold text-green-600">{bodStats.min.toFixed(1)}</div>
                <div className="text-xs text-green-600 mt-2">mg/L (Lowest)</div>
              </div>
            </>
          )}
        </div>
        {/* PRIORITY CLASSIFICATION TABLE */}
        <div className="space-y-5">
          <h3 className="text-3xl font-bold text-gray-800 text-left">
            5-Tier BOD Priority Classification System
          </h3>

          <div className="space-y-3">
            {bodPriorityAnalysis.map((analysis, idx) => (
              <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                <div
                  className="p-5 rounded-lg border-l-4 transition-all hover:shadow-lg"
                  style={{
                    borderLeftColor: analysis.color,
                    backgroundColor: `${analysis.color}08`
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-2xl leading-tight" style={{ color: analysis.color }}>
                        Priority {analysis.priority}
                      </h4>
                      <p className="text-base font-semibold text-gray-700 mt-1">{analysis.description}</p>
                    </div>
                    <span className="text-4xl font-bold leading-none" style={{ color: analysis.color }}>
                      {analysis.range}
                    </span>
                  </div>
                  <div className="bg-white/60 rounded px-3 py-2 mb-2">
                    <div className="text-sm text-gray-700">
                      <strong>Locations Identified:</strong> {analysis.count} site{analysis.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-base text-gray-700 font-medium">{analysis.action}</div>
                </div>

                <div className="p-5 rounded-lg border border-gray-300 bg-gray-50">
                  <h4 className="font-bold text-xl text-left mb-2" style={{ color: analysis.color }}>
                    Priority {analysis.priority} Criteria
                  </h4>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {analysis.criteria.map((criterion, cidx) => (
                      <li key={cidx} className="flex gap-2 items-start">
                        <span className="text-gray-400">*</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* OUTCOME - STRETCHES DISTRIBUTION */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 p-6">
          <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            OUTCOME: Priority-Wise observation points Distribution
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <th className="border border-blue-700 px-4 py-3 text-left font-bold">Priority Level</th>
                    <th className="border border-blue-700 px-4 py-3 text-center font-bold">BOD Range</th>
                    <th className="border border-blue-700 px-4 py-3 text-center font-bold">Number of observations</th>
                  </tr>
                </thead>
                <tbody>
                  {stretchesOutcome.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      <td className="border border-gray-300 px-4 py-3">
                        <div
                          className="inline-block px-3 py-1 rounded-full font-bold text-white text-sm"
                          style={{ backgroundColor: item.color }}
                        >
                          Priority {item.priority}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center font-semibold">
                        {bodPriorityAnalysis.find(a => a.priority === item.priority)?.range}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <span className="text-4xl font-bold leading-none" style={{ color: item.color }}>
                          {item.stretches}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold text-sm">
                    <td colSpan={2} className="border border-gray-700 px-4 py-3">
                      Total observation points Identified
                    </td>
                    <td className="border border-gray-700 px-4 py-3 text-center text-xl">
                      {stretchesOutcome.reduce((sum, item) => sum + item.stretches, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Chart */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bodChartData} margin={{ left: 10, right: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    label={{ value: 'Priority Level', position: 'bottom', fill: '#4B5563', dy: 25 }} 
                  />
                  <YAxis 
                    label={{ value: 'No. of Observations', position: 'bottom', angle: -90, dx: -19 }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px' }}
                    formatter={(value) => [`${value} observations`, 'Count']}
                    labelFormatter={(label) => `Priority ${label.replace('P', '')}`}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {bodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* PRIORITY-WISE DETAILED LOCATIONS */}
        <div className="space-y-4">
          <h3 className="text-3xl font-bold text-gray-800 text-left">
            <span>📍</span>
            Identified observation points by Priority
          </h3>

          {/* ROW 1: PRIORITY 1, 2, 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
            {bodPriorityAnalysis.slice(0, 3).map((analysis, idx) => (
              <div
                key={idx}
                className="rounded-lg border-2 p-3" 
                style={{ 
                    borderColor: analysis.color, 
                    backgroundColor: `${analysis.color}05`,
                }}
              >
                <div className="flex items-start justify-between mb-2"> 
                  <div>
                    <h4 className="font-bold text-base" style={{ color: analysis.color }}>
                      Priority {analysis.priority}: BOD {analysis.range} 
                    </h4>
                    <p className="text-xs text-gray-600 mt-0">{analysis.count} monitoring location{analysis.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: analysis.color }}>
                    {analysis.count}
                  </span>
                </div>

                {analysis.locations.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: `${analysis.color}30` }}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">📍 Locations :</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar-thin">
                      {analysis.locations.map((loc, locIdx) => (
                        <div
                          key={locIdx}
                          className="text-xs bg-white/60 p-1.5 rounded border-l-2"
                          style={{ borderLeftColor: analysis.color }}
                        >
                          <p className="font-medium text-gray-800 truncate">{loc.location}</p>
                          <p className="text-gray-600">
                            BOD: <strong>{loc.bod_mg_l.toFixed(1)} mg/L</strong>
                            {loc.stream && ` • ${loc.stream}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 bg-white/70 rounded text-xs text-gray-700">
                  <strong>Action:</strong> {analysis.action.split(' - ')[1] || analysis.action}
                </div>
              </div>
            ))}
          </div>

          {/* ROW 2: PRIORITY 4, 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
            {bodPriorityAnalysis.slice(3, 5).map((analysis, idx) => ( 
              <div
                key={idx}
                className="rounded-lg border-2 p-3" 
                style={{ 
                    borderColor: analysis.color, 
                    backgroundColor: `${analysis.color}05`,
                }}
              >
                <div className="flex items-start justify-between mb-2"> 
                  <div>
                    <h4 className="font-bold text-base" style={{ color: analysis.color }}>
                      Priority {analysis.priority}: BOD {analysis.range}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0">{analysis.count} monitoring location{analysis.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-xl font-bold" style={{ color: analysis.color }}>
                    {analysis.count}
                  </span>
                </div>

                {analysis.locations.length > 0 && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: `${analysis.color}30` }}>
                    <p className="text-xs font-semibold text-gray-700 mb-1">📍 Locations :</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar-thin">
                      {analysis.locations.map((loc, locIdx) => (
                        <div
                          key={locIdx}
                          className="text-xs bg-white/60 p-1.5 rounded border-l-2"
                          style={{ borderLeftColor: analysis.color }}
                        >
                          <p className="font-medium text-gray-800 truncate">{loc.location}</p>
                          <p className="text-gray-600">
                            BOD: <strong>{loc.bod_mg_l.toFixed(1)} mg/L</strong>
                            {loc.stream && ` • ${loc.stream}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 bg-white/70 rounded text-xs text-gray-700">
                  <strong>Action:</strong> {analysis.action.split(' - ')[1] || analysis.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 1: CRITICAL POLLUTION HOTSPOTS */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
          Critical Pollution Hotspots
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* High COD Locations */}
          <div className="border-l-4 border-red-500 bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-lg">
            <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
               Highest COD Levels
            </h3>
            <div className="space-y-3">
              {drainData
                .sort((a, b) => b.cod - a.cod)
                .slice(0, 5)
                .map((drain, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{idx + 1}. {drain.location}</p>
                      <p className="text-sm text-gray-700">{drain.stream || 'N/A'}</p>
                    </div>
                    <span className="text-lg font-bold text-red-600 ml-2 flex-shrink-0">
                      {drain.cod.toFixed(1)} mg/L
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Acidic pH Zones */}
          <div className="border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg">
            <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2">
               Acidic pH Zones
            </h3>
            <div className="space-y-3">
              {acidicSites.slice(0, 5).map((drain, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{idx + 1}. {drain.location}</p>
                      <p className="text-sm text-gray-700">{drain.stream || 'N/A'}</p>
                    </div>
                    <span className="text-lg font-bold text-purple-600 ml-2 flex-shrink-0">{drain.ph.toFixed(2)} pH</span>
                  </div>
                ))}
                {acidicSites.length === 0 && (
                    <p className="text-center text-gray-500 py-4 text-sm">No acidic zones (pH {'<'} 6.5) currently detected.</p>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: DISSOLVED OXYGEN CRISIS ZONES */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Dissolved Oxygen Crisis Zones
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Severe Hypoxia */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-red-800 mb-3 text-lg">🔴 Severe Hypoxia</h4>
            <div className="text-4xl font-bold text-red-600 mb-2">{drainData.filter(d => d.do_mg_l < 2).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO {'<'} 2 mg/L - Aquatic life death zone</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l < 2)
                .sort((a, b) => a.do_mg_l - b.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-red-700 font-medium p-2 bg-white rounded hover:bg-red-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>

          {/* Moderate Stress */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-orange-800 mb-3 text-lg">🟠 Moderate Stress</h4>
            <div className="text-4xl font-bold text-orange-600 mb-2">{drainData.filter(d => d.do_mg_l >= 2 && d.do_mg_l < 4).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO 2-4 mg/L - Fish stress zone</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l >= 2 && d.do_mg_l < 4)
                .sort((a, b) => a.do_mg_l - b.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-orange-700 font-medium p-2 bg-white rounded hover:bg-orange-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>

          {/* Acceptable */}
          <div className="p-6 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 hover:shadow-lg transition-all duration-300">
            <h4 className="font-bold text-green-800 mb-3 text-lg">🟢 Acceptable</h4>
            <div className="text-4xl font-bold text-green-600 mb-2">{drainData.filter(d => d.do_mg_l >= 4).length}</div>
            <p className="text-xs text-gray-700 mb-4 font-medium">DO ≥ 4 mg/L - Safe for aquatic life</p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar-thin">
              {drainData
                .filter(d => d.do_mg_l >= 4)
                .sort((a, b) => b.do_mg_l - a.do_mg_l)
                .map((d, i) => (
                <div key={i} className="text-xs text-green-700 font-medium p-2 bg-white rounded hover:bg-green-50 truncate" title={`${d.location} (${d.stream || 'N/A'})`}>
                  • {d.location}{d.stream ? ` (${d.stream})` : ''} (DO: <strong>{d.do_mg_l.toFixed(2)}</strong>)
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.4); border-radius: 10px; }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.6); }
      `}</style>
      <InfoPopup
        content={selectedInfo}
        anchor={selectedInfoAnchor}
        onClose={() => {
          setSelectedInfo(null);
          setSelectedInfoAnchor(null);
        }}
      />
    </div>
  );
};

export default PollutionSources;



