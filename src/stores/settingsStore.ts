import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";

export type ThemeId = "system" | "dark" | "light" | "emerald" | "vscode-dark";

interface Settings {
  theme: ThemeId;
  defaultPageSize: number;
  editorFontSize: number;
  editorTabSize: number;
  autoCompleteEnabled: boolean;
}

interface SettingsState {
  settings: Settings;
  /** The resolved theme (never "system" — always the actual theme being used) */
  resolvedTheme: Exclude<ThemeId, "system">;
  updateSettings: (updates: Partial<Settings>) => void;
  loadSettings: () => Promise<void>;
}

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: ThemeId): Exclude<ThemeId, "system"> {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(resolved: Exclude<ThemeId, "system">) {
  if (resolved === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", resolved);
  }
}

async function persistSettings(settings: Settings) {
  try {
    const store = await load("settings.json");
    await store.set("settings", settings);
    await store.save();
  } catch {
    // Persistence is best-effort
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    theme: "system",
    defaultPageSize: 50,
    editorFontSize: 14,
    editorTabSize: 2,
    autoCompleteEnabled: true,
  },
  resolvedTheme: resolveTheme("system"),
  updateSettings: (updates) => {
    set((state) => {
      const next = { ...state.settings, ...updates };
      const resolved = resolveTheme(next.theme);
      applyTheme(resolved);
      persistSettings(next);
      return { settings: next, resolvedTheme: resolved };
    });
  },
  loadSettings: async () => {
    try {
      const store = await load("settings.json");
      const saved = await store.get<Settings>("settings");
      if (saved) {
        // Migrate old theme names
        if ((saved.theme as string) === "nosqlbooster") saved.theme = "dark";
        const resolved = resolveTheme(saved.theme);
        applyTheme(resolved);
        set({ settings: { ...get().settings, ...saved }, resolvedTheme: resolved });
      } else {
        // First run — apply system default
        const resolved = resolveTheme("system");
        applyTheme(resolved);
        set({ resolvedTheme: resolved });
      }
    } catch {
      const resolved = resolveTheme("system");
      applyTheme(resolved);
      set({ resolvedTheme: resolved });
    }

    // Listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const { settings } = get();
      if (settings.theme === "system") {
        const resolved = resolveTheme("system");
        applyTheme(resolved);
        set({ resolvedTheme: resolved });
      }
    });
  },
}));
