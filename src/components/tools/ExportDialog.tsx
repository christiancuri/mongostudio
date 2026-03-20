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
import { FileDown, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { exportData } from "@/api/importExport";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  collection: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  collection,
}: ExportDialogProps) {
  const [filePath, setFilePath] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!filePath) {
      toast.error("Please specify an output file path");
      return;
    }
    setExporting(true);
    try {
      const result = await exportData(
        connectionId,
        database,
        collection,
        filePath,
        format,
      );
      toast.success(`Exported ${result.exported} documents`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileDown className="h-4 w-4" />
            Export Data
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Collection</Label>
            <Input className="h-8 text-sm" value={collection} disabled />
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
            <Label className="text-xs">Output File Path</Label>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={`/path/to/${collection}.${format}`}
              />
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <FolderOpen className="h-3 w-3" />
              </Button>
            </div>
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
            onClick={handleExport}
            disabled={exporting || !filePath}
          >
            {exporting && (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
