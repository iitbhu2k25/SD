'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ── Choropleth colour scale (same as AdminMapLayer) ────────────────────────
const CHOROPLETH_COLORS = [
  '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c',
  '#fc4e2a', '#e31a1c', '#bd0026', '#800026', '#4d0012',
];

function getQuantileBreaks(values: number[], n: number): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < n; i++) breaks.push(sorted[Math.floor((i / n) * sorted.length)]);
  return breaks;
}

function getChoroplethColor(val: number, breaks: number[]): string {
  for (let i = 0; i < breaks.length; i++) if (val <= breaks[i]) return CHOROPLETH_COLORS[i];
  return CHOROPLETH_COLORS[CHOROPLETH_COLORS.length - 1];
}

// ── Method groups matching the DSS modules ─────────────────────────────────
const METHOD_GROUPS = [
  {
    label: 'Population',
    color: '#046c4e',
    methods: ['Arithmetic', 'Geometric', 'Exponential', 'Logistic', 'Decreasing Rate', 'Cohort Total'],
  },
  {
    label: 'Water Demand',
    color: '#05789b',
    methods: ['Domestic', 'Floating', 'Institutional', 'Firefighting', 'Total Water Demand'],
  },
  {
    label: 'Water Supply',
    color: '#6326d2',
    methods: ['Water Supply', 'Water Demand', 'Water Gap', 'Status'],
  },
  {
    label: 'Sewage',
    color: '#ad4809',
    methods: ['Population Based', 'Water Based', 'Drain Based'],
  },
];

const WD_METHODS = new Set([
  'Domestic', 'Floating', 'Institutional', 'Firefighting', 'Total Water Demand',
  'Water Supply', 'Water Demand', 'Water Gap', 'Status',
  'Population Based', 'Water Based', 'Drain Based',
]);

interface ReportMapProps {
  features: any[];
  availableYears: number[];
  mode?: string;
}

