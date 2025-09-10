'use client'
import React, { useState, useRef, useEffect } from 'react';
import { River, Stretch, Drain, Catchment} from '@/contexts/stp_priority/users/DrainContext';


// Base interface for items that can be selected
interface SelectableItem {
  id: number;
  name?: string;
}

interface RiverMultiSelectProps<T extends SelectableItem> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label: string;  
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
}

export const RiverMultiSelect = <T extends Stretch | Drain | Catchment>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = false,
  displayPattern = (item) => {
    // Default display pattern based on item type
    if ('Stretch_ID' in item) {
      return (item as Stretch).name ? `${(item as Stretch).name} (ID: ${(item as Stretch).Stretch_ID})` : `Stretch ${(item as Stretch).Stretch_ID}`;
    }
    if ('Drain_No' in item) {
      return (item as Drain).name ? `${(item as Drain).name} (No: ${(item as Drain).Drain_No})` : `Drain ${(item as Drain).Drain_No}`;
    }
    if ('village_name' in item) {
      return (item as Catchment).name ? `${(item as Catchment).name} (Grid: ${(item as Catchment).village_name})` : `Catchment ${(item as Catchment).village_name}`;
    }
    return '';
  },
}: RiverMultiSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allItemIds = items.map(item => Number(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // Filter items based on search query
  const filteredItems = items.filter(item => {

    const displayText = displayPattern(item).toLowerCase();
    const searchTerm = searchQuery.toLowerCase();
    
    // Search in display text
    if (displayText.includes(searchTerm)) return true;
    
    // Search in name if available
    if (item.name && item.name.toLowerCase().includes(searchTerm)) return true;
    
    // Search in specific fields based on item type
    if ('Stretch_ID' in item && item.Stretch_ID.toString().includes(searchTerm)) return true;
    if ('Drain_No' in item && item.Drain_No.toString().includes(searchTerm)) return true;
    if ('village_name' in item && item.village_name.toString().includes(searchTerm)) return true;
    
    return false;
  });

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 240; // max-h-60 = 15rem = 240px
    
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    
    // If there's not enough space below but there's space above, position on top
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

  // Focus search input when dropdown opens and calculate position
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [isOpen]);


  // Reset search and position when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setDropdownPosition('bottom');
    }
  }, [isOpen]);

  // Recalculate position on window resize (only if dropdown is open)
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => calculateDropdownPosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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
      // If all are selected, deselect all
      onSelectionChange([]);
    } else {
      // Otherwise select all
      onSelectionChange([...allItemIds]);
    }
  };

  // Handle item selection
  const handleItemSelect = (itemId: number) => {
    if (selectedItems.includes(itemId)) {
      // Item is already selected, remove it
      onSelectionChange(selectedItems.filter(id => id !== itemId));
      
    } else {
      // Item is not selected, add it
      onSelectionChange([...selectedItems, itemId]);
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
      const selected = items.find(item => item.id === selectedItems[0]);
      return selected ? displayPattern(selected) : placeholder;
    }
    
    return `${selectedItems.length} ${label}s selected`;
  };

  // Get dropdown positioning classes
  const getDropdownClasses = () => {
    const baseClasses = "absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto";
    
    if (dropdownPosition === 'top') {
      return `${baseClasses} bottom-full mb-1`;
    } else {
      return `${baseClasses} top-full mt-1`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}:
      </label>
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
            d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
          />
        </svg>
      </div>
      
      {isOpen && !disabled && (
        <div className={getDropdownClasses()}>
          {/* Search box */}
          <div className="sticky top-0 p-2 border-b border-gray-200 bg-white">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Search ${label}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Select All option */}
          {items.length > 0 && (
            <div
              className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
                allSelected ? 'bg-blue-50' : ''
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
          
          {/* No results message */}
          {filteredItems.length === 0 && searchQuery && (
            <div className="p-3 text-center text-gray-500">
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {/* No items available message */}
          {items.length === 0 && (
            <div className="p-3 text-center text-gray-500">
              No {label}s available
            </div>
          )}
          
          {/* Individual items */}
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`p-2 hover:bg-blue-100 cursor-pointer ${
                selectedItems.includes(Number(item.id)) ? 'bg-blue-50' : ''
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
};