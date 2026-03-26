import { create } from "zustand";
import type {
  Category,
  DataRow,
  SelectRasterLayer,
  Stp_area,
} from "../../services/stpSuitabilityTypes";
import {
  buildWeightedSelections,
  fetchSuitabilityCategories,
} from "../../services/stpSuitabilityApi";

interface UserCategoryStoreState {
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  conditionCategories: Category[];
  constraintCategories: Category[];
  areaOptions: Stp_area[];
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  selectedAreaOption: Stp_area | null;
  tableData: DataRow[];
  showTable: boolean;
}

interface UserCategoryStoreActions {
  initialize: () => Promise<void>;
  toggleConditionCategory: (id: number, fileName: string) => void;
  toggleConstraintCategory: (id: number, fileName: string) => void;
  updateConditionCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  updateConstraintCategoryInfluence: (
    id: number,
    fileName: string,
    influence: number,
  ) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  setSelectedAreaOption: (areaId: number | null) => void;
  setTableData: (rows: DataRow[]) => void;
  setShowTable: (show: boolean) => void;
  reset: () => void;
}

export type UserCategoryStore = UserCategoryStoreState & UserCategoryStoreActions;

function buildSelection(category: Category, fileName: string, influence: number): SelectRasterLayer {
  return {
    id: category.id,
    file_name: fileName,
    Influence: influence.toString(),
  };
}

function toggleSelection(
  categories: Category[],
  selected: SelectRasterLayer[],
  id: number,
  fileName: string,
) {
  const isSelected = selected.some((item) => item.id === id);
  if (isSelected) {
    return buildWeightedSelections(selected.filter((item) => item.id !== id));
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return selected;
  }

  return buildWeightedSelections([
    ...selected,
    buildSelection(category, fileName, Number(category.weight)),
  ]);
}

function updateSelectionInfluence(
  categories: Category[],
  selected: SelectRasterLayer[],
  id: number,
  fileName: string,
  influence: number,
) {
  const clampedInfluence = Math.min(Math.max(influence, 0), 100);
  const existingIndex = selected.findIndex((item) => item.id === id);

  if (existingIndex !== -1) {
    const nextSelected = [...selected];
    nextSelected[existingIndex] = {
      ...nextSelected[existingIndex],
      Influence: clampedInfluence.toString(),
    };
    return buildWeightedSelections(nextSelected);
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return selected;
  }

  return buildWeightedSelections([
    ...selected,
    buildSelection(category, fileName, clampedInfluence),
  ]);
}

export const useUserCategoryStore = create<UserCategoryStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  conditionCategories: [],
  constraintCategories: [],
  areaOptions: [],
  selectedCondition: [],
  selectedConstraint: [],
  selectedAreaOption: null,
  tableData: [],
  showTable: false,
  initialize: async () => {
    if (get().initialized) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { conditionCategories, constraintCategories, areaOptions } =
        await fetchSuitabilityCategories();
      set({
        initialized: true,
        conditionCategories,
        constraintCategories,
        areaOptions,
        selectedAreaOption: areaOptions[0] ?? null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to initialize suitability categories",
      });
    } finally {
      set({ isLoading: false });
    }
  },
  toggleConditionCategory: (id, fileName) =>
    set((state) => ({
      selectedCondition: toggleSelection(
        state.conditionCategories,
        state.selectedCondition,
        id,
        fileName,
      ),
    })),
  toggleConstraintCategory: (id, fileName) =>
    set((state) => ({
      selectedConstraint: toggleSelection(
        state.constraintCategories,
        state.selectedConstraint,
        id,
        fileName,
      ),
    })),
  updateConditionCategoryInfluence: (id, fileName, influence) =>
    set((state) => ({
      selectedCondition: updateSelectionInfluence(
        state.conditionCategories,
        state.selectedCondition,
        id,
        fileName,
        influence,
      ),
    })),
  updateConstraintCategoryInfluence: (id, fileName, influence) =>
    set((state) => ({
      selectedConstraint: updateSelectionInfluence(
        state.constraintCategories,
        state.selectedConstraint,
        id,
        fileName,
        influence,
      ),
    })),
  selectAllConditionCategories: () =>
    set((state) => ({
      selectedCondition: buildWeightedSelections(
        state.conditionCategories.map((category) =>
          buildSelection(category, category.file_name, Number(category.weight)),
        ),
      ),
    })),
  clearAllConditionCategories: () => set({ selectedCondition: [] }),
  selectAllConstraintCategories: () =>
    set((state) => ({
      selectedConstraint: buildWeightedSelections(
        state.constraintCategories.map((category) =>
          buildSelection(category, category.file_name, Number(category.weight)),
        ),
      ),
    })),
  clearAllConstraintCategories: () => set({ selectedConstraint: [] }),
  setSelectedAreaOption: (areaId) =>
    set((state) => ({
      selectedAreaOption:
        areaId === null
          ? null
          : state.areaOptions.find((option) => option.id === areaId) ?? null,
    })),
  setTableData: (rows) => set({ tableData: rows }),
  setShowTable: (show) => set({ showTable: show }),
  reset: () =>
    set((state) => ({
      selectedCondition: [],
      selectedConstraint: [],
      selectedAreaOption: state.areaOptions[0] ?? null,
      tableData: [],
      showTable: false,
      error: null,
    })),
}));
