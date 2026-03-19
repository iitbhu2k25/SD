'use client';

import { useState, useEffect, useRef } from 'react';
import { useBasicStore } from '../shared/store/basic.store';
import { API_BASE_URL } from '../shared/utils/constants';
import ModuleNav from '../shared/components/ModuleNav';
import {
  Droplets, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Construction, Waves,
  Gauge, CloudRain,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg style={{ animation: 'spin 0.8s linear infinite', width: 14, height: 14 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
};

const inp: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px',
  fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box',
};

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px' }}>
      <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: '#b91c1c' }}>{msg}</span>
    </div>
  );
}

function CalcButton({ onClick, loading, label, disabled }: {
  onClick: () => void; loading: boolean; label: string; disabled?: boolean;
}) {
  const off = loading || !!disabled;
  return (
    <button type="button" onClick={onClick} disabled={off}
      style={{
        alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 22px', borderRadius: 10, border: 'none',
        background: off ? '#e2e8f0' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
        color: off ? '#94a3b8' : '#fff', fontSize: 13, fontWeight: 700,
        cursor: off ? 'not-allowed' : 'pointer',
        boxShadow: off ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
      }}>
      {loading ? <><Spinner /> Calculating…</> : label}
    </button>
  );
}

// ── Manual / Modeled info tooltip (fixed position — escapes overflow:hidden) ──
function SdInfoTooltip() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Continuously sync tooltip position to icon using rAF while open
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const sync = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setPos({ top: r.top, left: r.left + r.width / 2 });
      }
      rafRef.current = requestAnimationFrame(sync);
    };
    rafRef.current = requestAnimationFrame(sync);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [open]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        tipRef.current && !tipRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = () => setOpen(v => !v);

  return (
    <div
      ref={ref}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
      onClick={toggle}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: open ? '#0369a1' : '#e0f2fe',
        border: '1.5px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 11, fontWeight: 800,
        color: open ? '#fff' : '#0369a1',
        transition: 'all 0.15s',
      }}>i</div>

      {pos && (
        <div ref={tipRef} style={{
          position: 'fixed',
          top: pos.top - 8,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
          zIndex: 99999,
          width: 360,
          maxHeight: 360,
          overflowY: 'auto',
          background: '#1e293b', color: '#f1f5f9',
          borderRadius: 10, padding: '12px 14px',
          fontSize: 12, lineHeight: 1.65,
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        }}>
          {/* Modes */}
          <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>Manual Mode</div>
          <div style={{ marginBottom: 10, color: '#cbd5e1' }}>
            Enter population values for each target year yourself. Use this when you have your own survey, census, or project-specific data and want full control over the input population.
          </div>
          <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>Modeled Mode</div>
          <div style={{ marginBottom: 12, color: '#cbd5e1' }}>
            Uses the population forecast already computed in the Population module. The system fills in all forecast years automatically — no extra input needed.
          </div>

          {/* Demand types */}
          <div style={{ borderTop: '1px solid #334155', paddingTop: 10, marginBottom: 6, fontWeight: 700, color: '#f8fafc', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sewage Demand Types
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#c084fc' }}>Population Based — </span>
            <span style={{ color: '#cbd5e1' }}>Estimates sewage generated purely from the residential population. No extra inputs needed beyond population and the design water supply rate. Best for areas with consistent domestic water use.</span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>Water Based — </span>
            <span style={{ color: '#cbd5e1' }}>Derives sewage from the actual water supply quantity already calculated in the Water Supply module. Proportional to how much water the population is served — useful when supply data is reliable.</span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: '#fb923c' }}>Drain Based — </span>
            <span style={{ color: '#cbd5e1' }}>Uses drain recharge values for each drain in the project area. In the drain table below, enter each drain's <b style={{ color: '#fde68a' }}>Drain No</b> (its identifier), <b style={{ color: '#fde68a' }}>Drain ID</b> (sequential number), and <b style={{ color: '#fde68a' }}>Drain Recharge</b> (MLD). When location is set to Drain Mode, drain numbers are auto-filled from your selection. The total recharge across all drains is then scaled by population ratio to give the drain-based demand.</span>
          </div>

          <div style={{ borderTop: '1px solid #334155', paddingTop: 8, color: '#94a3b8', fontSize: 11 }}>
            All three values appear together in the result table — you can compare them side by side for planning decisions.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Toggle (Manual | Modeled) ─────────────────────────────────────────────────
function ToggleSwitch({ value, onChange }: {
  value: 'manual' | 'modeled';
  onChange: (v: 'manual' | 'modeled') => void;
}) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', fontSize: 13 }}>
      {(['manual', 'modeled'] as const).map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          style={{
            padding: '7px 20px', border: 'none', cursor: 'pointer', fontWeight: 700,
            background: value === opt ? '#2563eb' : '#fff',
            color: value === opt ? '#fff' : '#64748b',
            borderRight: opt === 'manual' ? '1px solid #e2e8f0' : 'none',
            transition: 'all 0.15s',
          }}>
          {opt === 'manual' ? 'Manual' : 'Modeled'}
        </button>
      ))}
    </div>
  );
}

