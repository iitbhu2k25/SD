import React from 'react';

interface MapControlsProps {
  mapInstance: any;
  onHomeClick: () => void;
  onLocateClick: () => void;
  onFullScreen: () => void;
  onBufferToggle: () => void;
  onExportClick: () => void;
}

const BTN: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#444',
  fontSize: 15,
  fontWeight: 700,
  transition: 'background 0.12s, color 0.12s',
  lineHeight: 1,
  padding: 0,
};

const STRIP: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)',
  border: '1px solid rgba(0,0,0,0.25)',
  borderRadius: 4,
  boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const DIVIDER = (
  <div style={{ height: 1, background: 'rgba(0,0,0,0.15)', margin: '0 4px' }} />
);

function Btn({
  onClick, title, children, danger,
}: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...BTN,
        background: hov ? (danger ? '#fee2e2' : '#f4f4f4') : 'transparent',
        color: hov ? (danger ? '#dc2626' : '#1e40af') : '#444',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
}

export default function MapControls({
  mapInstance,
  onHomeClick,
  onLocateClick,
  onFullScreen,
  onExportClick,
}: MapControlsProps) {
  return (
    /* top-left, below Leaflet attribution/draw toolbar */
    <div
      className="pointer-events-auto"
      style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {/* ── Zoom strip ── */}
      <div style={STRIP}>
        <Btn onClick={() => mapInstance?.zoomIn()} title="Zoom in">
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
        </Btn>
        {DIVIDER}
        <Btn onClick={() => mapInstance?.zoomOut()} title="Zoom out">
          <span style={{ fontSize: 18, lineHeight: 1, letterSpacing: '-1px' }}>−</span>
        </Btn>
      </div>

      {/* ── Navigation strip ── */}
      <div style={STRIP}>
        <Btn onClick={onHomeClick} title="Home (India view)">
          {/* house icon via SVG for crisp rendering */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L1 8h2v6h4v-4h2v4h4V8h2L8 1z"/>
          </svg>
        </Btn>
        {DIVIDER}
        <Btn onClick={onLocateClick} title="Find my location">
          {/* crosshair target */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="3"/>
            <line x1="8" y1="1" x2="8" y2="4"/>
            <line x1="8" y1="12" x2="8" y2="15"/>
            <line x1="1" y1="8" x2="4" y2="8"/>
            <line x1="12" y1="8" x2="15" y2="8"/>
          </svg>
        </Btn>
      </div>

      {/* ── Utility strip ── */}
      <div style={STRIP}>
        <Btn onClick={onFullScreen} title="Toggle fullscreen">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <polyline points="1,5 1,1 5,1"/>
            <polyline points="11,1 15,1 15,5"/>
            <polyline points="15,11 15,15 11,15"/>
            <polyline points="5,15 1,15 1,11"/>
          </svg>
        </Btn>
        {DIVIDER}
        <Btn onClick={onExportClick} title="Export map" danger>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8,2 8,10"/>
            <polyline points="5,7 8,10 11,7"/>
            <path d="M2,12 v1 a1,1 0 0,0 1,1 h10 a1,1 0 0,0 1,-1 v-1"/>
          </svg>
        </Btn>
      </div>
    </div>
  );
}
