'use client';
import { useState, useRef, useEffect } from 'react';
import { useBasicStore } from '../store/basic.store';
import { Globe, ChevronDown, Check, RotateCcw } from 'lucide-react';

export default function IndCatchmentSelector() {
  const {
    indiaCatchmentSelection,
    setIndiaCatchmentSelectedIds,
    resetIndiaCatchmentSelection,
    confirmIndiaCatchment,
  } = useBasicStore();

  const { point, watershedInfo, villages, selectedVillageIds, totalPopulation } = indiaCatchmentSelection;
  const hasWatershed = !!watershedInfo;

  const [dropOpen,    setDropOpen]    = useState(false);
  const [search,      setSearch]      = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = villages.filter(v =>
    v.village.toLowerCase().includes(search.toLowerCase()) || v.vlcode.includes(search)
  );

  const currentPop = selectedVillageIds.length === villages.length && totalPopulation > 0
    ? totalPopulation
    : villages.filter(v => selectedVillageIds.includes(v.vlcode)).reduce((s, v) => s + (v.population ?? 0), 0);

  const canConfirm = hasWatershed && selectedVillageIds.length > 0;

  // ── Not yet clicked ────────────────────────────────────────────────────────
  if (!hasWatershed && !point.lat) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px 20px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Globe size={28} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Select a Watershed</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>Click anywhere on the India map to delineate the watershed catchment for that location.</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', width: '100%' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>Quick Guide</div>
          <ol style={{ fontSize: 12, color: '#1e40af', paddingLeft: 16, lineHeight: 1.7, margin: 0 }}>
            <li>Click on the map to select a point</li>
            <li>Watershed boundary auto-delineated</li>
            <li>Villages within watershed will load</li>
            <li>Select villages → Confirm</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Watershed info card ── */}
      {hasWatershed && (
        <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95' }}>Watershed Location</div>
                <div style={{ fontSize: 12, color: '#6d28d9' }}>
                  {point.lat.toFixed(5)}°N, {point.lng.toFixed(5)}°E
                </div>
              </div>
            </div>
            <button onClick={resetIndiaCatchmentSelection}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 4 }}>
              <RotateCcw size={15} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Features', value: watershedInfo?.features ?? 0 },
              { label: 'Geometry', value: watershedInfo?.geometryType ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#4c1d95' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Village selection ── */}
      {villages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>Village Selection</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setIndiaCatchmentSelectedIds(villages.map(v => v.vlcode))}
                disabled={selectedVillageIds.length === villages.length}
                style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', cursor: selectedVillageIds.length === villages.length ? 'not-allowed' : 'pointer', opacity: selectedVillageIds.length === villages.length ? 0.5 : 1 }}>
                Select All
              </button>
              <button onClick={() => setIndiaCatchmentSelectedIds([])}
                disabled={selectedVillageIds.length === 0}
                style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: selectedVillageIds.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedVillageIds.length === 0 ? 0.5 : 1 }}>
                Deselect All
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total Villages', value: villages.length,             bg: '#eff6ff', color: '#1d4ed8' },
              { label: 'Selected',       value: selectedVillageIds.length,   bg: '#f0fdf4', color: '#15803d' },
              { label: 'Population',     value: currentPop.toLocaleString(), bg: '#f5f3ff', color: '#6d28d9' },
            ].map(({ label, value, bg, color }) => (
              <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Dropdown */}
          <div style={{ position: 'relative' }} ref={dropRef}>
            <button onClick={() => setDropOpen(v => !v)}
              style={{ width: '100%', background: '#fff', border: '2px solid #d1d5db', borderRadius: 10, padding: '10px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#374151' }}>
                  {selectedVillageIds.length === villages.length ? 'All villages selected'
                    : selectedVillageIds.length === 0 ? 'No villages selected'
                    : `${selectedVillageIds.length} of ${villages.length} villages selected`}
                </div>
                {selectedVillageIds.length > 0 && selectedVillageIds.length < villages.length && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Click to modify selection</div>
                )}
              </div>
              <ChevronDown size={16} color="#94a3b8" style={{ transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {dropOpen && (
              <div style={{ position: 'absolute', zIndex: 50, width: '100%', marginTop: 4, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 300, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
                  <input type="text" placeholder="Search villages…" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filtered.map(v => {
                    const checked = selectedVillageIds.includes(v.vlcode);
                    return (
                      <label key={v.vlcode} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: checked ? '#f5f3ff' : '#fff', borderBottom: '1px solid #f1f5f9', gap: 10 }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const curr = new Set(selectedVillageIds);
                            if (curr.has(v.vlcode)) curr.delete(v.vlcode); else curr.add(v.vlcode);
                            setIndiaCatchmentSelectedIds([...curr]);
                          }}
                          style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{v.village}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', gap: 6, display: 'flex' }}>
                            {v.population && v.population > 0 && <span>Pop: {v.population.toLocaleString()}</span>}
                            {v.subdis_cod && <span style={{ color: '#7c3aed' }}>• {v.subdis_cod}</span>}
                          </div>
                        </div>
                        {checked && <Check size={14} color="#7c3aed" />}
                      </label>
                    );
                  })}
                  {filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No villages found</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm ── */}
      {hasWatershed && villages.length > 0 && (
        <div style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
          <button onClick={confirmIndiaCatchment} disabled={!canConfirm}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
              background: canConfirm ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#e2e8f0',
              color: canConfirm ? '#fff' : '#94a3b8', cursor: canConfirm ? 'pointer' : 'not-allowed',
              boxShadow: canConfirm ? '0 4px 12px rgba(124,58,237,0.3)' : 'none', transition: 'all 0.15s' }}>
            {canConfirm ? `Confirm Selection (${selectedVillageIds.length} villages)` : 'Select at least one village'}
          </button>
        </div>
      )}
    </div>
  );
}