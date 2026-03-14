import { create } from "zustand";
import {
  Category,
  SelectRasterLayer,
} from "@/interface/raster_context";
import { fetchPriorityCategories } from "../../services/stpPriorityApi";

function calculateSelectedCategories(
  selectedCategories: SelectRasterLayer[],
): SelectRasterLayer[] {
  if (selectedCategories.length === 0) {
    return [];
  }

  const totalInfluence = selectedCategories.reduce(
    (sum, category) => sum + parseFloat(category.Influence),
    0,
  );

  if (totalInfluence === 0) {
    const equalWeight = (1 / selectedCategories.length).toFixed(4);
    return selectedCategories.map((category) => ({
      ...category,
      weight: equalWeight,
    }));
  }

  return selectedCategories.map((category) => ({
    ...category,
    weight: (parseFloat(category.Influence) / totalInfluence).toFixed(4),
  }));
}

interface UserCategoryState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  categories: Category[];
  selectedCategories: SelectRasterLayer[];
  stpProcess: boolean;
  initialize: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  toggleCategory: (id: number, fileName: string) => void;
  updateCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllCategories: () => void;
  clearAllCategories: () => void;
  setStpProcess: (value: boolean) => void;
  reset: () => void;
  isSelected: (id: number) => boolean;
  getCategoryInfluence: (id: number) => number;
  getCategoryWeight: (id: number) => number;
}

export const useUserCategoryStore = create<UserCategoryState>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  categories: [],
  selectedCategories: [],
  stpProcess: false,
  initialize: async () => {
    if (get().initialized || get().isLoading) {
      return;
    }
    await get().refreshCategories();
    set({ initialized: true });
  },
  refreshCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const categories = await fetchPriorityCategories();
      set({ categories });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch categories";
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  toggleCategory: (id, fileName) => {
    const { categories, selectedCategories } = get();
    const isSelected = selectedCategories.some((item) => item.id === id);
    if (isSelected) {
      set({
        selectedCategories: calculateSelectedCategories(
          selectedCategories.filter((item) => item.id !== id),
        ),
      });
      return;
    }

    const category = categories.find((item) => item.id === id);
    if (!category) {
      return;
    }

    set({
      selectedCategories: calculateSelectedCategories([
        ...selectedCategories,
        {
          id,
          file_name: fileName,
          Influence: category.weight.toString(),
        },
      ]),
    });
  },
  updateCategoryInfluence: (id, fileName, influence) => {
    const clampedInfluence = Math.min(Math.max(influence, 0), 100);
    const { categories, selectedCategories } = get();
    const existingIndex = selectedCategories.findIndex((item) => item.id === id);

    if (existingIndex !== -1) {
      const nextSelected = [...selectedCategories];
      nextSelected[existingIndex] = {
        ...nextSelected[existingIndex],
        Influence: clampedInfluence.toString(),
      };
      set({ selectedCategories: calculateSelectedCategories(nextSelected) });
      return;
    }

    const category = categories.find((item) => item.id === id);
    if (!category) {
      return;
    }

    set({
      selectedCategories: calculateSelectedCategories([
        ...selectedCategories,
        {
          id,
          file_name: fileName,
          Influence: clampedInfluence.toString(),
        },
      ]),
    });
  },
  selectAllCategories: () => {
    const allSelected = get().categories.map((category) => ({
      id: category.id,
      file_name: category.file_name,
      Influence: category.weight.toString(),
    }));
    set({ selectedCategories: calculateSelectedCategories(allSelected) });
  },
  clearAllCategories: () => set({ selectedCategories: [] }),
  setStpProcess: (value) => set({ stpProcess: value }),
  reset: () =>
    set({
      selectedCategories: [],
      stpProcess: false,
      error: null,
    }),
  isSelected: (id) => get().selectedCategories.some((item) => item.id === id),
  getCategoryInfluence: (id) => {
    const selectedCategory = get().selectedCategories.find((item) => item.id === id);
    if (selectedCategory) {
      return parseFloat(selectedCategory.Influence);
    }

    const category = get().categories.find((item) => item.id === id);
    return category ? category.weight : 0;
  },
  getCategoryWeight: (id) => {
    const selectedCategory = get().selectedCategories.find((item) => item.id === id);
    if (selectedCategory?.weight) {
      return parseFloat(selectedCategory.weight);
    }
    return 0;
  },
}));
