import { analyzeSchema } from "@/api/schema";
import { TypeBadge } from "@/components/common/TypeBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SchemaAnalysisResult, SchemaField } from "@/types/schema";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface SchemaAnalysisProps {
  connectionId: string;
  database: string;
  collection: string;
}

export function SchemaAnalysis({ connectionId, database, collection }: SchemaAnalysisProps) {
  const [result, setResult] = useState<SchemaAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [sampleSize] = useState(1000);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyzeSchema(connectionId, database, collection, sampleSize);
      setResult(data);
      toast.success(`Analyzed ${data.documentsSampled} documents`);
    } catch (err) {
      toast.error("Schema analysis failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, collection, sampleSize]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium">
            Schema: {database}.{collection}
          </h3>
          {result && (
            <Badge variant="secondary" className="text-[10px]">
              {result.documentsSampled} docs sampled
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {result ? "Re-analyze" : "Analyze"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!result && !loading && (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Click &quot;Analyze&quot; to discover the collection schema</p>
              <p className="mt-1 text-xs">Samples up to {sampleSize} documents</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex h-full items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {result && result.fields.length > 0 && (
          <div className="p-2 font-mono text-xs">
            {result.fields.map((field) => (
              <SchemaFieldNode
                key={field.path}
                field={field}
                depth={0}
                totalDocs={result.documentsSampled}
              />
            ))}
          </div>
        )}
        {result && result.fields.length === 0 && (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <p className="text-sm">No fields found (collection may be empty)</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function SchemaFieldNode({
  field,
  depth,
  totalDocs,
}: {
  field: SchemaField;
  depth: number;
  totalDocs: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = field.children.length > 0;
  const presencePercent = totalDocs > 0 ? ((field.totalCount / totalDocs) * 100).toFixed(1) : "0";

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium text-blue-400">{field.name}</span>
        <div className="ml-1 flex items-center gap-1">
          {Object.entries(field.types).map(([typeName, info]) => (
            <span key={typeName} className="flex items-center gap-0.5">
              <TypeBadge type={typeName} />
              <span className="text-[9px] text-muted-foreground">
                {info.percentage.toFixed(0)}%
              </span>
            </span>
          ))}
        </div>
        <span className="ml-auto text-[9px] text-muted-foreground">{presencePercent}%</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {field.children.map((child) => (
            <SchemaFieldNode
              key={child.path}
              field={child}
              depth={depth + 1}
              totalDocs={totalDocs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
