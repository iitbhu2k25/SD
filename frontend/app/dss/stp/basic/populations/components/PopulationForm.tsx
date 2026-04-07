'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, Activity, Users2, Play, Info } from 'lucide-react';

type Method = 'arithmetic' | 'demographic' | 'cohort';

interface PopulationFormProps {
  onRun: (method: Method, params: Record<string, any>) => void;
  onBeforeRun: (checkedMethods: Set<Method>) => void;
  loadingMethod: Method | null;
}

/* ── Tooltip — renders into document.body via portal so it is never
   clipped by overflow:hidden / overflow:auto ancestors ────────── */
function Tip({ text }: { text: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const handleEnter = () => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  };
  const handleLeave = () => setRect(null);

  const tooltip = rect
    ? createPortal(
        <div style={{
          position: 'fixed',
          left: rect.left + rect.width / 2,
          top: rect.top - 8,
          transform: 'translate(-50%, -100%)',
          background: '#1e293b', color: '#f1f5f9',
          borderRadius: 7, padding: '7px 11px',
          fontSize: 11, lineHeight: 1.55, fontWeight: 400,
          width: 210, whiteSpace: 'normal',
          boxShadow: '0 6px 18px rgba(0,0,0,0.32)',
          zIndex: 99999, pointerEvents: 'none', textAlign: 'left',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '5px 5px 0', borderStyle: 'solid',
            borderColor: '#1e293b transparent transparent',
          }} />
        </div>,
        document.body,
      )
    : null;

  return (
    <span
      ref={anchorRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ display: 'inline-flex', flexShrink: 0, cursor: 'help', alignItems: 'center' }}
    >
      <Info size={11} color="#94a3b8" />
      {tooltip}
    </span>
  );
}

/* ── Spinner ──────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg style={{ animation: 'spin 0.8s linear infinite', width: 13, height: 13, flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Field label ──────────────────────────────────────────────── */
function FieldLabel({ label, tip, dimmed }: { label: string; tip?: string; dimmed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
        color: dimmed ? '#cbd5e1' : '#94a3b8', transition: 'color 0.2s',
      }}>
        {label}
      </span>
      {tip && <Tip text={tip} />}
    </div>
  );
}

