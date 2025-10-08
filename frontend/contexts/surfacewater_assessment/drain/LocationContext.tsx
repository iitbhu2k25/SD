'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';

export type Subbasin = { sub: number };

type LocationContextValue = {
  subbasins: Subbasin[];
  loading: boolean;
  error: string | null;
  selectedSubbasins: Subbasin[];
  selectionConfirmed: boolean;
  toggleSubbasinByNumber: (sub: number) => void;
  setSelectedSubbasins: (subbasins: Subbasin[]) => void;
  clearSelection: () => void;
  confirmSelection: () => void;
  refresh: () => Promise<void>;
  isSelected: (sub: number) => boolean;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [subbasins, setSubbasins] = useState<Subbasin[]>([]);
  const [selectedSubbasins, setSelectedSubbasins] = useState<Subbasin[]>([]);
  const [selectionConfirmed, setSelectionConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSubbasinsRef = useRef<Subbasin[]>([]);

  useEffect(() => {
    selectedSubbasinsRef.current = selectedSubbasins;
  }, [selectedSubbasins]); // keep ref in sync for safe async use [3]

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/django/swa';

  const fetchOnce = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/subbasin`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });
      if (!res.ok) throw new Error(`Failed to fetch subbasins (${res.status})`);
      const data: Subbasin[] = await res.json();
      setSubbasins(data);

      if (data.length > 0 && selectedSubbasinsRef.current.length > 0) {
        const stillValid = selectedSubbasinsRef.current.filter(sel =>
          data.find(s => s.sub === sel.sub)
        );
        if (stillValid.length !== selectedSubbasinsRef.current.length) {
          setSelectedSubbasins(stillValid);
          setSelectionConfirmed(false);
        }
      } else if (!data.length) {
        setSelectedSubbasins([]);
        setSelectionConfirmed(false);
        setError('No subbasins found.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e?.message ?? 'Fetch error');
    } finally {
      setLoading(false);
    }
  }, [apiBase]); // stable across renders [3]

  useEffect(() => {
    const controller = new AbortController();
    fetchOnce(controller.signal);
    return () => controller.abort();
  }, [fetchOnce]); // run once and on base change [3]

  const toggleSubbasinByNumber = useCallback((sub: number) => {
    setSubbasins(currentSubbasins => {
      const subbasin = currentSubbasins.find(s => s.sub === sub);
      if (!subbasin) return currentSubbasins;
      setSelectedSubbasins(currentSelected => {
        const exists = currentSelected.find(s => s.sub === sub);
        const next = exists ? currentSelected.filter(s => s.sub !== sub) : [...currentSelected, subbasin];
        setSelectionConfirmed(false);
        return next;
      });
      return currentSubbasins;
    });
  }, []); // toggles context selection [3]

  const isSelected = useCallback((sub: number) => {
    return selectedSubbasins.some(s => s.sub === sub);
  }, [selectedSubbasins]); // quick predicate for UI checks [3]

  const setSelectedSubbasinsCallback = useCallback((subs: Subbasin[]) => {
    setSelectedSubbasins(subs);
    setSelectionConfirmed(false);
  }, []); // external setter invalidates confirmation [3]

  const clearSelection = useCallback(() => {
    setSelectedSubbasins([]);
    setSelectionConfirmed(false);
  }, []); // clear and reset state [3]

  const confirmSelection = useCallback(() => {
    if (selectedSubbasinsRef.current.length > 0) setSelectionConfirmed(true);
  }, []); // gate to allow downstream actions [3]

  const refresh = useCallback(async () => {
    setSelectionConfirmed(false);
    setSelectedSubbasins([]);
    await fetchOnce();
  }, [fetchOnce]); // pull fresh list and reset selection [3]

  const value: LocationContextValue = useMemo(
    () => ({
      subbasins,
      loading,
      error,
      selectedSubbasins,
      selectionConfirmed,
      toggleSubbasinByNumber,
      setSelectedSubbasins: setSelectedSubbasinsCallback,
      clearSelection,
      confirmSelection,
      refresh,
      isSelected,
    }),
    [
      subbasins,
      loading,
      error,
      selectedSubbasins,
      selectionConfirmed,
      toggleSubbasinByNumber,
      setSelectedSubbasinsCallback,
      clearSelection,
      confirmSelection,
      refresh,
      isSelected,
    ]
  ); // memoized to prevent unnecessary renders [3]

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocationContext = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
};
