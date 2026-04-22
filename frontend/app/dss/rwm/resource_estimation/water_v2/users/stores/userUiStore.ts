// Holds user (basin) UI workflow state.
import { create } from "zustand";
import { WaterRasterResponse } from "../../services/waterApi";

export interface UserExportData {
  rasterResult: WaterRasterResponse;
  river: number | null;
  stretch: number | null;
  drain: number;
  riverName: string;
  year: number[];
  season: string;
  productType: string;
  timeScale: string;
}

interface UserUiState {
  exportData: UserExportData | null;
  reportLoading: boolean;
  rightPanelUnlocked: boolean;
}

interface UserUiActions {
  setExportData: (data: UserExportData | null) => void;
  setReportLoading: (loading: boolean) => void;
  unlockRightPanel: () => void;
  resetUiState: () => void;
}

export type UserUiStore = UserUiState & UserUiActions;

export const useUserUiStore = create<UserUiStore>((set) => ({
  exportData: null,
  reportLoading: false,
  rightPanelUnlocked: false,

  setExportData: (data) => set({ exportData: data }),
  setReportLoading: (loading) => set({ reportLoading: loading }),
  unlockRightPanel: () => set({ rightPanelUnlocked: true }),

  resetUiState: () => {
    set({
      exportData: null,
      reportLoading: false,
      rightPanelUnlocked: false,
    });
  },
}));
