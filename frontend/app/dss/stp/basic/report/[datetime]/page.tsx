'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
const ReportMap = dynamic(() => import('./ReportMap'), { ssr: false });

// ── Colour palette (same as PDF) ─────────────────────────────────────────────
const C = {
  navy: '#0a2463',
  blue: '#1e4ebe',
  green: '#046c4e',
  teal: '#05789b',
  violet: '#6326d2',
  orange: '#ad4809',
  text: '#080e20',
  muted: '#3c4b6e',
  rule: '#c8d2e6',
  altrow: '#f6f8fe',
} as const;

const CHART_COLORS = ['#1e4ebe', '#046c4e', '#c81e64', '#6d28d9', '#b45a09', '#0682a5'];

interface ReportData {
  confirmedLocation: any;
  selectedPopMethod: string | null;
  populationForecast: Record<number, number> | null;
  population2025: number | null;
  waterDemandTotals: Record<number, number> | null;
  waterSupplyTotal: number | null;
  populationReportData: any | null;
  waterDemandReportData: any | null;
  waterSupplyReportData: any | null;
  sewageReportData: any | null;
  thematicMapData: any | null;
  generatedAt: string;
}

type ReportHostWindow = Window & {
  __basicReportLiveData?: Record<string, ReportData>;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({
  id,
  num,
  title,
  color = C.blue,
}: {
  id: string;
  num: string;
  title: string;
  color?: string;
}) {
  return (
    <div
      id={`section-${id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '48px 0 18px',
        scrollMarginTop: 52,
      }}
    >
      <div
        style={{
          width: 5,
          height: 36,
          borderRadius: 3,
          background: color,
          flexShrink: 0,
        }}
      />
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: C.text,
          borderBottom: `2px solid ${color}25`,
          paddingBottom: 6,
          flex: 1,
        }}
      >
        {num}. {title}
      </h2>
    </div>
  );
}

function SubTitle({ title, color = C.blue }: { title: string; color?: string }) {
  return (
    <h3
      style={{
        margin: '22px 0 10px',
        fontSize: 15,
        fontWeight: 700,
        color,
        borderBottom: `1px solid ${color}35`,
        paddingBottom: 5,
      }}
    >
      {title}
    </h3>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 14px',
        fontSize: 14.5,
        lineHeight: 1.75,
        color: C.text,
        fontFamily: 'Georgia, "Times New Roman", serif',
        textAlign: 'justify',
      }}
    >
      {children}
    </p>
  );
}

function Table({
  head,
  rows,
  color = C.blue,
  emphFirst = false,
}: {
  head: string[];
  rows: (string | number)[][];
  color?: string;
  emphFirst?: boolean;
}) {
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 22px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          fontFamily: 'Georgia, serif',
        }}
      >
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                style={{
                  background: color,
                  color: '#fff',
                  padding: '9px 12px',
                  textAlign: 'left',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRight: `1px solid rgba(255,255,255,0.2)`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={head.length}
                style={{ padding: 14, textAlign: 'center', color: C.muted, fontStyle: 'italic' }}
              >
                No data available
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.altrow }}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '7px 12px',
                      border: `1px solid ${C.rule}`,
                      textAlign: j > 0 ? 'right' : 'left',
                      fontWeight: j === 0 && emphFirst ? 600 : 400,
                      color: j === 0 && emphFirst ? C.navy : C.text,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function locationRows(loc: any): [string, string][] {
  if (!loc) return [['Mode', 'N/A']];
  if (loc.mode === 'admin' && loc.admin)
    return [
      ['Mode', 'Administrative'],
      ['State', loc.admin.state?.state_name ?? '-'],
      ['Districts', String(loc.admin.districts?.length ?? 0)],
      ['Sub-Districts', String(loc.admin.subDistricts?.length ?? 0)],
      ['Villages', String(loc.admin.villages?.length ?? 0)],
      ['Label', loc.label],
    ];
  if (loc.mode === 'drain' && loc.drain)
    return [
      ['Mode', 'Drain'],
      ['River', loc.drain.river?.name ?? '-'],
      ['Stretch', loc.drain.stretch?.name ?? '-'],
      ['Drains', String(loc.drain.drains?.length ?? 0)],
      ['Villages', String(loc.drain.villages?.length ?? 0)],
      ['Total Population', Number(loc.drain.totalPopulation ?? 0).toLocaleString()],
      ['Label', loc.label],
    ];
  if (loc.mode === 'india_catchment' && loc.indiaCatchment)
    return [
      ['Mode', 'India Catchment'],
      ['Latitude', Number(loc.indiaCatchment.point?.lat ?? 0).toFixed(4)],
      ['Longitude', Number(loc.indiaCatchment.point?.lng ?? 0).toFixed(4)],
      ['Villages', String(loc.indiaCatchment.villages?.length ?? 0)],
      ['Total Population', Number(loc.indiaCatchment.totalPopulation ?? 0).toLocaleString()],
      ['Label', loc.label],
    ];
  return [['Mode', loc.mode], ['Label', loc.label]];
}

function estimateTotalSewage(sg: any): number {
  if (!sg) return 0;
  if (sg.peakRows?.length) {
    const last = [...sg.peakRows].sort((a: any, b: any) => Number(a.year) - Number(b.year)).pop();
    const avg = Number(last?.avg_sewage_flow ?? last?.avg ?? 0);
    if (avg > 0) return avg;
  }
  if (sg.waterSupplyResult != null) return Number(sg.waterSupplyResult);
  return 0;
}


// ── TOC nav items ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: '1', label: '1. Executive Summary', color: C.blue },
  { id: '2', label: '2. Study Area', color: C.teal },
  { id: '3', label: '3. Methodology', color: C.violet },
  { id: '4', label: '4. Selection', color: C.blue },
  { id: '5', label: '5. Population', color: C.green },
  { id: '6', label: '6. Cohort', color: C.teal },
  { id: '7', label: '7. Water Demand', color: '#05829a' },
  { id: '8', label: '8. Water Supply', color: C.violet },
  { id: '9', label: '9. Sewage', color: C.orange },
  { id: '10', label: '10. References', color: C.muted },
  { id: '11', label: '11. Summary', color: C.blue },
  { id: '12', label: '12. Conclusion', color: C.navy },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrowserReportPage() {
  const params = useParams();
  const datetime = params?.datetime as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printSnapshot, setPrintSnapshot] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(NAV_ITEMS[0]?.id ?? '1');
  const isPrinting = useRef(false);

  useEffect(() => {
    if (!datetime) return;
    try {
      const openerWindow = window.opener as ReportHostWindow | null;
      const liveData = openerWindow?.__basicReportLiveData?.[datetime] ?? null;
      if (!liveData) {
        setError('Live report data is not available. Keep the main DSS page open and generate the report again.');
        return;
      }
      setData(liveData);
    } catch {
      setError('Failed to load live report data from the main DSS page.');
    }
  }, [datetime]);

  // ── Ctrl+P: capture map → snapshot → print ────────────────────────────────
  const handlePrint = useCallback(async () => {
    if (isPrinting.current) return;
    isPrinting.current = true;
    try {
      const capture = (window as any).__reportMapCapture as (() => Promise<string | null>) | undefined;
      const snapshot = capture ? await capture() : null;
      setPrintSnapshot(snapshot);
      // Two animation frames so React flushes the new snapshot img before print dialog opens
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      window.print();
    } finally {
      isPrinting.current = false;
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    const onAfter = () => setPrintSnapshot(null);
    document.addEventListener('keydown', onKey);
    window.addEventListener('afterprint', onAfter);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('afterprint', onAfter);
    };
  }, [handlePrint]);

  useEffect(() => {
    if (!data) return;

    const sections = NAV_ITEMS.map((item) => document.getElementById(`section-${item.id}`)).filter(
      Boolean,
    ) as HTMLElement[];

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visibleEntries.length) return;

        const nextId = visibleEntries[0].target.id.replace('section-', '');
        setActiveSection((current) => (current === nextId ? current : nextId));
      },
      {
        rootMargin: '-18% 0px -58% 0px',
        threshold: [0.2, 0.4, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [data]);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const section = document.getElementById(`section-${id}`);
    if (!section) return;
    setActiveSection(id);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
        }}
      >
        <div style={{ fontSize: 52 }}>⚠️</div>
        <div style={{ fontSize: 18, color: C.navy, fontWeight: 700 }}>{error}</div>
        <div style={{ fontSize: 13, color: C.muted }}>Report ID: {datetime}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '4px solid #e2e8f0',
            borderTopColor: C.blue,
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontSize: 15, color: C.muted, fontWeight: 500 }}>Loading report…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const loc = data.confirmedLocation;
  const totalSewage = estimateTotalSewage(data.sewageReportData);
  const now = new Date(data.generatedAt);
  const generatedStr =
    now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) +
    ' at ' +
    now.toLocaleTimeString('en-IN');

  // Population chart traces
  const popChartData = data.populationReportData?.combinedChartData;
  const popTraces = popChartData
    ? Object.entries(popChartData).map(([method, yearData]: [string, any], i) => {
        const years = Object.keys(yearData)
          .map(Number)
          .sort((a, b) => a - b);
        return {
          x: years,
          y: years.map((y) => yearData[y] ?? null),
          name: method,
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          line: { color: CHART_COLORS[i % CHART_COLORS.length], width: 2.5 },
          marker: { size: 6 },
        };
      })
    : [];

  // Map features
  const mapFeatures: any[] = data.thematicMapData?.features ?? [];
  const mapAvailableYears: number[] = data.thematicMapData?.available_years ?? [];

  // Cohort data
  const cohortEntry =
    data.populationReportData?.cohortEntries?.length > 0
      ? [...data.populationReportData.cohortEntries].sort(
          (a: any, b: any) => b.year - a.year,
        )[0]
      : null;
  const ageGroups = cohortEntry
    ? Object.keys(cohortEntry.data ?? {})
        .filter((g) => g !== 'total')
        .slice(0, 20)
    : [];

  // Water demand
  const wd = data.waterDemandReportData;
  const ffMethod = wd
    ? wd.selectedFfMethod || Object.keys(wd.results?.firefighting ?? {})[0] || ''
    : '';

  // Water supply
  const ws = data.waterSupplyReportData;

  // Sewage
  const sg = data.sewageReportData;

  // Summary years
  const forecastYears = data.populationForecast
    ? Object.keys(data.populationForecast)
        .map(Number)
        .sort((a, b) => a - b)
    : [];
  const wdYears = wd?.years ?? [];
  const wsGap = ws?.gapRows ?? [];
  const lastGap = wsGap.length ? wsGap[wsGap.length - 1] : null;

  return (
    <>
    <style>{`
      @media print {
        /* Force colour output */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

        /* Hide sticky nav and interactive map controls during print */
        nav, .map-controls-bar { display: none !important; }

        /* Header: static so it flows in the page */
        header { position: static !important; break-after: avoid; }

        /* Section breaks */
        [id^="section-"] { break-before: avoid; }
        [id="section-2"] { break-before: page; }
        [id="section-5"] { break-before: page; }
        [id="section-7"] { break-before: page; }
        [id="section-9"] { break-before: page; }

        /* Map: hide interactive Leaflet, show snapshot image */
        .report-map-interactive { display: none !important; }
        .report-map-snapshot    { display: block !important; position: static !important; width: 100% !important; height: auto !important; max-height: 480px; object-fit: contain; }

        /* Remove box shadows */
        * { box-shadow: none !important; }

        /* Plotly charts — ensure they render */
        .js-plotly-plot { break-inside: avoid; }

        /* Tables */
        table { break-inside: auto; }
        tr    { break-inside: avoid; }

        /* Hide footer */
        footer { display: none !important; }
      }

      @media screen {
        /* Snapshot only shown programmatically during print */
        .report-map-snapshot { display: none; }
      }
    `}</style>
    <div
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f4f6fb', minHeight: '100vh' }}
    >

      {/* ── Cover Header ───────────────────────────────────── */}
    <header style={{ background: '#fff', padding: '26px 20px 0', borderBottom: 'none' }}>
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '180px 1fr 180px',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Image
            src="/Images/export/logo_iitbhu.png"
            alt="IIT BHU logo"
            width={150}
            height={150}
            priority
            style={{ width: 'auto', height: '110px', objectFit: 'contain' }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>

        

        
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 800,
              color: '#5653e2',
              lineHeight: 0.5,
              textAlign: 'center',
            }}
          >
            Comprehensive Report of Sewage Generation
            <span style={{ display: 'none' }}>
          Sewage Generation & Water Resource Management — DSS Basic Module
            </span>
          </h1>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Image
            src="/Images/export/right1_slcr.png"
            alt="SLCR logo"
            width={150}
            height={150}
            priority
            style={{ width: 'auto', height: '140px', objectFit: 'contain' }}
          />
        </div>
      </div>
      <div
        style={{
          width: '100%',
          height: 10,
          background: '#000',
          marginTop: 18,
        }}
      />
    </header>



      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* ── Simple Sticky Nav ─────────────────────────────── */}
      <nav
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          borderRadius: 12,
          zIndex: 1000,
          marginBottom: 40,
          padding: '10px 0',
          boxShadow: '0 8px 24px rgba(8,14,32,0.06)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#section-${item.id}`}
              style={{
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: activeSection === item.id ? 700 : 500,
                color: activeSection === item.id ? item.color : '#374151',
                textDecoration: 'none',
                borderBottom: `2px solid ${activeSection === item.id ? item.color : 'transparent'}`,
                borderRadius: 999,
                background: activeSection === item.id ? `${item.color}12` : 'transparent',
                transition: 'all 0.2s ease',
              }}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={(e) => handleNavClick(e, item.id)}
              onMouseEnter={(e) => {
                if (activeSection !== item.id) {
                  e.currentTarget.style.borderBottom = `2px solid ${item.color}`;
                  e.currentTarget.style.color = item.color;
                  e.currentTarget.style.background = `${item.color}0f`;
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== item.id) {
                  e.currentTarget.style.borderBottom = '2px solid transparent';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
        {/* ── 1. Executive Summary ─────────────────────────────────────────── */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${C.rule}`,
            borderRadius: 12,
            padding: '22px 24px',
            marginBottom: 28,
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.blue,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Study Area Details
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {locationRows(loc).map(([label, value], i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${C.rule}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: i % 2 === 0 ? '#fff' : C.altrow,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <SectionTitle id="1" num="1" title="Executive Summary" color={C.blue} />
        <Para>
          This report presents a detailed analysis of population forecasting, water demand, water
          supply, and sewage generation for the selected study area. Based on available module
          outputs, the indicative sewage generation is approximately{' '}
          <strong>{totalSewage.toFixed(2)} MLD</strong>.
        </Para>
        <Para>
          The report identifies key infrastructure planning inputs and provides integrated
          interpretation to support treatment-capacity planning and sanitation decision making. All
          analyses follow CPHEEO-aligned assumptions and Census-based projections.
        </Para>

        {/* Key metrics grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 16,
            margin: '22px 0 8px',
          }}
        >
          {[
            { label: 'Population (2025)', value: data.population2025 != null ? data.population2025.toLocaleString() : '—', color: C.green },
            { label: 'Pop. Method', value: data.selectedPopMethod ?? '—', color: C.blue },
            { label: 'Water Supply (MLD)', value: data.waterSupplyTotal != null ? data.waterSupplyTotal.toFixed(2) : '—', color: C.teal },
            { label: 'Est. Sewage (MLD)', value: totalSewage.toFixed(2), color: C.orange },
          ].map((m, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                border: `1px solid ${m.color}25`,
                borderTop: `4px solid ${m.color}`,
                borderRadius: 10,
                padding: '16px 18px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ── 2. Study Area Overview with Interactive Map ───────────────────── */}
        <SectionTitle id="2" num="2" title="Study Area Overview" color={C.teal} />
        <Para>
          The area under study includes selected administrative or river-catchment units and supports
          integrated planning for population, water demand, water supply, and sewage management. The
          interactive map below presents all thematic layers computed across every module — use the
          method buttons above the map to switch between Population, Water Demand, Water Supply, and
          Sewage views, and the year selector to explore temporal trends. Hover over any village
          polygon to see its value for the selected method and year.
        </Para>

        <div
          style={{
            background: '#fff',
            border: `1.5px solid ${C.teal}40`,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 24,
            boxShadow: '0 2px 16px rgba(5,120,155,0.08)',
          }}
        >
          <div
            style={{
              background: `${C.teal}0d`,
              padding: '11px 18px',
              borderBottom: `1px solid ${C.teal}30`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>🗺️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>
              Figure 1: Interactive Thematic Map — All Modules
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
              {mapFeatures.length > 0
                ? `${mapFeatures.length} villages · switch method above`
                : 'Tiles only — run Population Forecast to load polygons'}
            </span>
          </div>
          <div style={{ height: 540, position: 'relative' }}>
            {/* Interactive map — hidden during print via CSS */}
            <div className="report-map-interactive" style={{ height: '100%' }}>
              <ReportMap features={mapFeatures} availableYears={mapAvailableYears} mode={loc?.mode ?? 'admin'} />
            </div>
            {/* Snapshot image — shown only during print */}
            {printSnapshot && (
              <img
                className="report-map-snapshot"
                src={printSnapshot}
                alt="Map snapshot"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#e8ecf0' }}
              />
            )}
          </div>
        </div>

        {/* ── 3. Methodology ───────────────────────────────────────────────── */}
        <SectionTitle id="3" num="3" title="Methodology" color={C.violet} />
        <Para>
          The estimation workflow follows standard planning practice and CPHEEO-aligned assumptions:
          (i) population forecasting, (ii) sectoral water-demand estimation, (iii) water-supply
          assessment, and (iv) sewage and peak-flow analysis.
        </Para>

        <SubTitle title="3.1 Population Forecasting" color={C.violet} />
        <Para>
          Population projection considers multiple methods including arithmetic, demographic, and
          cohort approaches. The selected method drives downstream water-demand and sewage
          computations.
        </Para>

        <SubTitle title="Table 1 — Recommended Per Capita Water Supply Levels (CPHEEO)" color={C.teal} />
        <Table
          head={['S.No.', 'Classification of Towns / Cities', 'Recommended Level (LPCD)']}
          rows={[
            ['1', 'Towns with piped supply but without sewerage', '70'],
            ['2', 'Cities with piped supply and sewerage', '135'],
            ['3', 'Metropolitan / mega cities with sewerage', '150'],
          ]}
          color={C.teal}
        />

        <SubTitle title="Table 2 — Domestic Demand Seasonal Multipliers" color={C.teal} />
        <Table
          head={['Season', 'Multiplier', 'Rationale']}
          rows={[
            ['Summer', '1.10', 'Higher consumption due to heat and irrigation needs'],
            ['Monsoon', '0.95', 'Reduced consumption due to cooler temperatures and outdoor rainfall'],
            ['Post-Monsoon', '1.00', 'Baseline reference season'],
            ['Winter', '0.90', 'Lower consumption in cold months; reduced bathing frequency'],
          ]}
          color={C.teal}
        />

        <SubTitle title="Table 3 — Floating Population Seasonal Multipliers" color={C.teal} />
        <Table
          head={['Season', 'Multiplier', 'Rationale']}
          rows={[
            ['Summer', '1.15', 'Peak tourism; higher temporary population'],
            ['Monsoon', '1.25', 'Religious festivals and pilgrimage seasons in many river-basin areas'],
            ['Post-Monsoon', '1.10', 'Moderate seasonal activity; harvest-related migration'],
            ['Winter', '0.85', 'Lower tourism; reduced seasonal workers'],
          ]}
          color={C.teal}
        />

        <SubTitle title="Table 4 — Institutional Demand Reference Rates" color={C.violet} />
        <Table
          head={['S.No.', 'Institution', 'Demand Basis']}
          rows={[
            ['1', 'Hospitals (>100 beds / ≤100 beds)', '450 / 340 per bed'],
            ['2', 'Hotels', '180 per bed'],
            ['3', 'Hostels / Nurses homes / Boarding schools', '135 per capita'],
            ['4', 'Restaurants', '70 per seat'],
            ['5', 'Airports & major stations', '70 per capita'],
            ['6', 'Offices / Day schools / Factories', '45 per capita'],
            ['7', 'Cinema / Concert halls / Theatre', '15 per capita'],
          ]}
          color={C.violet}
        />

        <SubTitle title="3.2 Water Demand" color={C.violet} />
        <Para>
          Water demand is estimated using domestic, floating, institutional, and firefighting
          components. Seasonal behaviour is represented through multipliers where available.
        </Para>

        <SubTitle title="3.3 Water Supply" color={C.violet} />
        <Para>
          Water supply is analysed against computed demand to derive annual surplus/deficit (gap) and
          identify likely planning stress periods.
        </Para>

        <SubTitle title="3.4 Sewage" color={C.violet} />
        <Para>
          Sewage generation is estimated using water-supply and domestic-flow pathways, with
          peak-flow methods such as CPHEEO, Harmon, and Babbitt used for design-level
          interpretation.
        </Para>

        {/* ── 4. Selection Summary ─────────────────────────────────────────── */}
        <SectionTitle id="4" num="4" title="Selection Summary" color={C.blue} />
        <Para>
          This section documents the exact study-area selection used for all calculations. It helps
          users validate that outputs are being interpreted for the intended geography.
        </Para>
        <Table head={['Field', 'Value']} rows={locationRows(loc)} color={C.blue} emphFirst />

        {/* ── 5. Population Forecast ────────────────────────────────────────── */}
        <SectionTitle id="5" num="5" title="Population Forecast" color={C.green} />
        <Para>
          Population forecasting is the foundational layer for this DSS. All downstream modules —
          water demand, water supply gap analysis, and sewage generation — are directly scaled from
          projected population values.
        </Para>
        <Para>
          Population forecasting has been carried out using multiple methods such as Arithmetic
          Growth, Geometric Growth, Exponential Models, Demographic, and the Cohort Component
          Method. The official dataset titled "Population Projections for India and States:
          2011–2036" published by the National Commission on Population (2019) was utilised and
          downscaled to village level using demographic normalisation techniques.
        </Para>

        <SubTitle title="5.1 Selected Forecasting Parameters" color={C.green} />
        <Table
          head={['Item', 'Value']}
          rows={[
            ['Selected Method', data.selectedPopMethod ?? '-'],
            ['Population (2025)', data.population2025 != null ? data.population2025.toLocaleString() : '-'],
            ['Forecast Years', data.populationForecast ? String(Object.keys(data.populationForecast).length) : '0'],
          ]}
          color={C.green}
          emphFirst
        />

        {/* Population Plotly chart */}
        {popTraces.length > 0 && (
          <div
            style={{
              background: '#fff',
              border: `1.5px solid ${C.green}30`,
              borderRadius: 12,
              padding: '16px 16px 8px',
              marginBottom: 22,
              boxShadow: '0 2px 12px rgba(4,108,78,0.06)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 4 }}>
              Figure 2: Population Forecast Comparison — All Methods
            </div>
            <Plot
              data={popTraces}
              layout={{
                height: 360,
                margin: { t: 20, b: 60, l: 80, r: 20 },
                xaxis: { title: { text: 'Year' }, gridcolor: '#f0f4f8', zeroline: false },
                yaxis: { title: { text: 'Population' }, gridcolor: '#f0f4f8', zeroline: false },
                legend: { orientation: 'h', y: -0.3, font: { size: 12 } },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { family: 'system-ui, sans-serif', size: 12 },
                hovermode: 'x unified',
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>
        )}

        {/* Population table */}
        {data.populationReportData?.mergedTableData && (() => {
          const models = Object.keys(data.populationReportData.mergedTableData);
          const years = Array.from(
            new Set(
              models.flatMap((m) =>
                Object.keys(data.populationReportData.mergedTableData[m]).map(Number),
              ),
            ),
          ).sort((a, b) => a - b);
          if (!models.length || !years.length) return null;
          return (
            <>
              <SubTitle title="5.2 Population Projections by Year & Method" color={C.green} />
              <Para>
                The table shows population projections using {models.length} forecasting method(s):{' '}
                {models.join(', ')}. Spanning {years[0]} to {years[years.length - 1]}.
              </Para>
              <Table
                head={['Year', ...models]}
                rows={years.map((yr) => [
                  String(yr),
                  ...models.map((m) =>
                    Number(
                      data.populationReportData.mergedTableData[m]?.[yr] ?? 0,
                    ).toLocaleString(),
                  ),
                ])}
                color={C.green}
              />
              <Para>
                For subsequent analysis, the{' '}
                <strong>{data.selectedPopMethod ?? 'selected'}</strong> method has been adopted as
                the primary population forecasting approach.
              </Para>
            </>
          );
        })()}

        {/* ── 6. Cohort Analysis ────────────────────────────────────────────── */}
        {cohortEntry && ageGroups.length > 0 && (
          <>
            <SectionTitle
              id="6"
              num="6"
              title={`Cohort Analysis (${cohortEntry.year})`}
              color={C.teal}
            />
            <Para>
              Cohort analysis shows age-sex composition, which improves planning quality for
              demand-sensitive infrastructure and long-term service design.
            </Para>

            <div
              style={{
                background: '#fff',
                border: `1.5px solid ${C.teal}30`,
                borderRadius: 12,
                padding: '16px 16px 8px',
                marginBottom: 22,
                boxShadow: '0 2px 12px rgba(5,120,155,0.06)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 4 }}>
                Figure 3: Cohort Distribution ({cohortEntry.year})
              </div>
              <Plot
                data={[
                  {
                    x: ageGroups,
                    y: ageGroups.map((g) => Number(cohortEntry.data[g]?.male ?? 0)),
                    name: 'Male',
                    type: 'bar',
                    marker: { color: '#1c4fbc' },
                  },
                  {
                    x: ageGroups,
                    y: ageGroups.map((g) => Number(cohortEntry.data[g]?.female ?? 0)),
                    name: 'Female',
                    type: 'bar',
                    marker: { color: '#db2777' },
                  },
                ]}
                layout={{
                  height: 320,
                  margin: { t: 10, b: 90, l: 80, r: 20 },
                  barmode: 'group',
                  xaxis: { tickangle: -35, gridcolor: '#f0f4f8' },
                  yaxis: { gridcolor: '#f0f4f8' },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'system-ui, sans-serif', size: 11 },
                  legend: { orientation: 'h', y: -0.45 },
                }}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>

            <Table
              head={['Age Group', 'Male', 'Female', 'Total']}
              rows={ageGroups.map((g) => [
                g,
                Number(cohortEntry.data[g]?.male ?? 0).toLocaleString(),
                Number(cohortEntry.data[g]?.female ?? 0).toLocaleString(),
                Number(cohortEntry.data[g]?.total ?? 0).toLocaleString(),
              ])}
              color={C.teal}
              emphFirst
            />
          </>
        )}

        {/* ── 7. Water Demand Analysis ──────────────────────────────────────── */}
        {wd && (
          <>
            <SectionTitle id="7" num="7" title="Water Demand Analysis" color="#05829a" />
            <Para>
              Water demand is estimated based on domestic, floating, institutional, and firefighting
              demands as per CPHEEO guidelines. Seasonal multipliers account for temporal variations
              in consumption.
            </Para>

            <SubTitle title="7.1 Domestic Seasonal Demand" color="#05829a" />
            <Table
              head={['Season', 'Multiplier', 'Impact on Demand']}
              rows={[
                ['Summer', '1.10', 'Approx. +10% above annual base demand'],
                ['Monsoon', '0.95', 'Approx. −5% below annual base demand'],
                ['Post-Monsoon', '1.00', 'Baseline — equal to annual average'],
                ['Winter', '0.90', 'Approx. −10% below annual base demand'],
              ]}
              color="#05829a"
            />

            <SubTitle title="7.2 Annual Demand Summary" color="#05829a" />
            <Table
              head={[
                'Year',
                'Population',
                'Domestic (MLD)',
                'Floating (MLD)',
                'Institutional (MLD)',
                'Firefighting (MLD)',
                'Total (MLD)',
              ]}
              rows={wd.years.map((year: string) => {
                const dom = wd.results?.domestic?.base_demand?.[year];
                const flo = wd.results?.floating?.base_demand?.[year];
                const inst = wd.results?.institutional?.[year];
                const ffi = ffMethod ? wd.results?.firefighting?.[ffMethod]?.[year] : null;
                const total = [dom, flo, inst, ffi]
                  .filter((v) => v != null)
                  .reduce((s: number, v: any) => s + Number(v), 0);
                return [
                  year,
                  Number(wd.forecast?.[year] ?? 0).toLocaleString(),
                  dom != null ? Number(dom).toFixed(3) : '-',
                  flo != null ? Number(flo).toFixed(3) : '-',
                  inst != null ? Number(inst).toFixed(3) : '-',
                  ffi != null ? Number(ffi).toFixed(3) : '-',
                  total > 0 ? total.toFixed(3) : '-',
                ];
              })}
              color="#05829a"
            />
          </>
        )}

        {/* ── 8. Water Supply Analysis ──────────────────────────────────────── */}
        {ws && (
          <>
            <SectionTitle id="8" num="8" title="Water Supply Analysis" color={C.violet} />
            <Para>
              Water supply analysis aligns with the demand forecasts and is based on either modelled
              or user-provided data. Integration with demographic modules ensures spatial consistency
              in water supply planning.
            </Para>

            <SubTitle title="8.1 Water Supply Details" color={C.violet} />
            <Para>
              Estimated total water supply:{' '}
              <strong>
                {(ws.result?.total_supply ?? data.waterSupplyTotal ?? 0).toFixed(2)} MLD
              </strong>
            </Para>
            <Table
              head={['Source / Input', 'Value']}
              rows={[
                ['Surface Water (MLD)', ws.inputs?.surfaceWater || '0'],
                ['Groundwater Direct (MLD)', ws.inputs?.directGW || '0'],
                ['No. of Tube Wells', ws.inputs?.numTubewells || '0'],
                ['Discharge Rate (lt/hr)', ws.inputs?.dischargeRate || '0'],
                ['Operating Hours', ws.inputs?.operatingHours || '0'],
                ['Alternate Direct (MLD)', ws.inputs?.directAlt || '0'],
                [
                  'Computed Groundwater (MLD)',
                  ws.computed?.gwComputed != null ? ws.computed.gwComputed.toFixed(3) : '-',
                ],
                [
                  'Computed Alternate (MLD)',
                  ws.computed?.altComputed != null ? ws.computed.altComputed.toFixed(3) : '-',
                ],
                ['Total Supply (MLD)', ws.result ? ws.result.total_supply.toFixed(3) : '-'],
              ]}
              color={C.violet}
              emphFirst
            />

            {ws.gapRows?.length > 0 && (
              <>
                <SubTitle title="8.2 Supply vs. Demand Gap Analysis" color={C.violet} />
                <Para>
                  Gap analysis compares total supply with annual water demand. A positive gap
                  indicates surplus capacity; a negative gap indicates a deficit.
                </Para>
                <Table
                  head={['Year', 'Supply (MLD)', 'Demand (MLD)', 'Gap (MLD)']}
                  rows={ws.gapRows.map((r: any) => [
                    String(r.year),
                    r.supply.toFixed(3),
                    r.demand.toFixed(3),
                    `${r.gap >= 0 ? '+' : ''}${r.gap.toFixed(3)}`,
                  ])}
                  color={C.violet}
                />
              </>
            )}
          </>
        )}

        {/* ── 9. Sewage Generation Analysis ─────────────────────────────────── */}
        {sg && (
          <>
            <SectionTitle id="9" num="9" title="Sewage Generation Analysis" color={C.orange} />
            <Para>
              Sewage generation estimation is carried out using sector-based and water supply-based
              approaches. Peak sewage flow is computed using CPHEEO, Harmon, and Babbitt methods,
              ensuring realistic design flows for downstream treatment infrastructure.
            </Para>

            <SubTitle title="9.1 Analysis Mode & Input Parameters" color={C.orange} />
            <Table
              head={['Item', 'Value']}
              rows={[
                [
                  'Analysis Mode',
                  sg.domesticMode === 'modeled' ? 'Population-based Modelling' : 'Manual Input',
                ],
                ['Water Supply Input (MLD)', sg.waterSupplyInput || '-'],
                [
                  'Raw Sewage Coefficient (LPCD)',
                  sg.rawCoeff != null ? sg.rawCoeff.toFixed(2) : '-',
                ],
                ['Treatment Method', sg.treatmentMethod || '-'],
                ['Treatment Capacity', sg.treatmentCapacity || '-'],
              ]}
              color={C.orange}
              emphFirst
            />

            {sg.waterSupplyResult != null && (
              <>
                <SubTitle title="9.2 Water Supply Method" color={C.orange} />
                <Para>
                  Sewage generation (80% of supply):{' '}
                  <strong>{sg.waterSupplyResult.toFixed(3)} MLD</strong>
                </Para>
              </>
            )}

            {loc?.mode === 'drain' && loc.drain?.drains?.length > 0 && (
              <>
                <SubTitle title="9.3 Drain Information" color={C.orange} />
                <Para>
                  Number of Drains Tapped: {loc.drain.drains.length}. River:{' '}
                  {loc.drain.river?.name ?? '-'}. Stretch: {loc.drain.stretch?.name ?? '-'}.
                </Para>
                <Table
                  head={['Drain ID', 'Drain Name']}
                  rows={loc.drain.drains.map((d: any) => [String(d.id), String(d.name)])}
                  color={C.orange}
                />
              </>
            )}

            {sg.stormResult?.storm_water_runoff != null && (
              <>
                <SubTitle title="9.4 Storm Water Runoff Analysis" color={C.orange} />
                <Table
                  head={['Parameter', 'Value']}
                  rows={[
                    ['Selected Land Use Type', sg.stormInputs?.landUseType || '-'],
                    ['Duration Time (min)', sg.stormInputs?.duration || '-'],
                    ['Rainfall Intensity (mm/hr)', sg.stormInputs?.rainfall || '-'],
                    [
                      'Storm Water Runoff Result',
                      `${sg.stormResult.storm_water_runoff} ${sg.stormResult.unit ?? 'MLD'}`,
                    ],
                  ]}
                  color={C.orange}
                  emphFirst
                />
              </>
            )}

            {sg.peakRows?.length > 0 && (() => {
              const show = new Set<string>(sg.peakSelectedMethods ?? []);
              const head: string[] = ['Year', 'Population', 'Avg Flow (MLD)'];
              if (show.has('cpheeo')) head.push('CPHEEO (MLD)');
              if (show.has('harmon')) head.push('Harmon (MLD)');
              if (show.has('babbitt')) head.push('Babbitt (MLD)');
              return (
                <>
                  <SubTitle title="9.5 Peak Flow Calculation Results" color={C.orange} />
                  <Para>
                    Peak Flow Source: {sg.domesticMode?.toUpperCase() ?? 'MODELLED'}. Selected
                    Methods: {Array.from(show).join(', ').toUpperCase() || '-'}.
                  </Para>
                  <Table
                    head={head}
                    rows={sg.peakRows.map((r: any) => {
                      const row: (string | number)[] = [
                        String(r.year),
                        Number(r.population ?? 0).toLocaleString(),
                        Number(r.avg_sewage_flow ?? r.avg ?? 0).toFixed(3),
                      ];
                      if (show.has('cpheeo'))
                        row.push(r.cpheeo != null ? Number(r.cpheeo).toFixed(3) : '-');
                      if (show.has('harmon'))
                        row.push(r.harmon != null ? Number(r.harmon).toFixed(3) : '-');
                      if (show.has('babbitt'))
                        row.push(r.babbitt != null ? Number(r.babbitt).toFixed(3) : '-');
                      return row;
                    })}
                    color={C.orange}
                  />
                </>
              );
            })()}

            {sg.rawCoeff != null && (
              <>
                <SubTitle title="9.6 Raw Sewage Characteristics" color={C.orange} />
                <Table
                  head={['Parameter', 'Value']}
                  rows={[
                    ['Base Coefficient', `${sg.rawCoeff.toFixed(2)} LPCD`],
                    ['Water Supply Input (MLD)', sg.waterSupplyInput || '-'],
                  ]}
                  color={C.orange}
                  emphFirst
                />
              </>
            )}
          </>
        )}

        {/* ── 10. References ────────────────────────────────────────────────── */}
        <SectionTitle id="10" num="10" title="References" color={C.muted} />
        {[
          '1. CPHEEO Manual on Water Supply and Treatment.',
          '2. CPHEEO Manual on Sewerage and Sewage Treatment Systems.',
          '3. Census of India 2011.',
          '4. National Commission on Population (2019), Population Projections for India and States 2011–2036.',
          '5. CPCB Guidance and DSS module outputs / API computations from SCA Platform.',
        ].map((ref, i) => (
          <Para key={i}>{ref}</Para>
        ))}

        {/* ── 11. Summary Table ─────────────────────────────────────────────── */}
        <SectionTitle id="11" num="11" title="Summary Table" color={C.blue} />
        <Para>
          Consolidated key outcomes from all modules — a quick planning snapshot for technical and
          administrative review.
        </Para>
        <Table
          head={['S.No.', 'Parameter', 'Details']}
          rows={[
            [
              '1',
              'Forecast Horizon',
              forecastYears.length
                ? `${forecastYears[0]} – ${forecastYears[forecastYears.length - 1]}`
                : '-',
            ],
            ['2', 'Selected Population Method', data.selectedPopMethod ?? '-'],
            [
              '3',
              'Water Demand Years Analysed',
              wdYears.length ? `${wdYears[0]} – ${wdYears[wdYears.length - 1]}` : '-',
            ],
            [
              '4',
              'Total Supply (MLD)',
              data.waterSupplyTotal != null ? data.waterSupplyTotal.toFixed(3) : '-',
            ],
            [
              '5',
              'Latest Water Gap Status',
              lastGap
                ? `${lastGap.gap >= 0 ? 'Surplus' : 'Deficit'} (${lastGap.gap >= 0 ? '+' : ''}${lastGap.gap.toFixed(3)} MLD)`
                : '-',
            ],
            ['6', 'Estimated Sewage Volume (MLD)', totalSewage.toFixed(3)],
            [
              '7',
              'Peak Flow Methods Selected',
              String(data.sewageReportData?.peakSelectedMethods?.length ?? 0),
            ],
          ]}
          color={C.blue}
        />

        {/* ── 12. Conclusion ────────────────────────────────────────────────── */}
        <SectionTitle id="12" num="12" title="Conclusion" color={C.navy} />
        <Para>
          This DSS workflow links demographic growth, sectoral water demand, source-side supply, and
          sewage generation into one integrated planning chain. The outputs should be read as
          decision-support estimates to prioritise interventions, identify likely deficits, and phase
          infrastructure upgrades.
        </Para>
        <Para>
          Recommended use: validate location selection first, review forecast assumptions, confirm
          demand components, evaluate supply-gap trends, and then apply peak-flow and treatment
          checks for design-stage planning.
        </Para>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
<footer
  style={{
    background: '#fff',
    borderTop: '1px solid #e5e7eb',
    padding: '20px',
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
  }}
>
  <div style={{ maxWidth: 900, margin: '0 auto' }}>
    
    <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>
      DSS Platform — IIT BHU / SLCR
    </div>

    <div>
      Confidential — For planning and decision-support use only
    </div>

    <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
      Generated: {generatedStr}
    </div>

  </div>
</footer>
    </div>
    </>
  );
}
