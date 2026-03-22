import { create } from "zustand";

interface EditorContent {
  content: string;
  cursorLine: number;
  cursorColumn: number;
  dirty: boolean;
}

interface EditorState {
  editors: Map<string, EditorContent>;
  setContent: (tabId: string, content: string) => void;
  setCursor: (tabId: string, line: number, column: number) => void;
  setDirty: (tabId: string, dirty: boolean) => void;
  removeEditor: (tabId: string) => void;
  getEditor: (tabId: string) => EditorContent | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editors: new Map(),
  setContent: (tabId, content) =>
    set((state) => {
      const next = new Map(state.editors);
      const current = next.get(tabId) ?? {
        content: "",
        cursorLine: 1,
        cursorColumn: 1,
        dirty: false,
      };
      next.set(tabId, { ...current, content, dirty: true });
      return { editors: next };
    }),
  setCursor: (tabId, line, column) =>
    set((state) => {
      const next = new Map(state.editors);
      const current = next.get(tabId);
      if (current) {
        next.set(tabId, { ...current, cursorLine: line, cursorColumn: column });
      }
      return { editors: next };
    }),
  setDirty: (tabId, dirty) =>
    set((state) => {
      const next = new Map(state.editors);
      const current = next.get(tabId);
      if (current) {
        next.set(tabId, { ...current, dirty });
      }
      return { editors: next };
    }),
  removeEditor: (tabId) =>
    set((state) => {
      const next = new Map(state.editors);
      next.delete(tabId);
      return { editors: next };
    }),
  getEditor: (tabId) => get().editors.get(tabId),
}));
