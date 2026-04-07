"use client";

import { useEffect } from "react";
import { fetchDrainCatchments, fetchDrainItems, fetchDrainRivers, fetchDrainStretches, fetchDrainVillages } from "../services/drain-location.service";
import { useRsqStore } from "../store/rsq.store";

export function useDrainLocation() {
  const drain = useRsqStore((state) => state.drain);
  const setDrain = useRsqStore((state) => state.setDrain);

  useEffect(() => {
    let cancelled = false;

    async function loadRivers() {
      if (drain.rivers.length > 0) {
        return;
      }
      setDrain((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const rivers = await fetchDrainRivers();
        if (!cancelled) {
          setDrain((state) => ({ ...state, rivers }));
        }
      } catch (error) {
        if (!cancelled) {
          setDrain((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch rivers" }));
        }
      } finally {
        if (!cancelled) {
          setDrain((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadRivers();
    return () => {
      cancelled = true;
    };
  }, [drain.rivers.length, setDrain]);

  useEffect(() => {
    let cancelled = false;

    async function loadStretches() {
      if (!drain.selectedRiver) {
        setDrain((state) => ({ ...state, stretches: [] }));
        return;
      }

      setDrain((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const stretches = await fetchDrainStretches(drain.selectedRiver);
        if (!cancelled) {
          setDrain((state) => ({ ...state, stretches }));
        }
      } catch (error) {
        if (!cancelled) {
          setDrain((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch stretches" }));
        }
      } finally {
        if (!cancelled) {
          setDrain((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadStretches();
    return () => {
      cancelled = true;
    };
  }, [drain.selectedRiver, setDrain]);

  useEffect(() => {
    let cancelled = false;

    async function loadDrains() {
      if (!drain.selectedRiver || !drain.selectedStretch) {
        setDrain((state) => ({ ...state, drains: [] }));
        return;
      }

      setDrain((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const drains = await fetchDrainItems(drain.selectedRiver, drain.selectedStretch);
        if (!cancelled) {
          setDrain((state) => ({ ...state, drains }));
        }
      } catch (error) {
        if (!cancelled) {
          setDrain((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch drains" }));
        }
      } finally {
        if (!cancelled) {
          setDrain((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadDrains();
    return () => {
      cancelled = true;
    };
  }, [drain.selectedRiver, drain.selectedStretch, setDrain]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatchments() {
      if (!drain.selectedDrain) {
        setDrain((state) => ({ ...state, catchments: [] }));
        return;
      }
      setDrain((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const catchments = await fetchDrainCatchments(drain.selectedDrain);
        if (!cancelled) {
          setDrain((state) => ({ ...state, catchments }));
        }
      } catch (error) {
        if (!cancelled) {
          setDrain((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch catchments" }));
        }
      } finally {
        if (!cancelled) {
          setDrain((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadCatchments();
    return () => {
      cancelled = true;
    };
  }, [drain.selectedDrain, setDrain]);

  useEffect(() => {
    if (drain.selectedDrain && drain.catchments.length > 0 && drain.selectedCatchments.length === 0) {
      setDrain((state) => ({
        ...state,
        selectedCatchments: state.catchments.map((item) => Number(item.objectId)),
      }));
    }
  }, [drain.catchments, drain.selectedCatchments.length, drain.selectedDrain, setDrain]);

  useEffect(() => {
    let cancelled = false;

    async function loadVillages() {
      if (drain.selectedCatchments.length === 0) {
        setDrain((state) => ({ ...state, villages: [] }));
        return;
      }

      const selectedCatchments = drain.catchments.filter((item) => drain.selectedCatchments.includes(Number(item.objectId)));
      const drainNumbers = selectedCatchments.map((item) => item.drainNo);

      setDrain((state) => ({ ...state, isLoading: true, error: null }));
      try {
        const villages = await fetchDrainVillages(drainNumbers);
        if (!cancelled) {
          setDrain((state) => ({ ...state, villages }));
        }
      } catch (error) {
        if (!cancelled) {
          setDrain((state) => ({ ...state, error: error instanceof Error ? error.message : "Failed to fetch villages" }));
        }
      } finally {
        if (!cancelled) {
          setDrain((state) => ({ ...state, isLoading: false }));
        }
      }
    }

    loadVillages();
    return () => {
      cancelled = true;
    };
  }, [drain.catchments, drain.selectedCatchments, setDrain]);

  return {
    ...drain,
    handleRiverChange: (selectedRiver: number) =>
      setDrain((state) => ({
        ...state,
        selectedRiver,
        selectedStretch: null,
        selectedDrain: null,
        selectedCatchments: [],
        selectedVillages: [],
        stretches: [],
        drains: [],
        catchments: [],
        villages: [],
        selectionsLocked: false,
        areaConfirmed: false,
      })),
    handleStretchChange: (selectedStretch: number) =>
      setDrain((state) => ({
        ...state,
        selectedStretch,
        selectedDrain: null,
        selectedCatchments: [],
        selectedVillages: [],
        drains: [],
        catchments: [],
        villages: [],
        areaConfirmed: false,
      })),
    handleDrainChange: (selectedDrain: number) =>
      setDrain((state) => ({
        ...state,
        selectedDrain,
        selectedCatchments: [],
        selectedVillages: [],
        catchments: [],
        villages: [],
        areaConfirmed: false,
      })),
    setSelectedCatchments: (selectedCatchments: number[]) => setDrain((state) => ({ ...state, selectedCatchments, areaConfirmed: false })),
    setSelectedVillages: (selectedVillages: number[]) => setDrain((state) => ({ ...state, selectedVillages, areaConfirmed: false })),
    handleAreaConfirm: () => setDrain((state) => ({ ...state, areaConfirmed: true, selectionsLocked: true })),
    lockSelections: () => setDrain((state) => ({ ...state, selectionsLocked: true })),
    resetSelections: () =>
      setDrain((state) => ({
        ...state,
        selectedRiver: null,
        selectedStretch: null,
        selectedDrain: null,
        selectedCatchments: [],
        selectedVillages: [],
        stretches: [],
        drains: [],
        catchments: [],
        villages: [],
        selectionsLocked: false,
        areaConfirmed: false,
        error: null,
      })),
  };
}
