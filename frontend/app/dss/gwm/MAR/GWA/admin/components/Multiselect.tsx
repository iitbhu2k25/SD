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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const savedScrollTop = useRef(0);

  const selectableItemIds = items
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => Number(item.id));

  const allSelected = selectableItemIds.length > 0 &&
    selectableItemIds.every(id => selectedItems.includes(id));

  const filteredItems = items.filter(
    (item) =>
      displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item as any).name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectableFilteredIds = filteredItems
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => Number(item.id));

  const allFilteredSelected = selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every(id => selectedItems.includes(id));

  // Calculate fixed position from trigger rect
  const calculateDropdownStyle = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const width = rect.width;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      // open upward
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top,
        left: rect.left,
        width,
        zIndex: 99999,
      });
    } else {
      // open downward
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width,
        zIndex: 99999,
      });
    }
  };

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }
    calculateDropdownStyle();
    const onScroll = () => calculateDropdownStyle();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (disabled) return;
    if (!isOpen) calculateDropdownStyle();
    setIsOpen((v) => !v);
  };

  const handleSelectAll = () => {
    if (searchQuery) {
      if (allFilteredSelected) {
        onSelectionChange(selectedItems.filter(id => !selectableFilteredIds.includes(id)));
      } else {
        onSelectionChange([...new Set([...selectedItems, ...selectableFilteredIds])]);
      }
    } else {
      onSelectionChange(allSelected ? [] : [...selectableItemIds]);
    }
  };

  const handleItemSelect = (id: number) => {
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedItems, id]);
    }
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) return placeholder;
    if (allSelected) return `All ${label}s`;
    if (selectedItems.length === 1) {
      const it = items.find((i) => i.id === selectedItems[0]);
      return it ? displayPattern(it) : placeholder;
    }
    return `${selectedItems.length} ${label}s selected`;
  };

  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollTop.current = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    if (dropdownRef.current) dropdownRef.current.scrollTop = savedScrollTop.current;
  }, [filteredItems, selectedItems]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold mb-1.5 sm:text-sm text-gray-700">{label}:</label>

      <div
        ref={triggerRef}
        className={`w-full rounded-lg border px-2.5 py-2 text-xs transition duration-200 sm:px-3 sm:py-2.5 sm:text-sm flex justify-between items-center focus:outline-none focus:ring-2 ${
          disabled
            ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400'
            : 'cursor-pointer border-stone-300 bg-[#fdfcfa] hover:border-stone-400 focus:border-blue-500 focus:ring-blue-500/20'
        }`}
        onClick={toggleDropdown}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedItems.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
          {getDisplayText()}
        </span>
        <svg className="h-3.5 w-3.5 ml-2 shrink-0 sm:h-4 sm:w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d={isOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </div>

      {/* DROPDOWN — rendered at fixed position to escape overflow:hidden ancestors */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-gray-300 rounded-md shadow-xl"
        >
          {/* Search */}
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
                autoFocus
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div ref={dropdownRef} className="max-h-60 overflow-y-auto" onScroll={onListScroll}>
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

            {filteredItems.length === 0 && (
              <div className="p-3 text-center text-gray-500">
                No {label}s found matching "{searchQuery}"
              </div>
            )}

            {filteredItems.map((item) => {
              const id = Number(item.id);
              const isDisabled = itemDisabled ? itemDisabled(item) : false;
              const extra = itemClassName ? itemClassName(item) : '';
              return (
                <div
                  key={item.id}
                  className={`p-2 cursor-pointer ${selectedItems.includes(id) ? 'bg-blue-50' : 'hover:bg-blue-100'} ${extra} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`.trim()}
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
