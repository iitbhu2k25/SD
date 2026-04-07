'use client';

import { useEffect, useState } from "react";

import {
  fetchDrainItems,
  fetchDrainRivers,
  fetchDrainStretches,
  fetchDrainVillages,
} from "../services/location.service";
import { useGwaStore } from "../store/gwa.store";

export function useDrainSelection() {
  const {
    drainSelection,
    confirmedLocation,
    setDrainRiver,
    setDrainStretch,
    setDrainItems,
    setDrainVillages,
    setDrainSelectedVillageIds,
    resetDrainSelection,
    confirmDrainLocation,
  } = useGwaStore();

  const [rivers, setRivers] = useState<any[]>([]);
  const [stretches, setStretches] = useState<any[]>([]);
  const [drains, setDrains] = useState<any[]>([]);
  const [loadingRivers, setLoadingRivers] = useState(false);
  const [loadingStretches, setLoadingStretches] = useState(false);
  const [loadingDrains, setLoadingDrains] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingRivers(true);
    fetchDrainRivers()
      .then(setRivers)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingRivers(false));
  }, []);

  useEffect(() => {
    if (!drainSelection.river) {
      setStretches([]);
      setDrains([]);
      return;
    }

    setLoadingStretches(true);
    fetchDrainStretches(drainSelection.river.code)
      .then((items) => {
        setStretches(items);
        setDrains([]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingStretches(false));
  }, [drainSelection.river]);

  useEffect(() => {
    if (!drainSelection.river || !drainSelection.stretch) {
      setDrains([]);
      return;
    }

    setLoadingDrains(true);
    fetchDrainItems(drainSelection.river.code, drainSelection.stretch.stretchId)
      .then(setDrains)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingDrains(false));
  }, [drainSelection.river, drainSelection.stretch]);

  useEffect(() => {
    if (drainSelection.drains.length === 0) return;

    setLoadingVillages(true);
    fetchDrainVillages(drainSelection.drains.map((item) => item.drainNo))
      .then(setDrainVillages)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingVillages(false));
  }, [drainSelection.drains, setDrainVillages]);

  return {
    drainSelection,
    confirmedLocation,
    rivers,
    stretches,
    drains,
    loadingRivers,
    loadingStretches,
    loadingDrains,
    loadingVillages,
    error,
    canConfirm:
      !!drainSelection.river &&
      !!drainSelection.stretch &&
      drainSelection.selectedVillageIds.length > 0,
    selectRiver: (id: string) => {
      const selected = rivers.find((item) => item.id === id) ?? null;
      setDrainRiver(selected);
    },
    selectStretch: (id: string) => {
      const selected = stretches.find((item) => item.id === id) ?? null;
      setDrainStretch(selected);
    },
    selectDrains: (ids: string[]) => {
      setDrainItems(drains.filter((item) => ids.includes(item.id)));
    },
    toggleVillage: (id: string) => {
      const current = new Set(drainSelection.selectedVillageIds);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      setDrainSelectedVillageIds([...current]);
    },
    selectAllVillages: () => {
      setDrainSelectedVillageIds(drainSelection.villages.map((item) => item.shapeID));
    },
    clearAllVillages: () => {
      setDrainSelectedVillageIds([]);
    },
    handleReset: () => {
      resetDrainSelection();
      setStretches([]);
      setDrains([]);
      setError(null);
    },
    handleConfirm: () => {
      setError(null);
      confirmDrainLocation();
    },
  };
}
