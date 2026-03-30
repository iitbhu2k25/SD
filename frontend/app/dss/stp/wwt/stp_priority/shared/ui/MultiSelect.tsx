"use client";

import React, { useEffect, useRef, useState } from "react";

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
      ? "absolute z-50 w-full bottom-full mb-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
      : "absolute z-50 w-full top-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto";

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}:
      </label>
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer ${
          disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
        }`}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? "text-gray-400" : ""}>
          {getDisplayText()}
        </span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="sticky top-0 p-2 border-b border-gray-200 bg-white">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(event) => event.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSearchQuery("");
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div
              className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
                allSelected ? "bg-blue-50" : ""
              }`}
              onClick={handleSelectAll}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="mr-2"
              />
              All {label}s
            </div>
          )}

          {items.length === 0 && (
            <div className="p-3 text-center text-gray-500">No {label}s available</div>
          )}

          {filteredItems.length === 0 && searchQuery && (
            <div className="p-3 text-center text-gray-500">
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-2 hover:bg-blue-100 cursor-pointer ${
                selectedItems.includes(Number(item.id)) ? "bg-blue-50" : ""
              }`}
              onClick={() => handleItemSelect(Number(item.id))}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(Number(item.id))}
                onChange={() => handleItemSelect(Number(item.id))}
                className="mr-2"
              />
              <span className="text-sm">{displayPattern(item)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
