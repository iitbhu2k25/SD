'use client'
import React, { useState, useEffect, useRef } from 'react';

interface Item {
  id?: number | string;
  name: string;
  disabled?: boolean; // Support for disabled items
  [key: string]: any;
}

interface MultiSelectProps<T extends Item> {
  items: T[];
  selectedItems: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
  groupBy?: (items: T[]) => { [key: string]: T[] };
  useNestedGroups?: boolean;
  nestedGroupBy?: (items: T[]) => { [key: string]: { [key: string]: T[] } };
  showGroupHeaders?: boolean;
  groupHeaderFormat?: string;
  districtHeaderFormat?: string;
  subDistrictHeaderFormat?: string;
  itemKey?: string;
}

export const MultiSelect = <T extends Item>(props: MultiSelectProps<T>) => {
  const {
    items,
    selectedItems,
    onSelectionChange,
    label,
    placeholder,
    disabled = false,
    displayPattern = (item) => item.name || '',
    groupBy,
    useNestedGroups = false,
    nestedGroupBy,
    showGroupHeaders = false,
    groupHeaderFormat = "Group: {groupName}",
    districtHeaderFormat = "District: {districtName}",
    subDistrictHeaderFormat = "Sub-District: {subDistrictName}",
    itemKey = 'id'
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const getItemId = (item: T): string => {
    return String(item[itemKey]);
  };
  
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

  const filteredItems = items.filter(item => 
    displayPattern(item).toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const groupedItems = groupBy ? groupBy(filteredItems) : null;
  const nestedGroupedItems = nestedGroupBy && useNestedGroups ? nestedGroupBy(filteredItems) : null;
  
  // Toggle all items (only enabled ones)
  const handleToggleAll = () => {
    const enabledItems = items.filter(item => !item.disabled);
    const enabledItemIds = enabledItems.map(item => getItemId(item));
    
    if (selectedItems.length === enabledItemIds.length && enabledItemIds.length > 0) {
      onSelectionChange([]);
    } else {
      onSelectionChange(enabledItemIds);
    }
  };

  // Toggle a single item (prevent if disabled)
  const handleToggleItem = (itemId: string, isDisabled?: boolean) => {
    if (!itemId || isDisabled) {
      return;
    }
    
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  };
  
  // Toggle all items in a group (only enabled ones)
  const handleToggleGroup = (groupItems: T[]) => {
    const enabledGroupItems = groupItems.filter(item => !item.disabled);
    const groupItemIds = enabledGroupItems.map(item => getItemId(item));
    const allSelected = groupItemIds.every(id => selectedItems.includes(id));
    
    if (allSelected) {
      onSelectionChange(selectedItems.filter(id => !groupItemIds.includes(id)));
    } else {
      const newSelection = [...selectedItems];
      groupItemIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      onSelectionChange(newSelection);
    }
  };
  
  const isGroupSelected = (groupItems: T[]) => {
    const enabledItems = groupItems.filter(item => !item.disabled);
    return enabledItems.length > 0 && enabledItems.every(item => selectedItems.includes(getItemId(item)));
  };
  
  const isGroupPartiallySelected = (groupItems: T[]) => {
    const enabledItems = groupItems.filter(item => !item.disabled);
    const selected = enabledItems.some(item => selectedItems.includes(getItemId(item)));
    return selected && !isGroupSelected(groupItems);
  };
  
  const getSelectedDisplay = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    } else {
      const enabledCount = items.filter(item => !item.disabled).length;
      if (selectedItems.length === enabledCount && enabledCount > 0) {
        return 'All Items Selected';
      } else {
        return `${selectedItems.length} Selected`;
      }
    }
  };

  const formatGroupHeader = (groupName: string) => {
    return groupHeaderFormat.replace('{groupName}', groupName);
  };

  const formatDistrictHeader = (districtName: string) => {
    return districtHeaderFormat.replace('{districtName}', districtName);
  };

  const formatSubDistrictHeader = (subDistrictName: string) => {
    return subDistrictHeaderFormat.replace('{subDistrictName}', subDistrictName);
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}:
      </label>
      <div 
        className={`p-2 border rounded-md cursor-pointer ${
          disabled 
            ? 'bg-blue-100 border-gray-300 cursor-not-allowed' 
            : 'border-blue-500 focus:ring-2 focus:ring-blue-500'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex justify-between items-center">
          <div className="text-sm truncate">
            {getSelectedDisplay()}
          </div>
          <div>
            <svg 
              className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-[9999] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search Input */}
          <div className="sticky top-0 bg-white p-2 border-b border-gray-200 z-10">
            <input
              type="text"
              className="w-full p-2 text-sm border border-gray-300 rounded-md"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Select All Option */}
          <div 
            className="p-2 hover:bg-gray-100 border-b border-gray-200 cursor-pointer w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleAll();
            }}
          >
            <div className="flex items-center space-x-2 w-full">
              <input
                type="checkbox"
                checked={selectedItems.length > 0 && selectedItems.length === items.filter(i => !i.disabled).length}
                onChange={() => {}}
                className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
              />
              <span className="text-sm font-medium">Select All</span>
            </div>
          </div>
          
          {/* Nested Grouped Items */}
          {useNestedGroups && nestedGroupedItems ? (
            Object.entries(nestedGroupedItems).sort(([a], [b]) => a.localeCompare(b)).map(([districtName, subDistrictGroups]) => (
              <div key={districtName} className="border-b border-gray-200 last:border-b-0">
                <div className="p-2 bg-gray-100 font-medium text-sm">
                  {formatDistrictHeader(districtName)}
                </div>
                
                {Object.entries(subDistrictGroups).sort(([a], [b]) => a.localeCompare(b)).map(([subDistrictName, villages]) => (
                  <div key={`${districtName}-${subDistrictName}`} className="border-t border-gray-100">
                    <div 
                      className="pl-4 p-2 bg-gray-50 hover:bg-gray-100 cursor-pointer w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleGroup(villages);
                      }}
                    >
                      <div className="flex items-center space-x-2 w-full">
                        <input
                          type="checkbox"
                          checked={isGroupSelected(villages)}
                          onChange={() => {}}
                          ref={input => {
                            if (input) {
                              input.indeterminate = isGroupPartiallySelected(villages);
                            }
                          }}
                          className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
                        />
                        <span className="text-sm font-medium">{formatSubDistrictHeader(subDistrictName)}</span>
                        <span className="text-xs text-gray-500">({villages.filter((v: any) => !v.disabled).length})</span>
                      </div>
                    </div>
                    
                    <div className="pl-8">
                      {villages.map((village: any) => {
                        const isDisabled = village.disabled || false;
                        return (
                          <div 
                            key={village.id}
                            className={`p-2 w-full ${isDisabled ? 'cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleItem(getItemId(village as T), isDisabled);
                            }}
                          >
                            <div className="flex items-center space-x-2 w-full">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(getItemId(village as T))}
                                disabled={isDisabled}
                                onChange={() => {}}
                                className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
                              />
                              <span className={`text-sm ${isDisabled ? 'text-gray-400' : ''}`}>
                                {displayPattern(village as unknown as T)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : groupedItems ? (
            // Standard Grouped items
            Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupItems]) => (
              <div key={groupName} className="border-b border-gray-200 last:border-b-0">
                {showGroupHeaders && (
                  <div className="p-2 bg-gray-100 font-medium text-sm">
                    {formatGroupHeader(groupName)}
                  </div>
                )}
                
                <div 
                  className={`p-2 ${showGroupHeaders ? 'pl-4 bg-gray-50' : 'bg-gray-50'} hover:bg-gray-100 cursor-pointer w-full`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleGroup(groupItems);
                  }}
                >
                  <div className="flex items-center space-x-2 w-full">
                    <input
                      type="checkbox"
                      checked={isGroupSelected(groupItems)}
                      onChange={() => {}}
                      ref={input => {
                        if (input) {
                          input.indeterminate = isGroupPartiallySelected(groupItems);
                        }
                      }}
                      className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
                    />
                    <span className="text-sm font-medium">{showGroupHeaders ? 'Select All' : groupName}</span>
                    <span className="text-xs text-gray-500">({groupItems.filter(i => !i.disabled).length})</span>
                  </div>
                </div>
                
                <div className={`${showGroupHeaders ? 'pl-8' : 'pl-6'}`}>
                  {groupItems.map(item => {
                    const isDisabled = item.disabled || false;
                    return (
                      <div 
                        key={getItemId(item)}
                        className={`p-2 w-full ${isDisabled ? 'cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleItem(getItemId(item), isDisabled);
                        }}
                      >
                        <div className="flex items-center space-x-2 w-full">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(getItemId(item))}
                            disabled={isDisabled}
                            onChange={() => {}}
                            className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
                          />
                          <span className={`text-sm ${isDisabled ? 'text-gray-400' : ''}`}>
                            {displayPattern(item)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            // Flat list of items
            filteredItems.map(item => {
              const isDisabled = item.disabled || false;
              return (
                <div 
                  key={getItemId(item)}
                  className={`p-2 w-full ${isDisabled ? 'cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleItem(getItemId(item), isDisabled);
                  }}
                >
                  <div className="flex items-center space-x-2 w-full">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(getItemId(item))}
                      disabled={isDisabled}
                      onChange={() => {}}
                      className="form-checkbox h-4 w-4 text-blue-600 pointer-events-none"
                    />
                    <span className={`text-sm ${isDisabled ? 'text-gray-400' : ''}`}>
                      {displayPattern(item)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          
          {filteredItems.length === 0 && (
            <div className="p-3 text-center text-gray-500 text-sm">
              No items found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