/* ── Methods ──────────────────────────────────────────────────── */
const METHODS: {
  key: Method; label: string;
  color: string; bg: string; border: string;
  icon: React.ReactNode; tooltip: string;
}[] = [
  {
    key: 'arithmetic', label: 'Time Series',
    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    icon: <TrendingUp size={13} />,
    tooltip: 'Runs 4 growth models — Arithmetic, Geometric, Incremental & Exponential — using census data to project population trends over time.',
  },
  {
    key: 'demographic', label: 'Demographic',
    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    icon: <Activity size={13} />,
    tooltip: 'Projects population using vital rates: Birth, Death, Emigration & Immigration rates applied year-by-year to the base population.',
  },
  {
    key: 'cohort', label: 'Cohort',
    color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4',
    icon: <Users2 size={13} />,
    tooltip: 'Divides population into age-sex cohorts and tracks each group through fertility and mortality rates for a detailed breakdown per year.',
  },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function PopulationForm({ onRun, onBeforeRun, loadingMethod }: PopulationFormProps) {
  const [startYear, setStartYear]   = useState('2011');
  const [endYear, setEndYear]       = useState('2036');
  const [singleYear, setSingleYear] = useState('');

  const [birthRate, setBirthRate]             = useState('');
  const [deathRate, setDeathRate]             = useState('');
  const [emigrationRate, setEmigrationRate]   = useState('');
  const [immigrationRate, setImmigrationRate] = useState('');

  const [checked, setChecked] = useState<Set<Method>>(new Set(['arithmetic']));

  const toggle = (m: Method) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });

  const isRunning   = loadingMethod !== null;
  const noneChecked = checked.size === 0;

  /* Mutual exclusion logic:
     - If singleYear has a value  → range fields are disabled/dimmed
     - If startYear OR endYear has a value AND singleYear is empty → single is disabled/dimmed  */
  const usingSingle    = singleYear.trim() !== '';
  const usingRange     = !usingSingle && (startYear.trim() !== '' || endYear.trim() !== '');
  const rangeDimmed    = usingSingle;
  const singleDimmed   = !usingSingle && (startYear.trim() !== '' || endYear.trim() !== '');

  const inputStyle = (dimmed: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${dimmed ? '#f1f5f9' : '#e2e8f0'}`,
    borderRadius: 8, padding: '6px 10px', fontSize: 12,
    outline: 'none', background: dimmed ? '#ffffff' : '#fff',
    color: dimmed ? '#cbd5e1' : '#1e293b',
    cursor: dimmed ? 'not-allowed' : 'text',
    opacity: dimmed ? 2 : 2,
    transition: 'all 0.2s',
    pointerEvents: dimmed ? 'none' : 'auto',
  });

  const yearParams = () =>
    usingSingle
      ? { year: parseInt(singleYear) }
      : {
          ...(startYear ? { start_year: parseInt(startYear) } : {}),
          ...(endYear   ? { end_year: parseInt(endYear) }     : {}),
        };

  const handleRun = () => {
    if (isRunning || noneChecked) return;
    onBeforeRun(checked);
    METHODS.filter((m) => checked.has(m.key)).forEach(({ key }) => {
      if (key === 'demographic') {
        onRun('demographic', {
          ...yearParams(),
          demographic: {
            birthRate:       birthRate       ? parseFloat(birthRate)       : null,
            deathRate:       deathRate       ? parseFloat(deathRate)       : null,
            emigrationRate:  emigrationRate  ? parseFloat(emigrationRate)  : null,
            immigrationRate: immigrationRate ? parseFloat(immigrationRate) : null,
          },
        });
      } else {
        onRun(key, yearParams());
      }
    });
  };

  const demChecked = checked.has('demographic');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Year fields — all three in one row ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Year
          </span>
          <Tip text="Use Start + End Year for a full projection range, OR enter a Single Year for one-point calculation. Filling Single Year disables range fields and vice-versa." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>

          {/* Start Year */}
          <div>
            <FieldLabel
              label="Start"
              dimmed={rangeDimmed}
              tip="Base census year where projection begins. Typically 2011 (last full Indian census)."
            />
            <input
              type="number"
              value={startYear}
              onChange={(e) => { setSingleYear(''); setStartYear(e.target.value); }}
              placeholder="2011"
              min={1901} max={2100}
              style={inputStyle(rangeDimmed)}
              tabIndex={rangeDimmed ? -1 : 0}
            />
          </div>

          {/* End Year */}
          <div>
            <FieldLabel
              label="End"
              dimmed={rangeDimmed}
              tip="Target horizon year up to which population will be projected."
            />
            <input
              type="number"
              value={endYear}
              onChange={(e) => { setSingleYear(''); setEndYear(e.target.value); }}
              placeholder="2036"
              min={1901} max={2100}
              style={inputStyle(rangeDimmed)}
              tabIndex={rangeDimmed ? -1 : 0}
            />
          </div>

          {/* Single Year */}
          <div>
            <FieldLabel
              label="Single"
              dimmed={singleDimmed}
              tip="Calculates projected population for one specific year only. Clears Start & End Year when used."
            />
            <input
              type="number"
              value={singleYear}
              onChange={(e) => { setStartYear(''); setEndYear(''); setSingleYear(e.target.value); }}
              placeholder="e.g. 2031"
              min={1901} max={2100}
              style={inputStyle(singleDimmed)}
              tabIndex={singleDimmed ? -1 : 0}
            />
          </div>

        </div>

        {/* Active mode hint */}
        <div style={{ fontSize: 10, color: '#1d59ad', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: usingSingle ? '#0d9488' : '#2563eb',
            flexShrink: 0,
          }} />
          {usingSingle
            ? `Single year mode — projecting for year ${singleYear}`
            : usingRange
            ? `Range mode — ${startYear || '?'} → ${endYear || '?'}`
            : 'Enter year values above to begin'}
        </div>
      </div>

      {/* ── Methods — single compact row ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Methods
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {METHODS.map(({ key, label, color, bg, border, icon, tooltip }) => {
            const isActive      = checked.has(key);
            const isThisLoading = loadingMethod === key;
            return (
              <div
                key={key}
                onClick={() => !isRunning && toggle(key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 8px', borderRadius: 8, minWidth: 0,
                  border: `1.5px solid ${isActive ? border : '#e2e8f0'}`,
                  background: isActive ? bg : '#fafafa',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  opacity: isRunning && !isThisLoading ? 0.55 : 1,
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isActive ? color : '#cbd5e1'}`,
                  background: isActive ? color : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isActive && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Icon */}
                <span style={{ color: isActive ? color : '#94a3b8', display: 'flex', flexShrink: 0 }}>
                  {isThisLoading ? <Spinner /> : icon}
                </span>

                {/* Label */}
                <span style={{
                  fontSize: 11, fontWeight: 700, flex: 1, minWidth: 0,
                  color: isActive ? color : '#64748b',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>

                {/* Info — stop propagation so it doesn't toggle the card */}
                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', flexShrink: 0 }}
                >
                  <Tip text={tooltip} />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Demographic parameters ── */}
      {demChecked && (
        <div style={{
          border: '1px solid #ddd6fe', borderRadius: 10, padding: 12,
          background: '#faf5ff', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Demographic Parameters
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { label: 'Birth Rate (‰)',   val: birthRate,       set: setBirthRate,       ph: '20',  step: '0.1',  tip: 'Live births per 1,000 people per year.' },
              { label: 'Death Rate (‰)',   val: deathRate,       set: setDeathRate,       ph: '7',   step: '0.1',  tip: 'Deaths per 1,000 people per year.' },
              { label: 'Emigration (%)',   val: emigrationRate,  set: setEmigrationRate,  ph: '0.5', step: '0.01', tip: 'Annual % of population leaving the area.' },
              { label: 'Immigration (%)', val: immigrationRate, set: setImmigrationRate, ph: '0.3', step: '0.01', tip: 'Annual % of population entering the area.' },
            ] as const).map(({ label, val, set, ph, step, tip }) => (
              <div key={label}>
                <FieldLabel label={label} tip={tip} />
                <input
                  type="number" value={val} step={step}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  placeholder={`e.g. ${ph}`}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: '6px 10px', fontSize: 12,
                    outline: 'none', background: '#fff', color: '#1e293b',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Run button ── */}
      <button
        type="button"
        disabled={isRunning || noneChecked}
        onClick={handleRun}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '10px 20px', borderRadius: 9, border: 'none',
          background: noneChecked
            ? '#e2e8f0'
            : isRunning
            ? '#93c5fd'
            : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: noneChecked ? '#94a3b8' : '#fff',
          fontSize: 13, fontWeight: 700,
          cursor: isRunning || noneChecked ? 'not-allowed' : 'pointer',
          boxShadow: isRunning || noneChecked ? 'none' : '0 3px 10px rgba(37,99,235,0.3)',
          transition: 'all 0.2s', letterSpacing: '0.02em',
        }}
      >
        {isRunning ? (
          <><Spinner /> Running {checked.size > 1 ? 'methods' : METHODS.find((m) => loadingMethod === m.key)?.label ?? ''}…</>
        ) : (
          <><Play size={13} fill="white" />
            Run {checked.size === 0
              ? 'Analysis'
              : checked.size === 1
              ? METHODS.find((m) => checked.has(m.key))?.label
              : `${checked.size} Methods`}
          </>
        )}
      </button>

    </div>
  );
}
