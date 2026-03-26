"use client";

import React, { useEffect, useRef, useState } from "react";
import CloseIcon from "./icons/CloseIcon";

interface SelectableItem {
  id: number | string;
  name?: string;
}

interface MultiSelectProps<T extends SelectableItem> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
}

export function MultiSelect<T extends SelectableItem>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => item.name ?? String(item.id),
}: MultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
    "bottom",
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allItemIds = items.map((item) => Number(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const filteredItems = items.filter((item) => {
    const text = displayPattern(item).toLowerCase();
    const query = searchQuery.toLowerCase();
    if (text.includes(query)) {
      return true;
    }
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
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(allSelected ? [] : allItemIds);
  };

  const handleItemSelect = (itemId: number) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter((id) => id !== itemId));
      return;
    }
    onSelectionChange([...selectedItems, itemId]);
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    }
    if (allSelected) {
      return `All ${label}s`;
    }
    if (selectedItems.length === 1) {
      const selected = items.find((item) => Number(item.id) === selectedItems[0]);
      return selected ? displayPattern(selected) : placeholder;
    }
    return `${selectedItems.length} ${label}s selected`;
  };

  const dropdownClasses =
    dropdownPosition === "top"
      ? "absolute bottom-full z-50 mb-1 w-full max-h-[60vh] overflow-y-auto rounded-xl border border-stone-200 bg-[#fdfcfa] shadow-xl sm:max-h-60"
      : "absolute top-full z-50 mt-1 w-full max-h-[60vh] overflow-y-auto rounded-xl border border-stone-200 bg-[#fdfcfa] shadow-xl sm:max-h-60";

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm">
        {label}:
      </label>
      <div
        ref={triggerRef}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition duration-200 sm:px-3 sm:py-2.5 sm:text-sm ${disabled ? "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400" : isOpen ? "border-blue-500 bg-white/90 ring-2 ring-blue-500/20 shadow-sm" : "border-stone-300 bg-[#fdfcfa] hover:border-stone-400"
          }`}
        onClick={toggleDropdown}
      >
        <span
          className={`min-w-0 flex-1 truncate ${selectedItems.length === 0 ? "text-gray-400" : ""
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
          <div className="sticky top-0 border-b border-stone-200 bg-[#fdfcfa] p-2 sm:p-3">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-stone-200 p-2 pr-8 text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:text-sm"
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

          {items.length > 0 && (
            <div
              className={`cursor-pointer border-b border-stone-100 p-2.5 font-medium transition-colors hover:bg-stone-50 ${allSelected ? "bg-blue-50/80 text-blue-700" : "text-slate-700"
                }`}
              onClick={handleSelectAll}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="mr-2 rounded accent-blue-600"
              />
              All {label}s
            </div>
          )}

          {items.length === 0 && (
            <div className="p-3 text-center text-xs text-gray-500 sm:text-sm">No {label}s available</div>
          )}

          {filteredItems.length === 0 && searchQuery && (
            <div className="p-3 text-center text-xs text-gray-500 sm:text-sm">
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`cursor-pointer rounded-lg p-2.5 transition-all duration-150 ${selectedItems.includes(Number(item.id)) ? "border-l-2 border-l-blue-500 bg-blue-50/70 text-blue-800" : "hover:bg-stone-50 text-slate-700"
                }`}
              onClick={() => handleItemSelect(Number(item.id))}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(Number(item.id))}
                onChange={() => handleItemSelect(Number(item.id))}
                className="mr-2 rounded accent-blue-600"
              />
              <span className="break-words text-xs sm:text-sm">{displayPattern(item)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
