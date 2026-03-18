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
import {
  Layers, GitBranch, Globe, MapPin, RotateCcw,
  Users, Droplets, Waves, FlaskConical,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import StatusBar from '../shared/components/StatusBar';
import Basic2ReportDownload from './Basic2ReportDownload';

/* ─── constants ──────────────────────────────────────────────────── */
const STRIP_W = 52;
const LEFT_W  = 300;
const RIGHT_W = 680;   // right panel — wide, in flex row (not on map)
const EASE    = '0.3s cubic-bezier(0.4,0,0.2,1)';

const MODES: { key: LocationMode; label: string; icon: React.ReactNode }[] = [
  { key: 'admin',           label: 'Admin\nMode',  icon: <Layers    size={18} /> },
  { key: 'drain',           label: 'Drain',        icon: <GitBranch size={18} /> },
  { key: 'india_catchment', label: 'India\nCatch', icon: <Globe     size={18} /> },
];

const MODULE_TABS: { key: ActiveModule; label: string; icon: React.ReactNode }[] = [
  { key: 'population',   label: 'Population',   icon: <Users        size={14} /> },
  { key: 'water_demand', label: 'Water Demand', icon: <Droplets     size={14} /> },
  { key: 'water_supply', label: 'Water Supply', icon: <Waves        size={14} /> },
  { key: 'sewage',       label: 'Sewage',       icon: <FlaskConical size={14} /> },
];

/* ═══════════════════════════════════════════════════════════════════ */
export default function BasicDashboard() {
  const {
    mode, setMode,
    confirmedLocation, clearConfirmedLocation,
    activeModule, setActiveModule,
  } = useBasicStore();

  const isConfirmed = !!confirmedLocation;
  const [leftOpen,  setLeftOpen]  = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const handleModeClick = (newMode: LocationMode) => {
    if (newMode === mode && leftOpen) {
      setLeftOpen(false);
    } else {
      if (newMode !== mode) setMode(newMode);
      setLeftOpen(true);
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .strip-btn:hover { background:rgba(255,255,255,0.1)!important; }
        .mod-tab:hover   { background:#eff6ff!important; color:#2563eb!important; }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

        <StatusBar />

        {/* ══ MAIN ROW: strip | map-area | right-panel ══ */}
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* ┌─────────────────────────────────┐
              │  LEFT STRIP  (always visible)    │
              └─────────────────────────────────┘ */}
          <div style={{
            width: STRIP_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 14,
            gap: 6,
            background: 'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '2px 0 14px rgba(0,0,0,0.28)',
            zIndex: 30,
          }}>
            {MODES.map(m => {
              const active = mode === m.key;
              return (
                <button key={m.key} type="button" className="strip-btn"
                  onClick={() => handleModeClick(m.key)}
                  title={m.label.replace('\n',' ')}
                  style={{
                    width:42, padding:'9px 3px 7px',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    borderRadius:9, border:'none', cursor:'pointer',
                    background: active && leftOpen ? '#2563eb'
                      : active ? 'rgba(37,99,235,0.3)' : 'transparent',
                    color: active ? '#fff' : '#94a3b8',
                    transition:'all 0.15s',
                  }}>
                  {m.icon}
                  <span style={{ fontSize:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', lineHeight:1.3, textAlign:'center', whiteSpace:'pre-line' }}>
                    {m.label}
                  </span>
                </button>
              );
            })}

            {/* divider */}
            <div style={{ width:28, height:1, background:'rgba(255,255,255,0.1)', margin:'2px 0' }} />

            {/* LEFT PANEL toggle inside strip */}
            <button type="button" className="strip-btn"
              onClick={() => setLeftOpen(v => !v)}
              title={leftOpen ? 'Hide location panel' : 'Show location panel'}
              style={{
                width:42, padding:'8px 3px 6px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                borderRadius:9,
                border: `1px solid ${leftOpen ? 'rgba(255,255,255,0.18)' : 'transparent'}`,
                cursor:'pointer',
                background: leftOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: leftOpen ? '#e2e8f0' : '#4b5563',
                transition:'all 0.2s',
              }}>
              {leftOpen
                ? <ChevronLeft  size={17} strokeWidth={2.5}/>
                : <ChevronRight size={17} strokeWidth={2.5}/>
              }
              <span style={{ fontSize:7.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {leftOpen ? 'Hide' : 'Show'}
              </span>
            </button>

            <div style={{ flex:1 }}/>
            <span style={{ fontSize:7.5, color:'rgba(148,163,184,0.25)', textTransform:'uppercase', letterSpacing:'0.1em', writingMode:'vertical-lr', marginBottom:12 }}>DSS</span>
          </div>

          {/* ┌──────────────────────────────────────────────┐
              │  MAP AREA  (flex:1 — grows when panels close) │
              │  Left panel FLOATS over this area             │
              └──────────────────────────────────────────────┘ */}
          <div style={{ flex:1, position:'relative', overflow:'hidden', minWidth:0 }}>

            {/* Map in isolated wrapper so Leaflet z-indices stay trapped inside */}
            <div style={{ position:'absolute', inset:0, isolation:'isolate' }}>
              <MapView className="h-full w-full" />
            </div>

            {/* ── LEFT FLOATING PANEL (on map, slides left to hide) ── */}
            <div style={{
              position:'absolute',
              left: 10,
              top: 12,
              bottom: 12,
              width: LEFT_W,
              zIndex: 20,
              transition: `transform ${EASE}, opacity ${EASE}`,
              transform: leftOpen ? 'translateX(0)' : `translateX(calc(-100% - 20px))`,
              opacity: leftOpen ? 1 : 0,
              pointerEvents: leftOpen ? 'auto' : 'none',
            }}>
              <div style={{
                width:'100%', height:'100%',
                background:'rgba(255,255,255,0.97)',
                backdropFilter:'blur(16px)',
                borderRadius:14,
                border:'1px solid rgba(226,232,240,0.9)',
                boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
                display:'flex', flexDirection:'column',
                overflow:'hidden',
              }}>
                {/* header */}
                <div style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'10px 14px',
                  borderBottom:'1px solid #f1f5f9',
                  background:'#f8fafc', flexShrink:0,
                }}>
                  <MapPin size={14} color="#2563eb"/>
                  <span style={{ fontSize:11, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.07em' }}>
                    {isConfirmed ? 'Location' : 'Select Location'}
                  </span>
                  {isConfirmed
                    ? <span style={{ fontSize:10, fontWeight:700, background:'#dcfce7', color:'#15803d', borderRadius:20, padding:'2px 10px' }}>Confirmed</span>
                    : <span style={{ fontSize:10, fontWeight:700, background:'#fef3c7', color:'#92400e', borderRadius:20, padding:'2px 10px' }}>
                        {mode === 'admin' ? 'Admin' : mode === 'drain' ? 'Drain' : 'India'}
                      </span>
                  }
                  <button type="button" onClick={() => setLeftOpen(false)}
                    style={{ marginLeft:'auto', width:26, height:26, borderRadius:7, border:'none', background:'rgba(0,0,0,0.06)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>
                    <ChevronLeft size={14} strokeWidth={2.5}/>
                  </button>
                </div>

                {/* body */}
                <div style={{ flex:1, overflowY:'auto' }}>
                  {!isConfirmed ? (
                    <div style={{ padding:'14px 14px 24px' }}>
                      {mode === 'admin'           && <LocationSelector />}
                      {mode === 'drain'           && <DrainLocationSelector />}
                      {mode === 'india_catchment' && <IndCatchmentSelector />}
                    </div>
                  ) : (
                    <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:10, animation:'fadeIn 0.22s ease' }}>
                      <div style={{
                        display:'flex', alignItems:'center', gap:8,
                        background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                        border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 13px',
                      }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', flexShrink:0, animation:'pulse 2s infinite' }}/>
                        <MapPin size={13} color="#15803d" style={{ flexShrink:0 }}/>
                        <span style={{ fontSize:12, fontWeight:600, color:'#166534', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                          {confirmedLocation.label}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button type="button" onClick={clearConfirmedLocation}
                          style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 10px', borderRadius:8, fontSize:12, fontWeight:600, border:'1px solid #e2e8f0', background:'#fff', color:'#475569', cursor:'pointer' }}>
                          <RotateCcw size={12}/> Change Location
                        </button>
                        <Basic2ReportDownload />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Left panel open-ear (shown only when panel is closed) */}
            {!leftOpen && (
              <button type="button" onClick={() => setLeftOpen(true)}
                title="Open location panel"
                style={{
                  position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                  zIndex:20,
                  width:24, height:54,
                  background:'#2563eb', border:'none',
                  borderRadius:'0 12px 12px 0',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff',
                  boxShadow:'3px 0 14px rgba(37,99,235,0.5)',
                }}>
                <ChevronRight size={14} strokeWidth={2.5}/>
              </button>
            )}

            {/* Right panel toggle ear — re-open button at right edge of map */}
            {isConfirmed && !rightOpen && (
              <button type="button" onClick={() => setRightOpen(true)}
                title="Show analysis panel"
                style={{
                  position:'absolute', right:0, top:'50%', transform:'translateY(-50%)',
                  zIndex:20, width:24, height:54,
                  background:'rgba(255,255,255,0.96)', border:'1px solid #cbd5e1', borderRight:'none',
                  borderRadius:'12px 0 0 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', color:'#475569',
                  boxShadow:'-3px 0 10px rgba(0,0,0,0.12)',
                }}>
                <ChevronLeft size={14} strokeWidth={2.5}/>
              </button>
            )}

            {/* pre-confirmation hint */}
            {!isConfirmed && (
              <div style={{
                position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)',
                zIndex:20, pointerEvents:'none',
                background:'rgba(255,255,255,0.96)', backdropFilter:'blur(8px)',
                border:'1px solid #e2e8f0', borderRadius:12,
                padding:'10px 24px', fontSize:13, color:'#475569',
                whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(0,0,0,0.12)',
              }}>
                Select a location, then click{' '}
                <strong style={{ color:'#2563eb' }}>Confirm Location</strong>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL (flex sibling — does NOT overlap the map) ── */}
          {isConfirmed && (
            <div style={{
              width: rightOpen ? RIGHT_W : 0,
              flexShrink: 0,
              overflow: 'hidden',
              transition: `width ${EASE}`,
            }}>
              <div style={{
                width: RIGHT_W,
                height: '100%',
                background: '#fff',
                borderLeft: '1px solid #e2e8f0',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* header */}
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc', flexShrink:0 }}>
                  <button type="button" onClick={() => setRightOpen(false)}
                    style={{ width:26, height:26, borderRadius:7, border:'none', background:'rgba(0,0,0,0.06)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>
                    <ChevronRight size={14} strokeWidth={2.5}/>
                  </button>
                  <span style={{ fontSize:11, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.07em' }}>Analysis</span>
                </div>

                {/* module tabs */}
                <div style={{ display:'flex', flexShrink:0, borderBottom:'2px solid #f1f5f9', background:'#fff' }}>
                  {MODULE_TABS.map(tab => (
                    <button key={tab.key} type="button" className="mod-tab"
                      onClick={() => setActiveModule(tab.key)}
                      style={{
                        flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        padding:'9px 2px 8px', border:'none',
                        borderBottom: activeModule === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                        background: activeModule === tab.key ? '#eff6ff' : 'transparent',
                        color: activeModule === tab.key ? '#2563eb' : '#64748b',
                        cursor:'pointer', fontSize:9.5, fontWeight:700,
                        textTransform:'uppercase', letterSpacing:'0.04em',
                        transition:'all 0.15s', whiteSpace:'nowrap', marginBottom:'-2px',
                      }}>
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>

                {/* module content */}
                <div style={{ flex:1, overflowY:'auto', position:'relative' }}>
                  <div style={{ display: activeModule === 'population'   ? 'block' : 'none' }}><PopulationModule /></div>
                  <div style={{ display: activeModule === 'water_demand' ? 'block' : 'none' }}><WaterDemandModule /></div>
                  <div style={{ display: activeModule === 'water_supply' ? 'block' : 'none' }}><WaterSupplyModule /></div>
                  <div style={{ display: activeModule === 'sewage'       ? 'block' : 'none' }}><SewageModule /></div>
                </div>
              </div>
            </div>
          )}

        </div>{/* /main row */}
      </div>
    </>
  );
}