export default function ReportMap({ features, availableYears, mode }: ReportMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const availableMethods = METHOD_GROUPS.map((g) => ({
    ...g,
    methods: g.methods.filter((m) =>
      features.some((f) => f?.properties?.[m] != null),
    ),
  })).filter((g) => g.methods.length > 0);

  const defaultMethod = availableMethods[0]?.methods[0] ?? null;
  const defaultYear = availableYears.length ? availableYears[availableYears.length - 1] : null;

  const [selectedMethod, setSelectedMethod] = useState<string | null>(defaultMethod);
  const [selectedYear, setSelectedYear] = useState<number | null>(defaultYear);
  const [legendItems, setLegendItems] = useState<{ color: string; label: string }[]>([]);

  // ── Capture current map view to a data URL ────────────────────────────────
  const captureMap = useCallback(async (): Promise<string | null> => {
    if (!containerRef.current || !mapRef.current) return null;
    const container = containerRef.current;
    const w = container.offsetWidth;
    const h = container.offsetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#e8ecf0';
    ctx.fillRect(0, 0, w, h);

    const baseRect = container.getBoundingClientRect();

    // 1. Draw raster tile <img> elements
    const tiles = Array.from(
      container.querySelectorAll('.leaflet-tile'),
    ) as HTMLImageElement[];
    for (const tile of tiles) {
      if (!tile.complete || !tile.src) continue;
      try {
        const r = tile.getBoundingClientRect();
        ctx.drawImage(tile, r.left - baseRect.left, r.top - baseRect.top, r.width, r.height);
      } catch { /* CORS mismatch – skip tile */ }
    }

    // 2. Draw SVG overlay pane (GeoJSON choropleth polygons)
    const svgs = Array.from(container.querySelectorAll('svg'));
    for (const svg of svgs) {
      try {
        const r = svg.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const raw = new XMLSerializer().serializeToString(svg);
        const blob = new Blob(
          [`<?xml version="1.0" encoding="utf-8"?>`, raw],
          { type: 'image/svg+xml' },
        );
        const url = URL.createObjectURL(blob);
        await new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, r.left - baseRect.left, r.top - baseRect.top, r.width, r.height);
            URL.revokeObjectURL(url);
            res();
          };
          img.onerror = () => { URL.revokeObjectURL(url); res(); };
          img.src = url;
        });
      } catch { /* skip */ }
    }

    // 3. Draw any canvas-based layers
    const canvases = Array.from(container.querySelectorAll('canvas'));
    for (const c of canvases) {
      try {
        const r = c.getBoundingClientRect();
        ctx.drawImage(c, r.left - baseRect.left, r.top - baseRect.top, r.width, r.height);
      } catch { /* skip */ }
    }

    return canvas.toDataURL('image/png');
  }, []);

  // Expose captureMap globally so page.tsx can call it before window.print()
  useEffect(() => {
    (window as any).__reportMapCapture = captureMap;
    return () => { delete (window as any).__reportMapCapture; };
  }, [captureMap]);

  // ── Rebuild choropleth layer ───────────────────────────────────────────────
  const rebuildLayer = useCallback(
    (L: any, map: any) => {
      if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
      if (!features.length || !selectedMethod) return;

      const isStatus = selectedMethod === 'Status';
      const year = selectedYear;
      const yearKey = year == null ? null : String(year);

      const vals: number[] = isStatus
        ? []
        : features
            .map((f) => {
              const ym = f?.properties?.[selectedMethod];
              return yearKey == null ? undefined : ym?.[yearKey];
            })
            .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      const breaks = isStatus ? [] : getQuantileBreaks(vals, CHOROPLETH_COLORS.length);

      const layer = L.geoJSON(
        { type: 'FeatureCollection', features } as any,
        {
          style: (feature: any) => {
            const ym = feature?.properties?.[selectedMethod];
            const val = yearKey == null ? undefined : ym?.[yearKey];
            let color = '#cccccc';
            if (isStatus) {
              color = val === 'Sufficient' ? '#16a34a' : val === 'Deficit' ? '#dc2626' : '#cccccc';
            } else if (typeof val === 'number') {
              color = getChoroplethColor(val, breaks);
            }
            return { fillColor: color, fillOpacity: 0.72, color: '#555', weight: 1, opacity: 0.8 };
          },
          onEachFeature: (feature: any, lyr: any) => {
            const p = feature?.properties ?? {};
            const ym = p[selectedMethod] ?? {};
            const val = yearKey == null ? undefined : ym[yearKey];
            const name = p.village_name ?? p.name ?? p.shapeName ?? p.NAME ?? '';
            const isGap = selectedMethod === 'Water Gap';
            let valStr = 'N/A';
            if (val != null) {
              if (isStatus) valStr = String(val);
              else if (isGap && typeof val === 'number')
                valStr = `${val >= 0 ? '+' : ''}${val.toFixed(3)} MLD`;
              else if (WD_METHODS.has(selectedMethod) && typeof val === 'number')
                valStr = `${Number(val).toFixed(3)} MLD`;
              else if (typeof val === 'number') valStr = Number(val).toLocaleString();
              else valStr = String(val);
            }
            lyr.bindTooltip(
              `<div style="font-family:system-ui;font-size:12px;padding:6px 10px;min-width:150px">
                ${name ? `<strong style="display:block;margin-bottom:3px">${name}</strong>` : ''}
                <span style="color:#64748b">${selectedMethod} (${year ?? ''}):</span>
                <strong style="color:#0f172a"> ${valStr}</strong>
              </div>`,
              { sticky: true, opacity: 0.97 },
            );
          },
        },
      ).addTo(map);

      layerRef.current = layer;

      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
      } catch { /* ignore */ }

      // Build legend
      if (isStatus) {
        setLegendItems([
          { color: '#16a34a', label: 'Sufficient' },
          { color: '#dc2626', label: 'Deficit' },
          { color: '#cccccc', label: 'No data' },
        ]);
      } else if (vals.length) {
        const step = Math.ceil(breaks.length / 5);
        const shown = breaks.filter((_, i) => i % step === 0);
        setLegendItems(
          CHOROPLETH_COLORS.slice(0, shown.length + 1).map((c, i) => ({
            color: c,
            label:
              i === 0
                ? `≤ ${Number(shown[0] ?? vals[0]).toLocaleString()}`
                : i < shown.length
                ? `≤ ${Number(shown[i]).toLocaleString()}`
                : `> ${Number(shown[shown.length - 1]).toLocaleString()}`,
          })),
        );
      } else {
        setLegendItems([]);
      }
    },
    [features, selectedMethod, selectedYear],
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((Lmod) => {
      const L = Lmod.default;
      if (!containerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, { center: [20.5937, 78.9629], zoom: 5 });

      // crossOrigin: 'anonymous' allows tiles to be drawn on canvas (needed for print capture)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      } as any).addTo(map);

      mapRef.current = map;
      rebuildLayer(L, map);
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild layer when selection changes
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((Lmod) => rebuildLayer(Lmod.default, mapRef.current));
  }, [rebuildLayer]);

  const activeGroup = availableMethods.find((g) => g.methods.includes(selectedMethod ?? ''));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      {/* ── Controls bar ──────────────────────────────────────────────── */}
      {availableMethods.length > 0 && (
        <div
          className="map-controls-bar"
          style={{
            padding: '8px 12px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {availableMethods.map((g) => (
            <div key={g.label} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: g.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginRight: 2,
              }}>
                {g.label}:
              </span>
              {g.methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMethod(m)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 20,
                    border: `1.5px solid ${selectedMethod === m ? g.color : '#e2e8f0'}`,
                    background: selectedMethod === m ? g.color : '#fff',
                    color: selectedMethod === m ? '#fff' : '#475569',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.12s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          ))}

          {availableYears.length > 0 && selectedMethod !== 'Status' && (
            <select
              value={selectedYear ?? ''}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: 7,
                border: `1.5px solid ${activeGroup?.color ?? '#e2e8f0'}`,
                fontSize: 12,
                fontWeight: 600,
                color: activeGroup?.color ?? '#475569',
                outline: 'none',
                cursor: 'pointer',
                background: '#fff',
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {features.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(248,250,252,0.88)',
            flexDirection: 'column', gap: 8, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 36 }}>🗺️</div>
            <div style={{ fontSize: 13, color: '#3c4b6e', fontWeight: 500, textAlign: 'center', maxWidth: 280 }}>
              Map data unavailable — run Population Forecast to load village boundaries
            </div>
          </div>
        )}

        {/* ── Legend ─────────────────────────────────────────────────── */}
        {legendItems.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 16, right: 12,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '8px 12px', zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)', minWidth: 130,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: activeGroup?.color ?? '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              {selectedMethod} ({selectedYear ?? ''})
            </div>
            {legendItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: item.color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: '#374151' }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
