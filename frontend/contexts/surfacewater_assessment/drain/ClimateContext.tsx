'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocationContext } from './LocationContext';

export type ClimatePoint = {
  year: number;
  mon: number;           // 1-12
  flow_in: number;
  flow_out: number;
  x_index: number;       // optional positional index from API
};

export type ClimateSeries = {
  points: ClimatePoint[];
  area_km2: number;
};

export type ClimateResult = {
  subbasin_id: number;
  scenario: number;
  start_year: number;
  end_year: number;
  data: ClimateSeries;
  summary?: {
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    avg_monthly_inflow: number;
    avg_monthly_outflow: number;
    per_year?: Record<string, {
      total_inflow: number;
      total_outflow: number;
      net_flow: number;
      avg_monthly_inflow: number;
      avg_monthly_outflow: number;
    }>;
  };
  image_base64?: string;
};

export type ClimateError = { error: string };
export type ClimateResultsMap = Record<string, ClimateResult | ClimateError>; // key: `${sub}_${scenario}`

type State = {
  posting: boolean;
  error: string | null;
  results: ClimateResultsMap | null;
  hasSelection: boolean;
  selectionConfirmed: boolean;
  selectedSubs: number[];
  selectedScenario: number;
  selectedStartYear: number;
  selectedEndYear: number;
};

type RunParams = {
  scenario?: number;
  start_year?: number;
  end_year?: number;
};

type Actions = {
  run: (params?: RunParams) => Promise<void>;
  reset: () => void;
  setSelectedScenario: (scenario: number) => void;
  setSelectedStartYear: (year: number) => void;
  setSelectedEndYear: (year: number) => void;
};

type Ctx = State & Actions;

const ClimateContext = createContext<Ctx | undefined>(undefined);

export const ClimateProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectedSubbasins, selectionConfirmed, loading: locLoading, error: locError } = useLocationContext();

  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ClimateResultsMap | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number>(585);
  const [selectedStartYear, setSelectedStartYear] = useState<number>(2021);
  const [selectedEndYear, setSelectedEndYear] = useState<number>(2023);

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
        const scenario = params?.scenario ?? selectedScenario;
        const start_year = params?.start_year ?? selectedStartYear;
        const end_year = params?.end_year ?? selectedEndYear;

        const body = {
          sub_ids: selectedSubs,
          scenario,
          start_year,
          end_year,
        };

        const res = await fetch(`${apiBase}/climate`, {
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

        const payload = (await res.json()) as ClimateResultsMap;
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
    [apiBase, cancelInFlight, canRun, selectedSubs, selectedScenario, selectedStartYear, selectedEndYear]
  );

  const reset = useCallback(() => {
    cancelInFlight();
    setPosting(false);
    setError(null);
    setResults(null);
  }, [cancelInFlight]);

  const value: Ctx = useMemo(
    () => ({
      posting,
      error,
      results,
      hasSelection: selectedSubs.length > 0,
      selectionConfirmed,
      selectedSubs,
      selectedScenario,
      selectedStartYear,
      selectedEndYear,
      run,
      reset,
      setSelectedScenario,
      setSelectedStartYear,
      setSelectedEndYear,
    }),
    [
      posting,
      error,
      results,
      selectedSubs.length,
      selectionConfirmed,
      selectedSubs,
      selectedScenario,
      selectedStartYear,
      selectedEndYear,
      run,
      reset,
    ]
  );

  return <ClimateContext.Provider value={value}>{children}</ClimateContext.Provider>;
};

export const useClimate = () => {
  const ctx = useContext(ClimateContext);
  if (!ctx) throw new Error('useClimate must be used within ClimateProvider');
  return ctx;
};
