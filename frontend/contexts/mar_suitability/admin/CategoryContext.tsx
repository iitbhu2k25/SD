'use client'
import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import { DataRow } from '@/interface/table';
import { api } from '@/services/api';
// Define types
export interface Category {
  id: number;
  file_name: string;
  weight: number;
  raster_category: string;
}

// Interface for raster layer selection with added weight field
export interface SelectRasterLayer {
  file_name: string;
  Influence: string;
  weight?: string;
  id: number; 
}

export interface Stp_area{
  tech_name:string;
  tech_value:number;
  id:number
}
export interface RasterLayer{
  workspace: string;
  layer_name: string;
}
interface CategoryContextType {
  condition_categories: Category[];
  constraint_categories: Category[];
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  toggleConditionCategory: (id:number, file_name:string) => void;
  toggleConstraintCategory: (id:number, file_name:string) => void;
  updateConditionCategoryInfluence: (id:number,file_name:string, Influence: number) => void;
  updateConstraintCategoryInfluence: (id:number,file_name:string, Influence: number) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  isConditionSelected: (id:number) => boolean;
  isConstraintSelected: (id:number) => boolean;
  getConditionCategoryInfluence: (id:number) => number;
  getConstraintCategoryInfluence: (id:number) => number;
  getConditionCategoryWeight: (id:number) => number;
  getConstraintCategoryWeight: (id:number) => number;
  selectedCategory: SelectRasterLayer[];
  setSelectedCategory: (category: SelectRasterLayer[]) => void;
  isLoading: boolean;
  error: string | null;
  showTable: boolean;
  setShowTable: (value: boolean) => void;
  tableData: DataRow[];
  setTableData: (value: DataRow[]) => void;
  StpArea:Stp_area[];
  OptSetStpArea:(Stp_area:Stp_area)=>void
  setFindArea:(value:boolean)=>void
  rasterLayerInfo: RasterLayer | null;
  setRasterLayerInfo: (info: RasterLayer) => void;
}

interface CategoryProviderProps {
  children: ReactNode;
}

// Create context with default undefined value
const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

