import { deleteDocument, updateDocument } from "@/api/document";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  openCloneDocumentTab,
  openEditDocumentTab,
  openInsertDocumentTab,
} from "@/components/results/DocumentEditor";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dbCol } from "@/utils/mongo";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns3,
  Copy,
  FileText,
  Files,
  Filter,
  Group,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TreeViewProps {
  documents: Record<string, unknown>[];
  connectionId?: string;
  database?: string;
  collection?: string;
  colorFlag?: string;
  expandSignal?: number; // positive = expand all, negative = collapse all, 0 = default
}

// Type detection
function getValueType(value: unknown): string {
  if (value === null) return "Null";
  if (value === undefined) return "Undefined";
  if (typeof value === "string") return "String";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "Int32" : "Double";
  }
  if (typeof value === "boolean") return "Bool";
  if (Array.isArray(value)) return "Array";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("$oid" in obj) return "ObjectId";
    if ("$date" in obj) return "Date";
    if ("$numberLong" in obj) return "Int64";
    if ("$numberDecimal" in obj) return "Decimal128";
    if ("$binary" in obj) return "BinData";
    if ("$regex" in obj) return "Regex";
    if ("$timestamp" in obj) return "Timestamp";
    return "Object";
  }
  return typeof value;
}

// Format value for display
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("$oid" in obj) return String(obj.$oid);
    if ("$date" in obj) {
      const raw = obj.$date;
      let d: Date;
      if (typeof raw === "string") {
        d = new Date(raw);
      } else if (
        typeof raw === "object" &&
        raw !== null &&
        "$numberLong" in (raw as Record<string, unknown>)
      ) {
        d = new Date(Number((raw as Record<string, unknown>).$numberLong));
      } else if (typeof raw === "number") {
        d = new Date(raw);
      } else {
        return String(raw);
      }
      const formatted = d.toLocaleString();
      const ago = relativeTime(d);
      return `${formatted} – ${ago}`;
    }
    if ("$numberLong" in obj) return String(obj.$numberLong);
    if ("$numberDecimal" in obj) return String(obj.$numberDecimal);
    if ("$regex" in obj) return `/${obj.$regex}/${obj.$options ?? ""}`;
    // Object/Array summary
    if (Array.isArray(value)) {
      return `[${value.length} element${value.length !== 1 ? "s" : ""}]`;
    }
    const entries = Object.entries(obj);
    const preview = entries
      .slice(0, 3)
      .map(([k, v]) => {
        let fv: string;
        if (typeof v === "string") fv = `"${v}"`;
        else if (v === null) fv = "null";
        else if (typeof v === "object") {
          const inner = v as Record<string, unknown>;
          if ("$oid" in inner) fv = String(inner.$oid);
          else if ("$date" in inner) fv = "Date(...)";
          else if (Array.isArray(v)) fv = `[${v.length}]`;
          else fv = "{...}";
        } else fv = String(v);
        return `${k}: ${fv}`;
      })
      .join(", ");
    return `{ ${preview}${entries.length > 3 ? ", ..." : ""} }`;
  }
  return String(value);
}

// Format value as JSON representation for clipboard
function formatJsonValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

// Format value for use in MongoDB query filters
function formatQueryValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("$oid" in obj) return `ObjectId("${obj.$oid}")`;
    if ("$date" in obj) return `ISODate("${obj.$date}")`;
    if ("$numberLong" in obj) return `NumberLong("${obj.$numberLong}")`;
    if ("$numberDecimal" in obj) return `NumberDecimal("${obj.$numberDecimal}")`;
    if ("$regex" in obj) return `/${obj.$regex}/${obj.$options ?? ""}`;
    return JSON.stringify(value);
  }
  return String(value);
}

// Check if a type is numeric or date (for comparison operators)
function isComparableType(type: string): boolean {
  return ["Int32", "Int64", "Double", "Decimal128", "Date", "Timestamp"].includes(type);
}

// Document summary for the header row — returns JSX with colored values
function DocumentSummary({ doc }: { doc: Record<string, unknown> }) {
  const entries = Object.entries(doc).filter(([k]) => k !== "_id");
  const fieldCount = Object.keys(doc).length;
  if (entries.length === 0) return <span>({fieldCount} fields)</span>;
  const first = entries[0];
  const type = getValueType(first[1]);
  const fv = typeof first[1] === "string" ? `"${first[1]}"` : formatValue(first[1]);
  return (
    <span>
      {"{ "}
      {first[0]} : <span className={getValueColor(type)}>{fv}</span>
      {" }"} ({fieldCount} fields)
    </span>
  );
}

