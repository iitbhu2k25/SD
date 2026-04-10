'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import { SelectRasterLayer } from "@/interface/raster_context"
import { DataRow } from '@/interface/table';
import { api } from '@/services/api';


export interface Category {
  id: number;
  file_name: string;
  weight: number;
  details: string;
}


export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

interface CategoryContextType {
  // Core data
  categories: Category[];
  selectedCategories: SelectRasterLayer[];

  // Category management
  toggleCategory: (id: number, file_name: string) => void;
  updateCategoryInfluence: (id: number, file_name: string, influence: number) => void;

  selectAllCategories: () => void;
  clearAllCategories: () => void;

  // Category utilities
  isSelected: (id: number) => boolean;
  getCategoryInfluence: (id: number) => number;
  getCategoryWeight: (id: number) => number;
  getSelectedCategoriesWithWeights: () => SelectRasterLayer[];

  // Process management
  stpProcess: boolean;
  setStpProcess: (value: boolean) => void;

  // Loading and error states
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;

  // Table management
  showTable: boolean;
  setShowTable: (value: boolean) => void;
  tableData: DataRow[];
  setTableData: (value: DataRow[]) => void;

  // API functions
  refreshCategories: () => Promise<void>;
  exportSelectedCategories: () => string;
  importSelectedCategories: (data: string) => boolean;

  // Validation
  validateSelection: () => { isValid: boolean; message?: string };
}

interface CategoryProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
  enableAutoSave?: boolean;
  maxCategories?: number;
}


const CategoryContext = createContext<CategoryContextType | undefined>(undefined);


