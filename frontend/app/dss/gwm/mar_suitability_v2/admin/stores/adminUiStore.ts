import { create } from "zustand";

interface AdminUiStoreState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
}

interface AdminUiStoreActions {
  toggleCategoriesEditable: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
}

export type AdminUiStore = AdminUiStoreState & AdminUiStoreActions;

type AdminUiSet = (
  partial:
    | Partial<AdminUiStore>
    | ((state: AdminUiStore) => Partial<AdminUiStore>),
) => void;

function toggleCategoriesEditable(set: AdminUiSet) {
  set((state) => ({ categoriesEditable: !state.categoriesEditable }));
}

function setRightPanelOpen(set: AdminUiSet, open: boolean) {
  set({ isRightPanelOpen: open });
}

function toggleRightPanel(set: AdminUiSet) {
  set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen }));
}

export const useAdminUiStore = create<AdminUiStore>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  toggleCategoriesEditable: () => toggleCategoriesEditable(set),
  setRightPanelOpen: (open) => setRightPanelOpen(set, open),
  toggleRightPanel: () => toggleRightPanel(set),
}));
