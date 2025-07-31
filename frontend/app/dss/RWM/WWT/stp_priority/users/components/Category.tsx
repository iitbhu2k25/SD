'use client'
import React from 'react';
import { useCategory } from '@/contexts/stp_priority/admin/CategoryContext';

const CategorySelector: React.FC = () => {
  const {
    categories,
    selectedCategories,
    toggleCategory,
    selectAllCategories,
    clearAllCategories,
    isSelected
  } = useCategory();
  
  // Calculate if all categories are selected
  const allSelected = categories.length ===  selectedCategories.length && categories.length > 0;
  
  // Count selected categories
  const selectedCount =  selectedCategories.length;
  
  // Split categories for two columns
  const firstHalf = categories.slice(0, Math.ceil(categories.length / 2));
  const secondHalf = categories.slice(Math.ceil(categories.length / 2));
  
  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center text-gray-700">
          <i className="fas fa-list-ul mr-2"></i>
          Categories
        </h3>
        
        {/* Selection controls */}
        <div className="flex space-x-2">
          <button 
            onClick={selectAllCategories}
            disabled={allSelected}
            className={`text-xs px-3 py-1 rounded-md ${allSelected 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          >
            Select All
          </button>
          <button 
            onClick={clearAllCategories}
            disabled={selectedCount === 0}
            className={`text-xs px-3 py-1 rounded-md ${selectedCount === 0 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First column of categories */}
          <div className="space-y-3 md:border-r md:pr-3 border-gray-200">
            {firstHalf.map(category => (
              <div key={category.id} className="flex items-start">
                <input
                  type="checkbox"
                  id={`category-${category.id}`}
                  checked={isSelected(category.file_name)}
                  onChange={() => toggleCategory(category.file_name)}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-1"
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className={`ml-2 block rounded-md p-2 cursor-pointer hover:bg-gray-50 ${
                    isSelected(category.file_name) ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center">
            
                    <span className="text-sm">
                      {category.file_name} <span className="text-xs text-gray-500"></span>
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
          
          {/* Second column of categories */}
          <div className="space-y-3">
            {secondHalf.map(category => (
              <div key={category.id} className="flex items-start">
                <input
                  type="checkbox"
                  id={`category-${category.id}`}
                  checked={isSelected(category.file_name)}
                  onChange={() => toggleCategory(category.file_name)}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-1"
                />
                <label
                  htmlFor={`category-${category.id}`}
                  className={`ml-2 block rounded-md p-2 cursor-pointer hover:bg-gray-50 ${
                    isSelected(category.file_name) ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center">
                  
                    <span className="text-sm">
                      {category.file_name} <span className="text-xs text-gray-500"></span>
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Selection summary */}
      <div className="bg-gray-50 p-3 text-sm text-gray-600 rounded-b-lg">
        {selectedCount} of {categories.length} categories selected
      </div>
    </div>
  );
};

export default CategorySelector;