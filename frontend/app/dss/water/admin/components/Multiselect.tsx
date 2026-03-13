"use client";
import React, { useState, useRef, useEffect } from "react";
import { District, SubDistrict } from "@/interface/raster_context";

interface DropdownItem {
  id: number | string;
  name: string;
  [key: string]: any;
}

interface MultiSelectProps<T extends DropdownItem> {
  items: T[];
  selectedItems: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  label: string;
  placeholder: string;
  disabled?: boolean;
  displayPattern?: (item: T) => string;
  allowedIds?: number[];
}

export const MultiSelect = <
  T extends DropdownItem
>({
  items,
  selectedItems,
  onSelectionChange,
  label,
  placeholder,
  disabled = true,
  displayPattern = (item) => item.name,
  allowedIds,
}: MultiSelectProps<T>): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
    "bottom",
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const allItemIds = items.map((item) => Number(item.id));

  // Calculate selectable items based on allowedIds
  const selectableItemIds = allowedIds
    ? allItemIds.filter(id => allowedIds.includes(id))
    : allItemIds;

  // Check if all *selectable* items are selected
  const allSelected = selectableItemIds.length > 0 &&
    selectableItemIds.every(id => selectedItems.includes(id));

  // Filter items based on search query
  const filteredItems = items.filter(
    (item) =>
      displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );



  // Sort items: Allowed (alphabetical) -> Disabled (alphabetical)
  const sortedItems = [...filteredItems].sort((a, b) => {
    const isAllowedA = !allowedIds || allowedIds.includes(Number(a.id));
    const isAllowedB = !allowedIds || allowedIds.includes(Number(b.id));

    if (isAllowedA === isAllowedB) {
      return a.name.localeCompare(b.name);
    }
    return isAllowedA ? -1 : 1;
  });

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

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      // Reset position to default when closing
      setDropdownPosition("bottom");
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all *selectable* items
      // (Keep items that might be selected but not currently visible/selectable if that use case existed, 
      // but here we likely just want to clear the current selection context)
      // Simpler approach: Remove all selectable items from the current selection
      const newSelection = selectedItems.filter(id => !selectableItemIds.includes(id));
      onSelectionChange(newSelection);
    } else {
      // Select all *selectable* items
      // Merge current selection with all selectable items
      const newSelection = Array.from(new Set([...selectedItems, ...selectableItemIds]));
      onSelectionChange(newSelection);
    }
  };

  const handleItemSelect = (itemId: number) => {
    if (allowedIds && !allowedIds.includes(itemId)) {
      return;
    }

    if (selectedItems.includes(itemId)) {
      // Item is already selected, remove it
      onSelectionChange(selectedItems.filter((id) => id !== itemId));
    } else {
      // Item is not selected, add it
      onSelectionChange([...selectedItems, itemId]);
    }
  };

  const getDisplayText = () => {
    if (selectedItems.length === 0) {
      return placeholder;
    }

    if (allSelected && selectableItemIds.length === allItemIds.length) {
      return `All ${label}s`;
    }

    if (selectedItems.length === 1) {
      const selected = items.find((item) => item.id === selectedItems[0]);
      return selected ? displayPattern(selected) : placeholder;
    }

    return `${selectedItems.length} ${label}s selected`;
  };

  const getDropdownClasses = () => {
    const baseClasses =
      "absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto ";

    if (dropdownPosition === "top") {
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
        className={`w-full p-2 text-sm rounded-md flex justify-between items-center transition cursor-pointer

          ${selectedItems.length > 0
            ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
            : "border border-gray-300 bg-gray-100 text-gray-500"
          }

          hover:border-gray-400 hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-400

          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        onClick={toggleDropdown}
      >
        <span className={selectedItems.length === 0 ? "text-gray-400" : ""}>
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
          <div className="sticky top-0 p-2 border-b border-gray-200 bg-white ">
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
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 "
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
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select All option */}
          <div
            className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${allSelected ? "bg-blue-50" : ""
              }`}
            onClick={handleSelectAll}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="mr-2"
            />
            Select All Allowed {label}s
          </div>

          {/* No results message */}
          {filteredItems.length === 0 && (
            <div className="p-3 text-center text-gray-500">
              No {label}s found matching "{searchQuery}"
            </div>
          )}

          {/* Individual items */}
          {sortedItems.map((item) => {
            const isAllowed = !allowedIds || allowedIds.includes(Number(item.id));
            return (
              <div
                key={item.id}
                className={`p-2 cursor-pointer flex items-center
                  ${isAllowed ? "hover:bg-blue-100" : "opacity-50 cursor-not-allowed bg-gray-50"}
                  ${selectedItems.includes(Number(item.id)) ? "bg-blue-50" : ""}
                `}
                onClick={() => isAllowed && handleItemSelect(Number(item.id))}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.includes(Number(item.id))}
                  onChange={() => isAllowed && handleItemSelect(Number(item.id))}
                  disabled={!isAllowed}
                  className={`mr-2 ${!isAllowed ? "cursor-not-allowed opacity-50" : ""}`}
                />
                {displayPattern(item)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};



















// "use client";
// import React, { useState, useRef, useEffect } from "react";
// import { District, SubDistrict } from "@/interface/raster_context";

// // ─── Generic object-based variant (District / SubDistrict) ───────────────────

// interface MultiSelectProps<T> {
//   items: T[];
//   selectedItems: number[];
//   onSelectionChange: (selectedIds: number[]) => void;
//   label: string;
//   placeholder: string;
//   disabled?: boolean;
//   displayPattern?: (item: T) => string;
// }

// export const MultiSelect = <
//   T extends District | SubDistrict = District | SubDistrict,
// >({
//   items,
//   selectedItems,
//   onSelectionChange,
//   label,
//   placeholder,
//   disabled = true,
//   displayPattern = (item) => item.name,
// }: MultiSelectProps<T>): React.ReactElement => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
//     "bottom",
//   );
//   const dropdownRef = useRef<HTMLDivElement>(null);
//   const triggerRef = useRef<HTMLDivElement>(null);
//   const searchInputRef = useRef<HTMLInputElement>(null);
//   const allItemIds = items.map((item) => Number(item.id));
//   const allSelected = items.length > 0 && selectedItems.length === items.length;

//   const filteredItems = items.filter(
//     (item) =>
//       displayPattern(item).toLowerCase().includes(searchQuery.toLowerCase()) ||
//       item.name.toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         dropdownRef.current &&
//         !dropdownRef.current.contains(event.target as Node)
//       ) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     if (!isOpen) {
//       setSearchQuery("");
//       setDropdownPosition("bottom");
//     }
//   }, [isOpen]);

//   const toggleDropdown = () => {
//     if (!disabled) setIsOpen(!isOpen);
//   };

//   const handleSelectAll = () => {
//     onSelectionChange(allSelected ? [] : [...allItemIds]);
//   };

//   const handleItemSelect = (itemId: number) => {
//     if (selectedItems.includes(itemId)) {
//       onSelectionChange(selectedItems.filter((id) => id !== itemId));
//     } else {
//       onSelectionChange([...selectedItems, itemId]);
//     }
//   };

//   const getDisplayText = () => {
//     if (selectedItems.length === 0) return placeholder;
//     if (allSelected) return `All ${label}s`;
//     if (selectedItems.length === 1) {
//       const selected = items.find((item) => item.id === selectedItems[0]);
//       return selected ? displayPattern(selected) : placeholder;
//     }
//     return `${selectedItems.length} ${label}s selected`;
//   };

//   const getDropdownClasses = () => {
//     const base =
//       "absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto ";
//     return dropdownPosition === "top"
//       ? `${base} bottom-full mb-1`
//       : `${base} top-full mt-1`;
//   };

//   return (
//     <div className="relative" ref={dropdownRef}>
//       <label className="block text-sm font-semibold text-gray-700 mb-2">
//         {label}:
//       </label>
//       <div
//         ref={triggerRef}
//         className={`w-full p-2 text-sm rounded-md flex justify-between items-center transition cursor-pointer
//           ${
//             selectedItems.length > 0
//               ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
//               : "border border-gray-300 bg-gray-100 text-gray-500"
//           }
//           hover:border-gray-400 hover:shadow-sm
//           focus:outline-none focus:ring-2 focus:ring-blue-400
//           ${disabled ? "opacity-50 cursor-not-allowed" : ""}
//         `}
//         onClick={toggleDropdown}
//       >
//         <span className={selectedItems.length === 0 ? "text-gray-400" : ""}>
//           {getDisplayText()}
//         </span>
//         <svg
//           className="w-4 h-4 ml-2"
//           fill="none"
//           stroke="currentColor"
//           viewBox="0 0 24 24"
//           xmlns="http://www.w3.org/2000/svg"
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             strokeWidth="2"
//             d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
//           />
//         </svg>
//       </div>

//       {isOpen && !disabled && (
//         <div className={getDropdownClasses()}>
//           {/* Search box */}
//           <div className="sticky top-0 p-2 border-b border-gray-200 bg-white">
//             <div className="relative">
//               <input
//                 ref={searchInputRef}
//                 type="text"
//                 placeholder={`Search ${label}s...`}
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 onClick={(e) => e.stopPropagation()}
//               />
//               {searchQuery && (
//                 <button
//                   className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     setSearchQuery("");
//                   }}
//                 >
//                   <svg
//                     className="w-4 h-4"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M6 18L18 6M6 6l12 12"
//                     />
//                   </svg>
//                 </button>
//               )}
//             </div>
//           </div>

//           {/* Select All */}
//           <div
//             className={`p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
//               allSelected ? "bg-blue-50" : ""
//             }`}
//             onClick={handleSelectAll}
//           >
//             <input
//               type="checkbox"
//               checked={allSelected}
//               onChange={handleSelectAll}
//               className="mr-2"
//             />
//             All {label}s
//           </div>

//           {/* No results */}
//           {filteredItems.length === 0 && (
//             <div className="p-3 text-center text-gray-500">
//               No {label}s found matching &quot;{searchQuery}&quot;
//             </div>
//           )}

//           {/* Items */}
//           {filteredItems.map((item) => (
//             <div
//               key={item.id}
//               className={`p-2 hover:bg-blue-100 cursor-pointer ${
//                 selectedItems.includes(Number(item.id)) ? "bg-blue-50" : ""
//               }`}
//               onClick={() => handleItemSelect(Number(item.id))}
//             >
//               <input
//                 type="checkbox"
//                 checked={selectedItems.includes(Number(item.id))}
//                 onChange={() => handleItemSelect(Number(item.id))}
//                 className="mr-2"
//               />
//               {displayPattern(item)}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };


// // ─── Number/Year multi-select variant ────────────────────────────────────────

// interface NumberMultiSelectProps {
//   /** Plain number array, e.g. [2015, 2016, ..., 2024] */
//   items: number[];
//   selectedItems: number[];
//   onSelectionChange: (selected: number[]) => void;
//   label: string;
//   placeholder: string;
//   disabled?: boolean;
//   /** Optional formatter, defaults to String(n) */
//   displayPattern?: (n: number) => string;
// }

// export const NumberMultiSelect: React.FC<NumberMultiSelectProps> = ({
//   items,
//   selectedItems,
//   onSelectionChange,
//   label,
//   placeholder,
//   disabled = false,
//   displayPattern = (n) => String(n),
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const allSelected = items.length > 0 && selectedItems.length === items.length;
//   const someSelected = selectedItems.length > 0 && !allSelected;

//   const filteredItems = items.filter((n) =>
//     displayPattern(n).toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   // Close on outside click
//   useEffect(() => {
//     const handleClickOutside = (e: MouseEvent) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // Clear search on close
//   useEffect(() => {
//     if (!isOpen) setSearchQuery("");
//   }, [isOpen]);

//   const toggleDropdown = () => {
//     if (!disabled) setIsOpen((prev) => !prev);
//   };

//   const handleSelectAll = () => {
//     onSelectionChange(allSelected ? [] : [...items]);
//   };

//   const handleItemToggle = (n: number) => {
//     if (selectedItems.includes(n)) {
//       onSelectionChange(selectedItems.filter((v) => v !== n));
//     } else {
//       onSelectionChange([...selectedItems, n].sort((a, b) => a - b));
//     }
//   };

//   const getDisplayText = () => {
//     if (selectedItems.length === 0) return placeholder;
//     if (allSelected) return `All ${label}s`;
//     if (selectedItems.length === 1) return displayPattern(selectedItems[0]);
//     if (selectedItems.length <= 3)
//       return selectedItems
//         .slice()
//         .sort((a, b) => a - b)
//         .map(displayPattern)
//         .join(", ");
//     return `${selectedItems.length} ${label}s selected`;
//   };

//   return (
//     <div className="relative" ref={dropdownRef}>
//       <label className="block text-sm font-semibold text-gray-700 mb-2">
//         {label}:
//       </label>

//       {/* Trigger */}
//       <div
//         className={`w-full p-2 text-sm rounded-md flex justify-between items-center transition cursor-pointer
//           ${
//             selectedItems.length > 0
//               ? "border border-blue-500 bg-white text-gray-900 ring-2 ring-blue-300"
//               : "border border-gray-300 bg-gray-100 text-gray-500"
//           }
//           hover:border-gray-400 hover:shadow-sm
//           focus:outline-none focus:ring-2 focus:ring-blue-400
//           ${disabled ? "opacity-50 cursor-not-allowed" : ""}
//         `}
//         onClick={toggleDropdown}
//       >
//         <span className={selectedItems.length === 0 ? "text-gray-400" : ""}>
//           {getDisplayText()}
//         </span>
//         <svg
//           className="w-4 h-4 ml-2 flex-shrink-0"
//           fill="none"
//           stroke="currentColor"
//           viewBox="0 0 24 24"
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             strokeWidth="2"
//             d={isOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
//           />
//         </svg>
//       </div>

//       {/* Dropdown */}
//       {isOpen && !disabled && (
//         <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto top-full mt-1">

//           {/* Search */}
//           <div className="sticky top-0 p-2 border-b border-gray-200 bg-white">
//             <div className="relative">
//               <input
//                 type="text"
//                 placeholder={`Search ${label}s...`}
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="w-full p-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 onClick={(e) => e.stopPropagation()}
//               />
//               {searchQuery && (
//                 <button
//                   className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     setSearchQuery("");
//                   }}
//                 >
//                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
//                   </svg>
//                 </button>
//               )}
//             </div>
//           </div>

//           {/* Select All — with indeterminate support */}
//           <div
//             className={`flex items-center p-2 hover:bg-blue-100 cursor-pointer border-b border-gray-200 font-medium ${
//               allSelected ? "bg-blue-50" : ""
//             }`}
//             onClick={handleSelectAll}
//           >
//             <input
//               type="checkbox"
//               checked={allSelected}
//               ref={(el) => {
//                 if (el) el.indeterminate = someSelected;
//               }}
//               onChange={handleSelectAll}
//               className="mr-2 w-4 h-4 accent-blue-500 cursor-pointer"
//               onClick={(e) => e.stopPropagation()}
//             />
//             <span className="text-sm">All {label}s</span>
//             {someSelected && (
//               <span className="ml-auto text-xs text-gray-400 font-normal">
//                 {selectedItems.length} / {items.length}
//               </span>
//             )}
//             {allSelected && (
//               <span className="ml-auto text-xs text-blue-500 font-normal">
//                 All ({items.length})
//               </span>
//             )}
//           </div>

//           {/* No results */}
//           {filteredItems.length === 0 && (
//             <div className="p-3 text-center text-gray-500 text-sm">
//               No {label}s found matching &quot;{searchQuery}&quot;
//             </div>
//           )}

//           {/* Individual items */}
//           {filteredItems.map((n) => {
//             const isChecked = selectedItems.includes(n);
//             return (
//               <div
//                 key={n}
//                 className={`flex items-center p-2 hover:bg-blue-100 cursor-pointer ${
//                   isChecked ? "bg-blue-50" : ""
//                 }`}
//                 onClick={() => handleItemToggle(n)}
//               >
//                 <input
//                   type="checkbox"
//                   checked={isChecked}
//                   onChange={() => handleItemToggle(n)}
//                   className="mr-2 w-4 h-4 accent-blue-500 cursor-pointer"
//                   onClick={(e) => e.stopPropagation()}
//                 />
//                 <span className="text-sm text-gray-700">{displayPattern(n)}</span>
//                 {isChecked && (
//                   <span className="ml-auto text-blue-400 text-xs">✓</span>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// };