'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { useLocationContext } from '@/contexts/surfacewater_assessment/admin/LocationContext';

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
  flows_Lps: number[]; // note L/s
  threshold_Lps: number;
};

export type AdminSummaryValue = {
  threshold_Lps: number;
  surplus_L: number;   // liters
  surplus_ML: number;  // million liters
};

export type AdminSummary = Record<MethodKey, AdminSummaryValue>;

export type VillageEflowResult = {
  vlcode: number;
  village: string;
  subdistrict_code: number;
  summary: AdminSummary;
  curves: Record<MethodKey, AdminCurve>;
};

export type VillageStressData = {
  vlcode: number;
  [key: string]: any;
};

export type MergedVillageData = VillageEflowResult & {
  stressData?: VillageStressData;
};

export type MethodPngResponse = {
  image_base64: string;
  threshold_Lps?: number;
  surplus_L?: number;
  surplus_ML?: number;
  method_key?: MethodKey;
};

type EflowContextValue = {
  loading: boolean;
  error: string | null;
  items: VillageEflowResult[];
  mergedItems: MergedVillageData[];
  hasData: boolean;
  hasStressData: boolean;
  lastFetchedSubdistricts: number[];
  fetchData: (subdistrictIds?: number[]) => void;
  refresh: () => void;
  clearData: () => void;
  stressColumns: string[];
  fetchMethodPng: (vlcode: number, methodKey: MethodKey) => Promise<MethodPngResponse | null>;
};

const EflowContext = createContext<EflowContextValue | undefined>(undefined);

export const EflowProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { selectionConfirmed, getConfirmedSubdistrictIds, registerResetCallback } = useLocationContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VillageEflowResult[]>([]);
  const [lastFetchedSubdistricts, setLastFetchedSubdistricts] = useState<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  // Stress data (optional)
  const [stressDataMap, setStressDataMap] = useState<Map<number, VillageStressData>>(new Map());
  const [stressColumns, setStressColumns] = useState<string[]>([]);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:9000';

  // Load stress data from localStorage if present (keeps earlier behavior)
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

          const STRESS_COLUMN_CONFIG: Record<string, string> = {
            stress_value: 'Injection Need (m³/yr)',
          };

          const firstRecord = stressData[0];
          const allCols = Object.keys(firstRecord);
          const filteredOriginalColumns = allCols.filter((c) => STRESS_COLUMN_CONFIG.hasOwnProperty(c));
          const displayColumnNames = filteredOriginalColumns.map((c) => STRESS_COLUMN_CONFIG[c]);
          setStressColumns(displayColumnNames);

          const reverseMap: Record<string, string> = {};
          filteredOriginalColumns.forEach((orig, i) => {
            reverseMap[displayColumnNames[i]] = orig;
          });
          sessionStorage.setItem('stress_column_mapping', JSON.stringify(reverseMap));
        }
      }
    } catch (err) {
      console.error('Failed to load stress data:', err);
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
      const ids = subdistrictIds && subdistrictIds.length > 0 ? subdistrictIds : getConfirmedSubdistrictIds();
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

        const data = (await res.json()) as Record<string, VillageEflowResult>;

        // Normalize parsed data (the backend already returns flows_Lps / threshold_Lps / surplus_ML)
        const parsed: VillageEflowResult[] = Object.values(data).map((r) => ({
          vlcode: r.vlcode,
          village: r.village,
          subdistrict_code: r.subdistrict_code,
          summary: r.summary,
          curves: r.curves,
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

  useEffect(() => {
    const unregister = registerResetCallback(clearData);
    return () => unregister();
  }, [registerResetCallback, clearData]);

  const hasData = items.length > 0;
  const hasStressData = stressDataMap.size > 0;

  const mergedItems = useMemo(() => {
    if (items.length === 0) return [];
    return items.map((v) => {
      const stress = stressDataMap.get(v.vlcode);
      return { ...v, stressData: stress || undefined } as MergedVillageData;
    });
  }, [items, stressDataMap]);

  const fetchMethodPng = useCallback(
    async (vlcode: number, methodKey: MethodKey): Promise<MethodPngResponse | null> => {
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
        return {
          image_base64: data?.image_base64 ?? '',
          threshold_Lps: data?.threshold_Lps ?? undefined,
          surplus_L: typeof data?.surplus_L === 'number' ? data.surplus_L : undefined,
          surplus_ML: typeof data?.surplus_ML === 'number' ? data.surplus_ML : undefined,
          method_key: data?.method_key ?? methodKey,
        };
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