// Colored inline summary for Object fields like { smartTodos: false, rag: false }
function ColoredObjectSummary({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value).filter(
    ([k]) => !k.startsWith("$") || k === "$oid" || k === "$date",
  );
  if (entries.length === 0) return <span>{"{}"}</span>;
  const shown = entries.slice(0, 3);
  return (
    <span>
      {"{ "}
      {shown.map(([k, v], i) => {
        const t = getValueType(v);
        const fv = typeof v === "string" ? `"${v}"` : formatValue(v);
        return (
          <span key={k}>
            {i > 0 && ", "}
            {k} : <span className={getValueColor(t)}>{fv}</span>
          </span>
        );
      })}
      {entries.length > 3 && ", ..."}
      {" }"}
    </span>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

function getDocId(doc: Record<string, unknown>): string {
  if (doc._id) {
    if (
      typeof doc._id === "object" &&
      doc._id !== null &&
      "$oid" in (doc._id as Record<string, unknown>)
    ) {
      return (doc._id as Record<string, unknown>).$oid as string;
    }
    return String(doc._id);
  }
  return "unknown";
}

// Value colors matching NoSQLBooster tree view
function getValueColor(type: string): string {
  switch (type) {
    case "String":
      return "text-[#98C379]"; // light green
    case "ObjectId":
      return "text-[#C586C0]"; // purple
    case "Int32":
    case "Int64":
    case "Double":
    case "Decimal128":
      return "text-[#CE9178]"; // orange
    case "Bool":
      return "text-[#C586C0]"; // purple
    case "Date":
    case "Timestamp":
      return "text-[#CCA700]"; // dark yellow/gold
    case "Null":
    case "Undefined":
      return "text-muted-foreground/50";
    case "Regex":
      return "text-[#d16969]"; // red
    case "Array":
    case "Object":
      return "text-foreground/70";
    default:
      return "text-foreground";
  }
}

// Type column colors matching NoSQLBooster
function getTypeColor(type: string): string {
  switch (type) {
    case "String":
      return "text-[#98C379]"; // light green
    case "ObjectId":
      return "text-[#C586C0]"; // purple
    case "Int32":
    case "Int64":
    case "Double":
    case "Decimal128":
      return "text-[#CE9178]"; // orange
    case "Bool":
      return "text-[#C586C0]"; // purple
    case "Date":
    case "Timestamp":
      return "text-[#CCA700]"; // dark yellow/gold
    case "Null":
      return "text-muted-foreground/50";
    case "Array":
      return "text-muted-foreground";
    case "Object":
      return "text-muted-foreground";
    case "Regex":
      return "text-[#d16969]"; // red
    default:
      return "text-muted-foreground";
  }
}

// Type icon (small box with abbreviation)
function TypeIcon({ type }: { type: string }) {
  const abbr: Record<string, string> = {
    String: "ab",
    ObjectId: "id",
    Int32: "12",
    Int64: "12",
    Double: "1.",
    Decimal128: "1.",
    Bool: "tf",
    Date: "dt",
    Timestamp: "ts",
    Null: "\u00f8",
    Undefined: "\u00f8",
    Array: "[]",
    Object: "{}",
    Regex: "//",
    BinData: "01",
    Document: "{}",
  };
  const label = abbr[type] ?? "??";

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted-foreground/15 text-[8px] font-bold"
      title={type}
    >
      {label}
    </span>
  );
}

// --- Clipboard helper ---
function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`Copied ${label}`);
}

