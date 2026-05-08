import { create } from "zustand";

interface GeneralUiState {
  isRightPanelOpen: boolean;
  isDownloadingRaster: boolean;
  isDownloadingReport: boolean;
  toastMessage: string | null;
  toastType: "success" | "error" | "info" | null;
  
  setRightPanelOpen: (isOpen: boolean) => void;
  setDownloadingRaster: (isDownloading: boolean) => void;
  setDownloadingReport: (isDownloading: boolean) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  clearToast: () => void;
}

export const useGeneralUiStore = create<GeneralUiState>((set) => ({
  isRightPanelOpen: false,
  isDownloadingRaster: false,
  isDownloadingReport: false,
  toastMessage: null,
  toastType: null,

  setRightPanelOpen: (isOpen: boolean) => set({ isRightPanelOpen: isOpen }),
  setDownloadingRaster: (isDownloading) => set({ isDownloadingRaster: isDownloading }),
  setDownloadingReport: (isDownloading) => set({ isDownloadingReport: isDownloading }),
  
  showToast: (message, type) => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => {
      set((state) => (state.toastMessage === message ? { toastMessage: null, toastType: null } : state));
    }, 4000);
  },

  clearToast: () => set({ toastMessage: null, toastType: null }),
}));
