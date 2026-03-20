import { useConnectionStore } from "@/stores/connectionStore";
import { useTabStore } from "@/stores/tabStore";
import * as connectionApi from "@/api/connection";
import * as databaseApi from "@/api/database";
import type { ConnectionConfig } from "@/types/connection";

export function useConnection() {
  const store = useConnectionStore();

  const connectToServer = async (config: ConnectionConfig) => {
    await connectionApi.connect(config);
    store.setActiveConnection(config.id, config);
    const databases = await databaseApi.listDatabases(config.id);
    store.setDatabases(config.id, databases);
  };

  const disconnectFromServer = async (connectionId: string) => {
    await connectionApi.disconnect(connectionId);
    store.removeActiveConnection(connectionId);
    // Close all tabs belonging to this connection
    const tabStore = useTabStore.getState();
    const tabsToRemove = tabStore.tabs.filter((t) => t.connectionId === connectionId);
    for (const tab of tabsToRemove) {
      tabStore.removeTab(tab.id);
    }
  };

  const testConnectionConfig = async (config: ConnectionConfig) => {
    return connectionApi.testConnection(config);
  };

  const loadCollections = async (connectionId: string, database: string) => {
    // Step 1: Fast — load just the collection names
    const collections = await databaseApi.listCollections(connectionId, database);
    collections.sort((a, b) => a.name.localeCompare(b.name));
    store.setCollections(connectionId, database, collections);

    // Step 2: Async — load stats for each collection in parallel, updating UI as each completes
    const BATCH_SIZE = 5;
    for (let i = 0; i < collections.length; i += BATCH_SIZE) {
      const batch = collections.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (col) => {
        try {
          const stats = await databaseApi.getCollectionStats(connectionId, database, col.name);
          useConnectionStore.getState().updateCollectionInfo(connectionId, database, col.name, {
            docCount: stats.count,
            size: stats.size,
          });
        } catch {
          // Silently skip — some collections (views, etc.) may not support collStats
        }
      });
      await Promise.all(promises);
    }
  };

  return {
    ...store,
    connectToServer,
    disconnectFromServer,
    testConnectionConfig,
    loadCollections,
  };
}