// Category provider component
export const CategoryProvider = ({ children }: CategoryProviderProps) => {
  const [conditionCategories, setConditionCategories] = useState<Category[]>([]);
  const [constraintCategories, setConstraintCategories] = useState<Category[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<SelectRasterLayer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SelectRasterLayer[]>([]);
  const [selectedConstraint, setSelectedConstraint] = useState<SelectRasterLayer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DataRow[]>([]);
  const [showTable, setShowTable] = useState<boolean>(false);
  const [StpArea,SetStpArea]= useState<Stp_area[]>([])
  const [OptStpArea,OptSetStpArea]=useState<Stp_area>()
  const [findArea,setFindArea]=useState<boolean>(false)
  const [rasterLayerInfo, setRasterLayerInfo] = useState<RasterLayer>();

  // Fetch condition categories from API
  useEffect(() => {
    const fetchConditionCategories = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/gwz_operation/get_mar_suitability_category?category=condition&all_data=true")
        if (response.status != 201) {
          throw new Error('Failed to fetch condition categories');
        }
        const data = await response.message as Category[];
        console.log("Condition Data:", data);
        
        // Enhance the categories with default icons and colors if not provided
        const enhancedCategories = data.map((category: Category) => ({
          ...category,
        }));
        
        setConditionCategories(enhancedCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.log('Error fetching condition categories:', err);
      } finally {
        // Don't set isLoading to false here, wait for both fetch operations
      }
    };

    // Fetch constraint categories from API
    const fetchConstraintCategories = async () => {
      try {
        const response = await api.get("/gwz_operation/get_mar_suitability_category?category=constraint&all_data=true") 
        if (response.status != 201) {
          throw new Error('Failed to fetch condition categories');
        }
        const data = await response.message as Category[];
        console.log("Condition Data:", data);
        
        // Enhance the categories with default icons and colors if not provided
        const enhancedCategories = data.map((category: Category) => ({
          ...category,
        }));
        
        setConstraintCategories(enhancedCategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.log('Error fetching constraint categories:', err);
      } finally {

      }
    };
   

    // Execute both fetch operations and set loading to false when completed
    Promise.all([fetchConditionCategories(), fetchConstraintCategories()])
      .finally(() => {
        setIsLoading(false);
      });
  }, []);



  
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
  const selectedConditionWithWeights = useMemo(() => {
    return calculateWeights(selectedCondition);
  }, [selectedCondition]);

  const selectedConstraintWithWeights = useMemo(() => {
    return calculateWeights(selectedConstraint);
  }, [selectedConstraint]);
  
  // Toggle a condition category selection
  const toggleConditionCategory = (id:number,file_name:string): void => {
    setSelectedCondition(prev => {
      
      const isSelected = prev.some(item => item.id === id);
      if (isSelected) {
        // Remove it if already selected
        return prev.filter(item => item.id !== id);
      } else {
        // Add it with default weight from the categories
        const category = conditionCategories.find(cat => cat.id === id);
        if (category) {
          return [...prev, { id,file_name, Influence: category.weight.toString() }];
        } else {
          return prev;
        }
      }
    });
  };

  // Toggle a constraint category selection
  const toggleConstraintCategory = (id:number,file_name:string): void => {
    setSelectedConstraint(prev => {
      // Find if the file_name already exists in the selection
      const isSelected = prev.some(item => item.id === id);
      
       if (isSelected) {
        // Remove it if already selected
        return prev.filter(item => item.id !== id);
      } else {
        // Add it with default weight from the categories
        const category = constraintCategories.find(cat => cat.id === id);
        if (category) {
          return [...prev, { id,file_name, Influence: category.weight.toString() }];
        } else {
          return prev;
        }
      }
    });
  };
  
  // Update the Influence of a condition category (for slider)
  const updateConditionCategoryInfluence = (id:number, file_name:string, Influence: number): void => {
    // Ensure Influence is between 0 and 100
    const clampedInfluence = Math.min(Math.max(Influence, 0), 100);
    
    setSelectedCondition(prev => {
      const categoryIndex = prev.findIndex(item => item.id === id);
      
      if (categoryIndex !== -1) {
        // Update existing category Influence
        const updatedCategories = [...prev];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          Influence: clampedInfluence.toString()
        };
        return updatedCategories;
      } else {
        // Add category with custom Influence if not already selected
        const category = conditionCategories.find(cat => cat.id === id);
        if (category) {
          return [...prev, {id,file_name, Influence: clampedInfluence.toString() }];
        } else {
          return prev;
        }
      }
    });
  };

  // Update the Influence of a constraint category (for slider)
  const updateConstraintCategoryInfluence = (id:number, file_name:string, Influence: number): void => {
    // Ensure Influence is between 0 and 100
    const clampedInfluence = Math.min(Math.max(Influence, 0), 100);
    
    setSelectedConstraint(prev => {
      const categoryIndex = prev.findIndex(item => item.id === id);
      
      if (categoryIndex !== -1) {
        // Update existing category Influence
        const updatedCategories = [...prev];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          Influence: clampedInfluence.toString()
        };
        return updatedCategories;
      } else {
        // Add category with custom Influence if not already selected
        const category = constraintCategories.find(cat => cat.id === id);
        if (category) {
          return [...prev, {id, file_name, Influence: clampedInfluence.toString() }];
        } else {
          return prev;
        }
      }
    });
  };
  
  // Get the current Influence of a condition category (for slider value)
  const getConditionCategoryInfluence = (id:number): number => {
    const selectedCategory = selectedCondition.find(item => item.id === id);
    if (selectedCategory) {
      return parseFloat(selectedCategory.Influence);
    }
    
    // Return default weight if category not selected
    const defaultCategory = conditionCategories.find(cat => cat.id === id);
    return defaultCategory ? defaultCategory.weight : 0;
  };

  // Get the current Influence of a constraint category (for slider value)
  const getConstraintCategoryInfluence = (id:number): number => {
    const selectedCategory = selectedConstraint.find(item => item.id === id);
    if (selectedCategory) {
      return parseFloat(selectedCategory.Influence);
    }
    
    // Return default weight if category not selected
    const defaultCategory = constraintCategories.find(cat => cat.id === id);
    return defaultCategory ? defaultCategory.weight : 0;
  };
  
  // Get the current weight of a condition category
  const getConditionCategoryWeight = (id:number): number => {
    const selectedCategory = selectedConditionWithWeights.find(item => item.id === id);
    if (selectedCategory && selectedCategory.weight) {
      return parseFloat(selectedCategory.weight);
    }
    return 0;
  };

  // Get the current weight of a constraint category
  const getConstraintCategoryWeight = (id:number): number => {
    const selectedCategory = selectedConstraintWithWeights.find(item => item.id === id);
    if (selectedCategory && selectedCategory.weight) {
      return parseFloat(selectedCategory.weight);
    }
    return 0;
  };
  
  // Select all condition categories
  const selectAllConditionCategories = (): void => {
    const allCategories = conditionCategories.map(category => ({
      id :category.id,
      file_name: category.file_name,
      Influence: category.weight.toString()
    }));
    
    setSelectedCondition(allCategories);
  };

  // Select all constraint categories
  const selectAllConstraintCategories = (): void => {
    const allCategories = constraintCategories.map(category => ({
      id: category.id,
      file_name: category.file_name,
      Influence: category.weight.toString()
    }));
    
    setSelectedConstraint(allCategories);
  };
  
  // Clear all selected condition categories
  const clearAllConditionCategories = (): void => {
    setSelectedCondition([]);
  };

  // Clear all selected constraint categories
  const clearAllConstraintCategories = (): void => {
    setSelectedConstraint([]);
  };
  
  // Check if a condition category is selected
  const isConditionSelected = (id: number): boolean => {
    return selectedCondition.some(item => item.id === id);
  };

  // Check if a constraint category is selected
  const isConstraintSelected = (id: number): boolean => {
    return selectedConstraint.some(item => item.id === id);
  };
  
  // Context value - FIXED: Use memoized selected categories with weights
  const contextValue: CategoryContextType = {
    condition_categories: conditionCategories,
    constraint_categories: constraintCategories,
    selectedCondition: selectedConditionWithWeights, // Fixed: Use memoized version
    selectedConstraint: selectedConstraintWithWeights, // Fixed: Use memoized version
    selectedCategory,
    setSelectedCategory,
    toggleConditionCategory,
    toggleConstraintCategory,
    updateConditionCategoryInfluence,
    updateConstraintCategoryInfluence,
    selectAllConditionCategories,
    clearAllConditionCategories,
    selectAllConstraintCategories,
    clearAllConstraintCategories,
    isConditionSelected,
    isConstraintSelected,
    getConditionCategoryInfluence,
    getConstraintCategoryInfluence,
    getConditionCategoryWeight,
    getConstraintCategoryWeight,
    isLoading,
    error,
    showTable,
    setShowTable,
    tableData,
    setTableData,
    StpArea,
    OptSetStpArea,
    setFindArea,
    setRasterLayerInfo,
    rasterLayerInfo: rasterLayerInfo||null

  };
  
  return (
    <CategoryContext.Provider value={contextValue}>
      {children}
    </CategoryContext.Provider>
  );
};

// Custom hook to use the category context
export const useCategory = (): CategoryContextType => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};