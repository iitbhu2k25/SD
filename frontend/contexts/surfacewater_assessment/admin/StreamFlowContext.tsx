'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

export type FDCPoint = { p: number; q: number };
export type FDCSeries = {
  vlcode: string;
  village: string;
  n: number;
  curve: FDCPoint[];
  quantiles: Record<string, number>;
  // imageBase64 removed from steady state; fetch via fetchFdcPng when needed
  subdistrictCode?: string | number;
};

type StreamFlowContextValue = {
  loading: boolean;
  error: string | null;
  series: FDCSeries[];
  hasData: boolean;
  lastFetchedSubdistricts: number[];
  refresh: () => void;
  fetchData: (subdistrictIds?: number[]) => void;
  clearData: () => void;
  // New: fetch PNG for a given vlcode
  fetchFdcPng: (vlcode: string | number) => Promise<string | null>;
};

const StreamFlowContext = createContext<StreamFlowContextValue | undefined>(undefined);

export const StreamFlowProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<FDCSeries[]>([]);
  const [lastFetchedSubdistricts, setLastFetchedSubdistricts] = useState<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9000';

  const fetchFDCBulk = useCallback(
    async (subdistrictIds: number[]) => {
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${apiBase}/django/swa/adminfdc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ subdistrict_codes: subdistrictIds }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Village FDC request failed (${res.status}) ${text}`);
        }

        // {
        //   subdistrict_codes: number[],
        //   results: { [subdistrict_code: string]: {
        //     [vlcode: string]: {
        //       village: string; n: number; exceed_prob: number[]; sorted_flows: number[];
        //       quantiles: Record<string, number>;
        //     }
        //   }},
        //   errors: { [key: string]: string } | null
        // }
        const data: {
          subdistrict_codes: Array<string | number>;
          results: Record<
            string,
            Record<
              string,
              {
                village: string;
                n: number;
                exceed_prob: number[];
                sorted_flows: number[];
                quantiles: Record<string, number>;
              }
            >
          >;
          errors: Record<string, string> | null;
        } = await res.json();

        const out: FDCSeries[] = [];

        if (data?.results) {
          for (const sdCode of Object.keys(data.results)) {
            const perVillage = data.results[sdCode] || {};
            for (const vlcode of Object.keys(perVillage)) {
              const r = perVillage[vlcode];
              const p = r.exceed_prob || [];
              const q = r.sorted_flows || [];
              const curve: FDCPoint[] = p.map((prob, i) => ({ p: prob, q: q[i] ?? 0 }));
              out.push({
                vlcode,
                village: r.village,
                n: r.n ?? 0,
                curve,
                quantiles: r.quantiles ?? {},
                subdistrictCode: sdCode,
              });
            }
          }
        }

        if (data?.errors) {
          for (const k of Object.keys(data.errors)) {
            if (!out.find((s) => s.vlcode === k)) {
              out.push({ vlcode: k, village: data.errors[k] ?? 'Unknown', n: 0, curve: [], quantiles: {} });
            }
          }
        }

        out.sort((a, b) => a.village.localeCompare(b.village));
        setSeries(out);

        const confirmIds =
          Array.isArray(data?.subdistrict_codes) && data.subdistrict_codes.length > 0
            ? data.subdistrict_codes.map(Number).filter((n) => !Number.isNaN(n))
            : subdistrictIds;
        setLastFetchedSubdistricts(confirmIds);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setError(e?.message ?? 'Failed to fetch Village FDC');
          setSeries([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiBase]
  );

  const fetchData = useCallback(
    (subdistrictIds?: number[]) => {
      if (!selectionConfirmed) {
        setError('Confirm subdistrict selection first.');
        setSeries([]);
        setLastFetchedSubdistricts([]);
        return;
      }
      const ids = subdistrictIds && subdistrictIds.length > 0 ? subdistrictIds : getConfirmedSubdistrictIds();
      if (ids.length === 0) {
        setSeries([]);
        setError(null);
        setLastFetchedSubdistricts([]);
        return;
      }
      fetchFDCBulk(ids);
    },
    [selectionConfirmed, getConfirmedSubdistrictIds, fetchFDCBulk]
  );

  const refresh = useCallback(() => {
    if (!selectionConfirmed) {
      setSeries([]);
      setError(null);
      setLastFetchedSubdistricts([]);
      return;
    }
    const ids = getConfirmedSubdistrictIds();
    if (ids.length === 0) {
      setSeries([]);
      setError(null);
      setLastFetchedSubdistricts([]);
      return;
    }
    fetchFDCBulk(ids);
  }, [selectionConfirmed, getConfirmedSubdistrictIds, fetchFDCBulk]);

  const clearData = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    setSeries([]);
    setError(null);
    setLastFetchedSubdistricts([]);
    setLoading(false);
  }, []);

  // New: POST only vlcode to get image_base64
  const fetchFdcPng = useCallback(
    async (vlcode: string | number): Promise<string | null> => {
      try {
        const res = await fetch(`${apiBase}/django/swa/adminfdcimage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vlcode }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`FDC PNG request failed (${res.status}) ${text}`);
        }
        const data = await res.json();
        const b64: string | undefined = data?.image_base64;
        return b64 ?? null;
      } catch (err) {
        console.error('Failed to fetch FDC PNG:', err);
        return null;
      }
    },
    [apiBase]
  );

  const hasData = series.length > 0;

  const value = useMemo(
    () => ({
      loading,
      error,
      series,
      hasData,
      lastFetchedSubdistricts,
      refresh,
      fetchData,
      clearData,
      fetchFdcPng,
    }),
    [loading, error, series, hasData, lastFetchedSubdistricts, refresh, fetchData, clearData, fetchFdcPng]
  );

  return <StreamFlowContext.Provider value={value}>{children}</StreamFlowContext.Provider>;
};

export const useStreamFlowContext = () => {
  const ctx = useContext(StreamFlowContext);
  if (!ctx) throw new Error('useStreamFlowContext must be used within StreamFlowProvider');
  return ctx;
};
