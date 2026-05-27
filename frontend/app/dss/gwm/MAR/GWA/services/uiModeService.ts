import { create } from "zustand";

interface UiModeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useUiModeService = create<UiModeState>((set) => ({
  isDark: false,
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
}));
