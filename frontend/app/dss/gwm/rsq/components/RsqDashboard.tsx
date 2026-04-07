"use client";

import { useState } from "react";
import AdminSelectionPanel from "./AdminSelectionPanel";
import DrainSelectionPanel from "./DrainSelectionPanel";
import RsqAnalysisTable from "./RsqAnalysisTable";
import RsqMap from "./RsqMap";
import { RsqStateProvider, useRsqAdmin, useRsqAnalysis, useRsqDrain, useRsqView } from "./RsqState";

const YEAR_OPTIONS = ["2016 - 17", "2019 - 20", "2021 - 22", "2022 - 23", "2023 - 24"];

function RsqDashboardInner() {
  const { activeView, setActiveView } = useRsqView();
  const admin = useRsqAdmin();
  const drain = useRsqDrain();
  const analysis = useRsqAnalysis(activeView);
  const [panelOpen, setPanelOpen] = useState(true);
  const [confirmed, setConfirmed] = useState({ admin: false, drain: false });
  const [tableOpen, setTableOpen] = useState(false);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const isConfirmed = confirmed[activeView];

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="relative isolate z-0 h-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <RsqMap comparisonEnabled={comparisonEnabled} />
        </div>

        <div
          className={`absolute left-0 top-0 z-20 h-full w-[335px] transform border-r border-slate-200 bg-white/96 shadow-2xl backdrop-blur transition ${
            panelOpen ? "translate-x-0" : "-translate-x-[335px]"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-100 px-5 py-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="max-w-[220px] text-sm font-bold uppercase tracking-[0.12em] text-blue-700">Regional Scale Quantification</h2>
                <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-400">
                  i
                </button>
              </div>
              <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveView("admin")}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    activeView === "admin" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("drain")}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                    activeView === "drain" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Drain
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                <span>Select Location</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-700">{activeView === "admin" ? "Admin" : "Drain"}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!isConfirmed ? (
                activeView === "admin" ? (
                  <AdminSelectionPanel
                    locked={false}
                    onConfirm={() => {
                      setConfirmed((current) => ({ ...current, admin: true }));
                    }}
                  />
                ) : (
                  <DrainSelectionPanel
                    locked={false}
                    onConfirm={() => {
                      setConfirmed((current) => ({ ...current, drain: true }));
                    }}
                  />
                )
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {activeView === "admin" ? `${admin.selectedVillages.length} villages selected` : `${drain.selectedVillages.length} villages selected`}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Assessment Years</h3>
                      <p className="mt-1 text-xs text-slate-500">Choose primary and comparison year before opening the CSV table.</p>
                    </div>

                    <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Comparison</p>
                        <p className="mt-1 text-xs text-slate-500">Turn on to open left and right comparison maps.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !comparisonEnabled;
                          setComparisonEnabled(next);
                          if (!next) {
                            analysis.setComparisonYear("");
                          }
                        }}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                          comparisonEnabled ? "bg-blue-600" : "bg-slate-300"
                        }`}
                        aria-pressed={comparisonEnabled}
                        aria-label="Toggle comparison mode"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            comparisonEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {comparisonEnabled ? "Left Year" : "Year"}
                        </label>
                        <select
                          value={analysis.selectedYear}
                          onChange={(event) => {
                            setTableOpen(false);
                            analysis.setSelectedYear(event.target.value);
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Year</option>
                          {YEAR_OPTIONS.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>

                      {comparisonEnabled && (
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Right Year</label>
                          <select
                            value={analysis.comparisonYear}
                            onChange={(event) => analysis.setComparisonYear(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Comparison Year</option>
                            {YEAR_OPTIONS.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmed((current) => ({ ...current, [activeView]: false }));
                      setTableOpen(false);
                      setComparisonEnabled(false);
                      analysis.setComparisonYear("");
                      if (activeView === "admin") {
                        admin.reset();
                      } else {
                        drain.reset();
                      }
                    }}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    Change Location
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableOpen(true)}
                    disabled={!analysis.selectedYear}
                    className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Open CSV Table
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen((current) => !current)}
          className={`absolute top-1/2 z-30 h-11 w-6 -translate-y-1/2 rounded-r-xl bg-blue-600 text-white shadow-lg transition ${
            panelOpen ? "left-[335px]" : "left-0"
          }`}
        >
          {panelOpen ? "<" : ">"}
        </button>

        {tableOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm">
            <div className="flex h-[85vh] w-[min(1120px,100%)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">CSV Table Window</h3>
                  <p className="text-sm text-slate-500">Filter, review, and export RSQ records here.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTableOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <RsqAnalysisTable
                  view={activeView}
                  isReady={activeView === "admin" ? admin.selectedVillages.length > 0 : drain.areaConfirmed}
                  readyTitle={activeView === "admin" ? "No Villages Selected" : "No Area Confirmed"}
                  readyDescription={
                    activeView === "admin"
                      ? "Please select villages to view RSQ analysis."
                      : "Please confirm area selection to view RSQ analysis."
                  }
                  showYearSelector={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RsqDashboard() {
  return (
    <RsqStateProvider>
      <RsqDashboardInner />
    </RsqStateProvider>
  );
}
