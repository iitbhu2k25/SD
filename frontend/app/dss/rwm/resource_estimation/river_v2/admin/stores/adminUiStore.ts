import { create } from "zustand";

interface AdminUiState {
  isRightPanelOpen: boolean;
  activeAnalysisTab: "sampling" | "summary" | "seasonal" | "graph" | "report";
  
  // Toast / Status messaging
  toastMessage: string | null;
  toastType: "success" | "error" | "info" | null;
  
  // Actions
  setRightPanelOpen: (isOpen: boolean) => void;
  setActiveAnalysisTab: (tab: "sampling" | "summary" | "seasonal" | "graph" | "report") => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  clearToast: () => void;
}

export const useAdminUiStore = create<AdminUiState>((set) => ({
  isRightPanelOpen: false,
  activeAnalysisTab: "sampling",
  toastMessage: null,
  toastType: null,

  setRightPanelOpen: (isOpen: boolean) => set({ isRightPanelOpen: isOpen }),
  
  setActiveAnalysisTab: (tab) => set({ activeAnalysisTab: tab }),

  showToast: (message, type) => {
    set({ toastMessage: message, toastType: type });
    // Auto clear after 4 seconds
    setTimeout(() => {
      set((state) => (state.toastMessage === message ? { toastMessage: null, toastType: null } : state));
    }, 4000);
  },

  clearToast: () => set({ toastMessage: null, toastType: null }),
}));
