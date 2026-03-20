import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/types/connection";
import { createDefaultConnection } from "@/types/connection";
import { ConnectionForm } from "./ConnectionForm";
import { useConnection } from "@/hooks/useConnection";

interface ConnectionEditDialogProps {
  open: boolean;
  config: ConnectionConfig | null; // null = new connection
  onClose: () => void;
  onSave: (config: ConnectionConfig) => void;
  onConnect: (config: ConnectionConfig) => void;
}

const INITIAL_W = 650;
const INITIAL_H = 550;
const MIN_W = 500;
const MIN_H = 400;

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function ConnectionEditDialog({
  open,
  config,
  onClose,
  onSave,
  onConnect,
}: ConnectionEditDialogProps) {
  const [editConfig, setEditConfig] = useState<ConnectionConfig>(
    createDefaultConnection(),
  );
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const { testConnectionConfig } = useConnection();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setEditConfig(config ? { ...config } : createDefaultConnection());
      setTestResult(null);
      requestAnimationFrame(() => {
        if (boxRef.current) {
          boxRef.current.style.width = `${INITIAL_W}px`;
          boxRef.current.style.height = `${INITIAL_H}px`;
        }
      });
    }
  }, [open, config]);

  const handleChange = useCallback(
    (updates: Partial<ConnectionConfig>) => {
      setEditConfig((prev) => ({ ...prev, ...updates }));
      setTestResult(null);
    },
    [],
  );

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await testConnectionConfig(editConfig);
      setTestResult({ success: true, message: msg });
      toast.success("Connection successful!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, message: msg });
      toast.error("Connection failed", { description: msg });
    } finally {
      setTesting(false);
    }
  }, [editConfig, testConnectionConfig]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await onConnect(editConfig);
    } finally {
      setConnecting(false);
    }
  }, [editConfig, onConnect]);

  // Resize (same pattern)
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

  const isNew = !config;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" />
      <div
        ref={boxRef}
        className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-lg border border-border bg-background shadow-xl overflow-hidden"
        style={{ width: INITIAL_W, height: INITIAL_H }}
      >
        {edgeHandles.map((h) => (
          <div
            key={h.edge}
            style={{ position: "absolute", zIndex: 70, ...h.style }}
            onMouseDown={(e) => startResize(e, h.edge)}
          />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <span className="text-sm font-semibold">
            {isNew ? "New Connection" : `Edit: ${editConfig.name}`}
          </span>
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-hidden">
          <ConnectionForm config={editConfig} onChange={handleChange} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {testResult && (
              <span
                className={`text-xs ${testResult.success ? "text-green-500" : "text-destructive"}`}
              >
                {testResult.message}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : null}
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSave(editConfig)}
            >
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Database className="h-3 w-3 mr-1.5" />
              )}
              Save & Connect
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
