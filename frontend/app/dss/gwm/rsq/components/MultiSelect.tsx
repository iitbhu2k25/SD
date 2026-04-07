"use client";

import React, { useEffect, useRef, useState } from "react";

interface BaseItem {
  id: number | string;
  name: string;
}

interface MultiSelectProps<T extends BaseItem> {
  items: T[];
  selectedItems: Array<number | string>;
  onSelectionChange: (selectedIds: Array<number | string>) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
  itemDisabled?: (item: T) => boolean;
  itemClassName?: (item: T) => string;
}

export default function MultiSelect<T extends BaseItem>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => item.name,
  itemDisabled,
  itemClassName,
}: MultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filteredItems = items.filter((item) => displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase()));
  const selectableItems = items.filter((item) => !(itemDisabled && itemDisabled(item)));
  const selectableFilteredItems = filteredItems.filter((item) => !(itemDisabled && itemDisabled(item)));
  const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedItems.includes(item.id));
  const allFilteredSelected =
    selectableFilteredItems.length > 0 && selectableFilteredItems.every((item) => selectedItems.includes(item.id));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDropdownPosition("bottom");
    }
  }, [isOpen]);

  const calculateDropdownPosition = () => {
    if (!triggerRef.current) {
      return;
    }
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 240;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setDropdownPosition(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? "top" : "bottom");
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    }
    if (allSelected) {
      return `All ${label}s`;
    }
    if (selectedItems.length === 1) {
      const selected = items.find((item) => item.id === selectedItems[0]);
      return selected ? displayPattern(selected) : placeholder;
    }
    return `${selectedItems.length} ${label}s selected`;
  };

  const toggleSelectAll = () => {
    const targetIds = (searchQuery ? selectableFilteredItems : selectableItems).map((item) => item.id);
    const selected = searchQuery ? allFilteredSelected : allSelected;

    if (selected) {
      onSelectionChange(selectedItems.filter((id) => !targetIds.includes(id)));
      return;
    }

    onSelectionChange([...new Set([...selectedItems, ...targetIds])]);
  };

  const toggleItem = (id: number | string) => {
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter((itemId) => itemId !== id));
      return;
    }
    onSelectionChange([...selectedItems, id]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</label>
      <div
        ref={triggerRef}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
          disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "cursor-pointer border-slate-200 bg-white hover:border-blue-300"
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
            calculateDropdownPosition();
          }
        }}
      >
        <span className={selectedItems.length === 0 ? "text-slate-400" : "text-slate-700"}>{getDisplayText()}</span>
        <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && !disabled && (
        <div
          className={`absolute z-50 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${
            dropdownPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="border-b border-slate-100 p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={toggleSelectAll}
            >
              <input type="checkbox" checked={searchQuery ? allFilteredSelected : allSelected} readOnly />
              <span>{searchQuery ? `All Filtered (${selectableFilteredItems.length})` : `All ${label}s (${selectableItems.length})`}</span>
            </button>

            {filteredItems.map((item) => {
              const isItemDisabled = itemDisabled ? itemDisabled(item) : false;
              const className = itemClassName ? itemClassName(item) : "";
              return (
                <button
                  type="button"
                  key={String(item.id)}
                  disabled={isItemDisabled}
                  onClick={() => toggleItem(item.id)}
                  className={`flex w-full items-center gap-2 border-b border-slate-50 px-4 py-3 text-left text-sm ${
                    selectedItems.includes(item.id) ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  } ${isItemDisabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""} ${className}`.trim()}
                >
                  <input type="checkbox" checked={selectedItems.includes(item.id)} readOnly disabled={isItemDisabled} />
                  <span>{displayPattern(item)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
