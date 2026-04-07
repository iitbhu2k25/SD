'use client';

import { Lock, Sparkles } from "lucide-react";

import DemandModule from "./DemandModule";
import ForecastModule from "./ForecastModule";
import GsrModule from "./GsrModule";
import OverviewModule from "./OverviewModule";
import RechargeModule from "./RechargeModule";
import TrendModule from "./TrendModule";
import WellSelectionModule from "./WellSelectionModule";
import { useGwaStore } from "../store/gwa.store";
import { GWA_MODULES } from "../utils/constants";
import { getWorkflowCompletionPercent, getWorkflowModuleStatuses } from "../utils/helpers";

export default function GwaModulePanel() {
  const { confirmedLocation, activeModule, setActiveModule, wells, trend, recharge, demand, gsr, forecast } =
    useGwaStore();
  const currentModule = GWA_MODULES.find((item) => item.key === activeModule) ?? GWA_MODULES[0];
  const moduleStatuses = getWorkflowModuleStatuses({
    confirmedLocation,
    wells,
    trend,
    recharge,
    demand,
    gsr,
    forecast,
  });
  const currentStatus = moduleStatuses.find((item) => item.key === activeModule) ?? moduleStatuses[0];
  const completion = getWorkflowCompletionPercent({
    confirmedLocation,
    wells,
    trend,
    recharge,
    demand,
    gsr,
    forecast,
  });

  if (!confirmedLocation) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Confirm an area from the left panel to unlock the groundwater modules.
      </div>
    );
  }

  const content = (() => {
    switch (activeModule) {
      case "overview":
        return <OverviewModule />;
      case "wells":
        return <WellSelectionModule />;
      case "trend":
        return <TrendModule />;
      case "recharge":
        return <RechargeModule />;
      case "demand":
        return <DemandModule />;
      case "gsr":
        return <GsrModule />;
      case "forecast":
        return <ForecastModule />;
      default:
        return <OverviewModule />;
    }
  })();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Workflow Navigator</div>
            <div className="mt-1 text-sm text-slate-600">Progress follows your saved analysis outputs.</div>
          </div>
          <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {completion}% complete
          </div>
        </div>
        <div className="flex flex-wrap">
          {moduleStatuses.map((module) => {
            const active = module.key === activeModule;
            return (
              <button
                key={module.key}
                type="button"
                onClick={() => !module.disabled && setActiveModule(module.key)}
                disabled={module.disabled}
                className={`border-b-2 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide transition ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : module.disabled
                      ? "cursor-not-allowed border-transparent text-slate-300"
                      : "border-transparent text-slate-500 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  {module.disabled && <Lock className="h-3.5 w-3.5" />}
                  <span>{module.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Active Module</div>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{currentModule.label}</h3>
              <p className="mt-2 text-sm text-slate-600">{currentModule.description}</p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                currentStatus.status === "complete"
                  ? "bg-emerald-100 text-emerald-700"
                  : currentStatus.status === "ready"
                    ? "bg-blue-100 text-blue-700"
                    : currentStatus.status === "locked"
                      ? "bg-slate-200 text-slate-600"
                      : "bg-amber-100 text-amber-700"
              }`}
            >
              {currentStatus.status}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>{currentStatus.detail}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed Area</div>
            <div className="mt-2 text-sm font-medium text-slate-800">{confirmedLocation.label}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module Output</div>
            <div className="mt-2 text-sm font-medium text-slate-800">{currentStatus.count} record(s)</div>
          </div>
        </div>

        <div className="mt-4">{content}</div>
      </div>
    </div>
  );
}
