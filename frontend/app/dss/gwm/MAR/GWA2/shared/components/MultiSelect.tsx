'use client';

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import type { SelectOption } from "../types/common.types";

interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  singleSelect?: boolean;
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  singleSelect = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (nextValue: string) => {
    if (singleSelect) {
      onChange([nextValue]);
      setOpen(false);
      setSearch("");
      return;
    }

    onChange(
      value.includes(nextValue)
        ? value.filter((item) => item !== nextValue)
        : [...value, nextValue],
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
          disabled || loading
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-300 bg-white text-slate-700 hover:border-blue-400"
        }`}
      >
        <span className="truncate">
          {loading ? "Loading..." : value.length === 0 ? placeholder : `${value.length} selected`}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          {options.length > 5 && (
            <div className="border-b border-slate-100 p-2">
              <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  placeholder="Search..."
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((option) => {
              const checked = value.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                    checked ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {!singleSelect && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-blue-600"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                    />
                  )}
                  {singleSelect && checked && <span className="text-blue-500">✓</span>}
                  <span onClick={() => singleSelect && toggle(option.value)}>{option.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No results</div>}
          </div>
        </div>
      )}
    </div>
  );
}
