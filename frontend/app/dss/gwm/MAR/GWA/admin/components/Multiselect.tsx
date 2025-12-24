'use client';

import React, { useState, useRef, useEffect } from 'react';
import { District, SubDistrict } from '@/contexts/groundwater_assessment/admin/LocationContext';

interface MultiSelectProps<T> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;

  // per‑item styling / disabling
  itemClassName?: (item: T) => string;
  itemDisabled?: (item: T) => boolean;
}

export const MultiSelect = <
  T extends District | SubDistrict = District | SubDistrict,
>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => item.name,
  itemClassName,
  itemDisabled,
}: MultiSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');

  // refs
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get only selectable (non-disabled) item IDs
  const selectableItemIds = items
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => Number(item.id));
  
  const allSelected = selectableItemIds.length > 0 && 
    selectableItemIds.every(id => selectedItems.includes(id));

  const savedScrollTop = useRef(0);

  // ---------- FILTER ----------
  const filteredItems = items.filter(
    (item) =>
      displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item as any).name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get IDs of selectable filtered items (not disabled)
  const selectableFilteredIds = filteredItems
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => Number(item.id));

  // Check if all selectable filtered items are selected
  const allFilteredSelected = selectableFilteredIds.length > 0 && 
    selectableFilteredIds.every(id => selectedItems.includes(id));

  // ---------- POSITION ----------
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const viewport = window.innerHeight;
    const height = 240; // max‑h‑60

    const below = viewport - trigger.bottom;
    const above = trigger.top;

    setDropdownPosition(below < height && above > height ? 'top' : 'bottom');
  };

  // ---------- CLICK OUTSIDE ----------
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ---------- RESET ON CLOSE ----------
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setDropdownPosition('bottom');
    }
  }, [isOpen]);

  // ---------- TOGGLE ----------
  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen((v) => !v);
    if (!isOpen) calculateDropdownPosition();
  };

  // ---------- SELECT ALL ----------
  const handleSelectAll = () => {
    if (searchQuery) {
      // When searching, toggle only the filtered selectable items
      if (allFilteredSelected) {
        // Deselect all filtered items
        onSelectionChange(selectedItems.filter(id => !selectableFilteredIds.includes(id)));
      } else {
        // Select all filtered items (add them to existing selection)
        const newSelection = [...new Set([...selectedItems, ...selectableFilteredIds])];
        onSelectionChange(newSelection);
      }
    } else {
      // When not searching, toggle all selectable items (excluding disabled ones)
      onSelectionChange(allSelected ? [] : [...selectableItemIds]);
    }
  };

  // ---------- ITEM SELECT ----------
  const handleItemSelect = (id: number) => {
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedItems, id]);
    }
  };

  // ---------- DISPLAY TEXT ----------
  const getDisplayText = () => {
    if (selectedItems.length === 0) return placeholder;
    if (allSelected) return `All ${label}s`;
    if (selectedItems.length === 1) {
      const it = items.find((i) => i.id === selectedItems[0]);
      return it ? displayPattern(it) : placeholder;
    }
    return `${selectedItems.length} ${label}s selected`;
  };

  // ---------- CLASSES ----------
  const dropdownBase = 'absolute z-[9999] w-full bg-white border border-gray-300 rounded-md shadow-lg';
  const dropdownClasses =
    dropdownPosition === 'top'
      ? `${dropdownBase} bottom-full mb-1`
      : `${dropdownBase} top-full mt-1`;

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollTop.current = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    if (dropdownRef.current) dropdownRef.current.scrollTop = savedScrollTop.current;
  }, [filteredItems, selectedItems]);

  return (
    <div className="relative" ref={containerRef}>
      {/* LABEL */}
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}:</label>

      {/* TRIGGER */}
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        }`}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? 'text-gray-400' : ''}>
          {getDisplayText()}
        </span>
        <svg
          className="w-4 h-4 ml-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d={isOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
          />
        </svg>
      </div>

      {/* DROPDOWN */}
      {isOpen && !disabled && (
        <div className={dropdownClasses}>
          {/* SEARCH – sticky, outside scrollable list */}
          <div className="sticky top-0 p-2 bg-white border-b border-gray-200 z-10">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* LIST – scrollable */}
          <div ref={dropdownRef} className="max-h-60 overflow-y-auto" onScroll={onScroll}>
            {/* SELECT ALL */}
            <div
              className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
                (searchQuery ? allFilteredSelected : allSelected) ? 'bg-blue-50' : ''
              }`}
              onClick={handleSelectAll}
            >
              <input 
                type="checkbox" 
                checked={searchQuery ? allFilteredSelected : allSelected} 
                onChange={handleSelectAll} 
                className="mr-2"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery ? `All Filtered ${label}s` : `All ${label}s`}
            </div>

            {/* NO RESULTS */}
            {filteredItems.length === 0 && (
              <div className="p-3 text-center text-gray-500">
                No {label}s found matching "{searchQuery}"
              </div>
            )}

            {/* ITEMS */}
            {filteredItems.map((item) => {
              const id = Number(item.id);
              const isDisabled = itemDisabled ? itemDisabled(item) : false;
              const extra = itemClassName ? itemClassName(item) : '';

              return (
                <div
                  key={item.id}
                  className={`
                    p-2 cursor-pointer
                    ${selectedItems.includes(id) ? 'bg-blue-50' : 'hover:bg-blue-100'}
                    ${extra}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `.trim()}
                  onClick={() => !isDisabled && handleItemSelect(id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(id)}
                    onChange={() => !isDisabled && handleItemSelect(id)}
                    className="mr-2"
                    disabled={isDisabled}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {displayPattern(item)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};