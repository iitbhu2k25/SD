'use client';

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

import { useGwaStore } from "../store/gwa.store";
import { getConfirmedCountSummary } from "../utils/helpers";

const AdminMapLayer = dynamic(() => import("./AdminMapLayer"), { ssr: false });
const DrainMapLayer = dynamic(() => import("./DrainMapLayer"), { ssr: false });

export default function GwaMapPanel() {
  const { mode, confirmedLocation, activeModule, wells, trend, recharge, demand, gsr, forecast } = useGwaStore();
  const summary = getConfirmedCountSummary(confirmedLocation);
  const moduleStats = [
    { label: "Wells", value: wells.data.length || 0, ready: wells.isSaved },
    { label: "Trend", value: trend.data?.villages?.length ?? 0, ready: !!trend.data },
    { label: "Recharge", value: recharge.data.length, ready: recharge.data.length > 0 },
    { label: "Demand", value: demand.combinedData.length, ready: demand.combinedData.length > 0 },
    { label: "GSR", value: gsr.data.length, ready: gsr.data.length > 0 },
    { label: "Forecast", value: (forecast.data?.results ?? forecast.data?.data ?? forecast.data?.forecast_results ?? []).length, ready: !!forecast.data },
  ];
  const activeModuleMeta = moduleStats.find((item) => item.label.toLowerCase() === activeModule) ?? null;

  return (
    <div className="relative isolate z-0 h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(135deg,_#eff6ff_0%,_#f8fafc_42%,_#e2e8f0_100%)]">
      <div className="absolute inset-0">
        {mode === "admin" ? <AdminMapLayer className="h-full w-full" /> : <DrainMapLayer className="h-full w-full" />}
      </div>
      <div className="pointer-events-none relative flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 shadow-sm backdrop-blur">
              Groundwater Area Map
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900 drop-shadow-sm">
              {mode === "admin" ? "Administrative selection" : "Drain selection"}
            </h3>
            <p className="mt-2 max-w-xl rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
              The map stays in sync with the active `GWA2` workflow. Confirm an area on the left, work through the
              modules on the right, and keep the current selection visible here throughout the run.
            </p>
          </div>
          <div className="rounded-full border border-blue-200 bg-white/80 p-3 text-blue-700 shadow-sm">
            <MapPin className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-500">Selection status</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {confirmedLocation ? "Confirmed" : "Waiting for confirmation"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {confirmedLocation ? confirmedLocation.label : "Choose area from the left panel."}
            </div>
          </div>

          {summary.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}

          <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="text-xs uppercase tracking-wide text-slate-500">Active module</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {activeModule.charAt(0).toUpperCase() + activeModule.slice(1)}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {activeModuleMeta?.ready ? `${activeModuleMeta.value} record(s) ready` : "Waiting for module output"}
            </div>
          </div>

          {!confirmedLocation && (
            <div className="rounded-xl border border-dashed border-blue-200 bg-white/85 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
              Module panels stay locked until the area is confirmed, matching the `basic` flow you asked for.
            </div>
          )}
        </div>

        {confirmedLocation && (
          <div className="grid gap-3 md:grid-cols-6">
            {moduleStats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{item.value}</div>
                <div className={`mt-1 text-xs font-medium ${item.ready ? "text-emerald-700" : "text-amber-700"}`}>
                  {item.ready ? "Ready" : "Pending"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
