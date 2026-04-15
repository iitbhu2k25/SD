"use client";
import React from "react";
import { useYear } from "@/contexts/gwm/water_quality_assesment/admin/yearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MultiSelectButtonsProps {
  options: string[];
  label?: string;
  onChange?: (selectedParam: string[]) => void;
}

/* ── Parameter metadata: display symbol + group ── */
const PARAM_META: Record<string, { symbol: string; group: string }> = {
  "pH Level":                  { symbol: "pH",     group: "Physical" },
  "Electrical Conductivity":   { symbol: "EC",     group: "Physical" },
  "Hardness":                  { symbol: "TH",     group: "Physical" },
  "Calcium":                   { symbol: "Ca²⁺",   group: "Major Ions" },
  "Magnesium":                 { symbol: "Mg²⁺",   group: "Major Ions" },
  "Sodium":                    { symbol: "Na⁺",    group: "Major Ions" },
  "Potassium":                 { symbol: "K⁺",     group: "Major Ions" },
  "Bicarbonate":               { symbol: "HCO₃⁻",  group: "Major Ions" },
  "Carbonate":                 { symbol: "CO₃²⁻",  group: "Major Ions" },
  "Chloride":                  { symbol: "Cl⁻",    group: "Major Ions" },
  "Sulfate":                   { symbol: "SO₄²⁻",  group: "Major Ions" },
  "Nitrate":                   { symbol: "NO₃⁻",   group: "Major Ions" },
  "Arsenic":                   { symbol: "As",     group: "Trace" },
  "Fluoride":                  { symbol: "F⁻",     group: "Trace" },
  "Iron":                      { symbol: "Fe",     group: "Trace" },
  "Uranium":                   { symbol: "U",      group: "Trace" },
};

const GROUP_ORDER = ["Physical", "Major Ions", "Trace"];

const GROUP_COLORS: Record<string, { dot: string; label: string }> = {
  "Physical":   { dot: "bg-violet-500", label: "text-violet-600" },
  "Major Ions": { dot: "bg-blue-500",   label: "text-blue-600"   },
  "Trace":      { dot: "bg-amber-500",  label: "text-amber-600"  },
};

const fmt = (opt: string) => opt.trim().replace(/\s+/g, "_");

const MultiSelectButtons: React.FC<MultiSelectButtonsProps> = ({ options, onChange }) => {
  const { selectedParam, setSelectedParam } = useYear();

  const toggle = (option: string) => {
    const key = fmt(option);
    const next = selectedParam.includes(key)
      ? selectedParam.filter(x => x !== key)
      : [...selectedParam, key];
    setSelectedParam(next);
    onChange?.(next);
  };

  const selectAll = () => {
    const all = options.map(fmt);
    setSelectedParam(all);
    onChange?.(all);
  };

  const reset = () => {
    setSelectedParam([]);
    onChange?.([]);
  };

  /* group options that appear in props */
  const grouped = GROUP_ORDER.reduce<Record<string, string[]>>((acc, group) => {
    const members = options.filter(o => (PARAM_META[o]?.group ?? "Other") === group);
    if (members.length) acc[group] = members;
    return acc;
  }, {});

  /* options not in any known group */
  const others = options.filter(o => !PARAM_META[o]);
  if (others.length) grouped["Other"] = others;

  const count = selectedParam.length;
  const total = options.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {count > 0 ? (
            <Badge className="h-5 px-2 text-xs font-bold bg-blue-600 text-white border-0">
              {count}/{total}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">{total} parameters</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Select all
          </button>
          <span className="w-px h-3 bg-slate-200" />
          <button
            onClick={reset}
            disabled={count === 0}
            className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Groups */}
      {Object.entries(grouped).map(([group, members]) => {
        const colors = GROUP_COLORS[group] ?? { dot: "bg-slate-400", label: "text-slate-500" };
        const groupSelectedCount = members.filter(o => selectedParam.includes(fmt(o))).length;

        return (
          <div key={group}>
            {/* Group label */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
              <span className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", colors.label)}>
                {group}
              </span>
              {groupSelectedCount > 0 && (
                <span className="ml-auto text-[11px] font-semibold text-slate-400">
                  {groupSelectedCount}/{members.length}
                </span>
              )}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              {members.map(option => {
                const key = fmt(option);
                const active = selectedParam.includes(key);
                const meta = PARAM_META[option];
                const displayLabel = meta?.symbol ?? option;

                return (
                  <Button
                    key={option}
                    size="xs"
                    onClick={() => toggle(option)}
                    className={cn(
                      "h-7 px-3 text-sm font-semibold rounded-full border transition-all duration-150",
                      active
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                    )}
                    title={option}
                  >
                    {displayLabel}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}

    </div>
  );
};

export default MultiSelectButtons;
