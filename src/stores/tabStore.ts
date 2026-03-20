import { create } from "zustand";
import type { Tab } from "@/types/tab";

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setTabs: (tabs: Tab[], activeTabId: string | null) => void;
}

export const useTabStore = create<TabState>((set) => ({
  tabs: [],
  activeTabId: null,
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),
  removeTab: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        const idx = state.tabs.findIndex((t) => t.id === id);
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null;
      }
      return { tabs, activeTabId };
    }),
  setActiveTab: (id) => set({ activeTabId: id }),
  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    }),
  setTabs: (tabs, activeTabId) => set({ tabs, activeTabId }),
}));
