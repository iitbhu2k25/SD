"use client";

import { useEffect, useMemo } from "react";
import { fetchAdminBlocks, fetchAdminDistricts, fetchAdminStates, fetchAdminVillages } from "../services/admin-location.service";
import { useRsqStore } from "../store/rsq.store";

export function useAdminLocation() {
  const admin = useRsqStore((state) => state.admin);
  const setAdmin = useRsqStore((state) => state.setAdmin);

  useEffect(() => {
    let cancelled = false;

    async function loadStates() {
      if (admin.states.length > 0) {
        return;
      }

      setAdmin((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const states = await fetchAdminStates();
        if (!cancelled) {
          setAdmin((state) => ({ ...state, states }));
        }
      } catch (error) {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch states" }));
        }
      } finally {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadStates();
    return () => {
      cancelled = true;
    };
  }, [admin.states.length, setAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function loadDistricts() {
      if (!admin.selectedState) {
        setAdmin((state) => ({ ...state, districts: [] }));
        return;
      }

      setAdmin((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const districts = await fetchAdminDistricts(admin.selectedState);
        if (!cancelled) {
          setAdmin((state) => ({ ...state, districts }));
        }
      } catch (error) {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch districts" }));
        }
      } finally {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadDistricts();
    return () => {
      cancelled = true;
    };
  }, [admin.selectedState, setAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function loadBlocks() {
      if (admin.selectedDistricts.length === 0) {
        setAdmin((state) => ({ ...state, blocks: [] }));
        return;
      }

      setAdmin((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const blocks = await fetchAdminBlocks(admin.selectedDistricts);
        if (!cancelled) {
          setAdmin((state) => ({ ...state, blocks }));
        }
      } catch (error) {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch blocks" }));
        }
      } finally {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadBlocks();
    return () => {
      cancelled = true;
    };
  }, [admin.selectedDistricts, setAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function loadVillages() {
      if (admin.selectedBlocks.length === 0) {
        setAdmin((state) => ({ ...state, villages: [] }));
        return;
      }

      setAdmin((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const villages = await fetchAdminVillages(admin.selectedBlocks);
        if (!cancelled) {
          setAdmin((state) => ({ ...state, villages }));
        }
      } catch (error) {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch villages" }));
        }
      } finally {
        if (!cancelled) {
          setAdmin((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadVillages();
    return () => {
      cancelled = true;
    };
  }, [admin.selectedBlocks, setAdmin]);

  const sortedStates = useMemo(() => {
    const copy = [...admin.states];
    const index = copy.findIndex((state) => Number(state.id) === 9);
    if (index !== -1) {
      const [preferred] = copy.splice(index, 1);
      copy.unshift(preferred);
    }
    return copy;
  }, [admin.states]);

  return {
    ...admin,
    sortedStates,
    handleStateChange: (selectedState: string | null) =>
      setAdmin((state) => ({
        ...state,
        selectedState,
        selectedDistricts: [],
        selectedBlocks: [],
        selectedVillages: [],
        districts: selectedState ? state.districts : [],
        blocks: [],
        villages: [],
      })),
    setSelectedDistricts: (selectedDistricts: string[]) =>
      setAdmin((state) => ({
        ...state,
        selectedDistricts,
        selectedBlocks: [],
        selectedVillages: [],
        blocks: [],
        villages: [],
      })),
    setSelectedBlocks: (selectedBlocks: string[]) =>
      setAdmin((state) => ({
        ...state,
        selectedBlocks,
        selectedVillages: [],
        villages: [],
      })),
    setSelectedVillages: (selectedVillages: string[]) => setAdmin((state) => ({ ...state, selectedVillages })),
    resetSelections: () =>
      setAdmin((state) => ({
        ...state,
        selectedState: null,
        selectedDistricts: [],
        selectedBlocks: [],
        selectedVillages: [],
        districts: [],
        blocks: [],
        villages: [],
        error: null,
      })),
  };
}
