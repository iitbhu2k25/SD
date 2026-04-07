'use client';

import ModuleDataTable from "./ModuleDataTable";
import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";

export default function TrendModule() {
  const { trend, wells, setTrendState } = useGwaStore();
  const { runTrend, availableYears } = useGwaWorkflow();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Trend Analysis</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={trend.yearStart}
            onChange={(event) => setTrendState({ yearStart: event.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">From year</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={trend.yearEnd}
            onChange={(event) => setTrendState({ yearEnd: event.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">To year</option>
            {availableYears
              .filter((year) => !trend.yearStart || Number(year) > Number(trend.yearStart))
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          onClick={runTrend}
          disabled={!wells.csvFilename || !trend.yearStart || !trend.yearEnd || trend.loading}
          className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {trend.loading ? "Running..." : "Generate Trend"}
        </button>
        {trend.error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{trend.error}</div>}
      </div>

      {trend.data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Villages</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {trend.data.summary_stats?.file_info?.total_villages ?? trend.data.total_villages ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Trend CSV</div>
              <div className="mt-2 break-all text-sm font-medium text-slate-900">
                {trend.data.summary_stats?.file_info?.trend_csv_filename ?? "-"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Timeseries CSV</div>
              <div className="mt-2 break-all text-sm font-medium text-slate-900">
                {trend.data.summary_stats?.file_info?.timeseries_yearly_csv_filename ?? "-"}
              </div>
            </div>
          </div>
          <ModuleDataTable
            rows={trend.data.villages ?? []}
            emptyMessage="Trend response arrived, but no village trend rows were returned."
          />
        </>
      )}
    </div>
  );
}
