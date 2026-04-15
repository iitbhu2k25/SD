'use client';

import React, { useState } from 'react';
import { useCategory } from '@/contexts/gwm/mar_suitability/admin/CategoryContext';
import { AiOutlineInfoCircle } from 'react-icons/ai';

const CategorySelector: React.FC = () => {
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
    isConstraintSelected,
  } = useCategory();

  const categories =
    activeTab === 'condition' ? condition_categories : constraint_categories;

  const selectedCategories =
    activeTab === 'condition' ? selectedCondition : selectedConstraint;

  const toggleCategory =
    activeTab === 'condition'
      ? toggleConditionCategory
      : toggleConstraintCategory;

  const selectAllCategories =
    activeTab === 'condition'
      ? selectAllConditionCategories
      : selectAllConstraintCategories;

  const clearAllCategories =
    activeTab === 'condition'
      ? clearAllConditionCategories
      : clearAllConstraintCategories;

  const isSelected =
    activeTab === 'condition'
      ? isConditionSelected
      : isConstraintSelected;

  const allSelected =
    categories.length === selectedCategories.length && categories.length > 0;

  const selectedCount = selectedCategories.length;

  /** 🔥 ONLY FOR CONDITION CATEGORIES */
  const importantCategories =
    activeTab === 'condition'
      ? categories.filter((c) => c.needed === 'Important')
      : [];

  const optionalCategories =
    activeTab === 'condition'
      ? categories.filter((c) => c.needed === 'Optional')
      : [];

  /** 🔹 FOR CONSTRAINT CATEGORIES (NORMAL SPLIT) */
  const firstHalf =
    activeTab === 'constraint'
      ? categories.slice(0, Math.ceil(categories.length / 2))
      : [];

  const secondHalf =
    activeTab === 'constraint'
      ? categories.slice(Math.ceil(categories.length / 2))
      : [];

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('condition')}
          className={`flex-1 py-3 font-medium ${
            activeTab === 'condition'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Condition Categories
        </button>

        <button
          onClick={() => setActiveTab('constraint')}
          className={`flex-1 py-3 font-medium ${
            activeTab === 'constraint'
              ? 'text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Constraint Categories
        </button>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">
          {activeTab === 'condition'
            ? 'Condition Categories'
            : 'Constraint Categories'}
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

      {/* Body */}
      <div className="p-4">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No {activeTab} categories available
          </div>
        ) : activeTab === 'condition' ? (
          /* ✅ CONDITION: split by needed */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CategoryColumn
              title="Important"
              categories={importantCategories}
              isSelected={isSelected}
              toggleCategory={toggleCategory}
            />

            <CategoryColumn
              title="Optional"
              categories={optionalCategories}
              isSelected={isSelected}
              toggleCategory={toggleCategory}
            />
          </div>
        ) : (
          /* ✅ CONSTRAINT: normal split */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CategoryColumn
              title=""
              categories={firstHalf}
              isSelected={isSelected}
              toggleCategory={toggleCategory}
            />

            <CategoryColumn
              title=""
              categories={secondHalf}
              isSelected={isSelected}
              toggleCategory={toggleCategory}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 p-3 text-sm text-gray-600 rounded-b-lg">
        {selectedCount} of {categories.length} {activeTab} categories selected
      </div>
    </div>
  );
};

/* 🔹 Reusable Column */
interface CategoryColumnProps {
  title?: string;
  categories: any[];
  isSelected: (id: number) => boolean;
  toggleCategory: (id: number, fileName: string) => void;
}

const CategoryColumn: React.FC<CategoryColumnProps> = ({
  title,
  categories,
  isSelected,
  toggleCategory,
}) => (
  <div className="space-y-3">
    {title && (
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
    )}

    {categories.map((category) => (
      <div key={category.id} className="flex items-start">
        <input
          type="checkbox"
          checked={isSelected(category.id)}
          onChange={() => toggleCategory(category.id, category.file_name)}
          className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-1"
        />

        <label className="ml-2 block p-2 rounded-md cursor-pointer hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {formatName(category.file_name)}
            </span>

            <div className="relative group">
              <AiOutlineInfoCircle
                size={18}
                className="text-gray-400 group-hover:text-blue-600"
              />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64
                              rounded-xl bg-white border border-gray-200
                              px-4 py-3 text-xs text-gray-600 shadow-lg
                              opacity-0 translate-y-1
                              group-hover:opacity-100 group-hover:translate-y-0
                              transition-all duration-150
                              pointer-events-none z-30">
                {category.details}
              </div>
            </div>
          </div>
        </label>
      </div>
    ))}
  </div>
);

const formatName = (fileName: string): string =>
  fileName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default CategorySelector;
