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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const savedScrollTop = useRef(0);

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const filteredItems = items.filter(item =>
    displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateDropdownStyle = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 300;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    } else {
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) { setSearchQuery(''); return; }
    calculateDropdownStyle();
    const onScrollOrResize = () => calculateDropdownStyle();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) {
      if (!isOpen) calculateDropdownStyle();
      setIsOpen(v => !v);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(allSelected ? [] : items.map(i => i.id));
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

  const onListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    savedScrollTop.current = e.currentTarget.scrollTop;
  };

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = savedScrollTop.current;
  }, [filteredItems, selectedItems]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}:</label>
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? 'text-gray-400' : ''}>{getDisplayText()}</span>
        <svg className="w-4 h-4 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </div>

      {isOpen && !disabled && (
        <div style={dropdownStyle} className="bg-white border border-gray-300 rounded-md shadow-xl">
          <div className="sticky top-0 p-2 border-b border-gray-200 bg-white z-10">
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

          <div ref={listRef} className="max-h-60 overflow-y-auto" onScroll={onListScroll}>
            <div
              className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${allSelected ? 'bg-blue-50' : ''}`}
              onClick={handleSelectAll}
            >
              <input type="checkbox" checked={allSelected} onChange={handleSelectAll} className="mr-2" onClick={e => e.stopPropagation()} />
              All {label}s
            </div>

            {filteredItems.length === 0 && (
              <div className="p-3 text-center text-gray-500">No {label}s found matching "{searchQuery}"</div>
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
                  onClick={e => e.stopPropagation()}
                />
                {displayPattern(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
