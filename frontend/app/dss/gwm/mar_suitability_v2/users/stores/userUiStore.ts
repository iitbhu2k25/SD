import { create } from "zustand";

interface UserUiStoreState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
}

interface UserUiStoreActions {
  toggleCategoriesEditable: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
}

export type UserUiStore = UserUiStoreState & UserUiStoreActions;

type UserUiSet = (
  partial:
    | Partial<UserUiStore>
    | ((state: UserUiStore) => Partial<UserUiStore>),
) => void;

function toggleCategoriesEditable(set: UserUiSet) {
  set((state) => ({ categoriesEditable: !state.categoriesEditable }));
}

function setRightPanelOpen(set: UserUiSet, open: boolean) {
  set({ isRightPanelOpen: open });
}

function toggleRightPanel(set: UserUiSet) {
  set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen }));
}

export const useUserUiStore = create<UserUiStore>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  toggleCategoriesEditable: () => toggleCategoriesEditable(set),
  setRightPanelOpen: (open) => setRightPanelOpen(set, open),
  toggleRightPanel: () => toggleRightPanel(set),
}));
