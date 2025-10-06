'use client'
import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps<T> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
}

export function MultiSelect<T extends Record<string, any>>({
  items,
  selectedItems,
  onSelectionChange,
  label = "Item",
  placeholder = "Select items...",
  disabled = false,
  displayPattern = (item) => String(item.name || item[Object.keys(item)[0]]),
}: MultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const displayText = displayPattern(item).toLowerCase();
    const keyValue = String(item.id).toLowerCase();
    
    return displayText.includes(searchLower) || 
           keyValue.includes(searchLower) ||
           `${label.toLowerCase()} ${keyValue}`.includes(searchLower);
  });

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 280;
    
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      setDropdownPosition('top');
    } else {
      setDropdownPosition('bottom');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search and calculate position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    } else {
      setSearchQuery('');
      setDropdownPosition('bottom');
    }
  }, [isOpen]);

  // Toggle dropdown
  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => Number(item.id)));
    }
  };

  // Handle individual item selection
  const handleItemSelect = (itemId: number) => {
    const isCurrentlySelected = selectedItems.includes(itemId);
    
    if (isCurrentlySelected) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Enter' && !isOpen) {
      event.preventDefault();
      toggleDropdown();
    }
  };

  // Format the display text
  const getDisplayText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    }
    
    if (allSelected) {
      return `All ${label}s`;
    }
    
    if (selectedItems.length === 1) {
      const selectedItem = items.find(item => Number(item.id) === selectedItems[0]);
      return selectedItem ? displayPattern(selectedItem) : `1 ${label} selected`;
    }
    
    return `${selectedItems.length} ${label}s selected`;
  };

  // Get dropdown positioning classes
  const getDropdownClasses = () => {
    const baseClasses = "absolute z-50 w-full bg-white border border-blue-500 rounded-md shadow-lg max-h-72 overflow-hidden";
    
    if (dropdownPosition === 'top') {
      return `${baseClasses} bottom-full mb-2`;
    } else {
      return `${baseClasses} top-full mt-2`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}:
      </label>
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed text-gray-500' 
            : 'bg-white hover:border-blue-600'
        } ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label} selection. ${selectedItems.length} items selected.`}
      >
        <span className={selectedItems.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-5 h-5 ml-2 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          } ${disabled ? 'text-gray-400' : 'text-gray-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      
      {isOpen && !disabled && (
        <div className={getDropdownClasses()}>
          {/* Search box */}
          <div className="sticky top-0 p-3 border-b border-gray-200 bg-white">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Scrollable content area */}
          <div className="max-h-56 overflow-y-auto">
            {/* Select All option */}
            <div
              className={`px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 font-medium flex items-center transition-colors ${
                allSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
              onClick={handleSelectAll}
            >
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                {!allSelected && selectedItems.length > 0 && selectedItems.length < items.length && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
                  </div>
                )}
              </div>
              <span className="ml-3">
                Select All {label}s ({items.length})
              </span>
            </div>
            
            {/* No results message */}
            {filteredItems.length === 0 && searchQuery && (
              <div className="px-4 py-6 text-center text-gray-500">
                <p>No {label}s found matching "<span className="font-medium">{searchQuery}</span>"</p>
                <p className="text-sm text-gray-400 mt-1">Try different keywords or clearing your search</p>
              </div>
            )}
            
            {/* No items available */}
            {items.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-500">
                <p>No {label}s available</p>
                <p className="text-sm text-gray-400 mt-1">Make sure required selections are made above</p>
              </div>
            )}
            
            {/* Individual items */}
            {filteredItems
              .sort((a, b) => displayPattern(a).localeCompare(displayPattern(b)))
              .map(item => {
                const itemId = Number(item.id);
                const isSelected = selectedItems.includes(itemId);
                return (
                  <div
                    key={String(itemId)}
                    className={`px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                    onClick={() => handleItemSelect(itemId)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleItemSelect(itemId)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 flex-1">
                      {displayPattern(item)}
                    </span>
                    {isSelected && (
                      <div className="ml-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          
        
        </div>
      )}
    </div>
  );
}