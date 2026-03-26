'use client';

import { useState } from 'react';
import { useBasicStore } from '../store/basic.store';
import { runForecast } from '../services/forecast.service';
import type { ForecastResult } from '../types/result.types';

export function useForecastFlow() {
  const { confirmedLocation } = useBasicStore();
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (params: Record<string, any>) => {
    if (!confirmedLocation) {
      setError('No location confirmed. Please confirm a location first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await runForecast(confirmedLocation, params);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, run, confirmedLocation };
}