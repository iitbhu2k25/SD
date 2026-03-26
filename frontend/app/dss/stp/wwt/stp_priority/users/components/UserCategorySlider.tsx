"use client";

import React, { useMemo } from "react";
import {
  CategorySliderModel,
} from "../../shared/ui/CategorySliderView";
import CategorySliderView from "../../shared/ui/CategorySliderView";
import { useUserCategoryStore } from "../stores/userCategoryStore";

interface UserCategorySliderProps {
  editable?: boolean;
}

export default function UserCategorySlider({ editable = false }: UserCategorySliderProps) {
  const categories = useUserCategoryStore((s) => s.categories);
  const selectedCategories = useUserCategoryStore((s) => s.selectedCategories);
  const isSelected = useUserCategoryStore((s) => s.isSelected);
  const updateCategoryInfluence = useUserCategoryStore((s) => s.updateCategoryInfluence);
  const getCategoryInfluence = useUserCategoryStore((s) => s.getCategoryInfluence);
  const getCategoryWeight = useUserCategoryStore((s) => s.getCategoryWeight);
  const toggleCategory = useUserCategoryStore((s) => s.toggleCategory);
  const selectAllCategories = useUserCategoryStore((s) => s.selectAllCategories);
  const clearAllCategories = useUserCategoryStore((s) => s.clearAllCategories);

  const model = useMemo<CategorySliderModel>(
    () => ({
      categories,
      selectedCategories,
      isSelected,
      updateCategoryInfluence,
      getCategoryInfluence,
      getCategoryWeight,
      toggleCategory,
      selectAllCategories,
      clearAllCategories,
    }),
    [
      categories,
      selectedCategories,
      isSelected,
      updateCategoryInfluence,
      getCategoryInfluence,
      getCategoryWeight,
      toggleCategory,
      selectAllCategories,
      clearAllCategories,
    ],
  );

  return <CategorySliderView editable={editable} model={model} />;
}
