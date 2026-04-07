'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBasicStore } from '../shared/store/basic.store';
import {
  fetchDomesticWaterDemand,
  fetchFloatingWaterDemand,
  fetchInstitutionalWaterDemand,
  fetchFirefightingWaterDemand,
} from '../shared/services/waterDemand.service';
import { fetchWaterDemandThematic, type WDThematicParams } from '../shared/services/population.service';
import { Home, Users, Building2, Flame, Play, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import ModuleNav from '../shared/components/ModuleNav';

// ── Types ──────────────────────────────────────────────────────────────────
type WDMethod = 'domestic' | 'floating' | 'institutional' | 'firefighting';

function Spinner() {
  return (
    <svg style={{ animation:'spin 0.8s linear infinite', width:14, height:14 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

/* Portal tooltip — never clipped by overflow:hidden parents */
function Tip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <span
      ref={ref}
      onMouseEnter={() => ref.current && setRect(ref.current.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      style={{ display:'inline-flex', flexShrink:0, alignItems:'center', cursor:'help' }}
    >
      <Info size={11} color="#94a3b8" />
      {rect && createPortal(
        <div style={{
          position:'fixed', zIndex:99999, pointerEvents:'none',
          left: rect.left + rect.width / 2,
          top: rect.top - 8,
          transform: 'translate(-50%,-100%)',
          background:'#1e293b', color:'#f1f5f9',
          borderRadius:8, padding:'8px 12px',
          fontSize:11, lineHeight:1.55, width:220, whiteSpace:'normal',
          boxShadow:'0 6px 20px rgba(0,0,0,0.3)', textAlign:'left',
        }}>
          {text}
          <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', borderWidth:'5px 5px 0', borderStyle:'solid', borderColor:'#1e293b transparent transparent' }} />
        </div>,
        document.body,
      )}
    </span>
  );
}

const inputCls: React.CSSProperties = {
  width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px',
  fontSize:13, outline:'none', background:'#fff',
};

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div style={{ flex: half ? '0 0 calc(50% - 6px)' : '0 0 100%', minWidth:0 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Institutional fields config ───────────────────────────────────────────
const INST_PAIRS: Array<[string, string, string, string]> = [
  ['hospitals100Units','Hospitals ≥100 Beds (units)','beds100','Beds in Hospitals ≥100'],
  ['hospitalsLess100','Hospitals <100 Beds (units)','bedsLess100','Beds in Hospitals <100'],
  ['hotels','Hotels (units)','bedsHotels','Beds in Hotels'],
  ['hostels','Hostels (units)','residentsHostels','Residents in Hostels'],
  ['nursesHome','Nurses Home (units)','residentsNursesHome','Residents in Nurses Home'],
  ['boardingSchools','Boarding Schools (units)','studentsBoardingSchools','Students in Boarding Schools'],
  ['restaurants','Restaurants (units)','seatsRestaurants','Seats in Restaurants'],
  ['airportsSeaports','Airports/Seaports (units)','populationLoadAirports','Pop. Load Airports/Seaports'],
  ['junctionStations','Junction Stations (units)','populationLoadJunction','Pop. Load Junction Stations'],
  ['terminalStations','Terminal Stations (units)','populationLoadTerminal','Pop. Load Terminal Stations'],
  ['intermediateBathing','Intermediate Bathing (units)','populationLoadBathing','Pop. Load Intermediate Bathing'],
  ['intermediateNoBathing','Intermediate No Bathing (units)','populationLoadNoBathing','Pop. Load Intermediate No Bathing'],
  ['daySchools','Day Schools (units)','studentsDaySchools','Students in Day Schools'],
  ['offices','Offices (units)','employeesOffices','Employees in Offices'],
  ['factorieswashrooms','Factories w/ Washrooms (units)','employeesFactories','Employees in Factories (w/ Washrooms)'],
  ['factoriesnoWashrooms','Factories w/o Washrooms (units)','employeesFactoriesNoWashrooms','Employees in Factories (No Washrooms)'],
  ['cinemas','Cinemas (units)','populationLoadCinemas','Pop. Load Cinemas'],
];

const DEFAULT_INST_FIELDS = Object.fromEntries(INST_PAIRS.flatMap(([a,,b]) => [[a,'0'],[b,'0']]));
const FF_METHODS = ['Kuchling','Freeman','Buston','American_insurance','Ministry_urban'] as const;


const PC_PRESETS = [
  { value:'70',  label:'70 LPCD',
    desc:'Towns without sewerage',
    tip:'Recommended for towns that have piped water supply but no sewerage system (IS:1172 / CPHEEO). Lowest tier.' },
  { value:'135', label:'135 LPCD',
    desc:'Cities with sewerage',
    tip:'Standard for cities with piped water supply where a sewerage system exists or is planned. Most common benchmark for Indian cities per CPHEEO Manual.' },
  { value:'150', label:'150 LPCD',
    desc:'Metro & Mega cities',
    tip:'For Metropolitan and Mega cities with piped supply and existing sewerage. Highest tier per CPHEEO Manual on Water Supply & Treatment.' },
];

const WD_COMP_TIPS: Record<string,string> = {
  domestic:      'Water demand for the resident population based on per-capita consumption (LPCD) norms. Forms the base demand.',
  floating:      'Additional demand for transient/temporary population — visitors, migrant workers, pilgrims — expressed as a % of resident demand.',
  institutional: 'Demand from hospitals, schools, hotels, offices, factories and other institutions, calculated per-unit or as a total.',
  firefighting:  'Reserve storage required for fire suppression as per national firefighting formulae (Kuchling, Freeman, Buston, etc.).',
};

// ── Main WaterDemandModule ────────────────────────────────────────────────
export default function WaterDemandModule() {
  const {
    populationForecast,
    selectedPopMethod,
    setActiveModule,
    populationForecastVersion,
    setWaterDemandTotals,
    setWaterDemandReportData,
    confirmedLocation,
    setThematicMapData,
  } = useBasicStore();

  // Container width for responsive behaviour
  const containerRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(600);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(e => setCw(e[0].contentRect.width));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);
  const compact = cw < 420;

  // Which methods are checked
  const [checked, setChecked] = useState<Set<WDMethod>>(new Set(['domestic']));
  const toggleMethod = (m: WDMethod) =>
    setChecked((p) => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });

  // Per-method loading / results / errors
  const [loading, setLoading] = useState<Set<WDMethod>>(new Set());
  const [results, setResults] = useState<Partial<Record<WDMethod, any>>>({});
  const [errors, setErrors]   = useState<Partial<Record<WDMethod, string>>>({});

  // Track which forecast version results were computed for — clear if it changes
  const lastForecastVersion = useRef<number>(populationForecastVersion);
  const reportHashRef = useRef('');
  useEffect(() => {
    if (lastForecastVersion.current !== populationForecastVersion) {
      lastForecastVersion.current = populationForecastVersion;
      setResults({});
      setErrors({});
    }
  }, [populationForecastVersion]);

  // Domestic params
  const [perCapita, setPerCapita] = useState('135');
  const [seasonalMult, setSeasonalMult] = useState({ summer:1.10, monsoon:0.95, postMonsoon:1.00, winter:0.90 });

  // Floating params
  const [floatPct, setFloatPct] = useState('15');
  const [facilityType, setFacilityType] = useState<'provided'|'notprovided'|'onlypublic'>('provided');
  const [floatSeasonal, setFloatSeasonal] = useState({ summer:1.15, monsoon:1.25, postMonsoon:1.10, winter:0.85 });

  // Institutional params
  const [instMode, setInstMode] = useState<'manual'|'total'>('manual');
  const [instTotal, setInstTotal] = useState('');
  const [instFields, setInstFields] = useState<Record<string,string>>(DEFAULT_INST_FIELDS);

  // Firefighting params
  const [ffMethods, setFfMethods] = useState<Record<string,boolean>>(
    Object.fromEntries(FF_METHODS.map(m => [m, false]))
  );
  const [selectedFfMethod, setSelectedFfMethod] = useState('');

  // ── Convert populationForecast keys to strings for API ──────────────────
  const forecastStrKeys: Record<string,number> | null = populationForecast
    ? Object.fromEntries(Object.entries(populationForecast).map(([y,v]) => [String(y), v]))
    : null;

  // ── Run ──────────────────────────────────────────────────────────────────
  const isRunning = loading.size > 0;
  const noneChecked = checked.size === 0;

  const runMethod = async (method: WDMethod) => {
    if (!forecastStrKeys) return;
    setLoading(p => { const n = new Set(p); n.add(method); return n; });
    setErrors(e => ({ ...e, [method]: undefined }));
    try {
      let data: any;
      if (method === 'domestic') {
        data = await fetchDomesticWaterDemand({
          forecast_data: forecastStrKeys,
          per_capita_consumption: parseFloat(perCapita) || 135,
          seasonal_multipliers: seasonalMult,
        });
      } else if (method === 'floating') {
        data = await fetchFloatingWaterDemand({
          floating_population_percentage: parseFloat(floatPct) || 15,
          facility_type: facilityType,
          domestic_forecast: forecastStrKeys,
          seasonal_multipliers: floatSeasonal,
        });
      } else if (method === 'institutional') {
        if (instMode === 'total') {
          // Compute locally — scale base demand by pop growth
          const years = Object.keys(forecastStrKeys).sort();
          const baseYear = years[0];
          const baseVal = forecastStrKeys[baseYear];
          const totalDemand = parseFloat(instTotal) || 0;
          const result: Record<string,number> = {};
          years.forEach(y => { result[y] = baseVal ? totalDemand * (forecastStrKeys[y] / baseVal) : totalDemand; });
          data = result;
        } else {
          const numericFields = Object.fromEntries(
            Object.entries(instFields).map(([k,v]) => [k, parseFloat(v) || 0])
          );
          data = await fetchInstitutionalWaterDemand({
            institutional_fields: numericFields,
            domestic_forecast: forecastStrKeys,
          });
        }
      } else if (method === 'firefighting') {
        data = await fetchFirefightingWaterDemand({
          firefighting_methods: ffMethods,
          domestic_forecast: forecastStrKeys,
        });
        // Auto-select first method
        if (!selectedFfMethod && data && Object.keys(data).length > 0) {
          setSelectedFfMethod(Object.keys(data)[0]);
        }
      }
      setResults(r => ({ ...r, [method]: data }));
    } catch (e: any) {
      setErrors(err => ({ ...err, [method]: e.message }));
    } finally {
      setLoading(p => { const n = new Set(p); n.delete(method); return n; });
    }
  };

  const handleRun = () => {
    if (isRunning || noneChecked || !forecastStrKeys) return;
    checked.forEach(m => runMethod(m));
  };

  const hasAnyResult = Object.keys(results).length > 0;
  const years = forecastStrKeys ? Object.keys(forecastStrKeys).sort() : [];

  // ── Save per-year totals to store whenever results change ────────────────
  useEffect(() => {
    if (!hasAnyResult || years.length === 0) return;
    const totals: Record<number, number> = {};
    years.forEach((y) => {
      const yr = Number(y);
      const domVal   = (checked.has('domestic')      && results.domestic?.base_demand?.[yr])                              ?? null;
      const floatVal = (checked.has('floating')      && results.floating?.base_demand?.[yr])                              ?? null;
      const instVal  = (checked.has('institutional') && results.institutional?.[yr])                                      ?? null;
      const ffMethod = selectedFfMethod || (results.firefighting ? Object.keys(results.firefighting)[0] : null);
      const ffVal    = (checked.has('firefighting')  && ffMethod && results.firefighting?.[ffMethod]?.[yr])               ?? null;
      const vals = [domVal, floatVal, instVal, ffVal].filter((v): v is number => v !== null);
      totals[yr] = vals.reduce((s, v) => s + v, 0);
    });
    setWaterDemandTotals(totals);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selectedFfMethod, hasAnyResult]);

  // ── Fetch per-village water demand thematic map from backend ─────────────
  useEffect(() => {
    if (!hasAnyResult || !results.domestic || !confirmedLocation) return;
    const pc = parseFloat(perCapita) || 135;
    const sortedYears = years.map(Number).sort((a, b) => a - b);
    if (sortedYears.length === 0) return;

    const FACILITY_LPCD: Record<string, number> = { provided: 45, notprovided: 25, onlypublic: 15 };
    const wdParams: WDThematicParams = { per_capita_consumption: pc };

    if (checked.has('floating') && results.floating) {
      wdParams.floating_percentage = parseFloat(floatPct) || 15;
      wdParams.facility_lpcd = FACILITY_LPCD[facilityType] ?? 45;
    }
    if (checked.has('institutional') && results.institutional) {
      const d: Record<string, number> = {};
      for (const yr of years) d[yr] = results.institutional[Number(yr)] ?? 0;
      wdParams.inst_demand = d;
    }
    if (checked.has('firefighting') && results.firefighting) {
      const ffKey = selectedFfMethod || Object.keys(results.firefighting)[0];
      const ffData = ffKey ? results.firefighting[ffKey] : null;
      if (ffData) {
        const d: Record<string, number> = {};
        for (const yr of years) d[yr] = ffData[Number(yr)] ?? 0;
        wdParams.ff_demand = d;
      }
    }
    // total_population_2011 for all location modes (used to scale inst / ff per village)
    const locVillages: any[] =
      confirmedLocation.mode === 'admin'           ? (confirmedLocation as any).admin?.villages ?? []
      : confirmedLocation.mode === 'drain'         ? (confirmedLocation as any).drain?.villages ?? []
      : (confirmedLocation as any).indiaCatchment?.villages ?? [];
    if (locVillages.length) {
      wdParams.total_population_2011 = locVillages
        .reduce((s: number, v: any) => s + (parseFloat(v.population ?? '0') || 0), 0);
    }

    fetchWaterDemandThematic(
      confirmedLocation,
      { start_year: sortedYears[0], end_year: sortedYears[sortedYears.length - 1] },
      wdParams,
    ).then((villageData: Record<string, any>) => {
      if (!villageData || !Object.keys(villageData).length) return;
      // Merge into existing population GeoJSON (non-reactive snapshot)
      const tmd = useBasicStore.getState().thematicMapData;
      if (!tmd?.features?.length) return;
      const mergedFeatures = tmd.features.map((f: any) => {
        const code = String(f.properties?.village_code ?? '');
        const wd = villageData[code] ?? {};
        return { ...f, properties: { ...f.properties, ...wd } };
      });
      setThematicMapData({ ...tmd, features: mergedFeatures }, 'Domestic');
    }).catch(() => { /* silently ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, perCapita]);

  useEffect(() => {
    if (!hasAnyResult) {
      if (reportHashRef.current !== '') {
        reportHashRef.current = '';
        setWaterDemandReportData(null);
      }
      return;
    }
    const payload = {
      years,
      forecast: forecastStrKeys,
      checkedMethods: Array.from(checked),
      selectedFfMethod,
      results,
    };
    const nextHash = JSON.stringify(payload);
    if (nextHash !== reportHashRef.current) {
      reportHashRef.current = nextHash;
      setWaterDemandReportData(payload);
    }
  }, [
    hasAnyResult,
    years,
    forecastStrKeys,
    checked,
    selectedFfMethod,
    results,
    setWaterDemandReportData,
  ]);

  // ── SEASON TABLE HELPER ──────────────────────────────────────────────────
  function SeasonTable({ data, setter }: { data: Record<string,number>; setter: (v: any) => void }) {
    const seasons = [
      { key:'summer', label:'Summer (Apr–Jun)' },
      { key:'monsoon', label:'Monsoon (Jul–Sep)' },
      { key:'postMonsoon', label:'Post-Monsoon (Oct–Nov)' },
      { key:'winter', label:'Winter (Dec–Mar)' },
    ];
    return (
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'#f8fafc' }}>
            {['Season','Multiplier'].map(h => (
              <th key={h} style={{ border:'1px solid #e2e8f0', padding:'6px 10px', textAlign:'left', fontWeight:700, color:'#64748b' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {seasons.map(({ key, label }, i) => (
            <tr key={key} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
              <td style={{ border:'1px solid #e2e8f0', padding:'6px 10px', color:'#475569' }}>{label}</td>
              <td style={{ border:'1px solid #e2e8f0', padding:'4px 8px' }}>
                <input type="number" value={(data as any)[key]} step="0.01" min="0"
                  style={{ ...inputCls, width:80 }}
                  onChange={e => setter({ ...data, [key]: parseFloat(e.target.value) || 0 })}/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (!populationForecast || !forecastStrKeys) {
    return (
      <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>
        <Info size={32} style={{ margin:'0 auto 12px' }}/>
        <div style={{ fontSize:15, fontWeight:600, color:'#475569', marginBottom:6 }}>No Population Forecast Selected</div>
        <div style={{ fontSize:13 }}>Please run the Population module and click "Save &amp; Continue to Water Demand" first.</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ padding:compact?12:20, display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Forecast source banner ── */}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9,
        padding:'8px 14px', fontSize:compact?11:13, flexWrap:'wrap',
      }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', flexShrink:0 }}/>
        <span style={{ color:'#15803d', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          Using: <strong>{selectedPopMethod}</strong> — {years.length} yrs ({years[0]}–{years[years.length-1]})
        </span>
      </div>

      {/* ── Demand Components — compact single row ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:11, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'linear-gradient(135deg,#f8fafc,#f1f5f9)', borderBottom:'1px solid #e2e8f0' }}>
          <div style={{ width:3, height:18, background:'#0891b2', borderRadius:2, flexShrink:0 }} />
          <span style={{ fontSize:compact?10:11, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.04em' }}>
            Demand Components
          </span>
        </div>
        <div style={{ padding:'10px 12px' }}>
          <div style={{ display:'flex', gap:6 }}>
            {(['domestic','floating','institutional','firefighting'] as WDMethod[]).map((key) => {
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              const active = checked.has(key);
              return (
                <div key={key} onClick={() => !isRunning && toggleMethod(key)}
                  style={{
                    flex:1, display:'flex', alignItems:'center', gap:5, minWidth:0,
                    padding:'7px 8px', borderRadius:8,
                    border:`1.5px solid ${active ? '#94a3b8' : '#e2e8f0'}`,
                    background: active ? '#f1f5f9' : '#fafafa',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    transition:'all 0.15s',
                  }}>
                  {/* checkbox */}
                  <div style={{ width:13, height:13, borderRadius:4, flexShrink:0, border:`2px solid ${active?'#475569':'#cbd5e1'}`, background:active?'#475569':'#fff', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                    {active && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize:compact?10:11, fontWeight:700, color:active?'#1e293b':'#64748b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
                  <span onClick={e=>e.stopPropagation()} style={{ display:'flex', flexShrink:0 }}>
                    <Tip text={WD_COMP_TIPS[key]} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DOMESTIC params ── */}
      {checked.has('domestic') && (
        <ParamCard title="Domestic Parameters" color="#2563eb" bg="#eff6ff" border="#bfdbfe"  loading={loading.has('domestic')}>
          {/* Per-capita presets */}
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Per Capita Consumption (LPCD)
              </span>
              <Tip text="Litres Per Capita per Day (LPCD) — the benchmark water supply norm per person per day, as per CPHEEO Manual on Water Supply & Treatment. Select a preset or enter a custom value." />
            </div>
            {/* Three standard preset cards */}
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {PC_PRESETS.map(({ value, label, desc, tip }) => {
                const sel = perCapita === value;
                return (
                  <div key={value} onClick={() => setPerCapita(value)}
                    style={{
                      flex:1, display:'flex', flexDirection:'column', gap:3, minWidth:0,
                      padding:'8px 8px 7px', borderRadius:9, cursor:'pointer',
                      border:`1.5px solid ${sel?'#2563eb':'#e2e8f0'}`,
                      background: sel ? '#eff6ff' : '#fafafa',
                      transition:'all 0.15s',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                      <span style={{ fontSize:compact?13:15, fontWeight:800, color:sel?'#2563eb':'#374151', lineHeight:1 }}>
                        {label}
                      </span>
                      <span onClick={e=>e.stopPropagation()} style={{ display:'flex', flexShrink:0 }}>
                        <Tip text={tip} />
                      </span>
                    </div>
                    <span style={{ fontSize:9, color:sel?'#3b82f6':'#94a3b8', fontWeight:600, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {desc}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Custom input */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'#64748b', fontWeight:600, whiteSpace:'nowrap' }}>Custom:</span>
              <input type="number" value={perCapita}
                onChange={e => setPerCapita(e.target.value)}
                style={{ ...inputCls, maxWidth:120 }} min="0" placeholder="e.g. 100"/>
              <span style={{ fontSize:11, color:'#94a3b8' }}>LPCD</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Seasonal Multipliers</div>
            <SeasonTable data={seasonalMult} setter={setSeasonalMult}/>
          </div>
        </ParamCard>
      )}

      {/* ── FLOATING params ── */}
      {checked.has('floating') && (
        <ParamCard title="Floating Population Parameters" color="#0891b2" bg="#ecfeff" border="#a5f3fc" icon={<Users size={15}/>} loading={loading.has('floating')}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
            <Field label="Floating Population %" half>
              <input type="number" value={floatPct} onChange={e => setFloatPct(e.target.value)} style={inputCls} min="0" max="100"/>
            </Field>
            <Field label="Facility Type" half>
              <select value={facilityType} onChange={e => setFacilityType(e.target.value as any)} style={inputCls}>
                <option value="provided">Bathing Facilities Provided</option>
                <option value="notprovided">Bathing Facilities Not Provided</option>
                <option value="onlypublic">Only Public Facilities</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#64748b', marginBottom:6 }}>Seasonal Multipliers</div>
            <SeasonTable data={floatSeasonal} setter={setFloatSeasonal}/>
          </div>
        </ParamCard>
      )}

      {/* ── INSTITUTIONAL params ── */}
      {checked.has('institutional') && (
        <ParamCard title="Institutional Parameters" color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" icon={<Building2 size={15}/>} loading={loading.has('institutional')}>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            {(['manual','total'] as const).map(m => (
              <label key={m} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, fontWeight:600, color: instMode===m ? '#7c3aed' : '#64748b' }}>
                <input type="radio" checked={instMode===m} onChange={() => setInstMode(m)} style={{ accentColor:'#7c3aed' }}/>
                {m === 'manual' ? 'Enter Individual Fields' : 'Enter Total Demand (MLD)'}
              </label>
            ))}
          </div>
          {instMode === 'total' ? (
            <Field label="Total Institutional Demand (MLD)">
              <input type="number" value={instTotal} onChange={e => setInstTotal(e.target.value)} style={inputCls} min="0" placeholder="e.g. 2.5"/>
            </Field>
          ) : (
            <div style={{ maxHeight:320, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:8, padding:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {INST_PAIRS.flatMap(([aKey, aLabel, bKey, bLabel]) => [
                  <Field key={aKey} label={aLabel}>
                    <input type="number" value={instFields[aKey]||'0'} onChange={e => setInstFields(f => ({...f,[aKey]:e.target.value}))} style={inputCls} min="0"/>
                  </Field>,
                  <Field key={bKey} label={bLabel}>
                    <input type="number" value={instFields[bKey]||'0'} onChange={e => setInstFields(f => ({...f,[bKey]:e.target.value}))} style={inputCls} min="0"/>
                  </Field>,
                ])}
              </div>
            </div>
          )}
        </ParamCard>
      )}

      {/* ── FIREFIGHTING params ── */}
      {checked.has('firefighting') && (
        <ParamCard title="Firefighting Parameters" color="#475569" bg="#f1f5f9" border="#cbd5e1" icon={<Flame size={15}/>} loading={loading.has('firefighting')}>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Select Calculation Methods</span>
            <Tip text="Each method is a nationally recognised approach to estimate the water volume required for fire suppression. Select one or more — results appear side-by-side so you can compare and pick the right reserve for your city type. Kuchling and Freeman suit small to medium towns; Buston follows UK standards; American Insurance is used for high-risk commercial zones; Ministry Urban follows India MoUD guidelines." />
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {FF_METHODS.map(m => {
              const active = ffMethods[m];
              return (
                <label key={m} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', borderRadius:8, border:`1.5px solid ${active?'#94a3b8':'#e2e8f0'}`, background:active?'#f1f5f9':'#fafafa', cursor:'pointer', flex:'1 1 auto', minWidth:0 }}>
                  <input type="checkbox" checked={active} onChange={e => setFfMethods(f => ({...f,[m]:e.target.checked}))} style={{ accentColor:'#475569', flexShrink:0 }}/>
                  <span style={{ fontSize:11, fontWeight:600, color:active?'#1e293b':'#64748b', whiteSpace:'nowrap' }}>{m.replace(/_/g,' ')}</span>
                </label>
              );
            })}
          </div>
        </ParamCard>
      )}

      {/* ── RUN BUTTON ── */}
      <button type="button" disabled={isRunning || noneChecked} onClick={handleRun}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          padding:'12px 24px', borderRadius:10, border:'none', fontSize:14, fontWeight:700,
          background: isRunning || noneChecked ? '#e2e8f0' : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
          color: isRunning || noneChecked ? '#94a3b8' : '#fff',
          cursor: isRunning || noneChecked ? 'not-allowed' : 'pointer',
          boxShadow: isRunning || noneChecked ? 'none' : '0 4px 12px rgba(8,145,178,0.3)',
          transition:'all 0.2s',
        }}>
        {isRunning ? <><Spinner/> Calculating…</> : <><Play size={15} fill="white"/> Calculate Water Demand</>}
      </button>

      {/* ── RESULTS ── */}
      {hasAnyResult && (
        <ResultsTable
          years={years}
          forecast={forecastStrKeys}
          domestic={results.domestic}
          floating={results.floating}
          institutional={results.institutional}
          firefighting={results.firefighting}
          checkedMethods={checked}
          selectedFfMethod={selectedFfMethod}
          setSelectedFfMethod={setSelectedFfMethod}
        />
      )}

      {/* ── Error cards ── */}
      {(['domestic','floating','institutional','firefighting'] as WDMethod[]).filter(m => errors[m]).map(m => (
        <div key={m} style={{ display:'flex', gap:8, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#b91c1c' }}>
          <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }}/> {errors[m]}
        </div>
      ))}

      <ModuleNav
        back={{ label: 'Population', onClick: () => setActiveModule('population') }}
        forward={hasAnyResult ? {
          label: 'Continue to Water Supply',
          variant: 'next',
          onClick: () => setActiveModule('water_supply'),
        } : undefined}
      />

    </div>
  );
}

// ── ParamCard ─────────────────────────────────────────────────────────────
function ParamCard({ title, color, bg, border,  loading, children }: {
  title: string; color: string; bg: string; border: string;
  icon?: React.ReactNode; loading: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background:'#fff', border:`1px solid ${border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:bg, borderBottom: open ? `1px solid ${border}` : 'none', cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:4, height:24, background:color, borderRadius:2 }}/>
        <span style={{ color, flexShrink:0 }}></span>
        <span style={{ fontSize:13, fontWeight:800, color:'#1e293b', flex:1 }}>{title}</span>
        {loading && <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color, fontWeight:600 }}><Spinner/> Running…</span>}
        {open ? <ChevronUp size={14} color="#94a3b8"/> : <ChevronDown size={14} color="#94a3b8"/>}
      </div>
      {open && <div style={{ padding:'16px 20px' }}>{children}</div>}
    </div>
  );
}

// ── Seasonal Table ─────────────────────────────────────────────────────────
function SeasonalDemandTable({
  title, color, bg, border, seasonalDemands, years,
}: {
  title: string; color: string; bg: string; border: string;
  seasonalDemands: Record<string, Record<string, number>>;
  years: string[];
}) {
  const seasons = Object.keys(seasonalDemands);
  if (!seasons.length) return null;
  const SEASON_LABELS: Record<string, string> = {
    summer: 'Summer (Apr–Jun)',
    monsoon: 'Monsoon (Jul–Sep)',
    postMonsoon: 'Post-Monsoon (Oct–Nov)',
    winter: 'Winter (Dec–Mar)',
  };
  return (
    <div style={{ background:'#fff', border:`1px solid ${border}`, borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 18px', background:bg, borderBottom:`1px solid ${border}` }}>
        <div style={{ width:4, height:20, background:color, borderRadius:2 }}/>
        <span style={{ fontSize:13, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.02em' }}>
          {title} — Seasonal Demand
        </span>
      </div>
      <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:360 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead style={{ position:'sticky', top:0, zIndex:10 }}>
            <tr style={{ background:'#f8fafc' }}>
              <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'left', fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>Year</th>
              {seasons.map(s => (
                <th key={s} style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color, whiteSpace:'nowrap' }}>
                  {SEASON_LABELS[s] ?? s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year, i) => (
              <tr key={year} style={{ background: i%2 ? '#f8fafc' : '#fff' }}>
                <td style={{ border:'1px solid #f1f5f9', padding:'7px 12px', fontWeight:600, color:'#475569' }}>{year}</td>
                {seasons.map(s => {
                  const val = seasonalDemands[s]?.[year];
                  return (
                    <td key={s} style={{ border:'1px solid #f1f5f9', padding:'7px 12px', textAlign:'right', color:'#374151' }}>
                      {val != null ? Number(val).toFixed(3) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Results Table ─────────────────────────────────────────────────────────
function ResultsTable({ years, forecast, domestic, floating, institutional, firefighting, checkedMethods, selectedFfMethod, setSelectedFfMethod }: {
  years: string[]; forecast: Record<string,number>;
  domestic: any; floating: any; institutional: any; firefighting: any;
  checkedMethods: Set<WDMethod>; selectedFfMethod: string; setSelectedFfMethod: (v:string)=>void;
}) {
  const ffKeys = firefighting ? Object.keys(firefighting) : [];
  // Count how many methods actually have results
  const activeResultCount = [
    checkedMethods.has('domestic') && !!domestic,
    checkedMethods.has('floating') && !!floating,
    checkedMethods.has('institutional') && !!institutional,
    checkedMethods.has('firefighting') && !!firefighting,
  ].filter(Boolean).length;
  const showTotal = activeResultCount >= 2;
  const activeFf = selectedFfMethod || ffKeys[0] || '';

  const cols = [
    checkedMethods.has('domestic') && domestic,
    checkedMethods.has('floating') && floating,
    checkedMethods.has('institutional') && institutional,
    checkedMethods.has('firefighting') && firefighting && activeFf,
  ].filter(Boolean);
  if (!cols.length) return null;

  // Safe number formatter — handles strings returned by API
  const n = (v: any): number | null => {
    if (v == null) return null;
    const num = Number(v);
    return isNaN(num) ? null : num;
  };
  const fmt = (v: any) => { const num = n(v); return num == null ? '—' : num.toFixed(3); };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* ── Main summary table ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom:'1px solid #e2e8f0' }}>
          <div style={{ width:3, height:18, background:'#0891b2', borderRadius:2, flexShrink:0 }}/>
          <span style={{ fontSize:12, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.04em' }}>
            Water Demand Results
          </span>
          <Tip text="Summary of projected water demand (in Million Litres per Day) for each forecast year, broken down by component. All values are annual averages — use seasonal tables below for peak/dry-season values." />
        </div>

        {/* Firefighting method selector */}
        {firefighting && ffKeys.length > 1 && (
          <div style={{ padding:'10px 18px', borderBottom:'1px solid #f1f5f9', background:'#fef2f2', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#dc2626' }}>Firefighting method for totals:</span>
            {ffKeys.map(k => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', fontWeight:600, color: activeFf===k ? '#dc2626' : '#64748b' }}>
                <input type="radio" checked={activeFf===k} onChange={() => setSelectedFfMethod(k)} style={{ accentColor:'#dc2626' }}/>
                {k.replace(/_/g,' ')}
              </label>
            ))}
          </div>
        )}

        <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:420 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead style={{ position:'sticky', top:0, zIndex:10 }}>
              <tr style={{ background:'#f8fafc' }}>
                <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'left',  fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>Year</th>
                <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>Population</th>
                {checkedMethods.has('domestic')      && domestic      && <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#2563eb', whiteSpace:'nowrap' }}>Domestic (MLD)</th>}
                {checkedMethods.has('floating')      && floating      && <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#0891b2', whiteSpace:'nowrap' }}>Floating (MLD)</th>}
                {checkedMethods.has('institutional') && institutional && <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#7c3aed', whiteSpace:'nowrap' }}>Institutional (MLD)</th>}
                {checkedMethods.has('firefighting')  && firefighting && activeFf && <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:700, color:'#dc2626', whiteSpace:'nowrap' }}>FF · {activeFf.replace(/_/g,' ')} (MLD)</th>}
                {showTotal && <th style={{ border:'1px solid #e2e8f0', padding:'8px 12px', textAlign:'right', fontWeight:800, color:'#0f172a', whiteSpace:'nowrap', background:'#eff6ff' }}>Total (MLD)</th>}
              </tr>
            </thead>
            <tbody>
              {years.map((year, i) => {
                const domVal   = n(checkedMethods.has('domestic')      ? domestic?.base_demand?.[year]          : null);
                const floatVal = n(checkedMethods.has('floating')      ? floating?.base_demand?.[year]          : null);
                const instVal  = n(checkedMethods.has('institutional') ? institutional?.[year]                  : null);
                const ffVal    = n(checkedMethods.has('firefighting') && activeFf ? firefighting?.[activeFf]?.[year] : null);
                const vals = [domVal, floatVal, instVal, ffVal].filter((v): v is number => v !== null);
                const total = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
                return (
                  <tr key={year} style={{ background: i%2 ? '#f8fafc' : '#fff' }}>
                    <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', fontWeight:600, color:'#475569' }}>{year}</td>
                    <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', color:'#64748b' }}>{(forecast[year]||0).toLocaleString()}</td>
                    {checkedMethods.has('domestic')      && domestic      && <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', color:'#2563eb' }}>{fmt(domestic?.base_demand?.[year])}</td>}
                    {checkedMethods.has('floating')      && floating      && <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', color:'#0891b2' }}>{fmt(floating?.base_demand?.[year])}</td>}
                    {checkedMethods.has('institutional') && institutional && <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', color:'#7c3aed' }}>{fmt(institutional?.[year])}</td>}
                    {checkedMethods.has('firefighting')  && firefighting && activeFf && <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', color:'#dc2626' }}>{fmt(firefighting?.[activeFf]?.[year])}</td>}
                    {showTotal && <td style={{ border:'1px solid #f1f5f9', padding:'7px 14px', textAlign:'right', fontWeight:700, color:'#0f172a', background:'#eff6ff' }}>{total != null ? total.toFixed(3) : '—'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Domestic seasonal table ── */}
      {checkedMethods.has('domestic') && domestic?.seasonal_demands && (
        <SeasonalDemandTable
          title="Domestic" color="#2563eb" bg="#eff6ff" border="#bfdbfe"
          seasonalDemands={domestic.seasonal_demands}
          years={years}
        />
      )}

      {/* ── Floating seasonal table ── */}
      {checkedMethods.has('floating') && floating?.seasonal_demands && (
        <SeasonalDemandTable
          title="Floating" color="#0891b2" bg="#ecfeff" border="#a5f3fc"
          seasonalDemands={floating.seasonal_demands}
          years={years}
        />
      )}
    </div>
  );
}
