// Module-level UI mode store for GWZ Potential Zone V2.
// Shared by both admin and user flows, no Provider needed.
import { create } from "zustand";

interface UiModeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useUiModeService = create<UiModeState>((set) => ({
  isDark: false,
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
}));
