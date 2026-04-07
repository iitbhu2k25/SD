'use client';

import { useState, useRef, useEffect } from 'react';
import { useBasicStore, type ActiveModule } from '../shared/store/basic.store';
import LocationSelector from '../shared/components/LocationSelector';
import DrainLocationSelector from '../shared/components/DrainLocationSelector';
import IndCatchmentSelector from '../shared/components/IndCatchmentSelector';
import MapView from '../shared/components/MapView';
import PopulationModule from '../populations/PopulationModule';
import WaterDemandModule from '../water_demand/WaterDemandModule';
import WaterSupplyModule from '../water_supply/WaterSupplyModule';
import SewageModule from '../seawage/SewageModule';
import BasicModuleInfo from './BasicModuleInfo';
import type { LocationMode } from '../shared/types/location.types';
import {
  Layers, GitBranch, MapPin, RotateCcw,
  Users, Droplets, Waves, FlaskConical,
  ChevronLeft, ChevronRight,
  Info, X, Lock, CheckCircle,
} from 'lucide-react';

const MODULE_ORDER: ActiveModule[] = ['population', 'water_demand', 'water_supply', 'sewage'];


/* ─── constants ──────────────────────────────────────────────────── */
const STRIP_W   = 52;
const LEFT_W    = 300;
const RIGHT_W   = 680;   // right panel default width
const RIGHT_MIN = 580;   // right panel minimum width (drag cannot go below this)
const RIGHT_MAX = 960;
const EASE      = '0.3s cubic-bezier(0.4,0,0.2,1)';

