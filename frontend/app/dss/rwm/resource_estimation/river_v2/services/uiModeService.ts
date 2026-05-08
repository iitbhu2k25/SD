import { create } from "zustand";

interface UiModeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useUiModeStore = create<UiModeState>((set) => ({
  isDark: false, // Default to light mode as requested
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setTheme: (isDark) => set({ isDark }),
}));
