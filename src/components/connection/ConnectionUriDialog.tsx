import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, X, Loader2 } from "lucide-react";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import type { ConnectionConfig } from "@/types/connection";
import { parseMongoUri } from "@/utils/uriParser";
import { useConnection } from "@/hooks/useConnection";

interface ConnectionUriDialogProps {
  open: boolean;
  onClose: () => void;
  onParsed: (config: ConnectionConfig) => void;
}

export function ConnectionUriDialog({
  open,
  onClose,
  onParsed,
}: ConnectionUriDialogProps) {
  const [uri, setUri] = useState("mongodb://localhost:27017");
  const [testing, setTesting] = useState(false);
  const { testConnectionConfig } = useConnection();

  // Auto-fill from clipboard when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const text = await readText();
        if (text && /^mongodb(\+srv)?:\/\//i.test(text.trim())) {
          setUri(text.trim());
        } else {
          setUri("mongodb://localhost:27017");
        }
      } catch {
        setUri("mongodb://localhost:27017");
      }
    })();
  }, [open]);

  const handleTest = useCallback(async () => {
    const config = parseMongoUri(uri);
    setTesting(true);
    try {
      await testConnectionConfig(config);
      toast.success("Connection successful!");
    } catch (err) {
      toast.error("Connection failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }, [uri, testConnectionConfig]);

  const handleOk = useCallback(() => {
    const config = parseMongoUri(uri);
    onParsed(config);
  }, [uri, onParsed]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" />
      <div className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] rounded-lg border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              New Connection by Importing MongoDB URI...
            </span>
          </div>
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            If you have a connection string (SRV or standard), such as your
            MongoDB Atlas or AWS DocumentDB, you can paste it here and
            MongoStudio will automatically configure your connection settings.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Your MongoDB connection string (SRV or standard):
            </label>
            <Input
              className="h-9 text-sm font-mono border-primary/50 focus:border-primary"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="mongodb://localhost:27017"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !uri.trim()}
          >
            {testing ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : null}
            Test Connection
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOk} disabled={!uri.trim()}>
              OK
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
