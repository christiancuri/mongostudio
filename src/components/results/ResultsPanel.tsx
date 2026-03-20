import { useCallback, useState } from "react";
import { useResultStore } from "@/stores/resultStore";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  TreePine,
  Table2,
  Braces,
} from "lucide-react";
import type { Tab } from "@/types/tab";
import { executeQuery } from "@/api/query";
import { TreeView } from "./TreeView";
import { TableView } from "./TableView";
import { JsonView } from "./JsonView";

interface ResultsPanelProps {
  tab: Tab;
}

const PAGE_SIZES = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];

const VIEW_MODES = [
  { value: "tree", label: "Tree", icon: TreePine },
  { value: "table", label: "Table", icon: Table2 },
  { value: "json", label: "JSON", icon: Braces },
] as const;

export function ResultsPanel({ tab }: ResultsPanelProps) {
  const result = useResultStore((s) => s.results.get(tab.id));
  const viewMode = useResultStore((s) => s.viewMode.get(tab.id) ?? "tree");
  const isLoading = useResultStore((s) => s.loading.get(tab.id) ?? false);
  const error = useResultStore((s) => s.errors.get(tab.id));
  const setViewMode = useResultStore((s) => s.setViewMode);
  const setResult = useResultStore((s) => s.setResult);
  const setLoading = useResultStore((s) => s.setLoading);
  const setError = useResultStore((s) => s.setError);
  const clearError = useResultStore((s) => s.clearError);

  const reRunQuery = useCallback(
    async (page: number, pageSize: number) => {
      if (!tab.connectionId || !tab.database || !tab.collection) return;
      const editorContent = useEditorStore.getState().editors.get(tab.id)?.content;
      const queryText = editorContent ?? tab.content ?? "";
      if (!queryText.trim()) return;

      setLoading(tab.id, true);
      clearError(tab.id);
      try {
        const res = await executeQuery({
          connectionId: tab.connectionId,
          database: tab.database,
          collection: tab.collection,
          queryText: queryText.trim(),
          page,
          pageSize,
        });
        setResult(tab.id, res);
      } catch (err) {
        setError(tab.id, err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(tab.id, false);
      }
    },
    [tab, setLoading, clearError, setResult, setError],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (!result) return;
      reRunQuery(page, result.pageSize);
    },
    [result, reRunQuery],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      reRunQuery(1, pageSize);
    },
    [reRunQuery],
  );

  const totalPages =
    result && result.totalCount
      ? Math.ceil(result.totalCount / result.pageSize)
      : 1;
  const currentPage = result?.page ?? 1;
  const startDoc = result ? (result.page - 1) * result.pageSize + 1 : 0;
  const endDoc = result
    ? startDoc + result.documents.length - 1
    : 0;

  const ViewIcon =
    VIEW_MODES.find((v) => v.value === viewMode)?.icon ?? TreePine;

  // Expand/collapse all signal: positive = expand, negative = collapse
  const [expandSignal, setExpandSignal] = useState(0);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-2">
        {/* Left side: collection, time, count */}
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {tab.collection && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Table2 className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {tab.collection}
              </span>
            </span>
          )}
          {result && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {(result.executionTimeMs / 1000).toFixed(3)} s
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span className="text-muted-foreground">
                {result.totalCount != null
                  ? result.totalCount.toLocaleString()
                  : result.documents.length}{" "}
                Doc
                {(result.totalCount ?? result.documents.length) !== 1
                  ? "s"
                  : ""}
              </span>
            </>
          )}
        </div>

        {/* Right side: expand/collapse, page size, pagination, view mode */}
        <div className="flex shrink-0 items-center gap-1.5">
          {result && result.documents.length > 0 && viewMode === "tree" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                title="Expand All"
                onClick={() => setExpandSignal((s) => Math.abs(s) + 1)}
              >
                <ChevronsUpDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                title="Collapse All"
                onClick={() => setExpandSignal((s) => -(Math.abs(s) + 1))}
              >
                <ChevronsDownUp className="h-3 w-3" />
              </Button>
            </>
          )}
          {result && (
            <>
              {/* Page size */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-5 min-w-[50px] px-2 text-[11px] font-mono bg-background">
                    {result.pageSize}
                    <ChevronDown className="ml-1 h-2.5 w-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[80px]">
                  {PAGE_SIZES.map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => handlePageSizeChange(size)}
                      className="text-xs justify-between"
                    >
                      {result.pageSize === size && <span className="text-primary mr-2">✓</span>}
                      <span className={result.pageSize === size ? "font-medium" : ""}>{size}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Pagination */}
              <div className="flex items-center gap-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(1)}
                >
                  <ChevronFirst className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(totalPages)}
                >
                  <ChevronLast className="h-3 w-3" />
                </Button>
              </div>

              {/* Page indicator */}
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                p. {currentPage}
              </span>
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {startDoc}-{endDoc}
              </span>
            </>
          )}

          {/* View mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[10px]"
              >
                <ViewIcon className="h-3 w-3" />
                {VIEW_MODES.find((v) => v.value === viewMode)?.label}
                <ChevronDown className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {VIEW_MODES.map((mode) => (
                <DropdownMenuItem
                  key={mode.value}
                  onClick={() =>
                    setViewMode(
                      tab.id,
                      mode.value as "tree" | "table" | "json",
                    )
                  }
                  className="gap-2 text-xs"
                >
                  <mode.icon className="h-3.5 w-3.5" />
                  {mode.label}
                  {viewMode === mode.value && (
                    <span className="ml-auto text-primary">&#10003;</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && !isLoading && (
          <div className="flex h-full items-center justify-center p-4">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-destructive">
                Query Error
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {error}
              </p>
            </div>
          </div>
        )}
        {!isLoading && !error && !result && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">Run a query to see results</p>
          </div>
        )}
        {!isLoading && !error && result && result.documents.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="text-sm">No documents found</p>
          </div>
        )}
        {!isLoading && !error && result && result.documents.length > 0 && (
          <>
            {viewMode === "tree" && (
              <TreeView
                documents={result.documents}
                connectionId={tab.connectionId}
                database={tab.database}
                collection={tab.collection}
                colorFlag={tab.colorFlag}
                expandSignal={expandSignal}
              />
            )}
            {viewMode === "table" && (
              <TableView
                documents={result.documents}
                connectionId={tab.connectionId}
                database={tab.database}
                collection={tab.collection}
                colorFlag={tab.colorFlag}
              />
            )}
            {viewMode === "json" && (
              <JsonView documents={result.documents} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
