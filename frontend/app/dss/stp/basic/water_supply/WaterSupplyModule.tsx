'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBasicStore } from '../shared/store/basic.store';
import { fetchWaterSupplyThematic } from '../shared/services/population.service';
import { API_BASE_URL } from '../shared/utils/constants';
import {
  Waves, Wind, Recycle, AlertCircle, ChevronDown, ChevronUp,
  CheckCircle2, TrendingUp, TrendingDown, Minus, Info,
} from 'lucide-react';
import ModuleNav from '../shared/components/ModuleNav';

/* ── Portal Tooltip ───────────────────────────────────────────── */
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
          left: rect.left + rect.width / 2, top: rect.top - 8,
          transform:'translate(-50%,-100%)',
          background:'#1e293b', color:'#f1f5f9',
          borderRadius:8, padding:'8px 12px',
          fontSize:11, lineHeight:1.55, width:220, whiteSpace:'normal',
          boxShadow:'0 6px 20px rgba(0,0,0,0.3)', textAlign:'left',
        }}>
          {text}
          <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', borderWidth:'5px 5px 0', borderStyle:'solid', borderColor:'#1e293b transparent transparent' }}/>
        </div>,
        document.body,
      )}
    </span>
  );
}

/* ── Spinner ──────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg style={{ animation:'spin 0.8s linear infinite', width:13, height:13 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

/* ── Field label + optional tooltip ──────────────────────────── */
function Field({ label, unit, hint, tip, children }: {
  label: string; unit?: string; hint?: string; tip?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:4 }}>
        <span>{label}</span>
        {unit && <span style={{ fontWeight:400, color:'#cbd5e1', textTransform:'none' }}>({unit})</span>}
        {tip && <Tip text={tip} />}
      </div>
      {children}
      {hint && <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{hint}</div>}
    </div>
  );
}

/* ── Collapsible Section ──────────────────────────────────────── */
function Section({
  title, icon, color, bg, border, tip, children, open, onToggle,
}: {
  title: string; icon: React.ReactNode; color: string; bg: string; border: string;
  tip?: string; children: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:10, overflow:'hidden' }}>
      <div onClick={onToggle} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', background:bg, cursor:'pointer', userSelect:'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{title}</span>
          {tip && <span onClick={e => e.stopPropagation()}><Tip text={tip} /></span>}
        </div>
        <span style={{ color:'#94a3b8' }}>{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
      </div>
      {open && (
        <div style={{ padding:'12px 14px', background:'#fff', display:'flex', flexDirection:'column', gap:10 }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── OR divider ───────────────────────────────────────────────── */
function OrDivider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, margin:'2px 0' }}>
      <div style={{ flex:1, height:1, background:'#e2e8f0' }}/>
      <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>OR</span>
      <div style={{ flex:1, height:1, background:'#e2e8f0' }}/>
    </div>
  );
}

const inp = (disabled?: boolean): React.CSSProperties => ({
  width:'100%', boxSizing:'border-box',
  border:`1px solid ${disabled ? '#f1f5f9' : '#e2e8f0'}`,
  borderRadius:7, padding:'5px 9px',
  fontSize:12, outline:'none',
  background: disabled ? '#f8fafc' : '#fff',
  color: disabled ? '#cbd5e1' : '#1e293b',
  cursor: disabled ? 'not-allowed' : 'text',
});

