import { create } from "zustand";

interface GeneralUiState {
  isRightPanelOpen: boolean;
  toastMessage: string | null;
  toastType: "success" | "error" | "info" | null;
  
  setRightPanelOpen: (isOpen: boolean) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  clearToast: () => void;
}

export const useGeneralUiStore = create<GeneralUiState>((set) => ({
  isRightPanelOpen: false,
  toastMessage: null,
  toastType: null,

  setRightPanelOpen: (isOpen: boolean) => set({ isRightPanelOpen: isOpen }),
  
  showToast: (message, type) => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => {
      set((state) => (state.toastMessage === message ? { toastMessage: null, toastType: null } : state));
    }, 4000);
  },

  clearToast: () => set({ toastMessage: null, toastType: null }),
}));
