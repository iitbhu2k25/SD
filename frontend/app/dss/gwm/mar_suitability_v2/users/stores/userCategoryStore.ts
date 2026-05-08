import { create } from "zustand";
import {
  Category,
  SelectRasterLayer,
} from "@/interface/raster_context";
import { DataRow } from "@/interface/table";
import { fetchMarConditionCategories, fetchMarConstraintCategories } from "../../services/marSuitabilityApi";
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

interface UserCategoryStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  conditionCategories: Category[];
  constraintCategories: Category[];
  selectedConditions: SelectRasterLayer[];
  selectedConstraints: SelectRasterLayer[];
  marProcess: boolean;
  tableData: DataRow[];
  villageRiskCounts: PriorityRiskCounts;
}

interface UserCategoryStoreActions {
  initialize: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  
  toggleConditionCategory: (id: number, fileName: string) => void;
  updateConditionCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  isConditionSelected: (id: number) => boolean;
  getConditionCategoryInfluence: (id: number) => number;
  getConditionCategoryWeight: (id: number) => number;
  
  toggleConstraintCategory: (id: number, fileName: string) => void;
  updateConstraintCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  isConstraintSelected: (id: number) => boolean;
  getConstraintCategoryInfluence: (id: number) => number;
  getConstraintCategoryWeight: (id: number) => number;
  
  setMarProcess: (value: boolean) => void;
  setTableData: (value: DataRow[]) => void;
  reset: () => void;
}

export type UserCategoryStore = UserCategoryStoreState & UserCategoryStoreActions;

export const useUserCategoryStore = create<UserCategoryStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  conditionCategories: [],
  constraintCategories: [],
  selectedConditions: [],
  selectedConstraints: [],
  marProcess: false,
  tableData: [],
  villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
  
  initialize: async () => {
    if (get().initialized) return;
    await get().refreshCategories();
    set({ initialized: true });
  },
  refreshCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const [conditions, constraints] = await Promise.all([
        fetchMarConditionCategories(),
        fetchMarConstraintCategories()
      ]);
      set({ conditionCategories: conditions, constraintCategories: constraints });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch categories" });
    } finally {
      set({ isLoading: false });
    }
  },
  
  toggleConditionCategory: (id, fileName) => {
    const { conditionCategories, selectedConditions } = get();
    const selected = selectedConditions.some((item) => item.id === id);
    if (selected) {
      set({ selectedConditions: calculateSelectedCategories(selectedConditions.filter((item) => item.id !== id)) });
      return;
    }
    const category = conditionCategories.find((item) => item.id === id);
    if (!category) return;
    set({ selectedConditions: calculateSelectedCategories([...selectedConditions, buildSelectedCategory(category, fileName, category.weight)]) });
  },
  updateConditionCategoryInfluence: (id, fileName, influence) => {
    const clampedInfluence = Math.min(Math.max(influence, 0), 100);
    const { conditionCategories, selectedConditions } = get();
    const existingIndex = selectedConditions.findIndex((item) => item.id === id);
    if (existingIndex !== -1) {
      const nextSelected = [...selectedConditions];
      nextSelected[existingIndex] = { ...nextSelected[existingIndex], Influence: clampedInfluence.toString() };
      set({ selectedConditions: calculateSelectedCategories(nextSelected) });
      return;
    }
    const category = conditionCategories.find((item) => item.id === id);
    if (!category) return;
    set({ selectedConditions: calculateSelectedCategories([...selectedConditions, buildSelectedCategory(category, fileName, clampedInfluence)]) });
  },
  selectAllConditionCategories: () => set({ selectedConditions: calculateSelectedCategories(get().conditionCategories.map((c) => buildSelectedCategory(c, c.file_name, c.weight))) }),
  clearAllConditionCategories: () => set({ selectedConditions: [] }),
  isConditionSelected: (id) => get().selectedConditions.some((item) => item.id === id),
  getConditionCategoryInfluence: (id) => {
    const sel = get().selectedConditions.find((item) => item.id === id);
    if (sel) return parseFloat(sel.Influence);
    const cat = get().conditionCategories.find((item) => item.id === id);
    return cat ? cat.weight : 0;
  },
  getConditionCategoryWeight: (id) => {
    const sel = get().selectedConditions.find((item) => item.id === id);
    return sel?.weight ? parseFloat(sel.weight) : 0;
  },
  
  toggleConstraintCategory: (id, fileName) => {
    const { constraintCategories, selectedConstraints } = get();
    const selected = selectedConstraints.some((item) => item.id === id);
    if (selected) {
      set({ selectedConstraints: calculateSelectedCategories(selectedConstraints.filter((item) => item.id !== id)) });
      return;
    }
    const category = constraintCategories.find((item) => item.id === id);
    if (!category) return;
    set({ selectedConstraints: calculateSelectedCategories([...selectedConstraints, buildSelectedCategory(category, fileName, category.weight)]) });
  },
  updateConstraintCategoryInfluence: (id, fileName, influence) => {
    const clampedInfluence = Math.min(Math.max(influence, 0), 100);
    const { constraintCategories, selectedConstraints } = get();
    const existingIndex = selectedConstraints.findIndex((item) => item.id === id);
    if (existingIndex !== -1) {
      const nextSelected = [...selectedConstraints];
      nextSelected[existingIndex] = { ...nextSelected[existingIndex], Influence: clampedInfluence.toString() };
      set({ selectedConstraints: calculateSelectedCategories(nextSelected) });
      return;
    }
    const category = constraintCategories.find((item) => item.id === id);
    if (!category) return;
    set({ selectedConstraints: calculateSelectedCategories([...selectedConstraints, buildSelectedCategory(category, fileName, clampedInfluence)]) });
  },
  selectAllConstraintCategories: () => set({ selectedConstraints: calculateSelectedCategories(get().constraintCategories.map((c) => buildSelectedCategory(c, c.file_name, c.weight))) }),
  clearAllConstraintCategories: () => set({ selectedConstraints: [] }),
  isConstraintSelected: (id) => get().selectedConstraints.some((item) => item.id === id),
  getConstraintCategoryInfluence: (id) => {
    const sel = get().selectedConstraints.find((item) => item.id === id);
    if (sel) return parseFloat(sel.Influence);
    const cat = get().constraintCategories.find((item) => item.id === id);
    return cat ? cat.weight : 0;
  },
  getConstraintCategoryWeight: (id) => {
    const sel = get().selectedConstraints.find((item) => item.id === id);
    return sel?.weight ? parseFloat(sel.weight) : 0;
  },
  
  setMarProcess: (value) => set({ marProcess: value }),
  setTableData: (value) =>
    set({
      tableData: value,
      villageRiskCounts: buildPriorityRiskCounts(value),
    }),
  reset: () => set({
    selectedConditions: [],
    selectedConstraints: [],
    marProcess: false,
    tableData: [],
    villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
    error: null,
  }),
}));
