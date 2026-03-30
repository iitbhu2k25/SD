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
}

export default function CategorySliderView({
  editable = false,
  model,
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

  const formatWeight = (id: number) => {
    const weight = getCategoryWeight(id);
    return Number.isFinite(weight) ? weight.toFixed(4) : "0.0000";
  };

  return (
    <div className="w-full p-4 bg-slate-950/70 border border-slate-700 rounded-xl shadow-inner">
      <div className="flex gap-3 mb-4 justify-end">
        <button
          onClick={selectAllCategories}
          disabled={allSelected}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
            allSelected
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Select All
        </button>
        <button
          onClick={clearAllCategories}
          disabled={selectedCount === 0}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
            selectedCount === 0
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-12 w-full mb-3 text-slate-200 text-sm font-semibold">
        <h2 className="col-span-6 text-left">Category</h2>
        <h2 className="col-span-3 text-center">Influence</h2>
        <h2 className="col-span-3 text-right">Weight</h2>
      </div>

      <div className="space-y-3">
        {categories.map((category) => {
          const selected = isSelected(category.id);
          const sliderEnabled = selected && editable;
          const influence = Math.max(1, Math.round(getCategoryInfluence(category.id)));

          return (
            <div
              key={category.id}
              className={`rounded-lg border p-3 transition ${
                selected
                  ? "bg-slate-900/80 border-blue-500/50"
                  : "bg-slate-900/40 border-slate-700/70"
              }`}
            >
              <div className="grid grid-cols-12 gap-2 items-center mb-2">
                <div className="col-span-6 flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCategory(category.id, category.file_name)}
                    className="h-4 w-4 text-blue-500 rounded flex-shrink-0"
                  />

                  <span
                    title={category.file_name}
                    className="font-medium text-slate-100 truncate"
                  >
                    {category.file_name}
                  </span>

                  <div className="relative group flex-shrink-0">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-300 text-[10px] font-bold text-slate-900 cursor-help">
                      i
                    </span>
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-max max-w-xs rounded-md bg-slate-800 text-slate-100 text-xs px-3 py-2 shadow-lg z-50 pointer-events-none border border-slate-600">
                      <div className="break-words">{category.details}</div>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800" />
                    </div>
                  </div>
                </div>

                <div className="col-span-3 text-center">
                  <span className="inline-flex min-w-[44px] justify-center text-xs font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-200 border border-blue-400/40">
                    {influence}
                  </span>
                </div>

                <div className="col-span-3 text-right">
                  <span className="inline-flex min-w-[72px] justify-center text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                    {formatWeight(category.id)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[11px] text-slate-300 w-24 text-left">
                  <span className="font-semibold">1</span> (Least)
                </div>

                <div className="relative flex-1">
                  <div
                    className={`absolute h-2 w-full rounded-lg ${
                      sliderEnabled
                        ? "bg-gradient-to-r from-sky-900 via-blue-600 to-indigo-500"
                        : "bg-slate-700"
                    }`}
                  />

                  <div className="absolute w-full flex justify-between px-1 -mt-1">
                    {[...Array(10)].map((_, index) => (
                      <div key={index} className="h-4 w-0.5 bg-slate-300/60" />
                    ))}
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
                    className={`relative w-full h-2 bg-transparent appearance-none z-10 accent-cyan-300 ${
                      sliderEnabled ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    style={{
                      WebkitAppearance: "none",
                      appearance: "none",
                    }}
                    aria-label={`Adjust importance of ${category.file_name}`}
                  />
                </div>

                <div className="text-[11px] text-slate-300 w-24 text-right">
                  <span className="font-semibold">10</span> (Most)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
