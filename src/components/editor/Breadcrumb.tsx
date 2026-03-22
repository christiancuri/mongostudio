import { ChevronRight, Server } from "lucide-react";

interface BreadcrumbProps {
  connectionName?: string;
  database?: string;
  collection?: string;
}

export function Breadcrumb({ connectionName, database, collection }: BreadcrumbProps) {
  if (!connectionName) return null;

  return (
    <div className="flex h-7 items-center gap-1 border-b border-border bg-muted/30 px-3 text-xs text-muted-foreground">
      <Server className="h-3 w-3" />
      <span>{connectionName}</span>
      {database && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span>{database}</span>
        </>
      )}
      {collection && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{collection}</span>
        </>
      )}
    </div>
  );
}
