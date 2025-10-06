'use client'
import React, { useState, useRef, useEffect } from 'react';
import { Subbasin } from '@/contexts/surfacewater_assessment/drain/LocationContext';

interface SubbasinMultiSelectProps {
  subbasins: Subbasin[];
  selectedSubbasins: Subbasin[];
  onSelectionChange: (selectedSubbasins: Subbasin[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  displayPattern?: (subbasin: Subbasin) => string;
}

export const SubbasinMultiSelect: React.FC<SubbasinMultiSelectProps> = ({
  subbasins,
  selectedSubbasins,
  onSelectionChange,
  label = "Subbasin",
  placeholder = "Select subbasins...",
  disabled = false,
  displayPattern = (subbasin) => `Subbasin ${subbasin.sub}`,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const selectedSubbasinIds = selectedSubbasins.map(s => s.sub);
  const allSelected = subbasins.length > 0 && selectedSubbasins.length === subbasins.length;

  // Filter subbasins based on search query
  const filteredSubbasins = subbasins.filter(subbasin => {
    const searchLower = searchQuery.toLowerCase();
    const displayText = displayPattern(subbasin).toLowerCase();
    const subNumber = subbasin.sub.toString();
    
    return displayText.includes(searchLower) || 
           subNumber.includes(searchQuery) ||
           `subbasin ${subNumber}`.includes(searchLower);
  });

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 280; // Slightly larger for better UX
    
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
      // Focus search input when dropdown opens
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
      onSelectionChange([...subbasins]);
    }
  };

  // Handle individual item selection
  const handleItemSelect = (subbasinId: number) => {
    const subbasin = subbasins.find(s => s.sub === subbasinId);
    if (!subbasin) return;

    const isCurrentlySelected = selectedSubbasinIds.includes(subbasinId);
    if (isCurrentlySelected) {
      onSelectionChange(selectedSubbasins.filter(s => s.sub !== subbasinId));
    } else {
      onSelectionChange([...selectedSubbasins, subbasin]);
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
    if (selectedSubbasins.length === 0) {
      return placeholder;
    }
    
    if (allSelected) {
      return `All ${label}s`;
    }
    
    if (selectedSubbasins.length === 1) {
      return displayPattern(selectedSubbasins[0]);
    }
    
    return `${selectedSubbasins.length} ${label}s selected`;
  };

  // Get dropdown positioning classes
  const getDropdownClasses = () => {
    const baseClasses = "absolute z-50 w-full bg-white border border-gray-300 rounded-xl shadow-lg max-h-72 overflow-hidden";
    
    if (dropdownPosition === 'top') {
      return `${baseClasses} bottom-full mb-2`;
    } else {
      return `${baseClasses} top-full mt-2`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} Selection:
      </label>
      <div
        ref={triggerRef}
        className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-xl flex justify-between items-center cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed text-gray-500' 
            : 'bg-white hover:border-blue-300'
        } ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label} selection. ${selectedSubbasins.length} items selected.`}
      >
        <span className={selectedSubbasins.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
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
          <div className="sticky top-0 p-3 border-b border-gray-200 bg-white rounded-t-xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s... (e.g., 12)`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                {!allSelected && selectedSubbasins.length > 0 && selectedSubbasins.length < subbasins.length && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-sm"></div>
                  </div>
                )}
              </div>
              <span className="ml-3">
                Select All {label}s ({subbasins.length})
              </span>
            </div>
            
            {/* No results message */}
            {filteredSubbasins.length === 0 && searchQuery && (
              <div className="px-4 py-6 text-center text-gray-500">
                <svg className="mx-auto h-8 w-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No {label}s found matching "<span className="font-medium">{searchQuery}</span>"</p>
                <p className="text-sm text-gray-400 mt-1">Try searching by number or clearing your search</p>
              </div>
            )}
            
            {/* Individual items */}
            {filteredSubbasins
              .sort((a, b) => a.sub - b.sub) // Sort by subbasin number
              .map(subbasin => {
                const isSelected = selectedSubbasinIds.includes(subbasin.sub);
                return (
                  <div
                    key={subbasin.sub}
                    className={`px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                    onClick={() => handleItemSelect(subbasin.sub)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleItemSelect(subbasin.sub)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="ml-3 flex-1">
                      {displayPattern(subbasin)}
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
          
          {/* Footer with selection count */}
          {filteredSubbasins.length > 0 && (
            <div className="sticky bottom-0 px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>
                  Showing {filteredSubbasins.length} of {subbasins.length} {label}s
                </span>
                <span className="font-medium">
                  {selectedSubbasins.length} selected
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};