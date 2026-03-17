'use client';

import React, { useState, useRef, useEffect } from 'react';
import AttributeTableModal from './AttributeTableModal';

interface ManagedLayer {
  id: string;
  name: string;
  layer: any;
  visible: boolean;
  type: 'geojson' | 'uploaded' | 'drawn';
}

interface LayersPanelProps {
  managedLayers: ManagedLayer[];
  isOpen: boolean;
  onToggle: () => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleEditable: (id: string) => void;
  editableLayers: Set<string>;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onFeatureSelect?: (feature: any, layer: any) => void;
}

const DEFAULT_STYLE = { lineColor: '#e53e3e', fillColor: '#78b4db', opacity: 0.5, weight: 2 };

const typeColor: Record<string, string> = { geojson: '#3b82f6', uploaded: '#10b981', drawn: '#f59e0b' };
const typeLabel: Record<string, string> = { geojson: 'GeoJSON', uploaded: 'Shapefile', drawn: 'Drawn' };

function applyStyle(layer: any, style: typeof DEFAULT_STYLE) {
  const s = { color: style.lineColor, weight: style.weight, opacity: 1, fillColor: style.fillColor, fillOpacity: style.opacity };
  try {
    if (typeof layer.setStyle === 'function') { layer.setStyle(s); return; }
    if (typeof layer.eachLayer === 'function') {
      layer.eachLayer((l: any) => { if (typeof l.setStyle === 'function') l.setStyle(s); });
    }
  } catch { /* noop */ }
}

