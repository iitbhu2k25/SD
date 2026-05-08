// This store keeps the category list and selected category values.
// It also stores the result table after the analysis is done.
import { create } from "zustand";
import {
  Category,
  SelectRasterLayer,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import { fetchGwzCategories } from "../../services/gwzPotentialApi";
import {
  buildPriorityRiskCounts,
  EMPTY_PRIORITY_RISK_COUNTS,
  PriorityRiskCounts,
} from "../../utils/riskFactorSummary";

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

function buildSelectedCategory(
  category: Category,
  fileName: string,
  influence: number,
): SelectRasterLayer {
  return {
    id: category.id,
    file_name: fileName,
    Influence: influence.toString(),
  };
}

interface AdminCategoryStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  categories: Category[];
  selectedCategories: SelectRasterLayer[];
  stpProcess: boolean;
  tableData: DataRow[];
  villageRiskCounts: PriorityRiskCounts;
}

interface AdminCategoryStoreActions {
  initialize: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  toggleCategory: (id: number, fileName: string) => void;
  updateCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllCategories: () => void;
  clearAllCategories: () => void;
  resetSelectedCategoriesToDefaults: () => void;
  setStpProcess: (value: boolean) => void;
  setTableData: (value: DataRow[]) => void;
  reset: () => void;
  isSelected: (id: number) => boolean;
  getCategoryInfluence: (id: number) => number;
  getCategoryWeight: (id: number) => number;
}

export type AdminCategoryStore = AdminCategoryStoreState & AdminCategoryStoreActions;

type AdminCategorySet = (
  partial:
    | Partial<AdminCategoryStore>
    | ((state: AdminCategoryStore) => Partial<AdminCategoryStore>),
) => void;
type AdminCategoryGet = () => AdminCategoryStore;

async function initializeAdminCategoryStore(
  set: AdminCategorySet,
  get: AdminCategoryGet,
) {
  if (get().initialized) {
    return;
  }

  await get().refreshCategories();
  set({ initialized: true });
}

async function refreshAdminCategories(set: AdminCategorySet) {
  set({ isLoading: true, error: null });

  try {
    const categories = await fetchGwzCategories();
    set({ categories });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch categories";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

function toggleAdminCategory(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
) {
  const { categories, selectedCategories } = get();
  const selected = selectedCategories.some((item) => item.id === id);

  if (selected) {
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
      buildSelectedCategory(category, fileName, category.weight),
    ]),
  });
}

function updateAdminCategoryInfluence(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
  influence: number,
) {
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
      buildSelectedCategory(category, fileName, clampedInfluence),
    ]),
  });
}

function selectAllAdminCategories(set: AdminCategorySet, get: AdminCategoryGet) {
  const allSelected = get().categories.map((category) =>
    buildSelectedCategory(category, category.file_name, category.weight),
  );
  set({ selectedCategories: calculateSelectedCategories(allSelected) });
}

function clearAllAdminCategories(set: AdminCategorySet) {
  set({ selectedCategories: [] });
}

function resetAdminSelectedCategoriesToDefaults(
  set: AdminCategorySet,
  get: AdminCategoryGet,
) {
  const { categories, selectedCategories } = get();

  if (selectedCategories.length === 0) {
    return;
  }

  const resetSelected = selectedCategories.map((selectedCategory) => {
    const category = categories.find((item) => item.id === selectedCategory.id);

    if (!category) {
      return selectedCategory;
    }

    return buildSelectedCategory(
      category,
      selectedCategory.file_name || category.file_name,
      category.weight,
    );
  });

  set({ selectedCategories: calculateSelectedCategories(resetSelected) });
}

function setAdminStpProcess(set: AdminCategorySet, value: boolean) {
  set({ stpProcess: value });
}

function setAdminTableData(set: AdminCategorySet, value: DataRow[]) {
  set({
    tableData: value,
    villageRiskCounts: buildPriorityRiskCounts(value),
  });
}

function resetAdminCategoryStore(set: AdminCategorySet) {
  set({
    selectedCategories: [],
    stpProcess: false,
    tableData: [],
    villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
    error: null,
  });
}

function isAdminCategorySelected(get: AdminCategoryGet, id: number) {
  return get().selectedCategories.some((item) => item.id === id);
}

function getAdminCategoryInfluence(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedCategories.find((item) => item.id === id);
  if (selectedCategory) {
    return parseFloat(selectedCategory.Influence);
  }

  const category = get().categories.find((item) => item.id === id);
  return category ? category.weight : 0;
}

function getAdminCategoryWeight(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedCategories.find((item) => item.id === id);
  if (selectedCategory?.weight) {
    return parseFloat(selectedCategory.weight);
  }

  return 0;
}

export const useAdminCategoryStore = create<AdminCategoryStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  categories: [],
  selectedCategories: [],
  stpProcess: false,
  tableData: [],
  villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
  initialize: () => initializeAdminCategoryStore(set, get),
  refreshCategories: () => refreshAdminCategories(set),
  toggleCategory: (id, fileName) => toggleAdminCategory(set, get, id, fileName),
  updateCategoryInfluence: (id, fileName, influence) =>
    updateAdminCategoryInfluence(set, get, id, fileName, influence),
  selectAllCategories: () => selectAllAdminCategories(set, get),
  clearAllCategories: () => clearAllAdminCategories(set),
  resetSelectedCategoriesToDefaults: () =>
    resetAdminSelectedCategoriesToDefaults(set, get),
  setStpProcess: (value) => setAdminStpProcess(set, value),
  setTableData: (value) => setAdminTableData(set, value),
  reset: () => resetAdminCategoryStore(set),
  isSelected: (id) => isAdminCategorySelected(get, id),
  getCategoryInfluence: (id) => getAdminCategoryInfluence(get, id),
  getCategoryWeight: (id) => getAdminCategoryWeight(get, id),
}));
