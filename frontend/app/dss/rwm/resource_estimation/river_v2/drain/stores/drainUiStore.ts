import { create } from "zustand";

interface DrainUiState {
  isRightPanelOpen: boolean;
  activeAnalysisTab: "sampling" | "summary" | "seasonal" | "graph" | "report";
  
  toastMessage: string | null;
  toastType: "success" | "error" | "info" | null;
  
  setRightPanelOpen: (isOpen: boolean) => void;
  setActiveAnalysisTab: (tab: "sampling" | "summary" | "seasonal" | "graph" | "report") => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  clearToast: () => void;
}

export const useDrainUiStore = create<DrainUiState>((set) => ({
  isRightPanelOpen: false,
  activeAnalysisTab: "sampling",
  toastMessage: null,
  toastType: null,

  setRightPanelOpen: (isOpen: boolean) => set({ isRightPanelOpen: isOpen }),
  
  setActiveAnalysisTab: (tab) => set({ activeAnalysisTab: tab }),

  showToast: (message, type) => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => {
      set((state) => (state.toastMessage === message ? { toastMessage: null, toastType: null } : state));
    }, 4000);
  },

  clearToast: () => set({ toastMessage: null, toastType: null }),
}));
