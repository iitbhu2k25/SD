"use client";

import type { PumpingRiskCounts } from "../utils/riskFactorSummary";

interface PumpingRiskSummaryProps {
  counts: PumpingRiskCounts;
  isDark?: boolean;
}

export default function PumpingRiskSummary({
  counts,
  isDark = false,
}: PumpingRiskSummaryProps) {
  if (!counts || counts.total <= 0) {
    return null;
  }

  const known = counts.lowRisk + counts.mediumRisk + counts.highRisk;
  const unknownPercent = counts.total > 0 ? (counts.unknown / counts.total) * 100 : 0;

  return (
    <section
      className={`mt-3 rounded-2xl border p-3 shadow-sm sm:mt-4 sm:p-4 ${
        isDark ? "border-[#1e3a5f]/50 bg-[#0d1629]/80" : "border-stone-200 bg-white/72"
      }`}
    >
      <h3
        className={`border-l-2 border-l-cyan-400 pl-2 text-xs font-semibold sm:text-sm ${
          isDark ? "text-slate-100" : "text-slate-900"
        }`}
      >
        Pumping Risk Summary
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-700">
          <div className="font-semibold">Low</div>
          <div>{counts.lowRisk}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-700">
          <div className="font-semibold">Medium</div>
          <div>{counts.mediumRisk}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-rose-700">
          <div className="font-semibold">High</div>
          <div>{counts.highRisk}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
          <div className="font-semibold">Unknown</div>
          <div>{counts.unknown}</div>
        </div>
      </div>
      <p className={`mt-3 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Known risk classification: {known}/{counts.total}. Unknown:{" "}
        {unknownPercent.toFixed(1)}%.
      </p>
    </section>
  );
}

