import * as databaseApi from "@/api/database";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useConnection } from "@/hooks/useConnection";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTabStore } from "@/stores/tabStore";
import type { ConnectionConfig } from "@/types/connection";
import { dbCol } from "@/utils/mongo";
import { buildConnectionString } from "@/utils/uriParser";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Key,
  KeyRound,
  Link,
  Loader2,
  Pencil,
  RefreshCw,
  Server,
  Table2,
  Terminal,
  Unplug,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConnectionEditDialog } from "./ConnectionEditDialog";

interface IndexEntry {
  name: string;
  size?: number;
  unique?: boolean;
  keys?: Record<string, unknown>;
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return "?";
  return n.toLocaleString();
}

function getConnectionDisplayName(config: ConnectionConfig): string {
  const host = config.uri.hosts[0]?.host ?? "localhost";
  const user = config.uri.username;
  const label = config.name || host;
  const name = user ? `${user}@${label}` : label;
  const suffix = config.connectionType === "replica" ? " (replica)" : "";
  return `${name}${suffix}`;
}

export function ConnectionTree() {
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const { disconnectFromServer, loadCollections } = useConnection();
  const addTab = useTabStore((s) => s.addTab);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [indexCache, setIndexCache] = useState<Map<string, IndexEntry[]>>(new Map());

  const setLoading = useCallback((path: string, loading: boolean) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (loading) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const handleRefreshServer = useCallback(
    async (connectionId: string) => {
      setLoading(connectionId, true);
      try {
        const databases = await databaseApi.listDatabases(connectionId);
        useConnectionStore.getState().setDatabases(connectionId, databases);
        toast.success("Server refreshed");
      } catch (err) {
        toast.error("Failed to refresh", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(connectionId, false);
      }
    },
    [setLoading],
  );

  const handleToggleDb = useCallback(
    async (connectionId: string, dbName: string) => {
      const conn = useConnectionStore.getState().activeConnections.get(connectionId);
      if (!conn) return;

      const isExpanded = conn.expanded.has(dbName);
      if (isExpanded) {
        useConnectionStore.getState().toggleExpanded(connectionId, dbName);
        return;
      }

      const path = `${connectionId}/${dbName}`;
      setLoading(path, true);
      try {
        await loadCollections(connectionId, dbName);
        useConnectionStore.getState().toggleExpanded(connectionId, dbName);
      } catch (err) {
        toast.error(`Failed to load collections for ${dbName}`, {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(path, false);
      }
    },
    [loadCollections, setLoading],
  );

  const handleToggleCollection = useCallback(
    (connectionId: string, dbName: string, colName: string) => {
      const path = `${dbName}/${colName}`;
      useConnectionStore.getState().toggleExpanded(connectionId, path);
    },
    [],
  );

  const handleToggleIndexes = useCallback(
    async (connectionId: string, dbName: string, colName: string) => {
      const indexPath = `${dbName}/${colName}/indexes`;
      const conn = useConnectionStore.getState().activeConnections.get(connectionId);
      if (!conn) return;

      const isExpanded = conn.expanded.has(indexPath);
      if (isExpanded) {
        useConnectionStore.getState().toggleExpanded(connectionId, indexPath);
        return;
      }

      const cacheKey = `${connectionId}/${indexPath}`;
      if (!indexCache.has(cacheKey)) {
        setLoading(cacheKey, true);
        try {
          const rawIndexes = await databaseApi.listIndexes(connectionId, dbName, colName);
          const entries: IndexEntry[] = rawIndexes.map((idx) => ({
            name: (idx.name as string) ?? "unknown",
            size: typeof idx.size === "number" ? idx.size : undefined,
            unique: typeof idx.unique === "boolean" ? idx.unique : undefined,
            keys: (idx.keys as Record<string, unknown>) ?? undefined,
          }));
          setIndexCache((prev) => {
            const next = new Map(prev);
            next.set(cacheKey, entries);
            return next;
          });
        } catch (err) {
          toast.error(`Failed to load indexes for ${colName}`, {
            description: err instanceof Error ? err.message : String(err),
          });
          return;
        } finally {
          setLoading(cacheKey, false);
        }
      }

      useConnectionStore.getState().toggleExpanded(connectionId, indexPath);
    },
    [indexCache, setLoading],
  );

  const handleOpenQuery = useCallback(
    (connectionId: string, database: string, collection: string, colorFlag?: string) => {
      addTab({
        id: crypto.randomUUID(),
        title: collection,
        type: "query",
        connectionId,
        database,
        collection,
        content: `${dbCol(collection)}.find({})\n    .projection({})\n    .sort({_id:-1})\n    .limit(0)`,
        dirty: false,
        colorFlag,
      });
    },
    [addTab],
  );

  const handleOpenIndexes = useCallback(
    async (connectionId: string, database: string, collection: string, colorFlag?: string) => {
      const tabId = crypto.randomUUID();
      const col = dbCol(collection);
      addTab({
        id: tabId,
        title: `${collection} – Indexes`,
        type: "query",
        connectionId,
        database,
        collection,
        content: `// Indexes for ${collection}\n${col}.getIndexes()`,
        dirty: false,
        colorFlag,
      });

      // Fetch indexes detail and show as results
      const { useResultStore } = await import("@/stores/resultStore");
      const resultStore = useResultStore.getState();
      resultStore.setLoading(tabId, true);
      resultStore.setViewMode(tabId, "table");
      try {
        const start = performance.now();
        const indexes = await databaseApi.getIndexesDetail(connectionId, database, collection);
        const elapsed = Math.round(performance.now() - start);
        resultStore.setResult(tabId, {
          documents: indexes as Record<string, unknown>[],
          totalCount: indexes.length,
          executionTimeMs: elapsed,
          page: 1,
          pageSize: 50,
        });
      } catch (err) {
        resultStore.setError(tabId, err instanceof Error ? err.message : String(err));
      } finally {
        resultStore.setLoading(tabId, false);
      }
    },
    [addTab],
  );

  const handleOpenIndexInfo = useCallback(
    async (
      connectionId: string,
      database: string,
      collection: string,
      indexName: string,
      colorFlag?: string,
    ) => {
      const tabId = crypto.randomUUID();
      const col = dbCol(collection);
      addTab({
        id: tabId,
        title: `${collection} – ${indexName}`,
        type: "query",
        connectionId,
        database,
        collection,
        content: `// Index info: ${indexName}\n${col}.getIndexes().find(it => it.name === "${indexName}")`,
        dirty: false,
        colorFlag,
      });

      // Fetch single index info and show as tree result
      const { useResultStore } = await import("@/stores/resultStore");
      const resultStore = useResultStore.getState();
      resultStore.setLoading(tabId, true);
      resultStore.setViewMode(tabId, "tree");
      try {
        const start = performance.now();
        const info = await databaseApi.getIndexInfo(connectionId, database, collection, indexName);
        const elapsed = Math.round(performance.now() - start);
        resultStore.setResult(tabId, {
          documents: [info],
          totalCount: 1,
          executionTimeMs: elapsed,
          page: 1,
          pageSize: 50,
        });
      } catch (err) {
        resultStore.setError(tabId, err instanceof Error ? err.message : String(err));
      } finally {
        resultStore.setLoading(tabId, false);
      }
    },
    [addTab],
  );

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      try {
        await disconnectFromServer(connectionId);
        toast.success("Disconnected");
      } catch (err) {
        toast.error("Failed to disconnect", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [disconnectFromServer],
  );

  // Connection editor dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; config: ConnectionConfig | null }>({
    open: false,
    config: null,
  });

  const handleOpenShellTab = useCallback(
    (connectionId: string, colorFlag?: string) => {
      addTab({
        id: crypto.randomUUID(),
        title: "Shell",
        type: "query",
        connectionId,
        dirty: false,
        content: "// MongoDB Shell\n",
        colorFlag,
      });
    },
    [addTab],
  );

  const handleShowUri = useCallback((config: ConnectionConfig) => {
    const uri = buildConnectionString(config);
    navigator.clipboard.writeText(uri);
    toast.success("Connection URI copied to clipboard", { description: uri });
  }, []);

  const handleCopyName = useCallback((config: ConnectionConfig) => {
    const name = getConnectionDisplayName(config);
    navigator.clipboard.writeText(name);
    toast.success("Name copied");
  }, []);

  const handleDisconnectAll = useCallback(async () => {
    const ids = Array.from(activeConnections.keys());
    for (const cid of ids) {
      try {
        await disconnectFromServer(cid);
      } catch {
        // continue disconnecting others
      }
    }
    toast.success("All connections disconnected");
  }, [activeConnections, disconnectFromServer]);

  const handleEditConnection = useCallback((config: ConnectionConfig) => {
    setEditDialog({ open: true, config: { ...config } });
  }, []);

  const handleEditSave = useCallback((config: ConnectionConfig) => {
    useConnectionStore.getState().updateSavedConnection(config);
    setEditDialog({ open: false, config: null });
    toast.success("Connection updated");
  }, []);

  if (activeConnections.size === 0) {
    return null;
  }

  return (
    <div className="pb-2">
      {Array.from(activeConnections.entries()).map(([id, conn]) => {
        const isServerLoading = loadingPaths.has(id);
        return (
          <div key={id}>
            {/* Server node */}
            <ContextMenu>
              <ContextMenuTrigger>
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-border/50 cursor-pointer">
                  {isServerLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Server className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span
                    className="whitespace-nowrap font-medium"
                    style={{ color: getColorHex(conn.config.colorFlag) }}
                  >
                    {getConnectionDisplayName(conn.config)}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      ({conn.databases.length} db{conn.databases.length !== 1 ? "s" : ""})
                    </span>
                  </span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleOpenShellTab(id, conn.config.colorFlag)}>
                  <Terminal className="mr-2 h-3 w-3" />
                  Open New Shell Tab
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleShowUri(conn.config)}>
                  <Link className="mr-2 h-3 w-3" />
                  Show Connection URI
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyName(conn.config)}>
                  <Copy className="mr-2 h-3 w-3" />
                  Copy Name
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleEditConnection(conn.config)}>
                  <Pencil className="mr-2 h-3 w-3" />
                  Open Connection Editor...
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleDisconnect(id)}>
                  <Unplug className="mr-2 h-3 w-3" />
                  Disconnect
                </ContextMenuItem>
                {activeConnections.size > 1 && (
                  <ContextMenuItem onClick={handleDisconnectAll}>
                    <Unplug className="mr-2 h-3 w-3" />
                    Disconnect All
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleRefreshServer(id)}>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Refresh
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {/* Database nodes */}
            {conn.databases.map((db) => {
              const isExpanded = conn.expanded.has(db.name);
              const collections = conn.collections.get(db.name) ?? [];
              const dbPath = `${id}/${db.name}`;
              const isDbLoading = loadingPaths.has(dbPath);

              return (
                <div key={db.name}>
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-1.5 pl-5 pr-2 py-0.5 text-xs hover:bg-sidebar-border/50",
                          !db.accessible && "opacity-50",
                        )}
                        onClick={() => handleToggleDb(id, db.name)}
                      >
                        {isDbLoading ? (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        {isExpanded ? (
                          <Database className="h-3 w-3 shrink-0 text-yellow-500" />
                        ) : (
                          <Database className="h-3 w-3 shrink-0 text-yellow-600" />
                        )}
                        <span className="whitespace-nowrap">
                          {db.name}
                          {(isExpanded && collections.length > 0) || db.sizeOnDisk != null ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({isExpanded ? `${collections.length} | ` : ""}
                              {db.sizeOnDisk != null ? formatSize(db.sizeOnDisk) : ""})
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleToggleDb(id, db.name)}>
                        {isExpanded ? "Collapse" : "Expand"}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => {
                          setLoading(dbPath, true);
                          loadCollections(id, db.name)
                            .then(() => {
                              if (!isExpanded)
                                useConnectionStore.getState().toggleExpanded(id, db.name);
                              toast.success(`Refreshed ${db.name}`);
                            })
                            .catch((err: unknown) =>
                              toast.error("Failed to refresh", {
                                description: err instanceof Error ? err.message : String(err),
                              }),
                            )
                            .finally(() => setLoading(dbPath, false));
                        }}
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Refresh
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="text-destructive">Drop Database</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Collection nodes */}
                  {isExpanded &&
                    collections.map((col) => {
                      const colPath = `${db.name}/${col.name}`;
                      const isColExpanded = conn.expanded.has(colPath);
                      const indexPath = `${db.name}/${col.name}/indexes`;
                      const isIndexExpanded = conn.expanded.has(indexPath);
                      const indexCacheKey = `${id}/${indexPath}`;
                      const isIndexLoading = loadingPaths.has(indexCacheKey);
                      const indexes = indexCache.get(indexCacheKey) ?? [];

                      return (
                        <div key={col.name}>
                          {/* Collection row */}
                          <ContextMenu>
                            <ContextMenuTrigger>
                              <button
                                type="button"
                                className="flex w-full items-center gap-1.5 pl-10 pr-2 py-0.5 text-xs text-sidebar-foreground/80 hover:bg-sidebar-border/50"
                                onClick={() => handleToggleCollection(id, db.name, col.name)}
                                onDoubleClick={() =>
                                  handleOpenQuery(id, db.name, col.name, conn.config.colorFlag)
                                }
                              >
                                {isColExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                <Table2 className="h-3 w-3 shrink-0 text-blue-400" />
                                <span className="whitespace-nowrap">
                                  {col.name}
                                  {col.docCount != null && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      ({formatCount(col.docCount)})
                                    </span>
                                  )}
                                </span>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() =>
                                  handleOpenQuery(id, db.name, col.name, conn.config.colorFlag)
                                }
                              >
                                Open Query
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem>Collection Stats</ContextMenuItem>
                              <ContextMenuItem>Analyze Schema</ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem>Export</ContextMenuItem>
                              <ContextMenuItem>Import</ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem>Rename</ContextMenuItem>
                              <ContextMenuItem className="text-destructive">
                                Drop Collection
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Collection sub-nodes */}
                          {isColExpanded && (
                            <div>
                              {/* Indexes folder node */}
                              <button
                                type="button"
                                className="flex w-full items-center gap-1.5 pl-[3.75rem] pr-2 py-0.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-border/50"
                                onClick={() => handleToggleIndexes(id, db.name, col.name)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenIndexes(id, db.name, col.name, conn.config.colorFlag);
                                }}
                              >
                                {isIndexLoading ? (
                                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                ) : isIndexExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                )}
                                <KeyRound className="h-3 w-3 shrink-0 text-amber-500" />
                                <span className="whitespace-nowrap">
                                  indexes{indexes.length > 0 ? ` (${indexes.length})` : ""}
                                </span>
                              </button>

                              {/* Individual indexes */}
                              {isIndexExpanded &&
                                indexes.map((idx) => (
                                  <div
                                    key={idx.name}
                                    className="flex w-full items-center gap-1.5 pl-[5rem] pr-2 py-0.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-border/50 cursor-pointer"
                                    onDoubleClick={() =>
                                      handleOpenIndexInfo(
                                        id,
                                        db.name,
                                        col.name,
                                        idx.name,
                                        conn.config.colorFlag,
                                      )
                                    }
                                  >
                                    <Key className="h-3 w-3 shrink-0 text-amber-400/70" />
                                    <span className="whitespace-nowrap">{idx.name}</span>
                                    {idx.size != null && (
                                      <span className="ml-auto text-[10px] text-muted-foreground">
                                        {formatSize(idx.size)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        );
      })}
      <ConnectionEditDialog
        open={editDialog.open}
        config={editDialog.config}
        onClose={() => setEditDialog({ open: false, config: null })}
        onSave={handleEditSave}
        onConnect={() => setEditDialog({ open: false, config: null })}
      />
    </div>
  );
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };
  return colors[color] ?? colors.gray;
}
