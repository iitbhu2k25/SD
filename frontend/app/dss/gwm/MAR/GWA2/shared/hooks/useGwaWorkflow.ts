'use client';

import { useCallback } from "react";

import {
  computeAgriculturalDemand,
  computeDomesticDemand,
  computeForecast,
  computeGsr,
  computeIndustrialDemand,
  computeRecharge,
  computeStress,
  computeTrend,
  fetchCropsForSeason,
  fetchWellsForLocation,
  uploadRowsAsCsv,
  validateCsv,
} from "../services/module.service";
import { useGwaStore } from "../store/gwa.store";
import { combineDemandRows, getAvailableYearsFromWells, getWellDisplayColumns, parseCsvText } from "../utils/helpers";

export function useGwaWorkflow() {
  const store = useGwaStore();

  const loadExistingWells = useCallback(async () => {
    if (!store.confirmedLocation) return;

    store.setWellsState({ loading: true, error: null, uploadMessage: null, uploadSuccess: false });
    try {
      const data = await fetchWellsForLocation(store.confirmedLocation);
      store.setWellsState({
        selectionMode: "existing_and_new",
        data,
        loading: false,
        isSaved: false,
        csvFilename: null,
      });
    } catch (error) {
      store.setWellsState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load wells",
      });
    }
  }, [store]);

  const importCsv = useCallback(
    async (file: File) => {
      store.setWellsState({ isUploading: true, uploadMessage: null, uploadSuccess: false, error: null });
      try {
        const validation = await validateCsv(file);
        if (validation.valid === false) {
          store.setWellsState({
            isUploading: false,
            uploadSuccess: false,
            uploadMessage: validation.message ?? "CSV validation failed",
          });
          return;
        }

        const rows = parseCsvText(await file.text());
        store.setWellsState({
          selectionMode: "upload_csv",
          data: rows,
          isUploading: false,
          isSaved: false,
          uploadSuccess: true,
          uploadMessage: validation.message ?? `Loaded ${rows.length} rows from CSV`,
          csvFilename: null,
        });
      } catch (error) {
        store.setWellsState({
          isUploading: false,
          uploadSuccess: false,
          uploadMessage: error instanceof Error ? error.message : "Failed to process CSV",
        });
      }
    },
    [store],
  );

  const saveWells = useCallback(async () => {
    const { wells } = store;
    if (!wells.data.length) return;

    store.setWellsState({ isUploading: true, error: null, uploadMessage: null });
    try {
      const columns = getWellDisplayColumns(wells.data, wells.customColumns, wells.selectionMode);
      const csvFilename = await uploadRowsAsCsv(wells.data, columns, wells.selectionMode);
      store.setWellsState({
        isUploading: false,
        isSaved: true,
        csvFilename,
        uploadSuccess: true,
        uploadMessage: csvFilename ? `Wells saved as ${csvFilename}` : "Wells saved",
      });
    } catch (error) {
      store.setWellsState({
        isUploading: false,
        uploadSuccess: false,
        error: error instanceof Error ? error.message : "Failed to save wells",
      });
    }
  }, [store]);

  const runTrend = useCallback(async () => {
    const { confirmedLocation, wells, trend } = store;
    if (!confirmedLocation || !wells.csvFilename || !trend.yearStart || !trend.yearEnd) return;

    const start = Number(trend.yearStart);
    const end = Number(trend.yearEnd);
    const years = Array.from({ length: end - start + 1 }, (_, index) => String(start + index));

    store.setTrendState({ loading: true, error: null, data: null });
    try {
      const data = await computeTrend(confirmedLocation, wells.csvFilename, years);
      store.setTrendState({ loading: false, data });
    } catch (error) {
      store.setTrendState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to compute trend",
      });
    }
  }, [store]);

  const runRecharge = useCallback(async () => {
    const { confirmedLocation, wells } = store;
    if (!confirmedLocation || !wells.csvFilename) return;

    store.setRechargeState({ loading: true, error: null, data: [] });
    try {
      const result = await computeRecharge(confirmedLocation, wells.csvFilename);
      store.setRechargeState({
        loading: false,
        data: result.village_wise_results ?? result.data ?? [],
      });
    } catch (error) {
      store.setRechargeState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to compute recharge",
      });
    }
  }, [store]);

  const loadCrops = useCallback(
    async (season: string) => {
      store.setDemandState({
        cropsLoading: { ...store.demand.cropsLoading, [season]: true },
        cropsError: { ...store.demand.cropsError, [season]: null },
      });

      try {
        const result = await fetchCropsForSeason(season);
        store.setDemandState({
          cropsLoading: { ...store.demand.cropsLoading, [season]: false },
          availableCrops: {
            ...store.demand.availableCrops,
            [season]: result.data?.crops ?? [],
          },
        });
      } catch (error) {
        store.setDemandState({
          cropsLoading: { ...store.demand.cropsLoading, [season]: false },
          cropsError: {
            ...store.demand.cropsError,
            [season]: error instanceof Error ? error.message : `Failed to load ${season} crops`,
          },
        });
      }
    },
    [store],
  );

  const refreshCombinedDemand = useCallback(() => {
    const latestDemand = useGwaStore.getState().demand;
    store.setDemandState({
      combinedData: combineDemandRows(
        latestDemand.domesticData,
        latestDemand.agriculturalData,
        latestDemand.industrialResultData,
      ),
    });
  }, [store]);

  const runDomesticDemand = useCallback(async () => {
    const { confirmedLocation, wells, demand } = store;
    if (!confirmedLocation || !wells.csvFilename) return;

    store.setDemandState({ domesticLoading: true, domesticError: null });
    try {
      const result = await computeDomesticDemand(confirmedLocation, wells.csvFilename, demand.perCapitaConsumption);
      store.setDemandState({
        domesticLoading: false,
        domesticData: result.forecasts ?? [],
      });
      refreshCombinedDemand();
    } catch (error) {
      store.setDemandState({
        domesticLoading: false,
        domesticError: error instanceof Error ? error.message : "Failed to compute domestic demand",
      });
    }
  }, [refreshCombinedDemand, store]);

  const runAgriculturalDemand = useCallback(async () => {
    const { confirmedLocation, demand } = store;
    if (!confirmedLocation) return;

    store.setDemandState({ agriculturalLoading: true, agriculturalError: null, chartsError: null });
    try {
      const seasons = {
        kharif: demand.kharifChecked,
        rabi: demand.rabiChecked,
        zaid: demand.zaidChecked,
      };
      const result = await computeAgriculturalDemand(
        confirmedLocation,
        demand.selectedCrops,
        demand.groundwaterFactor,
        seasons,
      );
      store.setDemandState({
        agriculturalLoading: false,
        agriculturalData: result.data ?? [],
        chartData: result.charts ?? null,
        chartsError: result.charts_error ?? null,
      });
      refreshCombinedDemand();
    } catch (error) {
      store.setDemandState({
        agriculturalLoading: false,
        agriculturalError: error instanceof Error ? error.message : "Failed to compute agricultural demand",
      });
    }
  }, [refreshCombinedDemand, store]);

  const runIndustrialDemand = useCallback(async () => {
    const { confirmedLocation, wells, demand } = store;
    if (!confirmedLocation || !wells.csvFilename) return;

    store.setDemandState({ industrialLoading: true, industrialError: null });
    try {
      const totalAnnualDemand = demand.industrialData.reduce(
        (sum, item) => sum + item.production * item.consumptionValue,
        0,
      );
      const groundwaterIndustrialDemand = totalAnnualDemand * demand.industrialGWShare;
      const result = await computeIndustrialDemand(confirmedLocation, wells.csvFilename, groundwaterIndustrialDemand);
      store.setDemandState({
        industrialLoading: false,
        industrialResultData: result.data ?? result.forecasts ?? [],
      });
      refreshCombinedDemand();
    } catch (error) {
      store.setDemandState({
        industrialLoading: false,
        industrialError: error instanceof Error ? error.message : "Failed to compute industrial demand",
      });
    }
  }, [refreshCombinedDemand, store]);

  const runGsr = useCallback(async () => {
    const { confirmedLocation, recharge, demand, trend } = store;
    if (!confirmedLocation || !recharge.data.length || !demand.combinedData.length) return;

    store.setGsrState({ loading: true, error: null, data: [] });
    try {
      const trendCsvFilename =
        trend.data?.summary_stats?.file_info?.trend_csv_filename ??
        trend.data?.trend_csv_filename ??
        "";
      const result = await computeGsr(confirmedLocation, recharge.data, demand.combinedData, trendCsvFilename);
      store.setGsrState({
        loading: false,
        data: result.data ?? result.gsr_data ?? result.results ?? [],
      });
    } catch (error) {
      store.setGsrState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to compute GSR",
      });
    }
  }, [store]);

  const runStress = useCallback(async () => {
    const { confirmedLocation, gsr } = store;
    if (!confirmedLocation || !gsr.data.length || !gsr.stressYears) return;

    store.setGsrState({ stressLoading: true, stressError: null, stressData: [] });
    try {
      const result = await computeStress(confirmedLocation, gsr.data, Number(gsr.stressYears));
      store.setGsrState({
        stressLoading: false,
        stressData: result.data ?? result.stress_data ?? result.results ?? [],
      });
    } catch (error) {
      store.setGsrState({
        stressLoading: false,
        stressError: error instanceof Error ? error.message : "Failed to compute MAR need assessment",
      });
    }
  }, [store]);

  const runForecast = useCallback(async () => {
    const { forecast, trend } = store;
    const filename =
      trend.data?.summary_stats?.file_info?.timeseries_yearly_csv_filename ??
      trend.data?.timeseries_yearly_csv_filename;
    if (!filename || !forecast.rangeStart || !forecast.rangeEnd) return;

    const start = Number(forecast.rangeStart);
    const end = Number(forecast.rangeEnd);
    const targetYears = Array.from({ length: end - start + 1 }, (_, index) => start + index);

    store.setForecastState({ loading: true, error: null, data: null });
    try {
      const data = await computeForecast(forecast.method, forecast.forecastType, targetYears, filename);
      store.setForecastState({ loading: false, data });
    } catch (error) {
      store.setForecastState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to compute forecast",
      });
    }
  }, [store]);

  return {
    loadExistingWells,
    importCsv,
    saveWells,
    runTrend,
    runRecharge,
    loadCrops,
    runDomesticDemand,
    runAgriculturalDemand,
    runIndustrialDemand,
    runGsr,
    runStress,
    runForecast,
    availableYears: getAvailableYearsFromWells(store.wells.data),
  };
}
