import { create } from "zustand";

interface Settings {
  theme: "dark" | "light";
  defaultPageSize: number;
  editorFontSize: number;
  editorTabSize: number;
  autoCompleteEnabled: boolean;
}

interface SettingsState {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: {
    theme: "dark",
    defaultPageSize: 50,
    editorFontSize: 14,
    editorTabSize: 2,
    autoCompleteEnabled: true,
  },
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),
}));
