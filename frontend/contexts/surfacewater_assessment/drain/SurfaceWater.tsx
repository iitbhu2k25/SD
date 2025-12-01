'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect, // Added for effect handling
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocationContext } from './LocationContext';

export type TimeseriesPoint = { day: number; flow: number };

export type SubbasinStatistics = {
  max_flow: number;
  min_flow: number;
  mean_flow: number;
  surplus_days: number;
  total_data_points: number;
};

export type SubbasinResult = {
  subbasin: number;
  years: number[];
  total_years_available: number;
  Q25_cms: number;
  surplus_runoff_Mm3: number;
  statistics: SubbasinStatistics;
  timeseries: TimeseriesPoint[];
  image_base64?: string;
};

export type SubbasinError = { error: string };

export type SurfaceWaterResultsMap = Record<number, SubbasinResult | SubbasinError>;

type SurfaceWaterState = {
  posting: boolean;
  error: string | null;
  results: SurfaceWaterResultsMap | null;
  hasSelection: boolean;
  selectionConfirmed: boolean;
  selectedSubs: number[];
};

type SurfaceWaterActions = {
  run: () => Promise<void>;
  reset: () => void;
};

type SurfaceWaterContextValue = SurfaceWaterState & SurfaceWaterActions;

const SurfaceWaterContext = createContext<SurfaceWaterContextValue | undefined>(undefined);

export const SurfaceWaterProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const {
    selectedSubbasins,
    selectionConfirmed,
    loading: locLoading,
    error: locError,
  } = useLocationContext();

  const [posting, setPosting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SurfaceWaterResultsMap | null>(null);

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

  const run = useCallback(async () => {
    if (!canRun) return;
    cancelInFlight();
    const controller = new AbortController();
    controllerRef.current = controller;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/surfacewater`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subbasins: selectedSubs }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
      }

      const data: SurfaceWaterResultsMap = await res.json();
      setResults(data);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? 'Request failed');
        setResults(null);
      }
    } finally {
      setPosting(false);
      controllerRef.current = null;
    }
  }, [apiBase, cancelInFlight, canRun, selectedSubs]);

  const reset = useCallback(() => {
    cancelInFlight();
    setPosting(false);
    setError(null);
    setResults(null);
  }, [cancelInFlight]);

  // NEW: Synchronize with LocationContext changes
  useEffect(() => {
    // Reset state when selectedSubbasins or selectionConfirmed changes
    reset();
    // Optionally re-run analysis if selection is confirmed and valid
    if (canRun) {
      run();
    }
  }, [selectedSubbasins, selectionConfirmed, canRun, reset, run]);

  const value: SurfaceWaterContextValue = useMemo(
    () => ({
      posting,
      error,
      results,
      hasSelection: selectedSubs.length > 0,
      selectionConfirmed,
      selectedSubs,
      run,
      reset,
    }),
    [posting, error, results, selectedSubs, selectionConfirmed, run, reset]
  );

  return <SurfaceWaterContext.Provider value={value}>{children}</SurfaceWaterContext.Provider>;
};

export const useSurfaceWater = () => {
  const ctx = useContext(SurfaceWaterContext);
  if (!ctx) throw new Error('useSurfaceWater must be used within SurfaceWaterProvider');
  return ctx;
};