'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { DataRow } from '@/interface/table';
import { api } from '@/services/api';


export interface Category {
  id: number;
  file_name: string;
  weight: number;
}

export interface SelectRasterLayer {
  file_name: string;
  Influence: number;
  weight?: number;
  priority?: number;
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
  toggleCategory: (file_name: string) => void;
  updateCategoryInfluence: (file_name: string, influence: number) => void;
  updateCategoryWeight: (file_name: string, weight: number) => void;
  selectAllCategories: () => void;
  clearAllCategories: () => void;
  
  // Category utilities
  isSelected: (file_name: string) => boolean;
  getCategoryInfluence: (file_name: string) => number;
  getCategoryWeight: (file_name: string) => number;
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
  maxCategories = 100
}: CategoryProviderProps) => {

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryItems, setSelectedCategoryItems] = useState<SelectRasterLayer[]>([]);
  const [stpProcess, setStpProcess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DataRow[]>([]);
  const [showTable, setShowTable] = useState<boolean>(false);



  const calculateWeights = useCallback((categories: SelectRasterLayer[]): SelectRasterLayer[] => {
    if (categories.length === 0) return [];
    
    const totalInfluence = categories.reduce((sum, category) => sum + category.Influence, 0);
  
    if (totalInfluence === 0) {
      const equalWeight = parseFloat((1 / categories.length).toFixed(4));
      return categories.map(category => ({
        ...category,
        weight: equalWeight
      }));
    }
    
    return categories.map((category, index) => {
      const weight = parseFloat((category.Influence / totalInfluence).toFixed(4));
      return {
        ...category,
        weight,
        priority: index + 1
      };
    });
  }, []);

  const selectedCategories = useMemo(() => {
    return calculateWeights(selectedCategoryItems);
  }, [selectedCategoryItems, calculateWeights]);

  const fetchCategories = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get('/gwz_operation/get_gwz_category?all_data=true'); 
      if (response.status != 201) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data =response.message as Category[];
      

      const validatedData = data.filter(item => 
        item && 
        typeof item.file_name === 'string' && 
        item.file_name.length > 0 &&
        typeof item.weight === 'number' && 
        item.weight >= 0
      );
      
      setCategories(validatedData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories';
      setError(errorMessage);
      console.log('Error fetching categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshCategories = useCallback(async (): Promise<void> => {
    await fetchCategories();
  }, [fetchCategories]);

  const toggleCategory = useCallback((file_name: string): void => {
    setSelectedCategoryItems(prev => {
      const isSelected = prev.some(item => item.file_name === file_name);
      
      let newSelection: SelectRasterLayer[];
      
      if (isSelected) {
        // Remove if already selected
        newSelection = prev.filter(item => item.file_name !== file_name);
      } else {
        // Check max categories limit
        if (prev.length >= maxCategories) {
          setError(`Maximum ${maxCategories} categories can be selected`);
          return prev;
        }
        
        // Add with default weight from categories
        const category = categories.find(cat => cat.file_name === file_name);
        if (category) {
          newSelection = [...prev, { 
            file_name, 
            Influence: category.weight,
            weight: 0, // Will be calculated
            priority: prev.length + 1
          }];
        } else {
          setError(`Category ${file_name} not found`);
          return prev;
        }
      }
      
      
      
      return newSelection;
    });
  }, [categories, maxCategories]);

  const updateCategoryInfluence = useCallback((file_name: string, influence: number): void => {
    // Clamp influence between 0 and 100
    const clampedInfluence = Math.min(Math.max(influence, 0), 100);
    
    setSelectedCategoryItems(prev => {
      const categoryIndex = prev.findIndex(item => item.file_name === file_name);
      
      if (categoryIndex !== -1) {
        // Update existing category influence
        const updatedCategories = [...prev];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          Influence: clampedInfluence
        };
        
        
        
        return updatedCategories;
      } else {
        // Add category with custom influence if not already selected
        const category = categories.find(cat => cat.file_name === file_name);
        if (category) {
          const newSelection = [...prev, { 
            file_name, 
            Influence: clampedInfluence,
            weight: 0,
            priority: prev.length + 1
          }];
          
  
          
          return newSelection;
        }
        return prev;
      }
    });
  }, [categories]);

  const updateCategoryWeight = useCallback((file_name: string, weight: number): void => {
    const clampedWeight = Math.min(Math.max(weight, 0), 1);
    
    setSelectedCategoryItems(prev => {
      const categoryIndex = prev.findIndex(item => item.file_name === file_name);
      
      if (categoryIndex !== -1) {
        const updatedCategories = [...prev];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          weight: clampedWeight
        };
        return updatedCategories;
      }
      return prev;
    });
  }, []);

  const selectAllCategories = useCallback((): void => {
    const limitedCategories = categories.slice(0, maxCategories);
    const allCategories = limitedCategories.map((category, index) => ({
      file_name: category.file_name,
      Influence: category.weight,
      weight: 0,
      priority: index + 1
    }));
    
    setSelectedCategoryItems(allCategories);
    
    
    if (categories.length > maxCategories) {
      setError(`Only first ${maxCategories} categories selected due to limit`);
    }
  }, [categories, maxCategories]);

  const clearAllCategories = useCallback((): void => {
    setSelectedCategoryItems([]);
    
  },[]);



  const isSelected = useCallback((file_name: string): boolean => {
    return selectedCategoryItems.some(item => item.file_name === file_name);
  }, [selectedCategoryItems]);

  const getCategoryInfluence = useCallback((file_name: string): number => {
    const selectedCategory = selectedCategoryItems.find(item => item.file_name === file_name);
    if (selectedCategory) {
      return selectedCategory.Influence;
    }
    
    const defaultCategory = categories.find(cat => cat.file_name === file_name);
    return defaultCategory ? defaultCategory.weight : 0;
  }, [selectedCategoryItems, categories]);

  const getCategoryWeight = useCallback((file_name: string): number => {
    const selectedCategory = selectedCategories.find(item => item.file_name === file_name);
    return selectedCategory?.weight ?? 0;
  }, [selectedCategories]);

  const getSelectedCategoriesWithWeights = useCallback((): SelectRasterLayer[] => {
    return selectedCategories;
  }, [selectedCategories]);

  const validateSelection = useCallback((): { isValid: boolean; message?: string } => {
    if (selectedCategories.length === 0) {
      return { isValid: false, message: 'Please select at least one category' };
    }
    
    if (selectedCategories.length > maxCategories) {
      return { isValid: false, message: `Maximum ${maxCategories} categories allowed` };
    }
    
    const totalWeight = selectedCategories.reduce((sum, cat) => sum + (cat.weight || 0), 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      return { isValid: false, message: 'Category weights must sum to 1.0' };
    }
    
    return { isValid: true };
  }, [selectedCategories, maxCategories]);

  const exportSelectedCategories = useCallback((): string => {
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
  }, [selectedCategories, categories.length]);

  const importSelectedCategories = useCallback((data: string): boolean => {
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
  }, [categories]);


  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);


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
    updateCategoryWeight,
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


export const useCategoryValidation = () => {
  const { selectedCategories, validateSelection } = useCategory();
  
  return useMemo(() => {
    const validation = validateSelection();
    return {
      ...validation,
      hasSelection: selectedCategories.length > 0,
      selectionCount: selectedCategories.length,
      totalWeight: selectedCategories.reduce((sum, cat) => sum + (cat.weight || 0), 0)
    };
  }, [selectedCategories, validateSelection]);
};

export const useCategoryStats = () => {
  const { categories, selectedCategories } = useCategory();
  
  return useMemo(() => {
    return {
      totalCategories: categories.length,
      selectedCount: selectedCategories.length,
      selectionPercentage: categories.length > 0 ? (selectedCategories.length / categories.length) * 100 : 0,
      averageInfluence: selectedCategories.length > 0 
        ? selectedCategories.reduce((sum, cat) => sum + cat.Influence, 0) / selectedCategories.length 
        : 0,
      maxInfluence: selectedCategories.length > 0 
        ? Math.max(...selectedCategories.map(cat => cat.Influence)) 
        : 0,
      minInfluence: selectedCategories.length > 0 
        ? Math.min(...selectedCategories.map(cat => cat.Influence)) 
        : 0
    };
  }, [categories, selectedCategories]);
};