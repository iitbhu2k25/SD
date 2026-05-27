import { create } from "zustand";
import type { TechnologyAreaSubmitValues } from "../../components/StpTechnologyDss";

interface ManualUiStoreState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
  reportLoading: boolean;
  treatmentLoading: boolean;
  isPdfGenerating: boolean;
  showPdfStatus: boolean;
  taskId: string | null;
  showDssWorkflow: boolean;
  pendingTechnologyValues: TechnologyAreaSubmitValues | null;
}

interface ManualUiStoreActions {
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
  setShowDssWorkflow: (show: boolean) => void;
  setPendingTechnologyValues: (values: TechnologyAreaSubmitValues | null) => void;
}

export const useManualUiStore = create<ManualUiStoreState & ManualUiStoreActions>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  reportLoading: false,
  treatmentLoading: false,
  isPdfGenerating: false,
  showPdfStatus: false,
  taskId: null,
  showDssWorkflow: false,
  pendingTechnologyValues: null,
  toggleCategoriesEditable: () =>
    set((state) => ({ categoriesEditable: !state.categoriesEditable })),
  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  startReportFlow: () =>
    set({ reportLoading: true, isPdfGenerating: true, showPdfStatus: false, taskId: null }),
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
  setShowDssWorkflow: (show) => set({ showDssWorkflow: show }),
  setPendingTechnologyValues: (pendingTechnologyValues) => set({ pendingTechnologyValues }),
}));
