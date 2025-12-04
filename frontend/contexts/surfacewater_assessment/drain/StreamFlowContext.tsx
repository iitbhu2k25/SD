'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect, // Added for synchronization
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/drain/LocationContext';

export type FDCPoint = { p: number; q: number };
export type FDCSeries = {
  data: never[];
  name: any;
  id: any;
  sub: number;
  n: number;
  curve: FDCPoint[];
  quantiles: Record<string, number>;
  imageBase64?: string; // Server-rendered PNG (base64)
};

type StreamFlowContextValue = {
  loading: boolean;
  error: string | null;
  series: FDCSeries[];
  hasData: boolean;
  lastFetchedSubbasins: number[];
  refresh: () => void;
  fetchData: (subs?: number[]) => void;
  clearData: () => void;
};

const StreamFlowContext = createContext<StreamFlowContextValue | undefined>(undefined);

export const StreamFlowProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectedSubbasins, selectionConfirmed } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<FDCSeries[]>([]);
  const [lastFetchedSubbasins, setLastFetchedSubbasins] = useState<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/django/swa';

  const selectedSubs = useMemo(
    () =>
      selectedSubbasins
        .map((s) => Number(s.sub))
        .filter((v, i, a) => Number.isFinite(v) && a.indexOf(v) === i),
    [selectedSubbasins]
  );

  const canFetch = useMemo(
    () => selectedSubs.length > 0 && selectionConfirmed,
    [selectedSubs.length, selectionConfirmed]
  );

  const fetchFDC = useCallback(async (subs: number[]) => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/fdc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ subs }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`FDC request failed (${res.status}) ${text}`);
      }

      const data: {
        subs: number[];
        results: Record<
          string,
          {
            n: number;
            exceed_prob: number[];
            sorted_flows: number[];
            quantiles: Record<string, number>;
            image_base64?: string;
          }
        >;
        errors: Record<string, string> | null;
      } = await res.json();

      const out: FDCSeries[] = [];
      if (data?.results) {
        for (const key of Object.keys(data.results)) {
          const r = data.results[key];
          const p = r.exceed_prob || [];
          const q = r.sorted_flows || [];
          const curve: FDCPoint[] = p.map((prob, i) => ({ p: prob, q: q[i] ?? 0 }));
          out.push({
            sub: Number(key),
            n: r.n ?? 0,
            curve,
            quantiles: r.quantiles ?? {},
            imageBase64: r.image_base64 ?? undefined,
            data: [],
            name: undefined,
            id: undefined
          });
        }
      }

      if (data?.errors) {
        for (const k of Object.keys(data.errors)) {
          if (!out.find(s => s.sub === Number(k))) {
            out.push({
              sub: Number(k), n: 0, curve: [], quantiles: {},
              data: [],
              name: undefined,
              id: undefined
            });
          }
        }
      }

      setSeries(out.sort((a, b) => a.sub - b.sub));
      setLastFetchedSubbasins([...subs]);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? 'Failed to fetch FDC');
        setSeries([]);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const fetchData = useCallback(
    (subs?: number[]) => {
      if (!selectionConfirmed) {
        setError('Confirm subbasin selection first.');
        setSeries([]);
        setLastFetchedSubbasins([]);
        return;
      }
      const subsToFetch = subs || selectedSubbasins.map(s => s.sub);
      if (subsToFetch.length === 0) {
        setSeries([]);
        setError(null);
        setLastFetchedSubbasins([]);
        return;
      }
      fetchFDC(subsToFetch);
    },
    [selectionConfirmed, selectedSubbasins, fetchFDC]
  );

  const refresh = useCallback(() => {
    const subs = selectedSubbasins.map(s => s.sub);
    if (!selectionConfirmed || subs.length === 0) {
      setSeries([]);
      setError(null);
      setLastFetchedSubbasins([]);
      return;
    }
    fetchFDC(subs);
  }, [selectionConfirmed, selectedSubbasins, fetchFDC]);

  const clearData = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    setSeries([]);
    setError(null);
    setLastFetchedSubbasins([]);
    setLoading(false);
  }, []);

  // NEW: Synchronize with LocationContext changes
  useEffect(() => {
    // Reset state when selectedSubbasins or selectionConfirmed changes
    clearData();
    // Automatically fetch FDC data if selection is confirmed and valid
    if (canFetch) {
      fetchData();
    }
  }, [selectedSubbasins, selectionConfirmed, canFetch, clearData, fetchData]);

  const hasData = series.length > 0;

  const value = useMemo(
    () => ({
      loading,
      error,
      series,
      hasData,
      lastFetchedSubbasins,
      refresh,
      fetchData,
      clearData,
    }),
    [loading, error, series, hasData, lastFetchedSubbasins, refresh, fetchData, clearData]
  );

  return <StreamFlowContext.Provider value={value}>{children}</StreamFlowContext.Provider>;
};

export const useStreamFlowContext = () => {
  const ctx = useContext(StreamFlowContext);
  if (!ctx) throw new Error('useStreamFlowContext must be used within StreamFlowProvider');
  return ctx;
};