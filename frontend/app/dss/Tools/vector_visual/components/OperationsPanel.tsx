'use client';

import React, { useState, useRef, useEffect } from 'react';

const PANEL_OPS = [
  { id: 'intersection',            icon: 'fg-intersection',    name: 'Intersect',     cat: 'Overlay',   color: '#0ea5e9' },
  { id: 'union',                   icon: 'fg-union',           name: 'Union',         cat: 'Overlay',   color: '#0ea5e9' },
  { id: 'difference',              icon: 'fg-difference',      name: 'Difference',    cat: 'Overlay',   color: '#0ea5e9' },
  { id: 'symmetric_difference',    icon: 'fg-sym-difference',  name: 'Sym. Diff',     cat: 'Overlay',   color: '#0ea5e9' },
  { id: 'clip',                    icon: 'fg-copy-poly',       name: 'Clip',          cat: 'Overlay',   color: '#0ea5e9' },
  { id: 'buffer',                  icon: 'fg-buffer',          name: 'Buffer',        cat: 'Geometric', color: '#8b5cf6' },
  { id: 'dissolve',                icon: 'fg-dilatation',      name: 'Dissolve',      cat: 'Geometric', color: '#8b5cf6' },
  { id: 'centroid',                icon: 'fg-point',           name: 'Centroid',      cat: 'Geometric', color: '#8b5cf6' },
  { id: 'convex_hull',             icon: 'fg-convex-hull',     name: 'Conv. Hull',    cat: 'Geometric', color: '#8b5cf6' },
  { id: 'bounding_box',            icon: 'fg-bbox',            name: 'Bbox',          cat: 'Geometric', color: '#8b5cf6' },
  { id: 'simplify',                icon: 'fg-simplify',        name: 'Simplify',      cat: 'Geometric', color: '#8b5cf6' },
  { id: 'rotate',                  icon: 'fg-rotate',          name: 'Rotate',        cat: 'Geometric', color: '#8b5cf6' },
  { id: 'scale',                   icon: 'fg-scale',           name: 'Scale',         cat: 'Geometric', color: '#8b5cf6' },
  { id: 'translate',               icon: 'fg-move',            name: 'Translate',     cat: 'Geometric', color: '#8b5cf6' },
  { id: 'minimum_bounding_circle', icon: 'fg-circle',          name: 'Min. Circle',   cat: 'Geometric', color: '#8b5cf6' },
  { id: 'polygon_to_line',         icon: 'fg-polyline-pt',     name: 'Poly→Line',     cat: 'Geometric', color: '#8b5cf6' },
  { id: 'statistics',              icon: 'fg-layer-stat',      name: 'Statistics',    cat: 'Analysis',  color: '#10b981' },
  { id: 'spatial_join',            icon: 'fg-layer-stack',     name: 'Spatial Join',  cat: 'Analysis',  color: '#10b981' },
  { id: 'nearest',                 icon: 'fg-location-arrow',  name: 'Nearest',       cat: 'Analysis',  color: '#10b981' },
  { id: 'point_in_polygon',        icon: 'fg-polygon-pt',      name: 'Pt in Poly',    cat: 'Analysis',  color: '#10b981' },
  { id: 'area_comparison',         icon: 'fg-measure-area',    name: 'Area Comp',     cat: 'Analysis',  color: '#10b981' },
  { id: 'topology_check',          icon: 'fg-map-edit',        name: 'Topology',      cat: 'Analysis',  color: '#10b981' },
  { id: 'euclidean_distance',      icon: 'fg-measure-line',    name: 'Euclidean',     cat: 'Analysis',  color: '#10b981' },
  { id: 'merge',                   icon: 'fg-layers',          name: 'Merge',         cat: 'Utility',   color: '#f59e0b' },
  { id: 'filter',                  icon: 'fg-search-feature',  name: 'Filter',        cat: 'Utility',   color: '#f59e0b' },
  { id: 'voronoi',                 icon: 'fg-voronoi-map',     name: 'Voronoi',       cat: 'Utility',   color: '#f59e0b' },
  { id: 'reproject',               icon: 'fg-coord-system',    name: 'Reproject',     cat: 'Utility',   color: '#f59e0b' },
  { id: 'snap_to_grid',            icon: 'fg-snap',            name: 'Snap Grid',     cat: 'Utility',   color: '#f59e0b' },
];

const CATS = [
  { id: 'Overlay',   label: 'Overlay',   icon: 'fg-intersection', color: '#0ea5e9' },
  { id: 'Geometric', label: 'Geometric', icon: 'fg-polygon-pt',   color: '#8b5cf6' },
  { id: 'Analysis',  label: 'Analysis',  icon: 'fg-layer-stat',   color: '#10b981' },
  { id: 'Utility',   label: 'Utility',   icon: 'fg-earth-gear',   color: '#f59e0b' },
];

interface OperationsPanelProps {
  onOpenSpatialAnalysis: (operationId?: string) => void;
}

