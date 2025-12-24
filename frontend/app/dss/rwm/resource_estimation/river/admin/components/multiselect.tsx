"use client";
import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
  disabled?: boolean; 
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
  label = "Options",
  placeholder = "--Choose Options--",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
    "bottom"
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const allowedOptions = filteredOptions.filter(o => !o.disabled);

  const allSelected =
  allowedOptions.length > 0 &&
  selectedValues.length === allowedOptions.length;


  // Calculate dropdown position based on available space
  const calculateDropdownPosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 240; // max-h-60 = 15rem = 240px

    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      setDropdownPosition("top");
    } else {
      setDropdownPosition("bottom");
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDropdownPosition("bottom");
    } else {
      calculateDropdownPosition();
      // Focus search input when dropdown opens
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
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
    onChange([]);
  } else {
    onChange(allowedOptions.map(o => o.value));
  }
};

  // Handle individual option selection
  const handleOptionSelect = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((val) => val !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  // Format display text
  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }

    if (allSelected) {
      return `All ${label}s`;
    }

    if (selectedValues.length === 1) {
      const selected = options.find(
        (option) => option.value === selectedValues[0]
      );
      return selected ? selected.label : placeholder;
    }

    return `${selectedValues.length} ${label}s selected`;
  };

  // Get dropdown positioning classes
  const getDropdownClasses = () => {
    const baseClasses =
      "absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto";

    if (dropdownPosition === "top") {
      return `${baseClasses} bottom-full mb-1`;
    } else {
      return `${baseClasses} top-full mt-1`;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}:
        </label>
      )}
      <div
        ref={triggerRef}
        className={`w-full p-2 text-sm border border-blue-500 rounded-md flex justify-between items-center cursor-pointer ${
          disabled
            ? "bg-gray-100 cursor-not-allowed"
            : "bg-white hover:border-blue-600"
        }`}
        onClick={toggleDropdown}
      >
        <span className={selectedValues.length === 0 ? "text-gray-400" : ""}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
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
                    setSearchQuery("");
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All option */}
          {options.length > 0 && (
            <div
              className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
                allSelected ? "bg-blue-50" : ""
              }`}
              onClick={handleSelectAll}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={handleSelectAll}
                className="mr-2"
              />
              All {label}s
            </div>
          )}

          {/* No results message */}
          {filteredOptions.length === 0 && (
            <div className="p-3 text-center text-gray-500">
              {searchQuery
                ? `No ${label}s found matching "${searchQuery}"`
                : `No ${label}s available`}
            </div>
          )}

          {/* Individual options */}
          {filteredOptions.map((option) => {
            const isDisabled = option.disabled;

            return (
              <div
                key={option.value}
                className={`p-2 cursor-pointer ${
                  isDisabled
                    ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                    : "hover:bg-blue-100"
                } ${
                  selectedValues.includes(option.value)
                    ? !isDisabled
                      ? "bg-blue-50"
                      : ""
                    : ""
                }`}
                onClick={() => {
                  if (!isDisabled) handleOptionSelect(option.value);
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() =>
                    !isDisabled && handleOptionSelect(option.value)
                  }
                  disabled={isDisabled}
                  className="mr-2"
                />
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
