"use client";

// Shared water budget summary card.
// Ported from water/admin/components/waterbudget.tsx and water/users/components/waterbudget.tsx.
// Props only — no store imports.
import React from "react";

export interface WaterBudgetCardProps {
  totalWaterBudget: number | null;
  productType?: string;
  year?: number | string;
  season?: string;
  timeScale?: string;
  aggregationMethod?: string;
  layersProcessed?: number;
  areaCount?: number;
  availableYears?: number[];
  activeYear?: number | null;
  onYearChange?: (year: number) => void;
}

function getProductIcon(type: string): string {
  switch (type?.toLowerCase()) {
    case "water budget": return "💧";
    case "surplus": return "📈";
    case "deficit": return "📉";
    case "index": return "📊";
    default: return "💧";
  }
}

function formatMLD(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WaterBudgetCard({
  totalWaterBudget,
  productType = "Water Budget",
  year = 0,
  season = "N/A",
  timeScale = "yearly",
  aggregationMethod = "SUM",
  layersProcessed,
  areaCount,
  availableYears = [],
  activeYear,
  onYearChange,
}: WaterBudgetCardProps) {
  if (totalWaterBudget === null || totalWaterBudget === undefined) return null;

  const displayYear = activeYear ? String(activeYear) : String(year);
  const displaySeason = timeScale === "yearly" ? "Annual" : season ?? "N/A";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-4 shadow-sm">
      <div>
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
          <span>{getProductIcon(productType)}</span>
          <span>Total {productType}</span>
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {displayYear} · {displaySeason}
        </p>
      </div>

      <p className="text-2xl font-bold leading-none tracking-tight text-sky-800">
        {formatMLD(totalWaterBudget)} MLD
      </p>

      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        {aggregationMethod && (
          <span>Method: <strong className="text-slate-700">{aggregationMethod}</strong></span>
        )}
        {layersProcessed !== undefined && (
          <span>Layers: <strong className="text-slate-700">{layersProcessed}</strong></span>
        )}
        {areaCount !== undefined && (
          <span>Areas: <strong className="text-slate-700">{areaCount}</strong></span>
        )}
      </div>

      {availableYears.length > 1 && onYearChange && (
        <div className="border-t border-sky-100 pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Select Year
          </p>
          <div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
            {availableYears.map((y) => {
              const isActive = activeYear === y;
              return (
                <label key={y} className="flex cursor-pointer items-center gap-1 group">
                  <input
                    type="radio"
                    name="water-budget-year"
                    value={y}
                    checked={isActive}
                    onChange={() => onYearChange(y)}
                    className="sr-only"
                  />
                  <span
                    className={`w-full rounded-md border py-0.5 text-center text-[11px] font-semibold transition ${
                      isActive
                        ? "border-sky-700 bg-sky-700 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 group-hover:border-sky-300 group-hover:text-sky-700"
                    }`}
                  >
                    {y}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
