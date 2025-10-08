'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocationContext } from './LocationContext';

export type CurveSeries = {
  days: number[];
  flows: number[];
  threshold: number;
  image_base64?: string; // NEW: server-rendered PNG for this method
};

export type EflowResult = {
  summary: Record<string, number>;      // Mm³/year surplus per method
  curves: Record<string, CurveSeries>;  // method key -> series (now may contain image_base64)
};

export type EflowError = { error: string };
export type EflowResultsMap = Record<number, EflowResult | EflowError>;

export type DailyPoint = { day: number; flow: number }; // retained (unused)

type State = {
  posting: boolean;
  error: string | null;
  results: EflowResultsMap | null;
  hasSelection: boolean;
  selectionConfirmed: boolean;
  selectedSubs: number[];
  dailyBySub: Record<number, DailyPoint[] | undefined>;
};

type RunParams = {
  method?: 'FDC' | 'Tennant' | 'Smakhtin' | 'Tessmann';
  fdc_choice?: 'Q90' | 'Q95' | 'All';
  tennant_choice?: '10%' | '30%' | '60%' | 'All';
};

type Actions = {
  run: (params?: RunParams) => Promise<void>;
  reset: () => void;
  fetchDaily: (sub: number) => Promise<DailyPoint[] | null>;
};

type Ctx = State & Actions;

const EflowContext = createContext<Ctx | undefined>(undefined);

export const EflowProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectedSubbasins, selectionConfirmed, loading: locLoading, error: locError } = useLocationContext();

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EflowResultsMap | null>(null);
  const [dailyBySub, setDailyBySub] = useState<Record<number, DailyPoint[] | undefined>>({});

  const controllerRef = useRef<AbortController | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/django/swa';

  const selectedSubs = useMemo(
    () =>
      selectedSubbasins
        .map((s) => Number(s.sub))
        .filter((v, i, a) => Number.isFinite(v) && a.indexOf(v) === i),
    [selectedSubbasins]
  );

  const canRun = useMemo(
    () => selectedSubs.length > 0 && !locLoading && !locError && selectionConfirmed,
    [selectedSubs.length, locLoading, locError, selectionConfirmed]
  );

  const cancelInFlight = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const run = useCallback(
    async (params?: RunParams) => {
      if (!canRun) return;
      cancelInFlight();
      const controller = new AbortController();
      controllerRef.current = controller;

      setPosting(true);
      setError(null);
      setResults(null);

      try {
        // Backend expects sub_ids; response is a map keyed by sub_id
        const body = { sub_ids: selectedSubs, ...(params ?? {}) };
        const res = await fetch(`${apiBase}/eflow`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API ${res.status}: ${text}`);
        }

        const payload = (await res.json()) as EflowResultsMap;
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
    },
    [apiBase, cancelInFlight, canRun, selectedSubs]
  );

  const reset = useCallback(() => {
    cancelInFlight();
    setPosting(false);
    setError(null);
    setResults(null);
    setDailyBySub({});
  }, [cancelInFlight]);

  // No /eflow/daily endpoint exposed; keep signature but return null
  const fetchDaily = useCallback(async (_sub: number): Promise<DailyPoint[] | null> => {
    return null;
  }, []);

  const value: Ctx = useMemo(
    () => ({
      posting,
      error,
      results,
      hasSelection: selectedSubs.length > 0,
      selectionConfirmed,
      selectedSubs,
      dailyBySub,
      run,
      reset,
      fetchDaily,
    }),
    [posting, error, results, selectedSubs.length, selectionConfirmed, selectedSubs, dailyBySub, run, reset, fetchDaily]
  );

  return <EflowContext.Provider value={value}>{children}</EflowContext.Provider>;
};

export const useEflow = () => {
  const ctx = useContext(EflowContext);
  if (!ctx) throw new Error('useEflow must be used within EflowProvider');
  return ctx;
};
