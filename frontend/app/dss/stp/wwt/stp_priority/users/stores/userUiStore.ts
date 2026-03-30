import { create } from "zustand";

interface UserUiState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
  reportLoading: boolean;
  isPdfGenerating: boolean;
  showPdfStatus: boolean;
  taskId: string | null;
  toggleCategoriesEditable: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  startReportFlow: () => void;
  setReportTask: (taskId: string) => void;
  finishReportRequest: () => void;
  failReportFlow: () => void;
  completePdfGeneration: () => void;
  failPdfGeneration: () => void;
}

export const useUserUiStore = create<UserUiState>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  reportLoading: false,
  isPdfGenerating: false,
  showPdfStatus: false,
  taskId: null,
  toggleCategoriesEditable: () =>
    set((s) => ({ categoriesEditable: !s.categoriesEditable })),
  setRightPanelOpen: (isRightPanelOpen) => set({ isRightPanelOpen }),
  toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
  startReportFlow: () =>
    set({ reportLoading: true, isPdfGenerating: true, showPdfStatus: false, taskId: null }),
  setReportTask: (taskId) => set({ taskId, showPdfStatus: true }),
  finishReportRequest: () => set({ reportLoading: false }),
  failReportFlow: () =>
    set({ reportLoading: false, isPdfGenerating: false, showPdfStatus: false, taskId: null }),
  completePdfGeneration: () => set({ isPdfGenerating: false, showPdfStatus: false }),
  failPdfGeneration: () => set({ isPdfGenerating: false }),
}));
