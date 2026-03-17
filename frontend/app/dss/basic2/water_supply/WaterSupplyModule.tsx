'use client';

import { useEffect, useRef, useState } from 'react';
import { useBasicStore } from '../shared/store/basic.store';
import { API_BASE_URL } from '../shared/utils/constants';
import { Waves, Wind, Recycle, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import ModuleNav from '../shared/components/ModuleNav';

function Spinner() {
  return (
    <svg style={{ animation:'spin 0.8s linear infinite', width:14, height:14 }} fill="none" viewBox="0 0 24 24">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

const inputCls: React.CSSProperties = {
  width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px',
  fontSize:13, outline:'none', background:'#fff', boxSizing:'border-box',
};

const inputDisabledCls: React.CSSProperties = {
  ...inputCls,
  background:'#f1f5f9', color:'#94a3b8', cursor:'not-allowed',
};

function Field({ label, unit, hint, children }: { label: string; unit?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {label}
        {unit && <span style={{ marginLeft:4, fontWeight:400, color:'#cbd5e1', textTransform:'none' }}>({unit})</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize:11, color:'#94a3b8' }}>{hint}</div>}
    </div>
  );
}

function Section({
  title, icon, color, bg, border, children, open, onToggle,
}: {
  title: string; icon: React.ReactNode; color: string; bg: string; border: string;
  children: React.ReactNode; open: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:10, overflow:'hidden' }}>
      <div onClick={onToggle} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 16px', background:bg, cursor:'pointer', userSelect:'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{title}</span>
        </div>
        <span style={{ color:'#94a3b8' }}>{open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</span>
      </div>
      {open && (
        <div style={{ padding:'16px', background:'#fff', display:'flex', flexDirection:'column', gap:12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function OrDivider() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0' }}>
      <div style={{ flex:1, height:1, background:'#e2e8f0' }}/>
      <span style={{ fontSize:12, fontWeight:700, color:'#94a3b8' }}>OR</span>
      <div style={{ flex:1, height:1, background:'#e2e8f0' }}/>
    </div>
  );
}

export default function WaterSupplyModule() {
  const { setActiveModule, waterDemandTotals, setWaterSupplyTotal, setWaterSupplyReportData } = useBasicStore();
  const reportHashRef = useRef('');

  // ── Surface water ─────────────────────────────────────────────
  const [surfaceWater, setSurfaceWater] = useState('');

  // ── Groundwater ───────────────────────────────────────────────
  const [directGW, setDirectGW] = useState('');
  const [numTubewells, setNumTubewells] = useState('');
  const [dischargeRate, setDischargeRate] = useState('');
  const [operatingHours, setOperatingHours] = useState('');

  // ── Alternate supply ──────────────────────────────────────────
  const [directAlt, setDirectAlt] = useState('');
  const [rooftopTank, setRooftopTank] = useState('');
  const [aquiferRecharge, setAquiferRecharge] = useState('');
  const [surfaceRunoff, setSurfaceRunoff] = useState('');
  const [reuseWater, setReuseWater] = useState('');

  // ── UI state ──────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState({ surface:true, ground:true, alternate:true });
  const toggle = (k: keyof typeof openSections) => setOpenSections(s => ({ ...s, [k]: !s[k] }));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ total_supply: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Conflict detection (disable fields, not toggle) ───────────
  const isDirectGWFilled   = directGW !== '';
  const isTubeWellFilled   = numTubewells !== '' || dischargeRate !== '' || operatingHours !== '';
  const isDirectAltFilled  = directAlt !== '';
  const isAltCompFilled    = rooftopTank !== '' || aquiferRecharge !== '' || surfaceRunoff !== '' || reuseWater !== '';

  // ── Computed previews ─────────────────────────────────────────
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
    setLoading(true);
    setError(null);
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
      setWaterSupplyTotal(data.total_supply); // save to store for SewageModule auto-fill
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived gap data ──────────────────────────────────────────
  const gapRows = result && waterDemandTotals
    ? Object.keys(waterDemandTotals).map(Number).sort((a,b) => a-b).map(yr => ({
        year: yr,
        supply: result.total_supply,
        demand: waterDemandTotals[yr],
        gap: result.total_supply - waterDemandTotals[yr],
      }))
    : null;

  // ── Breakdown for result card ─────────────────────────────────
  const gwVal  = isDirectGWFilled  ? (parseFloat(directGW)||0)  : (gwComputed??0);
  const altVal = isDirectAltFilled ? (parseFloat(directAlt)||0) : (altComputed??0);

  useEffect(() => {
    if (!result) {
      if (reportHashRef.current !== '') {
        reportHashRef.current = '';
        setWaterSupplyReportData(null);
      }
      return;
    }
    const payload = {
      inputs: {
        surfaceWater,
        directGW,
        numTubewells,
        dischargeRate,
        operatingHours,
        directAlt,
        rooftopTank,
        aquiferRecharge,
        surfaceRunoff,
        reuseWater,
      },
      computed: {
        gwComputed,
        altComputed,
      },
      result,
      gapRows,
    };
    const nextHash = JSON.stringify(payload);
    if (nextHash !== reportHashRef.current) {
      reportHashRef.current = nextHash;
      setWaterSupplyReportData(payload);
    }
  }, [
    result,
    surfaceWater,
    directGW,
    numTubewells,
    dischargeRate,
    operatingHours,
    directAlt,
    rooftopTank,
    aquiferRecharge,
    surfaceRunoff,
    reuseWater,
    gwComputed,
    altComputed,
    gapRows,
    setWaterSupplyReportData,
  ]);

  return (
    <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Surface Water ── */}
      <Section title="Surface Water Supply (SWS)" icon={<Waves size={16}/>}
        color="#0369a1" bg="#f0f9ff" border="#bae6fd"
        open={openSections.surface} onToggle={() => toggle('surface')}>
        <Field label="Surface Water Supply" unit="MLD"
          hint="Rivers, lakes, reservoirs, canals — direct intake.">
          <input style={inputCls} type="number" min="0" placeholder="e.g. 5.2"
            value={surfaceWater} onChange={e => setSurfaceWater(e.target.value)} />
        </Field>
      </Section>

      {/* ── Groundwater ── */}
      <Section title="Groundwater Supply (GWS)" icon={<Wind size={16}/>}
        color="#0891b2" bg="#ecfeff" border="#a5f3fc"
        open={openSections.ground} onToggle={() => toggle('ground')}>

        <Field label="Direct Groundwater Supply" unit="MLD">
          <input
            style={isTubeWellFilled ? inputDisabledCls : inputCls}
            type="number" min="0" placeholder="Enter direct MLD"
            value={directGW}
            disabled={isTubeWellFilled}
            onChange={e => setDirectGW(e.target.value)} />
        </Field>

        <OrDivider/>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <Field label="No. of Tubewells" hint="All 3 required">
            <input style={isDirectGWFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="e.g. 10"
              value={numTubewells} disabled={isDirectGWFilled}
              onChange={e => setNumTubewells(e.target.value)} />
          </Field>
          <Field label="Discharge Rate" unit="lt/hr">
            <input style={isDirectGWFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="e.g. 5000"
              value={dischargeRate} disabled={isDirectGWFilled}
              onChange={e => setDischargeRate(e.target.value)} />
          </Field>
          <Field label="Operating Hours" unit="hrs/day">
            <input style={isDirectGWFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="e.g. 8"
              value={operatingHours} disabled={isDirectGWFilled}
              onChange={e => setOperatingHours(e.target.value)} />
          </Field>
        </div>
        {gwComputed !== null && (
          <div style={{ fontSize:12, color:'#0891b2', background:'#ecfeff', borderRadius:6, padding:'6px 10px', border:'1px solid #a5f3fc' }}>
            Computed: <strong>{gwComputed.toFixed(3)} MLD</strong>
            <span style={{ color:'#94a3b8', marginLeft:6 }}>
              = {numTubewells||0} wells × {dischargeRate||0} lt/hr × {operatingHours||0} hrs
            </span>
          </div>
        )}
      </Section>

      {/* ── Alternate Supply ── */}
      <Section title="Alternate Water Supply (AWS)" icon={<Recycle size={16}/>}
        color="#059669" bg="#f0fdf4" border="#86efac"
        open={openSections.alternate} onToggle={() => toggle('alternate')}>

        <Field label="Direct Alternate Water Supply" unit="MLD">
          <input
            style={isAltCompFilled ? inputDisabledCls : inputCls}
            type="number" min="0" placeholder="Enter direct MLD"
            value={directAlt} disabled={isAltCompFilled}
            onChange={e => setDirectAlt(e.target.value)} />
        </Field>

        <OrDivider/>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Rooftop Rainwater Tank" unit="MLD">
            <input style={isDirectAltFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="0"
              value={rooftopTank} disabled={isDirectAltFilled}
              onChange={e => setRooftopTank(e.target.value)} />
          </Field>
          <Field label="Aquifer Recharge" unit="MLD">
            <input style={isDirectAltFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="0"
              value={aquiferRecharge} disabled={isDirectAltFilled}
              onChange={e => setAquiferRecharge(e.target.value)} />
          </Field>
          <Field label="Surface Runoff Storage" unit="MLD">
            <input style={isDirectAltFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="0"
              value={surfaceRunoff} disabled={isDirectAltFilled}
              onChange={e => setSurfaceRunoff(e.target.value)} />
          </Field>
          <Field label="Reuse of Treated Wastewater" unit="MLD">
            <input style={isDirectAltFilled ? inputDisabledCls : inputCls}
              type="number" min="0" placeholder="0"
              value={reuseWater} disabled={isDirectAltFilled}
              onChange={e => setReuseWater(e.target.value)} />
          </Field>
        </div>
        {altComputed !== null && (
          <div style={{ fontSize:12, color:'#059669', background:'#f0fdf4', borderRadius:6, padding:'6px 10px', border:'1px solid #86efac' }}>
            Computed: <strong>{altComputed.toFixed(3)} MLD</strong>
          </div>
        )}
      </Section>

      {/* ── Calculate button ── */}
      <button type="button" onClick={handleCalculate} disabled={loading}
        style={{
          alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8,
          padding:'11px 28px', borderRadius:10, border:'none',
          background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: loading ? '#94a3b8' : '#fff', fontSize:14, fontWeight:700,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : '0 4px 12px rgba(37,99,235,0.3)',
          transition:'all 0.2s',
        }}>
        {loading ? <><Spinner/> Calculating…</> : 'Calculate Water Supply'}
      </button>

      {/* ── Error ── */}
      {error && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px' }}>
          <AlertCircle size={15} color="#ef4444" style={{ flexShrink:0, marginTop:1 }}/>
          <span style={{ fontSize:13, color:'#b91c1c' }}>{error}</span>
        </div>
      )}

      {/* ── Result breakdown ── */}
      {result && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'13px 18px',
            background:'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            borderBottom:'1px solid #86efac',
          }}>
            <CheckCircle2 size={18} color="#16a34a"/>
            <span style={{ fontSize:14, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Water Supply Result
            </span>
          </div>
          <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                Total Available Supply
              </div>
              <div style={{ fontSize:42, fontWeight:900, color:'#15803d', lineHeight:1 }}>
                {result.total_supply.toFixed(3)}
              </div>
              <div style={{ fontSize:14, color:'#64748b', marginTop:4 }}>MLD</div>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Source','Supply (MLD)'].map(h => (
                    <th key={h} style={{ padding:'8px 14px', textAlign: h==='Source'?'left':'right', borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label:'Surface Water', value: parseFloat(surfaceWater)||0, color:'#0369a1' },
                  { label: isDirectGWFilled ? 'Groundwater (Direct)' : `Groundwater (Tubewells)`, value: gwVal, color:'#0891b2' },
                  { label: isDirectAltFilled ? 'Alternate Supply (Direct)' : 'Alternate Supply (Components)', value: altVal, color:'#059669' },
                ].map((row, i) => (
                  <tr key={i} style={{ background: i%2 ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', color:row.color, fontWeight:600 }}>{row.label}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#374151' }}>{row.value.toFixed(3)}</td>
                  </tr>
                ))}
                <tr style={{ background:'#f0fdf4' }}>
                  <td style={{ padding:'10px 14px', fontWeight:800, color:'#15803d' }}>Total</td>
                  <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:800, color:'#15803d' }}>{result.total_supply.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Water Gap Analysis ── */}
      {gapRows && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'13px 18px',
            background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderBottom:'1px solid #e2e8f0',
          }}>
            <div style={{ width:4, height:24, background:'#7c3aed', borderRadius:2 }}/>
            <span style={{ fontSize:14, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.04em' }}>
              Water Gap Analysis
            </span>
            <span style={{ fontSize:12, color:'#64748b', marginLeft:4 }}>
              — Supply minus Demand per year
            </span>
          </div>
          <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            {/* Summary pills */}
            {(() => {
              const surplus = gapRows.filter(r => r.gap >= 0).length;
              const deficit = gapRows.length - surplus;
              return (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#15803d' }}>
                    <TrendingUp size={13}/> {surplus} year{surplus!==1?'s':''} surplus
                  </div>
                  {deficit > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#b91c1c' }}>
                      <TrendingDown size={13}/> {deficit} year{deficit!==1?'s':''} deficit
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Gap table */}
            <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
              <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:380 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead style={{ position:'sticky', top:0, zIndex:5 }}>
                    <tr style={{ background:'#f1f5f9' }}>
                      {['Year','Water Supply (MLD)','Water Demand (MLD)','Water Gap (MLD)'].map(h => (
                        <th key={h} style={{
                          padding:'10px 14px', textAlign: h==='Year'?'left':'right',
                          borderBottom:'2px solid #e2e8f0', fontWeight:700, color:'#475569', whiteSpace:'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gapRows.map((row, i) => (
                      <tr key={row.year} style={{ background: i%2 ? '#f8fafc' : '#fff' }}>
                        <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#374151' }}>{row.year}</td>
                        <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#0369a1' }}>{row.supply.toFixed(3)}</td>
                        <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', color:'#475569' }}>{row.demand.toFixed(3)}</td>
                        <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:700,
                          color: row.gap > 0 ? '#15803d' : row.gap < 0 ? '#b91c1c' : '#475569' }}>
                          <span style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                            {row.gap > 0 ? <TrendingUp size={12}/> : row.gap < 0 ? <TrendingDown size={12}/> : <Minus size={12}/>}
                            {row.gap >= 0 ? '+' : ''}{row.gap.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note */}
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#0369a1' }}>
              <strong>Note:</strong> A positive gap indicates sufficient water resources. A negative gap suggests additional supply or demand management measures may be needed.
            </div>
          </div>
        </div>
      )}

      {/* ── No demand data note ── */}
      {result && !waterDemandTotals && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 16px', fontSize:13, color:'#92400e' }}>
          <AlertCircle size={15} style={{ flexShrink:0 }}/>
          Water gap analysis not available — please run the Water Demand module first to see the gap table.
        </div>
      )}

      <ModuleNav
        back={{ label: 'Water Demand', onClick: () => setActiveModule('water_demand') }}
        forward={result ? {
          label: 'Continue to Sewage',
          variant: 'next',
          onClick: () => setActiveModule('sewage'),
        } : undefined}
      />
    </div>
  );
}
