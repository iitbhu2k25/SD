// Holds admin UI workflow state: export readiness, report loading, right panel unlock.
import { create } from "zustand";
import { WaterRasterResponse } from "../../services/waterApi";

export interface AdminExportData {
  rasterResult: WaterRasterResponse;
  subDistrictCodes: number[];
  stateName: string;
  districtNames: string[];
  subDistrictNames: string[];
  year: number[];
  season: string;
  productType: string;
  timeScale: string;
}

interface AdminUiState {
  exportData: AdminExportData | null;
  reportLoading: boolean;
  rightPanelUnlocked: boolean;
}

interface AdminUiActions {
  setExportData: (data: AdminExportData | null) => void;
  setReportLoading: (loading: boolean) => void;
  unlockRightPanel: () => void;
  resetUiState: () => void;
}

export type AdminUiStore = AdminUiState & AdminUiActions;

export const useAdminUiStore = create<AdminUiStore>((set) => ({
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
