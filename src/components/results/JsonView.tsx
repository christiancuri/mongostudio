import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { Copy } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

interface JsonViewProps {
  documents: Record<string, unknown>[];
}

export function JsonView({ documents }: JsonViewProps) {
  const jsonContent = useMemo(() => JSON.stringify(documents, null, 2), [documents]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonContent);
    toast.success("JSON copied to clipboard");
  }, [jsonContent]);

  return (
    <div className="relative h-full">
      <div className="absolute right-3 top-2 z-10">
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={handleCopy}>
          <Copy className="h-3 w-3" />
          Copy
        </Button>
      </div>
      <Editor
        defaultLanguage="json"
        value={jsonContent}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
          automaticLayout: true,
          wordWrap: "on",
          folding: true,
          padding: { top: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
