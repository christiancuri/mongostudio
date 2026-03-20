import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import type { ConnectionConfig } from "@/types/connection";
import type { DatabaseInfo, CollectionInfo } from "@/types/database";

const STORE_FILE = "connections.json";
const STORE_KEY = "savedConnections";

// Persist saved connections to disk via tauri-plugin-store
async function persistConnections(connections: ConnectionConfig[]) {
  try {
    const store = await load(STORE_FILE);
    await store.set(STORE_KEY, connections);
    await store.save();
  } catch (e) {
    console.error("Failed to persist connections:", e);
  }
}

async function loadConnections(): Promise<ConnectionConfig[]> {
  try {
    const store = await load(STORE_FILE);
    const data = await store.get<ConnectionConfig[]>(STORE_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

interface ConnectionState {
  savedConnections: ConnectionConfig[];
  activeConnections: Map<string, {
    config: ConnectionConfig;
    databases: DatabaseInfo[];
    collections: Map<string, CollectionInfo[]>;
    expanded: Set<string>;
  }>;
  loadSavedConnections: () => Promise<void>;
  setSavedConnections: (connections: ConnectionConfig[]) => void;
  addSavedConnection: (config: ConnectionConfig) => void;
  removeSavedConnection: (id: string) => void;
  updateSavedConnection: (config: ConnectionConfig) => void;
  setActiveConnection: (id: string, config: ConnectionConfig) => void;
  removeActiveConnection: (id: string) => void;
  setDatabases: (connectionId: string, databases: DatabaseInfo[]) => void;
  setCollections: (connectionId: string, database: string, collections: CollectionInfo[]) => void;
  updateCollectionInfo: (connectionId: string, database: string, collectionName: string, updates: Partial<CollectionInfo>) => void;
  toggleExpanded: (connectionId: string, path: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  savedConnections: [],
  activeConnections: new Map(),

  loadSavedConnections: async () => {
    const connections = await loadConnections();
    set({ savedConnections: connections });
  },

  setSavedConnections: (connections) => {
    set({ savedConnections: connections });
    persistConnections(connections);
  },

  addSavedConnection: (config) => {
    const next = [...get().savedConnections, config];
    set({ savedConnections: next });
    persistConnections(next);
  },

  removeSavedConnection: (id) => {
    const next = get().savedConnections.filter((c) => c.id !== id);
    set({ savedConnections: next });
    persistConnections(next);
  },

  updateSavedConnection: (config) => {
    const next = get().savedConnections.map((c) => (c.id === config.id ? config : c));
    set({ savedConnections: next });
    persistConnections(next);
  },

  setActiveConnection: (id, config) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      next.set(id, { config, databases: [], collections: new Map(), expanded: new Set() });
      return { activeConnections: next };
    }),

  removeActiveConnection: (id) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      next.delete(id);
      return { activeConnections: next };
    }),

  setDatabases: (connectionId, databases) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      const conn = next.get(connectionId);
      if (conn) {
        next.set(connectionId, { ...conn, databases });
      }
      return { activeConnections: next };
    }),

  setCollections: (connectionId, database, collections) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      const conn = next.get(connectionId);
      if (conn) {
        const cols = new Map(conn.collections);
        cols.set(database, collections);
        next.set(connectionId, { ...conn, collections: cols });
      }
      return { activeConnections: next };
    }),

  updateCollectionInfo: (connectionId, database, collectionName, updates) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      const conn = next.get(connectionId);
      if (conn) {
        const cols = new Map(conn.collections);
        const list = cols.get(database);
        if (list) {
          const updated = list.map((c) =>
            c.name === collectionName ? { ...c, ...updates } : c,
          );
          cols.set(database, updated);
          next.set(connectionId, { ...conn, collections: cols });
        }
      }
      return { activeConnections: next };
    }),

  toggleExpanded: (connectionId, path) =>
    set((state) => {
      const next = new Map(state.activeConnections);
      const conn = next.get(connectionId);
      if (conn) {
        const expanded = new Set(conn.expanded);
        if (expanded.has(path)) {
          expanded.delete(path);
        } else {
          expanded.add(path);
        }
        next.set(connectionId, { ...conn, expanded });
      }
      return { activeConnections: next };
    }),
}));
