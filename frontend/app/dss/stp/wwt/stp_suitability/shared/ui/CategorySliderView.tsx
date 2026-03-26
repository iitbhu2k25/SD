"use client";

import type {
  Category,
  SelectRasterLayer,
} from "../../services/stpSuitabilityTypes";

interface CategorySliderViewProps {
  activeTab: "condition" | "constraint";
  conditionCategories: Category[];
  constraintCategories: Category[];
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  editable: boolean;
  onToggleConditionCategory: (id: number, fileName: string) => void;
  onToggleConstraintCategory: (id: number, fileName: string) => void;
  onUpdateConditionInfluence: (id: number, fileName: string, influence: number) => void;
  onSelectAllCondition: () => void;
  onClearAllCondition: () => void;
  onSelectAllConstraint: () => void;
  onClearAllConstraint: () => void;
}

function formatWeight(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(numeric) ? numeric.toFixed(4) : "0.0000";
}

function getSelection(
  selected: SelectRasterLayer[],
  categoryId: number,
): SelectRasterLayer | undefined {
  return selected.find((item) => item.id === categoryId);
}

function CategoryInfo({ details }: { details: string }) {
  if (!details) {
    return null;
  }

  return (
    <div className="relative group flex-shrink-0">
      <button
        type="button"
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900"
        aria-label="Show category details"
      >
        i
      </button>
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 max-w-[16rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:left-full sm:top-1/2 sm:ml-2 sm:mt-0 sm:-translate-y-1/2">
        <div className="break-words">{details}</div>
        <div className="absolute left-3 top-0 -translate-y-full border-8 border-transparent border-b-white sm:left-auto sm:right-full sm:top-1/2 sm:-translate-y-1/2 sm:border-b-transparent sm:border-r-white" />
      </div>
    </div>
  );
}

export default function CategorySliderView({
  activeTab,
  conditionCategories,
  constraintCategories,
  selectedCondition,
  selectedConstraint,
  editable,
  onToggleConditionCategory,
  onToggleConstraintCategory,
  onUpdateConditionInfluence,
  onSelectAllCondition,
  onClearAllCondition,
  onSelectAllConstraint,
  onClearAllConstraint,
}: CategorySliderViewProps) {
  if (activeTab === "condition") {
    const allSelected =
      conditionCategories.length > 0 &&
      conditionCategories.length === selectedCondition.length;
    const selectedCount = selectedCondition.length;

    return (
      <div className="w-full rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,#fbfaf7_0%,#f3f7f5_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_rgba(148,163,184,0.10)] sm:p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Selected Categories
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {selectedCount} of {conditionCategories.length} active in the analysis
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAllCondition}
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
              onClick={onClearAllCondition}
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

        <div className="space-y-4">
          {conditionCategories.map((category) => {
            const selected = getSelection(selectedCondition, category.id);
            const influence = Number.parseFloat(selected?.Influence ?? `${category.weight ?? 1}`);
            const sliderEnabled = Boolean(selected) && editable;

            return (
              <div
                key={category.id}
                className={`rounded-xl border p-3 transition-all duration-200 hover:-translate-y-[1px] sm:p-3.5 ${
                  selected
                    ? "border-blue-200 border-l-[3px] border-l-emerald-400 bg-[linear-gradient(180deg,#f6fbff_0%,#edf5f3_100%)] shadow-[0_0_0_1px_rgba(191,219,254,0.6),0_10px_22px_rgba(148,163,184,0.14)] hover:border-blue-300 hover:border-l-emerald-500 hover:shadow-[0_0_0_1px_rgba(147,197,253,0.7),0_14px_28px_rgba(148,163,184,0.18)]"
                    : "border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-white/86 hover:shadow-[0_8px_18px_rgba(148,163,184,0.14)]"
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() =>
                          onToggleConditionCategory(category.id, category.file_name)
                        }
                        className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 text-blue-600"
                      />

                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            title={category.file_name}
                            className="truncate text-base font-semibold text-slate-800"
                          >
                            {category.file_name}
                          </span>
                          <CategoryInfo details={category.details} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {selected
                            ? editable
                              ? "Included and editable"
                              : "Included but locked"
                            : "Not included in scoring"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="inline-flex min-w-[98px] items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                        <span className="text-blue-500">Influence</span>
                        <span className="font-bold">{Math.max(1, Math.round(influence))}</span>
                      </span>
                      <span className="inline-flex min-w-[116px] items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                        <span className="text-emerald-500">Weight</span>
                        <span className="font-mono">
                          {formatWeight(selected?.weight ?? category.weight)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-white/65 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        <span className="font-semibold">1</span> Least
                      </span>
                      <span>
                        <span className="font-semibold">10</span> Most
                      </span>
                    </div>

                    <div className="relative">
                      <div
                        className={`absolute h-2 w-full rounded-lg ${
                          sliderEnabled
                            ? "bg-gradient-to-r from-sky-200 via-blue-400 to-emerald-400"
                            : "bg-slate-200"
                        }`}
                      />

                      <div className="absolute -mt-1 flex w-full justify-between px-1">
                        {[...Array(10)].map((_, index) => (
                          <div key={index} className="h-4 w-0.5 bg-slate-300" />
                        ))}
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.1"
                        value={Number.isFinite(influence) ? influence : 1}
                        onChange={(event) =>
                          sliderEnabled &&
                          onUpdateConditionInfluence(
                            category.id,
                            category.file_name,
                            Number.parseFloat(event.target.value),
                          )
                        }
                        disabled={!sliderEnabled}
                        className={`relative h-2 w-full appearance-none bg-transparent accent-emerald-500 ${
                          sliderEnabled ? "cursor-pointer" : "cursor-not-allowed"
                        }`}
                        style={{
                          WebkitAppearance: "none",
                          appearance: "none",
                        }}
                        aria-label={`Adjust importance of ${category.file_name}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const allSelected =
    constraintCategories.length > 0 &&
    constraintCategories.length === selectedConstraint.length;
  const selectedCount = selectedConstraint.length;

  return (
    <div className="w-full rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,#fbfaf7_0%,#f7f4f7_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_rgba(148,163,184,0.10)] sm:p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Selected Constraints
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {selectedCount} of {constraintCategories.length} active in the analysis
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAllConstraint}
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
            onClick={onClearAllConstraint}
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
        {constraintCategories.map((category) => {
          const selected = getSelection(selectedConstraint, category.id);

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
                    checked={Boolean(selected)}
                    onChange={() =>
                      onToggleConstraintCategory(category.id, category.file_name)
                    }
                    className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-rose-600"
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        title={category.file_name}
                        className="truncate text-base font-semibold text-slate-800"
                      >
                        {category.file_name}
                      </span>
                      <CategoryInfo details={category.details} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
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
