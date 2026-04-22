// Cross-module Zustand store for light/dark theme state.
// Shared by all components across both admin and user modes.
import { create } from "zustand";

interface UiModeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useUiModeService = create<UiModeState>((set) => ({
  isDark: false,
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
}));
