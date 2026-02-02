'use client'
import React from 'react';
import { useCategory } from '@/contexts/potential_zone/admin/CategoryContext';
import { AiOutlineInfoCircle } from 'react-icons/ai';

const CategorySelector: React.FC = () => {
  const {
    categories,
    selectedCategories,
    toggleCategory,
    selectAllCategories,
    clearAllCategories,
    isSelected
  } = useCategory();

  const allSelected =
    categories.length === selectedCategories.length && categories.length > 0;

  const selectedCount = selectedCategories.length;

  const firstHalf = categories.slice(0, Math.ceil(categories.length / 2));
  const secondHalf = categories.slice(Math.ceil(categories.length / 2));

  const CategoryItem = ({ category }: { category: any }) => {
    const selected = isSelected(category.id);

    return (
      <div
        className={`flex items-start rounded-lg transition-all duration-150
          ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}
        `}
      >
        <input
          type="checkbox"
          id={`category-${category.id}`}
          checked={selected}
          onChange={() => toggleCategory(category.id, category.file_name)}
          className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-3 ml-3"
        />

        <label
          htmlFor={`category-${category.id}`}
          className="flex-1 cursor-pointer px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {/* Category name */}
            <span
              className={`text-sm font-medium ${
                selected ? 'text-blue-700' : 'text-gray-700'
              }`}
            >
              {category.file_name}
            </span>

            {/* Info tooltip */}
            {category.details && (
              <div className="relative group">
                <AiOutlineInfoCircle
                  size={18}
                  className="text-gray-400 group-hover:text-blue-600 transition-colors"
                />

                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64
                             rounded-xl bg-white border border-gray-200
                             px-4 py-3 text-xs text-gray-600 shadow-lg
                             opacity-0 translate-y-1
                             group-hover:opacity-100 group-hover:translate-y-0
                             transition-all duration-150
                             pointer-events-none z-30"
                >
                  {category.details}
                </div>
              </div>
            )}
          </div>
        </label>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">
          Categories
        </h3>

        <div className="flex space-x-2">
          <button
            onClick={selectAllCategories}
            disabled={allSelected}
            className={`text-xs px-3 py-1 rounded-md ${
              allSelected
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            Select All
          </button>

          <button
            onClick={clearAllCategories}
            disabled={selectedCount === 0}
            className={`text-xs px-3 py-1 rounded-md ${
              selectedCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Category list */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 md:border-r md:pr-3 border-gray-200">
            {firstHalf.map(category => (
              <CategoryItem key={category.id} category={category} />
            ))}
          </div>

          <div className="space-y-3">
            {secondHalf.map(category => (
              <CategoryItem key={category.id} category={category} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 p-3 text-sm text-gray-600 rounded-b-lg">
        {selectedCount} of {categories.length} categories selected
      </div>
    </div>
  );
};

export default CategorySelector;
