'use client';

import React, { useEffect, useState } from 'react';

interface FeaturesProps {
  properties: Record<string, any> | null;
  onClose: () => void;
  onSave?: (updatedProperties: Record<string, any>) => void;
}

export default function Features({ properties, onClose, onSave }: FeaturesProps) {
  const [editableProps, setEditableProps] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  useEffect(() => {
    if (properties) {
      setEditableProps(properties);
      setIsDirty(false);
      setExpanded(true);
      setEditMode(false);
      setIsAddingField(false);
    }
  }, [properties]);

  if (!properties) return null;

  const entries = Object.entries(editableProps);
  const propCount = entries.length;

  const handleChange = (key: string, value: string) => {
    setEditableProps(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleDeleteField = (key: string) => {
    setEditableProps(prev => { const u = { ...prev }; delete u[key]; return u; });
    setIsDirty(true);
  };

  const handleAddField = () => {
    if (!newFieldKey.trim()) return;
    if (editableProps.hasOwnProperty(newFieldKey)) { alert('Field already exists'); return; }
    setEditableProps(prev => ({ ...prev, [newFieldKey]: newFieldValue }));
    setIsDirty(true);
    setIsAddingField(false);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleSave = () => {
    if (onSave) onSave(editableProps);
    setIsDirty(false);
    setEditMode(false);
  };

  const handleCancel = () => {
    setEditableProps(properties || {});
    setIsDirty(false);
    setEditMode(false);
    setIsAddingField(false);
    setNewFieldKey('');
    setNewFieldValue('');
  };

  return (
    <div
      style={{
        width: 340,
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* dot indicator */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#34d399', flexShrink: 0,
          boxShadow: '0 0 6px #34d39980',
        }} />

        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, flex: 1, letterSpacing: 0.4 }}>
          Feature Properties
        </span>

        {/* prop count badge */}
        <span style={{
          background: 'rgba(255,255,255,0.18)',
          color: '#bfdbfe',
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 7px',
          borderRadius: 10,
          letterSpacing: 0.3,
        }}>
          {propCount} prop{propCount !== 1 ? 's' : ''}
        </span>

        {/* edit toggle */}
        <button
          onClick={e => { e.stopPropagation(); setEditMode(v => !v); setExpanded(true); }}
          title={editMode ? 'View mode' : 'Edit mode'}
          style={{
            background: editMode ? 'rgba(253,224,71,0.25)' : 'rgba(255,255,255,0.12)',
            border: 'none',
            color: editMode ? '#fde047' : '#93c5fd',
            borderRadius: 5,
            width: 24, height: 24,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          <i className={editMode ? 'fas fa-eye' : 'fas fa-pen'} />
        </button>

        {/* collapse / expand */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none', color: '#93c5fd',
            borderRadius: 5, width: 24, height: 24,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)',
            flexShrink: 0,
          }}
        >
          <i className="fas fa-chevron-down" />
        </button>

        {/* close */}
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: 'none', color: '#fca5a5',
            borderRadius: 5, width: 24, height: 24,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <i className="fas fa-times" />
        </button>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {/* View mode: compact 2-column rows */}
          {!editMode ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <tbody>
                {entries.map(([key, val], i) => (
                  <tr
                    key={key}
                    style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}
                  >
                    <td style={{
                      padding: '5px 10px',
                      color: '#64748b',
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      textTransform: 'uppercase',
                      fontSize: 10,
                      width: '38%',
                      borderRight: '1px solid #f1f5f9',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 110,
                    }} title={key}>
                      {key.replace(/_/g, ' ')}
                    </td>
                    <td style={{
                      padding: '5px 10px',
                      color: '#0f172a',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                    }}>
                      {val == null ? (
                        <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>null</span>
                      ) : String(val)}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
                      No properties
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Edit mode */
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {entries.map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: 0.3,
                    width: 90, flexShrink: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={key}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <input
                    value={val ?? ''}
                    onChange={e => handleChange(key, e.target.value)}
                    style={{
                      flex: 1, fontSize: 11, padding: '3px 7px',
                      border: '1px solid #e2e8f0', borderRadius: 5,
                      outline: 'none', color: '#0f172a',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                  />
                  <button
                    onClick={() => handleDeleteField(key)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none', color: '#fca5a5',
                      cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                      fontSize: 11,
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#fca5a5')}
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ))}

              {/* Add new field inline */}
              {isAddingField ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                  <input
                    autoFocus
                    placeholder="key"
                    value={newFieldKey}
                    onChange={e => setNewFieldKey(e.target.value)}
                    style={{ width: 90, flexShrink: 0, fontSize: 11, padding: '3px 6px', border: '1px solid #3b82f6', borderRadius: 5, outline: 'none' }}
                  />
                  <input
                    placeholder="value"
                    value={newFieldValue}
                    onChange={e => setNewFieldValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddField()}
                    style={{ flex: 1, fontSize: 11, padding: '3px 6px', border: '1px solid #3b82f6', borderRadius: 5, outline: 'none' }}
                  />
                  <button onClick={handleAddField}
                    style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>
                    <i className="fas fa-check" />
                  </button>
                  <button onClick={() => { setIsAddingField(false); setNewFieldKey(''); setNewFieldValue(''); }}
                    style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>
                    <i className="fas fa-times" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingField(true)}
                  style={{
                    marginTop: 2, padding: '4px 8px', fontSize: 10,
                    border: '1.5px dashed #cbd5e1', borderRadius: 6,
                    background: 'none', color: '#94a3b8', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
                    (e.currentTarget as HTMLElement).style.color = '#3b82f6';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1';
                    (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                  }}
                >
                  <i className="fas fa-plus" /> Add field
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Footer (edit mode only) ── */}
      {expanded && editMode && (isDirty || isAddingField) && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 6,
          padding: '6px 10px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '4px 12px', fontSize: 11, borderRadius: 6,
              border: '1px solid #e2e8f0', background: '#fff',
              color: '#475569', cursor: 'pointer',
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            style={{
              padding: '4px 12px', fontSize: 11, borderRadius: 6,
              border: 'none',
              background: isDirty ? '#2563eb' : '#94a3b8',
              color: '#fff', cursor: isDirty ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <i className="fas fa-save" /> Save
          </button>
        </div>
      )}
    </div>
  );
}
