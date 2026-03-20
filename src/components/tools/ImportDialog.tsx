import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUp, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { importData } from "@/api/importExport";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  collection?: string;
}

export function ImportDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  collection,
}: ImportDialogProps) {
  const [filePath, setFilePath] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [targetCollection, setTargetCollection] = useState(collection ?? "");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!filePath || !targetCollection) {
      toast.error("Please fill in all fields");
      return;
    }
    setImporting(true);
    try {
      const result = await importData(
        connectionId,
        database,
        targetCollection,
        filePath,
        format,
      );
      toast.success(`Imported ${result.imported} documents`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileUp className="h-4 w-4" />
            Import Data
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">File Path</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="/path/to/data.json"
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FolderOpen className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as "json" | "csv")}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target Collection</Label>
            <Input
              className="h-8 text-sm"
              value={targetCollection}
              onChange={(e) => setTargetCollection(e.target.value)}
              placeholder="collection_name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Database</Label>
            <Input className="h-8 text-sm" value={database} disabled />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={importing || !filePath || !targetCollection}
          >
            {importing && (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
