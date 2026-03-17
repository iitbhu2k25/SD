'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, CircleDot, Circle, ChevronRight, Info, X } from 'lucide-react';
import BasicModuleInfo from '../../components/BasicModuleInfo';
import { useBasicStore } from '../store/basic.store';
import type { ActiveModule } from '../store/basic.store';

const STEP_KEYS: Array<ActiveModule | 'location'> = [
  'location', 'population', 'water_demand', 'water_supply', 'sewage',
];

const NAMES: Record<string, string> = {
  location: 'Area Selection', population: 'Population Forecasting',
  water_demand: 'Water Demand', water_supply: 'Water Supply', sewage: 'Sewage Generation',
};

type StepStatus = 'completed' | 'current' | 'upcoming';

// ── StatusBar ──────────────────────────────────────────────────────────────
export default function StatusBar() {
  const { confirmedLocation, activeModule } = useBasicStore();
  const isConfirmed = !!confirmedLocation;
  const [showModal, setShowModal] = useState(false);

  const currentStepKey: ActiveModule | 'location' = !isConfirmed ? 'location' : activeModule;
  const currentIdx = STEP_KEYS.indexOf(currentStepKey);

  const steps: { key: ActiveModule | 'location'; status: StepStatus }[] = useMemo(() =>
    STEP_KEYS.map((key, i) => ({
      key,
      status: i < currentIdx ? 'completed' : i === currentIdx ? 'current' : 'upcoming',
    })),
  [currentIdx]);

  return (
    <>
      <div style={{
        background:'#fff', borderBottom:'1px solid #e2e8f0',
        flexShrink:0, zIndex:20,
      }}>
        {/* ── Single row: heading LEFT + steps CENTRE + info RIGHT ── */}
        <div style={{
          display:'grid', gridTemplateColumns:'auto 1fr auto',
          alignItems:'center', gap:16,
          padding:'8px 20px',
          minHeight:52,
        }}>

          {/* LEFT — title */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <span style={{ fontSize:26, fontWeight:700, color:'#083cb6', letterSpacing:'-0.3px', whiteSpace:'nowrap' }}>
              Basic Module
            </span>
            
          </div>

          {/* CENTRE — step progress */}
          <nav style={{ display:'flex', justifyContent:'center', overflow:'hidden' }}>
            <ol style={{ display:'inline-flex', alignItems:'center', gap:0, margin:0, padding:0, listStyle:'none' }}>
              {steps.map(({ key, status }, idx) => {
                const label = NAMES[key] ?? key;
                const isLast = idx === steps.length - 1;
                const labelColor = status === 'completed' ? '#16a34a' : status === 'current' ? '#2563eb' : '#94a3b8';
                const lineColor  = status === 'completed' ? '#86efac' : '#e2e8f0';

                return (
                  <li key={key} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ position:'relative' }}>
                        {status === 'completed' ? (
                          <CheckCircle size={16} color="#16a34a"/>
                        ) : status === 'current' ? (
                          <CircleDot size={16} color="#2563eb" style={{ filter:'drop-shadow(0 0 4px rgba(37,99,235,0.5))' }}/>
                        ) : (
                          <Circle size={16} color="#cbd5e1"/>
                        )}
                        {status === 'current' && (
                          <span style={{
                            position:'absolute', inset:-3, borderRadius:'50%',
                            border:'2px solid rgba(37,99,235,0.2)',
                            animation:'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                          }}/>
                        )}
                      </div>
                      <span style={{ fontSize:10, fontWeight: status === 'current' ? 700 : 500, color:labelColor, whiteSpace:'nowrap' }}>
                        {label}
                      </span>
                    </div>

                    {!isLast && (
                      <div style={{ display:'flex', alignItems:'center', margin:'0 4px', paddingBottom:16 }}>
                        <div style={{ width:28, height:2, background:lineColor, borderRadius:1 }}/>
                        <ChevronRight size={12} color={lineColor} style={{ margin:'0 -2px', flexShrink:0 }}/>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* RIGHT — info button */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            title="View module information"
            style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:32, height:32, borderRadius:8, border:'1px solid #e2e8f0',
              background:'#f8fafc', cursor:'pointer', color:'#64748b',
              flexShrink:0, transition:'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background='#eff6ff'; (e.currentTarget as HTMLElement).style.color='#2563eb'; (e.currentTarget as HTMLElement).style.borderColor='#bfdbfe'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background='#f8fafc'; (e.currentTarget as HTMLElement).style.color='#64748b'; (e.currentTarget as HTMLElement).style.borderColor='#e2e8f0'; }}
          >
            <Info size={15}/>
          </button>
        </div>

        <style>{`@keyframes ping{75%,100%{transform:scale(1.8);opacity:0}}`}</style>
      </div>

      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{
            position:'fixed', inset:0, background:'rgba(15,23,42,0.45)',
            backdropFilter:'blur(3px)', zIndex:1000,
          }}/>
          <div style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:1001, background:'#fff', borderRadius:16,
            boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
            width:'min(520px, calc(100vw - 32px))',
            overflow:'hidden',
          }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'16px 20px', borderBottom:'1px solid #f1f5f9',
              background:'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>Analysis Modules</div>
              <button onClick={() => setShowModal(false)} type="button" style={{
                border:'none', background:'#f1f5f9', borderRadius:8,
                padding:6, cursor:'pointer', display:'flex', color:'#64748b',
              }}>
                <X size={16}/>
              </button>
            </div>
            <BasicModuleInfo />
          </div>
        </>
      )}
    </>
  );
}