'use client';

import { GitBranch, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AdminAreaSelector from "../shared/components/AdminAreaSelector";
import DrainAreaSelector from "../shared/components/DrainAreaSelector";
import GwaMapPanel from "../shared/components/GwaMapPanel";
import GwaModulePanel from "../shared/components/GwaModulePanel";
import { useGwaStore } from "../shared/store/gwa.store";
import { getWorkflowCompletionPercent, getWorkflowModuleStatuses } from "../shared/utils/helpers";

const LEFT_PANEL_WIDTH = 320;
const RIGHT_PANEL_WIDTH = 500;

export default function GWA2Dashboard() {
  const { mode, setMode, confirmedLocation, clearConfirmedLocation, wells, trend, recharge, demand, gsr, forecast } =
    useGwaStore();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpenMobile, setRightOpenMobile] = useState(false);

  useEffect(() => {
    if (confirmedLocation) {
      setLeftOpen(false);
      setRightOpenMobile(true);
    }
  }, [confirmedLocation]);

  const modeMeta = useMemo(
    () => [
      { key: "admin" as const, label: "Admin", icon: <Layers className="h-4 w-4" /> },
      { key: "drain" as const, label: "Drain", icon: <GitBranch className="h-4 w-4" /> },
    ],
    [],
  );
  const workflowStatuses = getWorkflowModuleStatuses({
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
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">GWA2</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Ground Water Assessment</h1>
            <div className="mt-2 text-sm text-slate-500">
              Confirm the area, prepare wells, then move through trend, recharge, demand, GSR, and forecast.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow Completion</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="text-2xl font-semibold text-slate-900">{completion}%</div>
                <div className="h-2 w-32 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              {modeMeta.map((item) => {
                const active = mode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMode(item.key)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div className="flex gap-3 overflow-x-auto">
          {workflowStatuses.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => item.disabled || !confirmedLocation ? setLeftOpen(true) : setRightOpenMobile(true)}
              className={`min-w-44 rounded-2xl border px-3 py-2 text-left transition ${
                item.status === "complete"
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : item.status === "locked"
                    ? "border-white/10 bg-white/5 opacity-70"
                    : item.status === "ready"
                      ? "border-cyan-400/40 bg-cyan-500/10"
                      : "border-amber-400/40 bg-amber-500/10"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Step {index + 1}
              </div>
              <div className="mt-1 text-sm font-semibold">{item.label}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-300">{item.detail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 shrink-0 border-r border-slate-200 bg-slate-900/95 px-2 py-4">
          <div className="flex h-full flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setLeftOpen((current) => !current)}
              className="rounded-lg bg-blue-600 p-2 text-white shadow-sm transition hover:bg-blue-700"
              title={leftOpen ? "Hide area panel" : "Show area panel"}
            >
              {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            {confirmedLocation && (
              <button
                type="button"
                onClick={clearConfirmedLocation}
                className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
                title="Change confirmed location"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {confirmedLocation && (
              <button
                type="button"
                onClick={() => setRightOpenMobile((current) => !current)}
                className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20 lg:hidden"
                title={rightOpenMobile ? "Hide workflow panel" : "Show workflow panel"}
              >
                {rightOpenMobile ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
            )}

            <div className="mt-auto text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 [writing-mode:vertical-lr]">
              DSS
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 overflow-hidden">
          <div className={`relative z-0 flex-1 overflow-hidden p-4 ${rightOpenMobile ? "hidden lg:block" : "block"}`}>
            <div
              className="absolute left-4 top-4 bottom-4 z-[1200] transition-transform duration-300"
              style={{
                width: LEFT_PANEL_WIDTH,
                transform: leftOpen ? "translateX(0)" : "translateX(calc(-100% - 16px))",
              }}
            >
              <div className="relative z-[1201] flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                    Area Selection
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {mode === "admin"
                      ? "Choose administrative boundaries"
                      : "Choose river, stretch, drains, and villages"}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {mode === "admin" ? <AdminAreaSelector /> : <DrainAreaSelector />}
                </div>
              </div>
            </div>

            <div className="h-full rounded-2xl">
              <GwaMapPanel />
            </div>
          </div>

          {confirmedLocation && (
            <div
              className={`shrink-0 border-l border-slate-200 bg-white p-4 ${rightOpenMobile ? "block w-full lg:w-auto" : "hidden lg:block"}`}
              style={{ width: rightOpenMobile ? undefined : RIGHT_PANEL_WIDTH }}
            >
              <GwaModulePanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
