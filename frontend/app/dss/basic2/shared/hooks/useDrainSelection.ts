'use client';
import { useState, useEffect, useCallback } from 'react';
import { useBasicStore } from '../store/basic.store';
import { API_BASE_URL } from '../utils/constants';
import type { DrainRiver, DrainStretch, DrainItem, DrainVillage } from '../types/location.types';

export function useDrainSelection() {
  const {
    drainSelection,
    setDrainRiver, setDrainStretch, setDrainItems,
    setDrainVillages, setDrainSelectedVillageIds, setDrainTotalPopulation,
    resetDrainSelection,
    confirmLocation,
  } = useBasicStore();

  // ── Derived state ─────────────────────────────────────────────────────────
  const { river, stretch, drains, villages, selectedVillageIds } = drainSelection;

  // ── Loading & error states (local — not in store, no persistence needed) ──
  const [rivers, setRivers] = useState<DrainRiver[]>([]);
  const [stretches, setStretches] = useState<DrainStretch[]>([]);
  const [drainList, setDrainList] = useState<DrainItem[]>([]);

  const [loadingRivers, setLoadingRivers]   = useState(false);
  const [loadingStretches, setLoadingStretches] = useState(false);
  const [loadingDrains, setLoadingDrains]   = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [loadingPop, setLoadingPop]         = useState(false);

  const [riverError, setRiverError]       = useState<string | null>(null);
  const [stretchError, setStretchError]   = useState<string | null>(null);
  const [drainError, setDrainError]       = useState<string | null>(null);
  const [villageError, setVillageError]   = useState<string | null>(null);

  // ── Search state for stretch dropdown ────────────────────────────────────
  const [stretchSearch, setStretchSearch] = useState('');

  // ── 1. Load rivers on mount ───────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingRivers(true); setRiverError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/basic/rivers/`);
        if (!res.ok) throw new Error(`Rivers API ${res.status}`);
        const data = await res.json();
        setRivers((data.features ?? []).map((f: any) => ({
          id: String(f.properties.River_Code),
          name: f.properties.River_Name,
        })));
      } catch (e: any) { setRiverError(e.message); }
      finally { setLoadingRivers(false); }
    };
    load();
  }, []);

  // ── 2. Load stretches when river changes ─────────────────────────────────
  useEffect(() => {
    if (!river) { setStretches([]); return; }
    const load = async () => {
      setLoadingStretches(true); setStretchError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/basic/river-stretched/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ River_Code: parseInt(river.id) }),
        });
        if (!res.ok) throw new Error(`Stretches API ${res.status}`);
        const data = await res.json();
        const list: DrainStretch[] = (data.features ?? []).map((f: any) => ({
          id: String(f.properties.Stretch_ID),
          name: f.properties.River_Name ?? `Stretch ${f.properties.Stretch_ID}`,
          riverId: river.id,
        }));
        list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        setStretches(list);
      } catch (e: any) { setStretchError(e.message); }
      finally { setLoadingStretches(false); }
    };
    load();
  }, [river]);

  // ── 3. Load drains when stretch changes ──────────────────────────────────
  useEffect(() => {
    if (!stretch) { setDrainList([]); return; }
    const load = async () => {
      setLoadingDrains(true); setDrainError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/basic/drain/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Stretch_ID: parseInt(stretch.id) }),
        });
        if (!res.ok) throw new Error(`Drains API ${res.status}`);
        const data = await res.json();
        const list: DrainItem[] = (data.features ?? []).map((f: any) => ({
          id: String(f.properties.Drain_No),
          name: `Drain ${f.properties.Drain_No}`,
          stretchId: String(f.properties.Stretch_ID),
          stretchName: stretch.name,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setDrainList(list);
        setDrainItems([]);
      } catch (e: any) { setDrainError(e.message); }
      finally { setLoadingDrains(false); }
    };
    load();
  }, [stretch]);

  // ── 4. Load villages when drain selection changes ─────────────────────────
  useEffect(() => {
    if (!drains.length) { setDrainVillages([]); return; }
    const load = async () => {
      setLoadingVillages(true); setVillageError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/basic/catchment_village/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Drain_No: drains.map(d => parseInt(d.id)) }),
        });
        if (!res.ok) throw new Error(`Villages API ${res.status}`);
        const data = await res.json();

        // De-duplicate by shapeID (village can intersect multiple drains)
        const seen = new Set<string>();
        const vilList: DrainVillage[] = [];
        for (const v of (data.intersected_villages ?? [])) {
          const id = String(v.shapeID);
          if (!seen.has(id)) {
            seen.add(id);
            vilList.push({
              shapeID: id,
              shapeName: v.shapeName,
              drainNo: Number(v.Drain_No ?? v.drainNo ?? 0),
              subDistrictCode: String(v.SUBDIS_COD ?? v.subDistrictCode ?? ''),
              subDistrictName: v.SUB_DISTRI ?? v.subDistrictName ?? '',
              districtName: v.DISTRICT ?? v.districtName ?? '',
              stateName: v.STATE ?? v.stateName ?? '',
              population: v.population ?? 0,
              selected: true,
            });
          }
        }
        setDrainVillages(vilList);

        // Fetch population for all villages
        if (vilList.length) {
          await fetchPopulations(vilList.map(v => v.shapeID), vilList);
        }
      } catch (e: any) { setVillageError(e.message); }
      finally { setLoadingVillages(false); }
    };
    load();
  }, [drains]);

  // ── Population fetch helper ───────────────────────────────────────────────
  const fetchPopulations = useCallback(async (shapeIds: string[], currentVillages: DrainVillage[]) => {
    setLoadingPop(true);
    try {
      const res = await fetch(`${API_BASE_URL}/basic/village-population/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shapeID: shapeIds }),
      });
      if (!res.ok) throw new Error(`Population API ${res.status}`);
      const data = await res.json();

      const popMap: Record<string, number> = {};
      for (const p of (Array.isArray(data) ? data : [])) {
        popMap[p.village_code] = p.total_population ?? 0;
      }

      const updated = currentVillages.map(v => ({
        ...v,
        population: popMap[v.shapeID] ?? v.population ?? 0,
      }));

      setDrainVillages(updated);
      const total = updated.reduce((s, v) => s + (v.population ?? 0), 0);
      setDrainTotalPopulation(total);
    } catch { /* population failure is non-fatal */ }
    finally { setLoadingPop(false); }
  }, []);

  // ── Exposed handlers ──────────────────────────────────────────────────────
  const selectRiver = useCallback((id: string) => {
    const r = rivers.find(r => r.id === id) ?? null;
    setDrainRiver(r);
  }, [rivers]);

  const selectStretch = useCallback((id: string) => {
    const s = stretches.find(s => s.id === id) ?? null;
    setDrainStretch(s);
  }, [stretches]);

  const selectDrains = useCallback((ids: string[]) => {
    const selected = drainList.filter(d => ids.includes(d.id));
    setDrainItems(selected);
  }, [drainList]);

  const toggleVillage = useCallback((shapeID: string) => {
    const current = new Set(selectedVillageIds);
    if (current.has(shapeID)) current.delete(shapeID);
    else current.add(shapeID);
    setDrainSelectedVillageIds([...current]);
  }, [selectedVillageIds]);

  const selectAllVillages = useCallback(() => {
    setDrainSelectedVillageIds(villages.map(v => v.shapeID));
  }, [villages]);

  const deselectAllVillages = useCallback(() => {
    setDrainSelectedVillageIds([]);
  }, []);

  const filteredStretches = stretches.filter(s =>
    s.id.includes(stretchSearch) || s.name.toLowerCase().includes(stretchSearch.toLowerCase())
  );

  const canConfirm = drains.length > 0 && villages.length > 0
    && selectedVillageIds.length > 0 && !loadingVillages;

  return {
    // data
    rivers, stretches: filteredStretches, allStretches: stretches,
    drainList, villages, selectedVillageIds,
    river, stretch, drains,

    // loading
    loadingRivers, loadingStretches, loadingDrains, loadingVillages, loadingPop,

    // errors
    riverError, stretchError, drainError, villageError,

    // search
    stretchSearch, setStretchSearch,

    // actions
    selectRiver, selectStretch, selectDrains,
    toggleVillage, selectAllVillages, deselectAllVillages,
    resetDrainSelection, confirmLocation, canConfirm,
  };
}
