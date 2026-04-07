'use client';
import { useState } from 'react';
import { useDrainSelection } from '../hooks/useDrainSelection';
import { useBasicStore } from '../store/basic.store';
import { GitBranch, ChevronDown, ChevronUp, Check, Users, Layers } from 'lucide-react';

// ── Tiny shared styles ────────────────────────────────────────────────────────
const sel: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid #e2e8f0', fontSize: 12, background: '#fff',
  color: '#1e293b', outline: 'none', cursor: 'pointer',
};
const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
};
const errBox: React.CSSProperties = {
  fontSize: 11, color: '#dc2626', background: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', marginTop: 4,
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 10, padding: '11px 13px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

// ── Multi-select checkboxes for drains ────────────────────────────────────────
function DrainMultiSelect({
  items, selected, onChange, disabled,
}: {
  items: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === items.length && items.length > 0;
  const label2 = selected.length === 0 ? '— Choose Drains —'
    : allSelected ? 'All Drains'
    : `${selected.length} Drain(s) selected`;

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{ ...sel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: disabled ? 0.5 : 1 }}>
        <span style={{ color: selected.length ? '#1e293b' : '#94a3b8' }}>{label2}</span>
        {open ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          {/* Select all row */}
          <div
            onClick={() => onChange(allSelected ? [] : items.map(i => i.id))}
            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #2563eb',
              background: allSelected ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allSelected && <Check size={10} color="#fff" />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>Select All</span>
          </div>
          {items.map(item => {
            const checked = selected.includes(item.id);
            return (
              <div key={item.id}
                onClick={() => onChange(checked ? selected.filter(x => x !== item.id) : [...selected, item.id])}
                style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  background: checked ? '#eff6ff' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #2563eb',
                  background: checked ? '#2563eb' : '#fff', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <Check size={10} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: '#1e293b' }}>{item.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Village list (compact) ────────────────────────────────────────────────────
function VillageToggleList({
  villages, selectedIds, onToggle, onSelectAll, onDeselectAll, loading,
}: {
  villages: { shapeID: string; shapeName: string; population?: number }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = villages.filter(v =>
    v.shapeName.toLowerCase().includes(search.toLowerCase())
  );
  const totalPop = villages
    .filter(v => selectedIds.includes(v.shapeID))
    .reduce((s, v) => s + (v.population ?? 0), 0);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
        borderBottom: open ? '1px solid #bfdbfe' : 'none', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={13} color="#2563eb" />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Catchment Villages
          </span>
          <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', borderRadius: 20, padding: '1px 7px' }}>
            {selectedIds.length}/{villages.length}
          </span>
        </div>
        {open ? <ChevronUp size={13} color="#64748b" /> : <ChevronDown size={13} color="#64748b" />}
      </div>

      {open && (
        <div style={{ background: '#fff' }}>
          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Loading villages…</div>
          ) : (
            <>
              {/* Stats row */}
              <div
  style={{
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap',
  }}
>
  <div
    className="relative group"
    style={{
      flex: 1,
      minWidth: 72,
      background: '#eff6ff',
      borderRadius: 7,
      padding: '5px 8px',
      textAlign: 'center',
      cursor: 'pointer',
    }}
  >
    <div
      style={{
        fontSize: 9,
        color: '#2563eb',
        fontWeight: 700,
        textTransform: 'uppercase',
      }}
    >
      Population
    </div>

    <div
      style={{
        fontSize: 15,
        fontWeight: 900,
        color: '#1d4ed8',
      }}
    >
      {totalPop.toLocaleString()}
    </div>

    {/* Tooltip */}
    <div className="absolute hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
      Total population of selected area
    </div>
  </div>
</div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 5, padding: '7px 10px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                <button type="button" onClick={onSelectAll}
                  style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>
                  All
                </button>
                <button type="button" onClick={onDeselectAll}
                  style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>
                  None
                </button>
                <input
                  type="text" placeholder="Search villages…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 80, fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #e2e8f0', outline: 'none' }}
                />
              </div>

              {/* Village list */}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {filtered.map(v => {
                  const checked = selectedIds.includes(v.shapeID);
                  return (
                    <div key={v.shapeID}
                      onClick={() => onToggle(v.shapeID)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                        cursor: 'pointer', background: checked ? '#eff6ff' : '#fff',
                        borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid #2563eb', flexShrink: 0,
                        background: checked ? '#2563eb' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {checked && <Check size={10} color="#fff" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.shapeName}
                        </div>
                        {v.population !== undefined && v.population > 0 && (
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Pop: {v.population.toLocaleString()}</div>
                        )}
                      </div>
                    
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No villages found</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DrainLocationSelector() {
  const {
    rivers, stretches, allStretches, drainList, villages, selectedVillageIds,
    river, stretch, drains,
    loadingRivers, loadingStretches, loadingDrains, loadingVillages,
    riverError, stretchError, drainError, villageError,
    stretchSearch, setStretchSearch,
    selectRiver, selectStretch, selectDrains,
    toggleVillage, selectAllVillages, deselectAllVillages,
    resetDrainSelection, confirmLocation, canConfirm,
  } = useDrainSelection();

  const [stretchOpen, setStretchOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GitBranch size={14} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>Drain Location Selector</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>River → Stretch → Drains → Villages</div>
        </div>
      </div>

      {/* ── Step 1: River ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>1</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Select River</span>
        </div>
        <span style={label}>River</span>
        <div style={{ position: 'relative' }}>
          <select value={river?.id ?? ''} onChange={e => selectRiver(e.target.value)}
            disabled={loadingRivers}
            style={{ ...sel, opacity: loadingRivers ? 0.6 : 1 }}>
            <option value="">— Choose a River —</option>
            {rivers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {loadingRivers && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Loading…</span>
            </div>
          )}
        </div>
        {riverError && <div style={errBox}>{riverError}</div>}
      </div>

      {/* ── Step 2: Stretch ── */}
      {river && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>2</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Select Stretch</span>
          </div>
          <span style={label}>Stretch ID</span>
          {/* Searchable stretch dropdown */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setStretchOpen(o => !o)} disabled={loadingStretches}
              style={{ ...sel, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: stretch ? '#eff6ff' : '#fff', borderColor: stretch ? '#2563eb' : '#e2e8f0' }}>
              <span style={{ color: stretch ? '#1d4ed8' : '#94a3b8', fontWeight: stretch ? 600 : 400 }}>
                {stretch ? `Stretch ${stretch.id}` : '— Choose a Stretch —'}
              </span>
              {stretchOpen ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
            </button>
            {stretchOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 4 }}>
                <input autoFocus type="text" placeholder="Search stretch ID…"
                  value={stretchSearch} onChange={e => setStretchSearch(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #e2e8f0',
                    outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {stretches.map(s => (
                    <div key={s.id}
                      onClick={() => { selectStretch(s.id); setStretchOpen(false); setStretchSearch(''); }}
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                        background: stretch?.id === s.id ? '#eff6ff' : '#fff',
                        color: stretch?.id === s.id ? '#1d4ed8' : '#1e293b',
                        fontWeight: stretch?.id === s.id ? 600 : 400,
                        borderBottom: '1px solid #f1f5f9' }}>
                      Stretch {s.id}
                    </div>
                  ))}
                  {stretches.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                      {loadingStretches ? 'Loading…' : 'No stretches found'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {stretchError && <div style={errBox}>{stretchError}</div>}
        </div>
      )}

      {/* ── Step 3: Drains ── */}
      {stretch && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>3</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Select Drains</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>({drainList.length} available)</span>
          </div>
          <DrainMultiSelect
            items={drainList}
            selected={drains.map(d => d.id)}
            onChange={selectDrains}
            disabled={loadingDrains}
          />
          {drainError && <div style={errBox}>{drainError}</div>}
          {loadingDrains && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Loading drains…</div>}
        </div>
      )}

      {/* ── Step 4: Villages ── */}
      {drains.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>4</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Villages</span>
          </div>
          <VillageToggleList
            villages={villages}
            selectedIds={selectedVillageIds}
            onToggle={toggleVillage}
            onSelectAll={selectAllVillages}
            onDeselectAll={deselectAllVillages}
            loading={loadingVillages}
          />
          {villageError && <div style={errBox}>{villageError}</div>}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
        <button type="button"
          disabled={!canConfirm}
          onClick={confirmLocation}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
            fontSize: 12, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
            background: canConfirm
              ? 'linear-gradient(135deg,#2563eb,#1d4ed8)'
              : '#e2e8f0',
            color: canConfirm ? '#fff' : '#94a3b8',
            boxShadow: canConfirm ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
            transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
          {loadingVillages ? 'Loading…' : `Confirm (${selectedVillageIds.length} villages)`}
        </button>
        <button type="button" onClick={resetDrainSelection}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          Reset
        </button>
      </div>

    </div>
  );
}