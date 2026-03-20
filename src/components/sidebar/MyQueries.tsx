import { FileCode, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useQueryLibraryStore, type SavedQuery } from "@/stores/queryLibraryStore";
import { useTabStore } from "@/stores/tabStore";
import { toast } from "sonner";

export function MyQueries() {
  const queries = useQueryLibraryStore((s) => s.queries);
  const removeQuery = useQueryLibraryStore((s) => s.removeQuery);
  const addTab = useTabStore((s) => s.addTab);

  const handleOpen = (query: SavedQuery) => {
    addTab({
      id: crypto.randomUUID(),
      title: query.name,
      type: "query",
      connectionId: query.connectionId,
      database: query.database,
      collection: query.collection,
      content: query.content,
      dirty: false,
    });
  };

  const handleDelete = (id: string) => {
    removeQuery(id);
    toast.success("Query deleted");
  };

  if (queries.length === 0) {
    return (
      <div className="px-3 pb-3">
        <p className="text-xs text-sidebar-foreground/50">
          No saved queries yet. Use Ctrl+S to save.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-2">
      {queries.map((q) => (
        <ContextMenu key={q.id}>
          <ContextMenuTrigger>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-3 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-border/50"
              onClick={() => handleOpen(q)}
            >
              <FileCode className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1 text-left">{q.name}</span>
              {q.database && (
                <span className="text-[10px] text-muted-foreground truncate">{q.database}</span>
              )}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleOpen(q)}>Open</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onClick={() => handleDelete(q.id)}>
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
