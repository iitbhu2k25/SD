'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

export type Method = 'Q95' | 'Q90' | 'Q80';

export type MethodKey =
  | 'FDC-Q95'
  | 'FDC-Q90'
  | 'Tennant-10%'
  | 'Tennant-30%'
  | 'Tennant-60%'
  | 'Smakhtin'
  | 'Tessmann';

export type AdminCurve = {
  days: number[];
  flows: number[];
  threshold: number;
  // image_base64 removed from curves to keep payload light; images fetched via separate API on demand
};

export type AdminSummary = Record<MethodKey, number>;

export type VillageEflowResult = {
  vlcode: number;
  village: string;
  subdistrict_code: number;
  summary: AdminSummary;
  curves: Record<MethodKey, AdminCurve>;
};

// Stress data type
export type VillageStressData = {
  vlcode: number;
  [key: string]: any;
};

export type MergedVillageData = VillageEflowResult & {
  stressData?: VillageStressData;
};

type EflowContextValue = {
  loading: boolean;
  error: string | null;
  items: VillageEflowResult[];
  mergedItems: MergedVillageData[];
  hasData: boolean;
  hasStressData: boolean;
  lastFetchedSubdistricts: number[];
  method: Method;
  setMethod: (m: Method) => void;
  fetchData: (subdistrictIds?: number[]) => void;
  refresh: () => void;
  clearData: () => void;
  stressColumns: string[];
  // New: fetch PNG for a specific village+method
  fetchMethodPng: (vlcode: number, methodKey: MethodKey) => Promise<string | null>;
};

const EflowContext = createContext<EflowContextValue | undefined>(undefined);

export const EflowProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectionConfirmed, getConfirmedSubdistrictIds } = useLocationContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VillageEflowResult[]>([]);
  const [lastFetchedSubdistricts, setLastFetchedSubdistricts] = useState<number[]>([]);
  const [method, setMethod] = useState<Method>('Q95');
  const controllerRef = useRef<AbortController | null>(null);

  // Stress data state
  const [stressDataMap, setStressDataMap] = useState<Map<number, VillageStressData>>(new Map());
  const [stressColumns, setStressColumns] = useState<string[]>([]);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9000';

  // Load stress data from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stressDataJson = localStorage.getItem('gwa_stress_data');
      if (stressDataJson) {
        const stressData: any[] = JSON.parse(stressDataJson);

        if (stressData.length > 0) {
          const dataMap = new Map<number, VillageStressData>();
          stressData.forEach((record) => {
            const vlcode = record.vlcode || record.village_code || record.Village_Code;
            if (vlcode) dataMap.set(Number(vlcode), record);
          });
          setStressDataMap(dataMap);

          // Column configuration: original -> display
          const STRESS_COLUMN_CONFIG: Record<string, string> = {
            stress_value: 'Injection Need (m³/yr)',
          };

          const firstRecord = stressData[0];
          const allColumns = Object.keys(firstRecord);

          const filteredOriginalColumns = allColumns.filter((col) => STRESS_COLUMN_CONFIG.hasOwnProperty(col));
          const displayColumnNames = filteredOriginalColumns.map((col) => STRESS_COLUMN_CONFIG[col]);
          setStressColumns(displayColumnNames);

          // Store mapping (display -> original) for table lookup and CSV
          const reverseMapping: Record<string, string> = {};
          filteredOriginalColumns.forEach((originalCol, index) => {
            reverseMapping[displayColumnNames[index]] = originalCol;
          });
          sessionStorage.setItem('stress_column_mapping', JSON.stringify(reverseMapping));
        }
      }
    } catch (e) {
      console.error('Failed to load stress data from localStorage:', e);
    }
  }, []);

  const fetchData = useCallback(
    async (subdistrictIds?: number[]) => {
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
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/django/swa/eflowadmin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ subdistrict_codes: ids }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`E-flow request failed (${res.status}) ${text}`);
        }

        const data = (await res.json()) as Record<
          string,
          {
            vlcode: number;
            village: string;
            subdistrict_code: number;
            summary: AdminSummary;
            curves: Record<MethodKey, AdminCurve>;
          }
        >;

        const parsed: VillageEflowResult[] = Object.values(data).map((r) => ({
          vlcode: r.vlcode,
          village: r.village,
          subdistrict_code: r.subdistrict_code,
          summary: r.summary,
          curves: r.curves, // no image_base64 inside; images fetched separately
        }));
        setItems(parsed);
        setLastFetchedSubdistricts(ids);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setError(e?.message ?? 'Failed to fetch Environmental Flow');
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectionConfirmed, getConfirmedSubdistrictIds, apiBase]
  );

  const refresh = useCallback(() => {
    const ids = getConfirmedSubdistrictIds();
    if (!selectionConfirmed || ids.length === 0) {
      setItems([]);
      setError(null);
      setLastFetchedSubdistricts([]);
      return;
    }
    fetchData(ids);
  }, [selectionConfirmed, getConfirmedSubdistrictIds, fetchData]);

  const clearData = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    setItems([]);
    setError(null);
    setLastFetchedSubdistricts([]);
    setLoading(false);
    setStressDataMap(new Map());
    setStressColumns([]);
    localStorage.removeItem('gwa_stress_data');
    sessionStorage.removeItem('stress_column_mapping');
  }, []);

  const hasData = items.length > 0;
  const hasStressData = stressDataMap.size > 0;

  const mergedItems = useMemo(() => {
    if (items.length === 0) return [];
    return items.map((eflowItem) => {
      const stressData = stressDataMap.get(eflowItem.vlcode);
      return { ...eflowItem, stressData: stressData || undefined } as MergedVillageData;
    });
  }, [items, stressDataMap]);

  // New: fetch PNG for given village + method from dedicated endpoint
  const fetchMethodPng = useCallback(
    async (vlcode: number, methodKey: MethodKey): Promise<string | null> => {
      try {
        const res = await fetch(`${apiBase}/django/swa/eflowadminimage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vlcode, method_key: methodKey }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`PNG request failed (${res.status}) ${text}`);
        }
        const data = await res.json();
        const b64: string | undefined = data?.image_base64;
        return b64 ?? null;
      } catch (err) {
        console.error('Failed to fetch PNG:', err);
        return null;
      }
    },
    [apiBase]
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      items,
      mergedItems,
      hasData,
      hasStressData,
      lastFetchedSubdistricts,
      method,
      setMethod,
      fetchData,
      refresh,
      clearData,
      stressColumns,
      fetchMethodPng,
    }),
    [
      loading,
      error,
      items,
      mergedItems,
      hasData,
      hasStressData,
      lastFetchedSubdistricts,
      method,
      setMethod,
      fetchData,
      refresh,
      clearData,
      stressColumns,
      fetchMethodPng,
    ]
  );

  return <EflowContext.Provider value={value}>{children}</EflowContext.Provider>;
};

export const useEflowContext = () => {
  const ctx = useContext(EflowContext);
  if (!ctx) throw new Error('useEflowContext must be used within EflowProvider');
  return ctx;
};
