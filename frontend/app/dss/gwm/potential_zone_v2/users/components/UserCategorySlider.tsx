"use client";

import React, { useMemo } from "react";
import {
  CategorySliderModel,
} from "@/components/dss_common/CategorySliderView";
import CategorySliderView from "@/components/dss_common/CategorySliderView";
import { useUserCategoryStore } from "../stores/userCategoryStore";
import { useUiModeService } from "../../services/uiModeService";

interface UserCategorySliderProps {
  editable?: boolean;
  onToggleEditable?: () => void;
  onReset?: () => void;
}

export default function UserCategorySlider({
  editable = false,
  onToggleEditable,
  onReset,
}: UserCategorySliderProps) {
  const categories = useUserCategoryStore((s) => s.categories);
  const selectedCategories = useUserCategoryStore((s) => s.selectedCategories);
  const isSelected = useUserCategoryStore((s) => s.isSelected);
  const updateCategoryInfluence = useUserCategoryStore((s) => s.updateCategoryInfluence);
  const getCategoryInfluence = useUserCategoryStore((s) => s.getCategoryInfluence);
  const getCategoryWeight = useUserCategoryStore((s) => s.getCategoryWeight);
  const toggleCategory = useUserCategoryStore((s) => s.toggleCategory);
  const selectAllCategories = useUserCategoryStore((s) => s.selectAllCategories);
  const clearAllCategories = useUserCategoryStore((s) => s.clearAllCategories);
  const resetSelectedCategoriesToDefaults = useUserCategoryStore(
    (s) => s.resetSelectedCategoriesToDefaults,
  );
  const isDark = useUiModeService((s) => s.isDark);

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

  return (
    <CategorySliderView
      editable={editable}
      model={model}
      onToggleEditable={onToggleEditable}
      onReset={onReset ?? resetSelectedCategoriesToDefaults}
      isDark={isDark}
    />
  );
}
