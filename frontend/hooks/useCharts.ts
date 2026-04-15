"use client"

import { useState, useCallback } from "react"
import { fetchAllCharts } from "@/lib/api"
import type { AllChartsResponse, WQIOperation } from "@/interface/charts"

interface UseChartsState {
  data: AllChartsResponse | null
  loading: boolean
  error: string | null
}

export function useCharts() {
  const [state, setState] = useState<UseChartsState>({
    data: null,
    loading: false,
    error: null,
  })

  const run = useCallback(async (payload: WQIOperation) => {
    setState({ data: null, loading: true, error: null })
    try {
      const data = await fetchAllCharts(payload)
      setState({ data, loading: false, error: null })
    } catch (e: unknown) {
      setState({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }, [])

  return { ...state, run }
}
