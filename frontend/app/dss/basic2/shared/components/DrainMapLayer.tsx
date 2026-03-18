'use client';
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useBasicStore } from '../store/basic.store';
import { API_BASE_URL } from '../utils/constants';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { attachLeafletCommonControls } from '../utils/leafletCommonControls';

interface DrainMapViewProps { className?: string; }

export default function DrainMapView({ className }: DrainMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const LRef            = useRef<any>(null);

  // Layer refs
  const basinRef    = useRef<any>(null);
  const riverRef    = useRef<any>(null);
  const stretchRef  = useRef<any>(null);
  const drainRef    = useRef<any>(null);
  const catchRef    = useRef<any>(null);
  const villageRef  = useRef<any>(null);
  const labelsRef   = useRef<any[]>([]);
  const selectedVillageIdsRef = useRef<string[]>([]);
  const controlsCleanupRef = useRef<null | (() => void)>(null);
  const thematicLayerRef  = useRef<any>(null);

  const [mapReady,    setMapReady]    = useState(false);
  const [showCatch,   setShowCatch]   = useState(false);
  const [showVillage, setShowVillage] = useState(false);
  const [showLabels,  setShowLabels]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [thematicLayerVisible, setThematicLayerVisible] = useState(true);

  // ── Read store ─────────────────────────────────────────────────────────────
  const drainSelection        = useBasicStore(s => s.drainSelection);
  const confirmedLocation     = useBasicStore(s => s.confirmedLocation);
  const setDrainSelectedVillageIds = useBasicStore(s => s.setDrainSelectedVillageIds);
  const isConfirmed           = !!confirmedLocation && confirmedLocation.mode === 'drain';

  const thematicMapData   = useBasicStore(s => s.thematicMapData);
  const thematicMapMethod = useBasicStore(s => s.thematicMapMethod);
  const thematicMapYear   = useBasicStore(s => s.thematicMapYear);
  const setThematicMapYear   = useBasicStore(s => s.setThematicMapYear);
  const setThematicMapMethod = useBasicStore(s => s.setThematicMapMethod);

  // Active values (post-confirm use confirmed, pre-confirm use in-progress)
  const activeDrain     = isConfirmed ? confirmedLocation!.drain! : drainSelection;
  const activeRiverId   = activeDrain.river?.id ?? '';
  const activeStretchId = activeDrain.stretch?.id ?? '';
  const activeDrainIds  = activeDrain.drains.map(d => d.id);
  const activeVillageIds = isConfirmed
    ? activeDrain.selectedVillageIds
    : drainSelection.selectedVillageIds;
  const selectionsLocked = isConfirmed;

  useEffect(() => {
    selectedVillageIdsRef.current = activeVillageIds;
  }, [activeVillageIds]);

  // ── Choropleth helpers ─────────────────────────────────────────────────────
  const CHOROPLETH_COLORS = ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'];
  function getQuantileBreaks(values: number[], n: number): number[] {
    if (!values.length) return [];
    const s = [...values].sort((a, b) => a - b);
    const breaks: number[] = [];
    for (let i = 1; i < n; i++) breaks.push(s[Math.floor((i / n) * s.length)]);
    return breaks;
  }
  function getChoroplethColor(v: number, breaks: number[]): string {
    for (let i = 0; i < breaks.length; i++) if (v <= breaks[i]) return CHOROPLETH_COLORS[i];
    return CHOROPLETH_COLORS[CHOROPLETH_COLORS.length - 1];
  }

  // ── Thematic map layer (vanilla Leaflet) ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;
    if (thematicLayerRef.current) { mapRef.current.removeLayer(thematicLayerRef.current); thematicLayerRef.current = null; }
    if (!thematicMapData || !thematicLayerVisible || !thematicMapData.features.length || !thematicMapYear) return;

    const method = thematicMapMethod || 'Arithmetic';
    const values = thematicMapData.features
      .map((f: any) => { const ym = f.properties?.[method]; return ym?.[thematicMapYear] ?? ym?.[String(thematicMapYear)]; })
      .filter((v: any): v is number => typeof v === 'number' && !isNaN(v));
    if (!values.length) return;

    const breaks = getQuantileBreaks(values, 5);

    thematicLayerRef.current = L.geoJSON(thematicMapData, {
      style: (feature: any) => {
        const ym = feature?.properties?.[method];
        const val = ym?.[thematicMapYear] ?? ym?.[String(thematicMapYear)];
        const color = typeof val === 'number' ? getChoroplethColor(val, breaks) : '#cccccc';
        return { fillColor: color, fillOpacity: 0.75, color: '#444', weight: 1 };
      },
      onEachFeature: (feature: any, lyr: any) => {
        const p = feature.properties ?? {};
        const ym = p[method] ?? {};
        const val = ym[thematicMapYear] ?? ym[String(thematicMapYear)];
        const pop2011 = p.population_2011 != null ? Number(p.population_2011).toLocaleString() : 'N/A';
        const projVal = val != null ? Math.round(val).toLocaleString() : 'N/A';
        let html = `<div style="font-family:sans-serif;font-size:12px;min-width:180px">` +
          `<b style="font-size:13px">${p.village_name || 'Village'}</b><br/>` +
          `<span style="color:#64748b">Population 2011:</span> ${pop2011}<br/>` +
          `<span style="color:#64748b">${method} (${thematicMapYear}):</span> <b>${projVal}</b>`;
        if (method === 'Cohort Total') {
          const ageSex = p['Cohort AgeSex'];
          const yrData = ageSex?.[thematicMapYear] ?? ageSex?.[String(thematicMapYear)];
          if (yrData) {
            const groups = Object.keys(yrData).filter((k: string) => k !== 'total').sort();
            html += `<hr style="margin:6px 0;border:none;border-top:1px solid #e2e8f0"/>` +
              `<b style="font-size:11px;color:#475569">Age-Sex Breakdown</b>` +
              `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:4px">` +
              `<tr style="background:#f1f5f9"><th style="padding:2px 4px;text-align:left">Age</th>` +
              `<th style="padding:2px 4px;text-align:right">Male</th><th style="padding:2px 4px;text-align:right">Female</th><th style="padding:2px 4px;text-align:right">Total</th></tr>`;
            for (const grp of groups) {
              const g = yrData[grp];
              html += `<tr><td style="padding:2px 4px">${grp}</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(g.male).toLocaleString()}</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(g.female).toLocaleString()}</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(g.total).toLocaleString()}</td></tr>`;
            }
            if (yrData['total']) {
              const t = yrData['total'];
              html += `<tr style="background:#f8fafc;font-weight:700"><td style="padding:2px 4px">Total</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(t.male).toLocaleString()}</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(t.female).toLocaleString()}</td>` +
                `<td style="padding:2px 4px;text-align:right">${Number(t.total).toLocaleString()}</td></tr>`;
            }
            html += `</table>`;
          }
        }
        if (method === 'Demographic') {
          const baseMap = p['Demographic'] ?? {};
          const base = baseMap[2011] ?? baseMap['2011'];
          if (base != null && val != null) {
            const change = Math.round(val) - Math.round(base);
            const pct = base > 0 ? ((change / base) * 100).toFixed(1) : '—';
            const sign = change >= 0 ? '+' : '';
            html += `<br/><span style="color:#64748b">Change from 2011:</span> ` +
              `<b style="color:${change >= 0 ? '#16a34a' : '#dc2626'}">${sign}${change.toLocaleString()} (${sign}${pct}%)</b>`;
          }
        }
        html += `</div>`;
        lyr.bindPopup(html, { maxWidth: 280 });
      },
    }).addTo(mapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thematicMapData, thematicMapMethod, thematicMapYear, thematicLayerVisible, mapReady]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const removeL = (ref: MutableRefObject<any>) => {
    if (ref.current && mapRef.current) { mapRef.current.removeLayer(ref.current); ref.current = null; }
  };
  const clearLabels = () => {
    labelsRef.current.forEach(m => mapRef.current?.removeLayer(m));
    labelsRef.current = [];
  };
  const villageStyle = (shapeID: string) => {
    const sel = activeVillageIds.includes(shapeID);
    return {
      color: sel ? '#c41212' : '#af9c9c',
      weight: sel ? 1 : 1.5,
      dashArray: '5, 5',
      opacity: 0.9,
      fillColor: sel ? '#ffbb0e' : '#ffffff',
      fillOpacity: sel ? 2.45 : 2.1,
      ...(selectionsLocked ? { dashArray: '4 3' } : {}),
    };
  };

  // ── 1. Init map once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let alive = true;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!alive || !mapContainerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current, { center: [23.59, 80.96], zoom: 5, preferCanvas: true });
      const tiles = {
        'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }),
        'Satellite':  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: '© Esri' }),
        'Light':      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' }),
      };
      tiles['Street Map'].addTo(map);
      L.control.layers(tiles, {}, { position: 'topright', collapsed: true }).addTo(map);
      controlsCleanupRef.current = await attachLeafletCommonControls(L, map, {
        enableScale: true,
        enableFullscreen: true,
        enableCoordinates: true,
        enableDraw: true,
      });

      LRef.current   = L;
      mapRef.current = map;
      setMapReady(true);

      // Load base layers
      setLoading(true);
      await Promise.all([loadBasin(L, map), loadRivers(L, map), loadAllStretches(L, map), loadAllDrains(L, map)]);
      setLoading(false);
    })();

    return () => {
      alive = false;
      clearLabels();
      controlsCleanupRef.current?.();
      controlsCleanupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      LRef.current   = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Re-style villages when selection changes ────────────────────────────
  useEffect(() => {
    if (!villageRef.current) return;
    villageRef.current.eachLayer((layer: any) => {
      const id = layer.feature?.properties?.shapeID?.toString();
      if (id) layer.setStyle?.(villageStyle(id));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVillageIds, selectionsLocked]);

  // ── 3. River changes ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeRiverId) return;
    // Highlight river
    riverRef.current?.eachLayer((l: any) => {
      const isIt = l.feature?.properties?.River_Code?.toString() === activeRiverId;
      l.setStyle?.({ color: isIt ? '#FF4500' : 'orange', weight: isIt ? 5 : 3, opacity: isIt ? 1 : 0.7 });
      if (isIt) {
        l.bringToFront?.();
        const b = l.getBounds?.();
        if (b?.isValid()) mapRef.current?.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
      }
    });
    // Fetch + highlight river stretches
    (async () => {
      const L = LRef.current;
      if (!L || !mapRef.current) return;
      try {
        const res = await fetch(`${API_BASE_URL}/basic/river-stretched/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ River_Code: parseInt(activeRiverId) }),
        });
        const data = await res.json();
        if (!data?.features?.length || !mapRef.current) return;
        removeL(stretchRef);
        stretchRef.current = L.geoJSON(data, {
          style: (f: any) => ({
            color: f?.properties?.River_Code?.toString() === activeRiverId ? '#0066FF' : 'green',
            weight: 2, opacity: 0.7,
          }),
          onEachFeature: (f: any, l: any) => l.bindPopup(`Stretch: ${f.properties.Stretch_ID ?? 'N/A'}`),
        }).addTo(mapRef.current);
        // Re-highlight if stretch already selected
        if (activeStretchId) highlightStretch(activeStretchId);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRiverId, mapReady]);

  // ── 4. Stretch changes ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !activeStretchId) return;
    highlightStretch(activeStretchId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStretchId, mapReady]);

  const highlightStretch = (id: string) => {
    stretchRef.current?.eachLayer((l: any) => {
      const isIt = l.feature?.properties?.Stretch_ID?.toString() === id;
      l.setStyle?.({ color: isIt ? '#FF0066' : '#0066FF', weight: isIt ? 6 : 2, opacity: isIt ? 1 : 0.6 });
      if (isIt) {
        l.bringToFront?.();
        const b = l.getBounds?.();
        if (b?.isValid()) mapRef.current?.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
      }
    });
  };

  // ── 5. Drain selection changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let mergedBounds: any = null;
    drainRef.current?.eachLayer((l: any) => {
      const id = l.feature?.properties?.Drain_No?.toString();
      const hit = activeDrainIds.includes(id ?? '');
      l.setStyle?.({
        color: hit ? '#111827' : '#2563eb',
        weight: hit ? 3 : 1.5,
        opacity: hit ? 1 : 0.8,
        fillColor: hit ? '#111827' : '#2563eb',
        fillOpacity: hit ? 0.9 : 0.6,
      });
      if (hit) {
        l.bringToFront?.();
        const b = l.getBounds?.();
        if (b?.isValid()) mergedBounds = mergedBounds ? mergedBounds.extend(b) : b;
      }
    });
    if (mergedBounds?.isValid?.() && mapRef.current) {
      mapRef.current.fitBounds(mergedBounds, { padding: [50, 50], maxZoom: 13 });
    }
    if (activeDrainIds.length > 0) {
      loadCatchmentVillages();
    } else {
      removeL(catchRef);
      removeL(villageRef);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(activeDrainIds), mapReady]);

  // ── 6. Catchment / Village toggles ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    if (showCatch) loadCatchmentVillages(); else removeL(catchRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCatch, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    if (showVillage) loadCatchmentVillages(); else removeL(villageRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVillage, mapReady]);

  // ── 7. Labels ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    clearLabels();
    if (!showLabels || !stretchRef.current || !LRef.current) return;
    const L = LRef.current;
    stretchRef.current.eachLayer((layer: any) => {
      const id = layer.feature?.properties?.Stretch_ID;
      const coords = layer.feature?.geometry?.coordinates;
      if (!id || !coords) return;
      let latlng: any = null;
      if (layer.feature.geometry.type === 'LineString') {
        const mid = coords[Math.floor(coords.length / 2)];
        latlng = L.latLng(mid[1], mid[0]);
      }
      if (!latlng || !mapRef.current) return;
      const m = L.marker(latlng, {
        icon: L.divIcon({ html: `<div style="background:none;font-weight:bold;color:#000;text-shadow:0 0 3px #fff;font-size:11px">${id}</div>`, className: '', iconSize: [60, 18], iconAnchor: [30, 9] }),
        interactive: false, zIndexOffset: 1000,
      }).addTo(mapRef.current);
      labelsRef.current.push(m);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLabels, mapReady]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  async function loadBasin(L: any, map: any) {
    try {
      const d = await (await fetch(`${API_BASE_URL}/basic/basin/`)).json();
      if (!d?.features?.length) return;
      basinRef.current = L.geoJSON(d, {
        style: () => ({ color: 'rgb(121,0,151)', weight: 2, opacity: 0.8, fillOpacity: 0, dashArray: '5 5' }),
        pane: 'tilePane',
      }).addTo(map);
      basinRef.current.bringToBack();
      const basinBounds = basinRef.current.getBounds?.();
      if (basinBounds?.isValid()) {
        map.fitBounds(basinBounds, { padding: [30, 30], maxZoom: 8 });
      }
    } catch {}
  }
  async function loadRivers(L: any, map: any) {
    try {
      const d = await (await fetch(`${API_BASE_URL}/basic/rivers/`)).json();
      if (!d?.features?.length) return;
      riverRef.current = L.geoJSON(d, {
        style: () => ({ color: 'orange', weight: 3, opacity: 0.7 }),
        onEachFeature: (f: any, l: any) => l.bindPopup(`River: ${f.properties.River_Name ?? 'Unknown'}`),
      }).addTo(map);
    } catch {}
  }
  async function loadAllStretches(L: any, map: any) {
    try {
      const d = await (await fetch(`${API_BASE_URL}/basic/all-stretches/`)).json();
      if (!d?.features?.length) return;
      stretchRef.current = L.geoJSON(d, {
        style: () => ({ color: 'green', weight: 1, opacity: 0.4 }),
        onEachFeature: (f: any, l: any) => l.bindPopup(`Stretch: ${f.properties.Stretch_ID ?? 'N/A'}`),
      }).addTo(map);
    } catch {}
  }
  async function loadAllDrains(L: any, map: any) {
    try {
      const d = await (await fetch(`${API_BASE_URL}/basic/drain/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })).json();
      if (!d?.features?.length) return;
      drainRef.current = L.geoJSON(d, {
        style: () => ({ color: 'blue', weight: 1, opacity: 0.8 }),
        pointToLayer: (_feature: any, latlng: any) =>
          L.circleMarker(latlng, {
            radius: 3,
            color: '#2563eb',
            weight: 1,
            fillColor: '#2563eb',
            fillOpacity: 0.85,
          }),
        onEachFeature: (f: any, l: any) => l.bindPopup(`Drain: ${f.properties.Drain_No ?? 'N/A'}`),
      }).addTo(map);
    } catch {}
  }
  async function loadCatchmentVillages() {
    const L = LRef.current;
    if (!L || !mapRef.current || !activeDrainIds.length) return;
    try {
      const res = await fetch(`${API_BASE_URL}/basic/catchment_village/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Drain_No: activeDrainIds.map(Number) }),
      });
      const data = await res.json();

      if (data.catchment_geojson?.features?.length && showCatch) {
        removeL(catchRef);
        catchRef.current = L.geoJSON(data.catchment_geojson, {
          style: () => ({ color: 'black', weight: 3, opacity: 0.8, fillColor: '#E6E6FA', fillOpacity: 0.3 }),
          onEachFeature: (f: any, l: any) => l.bindPopup(`Catchment: ${f.properties.Catchment_Name ?? 'N/A'}`),
        }).addTo(mapRef.current!);
      }

      if (data.village_geojson?.features?.length && showVillage) {
        buildVillageLayer(L, data.village_geojson);
      }
    } catch {}
  }

  function buildVillageLayer(L: any, geojson: any) {
    if (!mapRef.current) return;
    removeL(villageRef);
    villageRef.current = L.geoJSON(geojson, {
      style: (f: any) => villageStyle(f?.properties?.shapeID?.toString() ?? ''),
      onEachFeature: (f: any, layer: any) => {
        const id   = f.properties.shapeID?.toString();
        const name = f.properties.shapeName ?? 'Unknown';
        layer.bindPopup(`${name}<br/><small>${id}</small>${selectionsLocked ? '<br/><em>(locked)</em>' : ''}`);
        layer.on('mouseover', () => {
          layer.openPopup();
          if (mapRef.current) mapRef.current.getContainer().style.cursor = selectionsLocked ? 'not-allowed' : 'pointer';
        });
        layer.on('mouseout', () => {
          layer.closePopup();
          if (mapRef.current) mapRef.current.getContainer().style.cursor = '';
        });
        if (!selectionsLocked && id) {
          layer.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            const curr = new Set(selectedVillageIdsRef.current);
            if (curr.has(id)) curr.delete(id); else curr.add(id);
            setDrainSelectedVillageIds([...curr]);
          });
        }
      },
    }).addTo(mapRef.current);
    villageRef.current.bringToFront();
    const bounds = villageRef.current.getBounds();
    if (bounds?.isValid()) mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

  // ── Render — SAME styling as old DrainMap ─────────────────────────────────
  return (
    <div className={`map-container h-full ${className ?? ''}`} style={{ background: '#fff' }}>
      <div
        ref={mapContainerRef}
        className="drain-map border-4 border-blue-500 rounded-xl shadow-lg hover:border-green-500 hover:shadow-2xl transition-all duration-300 w-full h-full relative"
        style={{ background: '#fff', overflow: 'hidden' }}
      >
        {/* ── Legend overlay ── */}
        <div className="absolute top-2 left-14 z-[1000] bg-white bg-opacity-90 p-2 rounded-lg shadow-lg border border-gray-300">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { color: 'rgb(121,0,151)', label: 'Basin' },
              { color: '#f97316',        label: 'Rivers' },
              { color: '#16a34a',        label: 'Stretches' },
              { color: '#1d4ed8',        label: 'Drains' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-3 h-3 inline-block rounded-sm" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
            <button
              className="text-xs bg-gray-200 hover:bg-gray-300 py-0.5 px-2 rounded transition-colors"
              onClick={() => setShowLabels(v => !v)}
            >
              {showLabels ? 'Hide' : 'Show'} Labels
            </button>
          </div>
        </div>

        {/* ── Catchment + Village toggles ── */}
        {activeDrainIds.length > 0 && (
          <div className="absolute bottom-5 right-2 flex flex-col gap-1 z-[1000]">
            <label className="flex items-center gap-2 bg-white bg-opacity-90 p-2 rounded border border-gray-300 shadow-lg text-xs cursor-pointer">
              <input type="checkbox" checked={showCatch} onChange={e => { setShowCatch(e.target.checked); if (!e.target.checked) setShowVillage(false); }} disabled={selectionsLocked} />
              <span className="w-3 h-3 inline-block border" style={{ background: '#E6E6FA', borderColor: 'black' }} />
              Delineate Catchments
            </label>
            <label className={`flex items-center gap-2 bg-white bg-opacity-90 p-2 rounded border border-gray-300 shadow-lg text-xs ${showCatch ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
              <input type="checkbox" checked={showVillage} disabled={!showCatch || selectionsLocked} onChange={e => setShowVillage(e.target.checked)} />
              <span className="w-3 h-3 inline-block border" style={{ background: 'skyblue', borderColor: 'skyblue' }} />
              Show Villages in Catchments
              {selectionsLocked && <span className="text-gray-400 ml-1">(Locked)</span>}
            </label>
            {showVillage && !selectionsLocked && (
              <div className="bg-white bg-opacity-90 p-2 text-xs rounded border border-gray-300 shadow-lg text-blue-600">
                Click villages to toggle selection
              </div>
            )}
            {showVillage && selectionsLocked && (
              <div className="bg-yellow-50 bg-opacity-90 p-2 text-xs rounded border border-yellow-300 shadow-lg">
                Village selection locked
              </div>
            )}
          </div>
        )}

        {/* ── Thematic map legend ── */}
        {thematicMapData && thematicMapData.features.length > 0 && (() => {
          const ALL_METHODS = ['Arithmetic', 'Geometric', 'Incremental', 'Exponential', 'Demographic', 'Cohort Total'];
          const firstProps = thematicMapData.features[0]?.properties ?? {};
          const availableMethods = ALL_METHODS.filter((m) => firstProps[m] != null);
          const method = (thematicMapMethod && availableMethods.includes(thematicMapMethod))
            ? thematicMapMethod : (availableMethods[0] ?? 'Arithmetic');
          const activeYear = thematicMapYear
            ?? thematicMapData.available_years?.[thematicMapData.available_years.length - 1];
          const values = thematicMapData.features
            .map((f: any) => { const ym = f.properties?.[method]; return ym?.[activeYear] ?? ym?.[String(activeYear)]; })
            .filter((v: any): v is number => typeof v === 'number' && !isNaN(v));
          const breaks = getQuantileBreaks(values, 5);
          const minVal = values.length ? Math.min(...values) : 0;
          const maxVal = values.length ? Math.max(...values) : 0;
          const labels: string[] = breaks.length
            ? [`≤ ${Math.round(breaks[0]).toLocaleString()}`,
               ...breaks.slice(1).map((b, i) => `${Math.round(breaks[i] + 1).toLocaleString()} – ${Math.round(b).toLocaleString()}`),
               `> ${Math.round(breaks[breaks.length - 1]).toLocaleString()}`]
            : [`${Math.round(minVal).toLocaleString()} – ${Math.round(maxVal).toLocaleString()}`];
          const COLORS = ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'];
          const sel: React.CSSProperties = {
            width: '100%', fontSize: 11, fontWeight: 600, padding: '4px 6px',
            borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc',
            color: '#1e293b', cursor: 'pointer',
          };
          return (
            <div style={{
              position: 'absolute', bottom: 28, right: 10, zIndex: 1000,
              background: 'rgba(255,255,255,0.96)', borderRadius: 10,
              border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              padding: '10px 14px', minWidth: 210,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Thematic Map</span>
                <button type="button" onClick={() => setThematicLayerVisible(v => !v)}
                  style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                    border: '1px solid #cbd5e1', cursor: 'pointer',
                    background: thematicLayerVisible ? '#eff6ff' : '#f8fafc',
                    color: thematicLayerVisible ? '#2563eb' : '#64748b' }}>
                  {thematicLayerVisible ? 'Hide' : 'Show'}
                </button>
              </div>
              {availableMethods.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Method</label>
                  <select value={method} onChange={e => setThematicMapMethod(e.target.value)} style={sel}>
                    {availableMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              {thematicMapData.available_years?.length > 1 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Year</label>
                  <select value={activeYear ?? ''} onChange={e => setThematicMapYear(Number(e.target.value))} style={sel}>
                    {thematicMapData.available_years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                </div>
              )}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Population ({activeYear})
                </span>
                {COLORS.slice(0, labels.length).map((color, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                    <span style={{ width: 16, height: 12, background: color, border: '1px solid #aaa', borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#374151' }}>{labels[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Loading overlay ── */}
        {loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000]">
            <div className="flex items-center bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading Map…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