export default function LayersPanel({
  managedLayers,
  isOpen,
  onToggle,
  onToggleVisibility,
  onRemove,
  onToggleEditable,
  editableLayers,
  showNotification,
  onFeatureSelect,
}: LayersPanelProps) {
  const [attrTable, setAttrTable] = useState<{ open: boolean; layerId: string; layerName: string; leafletLayer: any }>
    ({ open: false, layerId: '', layerName: '', leafletLayer: null });

  const [openStyleId, setOpenStyleId] = useState<string | null>(null);
  const [layerStyles, setLayerStyles] = useState<Record<string, typeof DEFAULT_STYLE>>({});

  // Draggable / resizable panel state
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [panelSize, setPanelSize] = useState({ w: 370, h: 520 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragRef = useRef({ mouseX: 0, mouseY: 0, panelX: 0, panelY: 0 });
  const resizeRef = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Reset position when panel closes so next open re-anchors below button
  useEffect(() => {
    if (!isOpen) setPanelPos(null);
  }, [isOpen]);

  // Set initial position below toggle button when first opened
  useEffect(() => {
    if (isOpen && panelPos === null) {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setPanelPos({
          x: Math.max(0, rect.right - panelSize.w),
          y: rect.bottom + 6,
        });
      } else {
        setPanelPos({ x: typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 400) : 100, y: 60 });
      }
    }
  }, [isOpen, panelPos, panelSize.w]);

  // Global mouse events for drag + resize
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPanelPos({
          x: dragRef.current.panelX + e.clientX - dragRef.current.mouseX,
          y: dragRef.current.panelY + e.clientY - dragRef.current.mouseY,
        });
      }
      if (isResizing.current) {
        setPanelSize({
          w: Math.max(300, resizeRef.current.w + e.clientX - resizeRef.current.mouseX),
          h: Math.max(220, resizeRef.current.h + e.clientY - resizeRef.current.mouseY),
        });
      }
    };
    const onMouseUp = () => { isDragging.current = false; isResizing.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,label')) return;
    isDragging.current = true;
    dragRef.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: panelPos?.x ?? 0, panelY: panelPos?.y ?? 0 };
    e.preventDefault();
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    isResizing.current = true;
    resizeRef.current = { mouseX: e.clientX, mouseY: e.clientY, w: panelSize.w, h: panelSize.h };
  };

  const getStyle = (id: string) => layerStyles[id] ?? DEFAULT_STYLE;

  const updateStyle = (ml: ManagedLayer, key: keyof typeof DEFAULT_STYLE, value: any) => {
    const updated = { ...getStyle(ml.id), [key]: value };
    setLayerStyles(prev => ({ ...prev, [ml.id]: updated }));
    applyStyle(ml.layer, updated);
  };

  const openAttributeTable = (ml: ManagedLayer) =>
    setAttrTable({ open: true, layerId: ml.id, layerName: ml.name, leafletLayer: ml.layer });

  return (
    <>
      {/* ── Toggle button (white, fixed position) ── */}
      <div className="absolute pointer-events-auto" style={{ top: 12, right: 55, zIndex: 1001 }}>
        <button
          ref={btnRef}
          onClick={onToggle}
          title="Toggle Layers Panel"
          style={{
            background: isOpen ? '#2563eb' : '#fff',
            color: isOpen ? '#fff' : '#2563eb',
            border: `1.5px solid ${isOpen ? '#2563eb' : '#bfdbfe'}`,
            borderRadius: 8,
            padding: '6px 13px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            letterSpacing: 0.4,
            transition: 'all 0.18s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            if (!isOpen) {
              (e.currentTarget as HTMLElement).style.background = '#eff6ff';
              (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd';
            }
          }}
          onMouseLeave={e => {
            if (!isOpen) {
              (e.currentTarget as HTMLElement).style.background = '#fff';
              (e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe';
            }
          }}
        >
          <i className="fg-layers" style={{ fontSize: 13 }} /> Layers
          {managedLayers.length > 0 && (
            <span style={{
              background: isOpen ? 'rgba(255,255,255,0.25)' : '#dbeafe',
              color: isOpen ? '#fff' : '#1d4ed8',
              fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700, minWidth: 18, textAlign: 'center',
            }}>
              {managedLayers.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Floating draggable+resizable panel ── */}
      {isOpen && panelPos && (
        <div
          style={{
            position: 'fixed',
            left: panelPos.x,
            top: panelPos.y,
            width: panelSize.w,
            height: panelSize.h,
            zIndex: 2000,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* ── Panel header (drag handle) ── */}
          <div
            onMouseDown={startDrag}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Drag dots */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.5 }}>
                {[0, 1, 2].map(r => (
                  <div key={r} style={{ display: 'flex', gap: 2 }}>
                    {[0, 1].map(c => <div key={c} style={{ width: 3, height: 3, borderRadius: '50%', background: '#fff' }} />)}
                  </div>
                ))}
              </div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fg-layers" style={{ fontSize: 14 }} /> LAYERS
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#93c5fd', fontSize: 10, background: 'rgba(255,255,255,0.12)', padding: '1px 8px', borderRadius: 10, fontFamily: 'monospace' }}>
                {managedLayers.length} layer{managedLayers.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={onToggle}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'; }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Layer list ── */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {managedLayers.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 }}>
                NO LAYERS LOADED
              </div>
            ) : (
              [...managedLayers].reverse().map(ml => {
                const isEditable = editableLayers.has(ml.id);
                const isStyleOpen = openStyleId === ml.id;
                const style = getStyle(ml.id);
                return (
                  <div
                    key={ml.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isEditable ? '#f0fdf4' : '#fff',
                    }}
                  >
                    {/* Row 1: visibility + name + type badge */}
                    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Visibility toggle */}
                      <button
                        onClick={() => onToggleVisibility(ml.id)}
                        title={ml.visible ? 'Hide layer' : 'Show layer'}
                        style={{
                          background: ml.visible ? '#eff6ff' : '#f8fafc',
                          border: `1px solid ${ml.visible ? '#bfdbfe' : '#cbd5e1'}`,
                          borderRadius: 5, cursor: 'pointer', padding: '2px 5px',
                          fontSize: 13, color: ml.visible ? '#2563eb' : '#94a3b8', flexShrink: 0, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = ml.visible ? '#dbeafe' : '#f1f5f9'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ml.visible ? '#eff6ff' : '#f8fafc'; }}
                      >
                        <i className={ml.visible ? 'fg-layer' : 'fg-layer-o'} style={{ fontSize: 12 }} />
                      </button>

                      {/* Layer name */}
                      <span
                        style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={ml.name}
                      >
                        {ml.name}
                      </span>

                      {/* Type badge */}
                      <span style={{
                        background: typeColor[ml.type] + '18', color: typeColor[ml.type],
                        fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 700, letterSpacing: 0.5, fontFamily: 'monospace', flexShrink: 0,
                      }}>
                        {typeLabel[ml.type]}
                      </span>
                    </div>

                    {/* Row 2: action buttons */}
                    <div style={{ paddingLeft: 38, paddingRight: 14, paddingBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {/* TABLE */}
                      <button onClick={() => openAttributeTable(ml)} title="Open Attribute Table"
                        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 5, padding: '3px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'monospace', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dbeafe'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                      ><i className="fg-search-attribtues" style={{ fontSize: 10 }} /> TABLE</button>

                      {/* STYLE */}
                      <button
                        onClick={() => setOpenStyleId(prev => prev === ml.id ? null : ml.id)}
                        title="Edit layer style"
                        style={{
                          background: isStyleOpen ? '#fdf4ff' : '#faf5ff',
                          border: `1px solid ${isStyleOpen ? '#a855f7' : '#d8b4fe'}`,
                          color: isStyleOpen ? '#a855f7' : '#7c3aed',
                          borderRadius: 5, padding: '3px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'monospace', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f3e8ff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isStyleOpen ? '#fdf4ff' : '#faf5ff'; }}
                      ><i className="fg-color" style={{ fontSize: 10 }} /> STYLE</button>

                      {/* EDIT */}
                      <button onClick={() => onToggleEditable(ml.id)} title={isEditable ? 'Lock layer' : 'Enable editing'}
                        style={{ background: isEditable ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isEditable ? '#86efac' : '#cbd5e1'}`, color: isEditable ? '#16a34a' : '#475569', borderRadius: 5, padding: '3px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'monospace', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isEditable ? '#dcfce7' : '#f1f5f9'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isEditable ? '#f0fdf4' : '#f8fafc'; }}
                      ><i className="fg-layer-edit" style={{ fontSize: 10 }} /> {isEditable ? 'EDIT ON' : 'EDIT'}</button>

                      {/* ZOOM */}
                      <button
                        onClick={() => { try { const b = ml.layer?.getBounds?.(); if (b?.isValid()) window.dispatchEvent(new CustomEvent('zoomToLayer', { detail: { bounds: b } })); } catch {} }}
                        title="Zoom to layer"
                        style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 5, padding: '3px 7px', fontSize: 11, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e0f2fe'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; }}
                      ><i className="fg-extent" style={{ fontSize: 11 }} /></button>

                      {/* REMOVE */}
                      <button onClick={() => onRemove(ml.id)} title="Remove layer"
                        style={{ background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 5, padding: '3px 7px', fontSize: 11, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff5f5'; }}
                      ><i className="fg-layer-rm" style={{ fontSize: 11 }} /></button>
                    </div>

                    {/* ── Style Editor ── */}
                    {isStyleOpen && (
                      <div style={{ margin: '0 14px 12px 38px', padding: '10px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', marginBottom: 8, letterSpacing: 0.5, fontFamily: 'monospace' }}>
                          LAYER STYLE
                        </div>

                        {/* Colors row */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                          {/* Line Color */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <label style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>LINE COLOR</label>
                            <div style={{ position: 'relative', width: 32, height: 24 }}>
                              <input type="color" value={style.lineColor}
                                onChange={e => updateStyle(ml, 'lineColor', e.target.value)}
                                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                              />
                              <div style={{ width: 32, height: 24, borderRadius: 5, border: '2px solid #e5e7eb', background: style.lineColor, cursor: 'pointer' }} />
                            </div>
                          </div>

                          {/* Fill Color */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <label style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>FILL COLOR</label>
                            <div style={{ position: 'relative', width: 32, height: 24 }}>
                              <input type="color" value={style.fillColor}
                                onChange={e => updateStyle(ml, 'fillColor', e.target.value)}
                                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                              />
                              <div style={{ width: 32, height: 24, borderRadius: 5, border: '2px solid #e5e7eb', background: style.fillColor, cursor: 'pointer' }} />
                            </div>
                          </div>
                        </div>

                        {/* Opacity slider */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <label style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>OPACITY</label>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>{style.opacity.toFixed(1)}</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={style.opacity}
                            onChange={e => updateStyle(ml, 'opacity', parseFloat(e.target.value))}
                            style={{ width: '100%', height: 4, accentColor: '#7c3aed', cursor: 'pointer' }}
                          />
                        </div>

                        {/* Weight slider */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <label style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: 0.3 }}>LINE WEIGHT</label>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>{style.weight}px</span>
                          </div>
                          <input type="range" min={1} max={10} step={1} value={style.weight}
                            onChange={e => updateStyle(ml, 'weight', parseInt(e.target.value))}
                            style={{ width: '100%', height: 4, accentColor: '#7c3aed', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Resize handle (bottom-right) ── */}
          <div
            onMouseDown={startResize}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20, cursor: 'nwse-resize',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity: 0.35 }}>
              <path d="M11 1 L11 11 L1 11" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 6 L11 11 L6 11" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}

      {/* ── Attribute Table Modal ── */}
      <AttributeTableModal
        isOpen={attrTable.open}
        onClose={() => setAttrTable(prev => ({ ...prev, open: false }))}
        layerName={attrTable.layerName}
        leafletLayer={attrTable.leafletLayer}
        showNotification={showNotification}
        onFeatureSelect={(feature, layer) => onFeatureSelect?.(feature, layer)}
      />
    </>
  );
}