/* ═══════════════════════════════════════════════════════════════ */
export default function WaterSupplyModule() {
  const {
    setActiveModule, waterDemandTotals, setWaterSupplyTotal, setWaterSupplyReportData,
    confirmedLocation, populationForecast, setThematicMapData,
  } = useBasicStore();
  const reportHashRef = useRef('');

  /* ResizeObserver */
  const containerRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(600);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(e => setCw(e[0].contentRect.width));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);
  const compact = cw < 420;

  /* State */
  const [surfaceWater, setSurfaceWater]     = useState('');
  const [directGW, setDirectGW]             = useState('');
  const [numTubewells, setNumTubewells]     = useState('');
  const [dischargeRate, setDischargeRate]   = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [directAlt, setDirectAlt]           = useState('');
  const [rooftopTank, setRooftopTank]       = useState('');
  const [aquiferRecharge, setAquiferRecharge] = useState('');
  const [surfaceRunoff, setSurfaceRunoff]   = useState('');
  const [reuseWater, setReuseWater]         = useState('');

  const [openSections, setOpenSections] = useState({ surface:true, ground:true, alternate:true });
  const toggle = (k: keyof typeof openSections) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ total_supply: number } | null>(null);
  const [error, setError]     = useState<string | null>(null);

  /* Conflict detection */
  const isDirectGWFilled  = directGW !== '';
  const isTubeWellFilled  = numTubewells !== '' || dischargeRate !== '' || operatingHours !== '';
  const isDirectAltFilled = directAlt !== '';
  const isAltCompFilled   = rooftopTank !== '' || aquiferRecharge !== '' || surfaceRunoff !== '' || reuseWater !== '';

  /* Computed previews */
  const gwComputed =
    !isDirectGWFilled && isTubeWellFilled
      ? (parseFloat(numTubewells)||0) * (parseFloat(dischargeRate)||0) * (parseFloat(operatingHours)||0)
      : null;
  const altComputed =
    !isDirectAltFilled && isAltCompFilled
      ? (parseFloat(rooftopTank)||0) + (parseFloat(aquiferRecharge)||0) +
        (parseFloat(surfaceRunoff)||0) + (parseFloat(reuseWater)||0)
      : null;

  const handleCalculate = async () => {
    setLoading(true); setError(null);
    try {
      const payload = {
        surface_water:      parseFloat(surfaceWater)    || 0,
        direct_groundwater: isDirectGWFilled  ? (parseFloat(directGW)  || 0) : null,
        num_tubewells:      !isDirectGWFilled ? (parseFloat(numTubewells)  || 0) : 0,
        discharge_rate:     !isDirectGWFilled ? (parseFloat(dischargeRate) || 0) : 0,
        operating_hours:    !isDirectGWFilled ? (parseFloat(operatingHours)|| 0) : 0,
        direct_alternate:   isDirectAltFilled ? (parseFloat(directAlt) || 0) : null,
        rooftop_tank:       !isDirectAltFilled ? (parseFloat(rooftopTank)     || 0) : 0,
        aquifer_recharge:   !isDirectAltFilled ? (parseFloat(aquiferRecharge) || 0) : 0,
        surface_runoff:     !isDirectAltFilled ? (parseFloat(surfaceRunoff)   || 0) : 0,
        reuse_water:        !isDirectAltFilled ? (parseFloat(reuseWater)      || 0) : 0,
      };
      const res = await fetch(`${API_BASE_URL}/basic/water_supply`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? 'API error');
      }
      const data = await res.json();
      setResult(data);
      setWaterSupplyTotal(data.total_supply);

      if (confirmedLocation && populationForecast) {
        const sortedYears = Object.keys(populationForecast).map(Number).sort((a,b) => a-b);
        const demandByYear: Record<string,number> = {};
        const totals = useBasicStore.getState().waterDemandTotals ?? {};
        for (const yr of sortedYears) demandByYear[String(yr)] = totals[yr] ?? 0;
        fetchWaterSupplyThematic(
          confirmedLocation,
          { start_year: sortedYears[0], end_year: sortedYears[sortedYears.length-1] },
          data.total_supply, demandByYear,
        ).then((villageData: Record<string,any>) => {
          if (!villageData || !Object.keys(villageData).length) return;
          const tmd = useBasicStore.getState().thematicMapData;
          if (!tmd?.features?.length) return;
          const mergedFeatures = tmd.features.map((f: any) => {
            const code = String(f.properties?.village_code ?? '');
            return { ...f, properties: { ...f.properties, ...(villageData[code] ?? {}) } };
          });
          setThematicMapData({ ...tmd, features: mergedFeatures }, 'Water Supply');
        }).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* Derived gap data */
  const gapRows = result && waterDemandTotals
    ? Object.keys(waterDemandTotals).map(Number).sort((a,b) => a-b).map(yr => ({
        year: yr,
        supply: result.total_supply,
        demand: waterDemandTotals[yr],
        gap: result.total_supply - waterDemandTotals[yr],
      }))
    : null;

  const gwVal  = isDirectGWFilled  ? (parseFloat(directGW)||0)  : (gwComputed??0);
  const altVal = isDirectAltFilled ? (parseFloat(directAlt)||0) : (altComputed??0);

  useEffect(() => {
    if (!result) {
      if (reportHashRef.current !== '') { reportHashRef.current = ''; setWaterSupplyReportData(null); }
      return;
    }
    const payload = {
      inputs: { surfaceWater, directGW, numTubewells, dischargeRate, operatingHours, directAlt, rooftopTank, aquiferRecharge, surfaceRunoff, reuseWater },
      computed: { gwComputed, altComputed },
      result, gapRows,
    };
    const nextHash = JSON.stringify(payload);
    if (nextHash !== reportHashRef.current) { reportHashRef.current = nextHash; setWaterSupplyReportData(payload); }
  }, [result, surfaceWater, directGW, numTubewells, dischargeRate, operatingHours, directAlt, rooftopTank, aquiferRecharge, surfaceRunoff, reuseWater, gwComputed, altComputed, gapRows, setWaterSupplyReportData]);

  /* ── Result source rows ── */
  const sourceRows = [
    {
      label: 'Surface Water',
      value: parseFloat(surfaceWater)||0,
      color:'#0369a1',
      tip: 'Water drawn directly from surface bodies — rivers, lakes, reservoirs, canals. Treated before distribution.',
    },
    {
      label: isDirectGWFilled ? 'Groundwater (Direct)' : 'Groundwater (Tubewells)',
      value: gwVal,
      color:'#0891b2',
      tip: 'Water extracted from below the ground surface via bore wells, tube wells or open wells. Requires pumping and treatment.',
    },
    {
      label: isDirectAltFilled ? 'Alternate Supply (Direct)' : 'Alternate Supply (Components)',
      value: altVal,
      color:'#059669',
      tip: 'Non-conventional sources — rainwater harvesting, aquifer recharge, surface runoff storage, and treated wastewater reuse. Supplements primary supply.',
    },
  ];

  return (
    <div ref={containerRef} style={{ padding:compact?12:18, display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Surface Water ── */}
      <Section title="Surface Water Supply (SWS)" icon={<Waves size={14}/>}
        color="#0369a1" bg="#f0f9ff" border="#bae6fd"
        tip="Water sourced from rivers, lakes, reservoirs and canals. Enter the total daily intake in MLD after accounting for treatment losses."
        open={openSections.surface} onToggle={() => toggle('surface')}>
        <div style={{ display:'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap:10 }}>
          <Field label="Surface Water Supply" unit="MLD"
            tip="Total volume of water abstracted daily from surface bodies (rivers, lakes, reservoirs) in Million Litres per Day.">
            <input style={inp()} type="number" min="0" placeholder="e.g. 5.2"
              value={surfaceWater} onChange={e => setSurfaceWater(e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* ── Groundwater ── */}
      <Section title="Groundwater Supply (GWS)" icon={<Wind size={14}/>}
        color="#0891b2" bg="#ecfeff" border="#a5f3fc"
        tip="Water extracted from underground aquifers via bore wells or tube wells. Enter either the total MLD directly, or compute it from individual tubewell parameters."
        open={openSections.ground} onToggle={() => toggle('ground')}>

        <Field label="Direct Groundwater Supply" unit="MLD"
          tip="Total groundwater supply if you already know the aggregate MLD. Filling this disables the tubewell calculator below.">
          <input style={inp(isTubeWellFilled)} type="number" min="0"
            placeholder={isTubeWellFilled ? 'Disabled — using tubewell calc' : 'e.g. 3.5'}
            value={directGW} disabled={isTubeWellFilled}
            onChange={e => setDirectGW(e.target.value)} />
        </Field>

        <OrDivider/>

        <div style={{ display:'grid', gridTemplateColumns: compact ? '1fr 1fr' : '1fr 1fr 1fr', gap:8 }}>
          <Field label="No. of Tubewells"
            tip="Total count of operational tube wells or bore wells supplying the area.">
            <input style={inp(isDirectGWFilled)} type="number" min="0" placeholder="e.g. 10"
              value={numTubewells} disabled={isDirectGWFilled}
              onChange={e => setNumTubewells(e.target.value)} />
          </Field>
          <Field label="Discharge Rate" unit="lt/hr"
            tip="Average water output per tubewell per hour in litres.">
            <input style={inp(isDirectGWFilled)} type="number" min="0" placeholder="e.g. 5000"
              value={dischargeRate} disabled={isDirectGWFilled}
              onChange={e => setDischargeRate(e.target.value)} />
          </Field>
          <Field label="Operating Hours" unit="hrs/day"
            hint="All 3 required"
            tip="Average number of hours each tubewell operates per day.">
            <input style={inp(isDirectGWFilled)} type="number" min="0" placeholder="e.g. 8"
              value={operatingHours} disabled={isDirectGWFilled}
              onChange={e => setOperatingHours(e.target.value)} />
          </Field>
        </div>
        {gwComputed !== null && (
          <div style={{ fontSize:11, color:'#0891b2', background:'#ecfeff', borderRadius:6, padding:'5px 10px', border:'1px solid #a5f3fc' }}>
            Computed: <strong>{gwComputed.toFixed(3)} MLD</strong>
            <span style={{ color:'#94a3b8', marginLeft:6 }}>({numTubewells||0} wells × {dischargeRate||0} lt/hr × {operatingHours||0} hrs)</span>
          </div>
        )}
      </Section>

      {/* ── Alternate Supply ── */}
      <Section title="Alternate Water Supply (AWS)" icon={<Recycle size={14}/>}
        color="#059669" bg="#f0fdf4" border="#86efac"
        tip="Non-conventional water sources that supplement the primary supply — rainwater harvesting, treated wastewater reuse, aquifer recharge and surface runoff storage."
        open={openSections.alternate} onToggle={() => toggle('alternate')}>

        <Field label="Direct Alternate Water Supply" unit="MLD"
          tip="If you know the total alternate supply volume, enter it here. Filling this disables the individual component fields below.">
          <input style={inp(isAltCompFilled)} type="number" min="0"
            placeholder={isAltCompFilled ? 'Disabled — using components' : 'e.g. 1.2'}
            value={directAlt} disabled={isAltCompFilled}
            onChange={e => setDirectAlt(e.target.value)} />
        </Field>

        <OrDivider/>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <Field label="Rooftop Rainwater Tank" unit="MLD"
            tip="Water harvested from rooftop rainwater collection systems, stored in tanks for potable or non-potable use.">
            <input style={inp(isDirectAltFilled)} type="number" min="0" placeholder="0"
              value={rooftopTank} disabled={isDirectAltFilled}
              onChange={e => setRooftopTank(e.target.value)} />
          </Field>
          <Field label="Aquifer Recharge" unit="MLD"
            tip="Water artificially recharged into the aquifer and later recovered for supply — managed aquifer recharge (MAR).">
            <input style={inp(isDirectAltFilled)} type="number" min="0" placeholder="0"
              value={aquiferRecharge} disabled={isDirectAltFilled}
              onChange={e => setAquiferRecharge(e.target.value)} />
          </Field>
          <Field label="Surface Runoff Storage" unit="MLD"
            tip="Rainwater runoff captured from paved/open surfaces, stored in ponds or tanks for subsequent use.">
            <input style={inp(isDirectAltFilled)} type="number" min="0" placeholder="0"
              value={surfaceRunoff} disabled={isDirectAltFilled}
              onChange={e => setSurfaceRunoff(e.target.value)} />
          </Field>
          <Field label="Reuse of Treated Wastewater" unit="MLD"
            tip="Tertiary-treated wastewater recycled for irrigation, industrial cooling or dual-pipe potable reuse schemes.">
            <input style={inp(isDirectAltFilled)} type="number" min="0" placeholder="0"
              value={reuseWater} disabled={isDirectAltFilled}
              onChange={e => setReuseWater(e.target.value)} />
          </Field>
        </div>
        {altComputed !== null && (
          <div style={{ fontSize:11, color:'#059669', background:'#f0fdf4', borderRadius:6, padding:'5px 10px', border:'1px solid #86efac' }}>
            Computed total: <strong>{altComputed.toFixed(3)} MLD</strong>
          </div>
        )}
      </Section>

      {/* ── Calculate button ── */}
      <button type="button" onClick={handleCalculate} disabled={loading}
        style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          padding:'10px 24px', borderRadius:9, border:'none', alignSelf:'stretch',
          background: loading ? '#e2e8f0' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
          color: loading ? '#94a3b8' : '#fff',
          fontSize:13, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 3px 10px rgba(37,99,235,0.3)', transition:'all 0.2s',
        }}>
        {loading ? <><Spinner/> Calculating…</> : 'Calculate Water Supply'}
      </button>

      {/* ── Error ── */}
      {error && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'10px 14px' }}>
          <AlertCircle size={14} color="#ef4444" style={{ flexShrink:0, marginTop:1 }}/>
          <span style={{ fontSize:12, color:'#b91c1c' }}>{error}</span>
        </div>
      )}

      {/* ── Placeholder (before result) ── */}
      {!result && !loading && (
        <div style={{ border:'1px dashed #cbd5e1', borderRadius:10, padding:'18px 16px', background:'#f8fafc', display:'flex', flexDirection:'column', gap:8, alignItems:'center', textAlign:'center' }}>
          <CheckCircle2 size={28} color="#cbd5e1"/>
          <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8' }}>Water Supply Result</div>
          <div style={{ fontSize:11, color:'#94a3b8', maxWidth:320, lineHeight:1.6 }}>
            After you click <strong>Calculate</strong>, the result card will show the <strong>Total Available Supply (MLD)</strong> — a breakdown of Surface Water, Groundwater and Alternate sources — and a year-wise gap analysis comparing supply against projected demand.
          </div>
        </div>
      )}

      {/* ── Result breakdown ── */}
      {result && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:11, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          {/* Header */}
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
            background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom:'1px solid #86efac',
          }}>
            <CheckCircle2 size={16} color="#16a34a"/>
            <span style={{ fontSize:12, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Water Supply Result
            </span>
            <Tip text="Total water available from all sources combined. This is compared against the projected demand to determine the supply-demand gap for each forecast year." />
          </div>

          <div style={{ padding:compact?12:16, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Stacked bar visual */}
            {(() => {
              const total = result.total_supply;
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', height:18, borderRadius:9, overflow:'hidden', background:'#f1f5f9', width:'100%' }}>
                    {sourceRows.map((row, i) => {
                      const pct = total > 0 ? (row.value / total * 100) : 0;
                      return pct > 0 ? (
                        <div key={i} style={{ width:`${pct}%`, background:row.color, transition:'width 0.4s' }} title={`${row.label}: ${pct.toFixed(1)}%`} />
                      ) : null;
                    })}
                  </div>
                  <div style={{ display:'flex', gap:compact?6:10, flexWrap:'wrap' }}>
                    {sourceRows.map((row, i) => {
                      const pct = total > 0 ? (row.value / total * 100) : 0;
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#475569' }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:row.color, flexShrink:0 }}/>
                          <span style={{ fontWeight:600, color:row.color }}>{row.label}</span>
                          <span style={{ color:'#94a3b8' }}>{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Dynamic conclusion text */}
            {(() => {
              const total   = result.total_supply;
              const dominant = sourceRows.reduce((a,b) => b.value > a.value ? b : a);
              const domPct   = total > 0 ? (dominant.value / total * 100) : 0;
              const zeroes   = sourceRows.filter(r => r.value === 0);
              const nonZero  = sourceRows.filter(r => r.value > 0);

              // Helper to render a highlighted numeric/label token inline
              const Hi = ({ v, color = '#15803d' }: { v: string; color?: string }) => (
                <span style={{ fontSize:14, fontWeight:900, color, letterSpacing:'-0.01em' }}>{v}</span>
              );

              return (
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.06em' }}>Conclusion</div>

                  <p style={{ margin:0, fontSize:11, color:'#166534', lineHeight:1.85 }}>
                    The total available water supply is{' '}
                    <Hi v={`${total.toFixed(2)} MLD`} />{' '}
                    {nonZero.length === 1
                      ? <>with <Hi v={`${domPct.toFixed(0)}%`} /> contribution coming entirely from <Hi v={dominant.label} color="#0369a1" /> sources.</>
                      : nonZero.length > 1
                        ? <>contributed by {nonZero.map((r,i) => {
                            const p = total > 0 ? (r.value / total * 100) : 0;
                            return <span key={i}>{i > 0 ? ', ' : ''}<Hi v={r.label} color={r.color} /> (<Hi v={`${p.toFixed(0)}%`} />)</span>;
                          })}.</>
                        : <>.{''}</>
                    }
                  </p>

                  {zeroes.length > 0 && nonZero.length > 0 && (
                    <p style={{ margin:0, fontSize:11, color:'#166534', lineHeight:1.85 }}>
                      {zeroes.map((r,i) => <span key={i}>{i > 0 ? ' and ' : ''}<Hi v={r.label} color={r.color} /></span>)}{' '}
                      currently contribute{zeroes.length === 1 ? 's' : ''}{' '}
                      <Hi v="0 MLD" color="#94a3b8" />.{' '}
                      {zeroes.length === sourceRows.length - 1 &&
                        <>This indicates complete dependency on <Hi v={nonZero[0].label} color="#0369a1" /> for meeting water demand in the selected region.</>
                      }
                    </p>
                  )}

                  {nonZero.length === 1 && zeroes.length > 0 && (
                    <p style={{ margin:0, fontSize:11, color:'#166534', lineHeight:1.85 }}>
                      The entire supply of <Hi v={`${total.toFixed(2)} MLD`} /> is derived from{' '}
                      <Hi v={nonZero[0].label} color="#0369a1" /> (<Hi v={`${domPct.toFixed(0)}%`} />), while{' '}
                      {zeroes.map((r,i) => <span key={i}>{i > 0 ? ' and ' : ''}<Hi v={r.label} color={r.color} /></span>)}{' '}
                      contribute <Hi v="0 MLD" color="#94a3b8" />. This highlights a lack of diversification and a potential risk if surface water availability fluctuates.
                    </p>
                  )}

                  {nonZero.length > 1 && (
                    <p style={{ margin:0, fontSize:11, color:'#166534', lineHeight:1.85 }}>
                      The supply is well-diversified across <Hi v={`${nonZero.length}`} /> source types, reducing dependency risk. Maintaining and expanding all active sources will improve long-term supply resilience.
                    </p>
                  )}
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── Water Gap Analysis ── */}
      {gapRows && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:11, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
            background:'linear-gradient(135deg,#f8fafc,#f1f5f9)', borderBottom:'1px solid #e2e8f0',
          }}>
            <div style={{ width:3, height:18, background:'#7c3aed', borderRadius:2, flexShrink:0 }}/>
            <span style={{ fontSize:12, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Water Gap Analysis
            </span>
            <Tip text="Compares total available supply (constant across years) against projected demand for each forecast year. A positive gap means surplus — supply exceeds demand. A negative gap means deficit — additional sources or demand reduction measures are needed." />
          </div>

          <div style={{ padding:compact?10:14, display:'flex', flexDirection:'column', gap:10 }}>
            {/* Summary pills */}
            {(() => {
              const surplus = gapRows.filter(r => r.gap >= 0).length;
              const deficit = gapRows.length - surplus;
              return (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:700, color:'#15803d' }}>
                    <TrendingUp size={12}/> {surplus} yr{surplus!==1?'s':''} surplus
                  </div>
                  {deficit > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:5, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:700, color:'#b91c1c' }}>
                      <TrendingDown size={12}/> {deficit} yr{deficit!==1?'s':''} deficit
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Gap table */}
            <div style={{ border:'1px solid #e2e8f0', borderRadius:9, overflow:'hidden' }}>
              <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:320 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:compact?11:12 }}>
                  <thead style={{ position:'sticky', top:0, zIndex:5 }}>
                    <tr style={{ background:'#f1f5f9' }}>
                      <th style={{ padding:'8px 12px', textAlign:'left',  borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#475569', whiteSpace:'nowrap' }}>Year</th>
                      <th style={{ padding:'8px 12px', textAlign:'right', borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#0369a1', whiteSpace:'nowrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          Supply (MLD) <Tip text="Total available water supply — same value for all years as entered above." />
                        </span>
                      </th>
                      <th style={{ padding:'8px 12px', textAlign:'right', borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#475569', whiteSpace:'nowrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          Demand (MLD) <Tip text="Total projected water demand for that year from the Water Demand module." />
                        </span>
                      </th>
                      <th style={{ padding:'8px 12px', textAlign:'right', borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#7c3aed', whiteSpace:'nowrap' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          Gap (MLD) <Tip text="Supply minus Demand. Positive = surplus (green). Negative = deficit (red) — additional supply or conservation needed." />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapRows.map((row, i) => (
                      <tr key={row.year} style={{ background: i%2 ? '#f8fafc' : '#fff' }}>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#374151' }}>{row.year}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#0369a1', fontWeight:500 }}>{row.supply.toFixed(3)}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#475569' }}>{row.demand.toFixed(3)}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:700, color: row.gap>0?'#15803d':row.gap<0?'#b91c1c':'#475569' }}>
                          <span style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                            {row.gap>0?<TrendingUp size={11}/>:row.gap<0?<TrendingDown size={11}/>:<Minus size={11}/>}
                            {row.gap>=0?'+':''}{row.gap.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#0369a1', lineHeight:1.6 }}>
              <strong>Note:</strong> A positive gap means available supply exceeds projected demand — resources are sufficient. A negative gap indicates a shortfall; consider augmenting supply or implementing demand management measures.
            </div>
          </div>
        </div>
      )}

      {/* ── No demand data note ── */}
      {result && !waterDemandTotals && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:9, padding:'9px 14px', fontSize:12, color:'#92400e' }}>
          <AlertCircle size={14} style={{ flexShrink:0 }}/>
          Gap analysis not available — run the Water Demand module first.
        </div>
      )}

      <ModuleNav
        back={{ label:'Water Demand', onClick:() => setActiveModule('water_demand') }}
        forward={result ? { label:'Continue to Sewage', variant:'next', onClick:() => setActiveModule('sewage') } : undefined}
      />
    </div>
  );
}
