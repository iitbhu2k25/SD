'use client'
import React, { useState, useRef, useEffect } from 'react';
import { District, SubDistrict } from '@/interface/raster_context';

interface MultiSelectProps<T> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
}

export const MultiSelect = <T extends District | SubDistrict = District | SubDistrict>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => item.name,
}: MultiSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropUp, setDropUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allIds = items.map(i => Number(i.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const someSelected = selectedItems.length > 0 && !allSelected;

  const filtered = items.filter(item =>
    displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* reset search on close */
  useEffect(() => { if (!isOpen) setSearchQuery(''); }, [isOpen]);

  const open = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 280);
    }
    setIsOpen(true);
  };

  const toggle = () => (isOpen ? setIsOpen(false) : open());

  const toggleAll = () => onSelectionChange(allSelected ? [] : [...allIds]);
  const toggleItem = (id: number) =>
    onSelectionChange(selectedItems.includes(id) ? selectedItems.filter(x => x !== id) : [...selectedItems, id]);

  /* display text */
  const displayText = () => {
    if (selectedItems.length === 0) return null;
    if (allSelected) return `All ${label}s`;
    if (selectedItems.length === 1) {
      const found = items.find(i => Number(i.id) === selectedItems[0]);
      return found ? displayPattern(found) : null;
    }
    return `${selectedItems.length} selected`;
  };

  const text = displayText();

  /* Custom checkbox */
  const Checkbox: React.FC<{ checked: boolean; indeterminate?: boolean }> = ({ checked, indeterminate }) => (
    <div className={`
      w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
      ${checked || indeterminate ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}
    `}>
      {checked && !indeterminate && (
        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {indeterminate && <div className="w-2 h-0.5 bg-white rounded-full" />}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between pl-3 pr-2.5 py-2 rounded-lg border text-sm
          transition-all duration-150 text-left
          ${disabled
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
              ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-700'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 cursor-pointer'
          }
        `}
      >
        <span className={text ? 'font-medium text-slate-800' : 'text-slate-400'}>
          {text ?? placeholder}
        </span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {selectedItems.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold">
              {selectedItems.length}
            </span>
          )}
          <svg
            className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className={`
          absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl
          overflow-hidden
          ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
        `}>
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full pl-7 pr-7 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={e => { e.stopPropagation(); setSearchQuery(''); }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All */}
          {items.length > 1 && (
            <div
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${allSelected ? 'bg-blue-50/60' : ''}`}
              onClick={toggleAll}
            >
              <Checkbox checked={allSelected} indeterminate={someSelected} />
              <span className="text-sm font-semibold text-slate-600">
                Select all
                <span className="ml-1 font-normal text-slate-400">({items.length})</span>
              </span>
            </div>
          )}

          {/* Items list */}
          <div className="max-h-44 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-sm text-slate-400">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filtered.map(item => {
                const id = Number(item.id);
                const selected = selectedItems.includes(id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors ${selected ? 'bg-blue-50/40' : ''}`}
                    onClick={() => toggleItem(id)}
                  >
                    <Checkbox checked={selected} />
                    <span className={`text-sm leading-tight ${selected ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                      {displayPattern(item)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
