"use client";

// This connects the admin category data to the slider UI.
// It passes selected items, weights, and actions to the slider view.
import React, { useMemo } from "react";
import {
  CategorySliderModel,
} from "../../shared/ui/CategorySliderView";
import CategorySliderView from "../../shared/ui/CategorySliderView";
import { useAdminCategoryStore } from "../stores/adminCategoryStore";

interface AdminCategorySliderProps {
  editable?: boolean;
}

export default function AdminCategorySlider({
  editable = false,
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
