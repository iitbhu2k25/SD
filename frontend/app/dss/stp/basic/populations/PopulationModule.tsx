'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useBasicStore } from '../shared/store/basic.store';
import ModuleNav from '../shared/components/ModuleNav';
import { fetchArithmetic, fetchDemographic, fetchCohort, fetchPopulation2025, fetchThematicMap, fetchThematicMapDemographic, fetchThematicMapCohort } from '../shared/services/population.service';
import PopulationForm from './components/PopulationForm';
import PopulationChart from './components/PopulationChart';
import TimeseriesTable from './components/timeseries';
import Cohort from './components/cohort';
import {
  TrendingUp, Activity, Users2, AlertCircle,
  ChevronDown, ChevronUp, BarChart2, Table2, CheckCircle2,
} from 'lucide-react';

type Method = 'arithmetic' | 'demographic' | 'cohort';

function Spinner() {
  return (
    <svg style={{ animation:'spin 1s linear infinite', width:14, height:14 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function SectionCard({
  title, subtitle, accentColor, bgColor, borderColor,
  loading, error, children, defaultOpen = true,
}: {
  title: string; subtitle?: string;
  accentColor: string; bgColor: string; borderColor: string;
  loading?: boolean; error?: string;
  children?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasContent = !loading && !error && !!children;
  return (
    <div style={{ background:'#fff', border:`1px solid ${borderColor}`, borderRadius:12, boxShadow:'0 2px 6px rgba(0,0,0,0.06)', overflow:'hidden' }}>
      <div onClick={() => hasContent && setOpen((v) => !v)}
        style={{
          display:'flex', alignItems:'center', gap:10, padding:'13px 18px',
          background: bgColor,
          borderBottom: open ? `1px solid ${borderColor}` : 'none',
          cursor: hasContent ? 'pointer' : 'default', userSelect:'none',
        }}>
        <div style={{ width:4, height:24, background:accentColor, borderRadius:2, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#1e293b' }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>{subtitle}</div>}
        </div>
        {loading && (
          <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:accentColor, fontWeight:600 }}>
            <Spinner/> Calculating…
          </span>
        )}
        {hasContent && (
          <span style={{ color:'#94a3b8' }}>
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </span>
        )}
      </div>

      {open && (
        <div style={{ padding:'20px' }}>
          {loading ? (
            <div style={{ textAlign:'center', color:'#94a3b8', padding:'28px 0', fontSize:13 }}>Running…</div>
          ) : error ? (
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 14px' }}>
              <AlertCircle size={14} color="#ef4444" style={{ flexShrink:0, marginTop:1 }}/>
              <span style={{ fontSize:13, color:'#b91c1c' }}>{error}</span>
            </div>
          ) : children}
        </div>
      )}
    </div>
  );
}

export default function PopulationModule() {
  const {
    confirmedLocation,
    setPopulationForecast,
    setPopulation2025,
    setActiveModule,
    setPopulationReportData,
    setThematicMapData,
    mergeThematicMapMethod,
  } = useBasicStore();
  const [results, setResults] = useState<Partial<Record<Method, any>>>({});
  const [errors, setErrors] = useState<Partial<Record<Method, string>>>({});
  const [loadingMethods, setLoadingMethods] = useState<Set<Method>>(new Set());
  const [chartTab, setChartTab] = useState<'chart' | 'table'>('table');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [autoSelectedMethod, setAutoSelectedMethod] = useState<string | null>(null);
  const [userPicked, setUserPicked] = useState(false);
  const [growthRates, setGrowthRates] = useState<Record<string, number>>({});

  // Refs always hold latest values — prevent stale closures in button onClick
  const selectedMethodRef = useRef<string | null>(null);
  const combinedChartDataRef = useRef<Record<string, Record<number, number>>>({});
  const reportHashRef = useRef('');

  const loadingMethod: Method | null = loadingMethods.size > 0 ? Array.from(loadingMethods)[0] : null;

  // ── Clear results for unchecked methods before a new run ─────
  const clearUncheckedResults = (checkedMethods: Set<Method>) => {
    setResults((prev) => {
      const next = { ...prev };
      (['arithmetic', 'demographic', 'cohort'] as const).forEach((m) => {
        if (!checkedMethods.has(m)) delete next[m];
      });
      return next;
    });
    // Reset auto-selection so it re-evaluates fresh from new results
    setUserPicked(false);
    setSelectedMethod(null);
    setAutoSelectedMethod(null);
    setGrowthRates({});
  };

  const run = async (method: Method, params: Record<string, any>) => {
    if (!confirmedLocation) return;
    setLoadingMethods((s) => { const n = new Set(s); n.add(method); return n; });
    setErrors((e) => ({ ...e, [method]: undefined }));
    try {
      let data: any;
      if (method === 'arithmetic') {
        data = await fetchArithmetic(confirmedLocation, params);
        // Fire thematic map in parallel (non-blocking — ignore errors)
        fetchThematicMap(confirmedLocation, params)
          .then((geo) => setThematicMapData(geo, 'Arithmetic'))
          .catch(() => {});
      } else if (method === 'demographic') {
        data = await fetchDemographic(confirmedLocation, params);
        fetchThematicMapDemographic(confirmedLocation, params)
          .then((geo) => mergeThematicMapMethod(geo, 'Demographic'))
          .catch(() => {});
      } else {
        data = await fetchCohort(confirmedLocation, params);
        fetchThematicMapCohort(confirmedLocation, params)
          .then((geo) => mergeThematicMapMethod(geo, 'Cohort Total'))
          .catch(() => {});
      }
      setResults((r) => ({ ...r, [method]: data }));
    } catch (e: any) {
      setErrors((err) => ({ ...err, [method]: e.message }));
    } finally {
      setLoadingMethods((s) => { const n = new Set(s); n.delete(method); return n; });
    }
  };

  // ── Normalize timeseries ──────────────────────────────────────
  const tsData = results.arithmetic as Record<string, Record<number, number>> | undefined;

  // ── Normalize demographic ─────────────────────────────────────
  // Only include if the API was actually run AND returned valid per-year data
  const demoRaw = results.demographic as any;
  const demoSeries: Record<number, number> | undefined = (() => {
    if (!demoRaw) return undefined;
    const inner = demoRaw?.demographic ?? demoRaw;
    if (!inner || typeof inner !== 'object') return undefined;
    const entries = Object.entries(inner).filter(
      ([k, v]) => !isNaN(Number(k)) && typeof v === 'number'
    );
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries.map(([k, v]) => [Number(k), v as number]));
  })();
  const demoData: Record<string, Record<number, number>> | undefined =
    demoSeries ? { Demographic: demoSeries } : undefined;

  // ── Normalize cohort ──────────────────────────────────────────
  const cohortRaw = results.cohort as any;
  const cohortEntries: Array<{ year: number; data: Record<string, { male: number; female: number; total: number }> }> =
    cohortRaw?.cohort
      ? cohortRaw.cohort
      : Array.isArray(cohortRaw)
      ? cohortRaw
      : cohortRaw
      ? [cohortRaw]
      : [];

  // Extract cohort total population per year
  const cohortTotalCol: Record<number, number> | undefined =
    cohortEntries.length
      ? cohortEntries.reduce((acc, e) => {
          const t = e?.data?.total?.total;
          if (t != null) acc[e.year] = t;
          return acc;
        }, {} as Record<number, number>)
      : undefined;

  // ── ONE combined chart data ───────────────────────────────────
  const combinedChartData: Record<string, Record<number, number>> = {
    ...(tsData ?? {}),
    ...(demoData ?? {}),
    ...(cohortTotalCol ? { 'Cohort Total': cohortTotalCol } : {}),
  };
  const hasCombinedData = Object.keys(combinedChartData).length > 0;

  // ── Growth rate analysis — auto-select minimum avg growth rate ──
  const combinedKeys = Object.keys(combinedChartData).sort().join(',');
  useEffect(() => {
    const keys = Object.keys(combinedChartData);
    if (keys.length === 0) return;

    let minAvg = Infinity;
    let bestMethod = '';
    const analysis: Record<string, number> = {};

    keys.forEach((name) => {
      const series = combinedChartData[name];
      const years = Object.keys(series).map(Number).sort((a, b) => a - b);
      const base = series[2011];
      if (!base) return;
      const rates: number[] = [];
      years.forEach((yr) => {
        if (yr !== 2011) rates.push(((series[yr] - base) / base) * 100);
      });
      const avg = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
      analysis[name] = parseFloat(avg.toFixed(2));
      if (avg < minAvg) { minAvg = avg; bestMethod = name; }
    });

    setGrowthRates(analysis);
    setAutoSelectedMethod(bestMethod);
    // Always update unless user manually picked
    if (!userPicked) setSelectedMethod(bestMethod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedKeys, loadingMethods.size]);

  // Keep refs in sync — avoids stale closures in button onClick
  selectedMethodRef.current = selectedMethod;
  combinedChartDataRef.current = combinedChartData;

  // ── Merged table ──────────────────────────────────────────────
  const mergedTableData: Record<string, Record<number, number>> | undefined =
    hasCombinedData ? combinedChartData : undefined;

  const anyLoading = loadingMethods.size > 0;
  const hasAnyResult = hasCombinedData || cohortEntries.length > 0;

  useEffect(() => {
    if (!hasAnyResult) {
      if (reportHashRef.current !== '') {
        reportHashRef.current = '';
        setPopulationReportData(null);
      }
      return;
    }
    const payload = {
      combinedChartData,
      mergedTableData: mergedTableData ?? null,
      cohortEntries,
      selectedMethod,
      autoSelectedMethod,
      growthRates,
    };
    const nextHash = JSON.stringify(payload);
    if (nextHash !== reportHashRef.current) {
      reportHashRef.current = nextHash;
      setPopulationReportData(payload);
    }
  }, [
    hasAnyResult,
    combinedChartData,
    mergedTableData,
    cohortEntries,
    selectedMethod,
    autoSelectedMethod,
    growthRates,
    setPopulationReportData,
  ]);

  return (
    <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Parameters ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'13px 18px',
          background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderBottom:'1px solid #e2e8f0',
        }}>
          <div style={{ width:4, height:24, background:'#2563eb', borderRadius:2 }} />
          <span style={{ fontSize:14, fontWeight:800, color:'#1e293b', letterSpacing:'0.02em', textTransform:'uppercase' }}>
            Parameters
          </span>
        </div>
        <div style={{ padding:'20px' }}>
          <PopulationForm onRun={run} onBeforeRun={clearUncheckedResults} loadingMethod={loadingMethod} />
        </div>
      </div>

      {/* ── COMBINED CHART + TABLE ── */}
      {(hasCombinedData || anyLoading) && (
        <SectionCard
          title="Population Projection"
          subtitle="Arithmetic · Geometric · Incremental · Exponential · Demographic · Cohort Total"
          accentColor="#2563eb" bgColor="#eff6ff" borderColor="#bfdbfe"
          loading={anyLoading && !hasCombinedData}
        >
          {hasCombinedData && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:8, padding:3, alignSelf:'flex-start' }}>
                {(['chart', 'table'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setChartTab(t)}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'7px 16px', borderRadius:6, fontSize:13, fontWeight:600,
                      border:'none', cursor:'pointer', transition:'all 0.15s',
                      background: chartTab === t ? '#fff' : 'transparent',
                      color: chartTab === t ? '#2563eb' : '#64748b',
                      boxShadow: chartTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {t === 'chart' ? <BarChart2 size={14}/> : <Table2 size={14}/>}
                    {t === 'chart' ? 'Chart' : 'Table'}
                  </button>
                ))}
              </div>

              {chartTab === 'chart' && <PopulationChart results={combinedChartData} />}
              {chartTab === 'table' && mergedTableData && <TimeseriesTable data={mergedTableData} />}

              {anyLoading && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {loadingMethods.has('arithmetic') && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#2563eb', background:'#eff6ff', borderRadius:8, padding:'8px 14px', border:'1px solid #bfdbfe' }}>
                      <Spinner/> Running Time Series (Arithmetic · Geometric · Incremental · Exponential)…
                    </div>
                  )}
                  {loadingMethods.has('demographic') && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#7c3aed', background:'#f5f3ff', borderRadius:8, padding:'8px 14px', border:'1px solid #ddd6fe' }}>
                      <Spinner/> Running Demographic projection…
                    </div>
                  )}
                  {loadingMethods.has('cohort') && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#0d9488', background:'#f0fdfa', borderRadius:8, padding:'8px 14px', border:'1px solid #99f6e4' }}>
                      <Spinner/> Running Cohort analysis…
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── COHORT AGE-SEX breakdown ── */}
      {(cohortEntries.length > 0 || loadingMethod === 'cohort' || errors.cohort) && (
        <SectionCard
          title="Cohort Analysis"
          subtitle="Age-sex breakdown by population cohort"
          accentColor="#0d9488" bgColor="#f0fdfa" borderColor="#99f6e4"
          loading={loadingMethod === 'cohort' && cohortEntries.length === 0}
          error={errors.cohort}
        >
          {cohortEntries.length > 0 && <Cohort cohortData={cohortEntries} />}
        </SectionCard>
      )}

      {/* ── Per-method errors ── */}
      {errors.arithmetic && (
        <SectionCard title="Time Series Error" accentColor="#ef4444" bgColor="#fef2f2" borderColor="#fecaca" error={errors.arithmetic} />
      )}
      {errors.demographic && (
        <SectionCard title="Demographic Error" accentColor="#ef4444" bgColor="#fef2f2" borderColor="#fecaca" error={errors.demographic} />
      )}

      {/* ── Select method + Save & Next ── */}
      {hasCombinedData && (
        <div style={{
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
          boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden',
        }}>
          {/* compact header */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 14px',
            background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderBottom:'1px solid #e2e8f0',
          }}>
            <div style={{ width:3, height:18, background:'#16a34a', borderRadius:2, flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:800, color:'#1e293b', letterSpacing:'0.04em', textTransform:'uppercase' }}>
              Select Method
            </span>
            <span style={{ fontSize:10, color:'#94a3b8' }}>for Water Demand</span>
          </div>

          <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>

            {/* auto-select badge — compact single line */}
            {autoSelectedMethod && (
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                background:'#f0fdf4', border:'1px solid #bbf7d0',
                borderRadius:7, padding:'6px 10px', fontSize:11, color:'#15803d',
              }}>
                <CheckCircle2 size={12} color="#16a34a" style={{ flexShrink:0 }}/>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  <strong>{autoSelectedMethod}</strong> auto-selected
                  {growthRates[autoSelectedMethod] != null && (
                    <> · <span style={{ fontWeight:700 }}>{growthRates[autoSelectedMethod].toFixed(2)}%</span> avg</>
                  )}
                  <span style={{ color:'#86efac', marginLeft:4 }}>· click to override</span>
                </span>
              </div>
            )}

            {/* single-row method pills */}
            <div style={{ display:'flex', gap:6 }}>
              {Object.keys(combinedChartData).map((method) => {
                const isSelected = selectedMethod === method;
                const isAuto     = method === autoSelectedMethod;
                const rate       = growthRates[method];
                return (
                  <button key={method} type="button"
                    onClick={() => { setUserPicked(true); setSelectedMethod(method); }}
                    style={{
                      flex:1, display:'flex', alignItems:'center', gap:5, minWidth:0,
                      padding:'7px 8px', borderRadius:8,
                      border: `1.5px solid ${isSelected ? '#16a34a' : '#e2e8f0'}`,
                      background: isSelected ? '#f0fdf4' : '#fafafa',
                      color: isSelected ? '#15803d' : '#64748b',
                      cursor:'pointer', transition:'all 0.15s',
                    }}>
                    {/* radio dot */}
                    <div style={{
                      width:13, height:13, borderRadius:'50%', flexShrink:0,
                      border: `2px solid ${isSelected ? '#16a34a' : '#cbd5e1'}`,
                      background: isSelected ? '#16a34a' : '#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}>
                      {isSelected && <div style={{ width:5, height:5, borderRadius:'50%', background:'#fff' }} />}
                    </div>

                    {/* name + rate stacked, overflow safe */}
                    <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:0 }}>
                        <span style={{ fontSize:11, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {method}
                        </span>
                        {isAuto && (
                          <span style={{ fontSize:9, background: isSelected ? '#bbf7d0' : '#dcfce7', color:'#16a34a', borderRadius:3, padding:'1px 4px', fontWeight:700, flexShrink:0 }}>
                            AUTO
                          </span>
                        )}
                      </div>
                      {rate != null && (
                        <div style={{ fontSize:10, color: isSelected ? '#16a34a' : '#94a3b8', marginTop:1 }}>
                          {rate.toFixed(2)}% avg
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <ModuleNav
              forward={{
                label: 'Save & Continue to Water Demand',
                variant: 'save',
                disabled: !selectedMethod,
                onClick: () => {
                  const method = selectedMethodRef.current;
                  if (!method) return;
                  const forecastData = combinedChartDataRef.current[method];
                  setPopulationForecast(forecastData, method);

                  // Always ensure population2025 is in store — needed by SewageModule for scaling
                  const pop2025direct = forecastData[2025];
                  if (pop2025direct != null) {
                    setPopulation2025(Math.round(pop2025direct));
                  } else if (confirmedLocation) {
                    // Range didn't include 2025 → fetch it separately (async, non-blocking)
                    fetchPopulation2025(confirmedLocation, method).then((p) => {
                      if (p != null) setPopulation2025(Math.round(p));
                    });
                  }

                  setActiveModule('water_demand');
                },
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
