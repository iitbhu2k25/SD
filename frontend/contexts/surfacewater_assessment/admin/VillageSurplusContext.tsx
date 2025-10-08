'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

export type VillageTimeseriesPoint = { month: number; flow: number };

export type VillageSurplus = {
  vlcode: string;
  village: string;
  Q25_m3: number;
  surplus_runoff_Mm3: number;
  statistics: {
    max_flow: number;
    min_flow: number;
    mean_flow: number;
    surplus_months: number;
    total_data_points: number;
  };
  timeseries: VillageTimeseriesPoint[];
  // image_base64 removed from steady state; use fetchVillagePng for on-demand image
  error?: string;
  subdistrictCode?: string | number;
};

type VillageSurplusContextValue = {
  loading: boolean;
  error: string | null;
  items: VillageSurplus[];
  hasData: boolean;
  lastFetchedSubdistricts: number[];
  fetchData: (subdistrictIds?: number[]) => void;
  refresh: () => void;
  clearData: () => void;
  // New: fetch server PNG for a village by vlcode
  fetchVillagePng: (vlcode: string | number) => Promise<string | null>;
};

const VillageSurplusContext = createContext<VillageSurplusContextValue | undefined>(undefined);

export const VillageSurplusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VillageSurplus[]>([]);
  const [lastFetchedSubdistricts, setLastFetchedSubdistricts] = useState<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9000';

  const fetchSurplusBulk = useCallback(
    async (subdistrictIds: number[]) => {
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${apiBase}/django/swa/adminsurfacewater`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ subdistrict_codes: subdistrictIds }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Village Surplus request failed (${res.status}) ${text}`);
        }

        // {
        //   subdistrict_codes: number[] | string[],
        //   results: { [sdCode: string]: { [vlcode: string]: VillageSurplusLike } },
        //   errors?: { [key: string]: string } | null
        // }
        const data: {
          subdistrict_codes: Array<string | number>;
          results: Record<string, Record<string, any>>;
          errors: Record<string, string> | null;
        } = await res.json();

        const out: VillageSurplus[] = [];
        if (data?.results) {
          for (const sdCode of Object.keys(data.results)) {
            const perVillage = data.results[sdCode] || {};
            for (const vlcode of Object.keys(perVillage)) {
              const v = perVillage[vlcode];
              out.push({
                vlcode: String(v.vlcode ?? vlcode),
                village: v.village ?? 'Unknown',
                Q25_m3: v.Q25_m3 ?? 0,
                surplus_runoff_Mm3: v.surplus_runoff_Mm3 ?? 0,
                statistics:
                  v.statistics ?? {
                    max_flow: 0,
                    min_flow: 0,
                    mean_flow: 0,
                    surplus_months: 0,
                    total_data_points: 0,
                  },
                timeseries: Array.isArray(v.timeseries) ? v.timeseries : [],
                // image_base64 intentionally ignored; PNG is fetched via image endpoint on demand
                error: v.error,
                subdistrictCode: sdCode,
              });
            }
          }
        }

        if (data?.errors) {
          for (const k of Object.keys(data.errors)) {
            if (!out.find((s) => s.vlcode === String(k))) {
              out.push({
                vlcode: String(k),
                village: data.errors[k] ?? 'Unknown',
                Q25_m3: 0,
                surplus_runoff_Mm3: 0,
                statistics: {
                  max_flow: 0,
                  min_flow: 0,
                  mean_flow: 0,
                  surplus_months: 0,
                  total_data_points: 0,
                },
                timeseries: [],
                error: data.errors[k],
              });
            }
          }
        }

        out.sort((a, b) => a.village.localeCompare(b.village));
        setItems(out);

        const usedIds =
          Array.isArray(data?.subdistrict_codes) && data.subdistrict_codes.length > 0
            ? data.subdistrict_codes.map(Number).filter((n) => !Number.isNaN(n))
            : subdistrictIds;
        setLastFetchedSubdistricts(usedIds);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setError(e?.message ?? 'Failed to fetch Village Surplus');
          setItems([]);
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
        setItems([]);
        setLastFetchedSubdistricts([]);
        return;
      }
      const ids =
        subdistrictIds && subdistrictIds.length > 0 ? subdistrictIds : getConfirmedSubdistrictIds();
      if (ids.length === 0) {
        setItems([]);
        setError(null);
        setLastFetchedSubdistricts([]);
        return;
      }
      fetchSurplusBulk(ids);
    },
    [selectionConfirmed, getConfirmedSubdistrictIds, fetchSurplusBulk]
  );

  const refresh = useCallback(() => {
    if (!selectionConfirmed) {
      setItems([]);
      setError(null);
      setLastFetchedSubdistricts([]);
      return;
    }
    const ids = getConfirmedSubdistrictIds();
    if (ids.length === 0) {
      setItems([]);
      setError(null);
      setLastFetchedSubdistricts([]);
      return;
    }
    fetchSurplusBulk(ids);
  }, [selectionConfirmed, getConfirmedSubdistrictIds, fetchSurplusBulk]);

  const clearData = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    setItems([]);
    setError(null);
    setLastFetchedSubdistricts([]);
    setLoading(false);
  }, []);

  // New: POST only vlcode and return image_base64
  const fetchVillagePng = useCallback(
    async (vlcode: string | number): Promise<string | null> => {
      try {
        const res = await fetch(`${apiBase}/django/swa/adminsurfacewaterimage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vlcode }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`PNG request failed (${res.status}) ${text}`);
        }
        const data = await res.json();
        const b64: string | undefined = data?.image_base64;
        return b64 ?? null;
      } catch (err) {
        console.error('Failed to fetch village PNG:', err);
        return null;
      }
    },
    [apiBase]
  );

  const hasData = items.length > 0;

  const value = useMemo(
    () => ({
      loading,
      error,
      items,
      hasData,
      lastFetchedSubdistricts,
      fetchData,
      refresh,
      clearData,
      fetchVillagePng,
    }),
    [loading, error, items, hasData, lastFetchedSubdistricts, fetchData, refresh, clearData, fetchVillagePng]
  );

  return <VillageSurplusContext.Provider value={value}>{children}</VillageSurplusContext.Provider>;
};

export const useVillageSurplusContext = () => {
  const ctx = useContext(VillageSurplusContext);
  if (!ctx) throw new Error('useVillageSurplusContext must be used within VillageSurplusProvider');
  return ctx;
};