const MODES: { key: LocationMode; label: string; icon: React.ReactNode }[] = [
  { key: 'admin',           label: 'Admin\nMode',  icon: <Layers    size={18} /> },
  { key: 'drain',           label: 'Drain',        icon: <GitBranch size={18} /> },
  // { key: 'india_catchment', label: 'India\nCatch', icon: <Globe     size={18} /> },
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
    setThematicMapMethod,
    populationForecast, waterDemandTotals, waterSupplyTotal, sewageReportData,
  } = useBasicStore();

  // Default thematic method per module — keeps legend in sync when switching tabs
  const MODULE_THEMATIC: Partial<Record<ActiveModule, string>> = {
    population:   'Arithmetic',
    water_demand: 'Domestic',
    water_supply: 'Water Supply',
    sewage:       'Population Based',
  };

  const isSaved: Record<ActiveModule, boolean> = {
    population:   !!populationForecast,
    water_demand: !!waterDemandTotals,
    water_supply: !!waterSupplyTotal,
    sewage:       !!sewageReportData,
  };

  const activeIdx = MODULE_ORDER.indexOf(activeModule);

  // Can click tab at index i: always go back, go forward only if current is saved
  const canClickTab = (i: number) =>
    i <= activeIdx || (i === activeIdx + 1 && isSaved[activeModule]);

  const handleTabClick = (key: ActiveModule) => {
    const i = MODULE_ORDER.indexOf(key);
    if (!canClickTab(i)) return;
    setActiveModule(key);
    const m = MODULE_THEMATIC[key];
    if (m) setThematicMapMethod(m);
  };

  const isConfirmed = !!confirmedLocation;
  const [showModal, setShowModal] = useState(false);

  const [leftOpen,  setLeftOpen]  = useState(true);

  // Auto-hide left panel when location is confirmed
  useEffect(() => {
    if (isConfirmed) setLeftOpen(false);
  }, [isConfirmed]);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(RIGHT_W);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, width: 0, moved: false });

  const handleDraggerMouseDown = (e: React.MouseEvent) => {
    if (!rightOpen) return; // closed → click handled by onClick
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, width: rightWidth, moved: false };
    const onMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - dragStartRef.current.x);
      if (dx > 4) {
        dragStartRef.current.moved = true;
        setIsDragging(true);
      }
      if (dragStartRef.current.moved) {
        const delta = dragStartRef.current.x - ev.clientX;
        setRightWidth(Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, dragStartRef.current.width + delta)));
      }
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleDraggerClick = () => {
    if (!isDragging) setRightOpen(v => !v);
  };

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
        @keyframes ping   { 75%,100%{transform:scale(1.8);opacity:0} }
        .strip-btn:hover { background:rgba(255,255,255,0.1)!important; }
        .mod-tab:hover   { background:#eff6ff!important; color:#2563eb!important; }
      `}</style>

      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

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
              left: 5,
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
                  display:'flex', flexDirection:'column',
                  padding:'10px 14px 8px',
                  borderBottom:'1px solid #f1f5f9',
                  background:'#f8fafc', flexShrink:0,
                  gap:6,
                }}>
                  {/* top row: Basic Module heading + info btn */}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:15, fontWeight:800, color:'#083cb6', letterSpacing:'-0.2px', flex:1 }}>
                      Basic Module
                    </span>
                    <button type="button" onClick={() => setShowModal(true)} title="View module information"
                      style={{ width:26, height:26, borderRadius:7, border:'1px solid #e2e8f0', background:'#f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>
                      <Info size={13}/>
                    </button>
                  </div>
                  {/* bottom row: location label + badge */}
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <MapPin size={13} color="#2563eb"/>
                    <span style={{ fontSize:10, fontWeight:700, color:'#1e293b', textTransform:'uppercase', letterSpacing:'0.07em' }}>
                      {isConfirmed ? 'Location' : 'Select Location'}
                    </span>
                    {isConfirmed
                      ? <span style={{ fontSize:9, fontWeight:700, background:'#dcfce7', color:'#15803d', borderRadius:20, padding:'2px 8px' }}>Confirmed</span>
                      : <span style={{ fontSize:9, fontWeight:700, background:'#fef3c7', color:'#92400e', borderRadius:20, padding:'2px 8px' }}>
                          {mode === 'admin' ? 'Admin' : mode === 'drain' ? 'Drain' : 'India'}
                        </span>
                    }
                  </div>
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Left panel pill toggle — always centered, follows panel edge ── */}
            <button
              type="button"
              onClick={() => setLeftOpen(v => !v)}
              title={leftOpen ? 'Hide panel' : 'Show panel'}
              style={{
                position: 'absolute',
                top: '50%',
                left: leftOpen ? LEFT_W + 5 + 4 : 4,
                transform: 'translateY(-50%)',
                zIndex: 21,
                width: 20,
                height: 40,
                borderRadius: 5,
                border: 'none',
                background: isConfirmed ? '#2563eb' : '#2563eb',
                boxShadow: isConfirmed
                  ? '0 2px 8px rgba(22,163,74,0.4)'
                  : '0 2px 8px rgba(37,99,235,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: `left ${EASE}, background 0.2s`,
              }}
            >
              {leftOpen
                ? <ChevronLeft  size={12} color="#fff" strokeWidth={2.5}/>
                : <ChevronRight size={12} color="#fff" strokeWidth={2.5}/>
              }
            </button>


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

          {/* ── DRAGGER — transparent strip for drag; small pill button centered for toggle ── */}
          {isConfirmed && (() => {
            const saved = isSaved[activeModule];
            const accent = saved ? '#16a34a' : '#2563eb';
            return (
              <div
                onMouseDown={handleDraggerMouseDown}
                title={rightOpen ? 'Drag to resize' : ''}
                style={{
                  width: 10, flexShrink: 0, zIndex: 25,
                  cursor: rightOpen ? 'col-resize' : 'default',
                  position: 'relative',
                  userSelect: 'none',
                  background: 'transparent',
                }}
              >
                {/* mini pill toggle button — centered, not full height */}
                <button
                  type="button"
                  onClick={handleDraggerClick}
                  title={rightOpen ? 'Hide panel' : 'Show panel'}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 20,
                    height: 40,
                    borderRadius: 5,
                    border: 'none',
                    background: accent,
                    boxShadow: `0 2px 8px ${saved ? 'rgba(22,163,74,0.4)' : 'rgba(37,99,235,0.4)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    zIndex: 1,
                  }}
                >
                  {rightOpen
                    ? <ChevronRight size={12} color="#fff" strokeWidth={2.5}/>
                    : <ChevronLeft  size={12} color="#fff" strokeWidth={2.5}/>
                  }
                </button>
              </div>
            );
          })()}

          {/* ── RIGHT PANEL (flex sibling — does NOT overlap the map) ── */}
          {isConfirmed && (
            <div style={{
              width: rightOpen ? rightWidth : 0,
              flexShrink: 0,
              overflow: 'hidden',
              transition: isDragging ? 'none' : `width ${EASE}`,
            }}>
              <div style={{
                width: rightWidth,
                height: '100%',
                background: '#fff',
                borderLeft: '1px solid #e2e8f0',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* module tabs */}
                {(() => {
                  const isNarrow = rightWidth < 420;
                  return (
                    <div style={{ display:'flex', flexShrink:0, borderBottom:'2px solid #f1f5f9', background:'#fff' }}>
                      {MODULE_TABS.map((tab, i) => {
                        const isActive  = activeModule === tab.key;
                        const saved     = isSaved[tab.key];
                        const clickable = canClickTab(i);
                        const borderColor = isActive ? '#2563eb' : saved ? '#16a34a' : 'transparent';
                        const bgColor     = isActive ? '#eff6ff' : saved ? '#f0fdf4' : 'transparent';
                        const textColor   = isActive ? '#2563eb' : saved ? '#16a34a' : clickable ? '#64748b' : '#cbd5e1';
                        return (
                          <button key={tab.key} type="button"
                            onClick={() => handleTabClick(tab.key)}
                            title={!clickable ? 'Save current module first' : isNarrow ? tab.label : undefined}
                            disabled={!clickable}
                            style={{
                              flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative',
                              gap: isNarrow ? 0 : 3,
                              padding: isNarrow ? '10px 4px' : '9px 2px 8px', border:'none',
                              borderBottom: `2px solid ${borderColor}`,
                              background: bgColor,
                              color: textColor,
                              cursor: clickable ? 'pointer' : 'not-allowed',
                              fontSize:9.5, fontWeight:700,
                              textTransform:'uppercase', letterSpacing:'0.04em',
                              transition:'all 0.15s', whiteSpace:'nowrap', marginBottom:'-2px',
                              opacity: clickable ? 1 : 10,
                            }}>
                            {/* saved checkmark badge
                            {saved && (
                              <span style={{ position:'absolute', top:3, right:4 }}>
                                <CheckCircle size={9} color="#16a34a"/>
                              </span>
                            )} */}
                            {/* locked badge
                            {!clickable && (
                              <span style={{ position:'absolute', top:3, right:4 }}>
                                <Lock size={9} color="#cbd5e1"/>
                              </span>
                            )} */}
                            {tab.icon}
                            {!isNarrow && tab.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

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

      {/* ── Info modal ── */}
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
