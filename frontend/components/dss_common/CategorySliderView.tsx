"use client";

import React from "react";
import { Category, SelectRasterLayer } from "@/interface/raster_context";

export interface CategorySliderModel {
  categories: Category[];
  selectedCategories: SelectRasterLayer[];
  isSelected: (id: number) => boolean;
  updateCategoryInfluence: (
    id: number,
    fileName: string,
    influence: number,
  ) => void;
  getCategoryInfluence: (id: number) => number;
  getCategoryWeight: (id: number) => number;
  toggleCategory: (id: number, fileName: string) => void;
  selectAllCategories: () => void;
  clearAllCategories: () => void;
}

interface CategorySliderViewProps {
  editable?: boolean;
  model: CategorySliderModel;
  onToggleEditable?: () => void;
  onReset?: () => void;
  isDark?: boolean;
  showInfluenceControls?: boolean;
}

export default function CategorySliderView({
  editable = false,
  model,
  onToggleEditable,
  onReset,
  isDark = false,
  showInfluenceControls = true,
}: CategorySliderViewProps) {
  const {
    categories,
    selectedCategories,
    isSelected,
    updateCategoryInfluence,
    getCategoryInfluence,
    getCategoryWeight,
    toggleCategory,
    selectAllCategories,
    clearAllCategories,
  } = model;

  const allSelected =
    categories.length === selectedCategories.length && categories.length > 0;
  const selectedCount = selectedCategories.length;
  const selectedSummary = `${selectedCount}/${categories.length}`;

  const formatWeight = (id: number) => {
    const weight = getCategoryWeight(id);
    return Number.isFinite(weight) ? weight.toFixed(4) : "0.0000";
  };

  const handleReset = onReset ?? (() => {});

  if (!showInfluenceControls) {
    return (
      <div className={`w-full rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(148,163,184,0.08)] sm:p-4 ${
        isDark
          ? "border-slate-700 bg-slate-800/60"
          : "border-stone-200 bg-[linear-gradient(180deg,#fbfaf7_0%,#f7f4f7_100%)]"
      }`}>
        <div className={`mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between ${
          isDark ? "border-slate-700" : "border-stone-200"
        }`}>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}>
              Selected Constraints
            </p>
            <p className={`mt-1 text-sm ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}>
              {selectedCount} of {categories.length} active in the analysis
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllCategories}
              disabled={allSelected}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                allSelected
                  ? "cursor-not-allowed bg-stone-100 text-slate-400"
                  : "cursor-pointer bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAllCategories}
              disabled={selectedCount === 0}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectedCount === 0
                  ? "cursor-not-allowed bg-stone-100 text-slate-400"
                  : "cursor-pointer bg-rose-500 text-white hover:bg-rose-400"
              }`}
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((category) => {
            const selected = isSelected(category.id);

            return (
              <div
                key={category.id}
                className={`rounded-xl border p-3 transition-all duration-200 hover:-translate-y-[1px] sm:p-3.5 ${
                  selected
                    ? "border-rose-200 border-l-[3px] border-l-rose-400 bg-[linear-gradient(180deg,#fff8f8_0%,#fbf1f4_100%)] shadow-[0_0_0_1px_rgba(254,205,211,0.7),0_10px_22px_rgba(148,163,184,0.14)] hover:border-rose-300 hover:border-l-rose-500 hover:shadow-[0_0_0_1px_rgba(253,164,175,0.7),0_14px_28px_rgba(148,163,184,0.18)]"
                    : "border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-white/86 hover:shadow-[0_8px_18px_rgba(148,163,184,0.14)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCategory(category.id, category.file_name)}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-rose-600"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          title={category.file_name}
                          className={`truncate text-base font-semibold ${
                            isDark ? "text-slate-100" : "text-slate-800"
                          }`}
                        >
                          {category.file_name}
                        </span>

                        <div className="group relative mt-[2px] flex-shrink-0">
                          <button
                            type="button"
                            className={`inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold ${
                              isDark ? "bg-cyan-900 text-cyan-300" : "bg-amber-200 text-amber-900"
                            }`}
                            aria-label={`Show details for ${category.file_name}`}
                          >
                            i
                          </button>
                          <div className={`pointer-events-none absolute left-0 top-full z-50 mt-2 max-w-[16rem] rounded-md border px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2 ${
                            isDark ? "border-cyan-900 bg-[#0a1628] text-cyan-200" : "border-slate-200 bg-white text-slate-700"
                          }`}>
                            <div className="break-words">{category.details}</div>
                            <div className={`absolute left-3 top-0 -translate-y-full border-8 border-transparent ${
                              isDark ? "border-b-[#0a1628]" : "border-b-white"
                            } sm:left-auto sm:right-full sm:top-1/2 sm:-translate-y-1/2 sm:border-b-transparent ${
                              isDark ? "sm:border-r-[#0a1628]" : "sm:border-r-white"
                            }`} />
                          </div>
                        </div>
                      </div>
                      <p className={`mt-1 text-xs ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}>
                        {selected ? "Excluding unsuitable areas" : "Not currently excluding areas"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                    Constraint
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-2xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(148,163,184,0.08)] sm:p-3 ${
      isDark
        ? "border-slate-700 bg-slate-800/60"
        : "border-stone-200 bg-[linear-gradient(180deg,#fcfbf8_0%,#f5f8f6_100%)]"
    }`}>
      <div className={`mb-3 border-b pb-2.5 ${
        isDark ? "border-slate-700" : "border-stone-200"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className={`truncate text-xs font-semibold ${
              isDark ? "text-cyan-200" : "text-slate-600"
            }`}>
              Selected Categories
            </p>
            <p className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              isDark
                ? "border-cyan-900 bg-[#0c2e63] text-cyan-300"
                : "border-stone-200 bg-white/85 text-slate-700"
            }`}>
              {selectedSummary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onToggleEditable && showInfluenceControls && (
              <button
                onClick={onToggleEditable}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                  editable
                    ? isDark
                      ? "border-emerald-800 bg-emerald-950/40 text-emerald-400"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : isDark
                      ? "border-cyan-800 bg-cyan-950/40 text-cyan-400"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {editable ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 11V7a4 4 0 118 0v4m-9 0h10a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 0h12a2 2 0 002-2v-5a2 2 0 00-2-2H6a2 2 0 00-2 2v5a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v3"
                    />
                  )}
                </svg>
                {editable ? "Unlocked" : "Locked"}
              </button>
            )}

            <button
              onClick={selectAllCategories}
              disabled={allSelected}
              className={`h-8 rounded-full px-2.5 text-[11px] font-semibold transition ${
                allSelected
                  ? isDark
                    ? "cursor-not-allowed bg-[#0c2e63] text-cyan-800"
                    : "cursor-not-allowed bg-stone-100 text-slate-400"
                  : isDark
                    ? "bg-cyan-900 text-cyan-100 hover:bg-cyan-800"
                    : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              Select All
            </button>

            <button
              onClick={clearAllCategories}
              disabled={selectedCount === 0}
              className={`h-8 rounded-full px-2.5 text-[11px] font-semibold transition ${
                selectedCount === 0
                  ? isDark
                    ? "cursor-not-allowed bg-[#0c2e63] text-cyan-800"
                    : "cursor-not-allowed bg-stone-100 text-slate-400"
                  : isDark
                    ? "bg-rose-950 text-rose-300 hover:bg-rose-900"
                    : "bg-rose-500 text-white hover:bg-rose-400"
              }`}
            >
              Clear
            </button>

            <button
              onClick={handleReset}
              className={`h-8 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                isDark
                  ? "border-cyan-900 bg-[#0a1628] text-cyan-400 hover:border-cyan-800 hover:bg-cyan-950"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              title="Reset category weights"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((category) => {
          const selected = isSelected(category.id);
          const sliderEnabled = selected && editable;
          const sliderRatio = Math.max(
            0,
            Math.min(1, (getCategoryInfluence(category.id) - 1) / 9),
          );

          return (
            <div
              key={category.id}
              className={`rounded-xl border p-2 transition-all duration-200 ${
                selected
                  ? isDark
                    ? "border-cyan-800/80 bg-[#0c2e63]/20 shadow-[inset_0_0_15px_rgba(8,145,178,0.05)]"
                    : "border-blue-200 border-l-[3px] border-l-emerald-400 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f7f5_100%)] shadow-[0_0_0_1px_rgba(191,219,254,0.45),0_3px_10px_rgba(148,163,184,0.08)] hover:border-blue-300"
                  : isDark
                    ? "border-[#1e3a5f]/50 bg-[#06101e] opacity-60"
                    : "border-stone-200 bg-stone-50/65 hover:border-stone-300 hover:bg-white/90"
              }`}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCategory(category.id, category.file_name)}
                      className={`mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300 ${
                        isDark ? "bg-[#0a1628] text-cyan-500 focus:ring-cyan-500/40" : "text-blue-600"
                      }`}
                    />

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <span title={category.file_name} className={`truncate text-sm font-semibold leading-5 ${
                          isDark ? "text-cyan-100" : "text-slate-800"
                        }`}>
                          {category.file_name}
                        </span>

                        <div className="group relative mt-[2px] flex-shrink-0">
                          <button
                            type="button"
                            className={`inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold ${
                              isDark ? "bg-cyan-900 text-cyan-300" : "bg-amber-200 text-amber-900"
                            }`}
                            aria-label={`Show details for ${category.file_name}`}
                          >
                            i
                          </button>
                          <div className={`pointer-events-none absolute left-0 top-full z-50 mt-2 max-w-[16rem] rounded-md border px-3 py-2 text-xs shadow-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2 ${
                            isDark ? "border-cyan-900 bg-[#0a1628] text-cyan-200" : "border-slate-200 bg-white text-slate-700"
                          }`}>
                            <div className="break-words">{category.details}</div>
                            <div className={`absolute left-3 top-0 -translate-y-full border-8 border-transparent ${
                              isDark ? "border-b-[#0a1628]" : "border-b-white"
                            } sm:left-auto sm:right-full sm:top-1/2 sm:-translate-y-1/2 sm:border-b-transparent ${
                              isDark ? "sm:border-r-[#0a1628]" : "sm:border-r-white"
                            }`} />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                    {showInfluenceControls ? (
                      <span className={`inline-flex min-w-[96px] items-center justify-between rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        isDark
                          ? "border-cyan-900 bg-[#0c2e63]/40 text-cyan-300"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}>
                        <span className={isDark ? "text-cyan-500" : "text-emerald-600"}>Weight</span>
                        <span className="font-mono">{formatWeight(category.id)}</span>
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        isDark
                          ? "border-rose-900 bg-rose-950/40 text-rose-300"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}>
                        Constraint
                      </span>
                    )}
                  </div>
                </div>

                {showInfluenceControls && (
                  <div className={`rounded-lg border px-2 pb-1 pt-1 ${
                    isDark
                      ? "border-[#1e3a5f] bg-[#0a1628]/40"
                      : "border-slate-200/80 bg-white/65"
                  }`}>
                    <div className="relative flex items-center" style={{ height: "20px" }}>
                      <div
                        className={`absolute top-1/2 h-[5px] w-full -translate-y-1/2 rounded-full ${
                          sliderEnabled
                            ? isDark ? "bg-cyan-950" : "bg-slate-200"
                            : "bg-slate-100"
                        }`}
                      />

                      <div
                        className={`absolute top-1/2 h-[5px] w-full -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 ${
                          sliderEnabled ? "opacity-25" : "opacity-15"
                        }`}
                      />

                      <div
                        className={`absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-all duration-150 ${
                          sliderEnabled
                            ? "opacity-95 shadow-[0_0_6px_rgba(16,185,129,0.25)]"
                            : "opacity-45"
                        }`}
                        style={{ width: `${sliderRatio * 100}%` }}
                      />

                      <div className="absolute top-1/2 flex w-full -translate-y-1/2 justify-between px-0.5">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className={`h-2 w-px ${
                            isDark ? "bg-cyan-900" : "bg-slate-300/80"
                          }`} />
                        ))}
                      </div>

                      <div
                        className={`pointer-events-none absolute top-1/2 z-10 flex h-[20px] w-[20px] -translate-y-1/2 items-center justify-center rounded-full border text-[9px] font-semibold leading-none transition-all duration-150 ${
                          sliderEnabled
                            ? isDark ? "border-cyan-700 bg-cyan-900 text-cyan-100" : "border-white bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.22)]"
                            : "border-slate-300 bg-slate-300 text-slate-600"
                        }`}
                        style={{
                          left: `${sliderRatio * 100}%`,
                          transform: "translateX(-50%) translateY(-50%)",
                        }}
                      >
                        {getCategoryInfluence(category.id)}
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={getCategoryInfluence(category.id)}
                        onChange={(event) =>
                          sliderEnabled &&
                          updateCategoryInfluence(
                            category.id,
                            category.file_name,
                            parseFloat(event.target.value),
                          )
                        }
                        disabled={!sliderEnabled}
                        className={`relative z-20 h-[5px] w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:opacity-0 ${
                          sliderEnabled ? "cursor-pointer" : "cursor-not-allowed"
                        }`}
                        style={{ WebkitAppearance: "none", appearance: "none" }}
                        aria-label={`Adjust importance of ${category.file_name}`}
                      />
                    </div>

                    <div className="mt-0.5 flex items-center justify-between">
                      <span className={`text-[10px] leading-none ${
                        isDark ? "text-cyan-700" : "text-slate-500"
                      }`}>
                        <span className={`font-semibold ${
                          isDark ? "text-cyan-500" : "text-slate-600"
                        }`}>1</span> Least
                      </span>
                      <span className={`text-[10px] leading-none ${
                        isDark ? "text-cyan-700" : "text-slate-500"
                      }`}>
                        <span className={`font-semibold ${
                          isDark ? "text-cyan-500" : "text-slate-600"
                        }`}>10</span> Most
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
