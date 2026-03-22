import { deleteDocument } from "@/api/document";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { openCloneDocumentTab, openEditDocumentTab } from "@/components/results/DocumentEditor";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Files, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

interface TableViewProps {
  documents: Record<string, unknown>[];
  connectionId?: string;
  database?: string;
  collection?: string;
  colorFlag?: string;
}

export function TableView({
  documents,
  connectionId,
  database,
  collection,
  colorFlag,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteDoc, setDeleteDoc] = useState<Record<string, unknown> | null>(null);

  const hasContext = connectionId && database && collection;

  const handleEdit = useCallback(
    (doc: Record<string, unknown>) => {
      if (!connectionId || !database || !collection) return;
      openEditDocumentTab(connectionId, database, collection, doc, colorFlag);
    },
    [connectionId, database, collection, colorFlag],
  );

  const handleClone = useCallback(
    (doc: Record<string, unknown>) => {
      if (!connectionId || !database || !collection) return;
      openCloneDocumentTab(connectionId, database, collection, doc, colorFlag);
    },
    [connectionId, database, collection, colorFlag],
  );

  const handleCopy = useCallback((doc: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
    toast.success("Document copied to clipboard");
  }, []);

  const handleDelete = useCallback(async () => {
    if (!connectionId || !database || !collection || !deleteDoc?._id) return;
    try {
      const filter = { _id: deleteDoc._id };
      const result = await deleteDocument(connectionId, database, collection, filter);
      if (result.deletedCount > 0) {
        toast.success("Document deleted");
      } else {
        toast.error("Document not found");
      }
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [connectionId, database, collection, deleteDoc]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (documents.length === 0) return [];

    // Collect all unique keys from all documents
    const allKeys = new Set<string>();
    for (const doc of documents) {
      for (const key of Object.keys(doc)) {
        allKeys.add(key);
      }
    }

    // Ensure _id comes first
    const orderedKeys = [
      "_id",
      ...Array.from(allKeys)
        .filter((k) => k !== "_id")
        .sort(),
    ];

    return orderedKeys.map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span>{key}</span>
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </button>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return <CellValue value={value} />;
      },
      size: key === "_id" ? 220 : 150,
    }));
  }, [documents]);

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <ScrollArea className="h-full">
        <div className="min-w-full">
          <table className="w-full border-collapse font-mono text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const doc = row.original;
                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-accent/50"
                        onDoubleClick={hasContext ? () => handleEdit(doc) : undefined}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="max-w-[300px] truncate border-b border-r border-border/50 px-2 py-1"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleCopy(doc)}>
                        <Copy className="mr-2 h-3 w-3" />
                        Copy as JSON
                      </ContextMenuItem>
                      {hasContext && (
                        <>
                          <ContextMenuItem onClick={() => handleEdit(doc)}>
                            <Pencil className="mr-2 h-3 w-3" />
                            Edit Document
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleClone(doc)}>
                            <Files className="mr-2 h-3 w-3" />
                            Clone Document
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDoc(doc)}
                          >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete Document
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </tbody>
          </table>
        </div>
      </ScrollArea>
      {hasContext && (
        <ConfirmDialog
          open={deleteDoc !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteDoc(null);
          }}
          title="Delete Document"
          description="Are you sure you want to delete this document? This action cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}

function CellValue({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground/50">null</span>;
  if (value === undefined) return <span className="text-muted-foreground/50">&mdash;</span>;
  if (typeof value === "string") return <span className="text-green-400">{value}</span>;
  if (typeof value === "number") return <span className="text-blue-400">{value}</span>;
  if (typeof value === "boolean") return <span className="text-red-400">{String(value)}</span>;
  if (Array.isArray(value))
    return <span className="text-muted-foreground">[{value.length} items]</span>;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("$oid" in obj) return <span className="text-gray-400">{String(obj.$oid)}</span>;
    if ("$date" in obj) return <span className="text-purple-400">{String(obj.$date)}</span>;
    if ("$numberLong" in obj)
      return <span className="text-blue-400">{String(obj.$numberLong)}</span>;
    return <span className="text-muted-foreground">{"{...}"}</span>;
  }
  return <span>{String(value)}</span>;
}
