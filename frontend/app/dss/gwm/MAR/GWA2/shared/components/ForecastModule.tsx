'use client';

import ModuleDataTable from "./ModuleDataTable";
import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";

export default function ForecastModule() {
  const { forecast, trend, setForecastState } = useGwaStore();
  const { runForecast, availableYears } = useGwaWorkflow();
  const rows = forecast.data?.results ?? forecast.data?.data ?? forecast.data?.forecast_results ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Forecast</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={forecast.rangeStart}
            onChange={(event) => setForecastState({ rangeStart: event.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Forecast from year</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={forecast.rangeEnd}
            onChange={(event) => setForecastState({ rangeEnd: event.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Forecast to year</option>
            {availableYears
              .filter((year) => !forecast.rangeStart || Number(year) >= Number(forecast.rangeStart))
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          onClick={runForecast}
          disabled={!trend.data || !forecast.rangeStart || !forecast.rangeEnd || forecast.loading}
          className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {forecast.loading ? "Computing..." : "Generate Forecast"}
        </button>
        {forecast.error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{forecast.error}</div>}
      </div>

      {forecast.data && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Source Timeseries</div>
          <div className="mt-2 break-all">
            {trend.data?.summary_stats?.file_info?.timeseries_yearly_csv_filename ?? "-"}
          </div>
        </div>
      )}

      <ModuleDataTable
        rows={rows}
        emptyMessage="Forecast results will appear after trend analysis and forecast generation."
      />
    </div>
  );
}
