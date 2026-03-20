import { create } from "zustand";

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  connectionId?: string;
  database?: string;
  collection?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface QueryLibraryState {
  queries: SavedQuery[];
  addQuery: (query: SavedQuery) => void;
  removeQuery: (id: string) => void;
  updateQuery: (id: string, updates: Partial<SavedQuery>) => void;
  setQueries: (queries: SavedQuery[]) => void;
}

export const useQueryLibraryStore = create<QueryLibraryState>((set) => ({
  queries: [],
  addQuery: (query) => set((state) => ({ queries: [...state.queries, query] })),
  removeQuery: (id) => set((state) => ({ queries: state.queries.filter((q) => q.id !== id) })),
  updateQuery: (id, updates) =>
    set((state) => ({
      queries: state.queries.map((q) => (q.id === id ? { ...q, ...updates } : q)),
    })),
  setQueries: (queries) => set({ queries }),
}));
