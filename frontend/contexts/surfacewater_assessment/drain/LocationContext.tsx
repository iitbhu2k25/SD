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

  // 🐛 DEBUG: Log when provider mounts
  // useEffect(() => {
  //   console.log('🔵 LocationProvider mounted');
  //   return () => console.log('🔴 LocationProvider unmounting');
  // }, []);

  // 🐛 DEBUG: Log selection changes
  // useEffect(() => {
  //   console.log('📊 Selected subbasins changed:', selectedSubbasins);
  // }, [selectedSubbasins]);

  useEffect(() => {
    selectedSubbasinsRef.current = selectedSubbasins;
  }, [selectedSubbasins]);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? `${process.env.NEXT_PUBLIC_FAST_URL}`;

  const fetchOnce = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/swa/subbasin`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });
      if (!res.ok) throw new Error(`Failed to fetch subbasins (${res.status})`);
      const data: Subbasin[] = await res.json();
      setSubbasins(data);
      // console.log('✅ Fetched subbasins:', data.length);

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
  }, [apiBase]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOnce(controller.signal);
    return () => controller.abort();
  }, [fetchOnce]);

  const toggleSubbasinByNumber = useCallback((sub: number) => {
    // console.log('🔄 toggleSubbasinByNumber called with:', sub);
    
    // Find the subbasin in the current list
    const subbasin = subbasins.find(s => s.sub === sub);
    // console.log('🔍 Found subbasin in list:', subbasin);
    
    if (!subbasin) {
      // console.warn('⚠️ Subbasin not found in subbasins list:', sub);
      return;
    }
    
    // Toggle selection
    setSelectedSubbasins(currentSelected => {
      const exists = currentSelected.find(s => s.sub === sub);
      const next = exists 
        ? currentSelected.filter(s => s.sub !== sub) 
        : [...currentSelected, subbasin];
      
      // console.log('✅ Updated selection:', {
      //   previous: currentSelected.map(s => s.sub),
      //   next: next.map(s => s.sub),
      //   action: exists ? 'removed' : 'added'
      // });
      
      return next;
    });
    
    // Reset confirmation
    setSelectionConfirmed(false);
  }, [subbasins]);

  const isSelected = useCallback((sub: number) => {
    return selectedSubbasins.some(s => s.sub === sub);
  }, [selectedSubbasins]);

  const setSelectedSubbasinsCallback = useCallback((subs: Subbasin[]) => {
    // console.log('📝 setSelectedSubbasins called with:', subs);
    setSelectedSubbasins(subs);
    setSelectionConfirmed(false);
  }, []);

  const clearSelection = useCallback(() => {
    // console.log('🗑️ clearSelection called');
    setSelectedSubbasins([]);
    setSelectionConfirmed(false);
  }, []);

  const confirmSelection = useCallback(() => {
    // console.log('✔️ confirmSelection called');
    if (selectedSubbasinsRef.current.length > 0) setSelectionConfirmed(true);
  }, []);

  const refresh = useCallback(async () => {
    // console.log('🔄 refresh called');
    setSelectionConfirmed(false);
    setSelectedSubbasins([]);
    await fetchOnce();
  }, [fetchOnce]);

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
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocationContext = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    // console.error('❌ useLocationContext called outside LocationProvider!');
    throw new Error('useLocationContext must be used within LocationProvider');
  }
  // console.log('✅ useLocationContext accessed, selected count:', ctx.selectedSubbasins.length);
  return ctx;
};