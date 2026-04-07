'use client';

import { useGwaStore } from "../store/gwa.store";
import { getConfirmedCountSummary, getWorkflowCompletionPercent, getWorkflowModuleStatuses } from "../utils/helpers";

export default function OverviewModule() {
  const { confirmedLocation, wells, trend, recharge, demand, gsr, forecast, setActiveModule } = useGwaStore();
  const summary = getConfirmedCountSummary(confirmedLocation);
  const moduleStatuses = getWorkflowModuleStatuses({
    confirmedLocation,
    wells,
    trend,
    recharge,
    demand,
    gsr,
    forecast,
  }).filter((item) => item.key !== "overview");
  const completion = getWorkflowCompletionPercent({
    confirmedLocation,
    wells,
    trend,
    recharge,
    demand,
    gsr,
    forecast,
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,_rgba(59,130,246,0.12),_rgba(14,165,233,0.06),_rgba(255,255,255,0.95))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Workflow Overview</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{confirmedLocation?.label}</div>
            <div className="mt-2 max-w-2xl text-sm text-slate-600">
              Move through the modules from wells to forecast. Each card shows what is already ready and what still
              needs action.
            </div>
          </div>
          <div className="min-w-40 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Completion</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{completion}%</div>
            <div className="mt-3 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summary.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {moduleStatuses.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={() => setActiveModule(item.key)}
            className={`rounded-2xl border p-4 text-left transition ${
              item.disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-50/80 text-slate-400"
                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="mt-2 text-base font-semibold text-slate-900">{item.description}</div>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  item.status === "complete"
                    ? "bg-emerald-50 text-emerald-700"
                    : item.status === "ready"
                      ? "bg-blue-50 text-blue-700"
                      : item.status === "locked"
                        ? "bg-slate-200 text-slate-500"
                        : "bg-amber-50 text-amber-700"
                }`}
              >
                {item.status}
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">{item.detail}</div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{item.count} record(s)</span>
              <span>{item.disabled ? "Unlock prerequisites first" : "Open module"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
