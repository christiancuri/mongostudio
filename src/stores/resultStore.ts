import { create } from "zustand";
import type { QueryResult } from "@/types/query";

type ViewMode = "tree" | "table" | "json";

interface ResultState {
  results: Map<string, QueryResult>;
  viewMode: Map<string, ViewMode>;
  loading: Map<string, boolean>;
  executing: Map<string, boolean>;
  errors: Map<string, string>;
  setResult: (tabId: string, result: QueryResult) => void;
  setViewMode: (tabId: string, mode: ViewMode) => void;
  setLoading: (tabId: string, loading: boolean) => void;
  setExecuting: (tabId: string, executing: boolean) => void;
  setError: (tabId: string, error: string) => void;
  clearError: (tabId: string) => void;
  removeResult: (tabId: string) => void;
}

export const useResultStore = create<ResultState>((set) => ({
  results: new Map(),
  viewMode: new Map(),
  loading: new Map(),
  executing: new Map(),
  errors: new Map(),
  setResult: (tabId, result) =>
    set((state) => {
      const next = new Map(state.results);
      next.set(tabId, result);
      const errors = new Map(state.errors);
      errors.delete(tabId);
      return { results: next, errors };
    }),
  setViewMode: (tabId, mode) =>
    set((state) => {
      const next = new Map(state.viewMode);
      next.set(tabId, mode);
      return { viewMode: next };
    }),
  setLoading: (tabId, loading) =>
    set((state) => {
      const next = new Map(state.loading);
      next.set(tabId, loading);
      return { loading: next };
    }),
  setExecuting: (tabId, executing) =>
    set((state) => {
      const next = new Map(state.executing);
      next.set(tabId, executing);
      return { executing: next };
    }),
  setError: (tabId, error) =>
    set((state) => {
      const next = new Map(state.errors);
      next.set(tabId, error);
      return { errors: next };
    }),
  clearError: (tabId) =>
    set((state) => {
      const next = new Map(state.errors);
      next.delete(tabId);
      return { errors: next };
    }),
  removeResult: (tabId) =>
    set((state) => {
      const results = new Map(state.results);
      results.delete(tabId);
      const viewMode = new Map(state.viewMode);
      viewMode.delete(tabId);
      const loading = new Map(state.loading);
      loading.delete(tabId);
      const executing = new Map(state.executing);
      executing.delete(tabId);
      const errors = new Map(state.errors);
      errors.delete(tabId);
      return { results, viewMode, loading, executing, errors };
    }),
}));
