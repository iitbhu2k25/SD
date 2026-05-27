import { create } from "zustand";
import type {
  Category,
  SelectRasterLayer,
  Stp_area,
  DataRow,
} from "../../services/stpSuitabilityTypes";
import {
  buildWeightedSelections,
  fetchSuitabilityCategories,
} from "../../services/stpSuitabilityApi";
import {
  buildPriorityRiskCounts,
  EMPTY_PRIORITY_RISK_COUNTS,
  type PriorityRiskCounts,
} from "../../utils/riskFactorSummary";

interface ManualCategoryStoreState {
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
  villageRiskCounts: PriorityRiskCounts;
  showTable: boolean;
}

interface ManualCategoryStoreActions {
  initialize: () => Promise<void>;
  toggleConditionCategory: (id: number, fileName: string) => void;
  toggleConstraintCategory: (id: number, fileName: string) => void;
  updateConditionCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  updateConstraintCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  setSelectedAreaOption: (areaId: number | null) => void;
  setTableData: (rows: DataRow[]) => void;
  setShowTable: (show: boolean) => void;
  reset: () => void;
}

export type ManualCategoryStore = ManualCategoryStoreState & ManualCategoryStoreActions;

type Set = (
  partial:
    | Partial<ManualCategoryStore>
    | ((state: ManualCategoryStore) => Partial<ManualCategoryStore>),
) => void;
type Get = () => ManualCategoryStore;

function buildSelection(category: Category, fileName: string, influence: number): SelectRasterLayer {
  return { id: category.id, file_name: fileName, Influence: influence.toString() };
}

function buildAllSelections(categories: Category[]): SelectRasterLayer[] {
  return buildWeightedSelections(
    categories.map((c) => buildSelection(c, c.file_name, Number(c.weight))),
  );
}

function toggleSelection(
  categories: Category[],
  selected: SelectRasterLayer[],
  id: number,
  fileName: string,
) {
  const isSelected = selected.some((item) => item.id === id);
  if (isSelected) return buildWeightedSelections(selected.filter((item) => item.id !== id));
  const category = categories.find((item) => item.id === id);
  if (!category) return selected;
  return buildWeightedSelections([...selected, buildSelection(category, fileName, Number(category.weight))]);
}

function updateSelectionInfluence(
  categories: Category[],
  selected: SelectRasterLayer[],
  id: number,
  fileName: string,
  influence: number,
) {
  const clamped = Math.min(Math.max(influence, 0), 100);
  const existingIndex = selected.findIndex((item) => item.id === id);
  if (existingIndex !== -1) {
    const next = [...selected];
    next[existingIndex] = { ...next[existingIndex], Influence: clamped.toString() };
    return buildWeightedSelections(next);
  }
  const category = categories.find((item) => item.id === id);
  if (!category) return selected;
  return buildWeightedSelections([...selected, buildSelection(category, fileName, clamped)]);
}

async function initialize(set: Set, get: Get) {
  if (get().initialized) return;
  set({ isLoading: true, error: null });
  try {
    const { conditionCategories, constraintCategories, areaOptions } =
      await fetchSuitabilityCategories();
    set({
      initialized: true,
      conditionCategories,
      constraintCategories,
      areaOptions,
      selectedCondition: buildAllSelections(conditionCategories),
      selectedConstraint: buildAllSelections(constraintCategories),
      selectedAreaOption: areaOptions[0] ?? null,
    });
  } catch (error) {
    set({ error: error instanceof Error ? error.message : "Failed to initialize categories" });
  } finally {
    set({ isLoading: false });
  }
}

export const useManualCategoryStore = create<ManualCategoryStore>((set, get) => ({
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
  villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
  showTable: false,
  initialize: () => initialize(set, get),
  toggleConditionCategory: (id, fileName) =>
    set((state) => ({
      selectedCondition: toggleSelection(state.conditionCategories, state.selectedCondition, id, fileName),
    })),
  toggleConstraintCategory: (id, fileName) =>
    set((state) => ({
      selectedConstraint: toggleSelection(state.constraintCategories, state.selectedConstraint, id, fileName),
    })),
  updateConditionCategoryInfluence: (id, fileName, influence) =>
    set((state) => ({
      selectedCondition: updateSelectionInfluence(state.conditionCategories, state.selectedCondition, id, fileName, influence),
    })),
  updateConstraintCategoryInfluence: (id, fileName, influence) =>
    set((state) => ({
      selectedConstraint: updateSelectionInfluence(state.constraintCategories, state.selectedConstraint, id, fileName, influence),
    })),
  selectAllConditionCategories: () =>
    set((state) => ({ selectedCondition: buildAllSelections(state.conditionCategories) })),
  clearAllConditionCategories: () => set({ selectedCondition: [] }),
  selectAllConstraintCategories: () =>
    set((state) => ({ selectedConstraint: buildAllSelections(state.constraintCategories) })),
  clearAllConstraintCategories: () => set({ selectedConstraint: [] }),
  setSelectedAreaOption: (areaId) =>
    set((state) => ({
      selectedAreaOption:
        areaId === null ? null : state.areaOptions.find((o) => o.id === areaId) ?? null,
    })),
  setTableData: (rows) =>
    set({ tableData: rows, villageRiskCounts: buildPriorityRiskCounts(rows) }),
  setShowTable: (show) => set({ showTable: show }),
  reset: () =>
    set((state) => ({
      selectedCondition: buildAllSelections(state.conditionCategories),
      selectedConstraint: buildAllSelections(state.constraintCategories),
      selectedAreaOption: state.areaOptions[0] ?? null,
      tableData: [],
      villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
      showTable: false,
      error: null,
    })),
}));