export const CategoryProvider = ({
  children,
  maxCategories = 10
}: CategoryProviderProps) => {

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<SelectRasterLayer[]>([]);
  const [stpProcess, setStpProcess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DataRow[]>([]);
  const [showTable, setShowTable] = useState<boolean>(false);



  // Calculate weights for all selected categories
  const calculateWeights = (categories: SelectRasterLayer[]): SelectRasterLayer[] => {
    if (categories.length === 0) return [];

    // Calculate sum of all influences
    const totalInfluence = categories.reduce((sum, category) => {
      return sum + parseFloat(category.Influence);
    }, 0);

    // If sum is 0, assign equal weights
    if (totalInfluence === 0) {
      const equalWeight = (1 / categories.length).toFixed(4);
      return categories.map(category => ({
        ...category,
        weight: equalWeight
      }));
    }

    // Calculate weight for each category
    return categories.map(category => {
      const weight = (parseFloat(category.Influence) / totalInfluence).toFixed(4);
      return {
        ...category,
        weight
      };
    });
  };

  // Memoize selected categories with weights to avoid recalculation on every render
  const selectedCategories = useMemo(() => {
    return calculateWeights(selectedCategoryItems);
  }, [selectedCategoryItems]);

  const fetchCategories = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/stp_operation/get_priority_category?all_data=true');
      if (response.status != 201) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = response.message as Category[];


      const validatedData = data.filter(item =>
        item &&
        typeof item.file_name === 'string' &&
        item.file_name.length > 0 &&
        typeof item.weight === 'number' &&
        item.weight >= 0
      );
      console.log("")
      setCategories(validatedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
      setError(errorMessage);
      console.log('Error fetching categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCategories = async (): Promise<void> => {
    await fetchCategories();
  };

  const toggleCategory = (id: number, file_name: string): void => {
    setSelectedCategoryItems(prev => {
      // Find if the id already exists in the selection
      const isSelected = prev.some(item => item.id === id);

      if (isSelected) {
        // Remove it if already selected
        return prev.filter(item => item.id !== id);
      } else {
        // Add it with default weight from the categories
        const category = categories.find(cat => cat.id === id);
        if (category) {
          return [...prev, { id, file_name, Influence: category.weight.toString() }];
        } else {
          return prev;
        }
      }
    });
  };


  const updateCategoryInfluence = (id: number, file_name: string, Influence: number): void => {
    // Clamp influence between 0 and 100
    const clampedInfluence = Math.min(Math.max(Influence, 0), 100);

    setSelectedCategoryItems(prev => {
      const categoryIndex = prev.findIndex(item => item.id === id);
      if (categoryIndex !== -1) {
        // Update existing category influence
        const updatedCategories = [...prev];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          Influence: clampedInfluence.toString()
        };
        return updatedCategories;
      } else {
        // Add category with custom influence if not already selected
        const category = categories.find(cat => cat.id === id);
        if (category) {
          return [...prev, { id, file_name, Influence: clampedInfluence.toString() }];
        } else {
          return prev;
        }
      }
    });
  };

  const selectAllCategories = (): void => {
    const allCategories = categories.map(category => ({
      id: category.id,
      file_name: category.file_name,
      Influence: category.weight.toString()
    }));

    setSelectedCategoryItems(allCategories);

  };


  const clearAllCategories = (): void => {
    setSelectedCategoryItems([]);
  };



  // Check if a category is selected by id (matching STP suitability pattern)
  const isSelected = (id: number): boolean => {
    return selectedCategoryItems.some(item => item.id === id);
  };

  const getCategoryInfluence = (id: number): number => {
    const selectedCategory = selectedCategoryItems.find(item => item.id === id);
    if (selectedCategory) {
      return parseFloat(selectedCategory.Influence);
    }

    const defaultCategory = categories.find(cat => cat.id === id);
    return defaultCategory ? defaultCategory.weight : 0;
  };

  const getCategoryWeight = (id: number): number => {
    const selectedCategory = selectedCategories.find(item => item.id === id);
    if (selectedCategory && selectedCategory.weight) {
      return parseFloat(selectedCategory.weight);
    }
    return 0;
  };


  const getSelectedCategoriesWithWeights = (): SelectRasterLayer[] => {
    return selectedCategories;
  };

  const validateSelection = (): { isValid: boolean; message?: string } => {
    if (selectedCategories.length === 0) {
      return { isValid: false, message: 'Please select at least one category' };
    }

    if (selectedCategories.length > maxCategories) {
      return { isValid: false, message: `Maximum ${maxCategories} categories allowed` };
    }



    return { isValid: true };
  };

  const exportSelectedCategories = (): string => {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      categories: selectedCategories,
      metadata: {
        totalCategories: categories.length,
        selectedCount: selectedCategories.length
      }
    };
    return JSON.stringify(exportData, null, 2);
  };

  const importSelectedCategories = (data: string): boolean => {
    try {
      const importData = JSON.parse(data);

      if (importData.categories && Array.isArray(importData.categories)) {
        // Validate imported categories exist in current categories
        const validCategories = importData.categories.filter((imported: SelectRasterLayer) =>
          categories.some(cat => cat.file_name === imported.file_name)
        );

        setSelectedCategoryItems(validCategories);


        return true;
      }
      return false;
    } catch (e) {
      setError('Failed to import categories: Invalid format');
      return false;
    }
  };


  useEffect(() => {
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);



  const contextValue: CategoryContextType = {
    // Core data
    categories,
    selectedCategories,

    // Category management
    toggleCategory,
    updateCategoryInfluence,

    selectAllCategories,
    clearAllCategories,

    // Category utilities
    isSelected,
    getCategoryInfluence,
    getCategoryWeight,
    getSelectedCategoriesWithWeights,

    // Process management
    stpProcess,
    setStpProcess,

    // Loading and error states
    isLoading,
    error,
    setError,

    // Table management
    showTable,
    setShowTable,
    tableData,
    setTableData,

    // API functions
    refreshCategories,
    exportSelectedCategories,
    importSelectedCategories,

    // Validation
    validateSelection
  };

  return (
    <CategoryContext.Provider value={contextValue}>
      {children}
    </CategoryContext.Provider>
  );
};



export const useCategory = (): CategoryContextType => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};