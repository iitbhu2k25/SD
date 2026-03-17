'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useBasicStore } from '../store/basic.store';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { attachLeafletCommonControls } from '../utils/leafletCommonControls';

/* ─────────────────────────────────────────────────────────────────────────────
   IndCatchmentMapView — India Catchment Leaflet map.
   Same visual styling as DrainMapView / old IndCatchmentMap.tsx.
   Reads/writes store instead of using callbacks.
───────────────────────────────────────────────────────────────────────────── */

interface Props { className?: string; }

export default function IndCatchmentMapView({ className }: Props) {
  const mapContainerRef  = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<any>(null);
  const watershedLayerRef = useRef<any>(null);
  const villagesLayerRef  = useRef<any>(null);
  const markerRef         = useRef<any>(null);
  const stateLayerRef     = useRef<any>(null);
  const mountedRef        = useRef(true);
  const selectedVillageIdsRef = useRef<string[]>([]);
  const controlsCleanupRef = useRef<null | (() => void)>(null);

  const [mapReady,        setMapReady]        = useState(false);
  const [isFetching,      setIsFetching]      = useState(false);
  const [fetchingVil,     setFetchingVil]     = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [fetchEnabled,    setFetchEnabled]    = useState(true);
  const [layerDropOpen,   setLayerDropOpen]   = useState(false);
  const [layerState,      setLayerState]      = useState({ watershed: false, villages: false, marker: false });

  // ── Store ──────────────────────────────────────────────────────────────────
  const indiaCatchmentSelection    = useBasicStore(s => s.indiaCatchmentSelection);
  const confirmedLocation          = useBasicStore(s => s.confirmedLocation);
  const setPoint                   = useBasicStore(s => s.setIndiaCatchmentPoint);
  const setWatershed               = useBasicStore(s => s.setIndiaCatchmentWatershed);
  const setVillages                = useBasicStore(s => s.setIndiaCatchmentVillages);
  const setSelectedIds             = useBasicStore(s => s.setIndiaCatchmentSelectedIds);

  const isConfirmed = !!confirmedLocation && confirmedLocation.mode === 'india_catchment';
  const activeSelectedIds = isConfirmed
    ? (confirmedLocation?.indiaCatchment?.selectedVillageIds ?? [])
    : indiaCatchmentSelection.selectedVillageIds;

  useEffect(() => {
    selectedVillageIdsRef.current = activeSelectedIds;
  }, [activeSelectedIds]);

  // ── Village style ──────────────────────────────────────────────────────────
  const getVillageStyle = useCallback((vlcode: string) => {
    const sel = activeSelectedIds.includes(vlcode);
    return {
      color: sel ? '#460394' : '#069cca',
      weight: sel ? 1 : 2,
      fillColor: sel ? '#03b503' : '#c62c2c',
      fillOpacity: 1.6,
    };
  }, [activeSelectedIds]);

  // Re-style villages on selection change
  useEffect(() => {
    if (!villagesLayerRef.current) return;
    villagesLayerRef.current.eachLayer((layer: any) => {
      const vlcode = layer?.feature?.properties?.vlcode;
      if (vlcode) layer.setStyle(getVillageStyle(vlcode));
    });
  }, [activeSelectedIds, getVillageStyle]);

  const syncLayerState = useCallback(() => {
    setLayerState({
      watershed: !!(watershedLayerRef.current && mapRef.current?.hasLayer(watershedLayerRef.current)),
      villages:  !!(villagesLayerRef.current  && mapRef.current?.hasLayer(villagesLayerRef.current)),
      marker:    !!(markerRef.current         && mapRef.current?.hasLayer(markerRef.current)),
    });
  }, []);

  const clearAllLayers = useCallback(() => {
    if (!mapRef.current) return;
    for (const r of [watershedLayerRef, villagesLayerRef, markerRef]) {
      if (r.current) { mapRef.current.removeLayer(r.current); r.current = null; }
    }
    setError(null);
    syncLayerState();
  }, [syncLayerState]);

  // ── Fetch villages ─────────────────────────────────────────────────────────
  const fetchVillagesSpatial = useCallback(async (watershedGeoJSON: any) => {
    if (!mountedRef.current || !mapRef.current) return;
    const L = (await import('leaflet')).default;
    setFetchingVil(true);
    if (villagesLayerRef.current) { mapRef.current?.removeLayer(villagesLayerRef.current); villagesLayerRef.current = null; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/village-intersection`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(watershedGeoJSON),
      });
      if (!mountedRef.current || !mapRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current || !mapRef.current) return;

      if (data.success && Array.isArray(data.villages) && data.villages.length > 0) {
        const features: any[] = data.villages.filter((v: any) => v.geometry).map((v: any) => ({
          type: 'Feature', geometry: v.geometry,
          properties: {
            vlcode:     v.vlcode ?? v.village_code ?? '',
            village:    v.village ?? v.village_name ?? 'Unknown',
            population: v.total_popu ?? v.population ?? 0,
            subdis_cod: v.subdis_cod ?? '',
          },
        }));
        const fc = { type: 'FeatureCollection', features };
        const layer = L.geoJSON(fc as any, {
          style: (f: any) => getVillageStyle(f?.properties?.vlcode ?? ''),
          onEachFeature: (f: any, lyr: any) => {
            const { vlcode, village, population } = f.properties;
            lyr.bindPopup(`<b>${village}</b><br/><small>${vlcode}</small>${population > 0 ? `<br/><small>Pop: ${Number(population).toLocaleString()}</small>` : ''}`);
            lyr.on('click', (e: any) => {
              if (isConfirmed) return;
              const L2 = (window as any).__leaflet__;
              L2?.DomEvent?.stopPropagation?.(e);
              const curr = new Set(selectedVillageIdsRef.current);
              if (curr.has(vlcode)) curr.delete(vlcode); else curr.add(vlcode);
              setSelectedIds([...curr]);
            });
          },
        });
        if (!mountedRef.current || !mapRef.current) return;
        layer.addTo(mapRef.current);
        villagesLayerRef.current = layer;
        syncLayerState();

        const norm = data.villages.map((v: any) => ({
          vlcode: v.vlcode ?? v.village_code ?? '',
          village: v.village ?? v.village_name ?? 'Unknown',
          population: v.total_popu ?? v.population ?? 0,
          subdis_cod: v.subdis_cod ?? '',
          geometry: v.geometry,
        }));
        setVillages(norm, data.total_population ?? 0);
      } else {
        setVillages([], 0);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch villages');
      setVillages([], 0);
    } finally {
      if (mountedRef.current) setFetchingVil(false);
    }
  }, [getVillageStyle, syncLayerState, isConfirmed, setVillages, setSelectedIds]);

  // ── Fetch watershed ────────────────────────────────────────────────────────
  const fetchWatershed = useCallback(async (lat: number, lng: number) => {
    if (!mountedRef.current || !mapRef.current) return;
    const L = (await import('leaflet')).default;
    (window as any).__leaflet__ = L;

    setIsFetching(true); setFetchEnabled(false); setError(null);
    clearAllLayers();
    setPoint({ lat, lng });

    try {
      const url = `https://mghydro.com/app/watershed_api?task=watershed&lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}&precision=low&source=merit`;
      const res = await fetch(url);
      if (!mountedRef.current || !mapRef.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current || !mapRef.current) return;
      if (!data?.features?.length) throw new Error('No watershed data for this location.');

      // Marker
      const icon = L.divIcon({ className: '', html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
      if (!mountedRef.current || !mapRef.current) return;
      markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current).bindPopup(`<b>Selected Point</b><br/>Lat: ${lat.toFixed(5)}<br/>Lng: ${lng.toFixed(5)}`).openPopup();

      const wLayer = L.geoJSON(data, { style: { color: '#800909', weight: 3, fill: false, fillOpacity: 0 } }).addTo(mapRef.current);
      watershedLayerRef.current = wLayer;
      syncLayerState();

      const bounds = wLayer.getBounds();
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [50, 50] });

      setWatershed({ features: data.features.length, geometryType: data.features[0]?.geometry?.type ?? 'Unknown', properties: data.features[0]?.properties ?? {} });
      await fetchVillagesSpatial(data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch watershed');
      clearAllLayers();
    } finally {
      if (mountedRef.current) setIsFetching(false);
    }
  }, [clearAllLayers, fetchVillagesSpatial, setPoint, setWatershed, syncLayerState]);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    let cancelled = false;
    mountedRef.current = true;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapContainerRef.current) return;
      (window as any).__leaflet__ = L;

      const map = L.map(mapContainerRef.current, { center: [20.59, 78.96], zoom: 5, zoomControl: true });
      const tiles = {
        'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
        'Satellite':  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
        'Light':      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CARTO' }),
      };
      tiles['Street Map'].addTo(map);
      L.control.layers(tiles, {}, { position: 'topright', collapsed: true }).addTo(map);
      mapRef.current = map;
      controlsCleanupRef.current = await attachLeafletCommonControls(L, map, {
        enableScale: true,
        enableFullscreen: true,
        enableCoordinates: true,
        enableDraw: true,
      });

      // State boundary WFS (non-fatal)
      fetch(`${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=myworkspace:B_State&outputFormat=application/json`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(geojson => {
          if (cancelled) return;
          const sl = L.geoJSON(geojson, {
            style: { color: '#0549b6', weight: 1.5, opacity: 0.7, fill: false, fillOpacity: 0, dashArray: '4 3' },
            onEachFeature: (f: any, lyr: any) => {
              const name = f.properties?.state_name ?? f.properties?.STATE_NAME ?? f.properties?.name ?? '';
              if (name) lyr.bindTooltip(name, { sticky: true, className: 'text-xs' });
            },
          }).addTo(map);
          sl.bringToBack();
          stateLayerRef.current = sl;
        })
        .catch(() => {});

      map.whenReady(() => { if (!cancelled) setMapReady(true); });

    })();

    return () => {
      cancelled = true; mountedRef.current = false;
      setMapReady(false);
      stateLayerRef.current = null;
      controlsCleanupRef.current?.();
      controlsCleanupRef.current = null;
      mapRef.current?.remove(); mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register click handler separately so it always sees latest fetchEnabled
  const fetchEnabledRef = useRef(fetchEnabled);
  useEffect(() => { fetchEnabledRef.current = fetchEnabled; }, [fetchEnabled]);
  const isFetchingRef = useRef(isFetching);
  useEffect(() => { isFetchingRef.current = isFetching; }, [isFetching]);
  const fetchWatershedRef = useRef(fetchWatershed);
  useEffect(() => { fetchWatershedRef.current = fetchWatershed; }, [fetchWatershed]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const onClick = (e: any) => {
      if (!fetchEnabledRef.current || isFetchingRef.current || isConfirmed) return;
      fetchWatershedRef.current(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [mapReady, isConfirmed]);


  const toggleLayer = (key: 'watershed' | 'villages' | 'marker') => {
    const r = key === 'watershed' ? watershedLayerRef : key === 'villages' ? villagesLayerRef : markerRef;
    if (!r.current || !mapRef.current) return;
    if (mapRef.current.hasLayer(r.current)) mapRef.current.removeLayer(r.current);
    else r.current.addTo(mapRef.current);
    syncLayerState();
  };

  const hasAnyLayer = layerState.watershed || layerState.villages || layerState.marker;
  const mapCursor = !mapReady ? 'wait' : (isConfirmed || !fetchEnabled) ? 'not-allowed' : 'crosshair';

  // ── Render — SAME styling as DrainMap ────────────────────────────────────
  return (
    <div className={`map-container h-full ${className ?? ''}`} style={{ background: '#fff' }}>
      <div
        ref={mapContainerRef}
        className="border-4 border-blue-500 rounded-xl shadow-lg hover:border-green-500 hover:shadow-2xl transition-all duration-300 w-full h-full relative"
        style={{ background: '#fff', overflow: 'hidden', cursor: mapCursor }}
      >
        {/* ── Instruction / Fetch toggle (top-left) ── */}
        {mapReady && (
          <div className="absolute top-2 left-14 flex items-center gap-2 z-[1000]">
            <div className="bg-white border border-blue-300 rounded-lg shadow-md px-3 py-1.5">
              <p className="text-xs font-medium text-blue-800">
                💧 {isFetching ? 'Fetching watershed…' : isConfirmed ? 'Location confirmed' : fetchEnabled ? 'Click map to delineate watershed' : 'Fetch OFF'}
              </p>
            </div>
            {!isConfirmed && (
              <button onClick={() => setFetchEnabled(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md border text-xs font-semibold transition-colors ${fetchEnabled ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                <span className={`inline-flex w-8 h-4 rounded-full relative transition-colors ${fetchEnabled ? 'bg-blue-300' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${fetchEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </span>
                {fetchEnabled ? 'Fetch ON' : 'Fetch OFF'}
              </button>
            )}
          </div>
        )}

        {/* ── Layer dropdown ── */}
        {hasAnyLayer && mapReady && !isFetching && (
          <div className="absolute top-14 left-14 z-[1000]" style={{ marginTop: 8 }}>
            <div className="bg-white rounded-lg shadow-lg border border-gray-200">
              <button onClick={() => setLayerDropOpen(v => !v)} className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>
                  <span className="text-sm font-medium text-gray-700">Layers</span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${layerDropOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {layerDropOpen && (
                <div className="border-t border-gray-100 p-2 space-y-1 min-w-[180px]">
                  {(['watershed', 'villages', 'marker'] as const).filter(k => {
                    const r = k === 'watershed' ? watershedLayerRef : k === 'villages' ? villagesLayerRef : markerRef;
                    return !!r.current;
                  }).map(k => (
                    <button key={k} onClick={() => toggleLayer(k)}
                      className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${layerState[k] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          {layerState[k] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-sm text-gray-700 capitalize">{k}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        {layerState.villages && mapReady && (
          <div className="absolute bottom-8 left-4 bg-white rounded-lg shadow-md border border-gray-200 px-4 py-3 z-[1000]">
            <h4 className="text-xs font-bold text-gray-700 mb-2">Legend</h4>
            <div className="space-y-1.5">
              {[
                { color: '#800909', label: 'Watershed', fill: false },
                { color: '#3d7a05', label: 'Selected Village',   fillColor: '#4ad826' },
                { color: '#ce1111', label: 'Unselected Village', fillColor: '#b32e2e' },
                { color: '#ef4444', label: 'Selected Point', isCircle: true },
              ].map(({ color, label, fillColor, isCircle }) => (
                <div key={label} className="flex items-center gap-2">
                  {isCircle
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow" style={{ background: color }} />
                    : <div className="w-5 h-4 border-2 rounded-sm" style={{ borderColor: color, background: fillColor ?? 'transparent' }} />}
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* ── Fetch spinner ── */}
        {(isFetching || fetchingVil) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 space-y-2 min-w-[200px]">
            {isFetching && <div className="flex items-center gap-2 text-sm text-gray-700"><svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Delineating watershed…</div>}
            {fetchingVil && <div className="flex items-center gap-2 text-sm text-gray-700"><svg className="animate-spin h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading villages…</div>}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="absolute top-4 right-4 bg-red-50 border border-red-300 rounded-lg shadow-lg px-4 py-3 z-[1000] max-w-xs">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 underline">Dismiss</button>
          </div>
        )}

        {/* ── Initial loading ── */}
        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-80 flex items-center justify-center z-[999] rounded-xl">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-600">Initialising map…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
