import { useEditorStore } from "@/stores/editorStore";
import { useTabStore } from "@/stores/tabStore";
import { useConnectionStore } from "@/stores/connectionStore";

export function StatusBar() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const editors = useEditorStore((s) => s.editors);
  const activeConnections = useConnectionStore((s) => s.activeConnections);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const editor = activeTabId ? editors.get(activeTabId) : undefined;
  const connection = activeTab?.connectionId
    ? activeConnections.get(activeTab.connectionId)
    : undefined;

  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        {editor && (
          <span>
            Ln {editor.cursorLine}, Col {editor.cursorColumn}
          </span>
        )}
        {activeTab?.dirty && (
          <span className="text-yellow-500">Modified</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {connection && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor: getColorHex(connection.config.colorFlag),
              }}
            />
            {connection.config.name}
            {activeTab?.database && ` / ${activeTab.database}`}
          </span>
        )}
        <span>MongoStudio v0.1.0</span>
      </div>
    </div>
  );
}

function getColorHex(color: string): string {
  const colors: Record<string, string> = {
    gray: "#6b7280",
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
  };
  return colors[color] ?? colors.gray;
}
