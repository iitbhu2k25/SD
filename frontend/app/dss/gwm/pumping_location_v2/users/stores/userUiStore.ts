import { create } from "zustand";

interface UserUiState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
  toggleCategoriesEditable: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
}

export const useUserUiStore = create<UserUiState>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  toggleCategoriesEditable: () =>
    set((state) => ({ categoriesEditable: !state.categoriesEditable })),
  setRightPanelOpen: (isRightPanelOpen) => set({ isRightPanelOpen }),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}));
