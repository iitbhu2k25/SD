// app/contexts/surfacewater_assessment/admin/ClimateAdminContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

export type AdminClimatePoint = {
  year: number;
  mon: number;
  surq_cnt_m3?: number;            // backend field
  runoff?: number;                 // normalized on client
  x_index: number;
};

export type AdminClimatePerYear = {
  total_runoff: number;
  avg_monthly_runoff: number;
};

export type AdminClimateResult = {
  subdistrict_code: number | string;
  source_id: number | string;
  vlcode: number | string;
  village: string;
  start_year: number;
  end_year: number;
  data: {
    points: AdminClimatePoint[];
  };
  summary: {
    total_runoff: number;
    avg_monthly_runoff: number;
    per_year: Record<string, AdminClimatePerYear>;
  };
  image_base64?: string;
};

export type AdminClimateError = { error: string };
export type AdminClimateMap = Record<string, AdminClimateResult | AdminClimateError>;

type State = {
  posting: boolean;
  error: string | null;
  results: AdminClimateMap | null;
  selectionConfirmed: boolean;
  selectedSubdistrictIds: number[];
  selectedSourceId: number | string | null;
  selectedStartYear: number;
  selectedEndYear: number;
};

type Actions = {
  setSelectedSourceId: (id: number | string) => void;
  setSelectedStartYear: (y: number) => void;
  setSelectedEndYear: (y: number) => void;
  run: (params?: { source_id?: number | string; start_year?: number; end_year?: number; subdistrict_ids?: number[] }) => Promise<void>;
  reset: () => void;
};

type Ctx = State & Actions;

const ClimateAdminContext = createContext<Ctx | undefined>(undefined);

const ALLOWED_SCENARIOS = [126, 245, 370, 585];

export const ClimateAdminProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AdminClimateMap | null>(null);

  const [selectedSourceId, _setSelectedSourceId] = useState<number | string | null>(126);
  const setSelectedSourceId = useCallback((id: number | string) => {
    const n = Number(id);
    _setSelectedSourceId(ALLOWED_SCENARIOS.includes(n) ? n : 126);
  }, []);

  const [selectedStartYear, setSelectedStartYear] = useState<number>(2021);
  const [selectedEndYear, setSelectedEndYear] = useState<number>(2023);

  const controllerRef = useRef<AbortController | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';

  const selectedSubdistrictIds = useMemo(() => getConfirmedSubdistrictIds(), [getConfirmedSubdistrictIds]);

  const cancelInFlight = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const run = useCallback(async (params?: { source_id?: number | string; start_year?: number; end_year?: number; subdistrict_ids?: number[] }) => {
    if (!selectionConfirmed) {
      setError('Confirm subdistrict selection first.');
      setResults(null);
      return;
    }

    const subdistrict_codes = params?.subdistrict_ids?.length ? params.subdistrict_ids : selectedSubdistrictIds;
    if (!subdistrict_codes?.length) {
      setError('No subdistricts selected.');
      setResults(null);
      return;
    }

    const rawSource = params?.source_id ?? selectedSourceId;
    const source_n = Number(rawSource);
    const source_id = ALLOWED_SCENARIOS.includes(source_n) ? source_n : 126;

    const start_year = params?.start_year ?? selectedStartYear;
    const end_year = params?.end_year ?? selectedEndYear;

    cancelInFlight();
    const controller = new AbortController();
    controllerRef.current = controller;

    setPosting(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`${apiBase}/django/swa/adminclimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ subdistrict_codes, source_id, start_year, end_year }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ClimateAdmin request failed (${res.status}) ${text}`);
      }
      const payload: AdminClimateMap = await res.json();

      // Normalize points to have runoff present for charting
      if (payload && typeof payload === 'object') {
        Object.values(payload).forEach((v: any) => {
          if (v && v.data && Array.isArray(v.data.points)) {
            v.data.points = v.data.points.map((p: any) => ({
              ...p,
              runoff: typeof p.runoff === 'number' ? p.runoff : (typeof p.surq_cnt_m3 === 'number' ? p.surq_cnt_m3 : 0),
            }));
          }
        });
      }

      setResults(payload ?? null);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? 'Request failed');
        setResults(null);
      }
    } finally {
      setPosting(false);
      controllerRef.current = null;
    }
  }, [apiBase, selectionConfirmed, selectedSubdistrictIds, selectedSourceId, selectedStartYear, selectedEndYear, cancelInFlight]);

  const reset = useCallback(() => {
    cancelInFlight();
    setPosting(false);
    setError(null);
    setResults(null);
  }, [cancelInFlight]);

  useEffect(() => {
    if (selectedSourceId === null || selectedSourceId === undefined || selectedSourceId === '') return;
    const n = Number(selectedSourceId);
    if (!ALLOWED_SCENARIOS.includes(n)) setSelectedSourceId(126);
  }, [selectedSourceId, setSelectedSourceId]);

  const value: Ctx = useMemo(() => ({
    posting,
    error,
    results,
    selectionConfirmed,
    selectedSubdistrictIds,
    selectedSourceId,
    selectedStartYear,
    selectedEndYear,
    setSelectedSourceId,
    setSelectedStartYear,
    setSelectedEndYear,
    run,
    reset,
  }), [posting, error, results, selectionConfirmed, selectedSubdistrictIds, selectedSourceId, selectedStartYear, selectedEndYear, run, reset]);

  return <ClimateAdminContext.Provider value={value}>{children}</ClimateAdminContext.Provider>;
};

export const useClimateAdmin = () => {
  const ctx = useContext(ClimateAdminContext);
  if (!ctx) throw new Error('useClimateAdmin must be used within ClimateAdminProvider');
  return ctx;
};
