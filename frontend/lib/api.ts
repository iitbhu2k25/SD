import { api } from "@/services/api"
import type { AllChartsResponse, WQIOperation } from "@/interface/charts"

export async function fetchAllCharts(payload: WQIOperation): Promise<AllChartsResponse> {
  const resp = await api.post("/wqi/well_interpolation_analysis", { body: payload })
  return resp.message as AllChartsResponse
}
