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

interface AdminCategoryStoreState {
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

interface AdminCategoryStoreActions {
  initialize: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  
  // Conditions
  toggleConditionCategory: (id: number, fileName: string) => void;
  updateConditionCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConditionCategories: () => void;
  clearAllConditionCategories: () => void;
  isConditionSelected: (id: number) => boolean;
  getConditionCategoryInfluence: (id: number) => number;
  getConditionCategoryWeight: (id: number) => number;
  
  // Constraints
  toggleConstraintCategory: (id: number, fileName: string) => void;
  updateConstraintCategoryInfluence: (id: number, fileName: string, influence: number) => void;
  selectAllConstraintCategories: () => void;
  clearAllConstraintCategories: () => void;
  isConstraintSelected: (id: number) => boolean;
  getConstraintCategoryInfluence: (id: number) => number;
  getConstraintCategoryWeight: (id: number) => number;
  
  // Shared
  setMarProcess: (value: boolean) => void;
  setTableData: (value: DataRow[]) => void;
  reset: () => void;
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
      fetchMarConditionCategories(),
      fetchMarConstraintCategories()
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

// ----- Conditions -----
function toggleAdminConditionCategory(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
) {
  const { conditionCategories, selectedConditions } = get();
  const selected = selectedConditions.some((item) => item.id === id);

  if (selected) {
    set({
      selectedConditions: calculateSelectedCategories(
        selectedConditions.filter((item) => item.id !== id),
      ),
    });
    return;
  }

  const category = conditionCategories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  set({
    selectedConditions: calculateSelectedCategories([
      ...selectedConditions,
      buildSelectedCategory(category, fileName, category.weight),
    ]),
  });
}

function updateAdminConditionCategoryInfluence(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
  influence: number,
) {
  const clampedInfluence = Math.min(Math.max(influence, 0), 100);
  const { conditionCategories, selectedConditions } = get();
  const existingIndex = selectedConditions.findIndex((item) => item.id === id);

  if (existingIndex !== -1) {
    const nextSelected = [...selectedConditions];
    nextSelected[existingIndex] = {
      ...nextSelected[existingIndex],
      Influence: clampedInfluence.toString(),
    };
    set({ selectedConditions: calculateSelectedCategories(nextSelected) });
    return;
  }

  const category = conditionCategories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  set({
    selectedConditions: calculateSelectedCategories([
      ...selectedConditions,
      buildSelectedCategory(category, fileName, clampedInfluence),
    ]),
  });
}

function selectAllAdminConditionCategories(set: AdminCategorySet, get: AdminCategoryGet) {
  const allSelected = get().conditionCategories.map((category) =>
    buildSelectedCategory(category, category.file_name, category.weight),
  );
  set({ selectedConditions: calculateSelectedCategories(allSelected) });
}

function clearAllAdminConditionCategories(set: AdminCategorySet) {
  set({ selectedConditions: [] });
}

function isAdminConditionSelected(get: AdminCategoryGet, id: number) {
  return get().selectedConditions.some((item) => item.id === id);
}

function getAdminConditionCategoryInfluence(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedConditions.find((item) => item.id === id);
  if (selectedCategory) {
    return parseFloat(selectedCategory.Influence);
  }

  const category = get().conditionCategories.find((item) => item.id === id);
  return category ? category.weight : 0;
}

function getAdminConditionCategoryWeight(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedConditions.find((item) => item.id === id);
  if (selectedCategory?.weight) {
    return parseFloat(selectedCategory.weight);
  }

  return 0;
}

// ----- Constraints -----
function toggleAdminConstraintCategory(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
) {
  const { constraintCategories, selectedConstraints } = get();
  const selected = selectedConstraints.some((item) => item.id === id);

  if (selected) {
    set({
      selectedConstraints: calculateSelectedCategories(
        selectedConstraints.filter((item) => item.id !== id),
      ),
    });
    return;
  }

  const category = constraintCategories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  set({
    selectedConstraints: calculateSelectedCategories([
      ...selectedConstraints,
      buildSelectedCategory(category, fileName, category.weight),
    ]),
  });
}

function updateAdminConstraintCategoryInfluence(
  set: AdminCategorySet,
  get: AdminCategoryGet,
  id: number,
  fileName: string,
  influence: number,
) {
  const clampedInfluence = Math.min(Math.max(influence, 0), 100);
  const { constraintCategories, selectedConstraints } = get();
  const existingIndex = selectedConstraints.findIndex((item) => item.id === id);

  if (existingIndex !== -1) {
    const nextSelected = [...selectedConstraints];
    nextSelected[existingIndex] = {
      ...nextSelected[existingIndex],
      Influence: clampedInfluence.toString(),
    };
    set({ selectedConstraints: calculateSelectedCategories(nextSelected) });
    return;
  }

  const category = constraintCategories.find((item) => item.id === id);
  if (!category) {
    return;
  }

  set({
    selectedConstraints: calculateSelectedCategories([
      ...selectedConstraints,
      buildSelectedCategory(category, fileName, clampedInfluence),
    ]),
  });
}

function selectAllAdminConstraintCategories(set: AdminCategorySet, get: AdminCategoryGet) {
  const allSelected = get().constraintCategories.map((category) =>
    buildSelectedCategory(category, category.file_name, category.weight),
  );
  set({ selectedConstraints: calculateSelectedCategories(allSelected) });
}

function clearAllAdminConstraintCategories(set: AdminCategorySet) {
  set({ selectedConstraints: [] });
}

function isAdminConstraintSelected(get: AdminCategoryGet, id: number) {
  return get().selectedConstraints.some((item) => item.id === id);
}

function getAdminConstraintCategoryInfluence(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedConstraints.find((item) => item.id === id);
  if (selectedCategory) {
    return parseFloat(selectedCategory.Influence);
  }

  const category = get().constraintCategories.find((item) => item.id === id);
  return category ? category.weight : 0;
}

function getAdminConstraintCategoryWeight(get: AdminCategoryGet, id: number) {
  const selectedCategory = get().selectedConstraints.find((item) => item.id === id);
  if (selectedCategory?.weight) {
    return parseFloat(selectedCategory.weight);
  }

  return 0;
}

// ----- Shared -----

function setAdminMarProcess(set: AdminCategorySet, value: boolean) {
  set({ marProcess: value });
}

function setAdminTableData(set: AdminCategorySet, value: DataRow[]) {
  set({
    tableData: value,
    villageRiskCounts: buildPriorityRiskCounts(value),
  });
}

function resetAdminCategoryStore(set: AdminCategorySet) {
  set({
    selectedConditions: [],
    selectedConstraints: [],
    marProcess: false,
    tableData: [],
    villageRiskCounts: { ...EMPTY_PRIORITY_RISK_COUNTS },
    error: null,
  });
}


export const useAdminCategoryStore = create<AdminCategoryStore>((set, get) => ({
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
  
  initialize: () => initializeAdminCategoryStore(set, get),
  refreshCategories: () => refreshAdminCategories(set),
  
  toggleConditionCategory: (id, fileName) => toggleAdminConditionCategory(set, get, id, fileName),
  updateConditionCategoryInfluence: (id, fileName, influence) =>
    updateAdminConditionCategoryInfluence(set, get, id, fileName, influence),
  selectAllConditionCategories: () => selectAllAdminConditionCategories(set, get),
  clearAllConditionCategories: () => clearAllAdminConditionCategories(set),
  isConditionSelected: (id) => isAdminConditionSelected(get, id),
  getConditionCategoryInfluence: (id) => getAdminConditionCategoryInfluence(get, id),
  getConditionCategoryWeight: (id) => getAdminConditionCategoryWeight(get, id),
  
  toggleConstraintCategory: (id, fileName) => toggleAdminConstraintCategory(set, get, id, fileName),
  updateConstraintCategoryInfluence: (id, fileName, influence) =>
    updateAdminConstraintCategoryInfluence(set, get, id, fileName, influence),
  selectAllConstraintCategories: () => selectAllAdminConstraintCategories(set, get),
  clearAllConstraintCategories: () => clearAllAdminConstraintCategories(set),
  isConstraintSelected: (id) => isAdminConstraintSelected(get, id),
  getConstraintCategoryInfluence: (id) => getAdminConstraintCategoryInfluence(get, id),
  getConstraintCategoryWeight: (id) => getAdminConstraintCategoryWeight(get, id),
  
  setMarProcess: (value) => setAdminMarProcess(set, value),
  setTableData: (value) => setAdminTableData(set, value),
  reset: () => resetAdminCategoryStore(set),
}));
