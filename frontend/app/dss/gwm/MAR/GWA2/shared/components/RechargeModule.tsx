'use client';

import ModuleDataTable from "./ModuleDataTable";
import { useGwaWorkflow } from "../hooks/useGwaWorkflow";
import { useGwaStore } from "../store/gwa.store";

export default function RechargeModule() {
  const { wells, recharge } = useGwaStore();
  const { runRecharge } = useGwaWorkflow();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-900">Recharge</div>
        <button
          type="button"
          onClick={runRecharge}
          disabled={!wells.csvFilename || recharge.loading}
          className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {recharge.loading ? "Computing..." : "Compute Recharge"}
        </button>
        {recharge.error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{recharge.error}</div>}
      </div>
      <ModuleDataTable rows={recharge.data} emptyMessage="Compute recharge after saving wells." />
    </div>
  );
}
