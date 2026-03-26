// This store keeps small screen state for the admin page.
// It tracks panel open/close state and report loading state.
import { create } from "zustand";

interface AdminUiStoreState {
  categoriesEditable: boolean;
  isRightPanelOpen: boolean;
  reportLoading: boolean;
  isPdfGenerating: boolean;
  showPdfStatus: boolean;
  taskId: string | null;
}

interface AdminUiStoreActions {
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

function startReportFlow(set: AdminUiSet) {
  set({
    reportLoading: true,
    isPdfGenerating: true,
    showPdfStatus: false,
    taskId: null,
  });
}

function setReportTask(set: AdminUiSet, taskId: string) {
  set({ taskId, showPdfStatus: true });
}

function finishReportRequest(set: AdminUiSet) {
  set({ reportLoading: false });
}

function failReportFlow(set: AdminUiSet) {
  set({
    reportLoading: false,
    isPdfGenerating: false,
    showPdfStatus: false,
    taskId: null,
  });
}

function completePdfGeneration(set: AdminUiSet) {
  set({
    isPdfGenerating: false,
    showPdfStatus: false,
  });
}

function failPdfGeneration(set: AdminUiSet) {
  set({ isPdfGenerating: false });
}

export const useAdminUiStore = create<AdminUiStore>((set) => ({
  categoriesEditable: false,
  isRightPanelOpen: false,
  reportLoading: false,
  isPdfGenerating: false,
  showPdfStatus: false,
  taskId: null,
  toggleCategoriesEditable: () => toggleCategoriesEditable(set),
  setRightPanelOpen: (open) => setRightPanelOpen(set, open),
  toggleRightPanel: () => toggleRightPanel(set),
  startReportFlow: () => startReportFlow(set),
  setReportTask: (taskId) => setReportTask(set, taskId),
  finishReportRequest: () => finishReportRequest(set),
  failReportFlow: () => failReportFlow(set),
  completePdfGeneration: () => completePdfGeneration(set),
  failPdfGeneration: () => failPdfGeneration(set),
}));
