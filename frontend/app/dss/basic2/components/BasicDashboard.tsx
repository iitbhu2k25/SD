'use client';

import { useState } from 'react';
import { useBasicStore, type ActiveModule } from '../shared/store/basic.store';
import LocationSelector from '../shared/components/LocationSelector';
import DrainLocationSelector from '../shared/components/DrainLocationSelector';
import IndCatchmentSelector from '../shared/components/IndCatchmentSelector';
import MapView from '../shared/components/MapView';
import PopulationModule from '../populations/PopulationModule';
import WaterDemandModule from '../water_demand/WaterDemandModule';
import WaterSupplyModule from '../water_supply/WaterSupplyModule';
import SewageModule from '../seawage/SewageModule';
import type { LocationMode } from '../shared/types/location.types';
import { Layers, GitBranch, Globe, MapPin, RotateCcw, Users, Droplets, Waves, FlaskConical, Map as MapIcon, ChevronDown } from 'lucide-react';
import StatusBar from '../shared/components/StatusBar';
import Basic2ReportDownload from './Basic2ReportDownload';

const MODES: { key: LocationMode; label: string; icon: React.ReactNode }[] = [
  { key: 'admin',           label: 'Administrative',  icon: <Layers size={14} /> },
  { key: 'drain',           label: 'Drain',           icon: <GitBranch size={14} /> },
  { key: 'india_catchment', label: 'India Catchment', icon: <Globe size={14} /> },
];

const MODULE_TABS: { key: ActiveModule; label: string; icon: React.ReactNode }[] = [
  { key: 'population',   label: 'Population',   icon: <Users size={15} /> },
  { key: 'water_demand', label: 'Water Demand', icon: <Droplets size={15} /> },
  { key: 'water_supply', label: 'Water Supply', icon: <Waves size={15} /> },
  { key: 'sewage',       label: 'Sewage',       icon: <FlaskConical size={15} /> },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:'48px 16px', color:'#94a3b8' }}>
      <p style={{ fontSize:14, fontWeight:600 }}>{label}</p>
      <span style={{ fontSize:12, background:'#fef3c7', color:'#92400e', borderRadius:20, padding:'4px 12px' }}>Coming soon</span>
    </div>
  );
}

// Responsive hook
function useIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

