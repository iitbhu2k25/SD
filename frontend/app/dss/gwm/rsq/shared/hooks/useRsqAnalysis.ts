"use client";

import { useEffect } from "react";
import { fetchRsqQuantification } from "../services/rsq.service";
import { useRsqStore } from "../store/rsq.store";
import type { RsqView } from "../types/rsq.types";

export function useRsqAnalysis(view: RsqView) {
  const analysis = useRsqStore((state) => state.analysis[view]);
  const adminSelectedVillages = useRsqStore((state) => state.admin.selectedVillages);
  const drainSelectedVillages = useRsqStore((state) => state.drain.selectedVillages);
  const setAnalysis = useRsqStore((state) => state.setAnalysis);
  const clearAnalysis = useRsqStore((state) => state.clearAnalysis);

  const selectedVillages = view === "admin" ? adminSelectedVillages : drainSelectedVillages;

  useEffect(() => {
    clearAnalysis(view);
  }, [clearAnalysis, selectedVillages, view]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!analysis.selectedYear || selectedVillages.length === 0) {
        return;
      }

      setAnalysis(view, (state) => ({ ...state, isLoading: true, error: null, groundWaterData: null }));

      try {
        const data = await fetchRsqQuantification(view, analysis.selectedYear, selectedVillages);
        if (!cancelled) {
          setAnalysis(view, (state) => ({ ...state, groundWaterData: data }));
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysis(view, (state) => ({
            ...state,
            error: error instanceof Error ? error.message : "Failed to fetch RSQ data",
            groundWaterData: null,
          }));
        }
      } finally {
        if (!cancelled) {
          setAnalysis(view, (state) => ({ ...state, isLoading: false }));
        }
      }
    }

    const timer = window.setTimeout(loadData, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [analysis.selectedYear, selectedVillages, setAnalysis, view]);

  return {
    ...analysis,
    selectedVillages,
    setSelectedYear: (selectedYear: string) => setAnalysis(view, (state) => ({ ...state, selectedYear })),
    clearData: () => clearAnalysis(view),
  };
}
