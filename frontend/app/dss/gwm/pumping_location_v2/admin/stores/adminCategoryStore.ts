import { create } from "zustand";
import {
  Category,
  SelectRasterLayer,
} from "@/interface/raster_context";
import { Gwpl_Table } from "@/interface/table";
import { fetchPumpingCategories } from "../../services/gwmPumpingApi";
import {
  buildPumpingRiskCounts,
  EMPTY_PUMPING_RISK_COUNTS,
  PumpingRiskCounts,
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
  
  conditionCategories: Category[];
  constraintCategories: Category[];
  
  selectedCondition: SelectRasterLayer[];
  selectedConstraint: SelectRasterLayer[];
  
  stpProcess: boolean;
  tableData: Gwpl_Table[];
  villageRiskCounts: PumpingRiskCounts;
}

interface AdminCategoryStoreActions {
  initialize: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  
  toggleConditionCategory: (id: number, fileName: string) => void;
  toggleConstraintCategory: (id: number, fileName: string) => void;
  
  updateConditionInfluence: (id: number, fileName: string, influence: number) => void;
  updateConstraintInfluence: (id: number, fileName: string, influence: number) => void;
  
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  
  setStpProcess: (value: boolean) => void;
  setTableData: (value: Gwpl_Table[]) => void;
  reset: () => void;
  
  isConditionSelected: (id: number) => boolean;
  isConstraintSelected: (id: number) => boolean;
  
  getConditionInfluence: (id: number) => number;
  getConstraintInfluence: (id: number) => number;
  
  getConditionWeight: (id: number) => number;
  getConstraintWeight: (id: number) => number;
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
    const [conditions, constraints] = await Promise.all([
      fetchPumpingCategories("condition"),
      fetchPumpingCategories("constraint")
    ]);
    
    set({ conditionCategories: conditions, constraintCategories: constraints });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch categories";
    set({ error: message });
  } finally {
    set({ isLoading: false });
  }
}

function toggleCategory(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
  type: "condition" | "constraint"
) {
  const isCondition = type === "condition";
  const categories = isCondition ? get().conditionCategories : get().constraintCategories;
  const selectedCategories = isCondition ? get().selectedCondition : get().selectedConstraint;
  
  const selected = selectedCategories.some((item) => item.id === id);

  if (selected) {
    const newSelected = calculateSelectedCategories(selectedCategories.filter((item) => item.id !== id));
    if (isCondition) set({ selectedCondition: newSelected });
    else set({ selectedConstraint: newSelected });
    return;
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  const newSelected = calculateSelectedCategories([
    ...selectedCategories,
    buildSelectedCategory(category, fileName, category.weight),
  ]);
  
  if (isCondition) set({ selectedCondition: newSelected });
  else set({ selectedConstraint: newSelected });
}

function updateCategoryInfluence(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
  influence: number,
  type: "condition" | "constraint"
) {
  const clampedInfluence = Math.min(Math.max(influence, 0), 100);
  
  const isCondition = type === "condition";
  const categories = isCondition ? get().conditionCategories : get().constraintCategories;
  const selectedCategories = isCondition ? get().selectedCondition : get().selectedConstraint;
  
  const existingIndex = selectedCategories.findIndex((item) => item.id === id);

  if (existingIndex !== -1) {
    const nextSelected = [...selectedCategories];
    nextSelected[existingIndex] = {
      ...nextSelected[existingIndex],
      Influence: clampedInfluence.toString(),
    };
    const finalSelected = calculateSelectedCategories(nextSelected);
    
    if (isCondition) set({ selectedCondition: finalSelected });
    else set({ selectedConstraint: finalSelected });
    return;
  }

  const category = categories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  const newSelected = calculateSelectedCategories([
    ...selectedCategories,
    buildSelectedCategory(category, fileName, clampedInfluence),
  ]);
  
  if (isCondition) set({ selectedCondition: newSelected });
  else set({ selectedConstraint: newSelected });
}

export const useAdminCategoryStore = create<AdminCategoryStore>((set, get) => ({
  initialized: false,
  isLoading: false,
  error: null,
  
  conditionCategories: [],
  constraintCategories: [],
  
  selectedCondition: [],
  selectedConstraint: [],
  
  stpProcess: false,
  tableData: [],
  villageRiskCounts: { ...EMPTY_PUMPING_RISK_COUNTS },
  
  initialize: () => initializeAdminCategoryStore(set, get),
  refreshCategories: () => refreshAdminCategories(set),
  
  toggleConditionCategory: (id, fileName) => toggleCategory(set, get, id, fileName, "condition"),
  toggleConstraintCategory: (id, fileName) => toggleCategory(set, get, id, fileName, "constraint"),
  
  updateConditionInfluence: (id, fileName, influence) => updateCategoryInfluence(set, get, id, fileName, influence, "condition"),
  updateConstraintInfluence: (id, fileName, influence) => updateCategoryInfluence(set, get, id, fileName, influence, "constraint"),
  
  selectAllConditionCategories: () => {
    const allSelected = get().conditionCategories.map((c) => buildSelectedCategory(c, c.file_name, c.weight));
    set({ selectedCondition: calculateSelectedCategories(allSelected) });
  },
  clearAllConditionCategories: () => set({ selectedCondition: [] }),
  
  selectAllConstraintCategories: () => {
    const allSelected = get().constraintCategories.map((c) => buildSelectedCategory(c, c.file_name, c.weight));
    set({ selectedConstraint: calculateSelectedCategories(allSelected) });
  },
  clearAllConstraintCategories: () => set({ selectedConstraint: [] }),
  
  setStpProcess: (value) => set({ stpProcess: value }),
  setTableData: (value) => set({ tableData: value, villageRiskCounts: buildPumpingRiskCounts(value) }),
  
  reset: () => set({
    selectedCondition: [],
    selectedConstraint: [],
    stpProcess: false,
    tableData: [],
    villageRiskCounts: { ...EMPTY_PUMPING_RISK_COUNTS },
    error: null,
  }),
  
  isConditionSelected: (id) => get().selectedCondition.some((item) => item.id === id),
  isConstraintSelected: (id) => get().selectedConstraint.some((item) => item.id === id),
  
  getConditionInfluence: (id) => {
    const sc = get().selectedCondition.find((item) => item.id === id);
    if (sc) return parseFloat(sc.Influence);
    const c = get().conditionCategories.find((item) => item.id === id);
    return c ? c.weight : 0;
  },
  getConstraintInfluence: (id) => {
    const sc = get().selectedConstraint.find((item) => item.id === id);
    if (sc) return parseFloat(sc.Influence);
    const c = get().constraintCategories.find((item) => item.id === id);
    return c ? c.weight : 0;
  },
  
  getConditionWeight: (id) => {
    const sc = get().selectedCondition.find((item) => item.id === id);
    return sc?.weight ? parseFloat(sc.weight) : 0;
  },
  getConstraintWeight: (id) => {
    const sc = get().selectedConstraint.find((item) => item.id === id);
    return sc?.weight ? parseFloat(sc.weight) : 0;
  },
}));