// ── Seasonal table ────────────────────────────────────────────────────────────
const SEASONS = [
  { key: 'summer',      label: 'Summer',       color: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
  { key: 'monsoon',     label: 'Monsoon',       color: '#0369a1', bg: '#f0f9ff', bd: '#bae6fd' },
  { key: 'postMonsoon', label: 'Post-Monsoon',  color: '#15803d', bg: '#f0fdf4', bd: '#bbf7d0' },
  { key: 'winter',      label: 'Winter',        color: '#6d28d9', bg: '#f5f3ff', bd: '#ddd6fe' },
];
type SeasonalData = { [season: string]: { [year: string]: number } };

function SeasonalTable({ title, data, years, accentColor, accentBg, accentBd }: {
  title: string; data: SeasonalData; years: string[];
  accentColor: string; accentBg: string; accentBd: string;
}) {
  return (
    <div style={{ border: `1px solid ${accentBd}`, borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
      <div style={{ padding: '9px 14px', background: accentBg, borderBottom: `1px solid ${accentBd}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 3, height: 16, background: accentColor, borderRadius: 2 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>(MLD)</span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ background: accentBg }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', borderBottom: `2px solid ${accentBd}`, fontWeight: 700, color: '#475569' }}>Year</th>
              {SEASONS.map(s => (
                <th key={s.key} style={{ padding: '8px 14px', textAlign: 'right', borderBottom: `2px solid ${accentBd}`, fontWeight: 700, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((yr, i) => (
              <tr key={yr} style={{ background: i % 2 ? accentBg : '#fff' }}>
                <td style={{ padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#374151' }}>{yr}</td>
                {SEASONS.map(s => (
                  <td key={s.key} style={{ padding: '7px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#374151' }}>
                    {data[s.key]?.[yr] != null ? Number(data[s.key][yr]).toFixed(3) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const DOM_MULT: Record<string, number> = { summer: 1.10, monsoon: 0.95, postMonsoon: 1.00, winter: 0.90 };
const FLT_MULT: Record<string, number> = { summer: 1.15, monsoon: 1.25, postMonsoon: 1.10, winter: 0.85 };
const FACILITY_LPCD: Record<string, number> = { provided: 45, notprovided: 25, onlypublic: 15 };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PeakRow {
  year: string;
  population: number;
  avg?: number;
  avg_sewage_flow?: number;
  cpheeo?: number;
  harmon?: number;
  babbitt?: number;
}
interface RawItem { name: string; per_capita: number; concentration: number; design_characteristic: number }

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function SewageModule() {
  const {
    setActiveModule,
    confirmedLocation,
    populationForecast,
    population2025,
    waterSupplyTotal,
    setSewageReportData,
  } = useBasicStore();
  const reportHashRef = useRef('');

  // ── Section 1: Water Supply ───────────────────────────────────────────────
  const [wsInput,   setWsInput]   = useState('');
  const [wsResult,  setWsResult]  = useState<number | null>(null);
  const [wsLoad,    setWsLoad]    = useState(false);
  const [wsErr,     setWsErr]     = useState<string | null>(null);

  useEffect(() => {
    if (waterSupplyTotal !== null && wsInput === '')
      setWsInput(waterSupplyTotal.toFixed(3));
  }, [waterSupplyTotal]);

  // Auto-fill drain table from confirmed drain location
  useEffect(() => {
    if (confirmedLocation?.mode === 'drain' && confirmedLocation.drain?.drains?.length) {
      setSdDrains(
        confirmedLocation.drain.drains.map((d, i) => ({
          drain_no: d.name,
          drain_id: String(i + 1),
          drain_recharge: '',
        }))
      );
    }
  }, [confirmedLocation]);

  // ── UFW (shared) ─────────────────────────────────────────────────────────
  const [ufw, setUfw] = useState('15');

  // ── Section 3: Floating seasonal ─────────────────────────────────────────
  const [openFloat,     setOpenFloat]     = useState(true);
  const [floatPct,      setFloatPct]      = useState('15');
  const [facilityType,  setFacilityType]  = useState('provided');
  const [floatSeasonal, setFloatSeasonal] = useState<SeasonalData | null>(null);
  const [floatYears,    setFloatYears]    = useState<string[]>([]);

  // ── Section 4: Peak flow ──────────────────────────────────────────────────
  const [openPeak,    setOpenPeak]    = useState(true);
  const [peakChk,     setPeakChk]     = useState({ cpheeo: false, harmon: false, babbitt: false });
  const [peakAvgBase, setPeakAvgBase] = useState<'population_based' | 'water_based' | 'drain_based'>('population_based');
  const [peakRows,    setPeakRows]    = useState<PeakRow[] | null>(null);
  const [peakLoad,    setPeakLoad]    = useState(false);
  const [peakErr,     setPeakErr]     = useState<string | null>(null);

  // ── Section 5: Treatment capacity ────────────────────────────────────────
  const [openTreat,       setOpenTreat]       = useState(true);
  const [treatCapacity,   setTreatCapacity]   = useState('');
  const [treatMethod,     setTreatMethod]     = useState<'cpheeo'|'harmon'|'babbitt'|''>('');
  const [treatRows,       setTreatRows]       = useState<any[] | null>(null);
  const [treatErr,        setTreatErr]        = useState<string | null>(null);

  // ── Section 6: Storm water ────────────────────────────────────────────────
  const [openStorm,       setOpenStorm]       = useState(true);
  const [stormData,       setStormData]       = useState<any>(null);
  const [stormLoading,    setStormLoading]    = useState(false);
  const [stormErr,        setStormErr]        = useState<string | null>(null);
  const [landUseType,     setLandUseType]     = useState('');
  const [duration,        setDuration]        = useState('');
  const [rainfall,        setRainfall]        = useState('');
  const [stormResult,     setStormResult]     = useState<any>(null);
  const [stormCalcLoad,   setStormCalcLoad]   = useState(false);
  const [stormCalcErr,    setStormCalcErr]    = useState<string | null>(null);

  // ── Section 0: Combined Sewage Demand ────────────────────────────────────
  type DrainRow = { drain_no: string; drain_id: string; drain_recharge: string };
  type PopRow   = { year: string; population: string };
  type SdResultRow = { year: string; population: number; population_based: number; water_based: number; drain_based: number };
  const [sdMode,        setSdMode]        = useState<'manual' | 'modeled'>('manual');
  const [sdPopRows,     setSdPopRows]     = useState<PopRow[]>([{ year: '2025', population: '' }]);
  const [sdDrains,      setSdDrains]      = useState<DrainRow[]>([{ drain_no: '', drain_id: '', drain_recharge: '' }]);
  const [sdResult,      setSdResult]      = useState<SdResultRow[] | null>(null);
  const [sdDomSeasonal, setSdDomSeasonal] = useState<SeasonalData | null>(null);
  const [sdDomYears,    setSdDomYears]    = useState<string[]>([]);
  const [sdLoad,        setSdLoad]        = useState(false);
  const [sdErr,         setSdErr]         = useState<string | null>(null);

  // ── Section 7: Raw sewage ─────────────────────────────────────────────────
  const [openRaw,   setOpenRaw]   = useState(true);
  const [rawItems,  setRawItems]  = useState<RawItem[] | null>(null);
  const [rawCoeff,  setRawCoeff]  = useState<number | null>(null);
  const [rawLoad,   setRawLoad]   = useState(false);
  const [rawErr,    setRawErr]    = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  // Population forecast as {year_str: number}
  const forecastStrKeys = (): Record<string, number> => {
    if (!populationForecast) return {};
    const out: Record<string, number> = {};
    for (const [yr, pop] of Object.entries(populationForecast)) out[String(yr)] = pop;
    return out;
  };

  const sortedForecastYears = () =>
    Object.keys(forecastStrKeys()).sort((a, b) => Number(a) - Number(b));

  // Build seasonal data from per-year base values
  const makeSeasonal = (yearlyMLD: Record<string, number>, mult: Record<string, number>): SeasonalData => {
    const out: SeasonalData = {};
    for (const s of Object.keys(mult)) {
      out[s] = {};
      for (const [yr, v] of Object.entries(yearlyMLD)) out[s][yr] = v * mult[s];
    }
    return out;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Water Supply Based
  // ─────────────────────────────────────────────────────────────────────────
  const handleWsCalc = async () => {
    const v = parseFloat(wsInput);
    if (!wsInput || isNaN(v) || v <= 0) { setWsErr('Enter a valid total water supply (MLD).'); return; }
    setWsLoad(true); setWsErr(null); setWsResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/basic/sewage_calculation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'water_supply', total_supply: v }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      setWsResult(Number(data.sewage_demand));
    } catch (e: any) { setWsErr(e.message); }
    finally { setWsLoad(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Floating Seasonal
  // ─────────────────────────────────────────────────────────────────────────
  const handleFloatCalc = () => {
    const fc = forecastStrKeys();
    const years = sortedForecastYears();
    if (years.length === 0) return;

    const pct  = parseFloat(floatPct) || 0;
    const lpcd = FACILITY_LPCD[facilityType] ?? 45;

    const base: Record<string, number> = {};
    for (const yr of years) {
      const pop = fc[yr] ?? 0;
      base[yr] = (pop * pct / 100) * (lpcd / 1_000_000) * 0.84;
    }
    setFloatSeasonal(makeSeasonal(base, FLT_MULT));
    setFloatYears(years);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Peak Flow
  // ─────────────────────────────────────────────────────────────────────────
  const handlePeakCalc = async () => {
    const methods = Object.entries(peakChk).filter(([, v]) => v).map(([k]) => k);
    if (methods.length === 0) { setPeakErr('Select at least one peak flow method.'); return; }

    if (!sdResult || sdResult.length === 0) { setPeakErr('Calculate Sewage Demand first.'); return; }

    // In manual mode use only the sdResult rows; in modeled mode use full forecast
    const pop: Record<string, number> = {};
    if (sdMode === 'manual') {
      for (const row of sdResult) pop[row.year] = row.population;
    } else {
      const fc = forecastStrKeys();
      if (Object.keys(fc).length === 0) { setPeakErr('No population forecast available.'); return; }
      for (const [yr, v] of Object.entries(fc)) pop[yr] = v;
    }

    const sd: Record<string, number> = {};
    for (const row of sdResult) sd[row.year] = (row[peakAvgBase] as number) ?? 0;

    const payload: Record<string, unknown> = { population_data: pop, methods, sewage_data: sd };

    setPeakLoad(true); setPeakErr(null);
    try {
      const res = await fetch(`${API_BASE_URL}/basic/peak_sewage_flow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      setPeakRows(data.results);
    } catch (e: any) { setPeakErr(e.message); }
    finally { setPeakLoad(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Raw Sewage Characteristics
  // ─────────────────────────────────────────────────────────────────────────
  const handleRawCalc = async (customItems?: RawItem[]) => {
    // 2011 population from forecast
    const fc = forecastStrKeys();
    const pop2011 = Number(fc['2011'] ?? 0);
    if (pop2011 <= 0) { setRawErr('Population forecast must include year 2011 for raw sewage characteristics.'); return; }

    setRawLoad(true); setRawErr(null);
    try {
      const payload: Record<string, unknown> = {
        population_2011: pop2011,
        unmetered_supply: parseFloat(ufw) || 0,
      };
      if (customItems) payload.custom_items = customItems;

      const res = await fetch(`${API_BASE_URL}/basic/raw_sewage_characteristics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      setRawItems(data.items);
      setRawCoeff(data.total_coefficient);
    } catch (e: any) { setRawErr(e.message); }
    finally { setRawLoad(false); }
  };

  const updateRaw = (i: number, field: 'per_capita' | 'design_characteristic', val: number) => {
    if (!rawItems) return;
    setRawItems(rawItems.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Sewage Treatment Capacity
  // ─────────────────────────────────────────────────────────────────────────
  const getCPHEEOFactor = (pop: number) => pop < 20000 ? 3.0 : pop <= 50000 ? 2.5 : pop <= 75000 ? 2.25 : 2.0;
  const getHarmonFactor = (pop: number) => 1 + 14 / (4 + Math.sqrt(pop / 1000));
  const getBabbittFactor = (pop: number) => 5 / Math.pow(pop / 1000, 0.2);

  const handleTreatCalc = () => {
    setTreatErr(null);
    const cap = parseFloat(treatCapacity);
    if (!treatCapacity || isNaN(cap) || cap <= 0) { setTreatErr('Enter a valid treatment capacity (MLD).'); return; }
    if (!treatMethod) { setTreatErr('Select a peak flow method.'); return; }

    if (!sdResult || sdResult.length === 0) { setTreatErr('Calculate Sewage Demand first.'); return; }

    // In manual mode use only sdResult rows; in modeled mode use full forecast years
    let years: string[];
    const popByYear: Record<string, number> = {};
    if (sdMode === 'manual') {
      years = sdResult.map(r => r.year);
      for (const r of sdResult) popByYear[r.year] = r.population;
    } else {
      years = sortedForecastYears();
      if (years.length === 0) { setTreatErr('No population forecast available.'); return; }
      const fc = forecastStrKeys();
      for (const yr of years) popByYear[yr] = fc[yr] ?? 0;
    }

    const rows = years.map(yr => {
      const pop = popByYear[yr] ?? 0;
      const sdRow = sdResult.find(r => r.year === yr);
      const avg = sdRow?.population_based ?? (wsResult ?? 0);
      let peakSew = avg;
      if (treatMethod === 'cpheeo') peakSew = avg * getCPHEEOFactor(pop);
      else if (treatMethod === 'harmon') peakSew = avg * getHarmonFactor(pop);
      else if (treatMethod === 'babbitt') peakSew = avg * getBabbittFactor(pop);
      const gap = cap - peakSew;
      return { year: yr, population: pop, treatmentCapacity: cap, sewageGeneration: peakSew, gap, sufficient: gap >= 0 };
    });
    setTreatRows(rows);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Storm Water — Step 1: Initialize (fetch shape data)
  // ─────────────────────────────────────────────────────────────────────────
  const handleStormInit = async () => {
    const villages = confirmedLocation?.admin?.villages ?? [];
    const codes = villages.map((v: any) => v.village_code ?? v.id).filter(Boolean);
    if (codes.length === 0) { setStormErr('No village codes available. Confirm location first.'); return; }

    setStormLoading(true); setStormErr(null); setStormData(null);
    setLandUseType(''); setDuration(''); setStormResult(null); setStormCalcErr(null);
    try {
      const res = await fetch(`${API_BASE_URL}/basic/swrunoff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ village_codes: codes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      setStormData(data);
      if (data.shape_attributes?.length) setLandUseType(data.shape_attributes[0]);
      if (data.all_duration_values?.length) setDuration(String(data.all_duration_values[0]));
    } catch (e: any) { setStormErr(e.message); }
    finally { setStormLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Storm Water — Step 2: Compute runoff
  // ─────────────────────────────────────────────────────────────────────────
  const handleStormCalc = async () => {
    if (!stormData || !landUseType || !duration || !rainfall) { setStormCalcErr('Fill all fields: land use type, duration, and rainfall intensity.'); return; }
    const ri = parseFloat(rainfall);
    if (isNaN(ri) || ri <= 0) { setStormCalcErr('Enter a valid rainfall intensity (mm/hr).'); return; }

    setStormCalcLoad(true); setStormCalcErr(null); setStormResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/basic/stormwaterrunoff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: stormData.total_area_hectares,
          selected_time: parseInt(duration),
          shape: stormData.overall_shape_type,
          selected_land_use_type: landUseType,
          rainfall_intensity: ri,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      setStormResult(data);
    } catch (e: any) { setStormCalcErr(e.message); }
    finally { setStormCalcLoad(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CALCULATE: Combined Sewage Demand
  // ─────────────────────────────────────────────────────────────────────────
  const handleSdCalc = async () => {
    setSdLoad(true); setSdErr(null); setSdResult(null);
    try {
      const ws = waterSupplyTotal ?? 0;

      const drainsParsed = sdDrains
        .filter(d => d.drain_no || d.drain_id || d.drain_recharge)
        .map(d => ({
          drain_no: d.drain_no || '—',
          drain_id: d.drain_id || '—',
          drain_recharge: parseFloat(d.drain_recharge) || 0,
        }));

      let payload: Record<string, unknown>;

      if (sdMode === 'manual') {
        const popData: Record<string, number> = {};
        for (const row of sdPopRows) {
          const yr = row.year.trim();
          const pv = parseFloat(row.population);
          if (!yr || isNaN(pv) || pv <= 0) throw new Error(`Enter valid year and population for all rows (row year "${yr}" is invalid).`);
          popData[yr] = pv;
        }
        if (Object.keys(popData).length === 0) throw new Error('Add at least one population year entry.');
        // derive pop_2025 reference: from store, or from the 2025 row if provided, else first entry
        const pop2025Ref = population2025 ?? popData['2025'] ?? Object.values(popData)[0];
        payload = {
          load_method: 'manual',
          population_data: popData,
          water_supply: ws,
          drains: drainsParsed,
          population_2025: pop2025Ref,
          unmetered_supply: parseFloat(ufw) || 15,
        };
      } else {
        const fp = forecastStrKeys();
        if (Object.keys(fp).length === 0) throw new Error('No population forecast in store. Complete Population module first.');
        payload = {
          load_method: 'modeled',
          computed_population: fp,
          water_supply: ws,
          drains: drainsParsed,
          population_2025: population2025 ?? 0,
          unmetered_supply: parseFloat(ufw) || 15,
        };
      }

      const res = await fetch(`${API_BASE_URL}/basic/sewage_demand`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail ?? `API ${res.status}`); }
      const data = await res.json();
      const rows: SdResultRow[] = data.results;
      setSdResult(rows);
      // Compute domestic seasonal from population_based values
      if (rows.length > 0) {
        const yearlyBase: Record<string, number> = {};
        for (const r of rows) yearlyBase[r.year] = r.population_based;
        setSdDomSeasonal(makeSeasonal(yearlyBase, DOM_MULT));
        setSdDomYears(rows.map(r => r.year));
      }
    } catch (e: any) { setSdErr(e.message); setSdDomSeasonal(null); setSdDomYears([]); }
    finally { setSdLoad(false); }
  };

  const anyResult = wsResult !== null || sdResult !== null;
  const fc = forecastStrKeys();

  useEffect(() => {
    const hasData =
      wsResult !== null ||
      sdResult !== null ||
      !!floatSeasonal ||
      !!peakRows ||
      !!treatRows ||
      !!stormResult ||
      !!rawItems;

    if (!hasData) {
      if (reportHashRef.current !== '') {
        reportHashRef.current = '';
        setSewageReportData(null);
      }
      return;
    }

    const payload = {
      waterSupplyInput: wsInput,
      waterSupplyResult: wsResult,
      sewageDemandResult: sdResult,
      floatingSeasonal: floatSeasonal,
      floatingYears: floatYears,
      peakRows: peakRows as any[] | null,
      peakSelectedMethods: Object.entries(peakChk).filter(([, enabled]) => enabled).map(([k]) => k),
      treatmentMethod: treatMethod,
      treatmentCapacity: treatCapacity,
      treatmentRows: treatRows as any[] | null,
      stormData,
      stormInputs: { landUseType, duration, rainfall },
      stormResult,
      rawItems: rawItems as any[] | null,
      rawCoeff,
    };
    const nextHash = JSON.stringify(payload);
    if (nextHash !== reportHashRef.current) {
      reportHashRef.current = nextHash;
      setSewageReportData(payload);
    }
  }, [
    wsInput,
    wsResult,
    sdResult,
    floatSeasonal,
    floatYears,
    peakRows,
    peakChk,
    treatMethod,
    treatCapacity,
    treatRows,
    stormData,
    landUseType,
    duration,
    rainfall,
    stormResult,
    rawItems,
    rawCoeff,
    setSewageReportData,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto', maxHeight: '100%', boxSizing: 'border-box' }}>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — WATER SUPPLY BASED SEWAGE
      ══════════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <div style={{ padding: '13px 18px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', borderBottom: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 24, background: '#0369a1', borderRadius: 2 }} />
          <Droplets size={15} color="#0369a1" />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0c4a6e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Water Supply Based Sewage
          </span>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Total Water Supply (MLD)
                <span style={{ fontWeight: 400, color: '#cbd5e1', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>Sewage = Supply × 0.84</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1, minWidth: 0 }} type="number" min="0" step="0.001" placeholder="e.g. 12.5" value={wsInput}
                  onChange={e => { setWsInput(e.target.value); setWsResult(null); setWsErr(null); }} />
                {waterSupplyTotal !== null && (
                  <button type="button" onClick={() => setWsInput(waterSupplyTotal.toFixed(3))}
                    style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '0 9px', borderRadius: 7, border: '1px solid #0369a1', background: '#0369a1', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                    Use {waterSupplyTotal.toFixed(2)}
                  </button>
                )}
              </div>
            </div>
            <CalcButton onClick={handleWsCalc} loading={wsLoad} label="Calculate" />
          </div>
          {wsErr && <ErrorBox msg={wsErr} />}
          {wsResult !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 10 }}>
              <CheckCircle2 size={20} color="#16a34a" />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sewage Demand</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>
                  {wsResult.toFixed(3)} <span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>MLD</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 0 — COMBINED SEWAGE DEMAND (Population / Water / Drain)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <div style={{ padding: '13px 18px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 24, background: '#16a34a', borderRadius: 2 }} />
          <Droplets size={15} color="#16a34a" />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#14532d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Sewage Demand — Combined (Population / Water / Drain Based)
          </span>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Row 1: Mode toggle + info tooltip + UFW ─────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Method</span>
            <ToggleSwitch value={sdMode} onChange={(v) => { setSdMode(v); setSdResult(null); setSdDomSeasonal(null); setSdDomYears([]); setSdErr(null); }} />

            {/* ℹ info tooltip — fixed position to escape any overflow:hidden parent */}
            <SdInfoTooltip />

            {sdMode === 'modeled' && (
              <span style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', borderRadius: 5, padding: '3px 9px', border: '1px solid #86efac', fontWeight: 600 }}>
                {Object.keys(fc).length} forecast years
                {population2025 ? ` · 2025 ref: ${population2025.toLocaleString()}` : ''}
              </span>
            )}

            {/* UFW inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>UFW</span>
              <input style={{ ...inp, width: 64 }} type="number" min="0" max="100" step="0.1" placeholder="15"
                value={ufw} onChange={e => { setUfw(e.target.value); setSdResult(null); }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>%</span>
            </div>
          </div>

          {/* ── Row 3: Population by Year (manual only) ─────────────────── */}
          {sdMode === 'manual' && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Population by Year</span>
                <button type="button"
                  onClick={() => setSdPopRows(r => [...r, { year: '', population: '' }])}
                  style={{ fontSize: 11, padding: '2px 9px', borderRadius: 5, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}>
                  + Add
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b', width: '40%' }}>Year</th>
                    <th style={{ padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b' }}>Population</th>
                    <th style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sdPopRows.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input style={{ ...inp, width: '100%', fontSize: 12, padding: '5px 8px' }} type="number" min="1900" max="2100" step="1" placeholder="2025"
                          value={row.year}
                          onChange={e => { setSdPopRows(rs => rs.map((r, idx) => idx === i ? { ...r, year: e.target.value } : r)); setSdResult(null); }} />
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input style={{ ...inp, width: '100%', fontSize: 12, padding: '5px 8px' }} type="number" min="0" step="1" placeholder="50000"
                          value={row.population}
                          onChange={e => { setSdPopRows(rs => rs.map((r, idx) => idx === i ? { ...r, population: e.target.value } : r)); setSdResult(null); }} />
                      </td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                        {sdPopRows.length > 1 && (
                          <button type="button" onClick={() => setSdPopRows(rs => rs.filter((_, idx) => idx !== i))}
                            style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Row 4: Drain Data ────────────────────────────────────────── */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Drain Data</span>
              <button type="button"
                onClick={() => setSdDrains(d => [...d, { drain_no: '', drain_id: '', drain_recharge: '' }])}
                style={{ fontSize: 11, padding: '2px 9px', borderRadius: 5, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', fontWeight: 700 }}>
                + Add
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Drain No', 'Drain ID', 'Recharge (MLD)', ''].map((h, ci) => (
                      <th key={h} style={{ padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', width: ci === 3 ? 28 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sdDrains.map((d, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input style={{ ...inp, width: '100%', fontSize: 12, padding: '5px 8px' }} placeholder="Drain No" value={d.drain_no}
                          onChange={e => setSdDrains(rows => rows.map((r, idx) => idx === i ? { ...r, drain_no: e.target.value } : r))} />
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input style={{ ...inp, width: '100%', fontSize: 12, padding: '5px 8px' }} placeholder="ID" value={d.drain_id}
                          onChange={e => setSdDrains(rows => rows.map((r, idx) => idx === i ? { ...r, drain_id: e.target.value } : r))} />
                      </td>
                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>
                        <input style={{ ...inp, width: '100%', fontSize: 12, padding: '5px 8px' }} type="number" min="0" step="0.001" placeholder="0.000" value={d.drain_recharge}
                          onChange={e => setSdDrains(rows => rows.map((r, idx) => idx === i ? { ...r, drain_recharge: e.target.value } : r))} />
                      </td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                        {sdDrains.length > 1 && (
                          <button type="button" onClick={() => setSdDrains(rows => rows.filter((_, idx) => idx !== i))}
                            style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <CalcButton onClick={handleSdCalc} loading={sdLoad} label="Calculate Sewage Demand"
            disabled={sdMode === 'manual' ? sdPopRows.every(r => !r.year || !r.population) : Object.keys(fc).length === 0} />

          {sdErr && <ErrorBox msg={sdErr} />}

          {/* Result table */}
          {sdResult && sdResult.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ border: '1px solid #86efac', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '9px 14px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} color="#16a34a" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#14532d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sewage Demand Results (MLD)</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                      <tr style={{ background: '#f0fdf4' }}>
                        {['Year', 'Population', 'Population Based (MLD)', 'Water Based (MLD)', 'Drain Based (MLD)'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Year' ? 'left' : 'right', borderBottom: '2px solid #86efac', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sdResult.map((row, i) => (
                        <tr key={row.year} style={{ background: i % 2 ? '#f0fdf4' : '#fff' }}>
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{row.year}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{Number(row.population).toLocaleString()}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#7c3aed', borderBottom: '1px solid #f1f5f9' }}>{Number(row.population_based).toFixed(4)}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#0369a1', borderBottom: '1px solid #f1f5f9' }}>{Number(row.water_based).toFixed(4)}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#ea580c', borderBottom: '1px solid #f1f5f9' }}>{Number(row.drain_based).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Domestic Seasonal Sewage Generation */}
              {sdDomSeasonal && sdDomYears.length > 0 && (
                <SeasonalTable
                  title="Domestic Seasonal Sewage Generation"
                  data={sdDomSeasonal} years={sdDomYears}
                  accentColor="#7c3aed" accentBg="#f5f3ff" accentBd="#ddd6fe"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — FLOATING SEASONAL SEWAGE GENERATION
      ══════════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <div onClick={() => setOpenFloat(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', borderBottom: openFloat ? '1px solid #fed7aa' : 'none', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 22, background: '#ea580c', borderRadius: 2 }} />
            <Waves size={15} color="#ea580c" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Floating Seasonal Sewage Generation</span>
          </div>
          <span style={{ color: '#94a3b8' }}>{openFloat ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </div>

        {openFloat && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ width: 110 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Floating Pop %</div>
                <input style={{ ...inp, width: '100%' }} type="number" min="0" max="100" step="0.1" placeholder="15" value={floatPct}
                  onChange={e => { setFloatPct(e.target.value); setFloatSeasonal(null); }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Sanitation Facility</div>
                <select value={facilityType} onChange={e => { setFacilityType(e.target.value); setFloatSeasonal(null); }}
                  style={{ ...inp, width: '100%' }}>
                  <option value="provided">Provided (45 LPCD)</option>
                  <option value="notprovided">Not Provided (25 LPCD)</option>
                  <option value="onlypublic">Only Public (15 LPCD)</option>
                </select>
              </div>
              <CalcButton onClick={handleFloatCalc} loading={false} label="Calculate Floating Seasonal"
                disabled={sortedForecastYears().length === 0} />
            </div>
            {sortedForecastYears().length === 0 && (
              <div style={{ fontSize: 12, color: '#ea580c' }}>⚠ Complete Population module first to get forecast data.</div>
            )}
            {floatSeasonal && floatYears.length > 0 && (
              <SeasonalTable
                title="Floating Seasonal Sewage Generation"
                data={floatSeasonal} years={floatYears}
                accentColor="#ea580c" accentBg="#fff7ed" accentBd="#fed7aa"
              />
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — PEAK SEWAGE FLOW
      ══════════════════════════════════════════════════════════════════ */}
      {anyResult && (
        <div style={card}>
          <div onClick={() => setOpenPeak(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(135deg,#fdf4ff,#fae8ff)', borderBottom: openPeak ? '1px solid #e9d5ff' : 'none', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 22, background: '#9333ea', borderRadius: 2 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peak Sewage Flow</span>
            </div>
            <span style={{ color: '#94a3b8' }}>{openPeak ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </div>
          {openPeak && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Avg sewage flow source */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Average Sewage Flow Based On
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {([
                    ['population_based', 'Population Based', '#7c3aed'],
                    ['water_based',      'Water Based',      '#0369a1'],
                    ['drain_based',      'Drain Based',      '#ea580c'],
                  ] as const).map(([val, label, color]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: peakAvgBase === val ? color : '#64748b' }}>
                      <input type="radio" name="peakAvgBase" value={val}
                        checked={peakAvgBase === val}
                        onChange={() => { setPeakAvgBase(val); setPeakRows(null); }}
                        style={{ accentColor: color, width: 15, height: 15 }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Peak method checkboxes */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {([['cpheeo', 'CPHEEO', '#7c3aed'], ['harmon', "Harmon's", '#0891b2'], ['babbitt', "Babbitt's", '#dc2626']] as const).map(([k, l, c]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: peakChk[k] ? c : '#64748b' }}>
                    <input type="checkbox" checked={peakChk[k]} onChange={() => setPeakChk(s => ({ ...s, [k]: !s[k] }))}
                      style={{ accentColor: c, width: 15, height: 15 }} />
                    {l} Method
                  </label>
                ))}
              </div>
              <CalcButton onClick={handlePeakCalc} loading={peakLoad} label="Calculate Peak Flow"
                disabled={!Object.values(peakChk).some(Boolean)} />
              {peakErr && <ErrorBox msg={peakErr} />}
              {peakRows && (
                <div style={{ border: '1px solid #e9d5ff', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                        <tr style={{ background: '#fdf4ff' }}>
                          {['Year', 'Population', 'Avg Flow (MLD)',
                            ...(peakChk.cpheeo ? ['CPHEEO Peak (MLD)'] : []),
                            ...(peakChk.harmon ? ['Harmon Peak (MLD)'] : []),
                            ...(peakChk.babbitt ? ['Babbitt Peak (MLD)'] : []),
                          ].map((h, i) => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: i === 0 ? 'left' : 'right', borderBottom: '2px solid #e9d5ff', fontWeight: 700, whiteSpace: 'nowrap',
                              color: i === 3 ? '#7c3aed' : i === 4 ? '#0891b2' : i === 5 ? '#dc2626' : '#475569' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {peakRows.map((row, i) => (
                          <tr key={row.year} style={{ background: i % 2 ? '#fdf4ff' : '#fff' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{row.year}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{row.population.toLocaleString()}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>
                              {row.avg_sewage_flow != null ? row.avg_sewage_flow.toFixed(3) : row.avg != null ? row.avg.toFixed(3) : '—'}
                            </td>
                            {peakChk.cpheeo  && <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#7c3aed', borderBottom: '1px solid #f1f5f9' }}>{row.cpheeo?.toFixed(3) ?? '—'}</td>}
                            {peakChk.harmon  && <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#0891b2', borderBottom: '1px solid #f1f5f9' }}>{row.harmon?.toFixed(3) ?? '—'}</td>}
                            {peakChk.babbitt && <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626', borderBottom: '1px solid #f1f5f9' }}>{row.babbitt?.toFixed(3) ?? '—'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — SEWAGE TREATMENT CAPACITY ANALYSIS
      ══════════════════════════════════════════════════════════════════ */}
      {anyResult && (
        <div style={card}>
          <div onClick={() => setOpenTreat(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(135deg,#f5f0ff,#ede9fe)', borderBottom: openTreat ? '1px solid #c4b5fd' : 'none', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 22, background: '#7c3aed', borderRadius: 2 }} />
              <Gauge size={15} color="#7c3aed" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sewage Treatment Capacity Analysis</span>
            </div>
            <span style={{ color: '#94a3b8' }}>{openTreat ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </div>

          {openTreat && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Compare existing treatment capacity against peak sewage generation per year to identify capacity gaps.
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Treatment Capacity <span style={{ fontWeight: 400, color: '#cbd5e1', textTransform: 'none' }}>(MLD)</span>
                  </div>
                  <input style={{ ...inp, width: 160 }} type="number" min="0" step="0.01" placeholder="e.g. 15.0" value={treatCapacity}
                    onChange={e => { setTreatCapacity(e.target.value); setTreatRows(null); setTreatErr(null); }} />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Peak Flow Method
                  </div>
                  <select value={treatMethod} onChange={e => { setTreatMethod(e.target.value as any); setTreatRows(null); setTreatErr(null); }}
                    style={{ ...inp, width: 190 }}>
                    <option value="">— Select Method —</option>
                    <option value="cpheeo">CPHEEO Method</option>
                    <option value="harmon">Harmon's Method</option>
                    <option value="babbitt">Babbitt's Method</option>
                  </select>
                </div>

                <CalcButton onClick={handleTreatCalc} loading={false} label="Calculate Gap Analysis"
                  disabled={!treatCapacity || !treatMethod} />
              </div>

              {treatErr && <ErrorBox msg={treatErr} />}

              {treatRows && (
                <div style={{ border: '1px solid #c4b5fd', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: '#f5f0ff', borderBottom: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>Gap Analysis — {treatMethod.toUpperCase()} Peak Flow</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>Treatment Capacity: {Number(treatCapacity).toFixed(2)} MLD</span>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                        <tr style={{ background: '#f5f0ff' }}>
                          {['Year', 'Population', 'Treatment Cap (MLD)', 'Peak Sewage Gen (MLD)', 'Gap (MLD)', 'Status'].map((h, i) => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: i === 0 ? 'left' : 'right', borderBottom: '2px solid #c4b5fd', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {treatRows.map((row, i) => (
                          <tr key={row.year} style={{ background: i % 2 ? '#f5f0ff' : '#fff' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{row.year}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{Number(row.population).toLocaleString()}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{row.treatmentCapacity.toFixed(3)}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{row.sewageGeneration.toFixed(3)}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #f1f5f9', color: row.sufficient ? '#16a34a' : '#dc2626' }}>
                              {row.gap >= 0 ? '+' : ''}{row.gap.toFixed(3)}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: row.sufficient ? '#dcfce7' : '#fee2e2', color: row.sufficient ? '#16a34a' : '#dc2626' }}>
                                {row.sufficient ? 'Sufficient' : 'Deficit'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '8px 14px', fontSize: 11, color: '#64748b', background: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Green = Sufficient</span> — treatment capacity exceeds peak generation. &nbsp;
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>Red = Deficit</span> — upgrade required.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 6 — STORM WATER RUNOFF ANALYSIS
      ══════════════════════════════════════════════════════════════════ */}
      <div style={card}>
        <div onClick={() => setOpenStorm(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', borderBottom: openStorm ? '1px solid #99f6e4' : 'none', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 22, background: '#0d9488', borderRadius: 2 }} />
            <CloudRain size={15} color="#0d9488" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#134e4a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Storm Water Runoff Analysis</span>
          </div>
          <span style={{ color: '#94a3b8' }}>{openStorm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        </div>

        {openStorm && (
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Generate storm water runoff analysis based on shape detection and land use characteristics.
              Click <strong>Initialize</strong> to fetch shape and land-use data for the selected villages.
            </div>

            {/* Step 1: Initialize */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleStormInit} disabled={stormLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, border: 'none', cursor: stormLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, background: stormLoading ? '#e2e8f0' : 'linear-gradient(135deg,#0d9488,#0f766e)', color: stormLoading ? '#94a3b8' : '#fff', boxShadow: stormLoading ? 'none' : '0 4px 12px rgba(13,148,136,0.3)' }}>
                {stormLoading ? <><Spinner /> Initializing…</> : stormData ? '↺ Re-initialize' : 'Initialize Storm Water Analysis'}
              </button>
              {stormData && (
                <span style={{ fontSize: 12, color: '#0d9488', background: '#ccfbf1', borderRadius: 6, padding: '4px 10px', border: '1px solid #99f6e4' }}>
                  ✓ Shape detected: <strong>{stormData.overall_shape_type}</strong> · Area: <strong>{Number(stormData.total_area_hectares).toLocaleString()} ha</strong>
                </span>
              )}
            </div>

            {stormErr && <ErrorBox msg={stormErr} />}

            {/* Step 2: Input controls (shown after init) */}
            {stormData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
                  {/* Land Use Type */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Land Use Type</div>
                    <select value={landUseType} onChange={e => { setLandUseType(e.target.value); setStormResult(null); }}
                      style={{ ...inp, width: '100%' }}>
                      <option value="">— Select —</option>
                      {(stormData.shape_attributes ?? []).map((attr: string) => (
                        <option key={attr} value={attr}>
                          {attr.replace(/^(rectangle_|sector_)/, '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Duration <span style={{ fontWeight: 400, color: '#cbd5e1', textTransform: 'none' }}>(min)</span></div>
                    <select value={duration} onChange={e => { setDuration(e.target.value); setStormResult(null); }}
                      style={{ ...inp, width: '100%' }}>
                      <option value="">— Select —</option>
                      {(stormData.all_duration_values ?? []).map((d: number) => (
                        <option key={d} value={String(d)}>{d} min</option>
                      ))}
                    </select>
                  </div>

                  {/* Rainfall intensity */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rainfall Intensity <span style={{ fontWeight: 400, color: '#cbd5e1', textTransform: 'none' }}>(mm/hr)</span></div>
                    <input style={{ ...inp, width: '100%' }} type="number" min="0" step="0.1" placeholder="e.g. 50" value={rainfall}
                      onChange={e => { setRainfall(e.target.value); setStormResult(null); setStormCalcErr(null); }} />
                  </div>
                </div>

                <CalcButton onClick={handleStormCalc} loading={stormCalcLoad} label="Calculate Storm Water Runoff"
                  disabled={!landUseType || !duration || !rainfall} />

                {stormCalcErr && <ErrorBox msg={stormCalcErr} />}

                {stormResult && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 22px', background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: '1px solid #99f6e4', borderRadius: 12 }}>
                    <CheckCircle2 size={24} color="#0d9488" />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Storm Water Runoff</div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: '#0d9488', lineHeight: 1.1 }}>
                        {stormResult.storm_water_runoff ?? '—'}
                        <span style={{ fontSize: 15, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>{stormResult.unit ?? 'MLD'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Shape: <strong>{stormData.overall_shape_type}</strong> ·
                        Land use: <strong>{landUseType.replace(/^(rectangle_|sector_)/, '').replace(/_/g, ' ')}</strong> ·
                        Duration: <strong>{duration} min</strong> ·
                        Intensity: <strong>{rainfall} mm/hr</strong>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 7 — RAW SEWAGE CHARACTERISTICS
      ══════════════════════════════════════════════════════════════════ */}
      {anyResult && (
        <div style={card}>
          <div onClick={() => setOpenRaw(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', borderBottom: openRaw ? '1px solid #fed7aa' : 'none', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 22, background: '#ea580c', borderRadius: 2 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Raw Sewage Characteristics</span>
            </div>
            <span style={{ color: '#94a3b8' }}>{openRaw ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </div>
          {openRaw && (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Uses 2011 population from forecast. Edit per-capita values and click <strong>Recalculate</strong>.
              </div>
              <CalcButton onClick={() => handleRawCalc()} loading={rawLoad}
                label={rawItems ? 'Recalculate' : 'Calculate Raw Sewage Characteristics'} />
              {rawErr && <ErrorBox msg={rawErr} />}
              {rawCoeff !== null && (
                <div style={{ fontSize: 12, color: '#92400e', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '6px 10px' }}>
                  Total coefficient: <strong>{rawCoeff.toFixed(2)} LPCD</strong>
                  <span style={{ color: '#94a3b8', marginLeft: 8 }}>(base + UFW) × 0.80</span>
                </div>
              )}
              {rawItems && (
                <>
                  <div style={{ border: '1px solid #fed7aa', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                          <tr style={{ background: '#fff7ed' }}>
                            {['Parameter', 'Per Capita (g/c/d)', 'Raw Sewage (mg/L)', 'Design Value (mg/L)'].map(h => (
                              <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Parameter' ? 'left' : 'right', borderBottom: '2px solid #fed7aa', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rawItems.map((item, i) => (
                            <tr key={item.name} style={{ background: i % 2 ? '#fff7ed' : '#fff' }}>
                              <td style={{ padding: '8px 14px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #f1f5f9' }}>{item.name}</td>
                              <td style={{ padding: '6px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                                <input type="number" step="0.1" min="0" value={item.per_capita}
                                  onChange={e => updateRaw(i, 'per_capita', parseFloat(e.target.value) || 0)}
                                  style={{ ...inp, width: 90, textAlign: 'right' }} />
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>{item.concentration.toFixed(1)}</td>
                              <td style={{ padding: '6px 14px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                                <input type="number" step="0.1" min="0" value={item.design_characteristic}
                                  onChange={e => updateRaw(i, 'design_characteristic', parseFloat(e.target.value) || 0)}
                                  style={{ ...inp, width: 90, textAlign: 'right' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRawCalc(rawItems)} disabled={rawLoad}
                    style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid #fed7aa', background: rawLoad ? '#f1f5f9' : '#fff7ed', color: rawLoad ? '#94a3b8' : '#ea580c', fontSize: 13, fontWeight: 600, cursor: rawLoad ? 'not-allowed' : 'pointer' }}>
                    {rawLoad ? <Spinner /> : <RefreshCw size={13} />}
                    Recalculate with edited values
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drain mode stub */}
      <div style={{ ...card, opacity: 0.55 }}>
        <div style={{ padding: '12px 18px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Construction size={15} color="#94a3b8" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Drain-Based Sewage — Coming Soon</span>
        </div>
      </div>

      <ModuleNav
        back={{ label: 'Water Supply', onClick: () => setActiveModule('water_supply') }}
      />
    </div>
  );
}
