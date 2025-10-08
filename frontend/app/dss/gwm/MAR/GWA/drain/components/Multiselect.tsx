'use client';
import React, { useState, useRef, useEffect } from 'react';

interface WithIdName {
  id: number | string;
  name: string;
}

interface MultiSelectProps<T extends WithIdName> {
  items: T[];
  selectedItems: (number | string)[];
  onSelectionChange: (selectedIds: (number | string)[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
}

export const MultiSelect = <T extends WithIdName>({
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
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allItemIds = items.map(item => item.id);
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // Scroll position preservation
  const savedScrollTop = useRef(0);

  const filteredItems = items.filter(item =>
    displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 240;

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      setDropdownPosition('top');
    } else {
      setDropdownPosition('bottom');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setDropdownPosition('bottom');
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      calculateDropdownPosition();
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...allItemIds]);
    }
  };

  const handleItemSelect = (itemId: number | string) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) return placeholder;
    if (allSelected) return `All ${label}s`;
    if (selectedItems.length === 1) {
      const selected = items.find(item => item.id === selectedItems[0]);
      return selected ? displayPattern(selected) : placeholder;
    }
    return `${selectedItems.length} ${label}s selected`;
  };

  const getDropdownClasses = () => {
    const baseClasses = "absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto";
    return dropdownPosition === 'top' ? `${baseClasses} bottom-full mb-1` : `${baseClasses} top-full mt-1`;
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollTop.current = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    if (dropdownRef.current) {
      dropdownRef.current.scrollTop = savedScrollTop.current;
    }
  }, [filteredItems, selectedItems]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}:</label>
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? 'text-gray-400' : ''}>{getDisplayText()}</span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </div>

      {isOpen && !disabled && (
        <div className={getDropdownClasses()} onScroll={onScroll}>
          <div className="sticky top-0 p-2 border-b border-gray-200 bg-white">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
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

          <div
            className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${allSelected ? 'bg-blue-50' : ''}`}
            onClick={handleSelectAll}
          >
            <input type="checkbox" checked={allSelected} onChange={handleSelectAll} className="mr-2" />
            All {label}s
          </div>

          {filteredItems.length === 0 && (
            <div className="p-3 text-center text-gray-500">
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`p-2 hover:bg-blue-100 cursor-pointer ${selectedItems.includes(item.id) ? 'bg-blue-50' : ''}`}
              onClick={() => handleItemSelect(item.id)}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(item.id)}
                onChange={() => handleItemSelect(item.id)}
                className="mr-2"
              />
              {displayPattern(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
