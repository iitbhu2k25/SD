"use client";

import React, { useEffect, useRef, useState } from "react";
import CloseIcon from "@/components/dss_common/CloseIcon";

interface SelectableItem {
  id: number | string;
  name?: string;
}

interface SingleSelectProps<T extends SelectableItem> {
  items: T[];
  selectedValue: number | string | null;
  onValueChange: (id: number | string | null) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
  labelAction?: React.ReactNode;
  isDark?: boolean;
}

export function SingleSelect<T extends SelectableItem>({
  items,
  selectedValue,
  onValueChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => item.name ?? String(item.id),
  labelAction,
  isDark = false,
}: SingleSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter((item) => {
    const text = displayPattern(item).toLowerCase();
    const query = searchQuery.toLowerCase();
    if (text.includes(query)) return true;
    return (item.name ?? "").toLowerCase().includes(query);
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setSearchQuery("");
      setDropdownPosition("bottom");
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setDropdownPosition(
      spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? "top" : "bottom",
    );

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) setIsOpen((prev) => !prev);
  };

  const handleItemSelect = (itemId: number | string) => {
    onValueChange(itemId);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (selectedValue === null || selectedValue === undefined) return placeholder;
    const selected = items.find((item) => item.id === selectedValue);
    return selected ? displayPattern(selected) : placeholder;
  };

  const dropdownClasses =
    dropdownPosition === "top"
      ? `absolute bottom-full z-50 mb-1 w-full max-h-[60vh] overflow-y-auto rounded-xl border shadow-xl sm:max-h-60 ${
          isDark ? "border-[#1e3a5f]/60 bg-[#080e1c]" : "border-stone-200 bg-[#fdfcfa]"
        }`
      : `absolute top-full z-50 mt-1 w-full max-h-[60vh] overflow-y-auto rounded-xl border shadow-xl sm:max-h-60 ${
          isDark ? "border-[#1e3a5f]/60 bg-[#080e1c]" : "border-stone-200 bg-[#fdfcfa]"
        }`;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
        <label className={`block text-xs font-semibold sm:text-sm ${
          isDark ? "text-slate-300" : "text-gray-700"
        }`}>
          {label}:
        </label>
        {labelAction && <div className="shrink-0">{labelAction}</div>}
      </div>

      <div
        ref={triggerRef}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition duration-200 sm:px-3 sm:py-2.5 sm:text-sm ${
          disabled
            ? isDark
              ? "cursor-not-allowed border-[#1e3a5f]/50 bg-[#060c15] text-[#1e3a5f]"
              : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400"
            : isOpen
              ? isDark
                ? "border-cyan-500 bg-[#06101e] ring-2 ring-cyan-500/25 shadow-[0_0_10px_rgba(6,182,212,0.15)] text-cyan-50"
                : "border-blue-500 bg-white/90 ring-2 ring-blue-500/20 shadow-sm"
              : isDark
                ? "border-[#1e3a5f]/80 bg-[#080e1c] text-slate-200 hover:border-[#1e3a5f]"
                : "border-stone-300 bg-[#fdfcfa] hover:border-stone-400"
        }`}
        onClick={toggleDropdown}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selectedValue === null || selectedValue === undefined
              ? isDark ? "text-slate-500" : "text-gray-400"
              : isDark ? "text-slate-100" : ""
          }`}
        >
          {getDisplayText()}
        </span>
        <svg className="ml-2 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      </div>

      {isOpen && !disabled && (
        <div className={dropdownClasses}>
          <div className={`sticky top-0 z-10 border-b p-2 sm:p-3 ${
            isDark ? "border-[#1e3a5f]/60 bg-[#080e1c]" : "border-stone-200 bg-[#fdfcfa]"
          }`}>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={`w-full rounded-lg border p-2 pr-8 text-xs focus:outline-none focus:ring-2 sm:text-sm ${
                  isDark
                    ? "border-[#1e3a5f] bg-[#0c1626] text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:ring-cyan-500/30"
                    : "border-stone-200 focus:border-blue-400 focus:ring-blue-500/30"
                }`}
                onClick={(event) => event.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-gray-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSearchQuery("");
                  }}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {items.length === 0 && (
            <div className={`p-3 text-center text-xs sm:text-sm ${
              isDark ? "text-slate-500" : "text-gray-500"
            }`}>
              No {label}s available
            </div>
          )}

          {filteredItems.length === 0 && searchQuery && (
            <div className={`p-3 text-center text-xs sm:text-sm ${
              isDark ? "text-slate-500" : "text-gray-500"
            }`}>
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`cursor-pointer px-3 py-2.5 text-xs transition-all duration-150 sm:text-sm ${
                item.id === selectedValue
                  ? isDark
                    ? "border-l-2 border-l-cyan-400 bg-cyan-900/20 text-cyan-200 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]"
                    : "border-l-2 border-l-blue-500 bg-blue-50/70 text-blue-800"
                  : isDark
                    ? "text-slate-300 hover:bg-[#12233f]/70"
                    : "text-slate-700 hover:bg-stone-50"
              }`}
              onClick={() => handleItemSelect(item.id)}
            >
              {displayPattern(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}