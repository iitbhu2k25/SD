"use client";

// This connects the admin category data to the slider UI.
// It passes selected items, weights, and actions to the slider view.
import React, { useMemo } from "react";
import {
  CategorySliderModel,
} from "@/components/dss_common/CategorySliderView";
import CategorySliderView from "@/components/dss_common/CategorySliderView";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";
import { useUiModeService } from "../../services/uiModeService";

interface AdminCategorySliderProps {
  editable?: boolean;
  onToggleEditable?: () => void;
  onReset?: () => void;
}

export default function AdminCategorySlider({
  editable = false,
  onToggleEditable,
  onReset,
}: AdminCategorySliderProps) {
  const categories = useAdminCategoryStore((state) => state.categories);
  const selectedCategories = useAdminCategoryStore(
    (state) => state.selectedCategories,
  );
  const isSelected = useAdminCategoryStore((state) => state.isSelected);
  const updateCategoryInfluence = useAdminCategoryStore(
    (state) => state.updateCategoryInfluence,
  );
  const getCategoryInfluence = useAdminCategoryStore(
    (state) => state.getCategoryInfluence,
  );
  const getCategoryWeight = useAdminCategoryStore((state) => state.getCategoryWeight);
  const toggleCategory = useAdminCategoryStore((state) => state.toggleCategory);
  const selectAllCategories = useAdminCategoryStore(
    (state) => state.selectAllCategories,
  );
  const clearAllCategories = useAdminCategoryStore(
    (state) => state.clearAllCategories,
  );
  const resetSelectedCategoriesToDefaults = useAdminCategoryStore(
    (state) => state.resetSelectedCategoriesToDefaults,
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