// --- Field Context Menu Component ---
function FieldContextMenu({
  fieldKey,
  fieldPath,
  localValue,
  type,
  doc,
  collection,
  connectionId,
  database,
  colorFlag,
  onExpandAll,
  onCollapseAll,
  onDelete,
  children,
}: {
  fieldKey: string;
  fieldPath: string;
  localValue: unknown;
  type: string;
  doc: Record<string, unknown>;
  collection?: string;
  connectionId?: string;
  database?: string;
  colorFlag?: string;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onDelete: (doc: Record<string, unknown>) => void;
  children: React.ReactNode;
}) {
  const hasContext = connectionId && database && collection;
  const colExpr = collection ? dbCol(collection) : "db.collection";
  const queryVal = formatQueryValue(localValue);
  const comparable = isComparableType(type);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Filter by */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Filter className="mr-2 h-3 w-3" />
            Filter by "{fieldKey}"
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-72">
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(`${colExpr}.find({ ${fieldPath}: ${queryVal} })`, "filter query")
              }
            >
              == {formatValue(localValue)}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({ ${fieldPath}: { $ne: ${queryVal} } })`,
                  "filter query",
                )
              }
            >
              != {formatValue(localValue)}
            </ContextMenuItem>
            {comparable && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(
                      `${colExpr}.find({ ${fieldPath}: { $gt: ${queryVal} } })`,
                      "filter query",
                    )
                  }
                >
                  {">"} {formatValue(localValue)}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(
                      `${colExpr}.find({ ${fieldPath}: { $gte: ${queryVal} } })`,
                      "filter query",
                    )
                  }
                >
                  {">="} {formatValue(localValue)}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(
                      `${colExpr}.find({ ${fieldPath}: { $lt: ${queryVal} } })`,
                      "filter query",
                    )
                  }
                >
                  {"<"} {formatValue(localValue)}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(
                      `${colExpr}.find({ ${fieldPath}: { $lte: ${queryVal} } })`,
                      "filter query",
                    )
                  }
                >
                  {"<="} {formatValue(localValue)}
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({ ${fieldPath}: { $exists: true } })`,
                  "filter query",
                )
              }
            >
              $exists: true
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({ ${fieldPath}: { $exists: false } })`,
                  "filter query",
                )
              }
            >
              $exists: false
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({ ${fieldPath}: { $type: "${type.toLowerCase()}" } })`,
                  "filter query",
                )
              }
            >
              $type: "{type.toLowerCase()}"
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Project by */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Columns3 className="mr-2 h-3 w-3" />
            Project by "{fieldKey}"
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({}).projection({ ${fieldPath}: 1 })`,
                  "projection query",
                )
              }
            >
              Include ({fieldPath}: 1)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.find({}).projection({ ${fieldPath}: 0 })`,
                  "projection query",
                )
              }
            >
              Exclude ({fieldPath}: 0)
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Order by */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ArrowUpDown className="mr-2 h-3 w-3" />
            Order by "{fieldKey}"
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(`${colExpr}.find({}).sort({ ${fieldPath}: 1 })`, "sort query")
              }
            >
              Ascending (1)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(`${colExpr}.find({}).sort({ ${fieldPath}: -1 })`, "sort query")
              }
            >
              Descending (-1)
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Group by */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Group className="mr-2 h-3 w-3" />
            Group by "{fieldKey}"
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${colExpr}.aggregate([\n  { $group: { _id: "$${fieldPath}", count: { $sum: 1 } } },\n  { $sort: { count: -1 } }\n])`,
                  "aggregate query",
                )
              }
            >
              Group with count
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Document submenu */}
        {hasContext && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FileText className="mr-2 h-3 w-3" />
              Document
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                onClick={() =>
                  openEditDocumentTab(connectionId, database, collection, doc, colorFlag)
                }
              >
                <Pencil className="mr-2 h-3 w-3" />
                Edit Document
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  openCloneDocumentTab(connectionId, database, collection, doc, colorFlag)
                }
              >
                <Files className="mr-2 h-3 w-3" />
                Clone Document
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => openInsertDocumentTab(connectionId, database, collection, colorFlag)}
              >
                <Plus className="mr-2 h-3 w-3" />
                Insert New Document
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-destructive" onClick={() => onDelete(doc)}>
                <Trash2 className="mr-2 h-3 w-3" />
                Delete Document
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />

        {/* Copy submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-3 w-3" />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-64">
            <ContextMenuItem
              onClick={() => copyToClipboard(formatValue(localValue), "value as plain text")}
            >
              Copy Value as Plain Text
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyToClipboard(formatJsonValue(localValue), "value")}>
              Copy Value
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => copyToClipboard(fieldPath, "field path")}>
              Copy Field Path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  `${fieldKey}: ${formatValue(localValue)}`,
                  "field-value pair as plain text",
                )
              }
            >
              Copy Field-Value Pair as Plain Text
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyToClipboard(
                  JSON.stringify({ [fieldKey]: localValue }, null, 2),
                  "field-value pair",
                )
              }
            >
              Copy Field-Value Pair
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => copyToClipboard(JSON.stringify(doc, null, 2), "document")}
            >
              Copy Document
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Create Index */}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() =>
            copyToClipboard(`${colExpr}.createIndex({ ${fieldPath}: 1 })`, "create index query")
          }
        >
          Create Index on "{fieldKey}"
        </ContextMenuItem>

        {/* Expand/Collapse */}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onExpandAll}>
          <ChevronsUpDown className="mr-2 h-3 w-3" />
          Expand Whole Tree
        </ContextMenuItem>
        <ContextMenuItem onClick={onCollapseAll}>
          <ChevronsDownUp className="mr-2 h-3 w-3" />
          Collapse Whole Tree
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// --- Document Header Context Menu Component ---
function DocumentHeaderContextMenu({
  doc,
  collection,
  connectionId,
  database,
  colorFlag,
  onExpandAll,
  onCollapseAll,
  onDelete,
  children,
}: {
  doc: Record<string, unknown>;
  collection?: string;
  connectionId?: string;
  database?: string;
  colorFlag?: string;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onDelete: (doc: Record<string, unknown>) => void;
  children: React.ReactNode;
}) {
  const hasContext = connectionId && database && collection;
  const col = collection ?? "";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {/* Filter/Project/Order/Group — disabled at document level */}
        <ContextMenuItem disabled className="text-muted-foreground">
          <Filter className="mr-2 h-3 w-3" />
          Filter by Field
        </ContextMenuItem>
        <ContextMenuItem disabled className="text-muted-foreground">
          <Columns3 className="mr-2 h-3 w-3" />
          Project by Field
        </ContextMenuItem>
        <ContextMenuItem disabled className="text-muted-foreground">
          <ArrowUpDown className="mr-2 h-3 w-3" />
          Order by Field
        </ContextMenuItem>
        <ContextMenuItem disabled className="text-muted-foreground">
          <Group className="mr-2 h-3 w-3" />
          Group by Field
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Document submenu */}
        {hasContext && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FileText className="mr-2 h-3 w-3" />
                Document
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52">
                <ContextMenuItem
                  onClick={() =>
                    openEditDocumentTab(connectionId, database, collection, doc, colorFlag)
                  }
                >
                  <Pencil className="mr-2 h-3 w-3" />
                  Edit Document
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    openCloneDocumentTab(connectionId, database, collection, doc, colorFlag)
                  }
                >
                  <Files className="mr-2 h-3 w-3" />
                  Clone Document
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    openInsertDocumentTab(connectionId, database, collection, colorFlag)
                  }
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Insert New Document
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-destructive" onClick={() => onDelete(doc)}>
                  <Trash2 className="mr-2 h-3 w-3" />
                  Delete Document
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
          </>
        )}

        {/* Copy submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-3 w-3" />
            Copy
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem
              onClick={() => copyToClipboard(JSON.stringify(doc, null, 2), "document as JSON")}
            >
              Copy Document as JSON
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyToClipboard(getDocId(doc), "document ID")}>
              Copy Document ID
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Create Index */}
        {hasContext && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Create Index...</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(`${dbCol(col)}.createIndex({ _id: 1 })`, "create index query")
                  }
                >
                  Ascending (1)
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() =>
                    copyToClipboard(`${dbCol(col)}.createIndex({ _id: -1 })`, "create index query")
                  }
                >
                  Descending (-1)
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {/* Expand/Collapse */}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onExpandAll}>
          <ChevronsUpDown className="mr-2 h-3 w-3" />
          Expand Whole Tree
        </ContextMenuItem>
        <ContextMenuItem onClick={onCollapseAll}>
          <ChevronsDownUp className="mr-2 h-3 w-3" />
          Collapse Whole Tree
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TreeView({
  documents,
  connectionId,
  database,
  collection,
  colorFlag,
  expandSignal = 0,
}: TreeViewProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    doc: Record<string, unknown> | null;
  }>({ open: false, doc: null });

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.doc || !connectionId || !database || !collection) return;
    try {
      await deleteDocument(connectionId, database, collection, {
        _id: deleteDialog.doc._id,
      });
      toast.success("Document deleted");
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
    setDeleteDialog({ open: false, doc: null });
  }, [deleteDialog.doc, connectionId, database, collection]);

  return (
    <>
      <ScrollArea className="h-full">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="border-b border-border">
              <th className="min-w-[180px] w-[250px] px-2 py-1 text-left font-medium text-foreground">
                Key
              </th>
              <th className="px-2 py-1 text-left font-medium text-foreground">Value</th>
              <th className="w-[90px] px-2 py-1 text-left font-medium text-foreground">Type</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, idx) => (
              <DocumentRows
                key={getDocId(doc) + idx}
                doc={doc}
                index={idx}
                connectionId={connectionId}
                database={database}
                collection={collection}
                colorFlag={colorFlag}
                expandSignal={expandSignal}
                onDelete={(d) => setDeleteDialog({ open: true, doc: d })}
              />
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, doc: null })}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function DocumentRows({
  doc,
  index,
  connectionId,
  database,
  collection,
  colorFlag,
  expandSignal,
  onDelete,
}: {
  doc: Record<string, unknown>;
  index: number;
  connectionId?: string;
  database?: string;
  collection?: string;
  colorFlag?: string;
  expandSignal: number;
  onDelete: (doc: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0); // only first doc expanded

  // React to expand/collapse all signals
  useEffect(() => {
    if (expandSignal > 0) setExpanded(true);
    else if (expandSignal < 0) setExpanded(false);
  }, [expandSignal]);
  const docId = getDocId(doc);
  const hasContext = connectionId && database && collection;

  const handleExpandAll = useCallback(() => {
    setExpanded(true);
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpanded(false);
  }, []);

  return (
    <>
      {/* Document header row */}
      <DocumentHeaderContextMenu
        doc={doc}
        connectionId={connectionId}
        database={database}
        collection={collection}
        colorFlag={colorFlag}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onDelete={onDelete}
      >
        <tr
          className="cursor-pointer border-b border-border/30 bg-primary/8 hover:bg-primary/12"
          onClick={() => setExpanded(!expanded)}
          onDoubleClick={() =>
            hasContext && openEditDocumentTab(connectionId!, database!, collection!, doc, colorFlag)
          }
        >
          <td className="px-2 py-1 whitespace-nowrap">
            <div className="flex items-center gap-1">
              {expanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <TypeIcon type="Document" />
              <span className="font-medium text-foreground">
                ({index + 1}) {docId.length > 24 ? `${docId.slice(0, 24)}...` : docId}
              </span>
            </div>
          </td>
          <td className="px-2 py-1 whitespace-nowrap text-foreground/70">
            <DocumentSummary doc={doc} />
          </td>
          <td className="px-2 py-1 whitespace-nowrap font-medium text-foreground">Document</td>
        </tr>
      </DocumentHeaderContextMenu>

      {/* Field rows */}
      {expanded &&
        Object.entries(doc).map(([key, value]) => (
          <FieldRow
            key={key}
            fieldKey={key}
            value={value}
            depth={1}
            fieldPath={key}
            docId={doc._id}
            doc={doc}
            connectionId={connectionId}
            database={database}
            collection={collection}
            colorFlag={colorFlag}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

function FieldRow({
  fieldKey,
  value,
  depth,
  fieldPath,
  docId,
  doc,
  connectionId,
  database,
  collection,
  colorFlag,
  onExpandAll,
  onCollapseAll,
  onDelete,
}: {
  fieldKey: string;
  value: unknown;
  depth: number;
  fieldPath: string;
  docId: unknown;
  doc: Record<string, unknown>;
  connectionId?: string;
  database?: string;
  collection?: string;
  colorFlag?: string;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onDelete: (doc: Record<string, unknown>) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [localValue, setLocalValue] = useState<unknown>(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const type = getValueType(localValue);
  const isExpandable = type === "Object" || type === "Array";
  const isEditable = !isExpandable && fieldKey !== "_id";
  const paddingLeft = depth * 20 + 8;

  // Sync with parent when value prop changes (e.g. page refresh)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const children = isExpandable
    ? type === "Array"
      ? (localValue as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
      : Object.entries(localValue as Record<string, unknown>)
    : [];

  const startEditing = useCallback(() => {
    if (!isEditable || !connectionId || !database || !collection) return;
    setEditValue(getRawEditValue(localValue));
    setEditing(true);
  }, [isEditable, connectionId, database, collection, localValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(async () => {
    if (!connectionId || !database || !collection || !docId) return;
    setEditing(false);

    const newValue = parseEditValue(editValue, type);
    if (newValue === localValue) return; // no change

    try {
      await updateDocument(
        connectionId,
        database,
        collection,
        { _id: docId },
        {
          $set: { [fieldPath]: newValue },
        },
      );
      setLocalValue(newValue);
      toast.success(`Updated ${fieldPath}`);
    } catch (err) {
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [connectionId, database, collection, docId, fieldPath, editValue, type, localValue]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  return (
    <>
      <FieldContextMenu
        fieldKey={fieldKey}
        fieldPath={fieldPath}
        localValue={localValue}
        type={type}
        doc={doc}
        collection={collection}
        connectionId={connectionId}
        database={database}
        colorFlag={colorFlag}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        onDelete={onDelete}
      >
        <tr
          className={`border-b border-border/20 transition-colors hover:bg-accent/30 ${editing ? "bg-primary/8" : ""}`}
          onClick={isExpandable ? () => setExpanded(!expanded) : undefined}
          style={{ cursor: isExpandable ? "pointer" : "default" }}
        >
          <td className="px-2 py-0.5 whitespace-nowrap" style={{ paddingLeft }}>
            <div className="flex items-center gap-1">
              {isExpandable ? (
                expanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <TypeIcon type={type} />
              <span className="text-foreground">{fieldKey}</span>
              {fieldKey === "_id" && (
                <span className="ml-1 text-[9px] text-muted-foreground/50">(asc index)</span>
              )}
            </div>
          </td>
          <td
            className={`px-2 py-0.5 whitespace-nowrap ${editing ? "" : getValueColor(type)}`}
            onDoubleClick={isEditable ? startEditing : undefined}
          >
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  className="h-5 flex-1 rounded border border-primary/50 bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={commitEdit}
                />
              </div>
            ) : type === "Object" &&
              typeof localValue === "object" &&
              localValue !== null &&
              !Array.isArray(localValue) ? (
              <ColoredObjectSummary value={localValue as Record<string, unknown>} />
            ) : (
              formatValue(localValue)
            )}
          </td>
          <td className={`px-2 py-0.5 whitespace-nowrap ${getTypeColor(type)}`}>{type}</td>
        </tr>
      </FieldContextMenu>
      {isExpandable &&
        expanded &&
        children.map(([k, v]) => (
          <FieldRow
            key={k}
            fieldKey={k}
            value={v}
            depth={depth + 1}
            fieldPath={`${fieldPath}.${k}`}
            docId={docId}
            doc={doc}
            connectionId={connectionId}
            database={database}
            collection={collection}
            colorFlag={colorFlag}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// Get raw value for editing (without quotes, without BSON wrappers)
function getRawEditValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("$oid" in obj) return String(obj.$oid);
    if ("$date" in obj) {
      const raw = obj.$date;
      if (typeof raw === "string") return raw;
      if (
        typeof raw === "object" &&
        raw !== null &&
        "$numberLong" in (raw as Record<string, unknown>)
      ) {
        return new Date(Number((raw as Record<string, unknown>).$numberLong)).toISOString();
      }
      if (typeof raw === "number") return new Date(raw).toISOString();
      return String(raw);
    }
    if ("$numberLong" in obj) return String(obj.$numberLong);
    if ("$numberDecimal" in obj) return String(obj.$numberDecimal);
  }
  return JSON.stringify(value);
}

// Parse edited string back to appropriate type
function parseEditValue(str: string, originalType: string): unknown {
  if (str === "null") return null;
  if (str === "true") return true;
  if (str === "false") return false;

  switch (originalType) {
    case "Int32":
    case "Int64":
    case "Double":
    case "Decimal128": {
      const num = Number(str);
      if (!Number.isNaN(num)) return num;
      return str;
    }
    case "Bool":
      return str === "true";
    default:
      return str;
  }
}
