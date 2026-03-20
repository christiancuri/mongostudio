import { loadSession, setRestoring } from "./sessionPersistence";
import { useTabStore } from "@/stores/tabStore";
import { useEditorStore } from "@/stores/editorStore";
import { useConnectionStore } from "@/stores/connectionStore";
import * as connectionApi from "@/api/connection";
import * as databaseApi from "@/api/database";
import { toast } from "sonner";

export async function restoreSession(): Promise<void> {
  const session = await loadSession();
  if (!session) return;

  setRestoring(true);

  try {
    // 1. Restore tabs (bulk set to avoid triggering activeTabId on each add)
    const tabStore = useTabStore.getState();
    if (session.tabs.length > 0) {
      tabStore.setTabs(session.tabs, session.activeTabId);
    }

    // 2. Restore editor contents
    const editorStore = useEditorStore.getState();
    for (const [tabId, content] of Object.entries(session.editorContents)) {
      if (content) {
        editorStore.setContent(tabId, content);
        editorStore.setDirty(tabId, false);
      }
    }

    // 3. Reconnect to previously active connections
    const connStore = useConnectionStore.getState();
    for (const connId of session.activeConnectionIds) {
      const savedConfig = connStore.savedConnections.find((c) => c.id === connId);
      if (!savedConfig) continue;

      try {
        await connectionApi.connect(savedConfig);
        connStore.setActiveConnection(connId, savedConfig);

        // Load databases
        const databases = await databaseApi.listDatabases(connId);
        connStore.setDatabases(connId, databases);

        // Restore expanded paths
        const expandedPaths = session.expandedPaths[connId] ?? [];
        for (const path of expandedPaths) {
          const conn = useConnectionStore.getState().activeConnections.get(connId);
          if (conn && !conn.expanded.has(path)) {
            connStore.toggleExpanded(connId, path);
          }
        }

        // Load collections for expanded databases
        for (const path of expandedPaths) {
          // A database path has no "/" -- paths like "myDb" are databases
          if (!path.includes("/")) {
            try {
              const collections = await databaseApi.listCollections(connId, path);
              collections.sort((a, b) => a.name.localeCompare(b.name));
              connStore.setCollections(connId, path, collections);

              // Load stats async (non-blocking)
              loadCollectionStatsAsync(connId, path, collections.map((c) => c.name));
            } catch {
              // Skip if we can't load collections for this database
            }
          }
        }

        toast.success(`Reconnected to ${savedConfig.name}`);
      } catch (err) {
        toast.error(`Failed to reconnect to ${savedConfig.name}`, {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    setRestoring(false);
  }
}

async function loadCollectionStatsAsync(
  connectionId: string,
  database: string,
  collectionNames: string[],
): Promise<void> {
  const BATCH_SIZE = 5;
  for (let i = 0; i < collectionNames.length; i += BATCH_SIZE) {
    const batch = collectionNames.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (name) => {
      try {
        const stats = await databaseApi.getCollectionStats(connectionId, database, name);
        useConnectionStore.getState().updateCollectionInfo(connectionId, database, name, {
          docCount: stats.count,
          size: stats.size,
        });
      } catch {
        // Skip -- some collections (views, etc.) may not support collStats
      }
    });
    await Promise.all(promises);
  }
}
