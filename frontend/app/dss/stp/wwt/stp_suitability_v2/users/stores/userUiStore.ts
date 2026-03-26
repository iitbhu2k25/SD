import { create } from "zustand";

interface UserUiStoreState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
  reportLoading: boolean;
  treatmentLoading: boolean;
  isPdfGenerating: boolean;
  showPdfStatus: boolean;
  taskId: string | null;
}

interface UserUiStoreActions {
  toggleCategoriesEditable: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  startReportFlow: () => void;
  setReportTask: (taskId: string) => void;
  finishReportRequest: () => void;
  failReportFlow: () => void;
  setTreatmentLoading: (loading: boolean) => void;
  completePdfGeneration: () => void;
  failPdfGeneration: () => void;
}

export const useUserUiStore = create<UserUiStoreState & UserUiStoreActions>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  reportLoading: false,
  treatmentLoading: false,
  isPdfGenerating: false,
  showPdfStatus: false,
  taskId: null,
  toggleCategoriesEditable: () =>
    set((state) => ({ categoriesEditable: !state.categoriesEditable })),
  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  startReportFlow: () =>
    set({
      reportLoading: true,
      isPdfGenerating: true,
      showPdfStatus: false,
      taskId: null,
    }),
  setReportTask: (taskId) => set({ taskId, showPdfStatus: true }),
  finishReportRequest: () => set({ reportLoading: false }),
  failReportFlow: () =>
    set({
      reportLoading: false,
      treatmentLoading: false,
      isPdfGenerating: false,
      showPdfStatus: false,
      taskId: null,
    }),
  setTreatmentLoading: (treatmentLoading) => set({ treatmentLoading }),
  completePdfGeneration: () => set({ isPdfGenerating: false, showPdfStatus: false }),
  failPdfGeneration: () => set({ isPdfGenerating: false }),
}));