export default function BasicDashboard() {
  const { mode, setMode, confirmedLocation, clearConfirmedLocation, activeModule, setActiveModule } = useBasicStore();
  const isConfirmed = !!confirmedLocation;
  const [showMap, setShowMap] = useState(false); // mobile: toggle map

  return (
    <>
      {/* ── Responsive styles injected ── */}
      <style>{`
        .dss-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }
        .dss-left { width: 50%; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #e2e8f0; overflow: hidden; }
        .dss-right { width: 50%; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .dss-map-inner { flex: 1; margin: 12px 12px 12px 14px; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.12); position: relative; }
        .dss-map-toggle { display: none; }

        @media (max-width: 767px) {
          .dss-body { flex-direction: column; overflow: auto; }
          .dss-left { width: 100%; height: auto; overflow: visible; flex-shrink: 0; }
          .dss-right { width: 100%; height: 0; overflow: hidden; transition: height 0.3s ease; flex-shrink: 0; }
          .dss-right.map-open { height: 320px; }
          .dss-map-inner { margin: 8px; border-radius: 10px; }
          .dss-map-toggle { display: flex; }
          .dss-topbar-modes { flex-wrap: wrap; gap: 6px !important; }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .dss-left { width: 55%; }
          .dss-right { width: 45%; }
        }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#f1f5f9', overflow:'hidden' }}>

        {/* ── Status bar ── */}
      <StatusBar />

      {/* ── Top bar ── */}
        <div style={{
          display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
          padding:'8px 16px', background:'#fff',
          borderBottom:'1px solid #e2e8f0',
          boxShadow:'0 1px 4px rgba(0,0,0,0.07)',
          minHeight:48, flexShrink:0, zIndex:10,
        }}>
          {!isConfirmed ? (
            <div className="dss-topbar-modes" style={{ display:'flex', alignItems:'center', gap:6, flex:1, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, fontWeight:800, color:'#94a3b8', letterSpacing:'0.12em', textTransform:'uppercase', marginRight:4 }}>Mode</span>
              {MODES.map((m) => (
                <button key={m.key} type="button" onClick={() => setMode(m.key)}
                  style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:600,
                    border: mode === m.key ? 'none' : '1px solid #e2e8f0',
                    background: mode === m.key ? '#2563eb' : 'transparent',
                    color: mode === m.key ? '#fff' : '#64748b',
                    cursor:'pointer', transition:'all 0.15s',
                  }}>
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%', minWidth:0, flexWrap:'wrap' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0,
                background:'#f0fdf4', border:'1px solid #bbf7d0',
                borderRadius:8, padding:'7px 14px',
              }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', flexShrink:0, animation:'pulse 2s infinite' }} />
                <MapPin size={13} color="#16a34a" style={{ flexShrink:0 }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#166534', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {confirmedLocation.label}
                </span>
              </div>
              <button type="button" onClick={clearConfirmedLocation}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:600,
                  border:'1px solid #e2e8f0', background:'#fff',
                  color:'#64748b', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                }}>
                <RotateCcw size={13} /> Change Location
              </button>
              <Basic2ReportDownload />
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="dss-body">

          {/* ═══ LEFT — selector / module ═══ */}
          <div className="dss-left">
            {!isConfirmed ? (
              <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
                {mode === 'admin'           && <LocationSelector />}
                {mode === 'drain'           && <DrainLocationSelector />}
                {mode === 'india_catchment' && <IndCatchmentSelector />}
              </div>
            ) : (
              <>
                {/* Mobile: map toggle button */}
                <button className="dss-map-toggle" type="button"
                  onClick={() => setShowMap(!showMap)}
                  style={{
                    display:'none',
                    alignItems:'center', justifyContent:'space-between',
                    padding:'10px 16px', background:'#eff6ff', border:'none',
                    borderBottom:'1px solid #bfdbfe', cursor:'pointer',
                    fontSize:13, fontWeight:600, color:'#1d4ed8', flexShrink:0,
                  }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <MapIcon size={14}/> {showMap ? 'Hide Map' : 'Show Map'}
                  </span>
                  <ChevronDown size={14} style={{ transform: showMap ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
                </button>

                {/* Module content — always mounted, hidden via display:none to preserve state */}
                <div style={{ flex:1, overflowY:'auto', position:'relative' }}>
                  <div style={{ display: activeModule === 'population'   ? 'block' : 'none' }}><PopulationModule /></div>
                  <div style={{ display: activeModule === 'water_demand' ? 'block' : 'none' }}><WaterDemandModule /></div>
                  <div style={{ display: activeModule === 'water_supply' ? 'block' : 'none' }}><WaterSupplyModule /></div>
                  <div style={{ display: activeModule === 'sewage'       ? 'block' : 'none' }}><SewageModule /></div>
                </div>
              </>
            )}
          </div>

          {/* ═══ RIGHT — map ═══ */}
          <div className={`dss-right${showMap ? ' map-open' : ''}`}>
            <div className="dss-map-inner">
              <MapView className="h-full w-full" />
              {!isConfirmed && (
                <div style={{
                  position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
                  zIndex:500, pointerEvents:'none',
                  background:'rgba(255,255,255,0.96)', backdropFilter:'blur(6px)',
                  border:'1px solid #e2e8f0', borderRadius:12,
                  padding:'10px 20px', fontSize:13, color:'#475569',
                  whiteSpace:'nowrap', boxShadow:'0 4px 16px rgba(0,0,0,0.1)',
                }}>
                  Select a location, then click <strong style={{ color:'#2563eb' }}>Confirm Location</strong>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
