import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, FolderOpen, HardDriveDownload, HardDriveUpload, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DumpRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database?: string;
  collection?: string;
  mode?: "dump" | "restore";
}

export function DumpRestoreDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  collection,
  mode = "dump",
}: DumpRestoreDialogProps) {
  const [activeTab, setActiveTab] = useState<string>(mode);
  const [dumpPath, setDumpPath] = useState("");
  const [restorePath, setRestorePath] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  // Suppress unused variable warning — connectionId will be used
  // when wiring to tauri-plugin-shell for mongodump/mongorestore
  void connectionId;

  const handleDump = async () => {
    if (!dumpPath) {
      toast.error("Please specify an output directory");
      return;
    }
    setRunning(true);
    setOutput("Starting mongodump...\n");
    try {
      // TODO: Wire to tauri-plugin-shell to run mongodump
      setOutput((prev) => `${prev}mongodump command would run here\n`);
      toast.info("mongodump integration coming soon");
    } catch (err) {
      toast.error("Dump failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRestore = async () => {
    if (!restorePath) {
      toast.error("Please specify a dump directory");
      return;
    }
    setRunning(true);
    setOutput("Starting mongorestore...\n");
    try {
      // TODO: Wire to tauri-plugin-shell to run mongorestore
      setOutput((prev) => `${prev}mongorestore command would run here\n`);
      toast.info("mongorestore integration coming soon");
    } catch (err) {
      toast.error("Restore failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Dump / Restore</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="dump" className="flex-1 gap-1.5 text-xs">
              <HardDriveDownload className="h-3 w-3" />
              mongodump
            </TabsTrigger>
            <TabsTrigger value="restore" className="flex-1 gap-1.5 text-xs">
              <HardDriveUpload className="h-3 w-3" />
              mongorestore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dump" className="space-y-3 mt-3">
            <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2">
              <p className="flex items-center gap-1.5 text-xs text-yellow-500">
                <AlertCircle className="h-3 w-3" />
                Requires mongodump installed and in PATH
              </p>
            </div>
            {database && (
              <div className="space-y-1.5">
                <Label className="text-xs">Database</Label>
                <Input className="h-8 text-sm" value={database} disabled />
              </div>
            )}
            {collection && (
              <div className="space-y-1.5">
                <Label className="text-xs">Collection</Label>
                <Input className="h-8 text-sm" value={collection} disabled />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Output Directory</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  value={dumpPath}
                  onChange={(e) => setDumpPath(e.target.value)}
                  placeholder="/path/to/dump"
                />
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <FolderOpen className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="restore" className="space-y-3 mt-3">
            <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2">
              <p className="flex items-center gap-1.5 text-xs text-yellow-500">
                <AlertCircle className="h-3 w-3" />
                Requires mongorestore installed and in PATH
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dump Directory</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  value={restorePath}
                  onChange={(e) => setRestorePath(e.target.value)}
                  placeholder="/path/to/dump"
                />
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <FolderOpen className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {output && (
          <ScrollArea className="h-32 rounded border border-border bg-black/50 p-2">
            <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
              {output}
            </pre>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={activeTab === "dump" ? handleDump : handleRestore}
            disabled={running}
          >
            {running && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {activeTab === "dump" ? "Start Dump" : "Start Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
