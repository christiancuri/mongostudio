import { useCallback, useEffect, useRef, useState } from "react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Copy,
  Link,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConnectionStore } from "@/stores/connectionStore";
import { useConnection } from "@/hooks/useConnection";
import type { ConnectionConfig } from "@/types/connection";
import {
  getConnectionServer,
  getConnectionSecurity,
} from "@/types/connection";
import { ConnectionEditDialog } from "./ConnectionEditDialog";
import { ConnectionUriDialog } from "./ConnectionUriDialog";

interface ConnectionListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INITIAL_W = 950;
const INITIAL_H = 550;
const MIN_W = 650;
const MIN_H = 350;

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function ConnectionListDialog({
  open,
  onOpenChange,
}: ConnectionListDialogProps) {
  const savedConnections = useConnectionStore((s) => s.savedConnections);
  const {
    removeSavedConnection,
    addSavedConnection,
    updateSavedConnection,
  } = useConnectionStore();
  const { connectToServer, testConnectionConfig } = useConnection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    config: ConnectionConfig | null;
  }>({ open: false, config: null });
  const [uriDialogOpen, setUriDialogOpen] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedId(savedConnections[0]?.id ?? null);
      requestAnimationFrame(() => {
        if (boxRef.current) {
          boxRef.current.style.width = `${INITIAL_W}px`;
          boxRef.current.style.height = `${INITIAL_H}px`;
        }
      });
    }
  }, [open]);

  // Close on ESC (only if sub-dialogs are not open)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editDialog.open && !uriDialogOpen) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, editDialog.open, uriDialogOpen, onOpenChange]);

  const selectedConfig =
    savedConnections.find((c) => c.id === selectedId) ?? null;

  // Resize
  const startResize = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = box.offsetWidth;
    const startH = box.offsetHeight;

    const cursorMap: Record<Edge, string> = {
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      ne: "nesw-resize",
      nw: "nwse-resize",
      se: "nwse-resize",
      sw: "nesw-resize",
    };

    const overlay = document.createElement("div");
    overlay.style.cssText = `position:fixed;inset:0;z-index:99999;cursor:${cursorMap[edge]}`;
    document.body.appendChild(overlay);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = startW,
        h = startH;
      if (edge.includes("e")) w = startW + dx * 2;
      if (edge.includes("w")) w = startW - dx * 2;
      if (edge.includes("s")) h = startH + dy * 2;
      if (edge.includes("n")) h = startH - dy * 2;
      w = Math.max(MIN_W, Math.min(w, window.innerWidth * 0.95));
      h = Math.max(MIN_H, Math.min(h, window.innerHeight * 0.92));
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
    };
    const onUp = () => {
      overlay.remove();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Actions
  const handleConnect = useCallback(
    async (config: ConnectionConfig) => {
      try {
        // Update lastAccessed
        updateSavedConnection({
          ...config,
          lastAccessed: new Date().toISOString(),
        });
        await connectToServer(config);
        toast.success(`Connected to ${config.name}`);
        onOpenChange(false);
      } catch (err) {
        toast.error("Connection failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [connectToServer, onOpenChange, updateSavedConnection],
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const name = selectedConfig?.name;
    removeSavedConnection(selectedId);
    setSelectedId(
      savedConnections.filter((c) => c.id !== selectedId)[0]?.id ?? null,
    );
    toast.success(`Deleted "${name}"`);
  }, [selectedId, selectedConfig, removeSavedConnection, savedConnections]);

  const handleClone = useCallback(() => {
    if (!selectedConfig) return;
    const clone = {
      ...selectedConfig,
      id: crypto.randomUUID(),
      name: `${selectedConfig.name} (copy)`,
      lastAccessed: undefined,
    };
    addSavedConnection(clone);
    setSelectedId(clone.id);
    toast.success("Connection cloned");
  }, [selectedConfig, addSavedConnection]);

  const handleTest = useCallback(async () => {
    if (!selectedConfig) return;
    try {
      await testConnectionConfig(selectedConfig);
      toast.success("Connection successful!");
    } catch (err) {
      toast.error("Connection failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [selectedConfig, testConnectionConfig]);

  const handleEdit = useCallback(() => {
    if (!selectedConfig) return;
    setEditDialog({ open: true, config: { ...selectedConfig } });
  }, [selectedConfig]);

  // Check clipboard for a MongoDB URI
  const checkClipboardAndOpen = useCallback(async () => {
    try {
      const text = await readText();
      if (text && /^mongodb(\+srv)?:\/\//i.test(text.trim())) {
        setUriDialogOpen(true);
        return;
      }
    } catch {
      // Clipboard empty or unavailable — ignore
    }
    setEditDialog({ open: true, config: null });
  }, []);

  const handleNewConnection = useCallback(() => {
    setEditDialog({ open: true, config: null });
  }, []);

  const handleImportUri = useCallback(() => {
    setUriDialogOpen(true);
  }, []);

  // Save from edit dialog
  const handleEditSave = useCallback(
    (config: ConnectionConfig) => {
      const exists = savedConnections.some((c) => c.id === config.id);
      if (exists) {
        updateSavedConnection(config);
      } else {
        addSavedConnection(config);
      }
      setSelectedId(config.id);
      setEditDialog({ open: false, config: null });
    },
    [savedConnections, updateSavedConnection, addSavedConnection],
  );

  // Connect from edit dialog
  const handleEditConnect = useCallback(
    async (config: ConnectionConfig) => {
      const exists = savedConnections.some((c) => c.id === config.id);
      if (exists) updateSavedConnection(config);
      else addSavedConnection(config);
      setEditDialog({ open: false, config: null });
      await handleConnect(config);
    },
    [
      savedConnections,
      updateSavedConnection,
      addSavedConnection,
      handleConnect,
    ],
  );

  // URI dialog completed -> open edit with parsed config
  const handleUriParsed = useCallback((config: ConnectionConfig) => {
    setUriDialogOpen(false);
    setEditDialog({ open: true, config });
  }, []);

  if (!open) return null;

  const GRIP = 6;
  const edgeHandles: { edge: Edge; style: React.CSSProperties }[] = [
    {
      edge: "n",
      style: {
        top: -GRIP,
        left: GRIP * 2,
        right: GRIP * 2,
        height: GRIP * 2,
        cursor: "ns-resize",
      },
    },
    {
      edge: "s",
      style: {
        bottom: -GRIP,
        left: GRIP * 2,
        right: GRIP * 2,
        height: GRIP * 2,
        cursor: "ns-resize",
      },
    },
    {
      edge: "e",
      style: {
        right: -GRIP,
        top: GRIP * 2,
        bottom: GRIP * 2,
        width: GRIP * 2,
        cursor: "ew-resize",
      },
    },
    {
      edge: "w",
      style: {
        left: -GRIP,
        top: GRIP * 2,
        bottom: GRIP * 2,
        width: GRIP * 2,
        cursor: "ew-resize",
      },
    },
    {
      edge: "nw",
      style: {
        top: -GRIP,
        left: -GRIP,
        width: GRIP * 3,
        height: GRIP * 3,
        cursor: "nwse-resize",
      },
    },
    {
      edge: "ne",
      style: {
        top: -GRIP,
        right: -GRIP,
        width: GRIP * 3,
        height: GRIP * 3,
        cursor: "nesw-resize",
      },
    },
    {
      edge: "sw",
      style: {
        bottom: -GRIP,
        left: -GRIP,
        width: GRIP * 3,
        height: GRIP * 3,
        cursor: "nesw-resize",
      },
    },
    {
      edge: "se",
      style: {
        bottom: -GRIP,
        right: -GRIP,
        width: GRIP * 3,
        height: GRIP * 3,
        cursor: "nwse-resize",
      },
    },
  ];

  // Helper for relative time
  function relativeTime(iso?: string): string {
    if (!iso) return "\u2014";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const COLOR_HEX: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" />

      {/* Dialog */}
      <div
        ref={boxRef}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-lg border border-border bg-background shadow-xl overflow-hidden"
        style={{ width: INITIAL_W, height: INITIAL_H }}
      >
        {/* Resize edges */}
        {edgeHandles.map((h) => (
          <div
            key={h.edge}
            style={{ position: "absolute", zIndex: 60, ...h.style }}
            onMouseDown={(e) => startResize(e, h.edge)}
          />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Connections</span>
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0">
          {/* Split button: main click checks clipboard, arrow opens dropdown */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs rounded-r-none"
              onClick={checkClipboardAndOpen}
            >
              <Plus className="h-3 w-3" />
              New Connection
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-5 p-0 rounded-l-none border-l border-border/50"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleImportUri}>
                  <Link className="mr-2 h-3.5 w-3.5" />
                  Importing MongoDB URI... (default)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewConnection}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create Connection Manually...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleEdit}
            disabled={!selectedConfig}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleDelete}
            disabled={!selectedConfig}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleClone}
            disabled={!selectedConfig}
          >
            <Copy className="h-3 w-3" />
            Clone
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleTest}
            disabled={!selectedConfig}
          >
            <Play className="h-3 w-3" />
            Test
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted z-10">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-[3px]" />
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                    Server
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
                    Security
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-[70px]">
                    Color
                  </th>
                  <th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-[100px]">
                    Last Accessed
                  </th>
                </tr>
              </thead>
              <tbody>
                {savedConnections.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No saved connections. Click "+ New Connection" to create
                      one.
                    </td>
                  </tr>
                )}
                {savedConnections.map((conn) => {
                  const isSelected = conn.id === selectedId;
                  return (
                    <tr
                      key={conn.id}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedId(conn.id)}
                      onDoubleClick={() => handleConnect(conn)}
                    >
                      <td className="w-[3px] p-0">
                        <div
                          className="w-[3px] h-full min-h-[32px]"
                          style={{
                            backgroundColor:
                              COLOR_HEX[conn.colorFlag] ?? COLOR_HEX.gray,
                          }}
                        />
                      </td>
                      <td
                        className="px-3 py-1.5 font-medium"
                        style={{
                          color:
                            COLOR_HEX[conn.colorFlag] ?? COLOR_HEX.gray,
                        }}
                      >
                        {conn.name}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[250px]">
                        {getConnectionServer(conn)}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">
                        {getConnectionSecurity(conn)}
                      </td>
                      <td
                        className="px-3 py-1.5"
                        style={{
                          color:
                            COLOR_HEX[conn.colorFlag] ?? COLOR_HEX.gray,
                        }}
                      >
                        {conn.colorFlag}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {relativeTime(conn.lastAccessed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5 shrink-0">
          <Button
            size="sm"
            onClick={() => selectedConfig && handleConnect(selectedConfig)}
            disabled={!selectedConfig}
          >
            Connect
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Sub-dialogs */}
      <ConnectionEditDialog
        open={editDialog.open}
        config={editDialog.config}
        onClose={() => setEditDialog({ open: false, config: null })}
        onSave={handleEditSave}
        onConnect={handleEditConnect}
      />
      <ConnectionUriDialog
        open={uriDialogOpen}
        onClose={() => setUriDialogOpen(false)}
        onParsed={handleUriParsed}
      />
    </>
  );
}
