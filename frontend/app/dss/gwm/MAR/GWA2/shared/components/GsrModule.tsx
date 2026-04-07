'use client';

import ComputeAvailableWaterButton from "./ComputeAvailableWaterButton";
import ModuleDataTable from "./ModuleDataTable";
import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";

export default function GsrModule() {
  const { recharge, demand, gsr, setGsrState } = useGwaStore();
  const { runGsr, runStress } = useGwaWorkflow();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Groundwater Sustainability Ratio</div>
        <button
          type="button"
          onClick={runGsr}
          disabled={!recharge.data.length || !demand.combinedData.length || gsr.loading}
          className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {gsr.loading ? "Computing..." : "Compute GSR"}
        </button>
        {gsr.error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{gsr.error}</div>}
      </div>

      <ModuleDataTable rows={gsr.data} emptyMessage="Compute GSR after recharge and demand are ready." />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">MAR Need Assessment</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="1"
            max="50"
            value={gsr.stressYears}
            onChange={(event) => setGsrState({ stressYears: event.target.value })}
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Years"
          />
          <button
            type="button"
            onClick={runStress}
            disabled={!gsr.data.length || !gsr.stressYears || gsr.stressLoading}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {gsr.stressLoading ? "Computing..." : "Compute Stress"}
          </button>
        </div>
        {gsr.stressError && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{gsr.stressError}</div>
        )}
      </div>

      <ModuleDataTable rows={gsr.stressData} emptyMessage="Stress rows will appear after MAR need computation." />

      <ComputeAvailableWaterButton />
    </div>
  );
}
