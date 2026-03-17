'use client';

import { useState, useEffect, useRef } from 'react';
import { useBasicStore } from '../store/basic.store';
import {
  fetchStates,
  fetchDistricts,
  fetchSubDistricts,
  fetchVillages,
} from '../services/location.service';
import type { StateOption, DistrictOption, SubDistrictOption, VillageOption } from '../types/location.types';

export function useLocationSelection() {
  const {
    adminSelection,
    setAdminState,
    setAdminDistricts,
    setAdminSubDistricts,
    setAdminVillages,
    confirmLocation,
    resetAdminSelection,
    confirmedLocation,
  } = useBasicStore();

  // ── Option lists (what the dropdowns show) ────────────────────────────────
  const [states, setStates] = useState<StateOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrictOption[]>([]);
  const [villages, setVillages] = useState<VillageOption[]>([]);

  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubDistricts, setLoadingSubDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs for stable JSON keys — avoids re-running effects on every
  // reference change of the arrays in the Zustand store.
  const prevStateCode = useRef<string | null>(null);
  const prevDistrictKey = useRef<string>('');
  const prevSubDistrictKey = useRef<string>('');

  // ── Load states once ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingStates(true);
    fetchStates()
      .then(setStates)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingStates(false));
  }, []);

  // ── Reload districts only when the STATE actually changes ─────────────────
  useEffect(() => {
    const newCode = adminSelection.state?.state_code ?? null;
    if (newCode === prevStateCode.current) return;
    prevStateCode.current = newCode;

    if (!newCode) {
      setDistricts([]);
      setSubDistricts([]);
      setVillages([]);
      return;
    }

    setLoadingDistricts(true);
    fetchDistricts(newCode)
      .then((data) => {
        setDistricts(data);
        setSubDistricts([]);
        setVillages([]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingDistricts(false));
  });

  // ── Reload sub-districts only when the DISTRICT SELECTION actually changes ─
  useEffect(() => {
    const newKey = JSON.stringify(
      [...adminSelection.districts.map((d) => d.district_code)].sort()
    );
    if (newKey === prevDistrictKey.current) return;
    prevDistrictKey.current = newKey;

    if (!adminSelection.districts.length) {
      setSubDistricts([]);
      setVillages([]);
      return;
    }

    setLoadingSubDistricts(true);
    fetchSubDistricts(adminSelection.districts.map((d) => d.district_code))
      .then((data) => {
        setSubDistricts(data);
        setVillages([]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSubDistricts(false));
  });

  // ── Reload villages only when the SUB-DISTRICT SELECTION actually changes ──
  useEffect(() => {
    const newKey = JSON.stringify(
      [...adminSelection.subDistricts.map((s) => s.subdistrict_code)].sort()
    );
    if (newKey === prevSubDistrictKey.current) return;
    prevSubDistrictKey.current = newKey;

    if (!adminSelection.subDistricts.length) {
      setVillages([]);
      return;
    }

    setLoadingVillages(true);
    fetchVillages(adminSelection.subDistricts.map((s) => s.subdistrict_code))
      .then(setVillages)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingVillages(false));
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  /** State is single-select */
  const handleStateChange = (codes: string[]) => {
    const found = states.find((s) => s.state_code === codes[0]) ?? null;
    if (found?.state_code === adminSelection.state?.state_code) return; // no change
    setAdminState(found);
    setAdminDistricts([]);
    setAdminSubDistricts([]);
    setAdminVillages([]);
  };

  /** Districts — multi-select: keep all previously selected that are still valid */
  const handleDistrictChange = (codes: string[]) => {
    const selected = districts.filter((d) => codes.includes(d.district_code));
    setAdminDistricts(selected);
    // Only clear child if district set shrinks (deselection) or changes
    setAdminSubDistricts([]);
    setAdminVillages([]);
  };

  /** Sub-districts — multi-select */
  const handleSubDistrictChange = (codes: string[]) => {
    const selected = subDistricts.filter((s) => codes.includes(s.subdistrict_code));
    setAdminSubDistricts(selected);
    setAdminVillages([]);
  };

  /** Villages — multi-select */
  const handleVillageChange = (codes: string[]) => {
    const selected = villages.filter((v) => codes.includes(v.village_code));
    setAdminVillages(selected);
  };

  const handleConfirm = () => {
    if (!adminSelection.state) {
      setError('Please select at least a state');
      return;
    }
    setError(null);
    confirmLocation();
  };

  // ── Ready-made option arrays for MultiSelect ──────────────────────────────
  const stateOptions = states.map((s) => ({ value: s.state_code, label: s.state_name }));
  const districtOptions = districts.map((d) => ({ value: d.district_code, label: d.district_name }));
  const subDistrictOptions = subDistricts.map((s) => ({ value: s.subdistrict_code, label: s.subdistrict_name }));
  const villageOptions = villages.map((v) => ({ value: v.village_code, label: v.village_name }));

  return {
    stateOptions,
    districtOptions,
    subDistrictOptions,
    villageOptions,
    loadingStates,
    loadingDistricts,
    loadingSubDistricts,
    loadingVillages,
    adminSelection,
    handleStateChange,
    handleDistrictChange,
    handleSubDistrictChange,
    handleVillageChange,
    resetAdminSelection,
    handleConfirm,
    confirmedLocation,
    error,
  };
}