export default function OperationsPanel({ onOpenSpatialAnalysis }: OperationsPanelProps) {
  const [pos, setPos] = useState({ x: 60, y: 10 });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [opsSize, setOpsSize] = useState({ w: 420, h: 0 });

  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragRef = useRef({ mouseX: 0, mouseY: 0, panelX: 0, panelY: 0 });
  const resizeRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  const onPanelMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'button' || tag === 'input' || tag === 'select') return;
    if ((e.target as HTMLElement).dataset.resize) return;
    isDragging.current = true;
    dragRef.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: pos.x, panelY: pos.y };
    e.preventDefault();
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizing.current = true;
    resizeRef.current = { mouseX: e.clientX, mouseY: e.clientY, w: opsSize.w, h: opsSize.h || 200 };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPos({
          x: dragRef.current.panelX + e.clientX - dragRef.current.mouseX,
          y: dragRef.current.panelY + e.clientY - dragRef.current.mouseY,
        });
      }
      if (isResizing.current) {
        setOpsSize({
          w: Math.max(280, resizeRef.current.w + e.clientX - resizeRef.current.mouseX),
          h: Math.max(80, resizeRef.current.h + e.clientY - resizeRef.current.mouseY),
        });
      }
    };
    const onMouseUp = () => { isDragging.current = false; isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const activeCat = CATS.find(c => c.id === activeCategory);

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        zIndex: 1000,
        pointerEvents: 'auto',
        userSelect: 'none',
        filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.18))',
      }}
      onMouseDown={onPanelMouseDown}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: activeCategory ? '10px 10px 0 0' : 10,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid #e2e8f0',
          borderBottom: activeCategory ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
          cursor: 'grab',
          minWidth: 'max-content',
          boxShadow: activeCategory ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
        }}
      >
        {/* Drag dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.35, flexShrink: 0 }}>
          {[0, 1, 2].map(r => (
            <div key={r} style={{ display: 'flex', gap: 2 }}>
              {[0, 1].map(c => <div key={c} style={{ width: 3, height: 3, borderRadius: '50%', background: '#64748b' }} />)}
            </div>
          ))}
        </div>

        <span style={{ color: '#334155', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="fg-earth-gear" style={{ fontSize: 13 }} /> Operations
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          {CATS.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(prev => prev === cat.id ? null : cat.id)}
              style={{
                background: activeCategory === cat.id ? cat.color : '#f8fafc',
                border: `1px solid ${activeCategory === cat.id ? cat.color : '#e2e8f0'}`,
                color: activeCategory === cat.id ? '#fff' : '#475569',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: 0.3,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (activeCategory !== cat.id) {
                  (e.currentTarget as HTMLElement).style.background = cat.color + '15';
                  (e.currentTarget as HTMLElement).style.borderColor = cat.color + '60';
                  (e.currentTarget as HTMLElement).style.color = cat.color;
                }
              }}
              onMouseLeave={e => {
                if (activeCategory !== cat.id) {
                  (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                  (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                  (e.currentTarget as HTMLElement).style.color = '#475569';
                }
              }}
            >
              <i className={cat.icon} style={{ fontSize: 12 }} /> {cat.label}
            </button>
          ))}

          <button
            onClick={() => { setActiveCategory(null); onOpenSpatialAnalysis(); }}
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.3,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e0f2fe'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; }}
          >
            ALL ▸
          </button>
        </div>
      </div>

      {/* ── Operations grid ── */}
      {activeCategory && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            width: opsSize.w,
            minHeight: opsSize.h > 0 ? opsSize.h : undefined,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            position: 'relative',
            cursor: 'grab',
          }}
        >
          {/* Category label */}
          <div style={{ width: '100%', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: activeCat?.color, textTransform: 'uppercase',
              letterSpacing: 0.8, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <i className={activeCat?.icon} style={{ fontSize: 13 }} /> {activeCat?.label}
            </span>
            <div style={{ flex: 1, height: 1, background: activeCat?.color + '30' }} />
          </div>

          {PANEL_OPS.filter(op => op.cat === activeCategory).map(op => (
            <button
              key={op.id}
              onClick={() => { onOpenSpatialAnalysis(op.id); setActiveCategory(null); }}
              title={op.name}
              style={{
                background: '#f8fafc',
                border: `1px solid ${op.color}40`,
                color: '#334155',
                borderRadius: 7,
                padding: '6px 11px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = op.color + '12';
                (e.currentTarget as HTMLElement).style.borderColor = op.color;
                (e.currentTarget as HTMLElement).style.color = op.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${op.color}30`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                (e.currentTarget as HTMLElement).style.borderColor = op.color + '40';
                (e.currentTarget as HTMLElement).style.color = '#334155';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
              }}
            >
              <i className={op.icon} style={{ color: op.color, fontSize: 14 }} />
              {op.name}
            </button>
          ))}

          {/* Resize handle */}
          <div
            data-resize="true"
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 18,
              height: 18,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: 3,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4 }}>
              <path d="M9 1 L9 9 L1 9" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 5 L9 9 L5 9" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
