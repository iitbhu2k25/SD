'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  maxDisplay?: number;
  singleSelect?: boolean; // no checkbox, selecting one closes dropdown
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  label,
  maxDisplay = 2,
  singleSelect = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (val: string) => {
    if (singleSelect) {
      onChange([val]);
      setOpen(false);
      setSearch('');
    } else {
      onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
    }
  };

  const toggleAll = () => {
    if (value.length === filtered.length) {
      onChange([]);
    } else {
      onChange(filtered.map((o) => o.value));
    }
  };

  const displayLabel = () => {
    if (value.length === 0) return placeholder;
    if (value.length <= maxDisplay) {
      return options
        .filter((o) => value.includes(o.value))
        .map((o) => o.label)
        .join(', ');
    }
    return `${value.length} of ${options.length} selected`;
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => value.includes(o.value));

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          {label}
        </label>
      )}

      {/* ── Trigger — single <div> so no nested-button issue ── */}
      <div
        role="button"
        tabIndex={disabled || loading ? -1 : 0}
        onClick={() => !disabled && !loading && setOpen((p) => !p)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !loading) {
            e.preventDefault();
            setOpen((p) => !p);
          }
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`
          w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg border
          transition-all duration-150 select-none
          ${disabled || loading
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 cursor-pointer'
          }
          ${open ? 'border-blue-500 ring-2 ring-blue-100' : ''}
        `}
      >
        <span className="truncate">{loading ? 'Loading...' : displayLabel()}</span>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {/* Clear — <span> not <button> to avoid nesting */}
          {value.length > 0 && !disabled && !loading && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange([]); } }}
              className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-500 transition-colors text-[11px] font-bold leading-none"
            >
              ×
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">

          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-md">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Select-all row (only for multi) */}
          {!singleSelect && options.length > 1 && (
            <label className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-xs font-semibold text-slate-600">
                {allFilteredSelected ? 'Deselect all' : 'Select all'}
                {search && ' matching'}
              </span>
              {value.length > 0 && (
                <span className="ml-auto text-xs text-slate-400">{value.length} selected</span>
              )}
            </label>
          )}

          {/* Option list */}
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <li key={opt.value} role="option" aria-selected={checked}>
                    {singleSelect ? (
                      <div
                        onClick={() => toggle(opt.value)}
                        className={`
                          flex items-center px-3 py-2 text-sm cursor-pointer select-none
                          transition-colors duration-100
                          ${checked ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                        `}
                      >
                        {checked && <span className="mr-2 text-blue-500">✓</span>}
                        {opt.label}
                      </div>
                    ) : (
                      <label
                        className={`
                          flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer select-none
                          transition-colors duration-100
                          ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(opt.value)}
                          className="w-4 h-4 rounded accent-blue-600 shrink-0"
                        />
                        <span className={checked ? 'text-blue-700 font-medium' : 'text-slate-700'}>
                          {opt.label}
                        </span>
                      </label>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}