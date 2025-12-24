/// frontend/app/dss/rsq/admin/components/Multiselect.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectItem {
  id: number | string;
  name: string;
  __isUnavailable?: boolean;
  __itemClass?: string;
}

interface MultiSelectProps {
  items: MultiSelectItem[];
  selectedItems: (number | string)[];
  onSelectionChange: (selectedIds: (number | string)[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  itemClassName?: (item: MultiSelectItem) => string;
  itemDisabled?: (item: MultiSelectItem) => boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  itemClassName,
  itemDisabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');

  // refs
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const savedScrollTop = useRef(0);

  // ---------- CORE LOGIC - FIXED ----------
  // Get all selectable item IDs (not disabled)
  const allSelectableItemIds = items
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => item.id);

  // Check if ALL selectable items are selected
  const allSelectableSelected = allSelectableItemIds.length > 0 && 
    allSelectableItemIds.every(id => selectedItems.includes(id));

  // Filtered items
  const filteredItems = items.filter(
    (item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selectable filtered item IDs
  const selectableFilteredIds = filteredItems
    .filter(item => !(itemDisabled && itemDisabled(item)))
    .map(item => item.id);

  // Check if ALL selectable filtered items are selected
  const allFilteredSelectableSelected = selectableFilteredIds.length > 0 && 
    selectableFilteredIds.every(id => selectedItems.includes(id));

  // ---------- POSITION ----------
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const viewport = window.innerHeight;
    const height = 240; // max-h-60

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

  // ---------- FIXED SELECT ALL ----------
  const handleSelectAll = () => {
    if (searchQuery && filteredItems.length > 0) {
      // When searching: toggle ALL selectable filtered items
      if (allFilteredSelectableSelected) {
        // Deselect all filtered selectable items (keep others)
        const newSelection = selectedItems.filter(id => !selectableFilteredIds.includes(id));
        onSelectionChange(newSelection);
      } else {
        // Select all filtered selectable items (add to existing)
        const newSelection = [...new Set([...selectedItems, ...selectableFilteredIds])];
        onSelectionChange(newSelection);
      }
    } else {
      // No search: toggle ALL selectable items
      if (allSelectableSelected) {
        // Deselect all selectable items (keep disabled ones if somehow selected)
        const newSelection = selectedItems.filter(id => !allSelectableItemIds.includes(id));
        onSelectionChange(newSelection);
      } else {
        // Select all selectable items
        onSelectionChange([...new Set([...selectedItems, ...allSelectableItemIds])]);
      }
    }
  };

  // ---------- ITEM SELECT ----------
  const handleItemSelect = (id: number | string) => {
    if (selectedItems.includes(id)) {
      onSelectionChange(selectedItems.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedItems, id]);
    }
  };

  // ---------- DISPLAY TEXT ----------
  const getDisplayText = () => {
    if (selectedItems.length === 0) return placeholder;
    
    const selectableSelectedCount = selectedItems.filter(id => 
      allSelectableItemIds.includes(id)
    ).length;
    
    if (allSelectableSelected && selectableSelectedCount === allSelectableItemIds.length) {
      return `All ${label}s`;
    }
    
    if (selectedItems.length === 1) {
      const it = items.find((i) => i.id === selectedItems[0]);
      return it ? it.name : placeholder;
    }
    
    return `${selectedItems.length} ${label}s selected`;
  };

  // ---------- CLASSES ----------
  const dropdownBase = 'absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg';
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
        className={`w-full p-3 text-sm border-2 border-blue-500 rounded-lg flex justify-between items-center cursor-pointer transition-all duration-200 hover:shadow-md ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed border-gray-300' 
            : 'bg-white hover:border-blue-600 focus-within:border-blue-600'
        }`}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? 'text-gray-400' : 'font-medium'}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-5 h-5 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
          <div className="sticky top-0 p-3 bg-white border-b border-gray-200 z-10">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                  title="Clear search"
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
            {/* SELECT ALL - FIXED */}
            <div
              className={`p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-200 font-medium transition-colors ${
                (searchQuery ? allFilteredSelectableSelected : allSelectableSelected) 
                  ? 'bg-blue-100 border-blue-200' 
                  : ''
              }`}
              onClick={handleSelectAll}
            >
              <input 
                type="checkbox" 
                checked={searchQuery ? allFilteredSelectableSelected : allSelectableSelected} 
                onChange={handleSelectAll} 
                className="mr-3 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="align-middle">
                {searchQuery 
                  ? `All Filtered (${selectableFilteredIds.length})` 
                  : `All ${label}s (${allSelectableItemIds.length})`
                }
              </span>
            </div>

            {/* NO RESULTS */}
            {filteredItems.length === 0 && (
              <div className="p-4 text-center text-gray-500 bg-gray-50">
                No {label.toLowerCase()}s found matching "{searchQuery}"
              </div>
            )}

            {/* ITEMS */}
            {filteredItems.map((item) => {
              const id = item.id;
              const isDisabled = itemDisabled ? itemDisabled(item) : false;
              const extraClass = itemClassName ? itemClassName(item) : '';

              return (
                <div
                  key={String(id)}
                  className={`
                    p-3 cursor-pointer transition-all duration-150 border-b border-gray-50 last:border-b-0
                    ${selectedItems.includes(id) ? 'bg-blue-50 border-l-4 border-blue-400' : 'hover:bg-blue-50'}
                    ${extraClass}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 hover:bg-gray-50' : ''}
                  `.trim()}
                  onClick={() => !isDisabled && handleItemSelect(id)}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(id)}
                      onChange={() => !isDisabled && handleItemSelect(id)}
                      className="mr-3 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      disabled={isDisabled}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={isDisabled ? 'line-through' : ''}>{item.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
