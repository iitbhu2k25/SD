'use client'
import React, { useState } from 'react';
import { useCategory } from '@/contexts/groundwaterIdent/admin/CategoryContext';

const CategorySelector: React.FC = () => {
  // State to track which category type is currently active
  const [activeTab, setActiveTab] = useState<'condition' | 'constraint'>('condition');
  
  const {
    condition_categories,
    constraint_categories,
    selectedCondition,
    selectedConstraint,
    toggleConditionCategory,
    toggleConstraintCategory,
    selectAllConditionCategories,
    clearAllConditionCategories,
    selectAllConstraintCategories,
    clearAllConstraintCategories,
    isConditionSelected,
    isConstraintSelected
  } = useCategory();
  
  // Get the active categories and functions based on the active tab
  const categories = activeTab === 'condition' ? condition_categories : constraint_categories;
  const selectedCategories = activeTab === 'condition' ? selectedCondition : selectedConstraint;
  const toggleCategory = activeTab === 'condition' ? toggleConditionCategory : toggleConstraintCategory;
  const selectAllCategories = activeTab === 'condition' ? selectAllConditionCategories : selectAllConstraintCategories;
  const clearAllCategories = activeTab === 'condition' ? clearAllConditionCategories : clearAllConstraintCategories;
  const isSelected = activeTab === 'condition' ? isConditionSelected : isConstraintSelected;
  
  // Calculate if all categories are selected
  const allSelected = categories.length === selectedCategories.length && categories.length > 0;
  
  // Count selected categories
  const selectedCount = selectedCategories.length;
  
  // Split categories for two columns
  const firstHalf = categories.slice(0, Math.ceil(categories.length / 2));
  const secondHalf = categories.slice(Math.ceil(categories.length / 2));
  
  return (
    <div className="bg-white rounded-lg shadow mb-6">

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('condition')}
          className={`flex-1 py-3 px-4 text-center font-medium ${
            activeTab === 'condition'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Condition Categories
        </button>
        <button
          onClick={() => setActiveTab('constraint')}
          className={`flex-1 py-3 px-4 text-center font-medium ${
            activeTab === 'constraint'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Constraint Categories
        </button>
      </div>
      
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center text-gray-700">
          <i className="fas fa-list-ul mr-2"></i>
          {activeTab === 'condition' ? 'Condition Categories' : 'Constraint Categories'}
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
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No {activeTab} categories available
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First column of categories */}
            <div className="space-y-3 md:border-r md:pr-3 border-gray-200">
              {firstHalf.map(category => (
                <div key={category.id} className="flex items-start">
                  <input
                    type="checkbox"
                    id={`${activeTab}-category-${category.id}`}
                    checked={isSelected(category.id)}
                    onChange={() => toggleCategory(category.id,category.file_name)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-1"
                  />
                  <label
                    htmlFor={`${activeTab}-category-${category.id}`}
                    className={`ml-2 block rounded-md p-2 cursor-pointer hover:bg-gray-50 ${
                      isSelected(category.id) ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-sm font-medium">
                        {formatName(category.file_name)}
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
                    id={`${activeTab}-category-${category.id}`}
                    checked={isSelected(category.id)}
                    onChange={() => toggleCategory(category.id,category.file_name)}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-1"
                  />
                  <label
                    htmlFor={`${activeTab}-category-${category.id}`}
                    className={`ml-2 block rounded-md p-2 cursor-pointer hover:bg-gray-50 ${
                      isSelected(category.id) ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-sm font-medium">
                        {formatName(category.file_name)}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Selection summary */}
      <div className="bg-gray-50 p-3 text-sm text-gray-600 rounded-b-lg">
        {selectedCount} of {categories.length} {activeTab} categories selected
      </div>
    </div>
  );
};

// Helper function to format file_name into a readable name
const formatName = (fileName: string): string => {
  return fileName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default CategorySelector;