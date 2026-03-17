'use client';

import { useState } from 'react';
import { TrendingUp, Activity, Users2, Play } from 'lucide-react';

type Method = 'arithmetic' | 'demographic' | 'cohort';

interface PopulationFormProps {
  onRun: (method: Method, params: Record<string, any>) => void;
  onBeforeRun: (checkedMethods: Set<Method>) => void;
  loadingMethod: Method | null;
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-all';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg style={{ animation:'spin 0.8s linear infinite', width:14, height:14 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

const METHODS: {
  key: Method;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'arithmetic',
    label: 'Time Series',
    sublabel: 'Arithmetic · Geometric · Incremental · Exponential',
    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    icon: <TrendingUp size={15} />,
  },
  {
    key: 'demographic',
    label: 'Demographic',
    sublabel: 'Birth · Death · Emigration · Immigration rates',
    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    icon: <Activity size={15} />,
  },
  {
    key: 'cohort',
    label: 'Cohort Analysis',
    sublabel: 'Age–sex breakdown by population cohort',
    color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4',
    icon: <Users2 size={15} />,
  },
];

export default function PopulationForm({ onRun, onBeforeRun, loadingMethod }: PopulationFormProps) {
  const [startYear, setStartYear] = useState('2011');
  const [endYear, setEndYear]     = useState('2051');
  const [singleYear, setSingleYear] = useState('');

  const [birthRate, setBirthRate]           = useState('');
  const [deathRate, setDeathRate]           = useState('');
  const [emigrationRate, setEmigrationRate] = useState('');
  const [immigrationRate, setImmigrationRate] = useState('');

  const [checked, setChecked] = useState<Set<Method>>(new Set(['arithmetic']));

  const toggle = (m: Method) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });

  const isRunning = loadingMethod !== null;
  const noneChecked = checked.size === 0;

  const yearParams = () => ({
    ...(singleYear ? { year: parseInt(singleYear) } : {}),
    ...(startYear  ? { start_year: parseInt(startYear) } : {}),
    ...(endYear    ? { end_year: parseInt(endYear) } : {}),
  });

  const handleRun = () => {
    if (isRunning || noneChecked) return;
    // Clear results for unchecked methods before running
    onBeforeRun(checked);
    // Run each checked method sequentially
    const methods = METHODS.filter((m) => checked.has(m.key));
    methods.forEach(({ key }) => {
      if (key === 'demographic') {
        onRun('demographic', {
          ...yearParams(),
          demographic: {
            birthRate:      birthRate      ? parseFloat(birthRate)      : null,
            deathRate:      deathRate      ? parseFloat(deathRate)      : null,
            emigrationRate: emigrationRate ? parseFloat(emigrationRate) : null,
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
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Year parameters ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <Field label="Start Year">
          <input type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)}
            placeholder="2011" className={inputCls} min={1901} max={2100} />
        </Field>
        <Field label="End Year">
          <input type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)}
            placeholder="2051" className={inputCls} min={1901} max={2100} />
        </Field>
      </div>
      <Field label="Single Year (optional)">
        <input type="number" value={singleYear} onChange={(e) => setSingleYear(e.target.value)}
          placeholder="e.g. 2031" className={inputCls} min={1901} max={2100} />
      </Field>

      {/* ── Method checkboxes — single row ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em' }}>
          Methods to Run
        </span>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {METHODS.map(({ key, label, sublabel, color, bg, border, icon }) => {
            const isActive = checked.has(key);
            const isThisLoading = loadingMethod === key;
            return (
              <div key={key}
                onClick={() => !isRunning && toggle(key)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                  padding:'12px 10px', borderRadius:10, textAlign:'center',
                  border: `1.5px solid ${isActive ? border : '#e2e8f0'}`,
                  background: isActive ? bg : '#fafafa',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  transition:'all 0.15s',
                  opacity: isRunning && !isThisLoading ? 0.6 : 1,
                }}>
                {/* Custom checkbox */}
                <div style={{
                  width:20, height:20, borderRadius:5, flexShrink:0,
                  border: `2px solid ${isActive ? color : '#cbd5e1'}`,
                  background: isActive ? color : '#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.15s',
                }}>
                  {isActive && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* Icon */}
                <span style={{ color: isActive ? color : '#94a3b8', display:'flex' }}>{icon}</span>

                {/* Label */}
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color: isActive ? color : '#64748b', lineHeight:1.2 }}>{label}</div>
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, lineHeight:1.3 }}>{sublabel}</div>
                  {isThisLoading && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:10, color, marginTop:4 }}>
                      <Spinner/> Running…
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Demographic parameters — shown only when demographic is checked ── */}
      {demChecked && (
        <div style={{
          border:'1px solid #ddd6fe', borderRadius:10, padding:14,
          background:'#faf5ff', display:'flex', flexDirection:'column', gap:10,
        }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.07em' }}>
            Demographic Parameters
          </span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Birth Rate (per 1000)">
              <input type="number" value={birthRate} onChange={(e) => setBirthRate(e.target.value)}
                placeholder="e.g. 20" step="0.1" className={inputCls} />
            </Field>
            <Field label="Death Rate (per 1000)">
              <input type="number" value={deathRate} onChange={(e) => setDeathRate(e.target.value)}
                placeholder="e.g. 7" step="0.1" className={inputCls} />
            </Field>
            <Field label="Emigration Rate (%)">
              <input type="number" value={emigrationRate} onChange={(e) => setEmigrationRate(e.target.value)}
                placeholder="e.g. 0.5" step="0.01" className={inputCls} />
            </Field>
            <Field label="Immigration Rate (%)">
              <input type="number" value={immigrationRate} onChange={(e) => setImmigrationRate(e.target.value)}
                placeholder="e.g. 0.3" step="0.01" className={inputCls} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Single Run button ── */}
      <button
        type="button"
        disabled={isRunning || noneChecked}
        onClick={handleRun}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          padding:'12px 24px', borderRadius:10, border:'none',
          background: noneChecked ? '#e2e8f0' : isRunning ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: noneChecked ? '#94a3b8' : '#fff',
          fontSize:14, fontWeight:700, cursor: isRunning || noneChecked ? 'not-allowed' : 'pointer',
          boxShadow: isRunning || noneChecked ? 'none' : '0 4px 12px rgba(37,99,235,0.35)',
          transition:'all 0.2s',
          letterSpacing:'0.02em',
        }}>
        {isRunning ? (
          <><Spinner/> Running {checked.size > 1 ? 'methods' : METHODS.find(m => loadingMethod === m.key)?.label ?? ''}…</>
        ) : (
          <><Play size={15} fill="white"/>
            Run {checked.size === 0 ? 'Analysis' : checked.size === 1
              ? METHODS.find(m => checked.has(m.key))?.label
              : `${checked.size} Methods`}
          </>
        )}
      </button>

    </div>
  );
}