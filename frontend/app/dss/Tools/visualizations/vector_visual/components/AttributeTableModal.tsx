'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface AttributeRow {
  id: number;
  properties: Record<string, any>;
  layer: any;
}

interface AttributeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerName: string;
  leafletLayer: any;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  onFeatureSelect?: (feature: any, layer: any) => void;
}

export default function AttributeTableModal({
  isOpen,
  onClose,
  layerName,
  leafletLayer,
  showNotification,
  onFeatureSelect,
}: AttributeTableModalProps) {
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDefault, setNewColDefault] = useState('');
  const [sortConfig, setSortConfig] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 900, h: 420 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ my: 0, h: 0, py: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Centre the panel when it first opens
  useEffect(() => {
    if (isOpen && mounted) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(900, vw - 40);
      const h = 420;
      setSize({ w, h });
      setPos({ x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2) });
    }
  }, [isOpen, mounted]);

  // ── Drag handlers ──
  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ── Resize from top edge ──
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { my: e.clientY, h: size.h, py: pos.y };
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - resizeStart.current.my;
      const newH = Math.max(200, resizeStart.current.h - dy);
      const newY = resizeStart.current.py + (resizeStart.current.h - newH);
      setSize(s => ({ ...s, h: newH }));
      setPos(p => ({ ...p, y: newY }));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  // ── Data ──
  const buildRows = useCallback(() => {
    if (!leafletLayer) return;
    const newRows: AttributeRow[] = [];
    let idx = 0;
    const processLayer = (lyr: any) => {
      const feature = lyr.feature || lyr._feature;
      const props = feature?.properties ? { ...feature.properties } : {};
      newRows.push({ id: idx++, properties: props, layer: lyr });
    };
    if (typeof leafletLayer.eachLayer === 'function') {
      leafletLayer.eachLayer(processLayer);
    } else {
      processLayer(leafletLayer);
    }
    const colSet = new Set<string>();
    newRows.forEach(r => Object.keys(r.properties).forEach(k => colSet.add(k)));
    setRows(newRows);
    setColumns(Array.from(colSet));
    setSelectedRows(new Set());
  }, [leafletLayer]);

  useEffect(() => { if (isOpen) buildRows(); }, [isOpen, buildRows]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const startEdit = (e: React.MouseEvent, rowId: number, col: string, currentVal: any) => {
    e.stopPropagation();
    setEditingCell({ rowId, col });
    setEditValue(String(currentVal ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { rowId, col } = editingCell;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updatedProps = { ...r.properties, [col]: editValue };
      if (r.layer.feature) r.layer.feature.properties = updatedProps;
      else r.layer.feature = { type: 'Feature', geometry: null, properties: updatedProps };
      return { ...r, properties: updatedProps };
    }));
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(''); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const handleAddColumn = () => {
    const trimmed = newColName.trim();
    if (!trimmed) { showNotification('Error', 'Column name cannot be empty', 'error'); return; }
    if (columns.includes(trimmed)) { showNotification('Error', 'Column already exists', 'error'); return; }
    setColumns(prev => [...prev, trimmed]);
    setRows(prev => prev.map(r => {
      const updatedProps = { ...r.properties, [trimmed]: newColDefault };
      if (r.layer.feature) r.layer.feature.properties = updatedProps;
      return { ...r, properties: updatedProps };
    }));
    showNotification('Success', `Column "${trimmed}" added`, 'success');
    setAddingColumn(false); setNewColName(''); setNewColDefault('');
  };

  const handleDeleteColumn = (col: string) => {
    if (!window.confirm(`Delete column "${col}"?`)) return;
    setColumns(prev => prev.filter(c => c !== col));
    setRows(prev => prev.map(r => {
      const { [col]: _, ...rest } = r.properties;
      if (r.layer.feature) r.layer.feature.properties = rest;
      return { ...r, properties: rest };
    }));
    showNotification('Info', `Column "${col}" deleted`, 'info');
  };

  const handleDeleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    const count = selectedRows.size;
    if (!window.confirm(`Delete ${count} selected feature(s)?`)) return;
    setRows(prev => {
      prev.filter(r => selectedRows.has(r.id)).forEach(r => {
        if (leafletLayer && typeof leafletLayer.removeLayer === 'function') {
          try { leafletLayer.removeLayer(r.layer); } catch {}
        }
      });
      return prev.filter(r => !selectedRows.has(r.id));
    });
    setSelectedRows(new Set());
    showNotification('Success', `${count} feature(s) deleted`, 'success');
  };

  const toggleRowSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRowClick = (row: AttributeRow) => {
  // 1. Highlight the feature (passes both feature + layer, matching Map.tsx's onFeatureClick signature)
  if (onFeatureSelect) {
    const feature = row.layer?.feature ?? {
      type: 'Feature',
      geometry: null,
      properties: row.properties,
    };
    onFeatureSelect(feature, row.layer);
  }

  // 2. Zoom the map to the feature
  try {
    const lyr = row.layer;
    if (!lyr) return;

    // Polygon / polyline
    if (typeof lyr.getBounds === 'function') {
      const bounds = lyr.getBounds();
      if (bounds && bounds.isValid()) {
        window.dispatchEvent(new CustomEvent('zoomToLayer', { detail: { bounds } }));
        return;
      }
    }

    // Marker / circle-marker
    if (typeof lyr.getLatLng === 'function') {
      const latlng = lyr.getLatLng();
      window.dispatchEvent(new CustomEvent('zoomToLatLng', { detail: { latlng, zoom: 16 } }));
      return;
    }

    // FeatureGroup / LayerGroup
    if (typeof lyr.eachLayer === 'function') {
      let groupBounds: any = null;
      lyr.eachLayer((sub: any) => {
        if (typeof sub.getBounds === 'function') {
          const b = sub.getBounds();
          if (b?.isValid()) groupBounds = groupBounds ? groupBounds.extend(b) : b;
        } else if (typeof sub.getLatLng === 'function') {
          const ll = sub.getLatLng();
          if (ll) window.dispatchEvent(new CustomEvent('zoomToLatLng', { detail: { latlng: ll, zoom: 16 } }));
        }
      });
      if (groupBounds) {
        window.dispatchEvent(new CustomEvent('zoomToLayer', { detail: { bounds: groupBounds } }));
      }
    }
  } catch {
    /* zoom is best-effort */
  }
};

  const handleSort = (col: string) => {
    setSortConfig(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    );
  };

  const handleSaveAll = () => {
    showNotification('Success', 'All attribute changes saved to layer', 'success');
    onClose();
  };

  const filteredRows = rows.filter(r => {
    if (!searchTerm.trim()) return true;
    return Object.values(r.properties).some(v =>
      String(v ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const sortedRows = sortConfig
    ? [...filteredRows].sort((a, b) => {
        const av = String(a.properties[sortConfig.col] ?? '');
        const bv = String(b.properties[sortConfig.col] ?? '');
        const cmp = !isNaN(Number(av)) && !isNaN(Number(bv))
          ? Number(av) - Number(bv)
          : av.localeCompare(bv);
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      })
    : filteredRows;

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'none', // backdrop is transparent to clicks
      }}
    >
      {/* Draggable panel */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h,
          minWidth: 480,
          minHeight: 200,
          background: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'all',
          userSelect: isDragging || isResizing ? 'none' : 'auto',
        }}
      >
        {/* ── Resize handle (top edge) ── */}
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 5,
            cursor: 'ns-resize',
            zIndex: 10,
            borderRadius: '10px 10px 0 0',
          }}
        />

        {/* ── Header (drag zone) ── */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            height: 44,
            background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
            cursor: isDragging ? 'grabbing' : 'grab',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Drag grip dots */}
            <svg width="12" height="16" viewBox="0 0 12 16" fill="rgba(255,255,255,0.5)">
              {[0,4,8].map(y => [0,5].map(x => (
                <circle key={`${x}-${y}`} cx={x+1} cy={y+2} r="1.5" />
              )))}
            </svg>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>
              Attribute Table
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              fontSize: 11, padding: '1px 8px', borderRadius: 10, fontWeight: 500,
            }}>
              {layerName}
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.15)', color: '#dbeafe',
              fontSize: 10, padding: '1px 6px', borderRadius: 8,
            }}>
              {rows.length} features
            </span>
            {selectedRows.size > 0 && (
              <span style={{
                background: '#fef3c7', color: '#92400e',
                fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
              }}>
                {selectedRows.size} selected
              </span>
            )}
          </div>

          {/* Right: toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                outline: 'none',
                width: 130,
              }}
            />

            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setAddingColumn(true)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 6, padding: '4px 10px', fontSize: 11,
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              + Column
            </button>

            {selectedRows.size > 0 && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={handleDeleteSelectedRows}
                style={{
                  background: '#fee2e2', color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                }}
              >
                🗑 Delete ({selectedRows.size})
              </button>
            )}

            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={handleSaveAll}
              style={{
                background: '#fff', color: '#1d4ed8',
                border: 'none', borderRadius: 6,
                padding: '4px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 700,
              }}
            >
              ✓ Save & Close
            </button>

            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 6, padding: '4px 8px', fontSize: 13, cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Add Column Form ── */}
        {addingColumn && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: '#eff6ff', borderBottom: '1px solid #bfdbfe', flexShrink: 0,
          }}>
            <span style={{ color: '#1e40af', fontSize: 12, fontWeight: 500 }}>New column:</span>
            <input
              autoFocus
              type="text"
              placeholder="Column name"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') { setAddingColumn(false); setNewColName(''); setNewColDefault(''); }
              }}
              style={{
                border: '1px solid #93c5fd', borderRadius: 5,
                padding: '4px 8px', fontSize: 12, outline: 'none', width: 140,
                background: '#fff', color: '#1e293b',
              }}
            />
            <input
              type="text"
              placeholder="Default value"
              value={newColDefault}
              onChange={e => setNewColDefault(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              style={{
                border: '1px solid #cbd5e1', borderRadius: 5,
                padding: '4px 8px', fontSize: 12, outline: 'none', width: 110,
                background: '#fff', color: '#1e293b',
              }}
            />
            <button
              onClick={handleAddColumn}
              style={{
                background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 5, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setAddingColumn(false); setNewColName(''); setNewColDefault(''); }}
              style={{
                background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
                borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {columns.length === 0 && rows.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', color: '#94a3b8',
            }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>No features in this layer</div>
            </div>
          ) : (
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              tableLayout: 'auto', minWidth: 400, fontSize: 12,
            }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                  {/* Select-all */}
                  <th style={{
                    width: 36, padding: '8px 10px',
                    borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0',
                    textAlign: 'center',
                  }}>
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedRows.size === filteredRows.length}
                      onChange={() => {
                        if (selectedRows.size === filteredRows.length) setSelectedRows(new Set());
                        else setSelectedRows(new Set(filteredRows.map(r => r.id)));
                      }}
                      style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#2563eb' }}
                    />
                  </th>
                  {/* # */}
                  <th style={{
                    width: 44, padding: '8px 8px', color: '#94a3b8', fontWeight: 600,
                    borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0',
                    textAlign: 'center', fontSize: 11,
                  }}>
                    #
                  </th>
                  {/* Data columns */}
                  {columns.map(col => (
                    <th key={col} style={{
                      padding: '8px 12px', color: '#374151', fontWeight: 600,
                      borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0',
                      textAlign: 'left', minWidth: 100, whiteSpace: 'nowrap',
                      background: '#f8fafc',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          onClick={() => handleSort(col)}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                          title={`Sort by ${col}`}
                        >
                          {col}
                          {sortConfig?.col === col
                            ? <span style={{ color: '#2563eb' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                            : <span style={{ color: '#d1d5db' }}> ↕</span>}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteColumn(col); }}
                          title={`Delete column "${col}"`}
                          style={{
                            background: 'transparent', border: 'none',
                            color: '#d1d5db', cursor: 'pointer',
                            padding: '0 2px', fontSize: 10, lineHeight: 1,
                            borderRadius: 3,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((row, rowIdx) => {
                  const isSelected = selectedRows.has(row.id);
                  const baseColor = isSelected ? '#eff6ff' : rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: baseColor,
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.08s',
                      }}
                      onClick={() => handleRowClick(row)}
                      onMouseEnter={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.background = '#f0f9ff';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLElement).style.background = baseColor;
                      }}
                    >
                      {/* Checkbox */}
                      <td
                        style={{ padding: '5px 10px', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}
                        onClick={e => toggleRowSelect(e, row.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#2563eb' }}
                        />
                      </td>

                      {/* Row # */}
                      <td style={{
                        padding: '5px 8px', color: '#9ca3af',
                        borderRight: '1px solid #f1f5f9', textAlign: 'center',
                        fontSize: 11, fontWeight: 500,
                      }}>
                        {rowIdx + 1}
                      </td>

                      {/* Data cells */}
                      {columns.map(col => {
                        const isEditing = editingCell?.rowId === row.id && editingCell?.col === col;
                        const cellVal = row.properties[col];

                        return (
                          <td
                            key={col}
                            style={{
                              padding: isEditing ? 0 : '5px 12px',
                              borderRight: '1px solid #f1f5f9',
                              color: cellVal == null || cellVal === '' ? '#cbd5e1' : '#1e293b',
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={isEditing ? undefined : String(cellVal ?? '')}
                            onDoubleClick={e => startEdit(e, row.id, col, cellVal)}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={handleKeyDown}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  background: '#eff6ff',
                                  border: '2px solid #2563eb',
                                  color: '#1e293b',
                                  padding: '4px 10px',
                                  outline: 'none',
                                  fontSize: 12,
                                  boxSizing: 'border-box',
                                }}
                              />
                            ) : (
                              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cellVal == null
                                  ? <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>null</span>
                                  : String(cellVal)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Status bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 14px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>
            {searchTerm ? `${sortedRows.length} of ${rows.length} features` : `${rows.length} features`}
            {' · '}
            {columns.length} attributes
            {selectedRows.size > 0 && (
              <span style={{ color: '#2563eb', fontWeight: 600 }}> · {selectedRows.size} selected</span>
            )}
          </span>
          <span style={{ color: '#cbd5e1', fontSize: 10 }}>
            Double-click cell to edit · Click row to zoom on map · Drag header to move
          </span>
        </div>
      </div>
    </div>,
    (typeof document !== 'undefined' ? (document.fullscreenElement as Element ?? document.body) : document.body)
  );
}